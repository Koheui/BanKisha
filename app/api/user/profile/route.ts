import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as admin from 'firebase-admin'
import { initializeFirebaseAdmin } from '@/src/lib/firebase-admin'

export async function GET() {
  console.log('📡 [GET /api/user/profile] Request received')
  try {
    const { userId } = await auth()
    console.log('📡 [GET /api/user/profile] Auth ID:', userId)

    if (!userId) {
      console.warn('📡 [GET /api/user/profile] Unauthorized access attempt')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    console.log('📡 [GET /api/user/profile] Initializing Firebase Admin...')
    await initializeFirebaseAdmin()

    console.log('📡 [GET /api/user/profile] Accessing Firestore for userId:', userId)
    const db = admin.firestore()
    const userDoc = await db.collection('users').doc(userId).get()
    console.log('📡 [GET /api/user/profile] Firestore lookup complete. Exists:', userDoc.exists)

    const debugInfo = {
      userId,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'undefined',
      exists: userDoc.exists,
      envHasKey: !!process.env.FIREBASE_PRIVATE_KEY,
      envHasEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      envProjectId: process.env.FIREBASE_PROJECT_ID || 'undefined',
    }

    if (!userDoc.exists) {
      console.log('📡 [GET /api/user/profile] User document not found, returning basic role: user')
      return NextResponse.json({
        uid: userId,
        role: 'user',
        _debug: debugInfo
      })
    }

    const userData = userDoc.data()
    console.log('📡 [GET /api/user/profile] User data found. Role:', userData?.role)

    return NextResponse.json({
      uid: userId,
      ...userData,
      _debug: debugInfo,
      createdAt: userData?.createdAt?.toDate ? userData.createdAt.toDate().toISOString() : userData?.createdAt,
      updatedAt: userData?.updatedAt?.toDate ? userData.updatedAt.toDate().toISOString() : userData?.updatedAt,
    })
  } catch (error: any) {
    console.error('❌ [GET /api/user/profile] CRITICAL ERROR:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    })
    return NextResponse.json({
      error: 'Internal Server Error',
      message: error.message,
      code: error.code
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  console.log('📡 [POST /api/user/profile] Request received')
  try {
    const { userId } = await auth()
    console.log('📡 [POST /api/user/profile] Auth ID:', userId)

    if (!userId) {
      console.warn('📡 [POST /api/user/profile] Unauthorized access attempt')
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { displayName, bio, photoURL } = await request.json()
    console.log('📡 [POST /api/user/profile] Data to update:', { displayName, bio: bio?.substring(0, 20), hasPhoto: !!photoURL })

    console.log('📡 [POST /api/user/profile] Initializing Firebase Admin...')
    await initializeFirebaseAdmin()

    console.log('📡 [POST /api/user/profile] Updating Firestore for userId:', userId)
    const db = admin.firestore()
    const userRef = db.collection('users').doc(userId)

    const updateData: { [key: string]: any } = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }
    if (displayName) updateData.displayName = displayName
    if (bio) updateData.bio = bio
    if (photoURL) updateData.photoURL = photoURL

    await userRef.set(updateData, { merge: true })
    console.log('📡 [POST /api/user/profile] Profile updated successfully')

    return NextResponse.json({ success: true, message: 'Profile updated successfully' })
  } catch (error: any) {
    console.error('❌ [POST /api/user/profile] CRITICAL ERROR:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    })
    return NextResponse.json({
      error: 'Internal Server Error',
      message: error.message,
      code: error.code
    }, { status: 500 })
  }
}
