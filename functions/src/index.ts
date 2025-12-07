import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { GoogleGenerativeAI, EmbedContentRequest } from '@google/generative-ai'
import { OpenAI } from 'openai'
import * as cors from 'cors'
import * as pdfParse from 'pdf-parse'

// Initialize Firebase Admin
admin.initializeApp()

const corsHandler = cors({ origin: true })

// Initialize Gemini
const genAI = new GoogleGenerativeAI(
  functions.config().gemini?.api_key || process.env.GEMINI_API_KEY || ''
)

// Initialize OpenAI (for Whisper transcription)
const openai = new OpenAI({
  apiKey: functions.config().openai?.api_key || process.env.OPENAI_API_KEY,
})

/**
 * Generate article content from interview Q&A using GPT
 */
export const generateArticle = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed')
        return
      }

      const { qa, companyName } = req.body

      if (!qa || !Array.isArray(qa)) {
        res.status(400).send('Invalid Q&A data')
        return
      }

      const qaText = qa.map((item: any) => `Q: ${item.q}\nA: ${item.transcript || item.textAnswer || ''}`).join('\n\n')

      // Search knowledge base for article writing best practices
      let knowledgeContext = ''
      try {
        const searchModel = genAI.getGenerativeModel({ model: 'embedding-001' })
        const searchQuery = '記事執筆 取材記事 書き方 ベストプラクティス'
        const searchResult = await searchModel.embedContent({
          content: { parts: [{ text: searchQuery }], role: 'user' }
        } as EmbedContentRequest)
        
        const searchEmbedding = searchResult.embedding.values
        
        // Get relevant chunks from Firestore
        const chunksSnapshot = await admin.firestore()
          .collection('knowledgeChunks')
          .limit(50)
          .get()

        const results = []
        for (const doc of chunksSnapshot.docs) {
          const chunk = doc.data()
          if (chunk.embedding && Array.isArray(chunk.embedding)) {
            const similarity = cosineSimilarity(searchEmbedding, chunk.embedding)
            if (similarity > 0.7) {
              results.push({ text: chunk.text, score: similarity })
            }
          }
        }

        results.sort((a, b) => b.score - a.score)
        if (results.length > 0) {
          knowledgeContext = '\n\n【記事執筆のベストプラクティス（参考資料）】\n' +
            results.slice(0, 3).map((r, i) => `${i + 1}. ${r.text}`).join('\n\n')
        }
      } catch (error) {
        console.error('Error searching knowledge base for article:', error)
        // Continue without knowledge base if search fails
      }

      const articlePrompt = `あなたはプロの編集者です。以下のQ&A逐語録を基に、「取材記事スタイル」で記事を生成してください。
自薦は禁止。必ず「◯◯社◯◯氏に伺った」といった体裁にしてください。

${knowledgeContext ? '参考資料の記事執筆のベストプラクティスを活用して、より質の高い記事を作成してください。' : ''}

QA:
${qaText}

出力フォーマット（JSON）:
{
  "title": "記事タイトル（38字以内）",
  "lead": "記事のリード文（200字以内）",
  "body": "記事本文（見出し3-4個＋本文、Markdownフォーマット）"
}

記事末尾に必ず以下を追加してください:
発行元 BanKisha`

      const snsPrompt = `あなたは広報担当です。以下の記事からSNS投稿文を作成してください。
必ず「本メディアが取材した」という体裁にしてください。

記事:
${JSON.stringify(articlePrompt)}

出力フォーマット（JSON）:
{
  "x140": "Twitter投稿文（140字以内）",
  "linkedin300": "LinkedIn投稿文（300字以内）"
}

共通末尾に必ず以下を追加してください:
発行元 BanKisha`

      // Get Gemini model
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-pro',
        generationConfig: {
          temperature: 0.7,
        }
      })

      // Generate article and SNS content using Gemini
      const [articleResult, snsResult] = await Promise.all([
        model.generateContent(articlePrompt),
        model.generateContent(snsPrompt)
      ])

      let articleContent
      let snsContent

      try {
        const articleText = articleResult.response.text()
        // Try to extract JSON from the response
        const jsonMatch = articleText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          articleContent = JSON.parse(jsonMatch[0])
        } else {
          // Fallback: parse the entire response
          articleContent = JSON.parse(articleText)
        }
      } catch (e) {
        console.error('Error parsing article content:', e)
        // Try to extract content manually
        const articleText = articleResult.response.text()
        articleContent = {
          title: articleText.split('\n')[0] || '無題のインタビュー',
          lead: articleText.split('\n').slice(1, 3).join(' ') || '記事の生成に失敗しました。',
          body: articleText || '記事の生成中にエラーが発生しました。'
        }
      }

      try {
        const snsText = snsResult.response.text()
        const jsonMatch = snsText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          snsContent = JSON.parse(jsonMatch[0])
        } else {
          snsContent = JSON.parse(snsText)
        }
      } catch (e) {
        console.error('Error parsing SNS content:', e)
        snsContent = {
          x140: 'BanKishaが取材した記事です。',
          linkedin300: 'BanKishaが取材した記事の詳細をリンクからご確認ください。'
        }
      }

      res.json({
        success: true,
        article: {
          title: articleContent.title || '無題のインタビュー',
          lead: articleContent.lead || '',
          bodyMd: articleContent.body || '',
          headings: extractHeadings(articleContent.body || '')
        },
        sns: {
          x140: snsContent.x140 || `BanKishaが${companyName}に取材した記事です。`,
          linkedin300: snsContent.linkedin300 || `BanKishaが${companyName}に取材した記事の詳細をリンクからご確認ください。`
        }
      })

    } catch (error) {
      console.error('Error generating article:', error)
      res.status(500).json({ 
        success: false, 
        error: '記事の生成に失敗しました' 
      })
    }
  })
})

