import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as admin from 'firebase-admin'
import { initializeFirebaseAdmin } from '@/src/lib/firebase-admin'

// Initialize Firebase Admin SDK
export async function POST(request: NextRequest) {
  try {
    await initializeFirebaseAdmin()
    const adminDb = admin.firestore()
    const { question, userResponse, interviewObjective, interviewerPrompt, knowledgeBaseIds, conversationHistory, needsMoreInfo, suggestedAngle, introductionMessage } = await request.json()

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

    // ナレッジベースから質問設計のベストプラクティスを取得
    // 重要: スキルナレッジベースはサーバー側で自動取得（クライアント側から送信されなくても取得）
    let skillKnowledgeContext = ''
    let userKnowledgeContext = ''

    // 1. スキルナレッジベースを自動取得（サーバー側のみ、クライアント側からは送信されない）
    if (adminDb) {
      try {
        // スキルナレッジベースをクエリで取得（useForDialogue === true または未設定のもの）
        const skillKBQuery = adminDb
          .collection('knowledgeBases')
          .where('type', '==', 'skill')
          .limit(10) // 最大10個まで取得

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

            // スキルナレッジベースのchunksを取得
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
              isSkillKB: true,
            }
          })
        )

        const validSkillKBs = skillKBDocs.filter(kb => kb !== null)

        if (validSkillKBs.length > 0) {
          skillKnowledgeContext = validSkillKBs.map(kb => {
            let context = `【${kb?.fileName}】\n概要: ${kb?.summary}\n活用方法: ${kb?.usageGuide}`
            if (kb?.chunks && kb.chunks.length > 0) {
              context += `\n\n【質問設計・対話設計のベストプラクティス】\n${kb.chunks.substring(0, 5000)}`
            }
            return context
          }).join('\n\n')
        }
      } catch (skillKBError) {
        // 機密保護のため、エラーの詳細は出力しない
        console.warn('⚠️ Error loading skill knowledge bases: [details masked]')
      }
    }

    // 2. ユーザーナレッジベースを取得（クライアント側から送信されたIDのみ）
    if (knowledgeBaseIds && knowledgeBaseIds.length > 0 && adminDb) {
      try {
        const kbDocs = await Promise.all(
          knowledgeBaseIds.map(async (kbId: string) => {
            const kbDoc = await adminDb.collection('knowledgeBases').doc(kbId).get()
            if (kbDoc.exists) {
              const kbData = kbDoc.data()

              // userタイプのみ処理（skill/infoはサーバー側で自動取得済み）
              if (kbData?.type !== 'user') {
                return null
              }

              // 対話術で使用しない場合はスキップ
              if (kbData?.useForDialogue === false) {
                return null
              }

              // ユーザーナレッジベースのchunksを取得
              let chunksText = ''
              try {
                const chunksSnapshot = await adminDb
                  .collection('knowledgeBases')
                  .doc(kbId)
                  .collection('chunks')
                  .limit(15)
                  .get()

                if (!chunksSnapshot.empty) {
                  chunksText = chunksSnapshot.docs
                    .map(doc => doc.data().text || '')
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
                isSkillKB: false,
              }
            }
            return null
          })
        )

        // userタイプのみ処理（skill/infoはサーバー側で自動取得済み）
        const userKBs = kbDocs.filter(kb => kb !== null)

        // ユーザーナレッジベースのコンテキスト（会社固有の情報）
        if (userKBs.length > 0) {
          const userKBContext = userKBs.map(kb => {
            let context = `【${kb?.fileName}】\n概要: ${kb?.summary}\n活用方法: ${kb?.usageGuide}`
            if (kb?.chunks && kb.chunks.length > 0) {
              context += `\n\n【参考コンテンツ】\n${kb.chunks.substring(0, 2000)}`
            }
            return context
          }).join('\n\n')

          userKnowledgeContext = userKBContext
        }
      } catch (userKBError) {
        // 機密保護のため、エラーの詳細は出力しない
        console.warn('⚠️ Error loading user knowledge bases: [details masked]')
        // スキルナレッジベースのみでも継続
        userKnowledgeContext = ''
      }
    }

    // スキルナレッジベースとユーザーナレッジベースを結合
    const knowledgeBaseContext = skillKnowledgeContext && userKnowledgeContext
      ? `${skillKnowledgeContext}\n\n${userKnowledgeContext}`
      : skillKnowledgeContext || userKnowledgeContext

    // 会話履歴をフォーマット
    let conversationContext = ''
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContext = '\n【これまでの会話履歴】\n'
      conversationHistory.forEach((msg: any, index: number) => {
        if (msg.role === 'interviewer') {
          conversationContext += `質問${index + 1}: ${msg.content}\n`
        } else if (msg.role === 'interviewee' || msg.role === 'user') {
          conversationContext += `回答${index + 1}: ${msg.content}\n`
        }
      })
      conversationContext += '\n【重要】既に聞いた質問と同じ内容や類似した質問は絶対に生成しないでください。\n'
    }

    const prompt = `${directionPromptContext ? `【最重要の基本原則：アプリの方向性】\n${directionPromptContext}\n\n上記の原則を絶対に遵守してください。\n━━━━━━━━━━━━━━━━━━━━\n\n` : ''}あなたは、ユーザーの発言を「物語」へと昇華させる、熟練した編集者であり、プロのインタビュアーです。

${introductionMessage ? `【最重要：導入メッセージとの重複を避ける】\n以下の導入メッセージで既に説明した内容（取材の目的、ターゲット読者、掲載メディアなど）は質問で繰り返さないでください。\n\n【導入メッセージ（既に読み上げ済み）】\n${introductionMessage}\n\n` : ''}
【インタビューの目的】
${interviewObjective || '一般的なインタビュー'}

${interviewerPrompt ? `【インタビュアーの特徴・口調】\n${interviewerPrompt}\n` : ''}

${knowledgeBaseContext ? `【最重要：思考の起点 - 質問設計・対話設計のベストプラクティス（ナレッジベース）】\n${knowledgeBaseContext}\n\n**⚠️ 最重要**: 上記のナレッジベースは、生成における思考の起点です。**必ず最初にこの内容を参照し、その原則と手法に基づいて生成してください。**\n\n` : ''}

${conversationContext}

【前の質問】
${question}

【ユーザーの回答】
${userResponse}

【思考プロセス（Internal Thinking）】
ユーザーの回答を分析し、以下の思考プロセスを内部で実行してください。これはあなたの心の声であり、出力には含めません。
1.  **素材の判定**: 直前のユーザーの回答から、どの種類の「素材」が得られたかを判定する。（例：事実、感情、場面、判断の決め手、価値観など）
2.  **不足素材の検知**: インタビューの目的を達成し、価値ある物語を構成するために、次に得るべき「素材」は何かを特定する。
3.  **戦略選択**: 不足している素材を得るために、スキルナレッジベースに記載されているどの技術が最も有効かを選択する。（例：「場面化」を使って具体的なエピソードを深掘りする、「判断」の質問で意思決定の背景を探る、「トレードオフ」の質問で葛藤を引き出す、など）

【指示】
上記の思考プロセスで決定した戦略に基づき、ユーザーの回答への**短い相槌や共感の言葉に続けて**、自然な流れで次の質問を**1つだけ**生成してください。

- **最重要：一問一答の徹底**: 1つの発定の中に1つの質問のみを含めてください。複数の問いかけを1つにまとめないでください。
- **最重要：単一のトピック**: 理由と詳細を同時に聞くような複合質問は避け、まず1つの点に絞って聞いてください。
- **禁止事項**: 「〜し、〜ですか？」「〜ですが、〜はどうですか？」といった複合的な言い回しは避け、簡潔な1文で質問してください。
- **思考プロセスを実践する**: あなたが立てた戦略（どの技術を、何のために使うか）に沿った質問を作成してください。
- **自然な会話を維持する**: 全体として、人間が話すような自然な会話の流れを最優先してください。
- **繰り返しを避ける**: 会話履歴をよく確認し、既に聞いた質問や類似した質問は絶対に生成しないでください。
${needsMoreInfo ? `- **追加指示**: 現在、回答が表面的で記事化できるほどの情報が得られていません。特に「${suggestedAngle || '具体的な事例やエピソード'}」を引き出すことを意識してください。` : ''}

【出力形式】
「短い前置き（相槌や共感） + 質問文」の形式で、全体で1つの自然な文章として出力してください。
**重要：出力は必ず1つの「？」で終わる単一の質問にしてください。**

【出力例】
なるほど、〇〇というご経験があったのですね。その時の具体的な場面について、もう少し詳しく教えていただけますか？

または

そうだったんですね。その決断に至った背景には、どのような迷いや葛藤があったのでしょうか？`

    const result = await model.generateContent(prompt)
    const response = await result.response
    let followUpQuestion = response.text().trim()

    // 説明文や前置きを除去
    const lines = followUpQuestion.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('【') && !trimmed.includes('出力例')) {
        followUpQuestion = trimmed
        break
      }
    }

    return NextResponse.json({
      question: followUpQuestion,
      success: true,
    })
  } catch (error) {
    console.error('❌ Error generating follow-up question:', error)
    return NextResponse.json(
      {
        error: '追加質問の生成に失敗しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
