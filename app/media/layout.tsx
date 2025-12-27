import { ReactNode } from 'react'
import { MediaHeader } from '@/components/layout/MediaHeader'
import { MediaFooter } from '@/components/layout/MediaFooter'

export default function MediaLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-text-dark dark:text-text-light flex flex-col font-display antialiased">
      <MediaHeader />
      <main className="flex-grow">{children}</main>
      <MediaFooter />
    </div>
  )
}
