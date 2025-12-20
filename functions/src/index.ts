import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { GoogleGenerativeAI } from '@google/generative-ai'
import cors from 'cors'
// @ts-expect-error - pdf-parse doesn't have type definitions
import pdfParse from 'pdf-parse'

// Initialize Firebase Admin
admin.initializeApp()

const corsHandler = cors({ origin: true })

// Initialize Gemini
const genAI = new GoogleGenerativeAI(
  functions.config().gemini?.api_key || process.env.GEMINI_API_KEY || ''
)

/**
 * Process PDF and create knowledge base chunks
 * 
 * 大容量PDF対応版（120MB対応）
 */
export const processKnowledgeBasePDF = functions
  .runWith({
    timeoutSeconds: 540, // 最大9分
    memory: '4GB', // 2GB→4GBに増強
  })
  .https.onRequest(async (req, res) => {
    corsHandler(req, res, async () => {
      const startTime = Date.now()
      
      try {
        if (req.method !== 'POST') {
          res.status(405).send('Method Not Allowed')
          return
        }

        const { pdfUrl, knowledgeBaseId } = req.body

        if (!pdfUrl || !knowledgeBaseId) {
          res.status(400).send('PDF URL and knowledge base ID are required')
          return
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('📥 [PDF Processing] v1.0 (gemini-2.5-flash)')
        console.log('📥 Starting...')
        console.log(`   KB ID: ${knowledgeBaseId}`)
        console.log(`   URL: ${pdfUrl}`)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

        // Step 1: Download PDF
        console.log('\n📥 [Step 1/6] Downloading PDF...')
        const pdfResponse = await fetch(pdfUrl)
        
        if (!pdfResponse.ok) {
          throw new Error(`Failed to download PDF: ${pdfResponse.status} ${pdfResponse.statusText}`)
        }

        const pdfBuffer = await pdfResponse.arrayBuffer()
        const fileSizeMB = (pdfBuffer.byteLength / (1024 * 1024)).toFixed(2)
        console.log(`   ✅ Downloaded: ${fileSizeMB} MB`)

        // Step 2: Parse PDF
        console.log('\n📄 [Step 2/6] Parsing PDF...')
        const parseStartTime = Date.now()
        
        const pdfData = await pdfParse(Buffer.from(pdfBuffer))
        const text = pdfData.text
        const pageCount = pdfData.numpages
        
        const parseTime = ((Date.now() - parseStartTime) / 1000).toFixed(1)
        console.log(`   ✅ Parsed: ${pageCount} pages, ${text.length} characters (${parseTime}s)`)

        // Step 3: Split text into chunks
        console.log('\n✂️ [Step 3/6] Splitting into chunks...')
        const chunkStartTime = Date.now()
        
        const chunkSize = 800 // 500→800に増量（大きなPDFに対応）
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

        const chunkTime = ((Date.now() - chunkStartTime) / 1000).toFixed(1)
        console.log(`   ✅ Created ${chunks.length} chunks (${chunkTime}s)`)

        // Step 4: Create embeddings
        console.log('\n🧠 [Step 4/6] Creating embeddings...')
        const embeddingStartTime = Date.now()
        
        const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' })
        
        // バッチサイズを大きくして効率化（10→20）
        const batchSize = 20
        let processedCount = 0

        for (let i = 0; i < chunks.length; i += batchSize) {
          const batch = chunks.slice(i, i + batchSize)
          const batchNum = Math.floor(i / batchSize) + 1
          const totalBatches = Math.ceil(chunks.length / batchSize)
          
          console.log(`   Processing batch ${batchNum}/${totalBatches} (chunks ${i + 1}-${Math.min(i + batchSize, chunks.length)})`)

          const embeddings = await Promise.all(
            batch.map(async (chunk, index) => {
              try {
                const result = await embeddingModel.embedContent({
                  content: { parts: [{ text: chunk }], role: 'user' },
                })

                return {
                  chunk,
                  embedding: result.embedding.values,
                  chunkIndex: i + index,
                }
              } catch (error) {
                console.error(`   ⚠️ Error creating embedding for chunk ${i + index}:`, error)
                return null
              }
            })
          )

          // Firestoreにバッチ保存
          const firestoreBatch = admin.firestore().batch()
          
          embeddings.forEach((emb) => {
            if (emb) {
              const chunkRef = admin.firestore().collection('knowledgeChunks').doc()
              firestoreBatch.set(chunkRef, {
                knowledgeBaseId,
                chunkIndex: emb.chunkIndex,
                text: emb.chunk,
                embedding: emb.embedding,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              })
              processedCount++
            }
          })

          await firestoreBatch.commit()
          console.log(`   ✅ Batch ${batchNum} saved (${processedCount}/${chunks.length} chunks processed)`)
        }

        const embeddingTime = ((Date.now() - embeddingStartTime) / 1000).toFixed(1)
        console.log(`   ✅ All embeddings created (${embeddingTime}s)`)

        // Step 5: Generate summary and usage guide
        console.log('\n📝 [Step 5/6] Generating summary...')
        const summaryStartTime = Date.now()
        
        let summary = ''
        let usageGuide = ''

        try {
          const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: {
              temperature: 0.7,
            },
          })

          // Get knowledge base info
          const kbDoc = await admin.firestore()
            .collection('knowledgeBases')
            .doc(knowledgeBaseId)
            .get()
          
          const kbData = kbDoc.data()
          const kbTitle = kbData?.fileName || '無題'

          // テキストが長すぎる場合は先頭と後半を組み合わせる
          const maxTextLength = 30000
          let textForSummary = text
          
          if (text.length > maxTextLength) {
            const firstPart = text.substring(0, maxTextLength / 2)
            const lastPart = text.substring(text.length - maxTextLength / 2)
            textForSummary = firstPart + '\n\n[...中略...]\n\n' + lastPart
          }

          // Generate summary
          const summaryPrompt = `以下のPDFナレッジベースの内容を分析して、簡潔で分かりやすい要約を作成してください。

タイトル: ${kbTitle}
ページ数: ${pageCount}ページ

内容:
${textForSummary}

以下の形式で要約を出力してください：
• このナレッジベースの主要なテーマやトピック
• 重要なポイント（3-5個）
• 対象読者や適用シーン

要約は200-300字程度で、箇条書きで整理してください。`

          const summaryResult = await model.generateContent(summaryPrompt)
          summary = summaryResult.response.text()
          console.log('   ✅ Summary generated')

          // Generate usage guide
          const usagePrompt = `以下のナレッジベースの内容を分析して、AIインタビュアーでの具体的な活用方法を提案してください。

タイトル: ${kbTitle}
概要: ${summary}

このナレッジベースを使って、AIインタビュアーがどのように質問を改善できるか、具体的な活用シーンを2-3個提案してください。

150-200字程度で記述してください。`

          const usageResult = await model.generateContent(usagePrompt)
          usageGuide = usageResult.response.text()
          console.log('   ✅ Usage guide generated')

        } catch (error) {
          console.error('   ⚠️ Error generating summary:', error)
          summary = `このナレッジベースには${pageCount}ページ、${chunks.length}チャンクの情報が含まれています。`
          usageGuide = 'AIインタビュアーの質問生成に活用できます。'
        }

        const summaryTime = ((Date.now() - summaryStartTime) / 1000).toFixed(1)
        console.log(`   ✅ Summary complete (${summaryTime}s)`)

        // Step 6: Update knowledge base status
        console.log('\n💾 [Step 6/6] Updating knowledge base...')
        
        await admin.firestore()
          .collection('knowledgeBases')
          .doc(knowledgeBaseId)
          .update({
            status: 'ready',
            pageCount,
            chunkCount: chunks.length,
            summary,
            usageGuide,
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
          })

        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('✅ [PDF Processing] Complete!')
        console.log(`   Total time: ${totalTime}s`)
        console.log(`   File size: ${fileSizeMB} MB`)
        console.log(`   Pages: ${pageCount}`)
        console.log(`   Chunks: ${chunks.length}`)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

        res.json({
          success: true,
          pageCount,
          chunkCount: chunks.length,
          summary,
          processingTime: totalTime,
        })

      } catch (error: any) {
        const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
        
        console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.error('❌ [PDF Processing] Error!')
        console.error(`   Time elapsed: ${totalTime}s`)
        console.error(`   Error:`, error)
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

        // Update status to error
        try {
          if (req.body.knowledgeBaseId) {
            await admin.firestore()
              .collection('knowledgeBases')
              .doc(req.body.knowledgeBaseId)
              .update({
                status: 'error',
                errorMessage: error.message || 'Unknown error',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              })
          }
        } catch (updateError) {
          console.error('Failed to update error status:', updateError)
        }

        res.status(500).json({
          success: false,
          error: error.message || 'Failed to process PDF',
        })
      }
    })
  })

