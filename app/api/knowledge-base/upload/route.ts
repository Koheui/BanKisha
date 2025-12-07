import { NextRequest, NextResponse } from 'next/server'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { storage, db } from '@/src/lib/firebase'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const description = formData.get('description') as string

    if (!file) {
      return NextResponse.json(
        { error: 'ファイルが必要です' },
        { status: 400 }
      )
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'PDFファイルのみアップロードできます' },
        { status: 400 }
      )
    }

    // Upload PDF to Storage
    const storageRef = ref(storage, `knowledge-bases/${Date.now()}-${file.name}`)
    const fileBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(fileBuffer)
    await uploadBytes(storageRef, uint8Array, {
      contentType: 'application/pdf'
    })

    const pdfUrl = await getDownloadURL(storageRef)

    // Create knowledge base document
    const knowledgeBaseRef = await addDoc(collection(db, 'knowledgeBases'), {
      title: title || file.name,
      description: description || '',
      pdfUrl,
      fileSize: file.size,
      pageCount: 0,
      status: 'processing',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    // Trigger PDF processing
    const functionUrl = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL || 'http://localhost:5001'
    await fetch(`${functionUrl}/processKnowledgeBasePDF`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pdfUrl,
        knowledgeBaseId: knowledgeBaseRef.id,
        title: title || file.name
      }),
    })

    return NextResponse.json({
      success: true,
      id: knowledgeBaseRef.id,
      message: 'PDFのアップロードが完了しました。処理中です...'
    })
  } catch (error) {
    console.error('Error uploading PDF:', error)
    return NextResponse.json(
      { error: 'PDFのアップロードに失敗しました' },
      { status: 500 }
    )
  }
}
