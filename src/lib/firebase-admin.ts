import * as admin from 'firebase-admin'

/**
 * Firebase Admin SDKの初期化
 * 環境変数から認証情報を取得して初期化します
 */
export function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.apps[0]
  }

  try {
    // 方法1: 環境変数から認証情報を取得
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID

    if (clientEmail && privateKey && projectId) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      })
      console.log('✅ Firebase Admin SDK initialized from environment variables')
      return admin.app()
    }

    // 方法2: プロジェクトIDのみで初期化（Cloud Runのデフォルトサービスアカウントを使用）
    if (projectId) {
      admin.initializeApp({
        projectId,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      })
      console.log('✅ Firebase Admin SDK initialized from project ID (using default service account)')
      return admin.app()
    }

    throw new Error('Firebase Admin SDK credentials not found in environment variables')
  } catch (error) {
    console.error('❌ Firebase Admin SDK initialization error:', error)
    // ビルド時はエラーを無視（実行時に再試行される）
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE === 'phase-production-build') {
      console.warn('⚠️ Skipping Firebase Admin SDK initialization during build')
      return null
    }
    throw error
  }
}

// 自動初期化（ビルド時はスキップ）
// Next.jsのビルド時（NEXT_PHASE === 'phase-production-build'）は初期化をスキップ
if (typeof process !== 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build') {
  try {
    initializeFirebaseAdmin()
  } catch (error) {
    // ビルド時以外でも初期化に失敗した場合は警告のみ（実行時に再試行される）
    console.warn('⚠️ Firebase Admin SDK initialization failed, will retry at runtime:', error)
  }
}

