import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as admin from 'firebase-admin'
import { initializeFirebaseAdmin } from '@/src/lib/firebase-admin'

// Initialize Firebase Admin SDK
export async function POST(request: NextRequest) {
  try {
    await initializeFirebaseAdmin()
    const adminDb = admin.firestore()
    const {
      conversationHistory,
      objective,
      interviewPurpose,
      supplementaryInfo,
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
    // 重要: スキルナレッジベースはサーバー側で自動取得（クライアント側から送信されなくても取得）
    let skillKnowledgeContext = ''

    // 1. スキルナレッジベースを自動取得（サーバー側のみ）
    if (adminDb) {
      try {
        // スキルナレッジベースをクエリで取得
        const skillKBQuery = adminDb
          .collection('knowledgeBases')
          .where('type', '==', 'skill')
          .limit(5) // 評価には最大5個まで取得

        const skillKBSnapshot = await skillKBQuery.get()

        const skillKBDocs = await Promise.all(
          skillKBSnapshot.docs.map(async (doc) => {
            const kbData = doc.data()

            // 削除済みはスキップ
            if (kbData?.deleted === true) {
              return null
            }

            // 対話術で使用しない場合はスキップ
            if (kbData?.useForDialogue === false) {
              return null
            }

            // 編集時のみ使用のスキルは除外
            if (kbData?.isEditOnly) {
              return null
            }

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
              // 機密保護のため、エラーの詳細は出力しない
              console.warn('⚠️ Error loading chunks: [details masked]')
            }

            return {
              summary: kbData?.summary || '',
              usageGuide: kbData?.usageGuide || '',
              fileName: kbData?.fileName || '',
              chunks: chunksText,
            }
          })
        )

        const validKBs = skillKBDocs.filter(kb => kb !== null)

        if (validKBs.length > 0) {
          skillKnowledgeContext = validKBs.map(kb => {
            let context = `【${kb?.fileName}】\n概要: ${kb?.summary}\n活用方法: ${kb?.usageGuide}`
            if (kb?.chunks && kb.chunks.length > 0) {
              context += `\n\n【評価基準】\n${kb.chunks.substring(0, 4000)}`
            }
            return context
          }).join('\n\n')
        }
      } catch (skillKBError) {
        // 機密保護のため、エラーの詳細は出力しない
        console.warn('⚠️ Error loading skill knowledge bases: [details masked]')
      }
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.1, // 評価精度向上のため、より低めに設定
        maxOutputTokens: 2000,
      },
    })

    // Fetch the master direction prompt
    let directionPromptContext = ''
    try {
      const settingsRef = adminDb.collection('systemSettings').doc('appDirection')
      const settingsDoc = await settingsRef.get()
      if (settingsDoc.exists) {
        directionPromptContext = settingsDoc.data()?.directionPrompt || ''
      }
    } catch (error) {
      console.warn('⚠️ Error loading app direction prompt:', error)
      // Continue without the master prompt if it fails
    }

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

    const prompt = `${directionPromptContext ? `【最重要の基本原則：アプリの方向性】\n${directionPromptContext}\n\n上記の原則を絶対に遵守してください。\n━━━━━━━━━━━━━━━━━━━━\n\n` : ''}${skillKnowledgeContext ? `【最重要：思考の起点 - 評価基準（スキルナレッジベース）】\n${skillKnowledgeContext}\n\n**⚠️ 最重要**: 上記のナレッジベースは、評価における思考の起点です。**必ず最初にこの内容を参照し、その原則と手法に基づいて評価してください。**\n\n` : ''}あなたは経験豊富なプロのインタビュアーです。以下の会話履歴を分析し、聞きたいことがどの程度聞けているか、答えが得られているかを評価してください。

【聞きたいこと（objective）】
${objectiveItems.map((item: string, idx: number) => `${idx + 1}. ${item}`).join('\n')}

${interviewPurpose ? `【取材の目的】\n${interviewPurpose}\n` : ''}
【補足情報（日時、場所など、あらかじめ提供された情報）】
${supplementaryInfo || '特になし'}

【これまでの会話履歴】
${conversationText}

【重要：書式に関する注意】
- 生成する理由や要約テキストの中で、**アスタリスク（**）やMarkdown記号は一切使用しないでください**。プレーンテキストのみで出力してください。

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
      "reason": "評価理由（アスタリスクを使わず、50文字程度で）"
    },
    ...
  ],
  "overallCompletionRate": 0-100,
  "summary": "全体の達成状況の要約（アスタリスクを使わず、100文字程度で）"
}

【評価基準】
- "complete": インタビュー内で一度でも明確に事実が述べられている、あるいは**補足情報に記載されている**、あるいは**ユーザーが「後で書く」「スキップ」「飛ばして」と明言した**場合に適用。**些細な言いよどみや、深掘りの不足があっても、事実（いつ、どこで、だれが、何を、等）が判明していれば「complete」としてください。**（completionRate: 100）
- "partial": 答えは得られているが、事実関係が曖昧（例：「来月ごろ」など具体的な日時が特定できない）な場合にのみ適用。（completionRate: 30-79）
- "missing": まったく言及がなく、補足情報にもなく、ユーザーが飛ばすとも言っていない項目。（completionRate: 0）

【重要】
- **ノイズの無視**: 「えー」「あのー」などのフィラーや、本筋に関係のない雑談、言い間違いの訂正などは、情報の取得（complete判断）を妨げるものではありません。核となる情報が含まれているかのみに注目してください。
- **重複の判断**: インタビュアーが何度も同じ項目を聞き直しているが、ユーザーが既に答えている場合、システムが情報の取得に成功している（complete）とみなしてください。
- **補足情報の活用**: 【補足情報】にあらかじめ詳細が記載されている項目は、会話履歴に現れていなくても「complete」として判定してください。
- **スキップの尊重**: ユーザーが「後で入力する」「後で書く」「飛ばして」と答えた項目は、即座に「complete」として判定してください。
- 表面的な言及（例：「開催は1月5日です」）があれば、それだけで事実は取得できています。過度に深掘りせず「complete」としてください。
- 全体の達成率は、各項目の完了率の平均値として計算してください。`

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

