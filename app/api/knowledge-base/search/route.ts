import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { query, limit = 5 } = await request.json()

    if (!query) {
      return NextResponse.json(
        { error: '検索クエリが必要です' },
        { status: 400 }
      )
    }

    // Call Firebase Function to search knowledge base
    const functionUrl = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL || 'http://localhost:5001'
    const response = await fetch(`${functionUrl}/searchKnowledgeBase`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, limit }),
    })

    if (!response.ok) {
      throw new Error('ナレッジベースの検索に失敗しました')
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      results: data.results
    })
  } catch (error) {
    console.error('Error searching knowledge base:', error)
    return NextResponse.json(
      { error: 'ナレッジベースの検索中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
