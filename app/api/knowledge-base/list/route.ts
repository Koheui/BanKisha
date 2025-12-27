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
        const type = searchParams.get('type') // 'skill' or 'user'

        await initializeFirebaseAdmin()
        const db = admin.firestore()

        // Check user role
        const userDoc = await db.collection('users').doc(userId).get()
        const userData = userDoc.data()
        const userRole = userData?.role

        let q: admin.firestore.Query = db.collection('knowledgeBases')

        if (type === 'skill') {
            // Skill KB is superAdmin only or authorized users?
            // Usually, everyone can READ skill KB for their interviews, but only superAdmin can LIST them in admin panel
            if (userRole !== 'superAdmin') {
                return new NextResponse('Forbidden', { status: 403 })
            }
            q = q.where('type', '==', 'skill')
        } else if (type === 'user') {
            // User KB is private to the uploader
            q = q.where('type', '==', 'user').where('uploadedBy', '==', userId)
        } else {
            return new NextResponse('Invalid type', { status: 400 })
        }

        const snapshot = await q.orderBy('createdAt', 'desc').get()
        const list = snapshot.docs
            .map(doc => {
                const data = doc.data()
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
                    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt,
                    deletedAt: data.deletedAt?.toDate ? data.deletedAt.toDate().toISOString() : data.deletedAt,
                }
            })
            .filter((kb: any) => !kb.deleted)

        return NextResponse.json(list)
    } catch (error: any) {
        console.error('❌ [API Knowledge Base List GET] Error:', error.message)
        return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 })
    }
}
