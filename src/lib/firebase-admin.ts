import * as admin from 'firebase-admin'

export let adminDebug: any = { initialized: false, path: null, error: null, method: null, hasKey: false }

/**
 * 秘密鍵のパースエラーを防ぐためのクリーンアップ関数
 */
function cleanPrivateKey(pk: string | undefined): string | undefined {
  if (!pk || typeof pk !== 'string') return pk

  console.log(`🧹 Firebase Admin: Cleaning private key (length: ${pk.length})`)

  // 1. 基本的なサニタイズ
  let clean = pk.replace(/[^\x00-\x7F]/g, '')

  // 2. ヘッダー、エスケープされた改行、空白をすべて除去
  let body = clean
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\s+/g, '')

  // 3. Base64の妥当性チェックと修復（Unparsed DER bytes対策）
  // Base64のボディ長は4の倍数である必要がある
  if (body.length % 4 !== 0) {
    const originalLen = body.length
    const excess = body.length % 4
    // 余計な末尾文字を削る（物理的な破損の多くは末尾にゴミが付くため）
    body = body.substring(0, body.length - excess)
    console.warn(`⚠️ Firebase Admin: Private key body length (${originalLen}) is invalid. Trimmed to ${body.length}.`)
    adminDebug.trimmed = { original: originalLen, trimmed: body.length }
  }

  // 明らかに短すぎる場合は、既存の値をそのまま返す（何もしないよりマシ）
  if (body.length < 500) {
    console.warn('⚠️ Firebase Admin: Private key body is suspiciously short.')
    return pk
  }

  // 4. 64文字ごとに改行を入れる
  const lines = body.match(/.{1,64}/g)
  const wrapped = lines ? lines.join('\n') : body

  // 5. 正しいPEMヘッダーで再構成
  return `-----BEGIN PRIVATE KEY-----\n${wrapped}\n-----END PRIVATE KEY-----\n`
}

/**
 * Firebase Admin SDKの初期化
 * 環境変数から認証情報を取得して初期化します
 */
export async function initializeFirebaseAdmin() {
  // Check if already robustly initialized
  if (admin.apps.length > 0 && adminDebug.hasKey) {
    return admin.app()
  }

  console.log('🔍 Firebase Admin: Starting initialization sequence...')
  adminDebug.initialized = 'attempting'

  // Capture call stack for debugging
  try {
    adminDebug.stack = new Error().stack?.split('\n').slice(1, 4).join(' <- ')
  } catch (e) { }

  try {
    // 1. Prepare Credentials
    let clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    let privateKey = cleanPrivateKey(process.env.FIREBASE_PRIVATE_KEY)
    let projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID

    // 2. Local File Fallback
    if ((!clientEmail || !privateKey) && process.env.NODE_ENV === 'development') {
      try {
        const fs = require('fs')
        const path = require('path')
        const cwd = process.cwd()

        const searchPaths = [
          path.join(cwd, 'service-account-key.json'),
          '/Volumes/T5c_1TB/BanKisha/service-account-key.json',
          path.join(cwd, 'Keys', 'bankisha-654d0-90de5ae7fcde.json'),
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
          console.log('🔑 Firebase Admin: Found credential file at:', finalKeyPath)
          adminDebug.path = finalKeyPath
          let rawContent = fs.readFileSync(finalKeyPath, 'utf8')

          if (rawContent.charCodeAt(0) === 0xFEFF) rawContent = rawContent.slice(1)

          let keyData: any
          try {
            keyData = JSON.parse(rawContent)
          } catch (jsonErr) {
            const repairedJSON = rawContent.replace(/\r?\n|\r/g, '')
            keyData = JSON.parse(repairedJSON)
          }

          if (keyData) {
            clientEmail = clientEmail || keyData.client_email
            projectId = projectId || keyData.project_id || keyData.projectId
            privateKey = cleanPrivateKey(keyData.private_key)
            adminDebug.fileKeyFound = true
          }
        }
      } catch (e: any) {
        console.warn('⚠️ Firebase Admin: File loading failed:', e.message)
      }
    }

    // 3. Logic: If app exists but we found better credentials, we should have used them.
    // If adminDebug.hasKey is false, it means the current app was likely initialized without a key (ADC/broken).
    if (admin.apps.length > 0) {
      if (!adminDebug.hasKey && clientEmail && privateKey && privateKey.length > 500) {
        console.warn('⚠️ Firebase Admin: Existing app lacks credentials but new ones are available. Deleting old app for re-init.')
        try {
          await admin.app().delete()
          adminDebug.wasDeleted = true
        } catch (deleteErr: any) {
          console.error('❌ Firebase Admin: Failed to delete old app:', deleteErr.message)
        }
      } else {
        console.warn('⚠️ Firebase Admin: App already exists. Returning current instance.')
        adminDebug.initialized = true
        adminDebug.wasPreExisting = true
        return admin.app()
      }
    }

    // 4. Initialize with Certificate
    if (clientEmail && privateKey && projectId && privateKey.length > 500) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      })
      adminDebug.method = 'certificate'
      adminDebug.hasKey = true
      adminDebug.initialized = true
      adminDebug.projectId = projectId
      console.log('✅ Firebase Admin: Initialized with Certificate')
      return admin.app()
    }

    // 5. Initialize with ADC (Internal/Project ID)
    if (projectId) {
      admin.initializeApp({
        projectId,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      })
      adminDebug.method = 'adc'
      adminDebug.initialized = true
      adminDebug.projectId = projectId
      console.warn('⚠️ Firebase Admin: Initialized with ADC (No explicit certificate)')
      return admin.app()
    }

    throw new Error('Firebase Admin: No credentials or project ID found')
  } catch (error: any) {
    console.error('❌ Firebase Admin: Initialization failed:', error.message)
    adminDebug.error = error.message
    throw error
  }
}

// 自動初期化（ビルド時はスキップ）
// Next.jsのビルド時（NEXT_PHASE === 'phase-production-build'）は初期化をスキップ
// Next.jsのビルド時（NEXT_PHASE === 'phase-production-build'）は初期化をスキップ
if (typeof process !== 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build') {
  initializeFirebaseAdmin().catch(error => {
    // ビルド時以外でも初期化に失敗した場合は警告のみ（実行時に再試行される）
    console.warn('⚠️ Firebase Admin SDK initialization failed, will retry at runtime:', error)
  })
}

