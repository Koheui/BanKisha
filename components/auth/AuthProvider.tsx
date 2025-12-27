'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useUser, useAuth as useClerkAuth } from '@clerk/nextjs'

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
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => { },
  refreshUser: async () => { },
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser()
  const { signOut } = useClerkAuth()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUserProfile = async () => {
    if (!clerkUser) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/user/profile')
      if (response.ok) {
        const userData = await response.json()
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
        console.warn('⚠️ Failed to fetch user profile, falling back to basic info')
        setUser({
          uid: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress || null,
          role: 'user',
          displayName: clerkUser.fullName || undefined,
          photoURL: clerkUser.imageUrl || undefined
        })
      }
    } catch (error) {
      console.error('❌ Error in AuthProvider fetch:', error)
      setUser({
        uid: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || null,
        role: 'user',
        displayName: clerkUser.fullName || undefined,
        photoURL: clerkUser.imageUrl || undefined
      })
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Logout error:', error)
      throw error
    }
  }

  useEffect(() => {
    if (clerkLoaded) {
      fetchUserProfile()
    }
  }, [clerkUser, clerkLoaded])

  return (
    <AuthContext.Provider value={{
      user,
      loading: loading || !clerkLoaded,
      logout,
      refreshUser: fetchUserProfile
    }}>
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
