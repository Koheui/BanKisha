import { NextRequest, NextResponse } from 'next/server'

// Gemini音声タイプをGoogle Cloud TTSの音声設定にマッピング
// 音声名は指定せず、languageCodeとssmlGenderのみで指定（Googleが自動的に最適な音声を選択）
const VOICE_MAPPING: Record<string, { ssmlGender: 'MALE' | 'FEMALE' | 'NEUTRAL' }> = {
  'Puck': { ssmlGender: 'MALE' }, // 中性的で明るい
  'Charon': { ssmlGender: 'MALE' }, // 落ち着いた低め
  'Kore': { ssmlGender: 'FEMALE' }, // 柔らかく優しい
  'Fenrir': { ssmlGender: 'MALE' }, // 力強く深みのある
  'Aoede': { ssmlGender: 'FEMALE' }, // 穏やかで心地よい
}

export async function POST(request: NextRequest) {
  try {
    const { text, voiceType, speakingRate } = await request.json()

    console.log('📝 Text-to-speech request:', { text: text?.substring(0, 50), voiceType, speakingRate })

    if (!text || !voiceType) {
      return NextResponse.json(
        { error: 'テキストと音声タイプが必要です' },
        { status: 400 }
      )
    }

    // Google Cloud Text-to-Speech REST APIを使用
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY || process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Cloud API Keyが設定されていません。GOOGLE_CLOUD_API_KEY または GEMINI_API_KEY を設定してください。' },
        { status: 500 }
      )
    }

    // 音声タイプをマッピング
    const voiceConfig = VOICE_MAPPING[voiceType] || VOICE_MAPPING['Puck']
    console.log('🎤 Generating speech with voice type:', voiceType, 'gender:', voiceConfig.ssmlGender)

    // Google Cloud Text-to-Speech REST APIを呼び出し
    const ttsUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`
    
    // languageCodeとssmlGenderのみで指定（Googleが自動的に最適な音声を選択）
    // NEUTRALはサポートされていないため、MALEにフォールバック
    const voiceConfig_obj = {
      languageCode: 'ja-JP',
      ssmlGender: voiceConfig.ssmlGender === 'NEUTRAL' ? 'MALE' : voiceConfig.ssmlGender,
    }
    
    // speakingRateの範囲: 0.25 - 4.0（デフォルト: 1.2 = 少し速め）
    const rate = speakingRate ? Math.max(0.25, Math.min(4.0, parseFloat(speakingRate))) : 1.2
    
    const requestBody = {
      input: { text },
      voice: voiceConfig_obj,
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: rate,
        pitch: 0.0,
        volumeGainDb: 0.0,
      },
    }

    const ttsResponse = await fetch(ttsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!ttsResponse.ok) {
      let errorData
      try {
        errorData = await ttsResponse.json()
      } catch (e) {
        errorData = { error: { message: ttsResponse.statusText } }
      }
      
      console.error('❌ TTS API error:', {
        status: ttsResponse.status,
        statusText: ttsResponse.statusText,
        error: errorData,
        url: ttsUrl.replace(apiKey, '***'),
      })
      
      // より詳細なエラーメッセージを返す
      const errorMessage = errorData.error?.message || ttsResponse.statusText
      let userMessage = '音声生成に失敗しました'
      
      if (ttsResponse.status === 403) {
        if (errorMessage.includes('has not been used in project')) {
          userMessage = 'Text-to-Speech APIが有効化されていません。Google Cloud Consoleで有効化してください。'
        } else if (errorMessage.includes('API key')) {
          userMessage = 'APIキーが無効です。正しいAPIキーを設定してください。'
        } else {
          userMessage = 'アクセスが拒否されました。Text-to-Speech APIが有効化されているか確認してください。'
        }
      } else if (ttsResponse.status === 400) {
        if (errorMessage.includes('does not exist') || errorMessage.includes('Voice')) {
          userMessage = '指定された音声が見つかりません。音声設定を修正しました。もう一度お試しください。'
        } else {
          userMessage = `リクエストエラー: ${errorMessage}`
        }
      }
      
      return NextResponse.json(
        { 
          error: userMessage, 
          details: errorMessage,
          status: ttsResponse.status,
          helpUrl: 'https://console.cloud.google.com/apis/library/texttospeech.googleapis.com?project=bankisha-654d0'
        },
        { status: ttsResponse.status }
      )
    }

    const ttsData = await ttsResponse.json()

    if (!ttsData.audioContent) {
      return NextResponse.json(
        { error: '音声データが生成されませんでした' },
        { status: 500 }
      )
    }

    // Base64デコード
    const audioBuffer = Buffer.from(ttsData.audioContent, 'base64')
    console.log('✅ Audio generated successfully, length:', audioBuffer.length)

    // 音声データを返す
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('❌ Text-to-speech error:', error)
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    return NextResponse.json(
      { 
        error: '音声生成に失敗しました', 
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

