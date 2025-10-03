import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BanKisha - 企業インタビュープラットフォーム',
  description: '企業へのインタビューが簡単にできるウェブアプリ。音声インタビュー型のPRメディアを実現します。',
  keywords: ['企業インタビュー', 'PR', '取材', 'メディア', '音声'],
  authors: [{ name: 'BanKisha Team' }],
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    url: process.env.NEXT_PUBLIC_BASE_URL || 'https://bankisha.com',
    siteName: 'BanKisha',
    title: 'BanKisha - 企業インタビュープラットフォーム',
    description: '企業へのインタビューが簡単にできるウェブアプリ',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
推定値>
        <AuthProvider>
          <Header />
          <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900">
            {children}
          </main>
          <Footer />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
