import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as admin from 'firebase-admin'
import { initializeFirebaseAdmin } from '@/src/lib/firebase-admin'

export async function GET(request: Request) {
    try {
        const { userId } = await auth()
        if (!userId) {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const key = searchParams.get('key')
        if (!key) {
            return new NextResponse('Key is required', { status: 400 })
        }

        await initializeFirebaseAdmin()
        const db = admin.firestore()

        // Check user role for superAdmin-only keys
        const userDoc = await db.collection('users').doc(userId).get()
        const userRole = userDoc.data()?.role

        const superAdminOnlyKeys = ['appDirection']
        if (superAdminOnlyKeys.includes(key) && userRole !== 'superAdmin') {
            return new NextResponse('Forbidden', { status: 403 })
        }

        const settingsDoc = await db.collection('systemSettings').doc(key).get()

        return NextResponse.json(settingsDoc.exists ? settingsDoc.data() : {})
    } catch (error: any) {
        console.error('❌ [API System Settings GET] Error:', error.message)
        return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const { userId } = await auth()
        if (!userId) {
            return new NextResponse('Unauthorized', { status: 401 })
        }

        const { key, data } = await request.json()
        if (!key || !data) {
            return new NextResponse('Key and Data are required', { status: 400 })
        }

        await initializeFirebaseAdmin()
        const db = admin.firestore()

        // Check user role (only superAdmin can change system settings)
        const userDoc = await db.collection('users').doc(userId).get()
        const userRole = userDoc.data()?.role

        if (userRole !== 'superAdmin') {
            return new NextResponse('Forbidden', { status: 403 })
        }

        await db.collection('systemSettings').doc(key).set({
            ...data,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: userId
        }, { merge: true })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('❌ [API System Settings POST] Error:', error.message)
        return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 })
    }
}
