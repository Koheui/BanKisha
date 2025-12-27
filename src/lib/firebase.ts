import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore'
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
}

// Firebase初期化（遅延初期化）
let app: FirebaseApp | null = null
let dbInstance: Firestore | null = null
let storageInstance: FirebaseStorage | null = null

function initializeFirebase() {
  const phase = typeof process !== 'undefined' ? process.env.NEXT_PHASE : 'unknown'
  const isBuildPhase = phase === 'phase-production-build'

  // ビルド時は初期化をスキップ
  if (isBuildPhase) {
    return null
  }

  if (app) return app

  try {
    const hasApiKey = !!firebaseConfig.apiKey
    const hasProjectId = !!firebaseConfig.projectId

    if (hasApiKey && hasProjectId) {
      if (typeof window !== 'undefined') {
        console.log('🔥 Initializing Firebase for project:', firebaseConfig.projectId)
      }
      app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

      if (app) {
        try {
          dbInstance = getFirestore(app)
          storageInstance = getStorage(app)
        } catch (serviceError) {
          console.warn('⚠️ Firebase services initialization failed:', serviceError)
        }
      }
    } else {
      if (typeof window !== 'undefined') {
        console.error('❌ Firebase環境変数が設定されていません:', {
          apiKeyPresent: hasApiKey,
          projectIdPresent: hasProjectId,
          authDomainPresent: !!firebaseConfig.authDomain,
          phase: phase,
        })
      }
    }
  } catch (error) {
    if (!isBuildPhase) {
      console.error('❌ Firebase initialization failed:', error)
    }
  }

  return app
}

// 実行時に初期化（ビルド時はスキップ）
if (typeof process === 'undefined' || process.env.NEXT_PHASE !== 'phase-production-build') {
  try {
    initializeFirebase()
  } catch (error) {
    if (process.env.NEXT_PHASE !== 'phase-production-build') {
      console.warn('⚠️ Firebase initialization error:', error)
    }
  }
}

// ゲッター関数（実行時に初期化を保証）
function getDbInstance(): Firestore {
  if (!dbInstance) {
    const initializedApp = initializeFirebase()
    if (!initializedApp || !app) {
      throw new Error('Firebase app not initialized. Please check your environment variables.')
    }
    dbInstance = getFirestore(app)
  }
  return dbInstance
}

function getStorageInstance(): FirebaseStorage {
  if (!storageInstance) {
    const initializedApp = initializeFirebase()
    if (!initializedApp || !app) {
      throw new Error('Firebase app not initialized. Please check your environment variables.')
    }
    storageInstance = getStorage(app)
  }
  return storageInstance
}

// エクスポート
export function getFirebaseDb() {
  return getDbInstance()
}

export function getFirebaseStorage() {
  return getStorageInstance()
}

// 後方互換性のため
export const db = dbInstance || undefined
export const storage = storageInstance || undefined

export { getDbInstance, getStorageInstance }

// Connect to emulators in development
if (typeof process !== 'undefined') {
  const phase = process.env.NEXT_PHASE
  if (phase !== 'phase-production-build' && process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
    try {
      if (dbInstance) {
        connectFirestoreEmulator(dbInstance, 'localhost', 8080)
      }
      if (storageInstance) {
        connectStorageEmulator(storageInstance, 'localhost', 9199)
      }
    } catch (error) {
      console.log('Firebase emulators not available or already connected')
    }
  }
}

export default app
