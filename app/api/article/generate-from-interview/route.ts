import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as admin from 'firebase-admin'
import { initializeFirebaseAdmin } from '@/src/lib/firebase-admin'

export async function POST(request: NextRequest) {
  try {
    await initializeFirebaseAdmin()
    const adminDb = admin.firestore()

    // 認証チェック
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
      interviewId,
      conversationHistory,
      targetAudience,
      mediaType,
      interviewPurpose,
      objective,
      intervieweeName,
      intervieweeCompany,
      knowledgeBaseIds
    } = body

    if (!conversationHistory || !Array.isArray(conversationHistory)) {
      return NextResponse.json({ error: '会話履歴が必要です' }, { status: 400 })
    }

    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API Keyが設定されていません' }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey)

    // ナレッジの取得
    let knowledgeBaseContext = ''
    let skillKnowledgeContext = ''

    if (knowledgeBaseIds && knowledgeBaseIds.length > 0) {
      const kbDocs = await Promise.all(
        knowledgeBaseIds.map(async (kbId: string) => {
          const kbDoc = await adminDb.collection('knowledgeBases').doc(kbId).get()
          if (!kbDoc.exists) return null
          const kbData = kbDoc.data()

          // スキルKBまたは本人のアップロードのみ許可
          const isSkillKB = kbData?.type === 'skill'
          const isOwner = kbData?.uploadedBy === decodedToken.uid

          if (!isSkillKB && !isOwner) return null

          const chunksSnapshot = await adminDb.collection('knowledgeBases').doc(kbId).collection('chunks').limit(50).get()
          const chunksText = chunksSnapshot.docs.map(doc => doc.data().text || '').join('\n\n')

          return {
            fileName: kbData?.fileName,
            category: kbData?.category || '一般的な知識',
            summary: kbData?.summary,
            chunks: chunksText,
            isSkillKB
          }
        })
      )

      const validKBs = kbDocs.filter(kb => kb !== null)

      skillKnowledgeContext = validKBs
        .filter(kb => kb?.isSkillKB)
        .map(kb => `【${kb?.fileName}】\n${kb?.chunks?.substring(0, 10000)}`)
        .join('\n\n')

      const userKnowledgeContext = validKBs
        .filter(kb => !kb?.isSkillKB)
        .map(kb => `【活用する専門知識：${kb?.category}】\nファイル名: ${kb?.fileName}\n内容: ${kb?.chunks?.substring(0, 5000)}`)
        .join('\n\n')

      knowledgeBaseContext = [skillKnowledgeContext, userKnowledgeContext].filter(Boolean).join('\n\n')
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 0.7, maxOutputTokens: 4000 },
    })

    const qaPairs = conversationHistory.map((msg: any) => `${msg.role === 'interviewer' ? 'Q' : 'A'}: ${msg.content}`).join('\n')

    const prompt = `あなたはプロのライターです。以下のインタビュー内容に基づき、${mediaType}に掲載するための記事を作成してください。

【取材条件】
・インタビュー対象: ${intervieweeName} (${intervieweeCompany || '個人'})
・目的: ${interviewPurpose}
・ターゲット: ${targetAudience}
・媒体: ${mediaType}

【参考ナレッジ】
${knowledgeBaseContext || '特になし'}

【取材内容】
${qaPairs}

【指示】
1. ナレッジに含まれる専門用語や視点を適切に取り入れ、深みのある内容にしてください。
2. ターゲット読者が読みやすく、かつ示唆に富む構成にしてください。
3. 文体は${mediaType}に適したトーンにしてください。
`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    return NextResponse.json({ article: text, success: true })

  } catch (error: any) {
    console.error('❌ Article Generation Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
