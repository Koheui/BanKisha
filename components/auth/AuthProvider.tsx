'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User as FirebaseUser, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { getFirebaseAuth, getFirebaseDb } from '@/src/lib/firebase'

interface UserData {
  uid: string
  email: string | null
  role: 'user' | 'admin' | 'superAdmin'
  companyId?: string
  displayName?: string
  photoURL?: string
}

interface AuthContextType {
  user: UserData | null
  loading: boolean
  firebaseUser: FirebaseUser | null
  logout: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName?: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  firebaseUser: null,
  logout: async () => {},
  signIn: async () => {},
  signUp: async () => {}
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

  const signUp = async (email: string, password: string, displayName?: string) => {
    try {
      const firebaseAuth = getFirebaseAuth()
      const userCredential = await createUserWithEmailAndPassword(firebaseAuth, email, password)
      const user = userCredential.user
      
      // Create user document in Firestore
      const firestoreDb = getFirebaseDb()
      await setDoc(doc(firestoreDb, 'users', user.uid), {
        email: user.email,
        displayName: displayName || null,
        role: 'user',
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
      const unsubscribe = onAuthStateChanged(firebaseAuth, async (firebaseUser) => {
        if (!isMounted) return
        
        clearTimeout(timeoutId)
        setFirebaseUser(firebaseUser)
        
        if (firebaseUser) {
          try {
            // Firestoreからユーザーデータを取得（タイムアウト付き）
            const firestoreDb = getFirebaseDb()
            const userDocRef = doc(firestoreDb, 'users', firebaseUser.uid)
            const userDoc = await Promise.race([
              getDoc(userDocRef),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Firestore timeout')), 5000)
              )
            ]) as any
            
            if (!isMounted) return
            
            if (userDoc && userDoc.exists && userDoc.exists()) {
              const userData = userDoc.data()
              setUser({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                role: userData.role || 'user',
                companyId: userData.companyId,
                displayName: firebaseUser.displayName || userData.displayName,
                photoURL: firebaseUser.photoURL || userData.photoURL
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
          } catch (error) {
            console.error('Error fetching user data:', error)
            if (!isMounted) return
            // エラーが発生しても、基本的なユーザー情報は設定する
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              role: 'user'
            })
          }
        } else {
          setUser(null)
        }
        
        if (isMounted) {
          setLoading(false)
        }
      })

      return () => {
        isMounted = false
        clearTimeout(timeoutId)
        unsubscribe()
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

