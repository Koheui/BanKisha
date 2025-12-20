import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(request: NextRequest) {
  try {
    const { userResponse, interviewerPrompt, reactionPatterns } = await request.json()

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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `あなたは経験豊富なプロのインタビュアーです。ユーザーの回答に対して、短い相槌や反応を生成してください。

${interviewerPrompt ? `【インタビュアーの特徴・口調】\n${interviewerPrompt}\n` : ''}
${reactionPatterns ? `【基礎的な相槌・反応パターン（参考）】\n${reactionPatterns}\n\n上記のパターンを参考にして、同様のスタイルで相槌や反応を生成してください。\n` : ''}

【ユーザーの回答】
${userResponse}

【指示】
1. ユーザーの回答に対して、自然な相槌や反応を生成してください
2. 短く、1〜2文程度にしてください（長すぎないように）
3. 共感を示したり、興味を持っていることを表現してください
4. 自然な会話形式で、親しみやすい表現を使用してください
5. 次の質問への自然な導入として機能するようにしてください
${reactionPatterns ? '6. 上記の「基礎的な相槌・反応パターン」を参考にして、同様のスタイルやトーンで生成してください' : ''}

【出力形式】
説明文や前置きは一切含めず、相槌や反応のテキストのみを出力してください。

出力例：
なるほど、それは興味深いですね。

または

そうですか、それは素晴らしい取り組みですね。

または

なるほど、理解しました。`

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

