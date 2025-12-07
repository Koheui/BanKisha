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

    // Get the last user message for knowledge base search
    const lastUserMessage = messages
      .filter((msg: ChatMessage) => msg.role === 'user')
      .pop()?.content || ''

    // Search knowledge base for relevant interview techniques
    let knowledgeContext = ''
    try {
      const searchResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/knowledge-base/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: lastUserMessage || 'インタビュー技法',
          limit: 3
        }),
      })

      if (searchResponse.ok) {
        const searchData = await searchResponse.json()
        if (searchData.results && searchData.results.length > 0) {
          knowledgeContext = '\n\n【プロのインタビュー術（参考資料）】\n' +
            searchData.results.map((r: any, i: number) => 
              `${i + 1}. ${r.text}`
            ).join('\n\n')
        }
      }
    } catch (error) {
      console.error('Error searching knowledge base:', error)
      // Continue without knowledge base if search fails
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

${knowledgeContext ? '参考資料を活用して、より効果的な質問をしてください。' : ''}

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

    const prompt = `${systemPrompt}${knowledgeContext}\n\n会話履歴:\n${conversationHistory}\n\nアシスタント:`

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