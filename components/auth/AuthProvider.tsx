'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User as FirebaseUser, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseDb } from '@/src/lib/firebase'
import * as firestoreLib from '../../src/lib/firestore'

interface UserData {
  uid: string
  email: string | null
  role: 'user' | 'admin' | 'superAdmin'
  companyId?: string
  displayName?: string
  photoURL?: string
  bio?: string
  customGenres?: string[]
}

interface AuthContextType {
  user: UserData | null
  loading: boolean
  firebaseUser: FirebaseUser | null
  logout: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName?: string, companyName?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  firebaseUser: null,
  logout: async () => { },
  signIn: async () => { },
  signUp: async (_email: string, _password: string, _displayName?: string, _companyName?: string) => { },
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null)

  const logout = async () => {
    try {
      const firebaseAuth = getFirebaseAuth()
      await signOut(firebaseAuth)
    } catch (error) {
      console.error('Logout error:', error)
      throw error
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const firebaseAuth = getFirebaseAuth()
      await signInWithEmailAndPassword(firebaseAuth, email, password)
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    }
  }

  const signUp = async (email: string, password: string, displayName?: string, companyName?: string) => {
    try {
      const firebaseAuth = getFirebaseAuth()
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password)
      const user = userCredential.user

      // Create company for the user
      const firestoreDb = getFirebaseDb()
      let companyId: string | null = null

      if (companyName) {
        companyId = await firestoreLib.initializeCompany(companyName, user.uid)
      } else {
        // 企業名がない場合は、メールアドレスのドメインから自動生成
        const domain = email.split('@')[1] || '個人'
        const autoCompanyName = `${domain} (${displayName || 'ユーザー'})`
        companyId = await firestoreLib.initializeCompany(autoCompanyName, user.uid)
      }

      // Create user document in Firestore
      await setDoc(doc(firestoreDb, 'users', user.uid), {
        email: user.email,
        displayName: displayName || null,
        role: 'user',
        companyId: companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    } catch (error) {
      console.error('Sign up error:', error)
      throw error
    }
  }

  useEffect(() => {
    // タイムアウトを設定（10秒後に強制的にloadingをfalseにする）
    const timeoutId = setTimeout(() => {
      console.warn('Auth initialization timeout - setting loading to false')
      setLoading(false)
    }, 10000)

    let isMounted = true

    try {
      const firebaseAuth = getFirebaseAuth()
      let unsubscribeUserDoc: (() => void) | null = null

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
        if (!isMounted) return

        clearTimeout(timeoutId)
        setFirebaseUser(firebaseUser)

        // 前のリスナーがあれば解除
        if (unsubscribeUserDoc) {
          unsubscribeUserDoc()
          unsubscribeUserDoc = null
        }

        if (firebaseUser) {
          // Firestoreからユーザーデータを取得（onSnapshotでリアルタイム同期）
          const firestoreDb = getFirebaseDb()
          const userDocRef = doc(firestoreDb, 'users', firebaseUser.uid)

          unsubscribeUserDoc = onSnapshot(userDocRef, (snapshot) => {
            if (!isMounted) return

            if (snapshot.exists()) {
              const userData = snapshot.data()
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                role: userData.role || 'user',
                companyId: userData.companyId,
                displayName: firebaseUser.displayName || userData.displayName,
                photoURL: firebaseUser.photoURL || userData.photoURL,
                bio: userData.bio,
                customGenres: userData.customGenres || []
              })
            } else {
              // Firestoreにユーザードキュメントがない場合、デフォルトのuser roleを設定
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                role: 'user',
                displayName: firebaseUser.displayName || undefined,
                photoURL: firebaseUser.photoURL || undefined
              })
            }
            setLoading(false)
            clearTimeout(timeoutId)
          }, (err) => {
            console.error('Error fetching user data:', err)
            if (!isMounted) return
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: 'user'
            })
            setLoading(false)
            clearTimeout(timeoutId)
          })
        } else {
          setUser(null)
          setLoading(false)
          clearTimeout(timeoutId)
        }
      })

      return () => {
        isMounted = false
        clearTimeout(timeoutId)
        unsubscribe()
        if (unsubscribeUserDoc) {
          unsubscribeUserDoc()
        }
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
      clearTimeout(timeoutId)
      setLoading(false)
      setUser(null)
      setFirebaseUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, firebaseUser, logout, signIn, signUp }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

