import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
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
      return NextResponse.json({
        uid: userId,
        role: 'user'
      })
    }

    const userData = userDoc.data()
    return NextResponse.json({
      uid: userId,
      ...userData,
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

    const { displayName, bio, photoURL } = await request.json()

    await initializeFirebaseAdmin()
    const db = admin.firestore()
    const userRef = db.collection('users').doc(userId)

    const updateData: { [key: string]: any } = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }
    if (displayName) updateData.displayName = displayName
    if (bio) updateData.bio = bio
    if (photoURL) updateData.photoURL = photoURL

    await userRef.set(updateData, { merge: true })

    return NextResponse.json({ success: true, message: 'Profile updated successfully' })
  } catch (error) {
    console.error('Error updating profile:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
