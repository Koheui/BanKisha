import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as admin from 'firebase-admin'
import { initializeFirebaseAdmin, adminDebug } from '@/src/lib/firebase-admin'

export async function POST(request: NextRequest) {
  try {
    const app = await initializeFirebaseAdmin()
    if (!app) {
      throw new Error('Firebase Admin SDK could not be initialized.')
    }
    const adminDb = app.firestore()

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
      supplementaryInfo,
      intervieweeName,
      intervieweeCompany,
      category,
      knowledgeBaseIds
    } = body

    // interviewIdがあれば取材時に入力された会社情報を取得してプロンプトに追加する
    let companyInfoText = ''
    if (interviewId) {
      try {
        const interviewDoc = await adminDb.collection('interviews').doc(interviewId).get()
        if (interviewDoc.exists) {
          const info = interviewDoc.data()?.intervieweeCompanyInfo
          if (info) {
            const parts: string[] = []
            if (info.serviceName) parts.push(`サービス名: ${info.serviceName}`)
            if (info.companyName) parts.push(`会社名: ${info.companyName}`)
            if (info.address) parts.push(`住所: ${info.address}`)
            if (info.url) parts.push(`URL: ${info.url}`)
            if (Array.isArray(info.items)) {
              for (const it of info.items) {
                if (it && (it.label || it.value)) parts.push(`${it.label || '(項目)'}: ${it.value || ''}`)
              }
            }
            if (parts.length > 0) companyInfoText = parts.join('\n')
          }
        }
      } catch (e) {
        console.warn('Failed to load interview company info:', e)
      }
    }

    if (!conversationHistory || !Array.isArray(conversationHistory)) {
      return NextResponse.json({ error: '会話履歴が必要です' }, { status: 400 })
    }

    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      return NextResponse.json({ error: 'Gemini API Keyが設定されていません' }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey)

    // 1. システム設定取得
    let directionPromptContext = ''
    try {
      const settingsDoc = await adminDb.collection('systemSettings').doc('appDirection').get()
      if (settingsDoc.exists) {
        directionPromptContext = settingsDoc.data()?.directionPrompt || ''
      }
    } catch (error) {
      console.warn('⚠️ Error loading app direction prompt:', error)
    }

    // 2. ナレッジの取得（スキルKB + ユーザーKB）
    let skillKnowledgeContext = ''
    let userKnowledgeContext = ''

    if (adminDb) {
      // スキルKBを自動取得
      const skillKBSnapshot = await adminDb.collection('knowledgeBases')
        .where('type', '==', 'skill')
        .where('deleted', '==', false)
        .limit(10)
        .get()

      const skillKBs = await Promise.all(skillKBSnapshot.docs.map(async doc => {
        const kbData = doc.data()
        if (kbData.useForArticle === false) return null
        const chunks = await adminDb.collection('knowledgeBases').doc(doc.id).collection('chunks').limit(50).get()
        return {
          fileName: kbData.fileName,
          summary: kbData.summary,
          chunks: chunks.docs.map(c => c.data().text).join('\n')
        }
      }))

      skillKnowledgeContext = skillKBs
        .filter(kb => kb !== null)
        .map(kb => `【${kb?.fileName}】\n${kb?.chunks?.substring(0, 15000)}`)
        .join('\n\n')

      // ユーザー選択のKBを取得（認証チェック付き）
      if (knowledgeBaseIds && knowledgeBaseIds.length > 0) {
        const userKBs = await Promise.all(knowledgeBaseIds.map(async (id: string) => {
          const kbDoc = await adminDb.collection('knowledgeBases').doc(id).get()
          if (!kbDoc.exists) return null
          const kbData = kbDoc.data()
          if (!kbData || kbData.uploadedBy !== decodedToken.uid) return null // 自分のもの以外は拒否

          const chunks = await adminDb.collection('knowledgeBases').doc(id).collection('chunks').limit(50).get()
          return {
            fileName: kbData.fileName,
            category: kbData.category || '一般的な知識',
            summary: kbData.summary,
            chunks: chunks.docs.map(c => c.data().text).join('\n')
          }
        }))

        userKnowledgeContext = userKBs
          .filter(kb => kb !== null)
          .map(kb => `【活用する専門知識：${kb?.category}】\nファイル名: ${kb?.fileName}\n内容: ${kb?.chunks?.substring(0, 5000)}`)
          .join('\n\n')
      }
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { temperature: 0.7, maxOutputTokens: 8000 },
    })

    const qaPairs = conversationHistory.map((msg: any) => `${msg.role === 'interviewer' ? 'Q' : 'A'}: ${msg.content}`).join('\n\n')

    const prompt = `あなたはプロのライターです。以下の内容を元に、${mediaType}に掲載するための記事の「敲き」（構成案と下書き）を作成してください。

${directionPromptContext ? `【基本原則】\n${directionPromptContext}` : ''}

【専門スキルナレッジ】
${skillKnowledgeContext || 'なし'}

【活用する専門知識】
${userKnowledgeContext || 'なし'}

【取材条件】
・対象: ${intervieweeName} (${intervieweeCompany || '個人'})
・媒体: ${mediaType}
・ターゲット: ${targetAudience}
・目的: ${interviewPurpose}
・補足情報: ${supplementaryInfo || 'なし'}
${companyInfoText ? `・会社情報:\n${companyInfoText}` : ''}
${category ? `・カテゴリ: ${category}` : ''}

【具体的なリクエスト】
${objective || '特になし'}

【取材データ】
${qaPairs}

【出力形式】
以下のJSON形式のみを出力してください。

{
  "explanation": "なぜこういう記事にしたのか？という解説（200-300文字程度）。外部資料の引用元などは明かさないこと。",
  "sections": [
    {
      "section": "現在",
      "heading": "現在の取組み（見出し）",
      "keyPoints": ["要点1", "要点2", "要点3"],
      "contentOutline": "このセクションの内容概要"
    },
    {
      "section": "過去",
      "heading": "過去の経緯（見出し）",
      "keyPoints": ["要点1", "要点2", "要点3"],
      "contentOutline": "このセクションの内容概要"
    },
    {
      "section": "未来",
      "heading": "今後の展望（見出し）",
      "keyPoints": ["要点1", "要点2", "要_Points"],
      "contentOutline": "このセクションの内容概要"
    }
  ]
}
`

    const result = await model.generateContent(prompt)
    const text = result.response.text()

    // JSONのみを抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const jsonStr = jsonMatch ? jsonMatch[0] : text

    try {
      return NextResponse.json(JSON.parse(jsonStr))
    } catch (parseError: any) {
      console.error('❌ Draft JSON Parse Error:', parseError.message)
      console.error('📝 Gemini Response text:', text)
      return NextResponse.json({
        error: 'AIの回答を正常に解析できませんでした',
        details: parseError.message,
        generatedTextPreview: text.substring(0, 500),
        adminDebug: adminDebug
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('❌ Draft Generation Error:', error)
    return NextResponse.json({
      error: error.message,
      adminDebug: adminDebug
    }, { status: 500 })
  }
}
