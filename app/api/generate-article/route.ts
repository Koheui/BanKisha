import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { qa, companyName } = await request.json()

    if (!qa || !Array.isArray(qa)) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています' },
        { status: 400 }
      )
    }

    // Call Firebase Function to generate article
    const functionUrl = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL || 'http://localhost:5001'
    const response = await fetch(`${functionUrl}/generateArticle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ qa, companyName }),
    })

    if (!response.ok) {
      throw new Error('記事生成に失敗しました')
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      article: data.article,
      sns: data.sns
    })
  } catch (error) {
    console.error('Error generating article:', error)
    return NextResponse.json(
      { error: '記事の生成中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
