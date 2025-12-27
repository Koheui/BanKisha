import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ClerkProvider } from "@clerk/nextjs";
import { AuthProvider } from '@/components/auth/AuthProvider'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { LayoutContent } from '@/components/layout/LayoutContent'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BanKisha - AI Interview Platform',
  description: 'AI-powered interview and article generation',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <AuthProvider>
        <html lang="ja" suppressHydrationWarning>
          <body className={inter.className} suppressHydrationWarning>
            <LayoutContent>{children}</LayoutContent>
            <Toaster />
          </body>
        </html>
      </AuthProvider>
    </ClerkProvider>
  )
}