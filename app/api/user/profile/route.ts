import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { updateUser } from '@/src/lib/firestore'
import * as admin from 'firebase-admin'
import { initializeFirebaseAdmin } from '@/src/lib/firebase-admin'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    await initializeFirebaseAdmin()
    const db = admin.firestore()
    const userDoc = await db.collection('users').doc(userId).get()

    if (!userDoc.exists) {
      // ユーザーが存在しない場合は基本情報を返す（新規登録直後の状態）
      return NextResponse.json({
        uid: userId,
        role: 'user'
      })
    }

    const userData = userDoc.data()
    return NextResponse.json({
      uid: userId,
      ...userData,
      // TimestampをISO文字列に変換（クライアントに送るため）
      createdAt: userData?.createdAt?.toDate ? userData.createdAt.toDate().toISOString() : userData?.createdAt,
      updatedAt: userData?.updatedAt?.toDate ? userData.updatedAt.toDate().toISOString() : userData?.updatedAt,
    })
  } catch (error) {
    console.error('Error fetching profile:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await request.json()
    const { displayName, bio, photoURL } = body

    const updateData: { [key: string]: any } = {}
    if (displayName) updateData.displayName = displayName
    if (bio) updateData.bio = bio
    if (photoURL) updateData.photoURL = photoURL

    if (Object.keys(updateData).length === 0) {
      return new NextResponse('No fields to update', { status: 400 })
    }

    await updateUser(userId, updateData)

    return NextResponse.json({ success: true, message: 'Profile updated successfully' })
  } catch (error) {
    console.error('Error updating profile:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
