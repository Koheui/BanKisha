'use client'

import { usePathname } from 'next/navigation'
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs"
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isInterviewPage = pathname?.startsWith('/interview/')
  const isMediaPage = pathname?.startsWith('/media')

  return (
    <>
      <header className="flex justify-end p-4 gap-4 border-b bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <SignedOut>
          <SignInButton mode="modal">
            <button className="text-sm font-medium hover:text-primary transition-colors">
              サインイン
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="text-sm font-medium bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 transition-colors">
              新規登録
            </button>
          </SignUpButton>
        </SignedOut>
        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </header>

      {!isInterviewPage && !isMediaPage && <Header />}
      <main className={isMediaPage ? "min-h-screen" : "min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900"}>
        {children}
      </main>
      {!isInterviewPage && !isMediaPage && <Footer />}
    </>
  )
}