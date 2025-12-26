import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(request: NextRequest) {
    try {
        const { currentInput } = await request.json()

        const geminiApiKey = process.env.GEMINI_API_KEY
        if (!geminiApiKey) {
            return NextResponse.json(
                { error: 'Gemini API Key is not set' },
                { status: 500 }
            )
        }

        const genAI = new GoogleGenerativeAI(geminiApiKey)
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

        const prompt = `あなたはプロの編集者です。ユーザーが作りたいインタビューの「ジャンル」を提案してください。
提案は以下の基本カテゴリーを意識しつつ、ユーザーが入力したヒントに基づいて関連性の高いものを追加してください。

【基本カテゴリー】
- ビジネス・ニュース（製品紹介、経営者取材、プレスリリースなど）
- ホビー・ライフスタイル（料理、趣味、スキル解説など）
- イベント・コミュニティ（飲み会、同窓会、忘年会、オフ会など）

【ユーザーの入力ヒント】
${currentInput || 'なし'}

【出力要件】
- 日本語で出力してください。
- 関連性の高い順に最大10個程度。
- JSON形式で、"genres" キーに文字列の配列を入れてください。
- 余計な説明は一切含めないでください。JSONのみを出力してください。`

        const result = await model.generateContent(prompt)
        const responseText = result.response.text().trim().replace(/```json|```/g, '')
        const data = JSON.parse(responseText)

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error suggesting genres:', error)
        return NextResponse.json(
            { error: 'failed to suggest genres' },
            { status: 500 }
        )
    }
}
