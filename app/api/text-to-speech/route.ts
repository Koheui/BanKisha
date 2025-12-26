import { NextRequest, NextResponse } from 'next/server'
import { TextToSpeechClient } from '@google-cloud/text-to-speech'
import { protos } from '@google-cloud/text-to-speech'

// Initialize the client
// When running on Cloud Run, this will use the default service account (ADC)
// For local development, we try to use a service-account-key.json if it exists
let cachedClient: TextToSpeechClient | null = null
let keyDataDebug: any = null

async function getTTSClient() {
  if (cachedClient) return cachedClient

  console.log('🔍 Initializing Text-to-Speech client...')
  const clientOptions: any = {}

  // 1. Try Environment Variables first (most robust for local/codespaces)
  const envKey = process.env.TTS_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY
  const envEmail = process.env.TTS_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL
  const envProjectId = process.env.TTS_PROJECT_ID || process.env.GOOGLE_PROJECT_ID

  if (envKey && envEmail) {
    console.log('🔑 Using credentials from environment variables')
    clientOptions.credentials = {
      client_email: envEmail,
      private_key: envKey.replace(/\\n/g, '\n'),
    }
    if (envProjectId) clientOptions.projectId = envProjectId

    keyDataDebug = {
      source: 'env',
      project: envProjectId || 'unknown',
      hasPEM: envKey.includes('BEGIN PRIVATE KEY'),
      len: envKey.length
    }
  }
  // 2. Fallback to service-account-key.json
  else if (process.env.NODE_ENV === 'development') {
    try {
      const fs = require('fs')
      const path = require('path')
      const cwd = process.cwd()

      const searchPaths = [
        path.join(cwd, 'service-account-key.json'),
        '/Volumes/T5c_1TB/BanKisha/service-account-key.json', // Absolute path
        path.join(cwd, '..', 'service-account-key.json'),
        path.join(cwd, 'public', 'service-account-key.json'),
      ]

      let finalKeyPath = null
      for (const p of searchPaths) {
        if (fs.existsSync(p)) {
          finalKeyPath = p
          break
        }
      }

      if (finalKeyPath) {
        console.log('🔑 Found credential file at:', finalKeyPath)

        let keyData: any
        let rawContent = fs.readFileSync(finalKeyPath, 'utf8')

        // Strip BOM if present
        if (rawContent.charCodeAt(0) === 0xFEFF) {
          rawContent = rawContent.slice(1)
        }

        try {
          keyData = JSON.parse(rawContent)
        } catch (jsonErr: any) {
          console.warn('⚠️ service-account-key.json is malformed. Attempting robust repair...')
          try {
            // Remove ALL actual newlines to make it valid JSON (fixing raw newlines in strings)
            const repairedJSON = rawContent.replace(/\r?\n|\r/g, '')
            keyData = JSON.parse(repairedJSON)
            console.log('✅ Basic JSON repair successful')
          } catch (repairErr: any) {
            console.error('❌ Failed to repair JSON:', repairErr.message)
            throw new Error(`Credential file is fundamentally invalid: ${jsonErr.message}`)
          }
        }

        // Also provide explicitly in options
        clientOptions.keyFilename = finalKeyPath

        // Ensure private_key has correct format for gRPC/OpenSSL
        if (keyData.private_key && typeof keyData.private_key === 'string') {
          // 1. Sanitize: remove any non-ASCII characters that might have crept in
          let pk = keyData.private_key.replace(/[^\x00-\x7F]/g, '')

          // 2. Clean body: remove headers, escaped newlines, and ALL whitespace
          let body = pk
            .replace(/\\n/g, '\n')
            .replace(/-----BEGIN [A-Z ]+-----/g, '')
            .replace(/-----END [A-Z ]+-----/g, '')
            .replace(/\s+/g, '');

          // DIAGNOSTIC: Check Base64 length (2048-bit RSA key body should be 1624 or 1608 chars)
          const base64Len = body.length;
          const isLenValid = base64Len % 4 === 0 || base64Len % 4 === 2 || base64Len % 4 === 3;
          console.log(`📊 Base64 Body length: ${base64Len} chars. Valid: ${isLenValid}`);

          if (!isLenValid) {
            console.warn('❌ ERROR: Base64 length is invalid! The key is likely truncated.');
          }

          // 3. Wrap body to 64 chars
          const lines = body.match(/.{1,64}/g);
          const wrapped = lines ? lines.join('\n') : body;

          // 4. Reconstruct with proper headers
          keyData.private_key = `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----\n`;

          // Pass explicitly
          clientOptions.credentials = {
            client_email: keyData.client_email,
            private_key: keyData.private_key,
          }
          clientOptions.projectId = keyData.project_id

          keyDataDebug = {
            source: 'file',
            path: finalKeyPath,
            project: keyData.project_id,
            hasPEM: true,
            len: keyData.private_key.length,
            base64Len: base64Len,
            base64Valid: isLenValid
          }
        }

        console.log('✅ Loaded and cleaned key for project:', keyData.project_id)
      } else {
        console.warn('⚠️ No service-account-key.json found. ADC will be used.')
      }
    } catch (err) {
      console.error('❌ Error during client option setup:', err)
    }
  }

  try {
    cachedClient = new TextToSpeechClient(clientOptions)
    console.log('✅ Text-to-Speech client instance created')
    return cachedClient
  } catch (err) {
    console.error('❌ Failed to create Text-to-Speech client instance:', err)
    throw err
  }
}

