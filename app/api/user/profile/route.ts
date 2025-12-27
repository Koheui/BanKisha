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

    const debugInfo = {
      userId,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'undefined',
      exists: userDoc.exists,
      envHasKey: !!process.env.FIREBASE_PRIVATE_KEY,
      envHasEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      envProjectId: process.env.FIREBASE_PROJECT_ID || 'undefined',
    }

    if (!userDoc.exists) {
      return NextResponse.json({
        uid: userId,
        role: 'user',
        _debug: debugInfo
      })
    }

    const userData = userDoc.data() || {}
    const companyId = userData.companyId || userData.companyID

    return NextResponse.json({
      uid: userId,
      ...userData,
      companyId, // Ensure lowercase companyId is present
      _debug: debugInfo,
      createdAt: userData?.createdAt?.toDate ? userData.createdAt.toDate().toISOString() : userData?.createdAt,
      updatedAt: userData?.updatedAt?.toDate ? userData.updatedAt.toDate().toISOString() : userData?.updatedAt,
    })
  } catch (error: any) {
    console.error('❌ [GET /api/user/profile] Error:', error.message)
    return NextResponse.json({
      error: 'Internal Server Error',
      message: error.message,
    }, { status: 500 })
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
  } catch (error: any) {
    console.error('❌ [POST /api/user/profile] Error:', error.message)
    return NextResponse.json({
      error: 'Internal Server Error',
      message: error.message,
    }, { status: 500 })
  }
}
