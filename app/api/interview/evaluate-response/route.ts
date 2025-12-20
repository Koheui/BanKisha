import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as admin from 'firebase-admin'
import { initializeFirebaseAdmin } from '@/src/lib/firebase-admin'

// Initialize Firebase Admin SDK
initializeFirebaseAdmin()

const adminDb = admin.firestore()

export async function POST(request: NextRequest) {
  try {
    const { question, userResponse, interviewObjective, conversationHistory, skillKnowledgeContext, requiredElements } = await request.json()

    if (!question || !userResponse) {
      return NextResponse.json(
        { error: '質問と回答が必要です' },
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // スキルナレッジベースから記事生成の要件を取得（未取得の場合）
    let articleGenerationRequirements = skillKnowledgeContext || ''
    if (!articleGenerationRequirements && adminDb) {
      try {
        // スキルナレッジベースを検索
        const skillKBsQuery = adminDb
          .collection('knowledgeBases')
          .where('type', '==', 'skill')
          .limit(5)
        
        const skillKBsSnapshot = await skillKBsQuery.get()
        
        if (!skillKBsSnapshot.empty) {
          const skillKBDocs = await Promise.all(
            skillKBsSnapshot.docs.map(async (doc) => {
              const kbData = doc.data()
              let chunksText = ''
              try {
                const chunksSnapshot = await adminDb
                  .collection('knowledgeBases')
                  .doc(doc.id)
                  .collection('chunks')
                  .limit(30)
                  .get()
                
                if (!chunksSnapshot.empty) {
                  chunksText = chunksSnapshot.docs
                    .map(chunkDoc => chunkDoc.data().text || '')
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
            })
          )
          
          if (skillKBDocs.length > 0) {
            articleGenerationRequirements = skillKBDocs.map(kb => {
              let context = `【${kb?.fileName}】\n概要: ${kb?.summary}\n活用方法: ${kb?.usageGuide}`
              if (kb?.chunks && kb.chunks.length > 0) {
                context += `\n\n【記事生成に必要な情報の要件】\n${kb.chunks.substring(0, 8000)}`
              }
              return context
            }).join('\n\n')
          }
        }
      } catch (kbError) {
        console.warn('⚠️ Error loading skill knowledge bases:', kbError)
      }
    }

    // 会話履歴をフォーマット（全体の会話を評価するため）
    let conversationContext = ''
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContext = '\n【これまでの会話履歴（全体）】\n'
      conversationHistory.forEach((msg: any, index: number) => {
        if (msg.role === 'interviewer') {
          conversationContext += `質問${Math.floor(index / 2) + 1}: ${msg.content}\n`
        } else if (msg.role === 'interviewee' || msg.role === 'user') {
          conversationContext += `回答${Math.floor(index / 2) + 1}: ${msg.content}\n`
        }
      })
    }

    // 必要な要素が指定されている場合は追加
    let requiredElementsText = ''
    if (requiredElements && Array.isArray(requiredElements) && requiredElements.length > 0) {
      requiredElementsText = `\n【この質問で特に必要な要素】\n${requiredElements.join('、')}\n`
    }

    const prompt = `あなたは経験豊富なプロのインタビュアーであり、ビジネス記事のライターです。**記事生成の観点から**、これまでの会話全体を評価し、ビジネス用の読み物記事として書き出すために十分な情報が揃っているかを判断してください。

【重要：評価の観点】
- **個別の質問の回答を評価するのではなく、これまでの会話全体で得られた情報を評価してください**
- **アウトプット（記事生成）側に立って判断してください**
- ビジネス用の読み物記事として、読者にとって価値のある記事を書けるだけの情報が揃っているかを判断してください

${articleGenerationRequirements ? `【記事生成に必要な情報の要件（スキルナレッジベース）】\n${articleGenerationRequirements}\n\nこのスキルナレッジベースには、ビジネス記事を書くために必要な情報の要件、記事化のベストプラクティスなどが含まれています。**必ずこの内容を参考にして評価してください。**\n` : ''}

【インタビューの目的】
${interviewObjective || '一般的なインタビュー'}

${conversationContext}
【現在の質問】
${question}

【ユーザーの回答】
${userResponse}
${requiredElementsText}

【評価基準（記事生成の観点から）】
以下の観点から、**これまでの会話全体**を評価してください：
1. **記事化可能性**: これまでの会話から、読者にとって価値のあるビジネス記事を書けるか
2. **情報の網羅性**: 記事に必要な主要な要素（背景、課題、解決策、成果、学びなど）が揃っているか
3. **具体性と深さ**: 抽象的な表現ではなく、具体的な事例、数字、エピソード、洞察が含まれているか
4. **独自性**: 一般的な情報ではなく、独自の視点、経験、知見が含まれているか
5. **ストーリー性**: 記事として読者を引き込むストーリーが構築できるか

【出力形式】
以下のJSON形式で出力してください（説明文や前置きは一切含めないでください）：
{
  "isSufficient": true/false,
  "score": 0-100,
  "reason": "評価理由（記事生成の観点から、1-2文）",
  "missingElements": ["不足している要素1", "不足している要素2"],
  "suggestedAngle": "別の角度からの質問の提案（isSufficientがfalseの場合）"
}

【重要】
- **isSufficientは、これまでの会話全体で記事が書けるだけの情報が揃っているかを判断してください**
- 個別の質問の回答が不十分でも、会話全体で必要な情報が揃っていればtrueにしてください
- 逆に、個別の回答が良くても、記事生成に必要な情報が不足していればfalseにしてください
- 評価は厳しめに行い、記事化に十分な情報が得られている場合のみtrueにしてください
- スキルナレッジベースの要件を必ず参考にしてください`

    const result = await model.generateContent(prompt)
    const response = await result.response
    let evaluationText = response.text().trim()

    // JSONを抽出
    let evaluation
    try {
      // JSONブロックを抽出
      const jsonMatch = evaluationText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        evaluation = JSON.parse(jsonMatch[0])
      } else {
        // JSONが見つからない場合は、テキストから推測
        evaluation = {
          isSufficient: evaluationText.toLowerCase().includes('true') || evaluationText.toLowerCase().includes('十分'),
          score: 50,
          reason: evaluationText,
          missingElements: [],
          suggestedAngle: ''
        }
      }
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      // パースエラーの場合、デフォルト値を使用
      evaluation = {
        isSufficient: false,
        score: 50,
        reason: '評価の解析に失敗しました',
        missingElements: [],
        suggestedAngle: 'もう少し詳しく聞かせていただけますか？'
      }
    }

    return NextResponse.json({
      evaluation,
      success: true,
    })
  } catch (error) {
    console.error('❌ Error evaluating response:', error)
    return NextResponse.json(
      { 
        error: '回答の評価に失敗しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

