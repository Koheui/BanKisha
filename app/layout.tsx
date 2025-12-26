'use client'

import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Toaster } from '@/components/ui/toaster'
import { usePathname } from 'next/navigation'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isInterviewPage = pathname?.startsWith('/interview/')
  const isMediaPage = pathname?.startsWith('/media')

  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <AuthProvider>
          {!isInterviewPage && !isMediaPage && <Header />}
          <main className={isMediaPage ? "min-h-screen" : "min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900"}>
            {children}
          </main>
          {!isInterviewPage && !isMediaPage && <Footer />}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}