/**
 * Transcribe audio using Whisper API
 */
export const transcribeAudio = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed')
        return
      }

      const { audioUrl } = req.body

      if (!audioUrl) {
        res.status(400).send('Audio URL is required')
        return
      }

      // Download audio file from URL
      const response = await fetch(audioUrl)
      const audioBuffer = await response.arrayBuffer()
      
      // Create a File-like object for Whisper
      const audioFile = new File([audioBuffer], 'audio.mp3', { type: 'audio/mp3' })

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'ja',
        response_format: 'text'
      })

      res.json({
        success: true,
        transcript: transcription
      })

    } catch (error) {
      console.error('Error transcribing audio:', error)
      res.status(500).json({ 
        success: false, 
        error: '音声の文字化に失敗しました' 
      })
    }
  })
})

/**
 * User creation trigger
 */
export const onCreateUser = functions.auth.user().onCreate(async (user) => {
  try {
    // Create user document in Firestore
    await admin.firestore().collection('users').doc(user.uid).set({
      email: user.email,
      displayName: user.displayName || user.email?.split('@')[0],
      role: 'company', // Default role
      companyId: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })
    
    console.log(`User document created for ${user.uid}`)
  } catch (error) {
    console.error('Error creating user document:', error)
  }
})

/**
 * Process PDF and create knowledge base chunks
 */
