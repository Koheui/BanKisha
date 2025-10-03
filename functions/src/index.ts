import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { OpenAI } from 'openai'
import * as cors from 'cors'

// Initialize Firebase Admin
admin.initializeApp()

const corsHandler = cors({ origin: true })

// Initialize OpenAI
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

      const articlePrompt = `あなたはプロの編集者です。以下のQ&A逐語録を基に、「取材記事スタイル」で記事を生成してください。
自薦は禁止。必ず「◯◯社◯◯氏に伺った」といった体裁にしてください。

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

      // Generate article and SNS content
      const [articleResponse, snsResponse] = await Promise.all([
        openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: articlePrompt }],
          temperature: 0.7,
        }),
        openai.chat.completions.create({
          model: 'gpt-4',
          messages: [{ role: 'user', content: snsPrompt }],
          temperature: 0.7,
        })
      ])

      let articleContent
      let snsContent

      try {
        articleContent = JSON.parse(articleResponse.choices[0]?.message?.content || '{}')
      } catch (e) {
        console.error('Error parsing article content:', e)
        articleContent = {
          title: '記事生成エラー',
          lead: '記事の生成に失敗しました。',
          body: '記事の生成中にエラーが発生しました。'
        }
      }

      try {
        snsContent = JSON.parse(snsResponse.choices[0]?.message?.content || '{}')
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
