import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as admin from 'firebase-admin'
import { initializeFirebaseAdmin } from '@/src/lib/firebase-admin'

// Initialize Firebase Admin SDK
export async function POST(request: NextRequest) {
  try {
    await initializeFirebaseAdmin()
    const db = admin.firestore()
    console.log('📥 [API] Received knowledge base create request')

    // 認証チェック
    const { userId } = await auth()
    if (!userId) {
      console.error('❌ [API] No authorization header or session')
      return NextResponse.json(
        { error: '認証が必要です' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { type, fileName, fileSize, storageUrl, storagePath } = body

    console.log('📝 [API] Request data:', { type, fileName, fileSize, storageUrl })

    // Validate knowledge type
    if (!['skill', 'info', 'user'].includes(type)) {
      return NextResponse.json(
        { error: '無効なナレッジタイプです' },
        { status: 400 }
      )
    }

    // Check permissions: only superAdmin can upload skill/info
    if (type === 'skill' || type === 'info') {
      const userDoc = await db.collection('users').doc(userId).get()
      const userData = userDoc.data()

      if (!userData || userData.role !== 'superAdmin') {
        console.error('❌ [API] Permission denied: user is not superAdmin')
        return NextResponse.json(
          { error: 'スキル/情報ナレッジベースのアップロードにはsuperAdmin権限が必要です' },
          { status: 403 }
        )
      }
    }

    // Create knowledge base document in Firestore
    const knowledgeBaseData: any = {
      type,
      fileName,
      fileSize,
      storageUrl,
      storagePath,
      uploadedBy: userId,
      status: 'processing',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }

    console.log('💾 [API] Creating Firestore document...')

    try {
      const docRef = await db.collection('knowledgeBases').add(knowledgeBaseData)
      console.log('✅ [API] Firestore document created:', docRef.id)

      // Trigger Firebase Function for PDF processing
      const functionUrl = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL ||
        'https://us-central1-bankisha-654d0.cloudfunctions.net'
      const processUrl = `${functionUrl}/processKnowledgeBasePDF`

      console.log('📤 [API] Triggering Firebase Function:', processUrl)

      try {
        const functionResponse = await fetch(processUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            pdfUrl: storageUrl,
            knowledgeBaseId: docRef.id,
            fileName
          })
        })

        if (!functionResponse.ok) {
          console.warn('⚠️ [API] Function trigger failed:', await functionResponse.text())
          // Don't fail the request, the function will be triggered by Firestore trigger
        } else {
          console.log('✅ [API] Function triggered successfully')
        }
      } catch (functionError) {
        console.warn('⚠️ [API] Function trigger error:', functionError)
        // Continue - the function will be triggered by Firestore trigger
      }

      return NextResponse.json({
        success: true,
        knowledgeBaseId: docRef.id,
        message: 'ナレッジベースが作成されました。処理を開始します。'
      })
    } catch (firestoreError: any) {
      console.error('❌ [API] Firestore error:', firestoreError)
      return NextResponse.json(
        { error: `ナレッジベースの作成に失敗しました: Firestore書き込みエラー: ${firestoreError.message}` },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('❌ [API] Unexpected error:', error)
    return NextResponse.json(
      { error: `予期しないエラーが発生しました: ${error.message}` },
      { status: 500 }
    )
  }
}