export const processKnowledgeBasePDF = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed')
        return
      }

      const { pdfUrl, knowledgeBaseId, title } = req.body

      if (!pdfUrl || !knowledgeBaseId) {
        res.status(400).send('PDF URL and knowledge base ID are required')
        return
      }

      // Download PDF
      const pdfResponse = await fetch(pdfUrl)
      const pdfBuffer = await pdfResponse.arrayBuffer()
      
      // Parse PDF
      const pdfData = await pdfParse(Buffer.from(pdfBuffer))
      const text = pdfData.text
      const pageCount = pdfData.numpages

      // Split text into chunks (approximately 500 characters per chunk)
      const chunkSize = 500
      const chunks: string[] = []
      const lines = text.split('\n')
      let currentChunk = ''

      for (const line of lines) {
        if (currentChunk.length + line.length > chunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk.trim())
          currentChunk = line + ' '
        } else {
          currentChunk += line + ' '
        }
      }
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim())
      }

      // Get embedding model
      const embeddingModel = genAI.getGenerativeModel({ model: 'embedding-001' })

      // Process chunks and create embeddings
      const batchSize = 10
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize)
        
        const embeddings = await Promise.all(
          batch.map(async (chunk, index) => {
            try {
              const result = await embeddingModel.embedContent({
                content: { parts: [{ text: chunk }], role: 'user' }
              } as EmbedContentRequest)
              
              return {
                chunk,
                embedding: result.embedding.values,
                chunkIndex: i + index
              }
            } catch (error) {
              console.error(`Error creating embedding for chunk ${i + index}:`, error)
              return null
            }
          })
        )

        // Save chunks to Firestore
        const firestoreBatch = admin.firestore().batch()
        embeddings.forEach((emb, index) => {
          if (emb) {
            const chunkRef = admin.firestore()
              .collection('knowledgeChunks')
              .doc()
            
            firestoreBatch.set(chunkRef, {
              knowledgeBaseId,
              chunkIndex: i + index,
              text: emb.chunk,
              embedding: emb.embedding,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            })
          }
        })
        await firestoreBatch.commit()
      }

      // Update knowledge base status
      await admin.firestore()
        .collection('knowledgeBases')
        .doc(knowledgeBaseId)
        .update({
          status: 'completed',
          pageCount,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        })

      res.json({
        success: true,
        chunksCreated: chunks.length,
        pageCount
      })

    } catch (error) {
      console.error('Error processing PDF:', error)
      res.status(500).json({
        success: false,
        error: 'PDF処理に失敗しました'
      })
    }
  })
})

/**
 * Search knowledge base
 */
export const searchKnowledgeBase = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed')
        return
      }

      const { query, limit = 5 } = req.body

      if (!query) {
        res.status(400).send('Query is required')
        return
      }

      // Get embedding for query
      const embeddingModel = genAI.getGenerativeModel({ model: 'embedding-001' })
      const queryResult = await embeddingModel.embedContent({
        content: { parts: [{ text: query }], role: 'user' }
      } as EmbedContentRequest)
      
      const queryEmbedding = queryResult.embedding.values

      // Get all knowledge chunks
      const chunksSnapshot = await admin.firestore()
        .collection('knowledgeChunks')
        .get()

      // Calculate cosine similarity
      const results = []
      for (const doc of chunksSnapshot.docs) {
        const chunk = doc.data()
        if (chunk.embedding && Array.isArray(chunk.embedding)) {
          const similarity = cosineSimilarity(queryEmbedding, chunk.embedding)
          results.push({
            id: doc.id,
            text: chunk.text,
            knowledgeBaseId: chunk.knowledgeBaseId,
            chunkIndex: chunk.chunkIndex,
            score: similarity
          })
        }
      }

      // Sort by score and return top results
      results.sort((a, b) => b.score - a.score)
      const topResults = results.slice(0, limit)

      res.json({
        success: true,
        results: topResults
      })

    } catch (error) {
      console.error('Error searching knowledge base:', error)
      res.status(500).json({
        success: false,
        error: '検索に失敗しました'
      })
    }
  })
})

// Helper function to calculate cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) {
    return 0
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Helper function to extract headings from markdown
function extractHeadings(markdown: string): string[] {
  const headingRegex = /^#+\s+(.+)/gm
  const matches = []
  let match
  
  while ((match = headingRegex.exec(markdown)) !== null) {
    matches.push(match[1].trim())
  }
  
  return matches
}
