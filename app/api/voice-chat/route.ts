import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

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

    // Convert messages to OpenAI format
    const openaiMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((msg: ChatMessage) => ({
        role: msg.role,
        content: msg.content
      }))
    ]

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 500,
    })

    const aiMessage = completion.choices[0]?.message?.content || '申し訳ございません。もう一度お願いできますか？'

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
