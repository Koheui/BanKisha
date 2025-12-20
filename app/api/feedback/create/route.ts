import { NextRequest, NextResponse } from 'next/server'
import { getFirebaseDb } from '@/src/lib/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import type { Feedback, FeedbackType, FeedbackSource } from '@/src/types/feedback'

export async function POST(request: NextRequest) {
  try {
    // 実行時に確実に初期化される
    const firestoreDb = getFirebaseDb()
    const {
      companyId,
      interviewId,
      articleId,
      source,
      type,
      message,
      context,
      createdBy
    } = await request.json()

    if (!companyId || !source || !type || !message || !createdBy) {
      return NextResponse.json(
        { error: '必須パラメータが不足しています' },
        { status: 400 }
      )
    }

    const feedbackData: Omit<Feedback, 'id' | 'createdAt' | 'createdBy'> = {
      companyId,
      interviewId: interviewId || undefined,
      articleId: articleId || undefined,
      source: source as FeedbackSource,
      type: type as FeedbackType,
      message: message.trim(),
      context: context || undefined,
      resolved: false,
    }

    const docRef = await addDoc(collection(firestoreDb, 'feedbacks'), {
      ...feedbackData,
      createdBy,
      createdAt: serverTimestamp(),
    })

    return NextResponse.json({
      success: true,
      feedbackId: docRef.id
    })
  } catch (error) {
    console.error('Error creating feedback:', error)
    return NextResponse.json(
      { error: 'フィードバックの保存に失敗しました' },
      { status: 500 }
    )
  }
}


