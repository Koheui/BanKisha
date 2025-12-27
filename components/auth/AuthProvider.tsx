'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useUser, useAuth as useClerkAuth } from '@clerk/nextjs'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirebaseDb } from '@/src/lib/firebase'

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
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => { },
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser()
  const { signOut } = useClerkAuth()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  const logout = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Logout error:', error)
      throw error
    }
  }

  useEffect(() => {
    if (!clerkLoaded) return

    let unsubscribeUserDoc: (() => void) | null = null

    if (clerkUser) {
      try {
        // ClerkのユーザーIDを使用してFirestoreからデータを取得
        const firestoreDb = getFirebaseDb()
        const userDocRef = doc(firestoreDb, 'users', clerkUser.id)

        unsubscribeUserDoc = onSnapshot(userDocRef, (snapshot) => {
          if (snapshot.exists()) {
            const userData = snapshot.data()
            setUser({
              uid: clerkUser.id,
              email: clerkUser.primaryEmailAddress?.emailAddress || null,
              role: userData.role || 'user',
              companyId: userData.companyId,
              displayName: userData.displayName || clerkUser.fullName || undefined,
              photoURL: userData.photoURL || clerkUser.imageUrl || undefined,
              bio: userData.bio,
              customGenres: userData.customGenres || []
            })
          } else {
            // ユーザードキュメントがまだない場合（サインアップ直後など）
            setUser({
              uid: clerkUser.id,
              email: clerkUser.primaryEmailAddress?.emailAddress || null,
              role: 'user',
              displayName: clerkUser.fullName || undefined,
              photoURL: clerkUser.imageUrl || undefined
            })
          }
          setLoading(false)
        }, (err) => {
          console.error('Error fetching user data from Firestore:', err)
          setUser({
            uid: clerkUser.id,
            email: clerkUser.primaryEmailAddress?.emailAddress || null,
            role: 'user',
            displayName: clerkUser.fullName || undefined,
            photoURL: clerkUser.imageUrl || undefined
          })
          setLoading(false)
        })
      } catch (error) {
        console.error('Failed to initialize Firestore in AuthProvider:', error)
        // Fallback: use Clerk user data even if Firestore is unavailable
        setUser({
          uid: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress || null,
          role: 'user',
          displayName: clerkUser.fullName || undefined,
          photoURL: clerkUser.imageUrl || undefined
        })
        setLoading(false)
      }
    } else {
      setUser(null)
      setLoading(false)
    }

    return () => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc()
      }
    }
  }, [clerkUser, clerkLoaded])

  return (
    <AuthContext.Provider value={{ user, loading: loading || !clerkLoaded, logout }}>
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


