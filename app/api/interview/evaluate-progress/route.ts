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
      conversationHistory, 
      objective, 
      interviewPurpose,
      knowledgeBaseIds 
    } = await request.json()

    if (!conversationHistory || !Array.isArray(conversationHistory)) {
      return NextResponse.json(
        { error: '会話履歴が必要です' },
        { status: 400 }
      )
    }

    if (!objective) {
      return NextResponse.json(
        { error: '聞きたいこと（objective）が必要です' },
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

    // スキルナレッジベースから評価基準を取得
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
              
              // 編集時のみ使用のスキルは除外
              if (!isSkillKB || kbData?.isEditOnly) return null
              
              let chunksText = ''
              try {
                const chunksSnapshot = await adminDb
                  .collection('knowledgeBases')
                  .doc(kbId)
                  .collection('chunks')
                  .limit(30)
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
              context += `\n\n【評価基準】\n${kb.chunks.substring(0, 4000)}`
            }
            return context
          }).join('\n\n')
        }
      } catch (kbError) {
        console.warn('⚠️ Error loading knowledge bases:', kbError)
      }
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3, // 評価なので低めの温度
        maxOutputTokens: 2000,
      },
    })

    // 会話履歴をテキスト形式に変換
    const conversationText = conversationHistory
      .map((msg: any) => {
        const role = msg.role === 'interviewer' ? 'インタビュアー' : '回答者'
        return `${role}: ${msg.content}`
      })
      .join('\n\n')

    // 聞きたいことを箇条書きに分解
    const objectiveItems = objective
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0)
      .map((line: string) => line.replace(/^[-*•]\s*/, '').trim())
      .filter((line: string) => line.length > 0)

    const prompt = `${skillKnowledgeContext ? `【評価基準（スキルナレッジベース）】\n${skillKnowledgeContext}\n\n` : ''}あなたは経験豊富なプロのインタビュアーです。以下の会話履歴を分析し、聞きたいことがどの程度聞けているか、答えが得られているかを評価してください。

【聞きたいこと（objective）】
${objectiveItems.map((item: string, idx: number) => `${idx + 1}. ${item}`).join('\n')}

${interviewPurpose ? `【取材の目的】\n${interviewPurpose}\n` : ''}

【これまでの会話履歴】
${conversationText}

【評価タスク】
上記の「聞きたいこと」の各項目について、会話履歴から十分な答えが得られているかを評価してください。

【出力形式】
以下のJSON形式で出力してください。説明文や前置きは一切含めないでください。JSONオブジェクトのみを出力してください。

{
  "items": [
    {
      "objective": "聞きたいことの項目1",
      "status": "complete" | "partial" | "missing",
      "completionRate": 0-100,
      "reason": "評価理由（50文字程度）"
    },
    ...
  ],
  "overallCompletionRate": 0-100,
  "summary": "全体の達成状況の要約（100文字程度）"
}

【評価基準】
- "complete": 十分な答えが得られている（completionRate: 80-100）
- "partial": 部分的に答えが得られているが、もう少し深掘りが必要（completionRate: 30-79）
- "missing": まだ答えが得られていない、または不十分（completionRate: 0-29）

【重要】
- 会話履歴を詳しく分析し、各項目について具体的に評価してください
- 表面的な言及だけでなく、深掘りされた内容が含まれているかを判断してください
- 全体の達成率は、各項目の完了率の平均値として計算してください`

    const result = await model.generateContent(prompt)
    const response = await result.response
    let evaluationText = response.text().trim()

    // JSONを抽出
    let evaluation: any = null
    try {
      // ```json や ``` で囲まれている場合を処理
      const jsonBlockMatch = evaluationText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
      if (jsonBlockMatch) {
        evaluation = JSON.parse(jsonBlockMatch[1])
      } else {
        // JSONオブジェクトを探す
        const jsonObjectMatch = evaluationText.match(/\{[\s\S]*\}/)
        if (jsonObjectMatch) {
          evaluation = JSON.parse(jsonObjectMatch[0])
        } else {
          evaluation = JSON.parse(evaluationText)
        }
      }
    } catch (parseError) {
      console.error('❌ JSON解析エラー:', parseError)
      console.error('📝 生成されたテキスト:', evaluationText.substring(0, 500))
      
      // フォールバック: 簡易的な評価を返す
      const answeredItems = objectiveItems.length > 0 
        ? Math.min(Math.floor(conversationHistory.filter((m: any) => m.role === 'interviewee').length / 2), objectiveItems.length)
        : 0
      
      return NextResponse.json({
        items: objectiveItems.map((item: string) => ({
          objective: item,
          status: 'partial' as const,
          completionRate: 50,
          reason: '評価中...'
        })),
        overallCompletionRate: Math.min((answeredItems / objectiveItems.length) * 100, 100),
        summary: '評価を生成中です...'
      })
    }

    // バリデーション
    if (!evaluation.items || !Array.isArray(evaluation.items)) {
      throw new Error('評価結果の形式が不正です')
    }

    return NextResponse.json({
      success: true,
      evaluation
    })
  } catch (error) {
    console.error('❌ Error evaluating progress:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: '進捗評価に失敗しました', details: errorMessage },
      { status: 500 }
    )
  }
}

