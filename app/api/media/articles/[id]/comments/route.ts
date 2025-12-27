import { NextResponse } from 'next/server'
import { getCommentsForArticle, addComment, getUser } from '@/src/lib/firestore'
import { auth } from '@clerk/nextjs/server'
import type { Comment } from '@/src/types'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: articleId } = await params
    if (!articleId) {
      return new NextResponse('Article ID is required', { status: 400 })
    }

    const comments = await getCommentsForArticle(articleId)
    return NextResponse.json(comments)
  } catch (error) {
    console.error('Error fetching comments:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = auth()
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { id: articleId } = await params
    const { content } = await request.json()

    if (!articleId || !content) {
      return new NextResponse('Article ID and content are required', { status: 400 })
    }

    const user = await getUser(userId)
    if (!user) {
      return new NextResponse('User not found', { status: 404 })
    }

    const newComment: Omit<Comment, 'id' | 'createdAt'> = {
      articleId,
      userId,
      content,
      author: {
        displayName: user.displayName || 'Anonymous',
        photoURL: user.photoURL || '',
      },
    }

    const newCommentId = await addComment(newComment)
    const savedComment = { ...newComment, id: newCommentId, createdAt: new Date() }

    return NextResponse.json(savedComment, { status: 201 })
  } catch (error) {
    console.error('Error adding comment:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
