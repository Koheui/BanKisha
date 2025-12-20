import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as admin from 'firebase-admin'
import { initializeFirebaseAdmin } from '@/src/lib/firebase-admin'

// Initialize Firebase Admin SDK
initializeFirebaseAdmin()

const adminDb = admin.firestore()

export async function POST(request: NextRequest) {
  try {
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
    } = await request.json()

    if (!conversationHistory || !Array.isArray(conversationHistory)) {
      return NextResponse.json(
        { error: '会話履歴が必要です' },
        { status: 400 }
      )
    }

    if (!targetAudience || !mediaType) {
      return NextResponse.json(
        { error: 'ターゲット読者と掲載メディアの情報が必要です' },
        { status: 400 }
      )
    }

    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'Gemini API Keyが設定されていません' },
        { status: 500 }
      )
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey)

    // スキルナレッジベースから記事制作のベストプラクティスを取得
    let skillKnowledgeContext = ''
    if (knowledgeBaseIds && knowledgeBaseIds.length > 0 && adminDb) {
      try {
        const kbDocs = await Promise.all(
          knowledgeBaseIds.map(async (kbId: string) => {
            const kbDoc = await adminDb.collection('knowledgeBases').doc(kbId).get()
            if (kbDoc.exists) {
              const kbData = kbDoc.data()
              const isSkillKB = kbData?.type === 'skill' || 
                               kbData?.fileName?.toLowerCase().includes('skill') || 
                               kbData?.fileName?.toLowerCase().includes('スキル')
              
              if (!isSkillKB) return null
              
              let chunksText = ''
              try {
                const chunksSnapshot = await adminDb
                  .collection('knowledgeBases')
                  .doc(kbId)
                  .collection('chunks')
                  .limit(100) // 記事制作に必要な情報を多めに取得
                  .get()
                
                if (!chunksSnapshot.empty) {
                  chunksText = chunksSnapshot.docs
                    .map(doc => doc.data().text || '')
                    .filter(text => text.length > 0)
                    .join('\n\n')
                }
              } catch (chunksError) {
                console.warn('⚠️ Error loading chunks:', chunksError)
              }
              
              return {
                summary: kbData?.summary || '',
                usageGuide: kbData?.usageGuide || '',
                fileName: kbData?.fileName || '',
                chunks: chunksText,
              }
            }
            return null
          })
        )
        
        const skillKBs = kbDocs.filter(kb => kb !== null)
        
        if (skillKBs.length > 0) {
          skillKnowledgeContext = skillKBs.map(kb => {
            let context = `【${kb?.fileName}】\n概要: ${kb?.summary}\n活用方法: ${kb?.usageGuide}`
            if (kb?.chunks && kb.chunks.length > 0) {
              context += `\n\n【記事制作のベストプラクティス】\n${kb.chunks.substring(0, 15000)}`
            }
            return context
          }).join('\n\n')
        }
      } catch (kbError) {
        console.warn('⚠️ Error loading knowledge bases:', kbError)
      }
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4000,
      },
    })

    // 会話履歴をQA形式に変換
    const qaPairs: Array<{ question: string, answer: string }> = []
    let currentQuestion = ''
    
    conversationHistory.forEach((msg: any) => {
      if (msg.role === 'interviewer') {
        currentQuestion = msg.content
      } else if (msg.role === 'interviewee' && currentQuestion) {
        qaPairs.push({
          question: currentQuestion,
          answer: msg.content
        })
        currentQuestion = ''
      }
    })

    // QAペアをテキスト形式に変換
    const qaText = qaPairs
      .map((qa, idx) => `Q${idx + 1}: ${qa.question}\nA${idx + 1}: ${qa.answer}`)
      .join('\n\n')

    const prompt = `あなたは経験豊富なビジネス記事ライターです。以下の取材データを基に、ターゲット読者と掲載メディアに最適化された記事を執筆してください。

【重要な前提】
- この記事は「${mediaType}」に掲載されます
- ターゲット読者は「${targetAudience}」です
- 取材の目的は「${interviewPurpose}」です
- 取材先: ${intervieweeName}（${intervieweeCompany}）

【取材データ（Q&A形式）】
${qaText}

【具体的な質問内容（参考）】
${objective || '未指定'}

${skillKnowledgeContext ? `【記事制作のベストプラクティス（スキルナレッジベース）】\n${skillKnowledgeContext}\n\n**重要**: このスキルナレッジベースには、効果的な記事制作の手法、ターゲット読者に響く書き方、メディア特性に合わせた記事構成などが含まれています。**必ずこの内容を参考にして、ターゲット読者と掲載メディアに最適化された記事を執筆してください。**\n` : ''}

【記事制作の指示】
1. **ターゲット読者を意識**: 「${targetAudience}」が興味を持ち、価値を感じる内容にする
2. **メディア特性に合わせる**: 「${mediaType}」の特性（トーン、深さ、形式など）に合わせて執筆する
3. **取材目的を達成**: 「${interviewPurpose}」を達成する記事にする
4. **スキルナレッジベースを活用**: 記事制作のベストプラクティスを実践する
5. **読みやすさを重視**: 見出し、段落、箇条書きなどを効果的に使用する

【出力形式】
以下のJSON形式で出力してください（説明文や前置きは一切含めないでください）:

{
  "title": "記事のタイトル（30-50文字程度、ターゲット読者に響くタイトル）",
  "lead": "リード文（100-200文字程度、記事の要点を簡潔に）",
  "sections": [
    {
      "heading": "見出し1（20-30文字程度）",
      "body": "本文（300-500文字程度、具体的な内容を含める）"
    },
    {
      "heading": "見出し2",
      "body": "本文"
    }
  ]
}

【注意事項】
- JSON形式のみを出力し、説明文や前置きは一切含めないでください
- 見出しは3-5個程度、各セクションの本文は300-500文字程度にしてください
- ターゲット読者が読みやすく、価値を感じられる記事にしてください
- 取材データを基に、具体的で説得力のある内容にしてください`

    const result = await model.generateContent(prompt)
    const response = await result.response
    let articleText = response.text().trim()

    // JSONを抽出
    let articleJson: any = null
    try {
      // JSON部分を抽出（```json や ``` で囲まれている場合がある）
      const jsonMatch = articleText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || 
                       articleText.match(/(\{[\s\S]*\})/)
      
      if (jsonMatch) {
        articleJson = JSON.parse(jsonMatch[1])
      } else {
        // JSONが見つからない場合は、全体をJSONとして解析を試みる
        articleJson = JSON.parse(articleText)
      }
    } catch (parseError) {
      console.error('❌ JSON解析エラー:', parseError)
      console.error('📝 生成されたテキスト:', articleText.substring(0, 500))
      return NextResponse.json(
        { error: '記事の生成に失敗しました。JSON形式の解析に失敗しました。' },
        { status: 500 }
      )
    }

    // 記事データを検証
    if (!articleJson.title || !articleJson.lead || !articleJson.sections || !Array.isArray(articleJson.sections)) {
      return NextResponse.json(
        { error: '記事の生成に失敗しました。必要なフィールドが不足しています。' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      article: {
        title: articleJson.title,
        lead: articleJson.lead,
        sections: articleJson.sections.map((section: any) => ({
          heading: section.heading || '',
          body: section.body || ''
        }))
      }
    })
  } catch (error) {
    console.error('❌ Error generating article:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { 
        error: '記事の生成に失敗しました', 
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}


