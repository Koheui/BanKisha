import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore'
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Firebase初期化（遅延初期化）
let app: FirebaseApp | null = null
let authInstance: Auth | null = null
let dbInstance: Firestore | null = null
let storageInstance: FirebaseStorage | null = null

function initializeFirebase() {
  // ビルド時は初期化をスキップ
  if (typeof process !== 'undefined' && process.env.NEXT_PHASE === 'phase-production-build') {
    return null
  }

  if (app) return app

  try {
    // 環境変数が設定されている場合のみ初期化
    // クライアント側では、NEXT_PUBLIC_プレフィックスの環境変数がビルド時に埋め込まれる
    if (firebaseConfig.apiKey && firebaseConfig.projectId) {
      app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
      
      // サービスを初期化
      if (app) {
        try {
          authInstance = getAuth(app)
          dbInstance = getFirestore(app)
          storageInstance = getStorage(app)
        } catch (serviceError) {
          // サービス初期化エラーを無視（ビルド時）
          if (process.env.NEXT_PHASE !== 'phase-production-build') {
            console.warn('⚠️ Firebase services initialization failed:', serviceError)
          }
        }
      }
    } else {
      // 環境変数が設定されていない場合のエラーメッセージ
      if (typeof window !== 'undefined') {
        console.error('❌ Firebase環境変数が設定されていません:', {
          apiKey: !!firebaseConfig.apiKey,
          projectId: !!firebaseConfig.projectId,
          authDomain: !!firebaseConfig.authDomain
        })
      }
    }
  } catch (error) {
    // ビルド時はエラーを完全に無視
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      console.error('❌ Firebase initialization failed:', error)
    }
  }
  
  return app
}

// 実行時に初期化（ビルド時はスキップ）
// ビルド時は初期化を試みない
if (typeof process === 'undefined' || process.env.NEXT_PHASE !== 'phase-production-build') {
  try {
    initializeFirebase()
  } catch (error) {
    // ビルド時はエラーを無視
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      console.warn('⚠️ Firebase initialization error:', error)
    }
  }
}

// ゲッター関数（実行時に初期化を保証）
function getAuthInstance(): Auth {
  if (!authInstance) {
    const initializedApp = initializeFirebase()
    if (!initializedApp) {
      throw new Error('Firebase app not initialized. Please check your environment variables.')
    }
    if (!app) {
      throw new Error('Firebase app not initialized. Please check your environment variables.')
    }
    authInstance = getAuth(app)
  }
  return authInstance
}

function getDbInstance(): Firestore {
  if (!dbInstance) {
    const initializedApp = initializeFirebase()
    if (!initializedApp) {
      throw new Error('Firebase app not initialized. Please check your environment variables.')
    }
    if (!app) {
      throw new Error('Firebase app not initialized. Please check your environment variables.')
    }
    dbInstance = getFirestore(app)
  }
  return dbInstance
}

function getStorageInstance(): FirebaseStorage {
  if (!storageInstance) {
    const initializedApp = initializeFirebase()
    if (!initializedApp) {
      throw new Error('Firebase app not initialized. Please check your environment variables.')
    }
    if (!app) {
      throw new Error('Firebase app not initialized. Please check your environment variables.')
    }
    storageInstance = getStorage(app)
  }
  return storageInstance
}

// エクスポート（ビルド時は初期化されないが、実行時は確実に初期化される）
// 型安全性のため、ゲッター関数を使用（名前衝突を避けるため、別名でエクスポート）
export function getFirebaseAuth() {
  return getAuthInstance()
}

export function getFirebaseDb() {
  return getDbInstance()
}

export function getFirebaseStorage() {
  return getStorageInstance()
}

// 後方互換性のため、直接エクスポート（実行時に初期化される）
// ビルド時はundefinedの可能性があるため、使用時はgetFirebaseDb()などを推奨
export const auth = authInstance || undefined
export const db = dbInstance || undefined
export const storage = storageInstance || undefined

// 実行時に確実に初期化されるゲッター関数（推奨）
export { getAuthInstance, getDbInstance, getStorageInstance }

// Connect to emulators in development (only if explicitly enabled)
// ビルド時はスキップ
if (typeof process !== 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build') {
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
    try {
      if (authInstance) {
        connectAuthEmulator(authInstance, 'http://localhost:9099', { disableWarnings: true })
      }
      if (dbInstance) {
        connectFirestoreEmulator(dbInstance, 'localhost', 8080)
      }
      if (storageInstance) {
        connectStorageEmulator(storageInstance, 'localhost', 9199)
      }
    } catch (error) {
      // Emulators already connected or not available
      console.log('Firebase emulators not available or already connected')
    }
  }
}

export default app
