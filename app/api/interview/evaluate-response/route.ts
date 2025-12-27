import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { auth } from '@clerk/nextjs/server'
import * as admin from 'firebase-admin'
import { initializeFirebaseAdmin } from '@/src/lib/firebase-admin'

// Initialize Firebase Admin SDK
export async function POST(request: NextRequest) {
  try {
    await initializeFirebaseAdmin()
    const adminDb = admin.firestore()

    // 認証チェック
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    const { question, userResponse, interviewObjective, supplementaryInfo, conversationHistory, skillKnowledgeContext, requiredElements, knowledgeBaseIds } = await request.json()

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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

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

    // ナレッジベースから記事生成の要件を取得
    // 重要: スキルナレッジベースはサーバー側で自動取得（クライアント側から送信されなくても取得）
    let articleGenerationRequirements = ''

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
          articleGenerationRequirements = validKBs.map(kb => {
            let context = `【${kb?.fileName}】\n概要: ${kb?.summary}\n活用方法: ${kb?.usageGuide}`
            if (kb?.chunks && kb.chunks.length > 0) {
              context += `\n\n【記事生成に必要な情報の要件】\n${kb.chunks.substring(0, 8000)}`
            }
            return context
          }).join('\n\n')
        }
      } catch (skillKBError) {
        // 機密保護のため、エラーの詳細は出力しない
        console.warn('⚠️ Error loading skill knowledge bases: [details masked]')
      }
    }

    // 2. 既存のskillKnowledgeContextパラメータがある場合は上書き（後方互換性のため）
    if (skillKnowledgeContext && skillKnowledgeContext.length > 0) {
      articleGenerationRequirements = skillKnowledgeContext
    }

    // 3. knowledgeBaseIdsから追加で取得（既に実装済みの処理を維持）
    if (!articleGenerationRequirements && knowledgeBaseIds && knowledgeBaseIds.length > 0 && adminDb) {
      try {
        const kbDocs = await Promise.all(
          knowledgeBaseIds.map(async (kbId: string) => {
            const kbDoc = await adminDb.collection('knowledgeBases').doc(kbId).get()
            if (kbDoc.exists) {
              const kbData = kbDoc.data()
              const isSkillKB = kbData?.type === 'skill' ||
                kbData?.fileName?.toLowerCase().includes('skill') ||
                kbData?.fileName?.toLowerCase().includes('スキル')

              // 対話術で使用しない場合はスキップ
              if (kbData?.useForDialogue === false) {
                return null
              }

              // 評価にはスキルナレッジベースのみ使用
              if (!isSkillKB) return null

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
            }
            return null
          })
        )

        const validKBs = kbDocs.filter(kb => kb !== null)
        if (validKBs.length > 0) {
          articleGenerationRequirements = validKBs.map(kb => {
            let context = `【${kb?.fileName}】\n概要: ${kb?.summary}\n活用方法: ${kb?.usageGuide}`
            if (kb?.chunks && kb.chunks.length > 0) {
              context += `\n\n【記事生成に必要な情報の要件】\n${kb.chunks.substring(0, 8000)}`
            }
            return context
          }).join('\n\n')
        }
      } catch (kbError) {
        // 機密保護のため、エラーの詳細は出力しない
        console.warn('⚠️ Error loading knowledge bases: [details masked]')
      }
    }

    // 会話履歴をフォーマット（全体の会話を評価するため）
    let conversationContext = ''
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContext = '\n【これまでの会話履歴（全体）】\n'
      conversationHistory.forEach((msg: any, index: number) => {
        const roleName = msg.role === 'interviewer' ? 'インタビュアー' : '回答者'
        conversationContext += `${roleName}: ${msg.content}\n\n`
      })
    }

    // 必要な要素が指定されている場合は追加
    let requiredElementsText = ''
    if (requiredElements && Array.isArray(requiredElements) && requiredElements.length > 0) {
      requiredElementsText = `\n【この質問で特に必要な要素】\n${requiredElements.join('、')}\n`
    }

    const prompt = `${directionPromptContext ? `【最重要の基本原則：アプリの方向性】\n${directionPromptContext}\n\n上記の原則を絶対に遵守してください。\n━━━━━━━━━━━━━━━━━━━━\n\n` : ''}あなたは経験豊富なプロのインタビュアーであり、ビジネス記事のライターです。**記事生成の観点から**、これまでの会話全体を評価し、ビジネス用の読み物記事として書き出すために十分な情報が揃っているかを判断してください。

【重要：評価の原則】
- **会話履歴こそが唯一の事実です**: ユーザーが既に答えた内容は、たとえあなたが「まだ十分に深く聞けていない」と感じても、一度事実が述べられていれば「取得済み」とみなしてください。
- **直前の自身の質問と回答を最優先で確認してください**: ユーザーが直近で具体的なデータ（日時、場所、名前など）を述べている場合、「履歴にない」と主張することは絶対に避けてください。
- **「スキップ」や「後で書く」は終了指示ではありません**: ユーザーが「次の質問へ」「飛ばして」「後で書く」「最後に入力する」と言った場合は、その項目を【取得済み（complete）】とみなし、次の話題に移ってください。インタビュー自体を終了（userStopIntent=true）させてはいけません。
- ユーザーが「前に答えた」「さっき言った」などの不満を述べている場合は、即座に謝罪し、未聴取の別の話題に切り替えてください。
- **アウトプット（記事生成）側に立って判断してください**: ビジネス用の読み物記事として、最低限の情報（5W1H）が揃っているかを判断してください。

【書式に関する注意】
- 生成する質問や文中で、**アスタリスク（**）やMarkdownなどの特殊記号は一切使用しないでください**。プレーンテキストのみで出力してください。

${articleGenerationRequirements ? `【最重要：思考の起点 - 記事生成に必要な情報の要件（スキルナレッジベース）】\n${articleGenerationRequirements}\n\n**⚠️ 最重要**: 上記のナレッジベースは、評価における思考の起点です。**必ず最初にこの内容を参照し、その原則と手法に基づいて評価してください。** このスキルナレッジベースには、ビジネス記事を書くために必要な情報の要件、記事化のベストプラクティスなどが含まれています。\n\n` : ''}

【インタビューの目的】
${interviewObjective || '一般的なインタビュー'}

【補足情報（日時、場所など、あらかじめ提供された情報）】
${supplementaryInfo || '特になし'}

${conversationContext}
【直前の質問】
${question}

【ユーザーの最新の回答】
${userResponse}
${requiredElementsText}

【評価基準（記事生成の観点から）】
以下の観点から、**これまでの会話全体**を評価してください：
1. **ユーザーの終了意図**: ユーザーが「以上です」「終了して」「終わり」「もうありません」など、インタビュー全体を終えたい意思を示しているか。※特定の質問を「飛ばす」「後で入力する」というのは終了意図ではありません。
2. **記事化可能性**: これまでの会話から、読者にとって価値のある記事を書けるか。目的が「イベント告知」などの場合は、事実関係（日時、場所等）が一度でも語られていれば、再確認せずとも十分と判断してください。
3. **情報の網羅性**: 必要な主要要素が揃っているか。特に「イベント」「セミナー」等の場合は、**【開催日時、開催場所、参加費用、申し込み方法、定員、主催者】** の事実関係を確認してください。
  - **【重要】** ユーザーが「後で入力する」「後で書く」「飛ばして」と答えた項目は、その時点で「complete」としてマークし、二度と聞かないでください。
  - **【重要】** 補足情報にあらかじめ記載されている場合は、すでに取得済みとみなしてください。
4. **具体性と深さ**: 具体的な事例、数字、エピソードが含まれているか。

【出力形式】
以下のJSON形式で出力してください（説明文や前置きは一切含めないでください）：
{
  "isSufficient": true/false,
  "userStopIntent": true/false,
  "score": 0-100,
  "reason": "評価理由（1-2文）",
  "missingElements": ["不足している要素1", "不足している要素2"],
  "checklistStatus": [
    {"element": "要素名", "status": "complete" | "partial" | "missing"}
  ],
  "suggestedAngle": "別の角度からの質問の提案",
  "followUpQuestion": "具体的な深掘り質問（isSufficientがfalseの場合に必須。アスタリスク等の記号を使わず、プレーンテキストで、インタビュアーとしてそのまま発言できる自然な形式で）"
}

【重要】
- **重複の禁止**: これまでに出た情報を再度聞くことは絶対に避けてください。
- **userStopIntent**: ユーザーが終了を希望している場合は必ずtrueにしてください。その場合、isSufficientもtrueにして終了を促してください。
- インタビューの目的が比較的ライトなもの（告知など）であれば、過度な深掘りは避け、主要な事実が揃った時点でisSufficientをtrueにしてください。
- ユーザーが不快感（同じことを聞くな、等）を示している場合は、即座に謝罪し、重要な情報の確認がまだであれば別の聞き方をし、そうでなければインタビューを締めくくってください。`

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

