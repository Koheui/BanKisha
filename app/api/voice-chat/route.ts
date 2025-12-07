import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY || ''
)

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'メッセージが必要です' },
        { status: 400 }
      )
    }

    // System prompt for interview
    const systemPrompt = `あなたはBanKishaのプロの番記者です。企業へのインタビューを行っています。
以下のルールに従って会話を進めてください：

1. 自然で親しみやすい口調で話す
2. 一度に1つの質問だけをする
3. 回答が短い場合は、より詳しく聞く
4. 以下のトピックを順番にカバーする：
   - 会社名と事業内容
   - 設立の経緯やきっかけ
   - サービス・製品の特徴
   - 競合との差別化ポイント
   - 今後の展望や目標

5. すべてのトピックをカバーしたら、会話を終了する
6. 会話の最後に「ありがとうございました。インタビューを終了します。」と言う

会話履歴を確認して、次に聞くべき質問を考えてください。`

    // Get the Gemini model
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

    // Convert messages to Gemini format
    // Gemini uses a different format - we need to combine system prompt with conversation
    const conversationHistory = messages
      .filter((msg: ChatMessage) => msg.role !== 'system')
      .map((msg: ChatMessage) => {
        if (msg.role === 'user') {
          return `ユーザー: ${msg.content}`
        } else {
          return `アシスタント: ${msg.content}`
        }
      })
      .join('\n\n')

    const prompt = `${systemPrompt}\n\n会話履歴:\n${conversationHistory}\n\nアシスタント:`

    // Call Gemini API
    const result = await model.generateContent(prompt)
    const response = await result.response
    const aiMessage = response.text() || '申し訳ございません。もう一度お願いできますか？'

    // Check if conversation is complete
    const isComplete = aiMessage.includes('ありがとうございました') || 
                      aiMessage.includes('インタビューを終了')

    return NextResponse.json({
      message: aiMessage,
      isComplete
    })
  } catch (error) {
    console.error('Error in voice chat API:', error)
    return NextResponse.json(
      { error: '会話の処理中にエラーが発生しました' },
      { status: 500 }
    )
  }
}