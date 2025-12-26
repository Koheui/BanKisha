import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import { initializeFirebaseAdmin } from '@/src/lib/firebase-admin'

// Initialize Firebase Admin SDK
export async function POST(request: NextRequest) {
  try {
    await initializeFirebaseAdmin()
    console.log('🔄 [Restore API] Starting...')
    const { knowledgeBaseId, contentType, version } = await request.json()
    console.log('📥 Request params:', { knowledgeBaseId, contentType, version })

    if (!knowledgeBaseId || !contentType || version === undefined) {
      console.error('❌ Missing parameters')
      return NextResponse.json(
        { error: 'パラメータが不足しています' },
        { status: 400 }
      )
    }

    // Get knowledge base data
    console.log('📖 Fetching KB from Firestore...')
    const kbRef = admin.firestore().collection('knowledgeBases').doc(knowledgeBaseId)
    const kbDoc = await kbRef.get()

    if (!kbDoc.exists) {
      console.error('❌ KB not found:', knowledgeBaseId)
      return NextResponse.json(
        { error: 'ナレッジベースが見つかりません' },
        { status: 404 }
      )
    }

    const kbData = kbDoc.data()
    const historyField = contentType === 'summary' ? 'summaryHistory' : 'usageGuideHistory'
    const contentField = contentType === 'summary' ? 'summary' : 'usageGuide'
    const history = kbData?.[historyField] || []

    // Find the version to restore
    const versionToRestore = history.find((v: any) => v.version === version)

    if (!versionToRestore) {
      console.error('❌ Version not found:', version)
      return NextResponse.json(
        { error: '指定されたバージョンが見つかりません' },
        { status: 404 }
      )
    }

    console.log('✅ Version found, restoring...')

    // Save current content to history before restoring
    const currentContent = kbData?.[contentField] || ''
    const newVersion = {
      version: history.length + 1,
      content: currentContent,
      feedback: `v${version}に復元`,
      feedbackType: 'modify',
      createdAt: new Date(),
      createdBy: 'restore-action',
    }

    // Restore the old version
    await kbRef.update({
      [contentField]: versionToRestore.content,
      [historyField]: admin.firestore.FieldValue.arrayUnion(newVersion),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })

    console.log('🎉 Restore complete!')
    return NextResponse.json({
      success: true,
      restoredContent: versionToRestore.content,
    })
  } catch (error) {
    console.error('❌ Error restoring content:', error)
    const errorMessage = error instanceof Error ? error.message : '復元に失敗しました'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

