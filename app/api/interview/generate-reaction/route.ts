import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as admin from 'firebase-admin'
import { initializeFirebaseAdmin } from '@/src/lib/firebase-admin'

// Initialize Firebase Admin SDK
export async function POST(request: NextRequest) {
  try {
    await initializeFirebaseAdmin()
    const adminDb = admin.firestore()
    const { userResponse, interviewerPrompt, reactionPatterns, knowledgeBaseIds } = await request.json()

    if (!userResponse) {
      return NextResponse.json(
        { error: '回答が必要です' },
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

    // ナレッジベースから対話の自然さ向上のためのベストプラクティスを取得（軽量版）
    // 重要: スキルナレッジベースはサーバー側で自動取得（クライアント側から送信されなくても取得）
    let knowledgeBaseContext = ''

    // 1. スキルナレッジベースを自動取得（サーバー側のみ、軽量のためサマリーとusageGuideのみ）
    if (adminDb) {
      try {
        // スキルナレッジベースをクエリで取得（useForDialogue === true または未設定のもの）
        const skillKBQuery = adminDb
          .collection('knowledgeBases')
          .where('type', '==', 'skill')
          .limit(5) // 相槌生成は軽量のため、最大5個まで取得

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

            // 相槌生成は軽量のため、サマリーとusageGuideのみ使用
            return {
              summary: kbData?.summary || '',
              usageGuide: kbData?.usageGuide || '',
              fileName: kbData?.fileName || '',
            }
          })
        )

        const validSkillKBs = skillKBDocs.filter(kb => kb !== null)
        if (validSkillKBs.length > 0) {
          knowledgeBaseContext = validSkillKBs.map(kb => {
            return `【${kb?.fileName}】\n概要: ${kb?.summary}\n活用方法: ${kb?.usageGuide}`
          }).join('\n\n')
        }
      } catch (skillKBError) {
        // 機密保護のため、エラーの詳細は出力しない
        console.warn('⚠️ Error loading skill knowledge bases: [details masked]')
      }
    }

    const prompt = `${directionPromptContext ? `【最重要の基本原則：アプリの方向性】\n${directionPromptContext}\n\n上記の原則を絶対に遵守してください。\n━━━━━━━━━━━━━━━━━━━━\n\n` : ''}あなたは経験豊富なプロのインタビュアーです。ユーザーの回答に対し、会話を円滑にするための**自然で短い**相槌や反応を生成してください。

${interviewerPrompt ? `【インタビュアーの特徴・口調】\n${interviewerPrompt}\n` : ''}
${reactionPatterns ? `【基礎的な相槌・反応パターン（参考）】\n${reactionPatterns}\n` : ''}
${knowledgeBaseContext ? `【最重要：思考の起点 - 対話の自然さ向上のためのベストプラクティス（ナレッジベース）】\n${knowledgeBaseContext}\n\n**⚠️ 最重要**: 上記のナレッジベースは、生成における思考の起点です。**必ず最初にこの内容を参照し、その原則と手法に基づいて生成してください。**\n\n` : ''}

【ユーザーの回答】
${userResponse}

【最重要ルール：脱・機械的反応】
1. **「bot感」の払拭**: 「へぇ、そうなんですね」「なるほど」といった、どの回答にも当てはまるような汎用的な反応のみを繰り返さないでください。
2. **文脈への即応**: ユーザーが「苦労」を語れば共感を、「成功」を語れば称賛を、「事実」を語れば深い納得を示してください。
3. **バリエーション**: 反応の語彙を広げてください（例：「それは驚きですね！」「素晴らしい決断です」「大変な道のりだったのですね」「非常に興味深い視点です」など）。
4. **極めて短く**: ボイスチャットのテンポを最優先し、1文（長くても20文字程度）で反応を完結させてください。
5. **Markdown・記号禁止**: アスタリスク（**）などは含めず、純粋なテキストのみを出力してください。

出力例（文脈に応じた使い分け）：
- 驚き：それは予想外の展開ですね！
- 賞賛：素晴らしい行動力です。
- 共感：その時のお気持ち、よく分かります。
- 興味：非常にユニークな発想で面白いです。
- 承諾：なるほど、そのような背景があったのですね。
- 軽い肯定：うんうん、分かります。
`

    const result = await model.generateContent(prompt)
    const response = await result.response
    let reaction = response.text().trim()

    // 説明文や前置きを除去
    const lines = reaction.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('【') && !trimmed.includes('出力例')) {
        reaction = trimmed
        break
      }
    }

    return NextResponse.json({
      reaction: reaction,
      success: true,
    })
  } catch (error) {
    console.error('❌ Error generating reaction:', error)
    return NextResponse.json(
      {
        error: '反応の生成に失敗しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

