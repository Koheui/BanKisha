'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  TwitterIcon,
  LinkedinIcon,
  FacebookIcon,
  LinkIcon,
  CheckIcon,
} from 'lucide-react'

interface ShareButtonsProps {
  title: string
  url: string
  description?: string
}

export function ShareButtons({ title, url, description }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  const shareUrl = typeof window !== 'undefined' ? window.location.href : url
  const shareText = description || title

  const handleShare = (platform: string) => {
    const encodedUrl = encodeURIComponent(shareUrl)
    const encodedTitle = encodeURIComponent(title)
    const encodedText = encodeURIComponent(shareText)

    let shareLink = ''

    switch (platform) {
      case 'twitter':
        shareLink = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`
        break
      case 'linkedin':
        shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
        break
      case 'facebook':
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
        break
    }

    if (shareLink) {
      window.open(shareLink, '_blank', 'width=600,height=400')
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 pt-8 border-t border-gray-200 dark:border-gray-700">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        シェア:
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare('twitter')}
        className="flex items-center gap-2"
      >
        <TwitterIcon className="w-4 h-4" />
        Twitter
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare('linkedin')}
        className="flex items-center gap-2"
      >
        <LinkedinIcon className="w-4 h-4" />
        LinkedIn
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleShare('facebook')}
        className="flex items-center gap-2"
      >
        <FacebookIcon className="w-4 h-4" />
        Facebook
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopyLink}
        className="flex items-center gap-2"
      >
        {copied ? (
          <>
            <CheckIcon className="w-4 h-4" />
            コピーしました
          </>
        ) : (
          <>
            <LinkIcon className="w-4 h-4" />
            リンクをコピー
          </>
        )}
      </Button>
    </div>
  )
}


