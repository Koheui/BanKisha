'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import type { Comment } from '@/src/types'
import { formatDate } from '@/src/lib/utils'
import Link from 'next/link'

interface ArticleCommentsProps {
  articleId: string
}

export const ArticleComments = ({ articleId }: ArticleCommentsProps) => {
  const { user, isSignedIn } = useUser()
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchComments()
  }, [articleId])

  const fetchComments = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/media/articles/${articleId}/comments`)
      if (response.ok) {
        const data = await response.json()
        setComments(data)
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !isSignedIn) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/media/articles/${articleId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment }),
      })

      if (response.ok) {
        const savedComment = await response.json()
        setComments((prev) => [...prev, savedComment])
        setNewComment('')
      } else {
        // Handle error display
        console.error('Failed to submit comment')
      }
    } catch (error) {
      console.error('Error submitting comment:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mt-16">
      <h2 className="text-2xl font-bold font-display mb-6">
        コメント ({comments.length})
      </h2>

      {/* Comment Submission Form */}
      {isSignedIn ? (
        <form onSubmit={handleSubmitComment} className="mb-8">
          <div className="flex items-start gap-4">
            <Image
              src={user?.imageUrl || '/default-avatar.png'}
              alt={user?.fullName || 'You'}
              width={40}
              height={40}
              className="rounded-full"
            />
            <div className="flex-grow">
              <Textarea
                placeholder="コメントを追加..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
                className="mb-2"
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting || !newComment.trim()}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  投稿する
                </Button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="text-center py-6 px-4 border border-dashed rounded-lg">
          <p className="text-muted-light dark:text-muted-dark">
            コメントするには<Link href="/login" className="text-primary hover:underline">ログイン</Link>してください。
          </p>
        </div>
      )}

      {/* Comments List */}
      {isLoading ? (
        <div className="text-center py-8">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-2 text-muted-light">コメントを読み込んでいます...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-4">
              <Image
                src={comment.author.photoURL || '/default-avatar.png'}
                alt={comment.author.displayName}
                width={40}
                height={40}
                className="rounded-full"
              />
              <div className="flex-grow">
                <div className="flex items-baseline gap-2">
                  <p className="font-bold">{comment.author.displayName}</p>
                  <p className="text-xs text-muted-light dark:text-muted-dark">
                    {formatDate(comment.createdAt)}
                  </p>
                </div>
                <p className="text-text-dark dark:text-text-light mt-1">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
