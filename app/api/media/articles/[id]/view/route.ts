import { NextRequest, NextResponse } from 'next/server'
import { getFirebaseDb } from '@/src/lib/firebase'
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'Article ID is required' }, { status: 400 })
    }

    const firestoreDb = getFirebaseDb()
    const articleRef = doc(firestoreDb, 'articles', id)

    // 記事の存在確認
    const articleSnap = await getDoc(articleRef)
    if (!articleSnap.exists()) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // 閲覧数をインクリメント
    await updateDoc(articleRef, {
      'engagement.views': increment(1),
    })

    // 更新後のデータを取得
    const updatedSnap = await getDoc(articleRef)
    const views = updatedSnap.data()?.engagement?.views || 0

    return NextResponse.json({ views }, { status: 200 })
  } catch (error: any) {
    console.error('Error incrementing view count:', error)
    return NextResponse.json(
      { error: 'Failed to increment view count' },
      { status: 500 }
    )
  }
}


