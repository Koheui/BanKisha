import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as admin from 'firebase-admin'
import { initializeFirebaseAdmin } from '@/src/lib/firebase-admin'

export async function POST(request: NextRequest) {
  try {
    initializeFirebaseAdmin()
    const adminDb = admin.firestore()
    console.log('📥 [API] Received generate questions request')

    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const idToken = authHeader.split('Bearer ')[1]
    let decodedToken: admin.auth.DecodedIdToken
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken)
    } catch (error) {
      return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 })
    }

    const body = await request.json()
    const {
      title,
      interviewPurpose,
      targetAudience,
      mediaType,
      objective,
      supplementaryInfo,
      interviewSource,
      interviewerName,
      interviewerPrompt,
      numQuestions = 6,
      category,
      previousQuestions = [],
      userFeedback = '',
      knowledgeBaseIds = [],
      companyId
    } = body

    const geminiKeyPresent = !!process.env.GEMINI_API_KEY
    const geminiKeyLength = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.length : 0
    console.log('🔑 GEMINI key present:', geminiKeyPresent, 'keyLength:', geminiKeyLength)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    let knowledgeBaseContext = ''
    let skillKnowledgeContext = ''
    let userKBLogs = { count: 0 }

    // 1. スキルナレッジベース（共有のプロンプトエンジニアリング・対話術）
    const skillKBIds = ['skill-dialogue-v1'] // デフォルトのスキルKB
    try {
      const skillKBDocs = await Promise.all(
        skillKBIds.map(async (kbId) => {
          const kbDoc = await adminDb.collection('knowledgeBases').doc(kbId).get()
          if (!kbDoc.exists) return null
          const kbData = kbDoc.data()

          const chunksSnapshot = await adminDb.collection('knowledgeBases').doc(kbId).collection('chunks').limit(50).get()
          const chunksText = chunksSnapshot.docs.map(doc => doc.data().text || '').join('\n\n')

          return {
            fileName: kbData?.fileName,
            summary: kbData?.summary,
            usageGuide: kbData?.usageGuide,
            chunks: chunksText
          }
        })
      )

      const validSkillKBs = skillKBDocs.filter(kb => kb !== null)
      if (validSkillKBs.length > 0) {
        skillKnowledgeContext = validSkillKBs.map(kb => {
          let ctx = `【${kb?.fileName}】\n概要: ${kb?.summary}\n活用方法: ${kb?.usageGuide}`
          if (kb?.chunks) ctx += `\n\n【ナレッジ】\n${kb.chunks.substring(0, 8000)}`
          return ctx
        }).join('\n\n')
      }
    } catch (e) {
      console.warn('⚠️ Skill KB load failed')
    }

    // 2. ユーザーナレッジベース（個人スコープの専門知識）
    if (knowledgeBaseIds && knowledgeBaseIds.length > 0) {
      try {
        const kbDocs = await Promise.all(
          knowledgeBaseIds.map(async (kbId: string) => {
            const kbDoc = await adminDb.collection('knowledgeBases').doc(kbId).get()
            if (!kbDoc.exists) return null
            const kbData = kbDoc.data()

            // スコープの確認（アップロード者が一致するか）
            if (kbData?.uploadedBy !== decodedToken.uid) {
              console.warn(`⚠️ Access denied to KB ${kbId}`)
              return null
            }

            const chunksSnapshot = await adminDb.collection('knowledgeBases').doc(kbId).collection('chunks').limit(20).get()
            const chunksText = chunksSnapshot.docs.map(doc => doc.data().text || '').join('\n\n')

            return {
              fileName: kbData?.fileName,
              category: kbData?.category || '一般的な知識',
              summary: kbData?.summary,
              chunks: chunksText
            }
          })
        )

        const userKBs = kbDocs.filter(kb => kb !== null)
        userKBLogs.count = userKBs.length

        if (userKBs.length > 0) {
          const userKBContext = userKBs.map(kb => {
            let ctx = `【活用する専門知識：${kb?.category}】\nファイル名: ${kb?.fileName}\n概要: ${kb?.summary}`
            if (kb?.chunks) ctx += `\n\n【詳細 context】\n${kb.chunks.substring(0, 2000)}`
            return ctx
          }).join('\n\n')
          knowledgeBaseContext = skillKnowledgeContext ? `${skillKnowledgeContext}\n\n${userKBContext}` : userKBContext
        } else {
          knowledgeBaseContext = skillKnowledgeContext
        }
      } catch (e) {
        console.warn('⚠️ User KB load failed')
        knowledgeBaseContext = skillKnowledgeContext
      }
    } else {
      knowledgeBaseContext = skillKnowledgeContext
    }

    console.log('📚 KB Context Info:', { skill: !!skillKnowledgeContext, userKBs: userKBLogs.count })

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 0.0 }, // Deterministic output for stable JSON
    })

    const rolePrompt = `あなたはプロのインタビュアー兼編集者です。
提携する専門知識やナレッジベース、およびユーザーからの指定条件（目的、ターゲット、媒体）に基づき、最も鋭く、本質を引き出す ${numQuestions} 問の質問セットを構成してください。`

    const contextPrompt = `
【取材の前提条件】
・インタビュー名: ${title}
・目的: ${interviewPurpose}
・ターゲット: ${targetAudience}
・媒体: ${mediaType}
・具体的に聞きたいこと: ${objective}
${supplementaryInfo ? `・補足資料・事実関係: ${supplementaryInfo}` : ''}
・取材形式: ${interviewSource === 'self' ? '自薦（本人の考えを引き出す）' : '他薦（客観的事実とエピソードを引き出す）'}
${interviewerName ? `・担当インタビュアー: ${interviewerName}` : ''}
${interviewerPrompt ? `・インタビュアーへの指示: ${interviewerPrompt}` : ''}

【提供されたナレッジ・専門知識】
${knowledgeBaseContext || '特になし'}

【フィードバック・既存質問】
${previousQuestions.length > 0 ? `既存の質問案: ${previousQuestions.join(', ')}` : ''}
${userFeedback ? `修正・追加の要望: ${userFeedback}` : ''}
`

    const instructionPrompt = `
【指示】
1. 指定された「専門分野のナレッジ」がある場合、それを最大限に活かし、門外漢には聞けない深い質問を含めてください。
2. 読者が${mediaType}でこの記事を読んだ際に、「これこそが知りたかった」と思えるような、具体的で示唆に富む回答を引き出せる質問にしてください。
3. 全体で ${numQuestions} 問程度とし、導入から核心、そして展望へと流れるようなストーリー構成にしてください。
4. ユーザーが「具体的に聞きたいこと」として挙げた内容は必ず網羅してください。
5. **出力は必ず純粋な JSON のみを返してください。他の言語説明、前置文、注釈、翻訳、あるいは余計な出力を一切含めないでください。**
6. コードブロックは使わないでください（バッククオート記号を含めないでください）。代わりにプレーンな JSON オブジェクトだけを応答として返してください。

【出力形式】
JSON形式で以下のキーを含めてください：
{
  "questions": ["質問1", "質問2", ...],
  "openingMessage": "インタビュー開始時の挨拶文",
  "explanation": "なぜこの質問セットにしたのか、プロの視点での解説"
}
`

    const result = await model.generateContent([rolePrompt, contextPrompt, instructionPrompt])
    const responseText = result.response.text()

    // Debug: Preview AI response (truncated) to help diagnose format errors
    try {
      console.log('🧾 AI response preview:', responseText.substring(0, 1000))
    } catch (e) {
      console.warn('Could not preview AI response:', e)
    }

    // JSON抽出（まずは ```json コードブロックを優先）
    const codeBlockMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/i)
    const jsonMatch = codeBlockMatch ? codeBlockMatch[1] : responseText.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      // 再試行: モデルに「純粋なJSONのみ」を明示的に要求
      console.warn('⚠️ AI did not return JSON. Attempting a strict retry...')
      try {
        const retryPrompt = 'このリクエストでは「純粋なJSONのみ」を返してください。余計な説明やテキストを一切付けず、エスケープせずにJSONオブジェクトをそのまま返してください。出力例: {"questions":["質問1"],"openingMessage":"...","explanation":"..."}'}
        const retryResult = await model.generateContent([retryPrompt])
        const retryText = retryResult.response.text()
        console.log('🧾 Retry AI response preview:', retryText.substring(0, 1000))
        const retryCodeBlock = retryText.match(/```json\s*([\s\S]*?)\s*```/i)
        const retryJsonMatch = retryCodeBlock ? retryCodeBlock[1] : retryText.match(/\{[\s\S]*\}/)
        if (!retryJsonMatch) {
          console.error('❌ Retry also failed to return JSON. Full response (truncated 8k):', retryText.substring(0, 8000))
          throw new Error('Invalid AI response format after retry')
        }
        const parsedRetry = JSON.parse(retryJsonMatch[0] || retryJsonMatch)
        return NextResponse.json({
          ...parsedRetry,
          success: true,
          _note: 'returned from retry'
        })
      } catch (retryError) {
        console.error('❌ JSON parse failed for AI response. Full response (truncated 8k chars):', responseText.substring(0, 8000))
        throw new Error('Invalid AI response format')
      }
    }

    const parsed = JSON.parse(jsonMatch[0] || jsonMatch)

    return NextResponse.json({
      ...parsed,
      success: true
    })

  } catch (error) {
    console.error('❌ Question Generation Error:', error)
    return NextResponse.json({
      error: '質問生成中にエラーが発生しました',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}