// REST API fallback using fetch
async function synthesizeWithREST(text: string, voiceType: string, speakingRate?: number) {
  // Use the key provided by the user as the primary fallback
  const apiKey = process.env.GOOGLE_API_KEY || 'AIzaSyBULdve3vebMODO0A5C3CFQ8-SiLyxSaIA';
  console.log('🌐 Attempting speech synthesis via REST API...')

  const voiceConfig = VOICE_MAPPING[voiceType] || VOICE_MAPPING['Puck']
  const rate = speakingRate ? Math.max(0.25, Math.min(4.0, speakingRate)) : 1.1

  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`
  const body = {
    input: { text },
    voice: {
      languageCode: 'ja-JP',
      name: voiceConfig.name,
      ssmlGender: voiceConfig.ssmlGender,
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: rate,
    },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown REST error' }))
    throw new Error(`REST API failed: ${response.status} - ${JSON.stringify(errorData)}`)
  }

  const data = await response.json()
  return Buffer.from(data.audioContent, 'base64')
}

// Gemini音声タイプをGoogle Cloud TTSの音声設定にマッピング
// Neural2音声を使用することで、より自然で人間らしい発話を実現
const VOICE_MAPPING: Record<string, { name: string, ssmlGender: any }> = {
  'Puck': { name: 'ja-JP-Neural2-C', ssmlGender: 'MALE' }, // 落ち着いた男性
  'Charon': { name: 'ja-JP-Neural2-D', ssmlGender: 'MALE' }, // 力強い男性
  'Kore': { name: 'ja-JP-Neural2-B', ssmlGender: 'FEMALE' }, // 落ち着いた女性
  'Fenrir': { name: 'ja-JP-Wavenet-D', ssmlGender: 'MALE' }, // 低音で知的な男性（Wavenet）
  'Aoede': { name: 'ja-JP-Wavenet-A', ssmlGender: 'FEMALE' }, // 明るく親しみやすい女性（Wavenet）
}

export async function POST(request: NextRequest) {
  try {
    const { text, voiceType, speakingRate, speed } = await request.json()
    const rateToUse = speakingRate || speed

    console.log('📝 TTS Request text[:50]:', text?.substring(0, 50))

    if (!text || !voiceType) {
      return NextResponse.json({ error: 'Missing text or voiceType' }, { status: 400 })
    }

    // Google Cloud Text-to-Speech APIの文字数制限チェック（5000文字）
    if (text.length > 5000) {
      console.warn('⚠️ テキストが長すぎます（5000文字超）:', text.length)
      return NextResponse.json({ error: 'Text too long' }, { status: 400 })
    }

    let audioBuffer: Buffer

    try {
      // Step 1: Try the standard gRPC client
      const client = await getTTSClient()
      // 音声タイプをマッピング
      const voiceConfig = VOICE_MAPPING[voiceType] || VOICE_MAPPING['Puck']
      console.log('🎤 Generating speech with voice type:', voiceType, 'mapped to:', voiceConfig.name)

      // speakingRateの範囲: 0.25 - 4.0（デフォルト: 1.1 = 自然な会話速度）
      const rate = rateToUse ? Math.max(0.25, Math.min(4.0, parseFloat(rateToUse))) : 1.1

      // Construct the request
      const synthesizeRequest: protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest = {
        input: { text },
        voice: {
          languageCode: 'ja-JP',
          name: voiceConfig.name,
          ssmlGender: voiceConfig.ssmlGender,
        },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: rate,
          pitch: 0.0,
          volumeGainDb: 0.0,
        },
      }

      // Performs the text-to-speech request
      const [response] = await client.synthesizeSpeech(synthesizeRequest)

      if (!response.audioContent) {
        throw new Error('SynthesizeSpeech failed: Empty audioContent')
      }
      audioBuffer = Buffer.from(response.audioContent as Uint8Array)
    } catch (grpcErr: any) {
      console.warn('⚠️ gRPC TTS failed, attempting REST fallback:', grpcErr.message)
      // Step 2: Fallback to REST API
      audioBuffer = await synthesizeWithREST(text, voiceType, rateToUse ? parseFloat(rateToUse) : 1.1)
    }

    console.log('✅ Audio generated:', audioBuffer.length, 'bytes')

    // Return the audio data
    return new NextResponse(audioBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('❌ Text-to-speech route error:', error)

    // Add exhaustive debug info as a string for easy reading in the frontend console
    let debugSummary = 'N/A'
    try {
      const fs = require('fs')
      const path = require('path')
      const cwd = process.cwd()
      const searchPaths = [
        path.join(cwd, 'service-account-key.json'),
        '/Volumes/T5c_1TB/BanKisha/service-account-key.json',
        path.join(cwd, '..', 'service-account-key.json'),
        path.join(cwd, 'public', 'service-account-key.json'),
      ]

      const debugObj = {
        cwd,
        envGAC: process.env.GOOGLE_APPLICATION_CREDENTIALS || 'NOT SET',
        keyChecks: searchPaths.map(p => ({ found: fs.existsSync(p), p: p.replace(cwd, '.') })),
        keyFix: keyDataDebug || 'FAIL/NOT_LOADED',
        rootFiles: fs.readdirSync(cwd).filter((f: string) => !f.startsWith('.')).slice(0, 10)
      }
      debugSummary = JSON.stringify(debugObj, null, 2)
    } catch (dErr: any) {
      debugSummary = `Debug failed: ${dErr.message}`
    }

    return NextResponse.json(
      {
        error: '音声生成に失敗しました',
        details: error.message,
        code: error.code,
        debug: debugSummary,
        stack: error.stack?.split('\n').slice(0, 2)
      },
      { status: 500 }
    )
  }
}
