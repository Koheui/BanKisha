import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { audioUrl } = await request.json()

    if (!audioUrl) {
      return NextResponse.json(
        { error: '音声URLが必要です' },
        { status: 400 }
      )
    }

    // Call Firebase Function to transcribe audio
    const functionUrl = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL || 'http://localhost:5001'
    const response = await fetch(`${functionUrl}/transcribeAudio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audioUrl }),
    })

    if (!response.ok) {
      throw new Error('音声の文字起こしに失敗しました')
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      transcript: data.transcript
    })
  } catch (error) {
    console.error('Error transcribing audio:', error)
    return NextResponse.json(
      { error: '音声の文字起こし中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
