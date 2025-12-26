import { NextRequest, NextResponse } from 'next/server'
import * as admin from 'firebase-admin'
import { GoogleGenerativeAI } from '@google/generative-ai'

import { initializeFirebaseAdmin } from '@/src/lib/firebase-admin'

export async function POST(request: NextRequest) {
  try {
    await initializeFirebaseAdmin()
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    console.log('🔄 [Regenerate API] Starting...')
    const { knowledgeBaseId, contentType, feedback, feedbackMode, isEditOnly } = await request.json()
    console.log('📥 Request params:', { knowledgeBaseId, contentType, feedbackMode, feedbackLength: feedback?.length })

    if (!knowledgeBaseId || !contentType || !feedback || !feedbackMode) {
      console.error('❌ Missing parameters')
      return NextResponse.json(
        { error: 'パラメータが不足しています' },
        { status: 400 }
      )
    }

    // Get Authorization header
    const authHeader = request.headers.get('Authorization')
    const userId = authHeader ? 'user-from-token' : 'anonymous' // TODO: Extract from JWT

    // Check Gemini API Key
    if (!process.env.GEMINI_API_KEY) {
      console.error('❌ GEMINI_API_KEY not found')
      return NextResponse.json(
        { error: 'Gemini API Keyが設定されていません' },
        { status: 500 }
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
    const currentSummary = kbData?.summary || ''
    const currentUsageGuide = kbData?.usageGuide || ''
    const fileName = kbData?.fileName || '無題'
    console.log('✅ KB found:', fileName)

    // Initialize Gemini model
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
      },
    })

    let newText = ''
    let currentContent = ''
    let historyField = ''

    console.log(`🤖 Calling Gemini API for ${contentType} (mode: ${feedbackMode})...`)

    if (contentType === 'summary') {
      currentContent = currentSummary
      historyField = 'summaryHistory'

      let instruction = ''
      if (feedbackMode === 'add') {
        instruction = `【重要】既存の概要の内容を一切削除せず、そのまま全て残してください。その上で、新しい観点を追加してください。

具体的には：
1. 「現在の概要」に書かれている内容を**そのまま全て**出力に含める
2. その後、フィードバックに基づいて新しい情報を追加する
3. 既存の箇条書きや説明を削除・変更しない`
      } else if (feedbackMode === 'modify') {
        instruction = '以下のフィードバックに基づいて、該当する部分を改善・修正してください。その他の部分は保持してください。'
      } else if (feedbackMode === 'remove') {
        instruction = '以下のフィードバックで指定された内容を削除してください。その他の部分は保持してください。'
      }

      const prompt = `以下のナレッジベース「${fileName}」の概要を改善してください。

【現在の概要（この内容を${feedbackMode === 'add' ? '全て保持' : '基本的に保持'}）】
${currentSummary}

【ユーザーからのフィードバック（${feedbackMode === 'add' ? '追加' : feedbackMode === 'modify' ? '修正' : '削除'}）】
${feedback}

【指示】
${instruction}

【出力フォーマット】
• このナレッジベースの主要なテーマやトピック
• 重要なポイント（3-5個）
• 対象読者や適用シーン

【重要な注意事項】
${feedbackMode === 'add' ? '⚠️ 「現在の概要」の内容を削除・省略せず、必ず全て含めた上で、新しい内容を追加してください。' : ''}`

      const result = await model.generateContent(prompt)
      newText = result.response.text()
      console.log('✅ Summary generated, length:', newText.length)

      // Get current history
      const currentHistory = kbData?.summaryHistory || []
      const newVersion = {
        version: currentHistory.length + 1,
        content: currentSummary,
        feedback: feedback,
        feedbackType: feedbackMode,
        createdAt: new Date(),
        createdBy: userId,
      }

      // Update Firestore
      console.log('💾 Updating Firestore with history...')
      await kbRef.update({
        summary: newText,
        summaryHistory: admin.firestore.FieldValue.arrayUnion(newVersion),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
      console.log('✅ Firestore updated')
    } else if (contentType === 'usageGuide') {
      currentContent = currentUsageGuide
      historyField = 'usageGuideHistory'

      let instruction = ''
      if (feedbackMode === 'add') {
        instruction = `【重要】既存の活用方法を一切削除せず、そのまま全て残してください。その上で、新しい活用シーンを追加してください。

具体的には：
1. 「現在の活用方法」に書かれている内容（番号付きリストやシナリオ）を**そのまま全て**出力に含める
2. その後、フィードバックに基づいて新しい活用シーンを追加する
3. 既存のシナリオや質問例を削除・変更しない`
      } else if (feedbackMode === 'modify') {
        instruction = '以下のフィードバックに基づいて、該当する活用方法を改善・修正してください。その他の部分は保持してください。'
      } else if (feedbackMode === 'remove') {
        instruction = '以下のフィードバックで指定された活用方法を削除してください。その他の部分は保持してください。'
      }

      const prompt = `以下のナレッジベース「${fileName}」の活用方法を改善してください。

【現在の概要】
${currentSummary}

【現在の活用方法（この内容を${feedbackMode === 'add' ? '全て保持' : '基本的に保持'}）】
${currentUsageGuide}

【ユーザーからのフィードバック（${feedbackMode === 'add' ? '追加' : feedbackMode === 'modify' ? '修正' : '削除'}）】
${feedback}

${isEditOnly ? `【重要】このスキルは編集時のみ使用するスキルとして設定されています。インタビュー質問生成では使用せず、記事編集時のみに使用してください。` : ''}

【指示】
${instruction}

【出力要件】
- AIインタビュアーでの具体的な活用方法
- 2-4個の具体的なシナリオや質問例を含める

【重要な注意事項】
${feedbackMode === 'add' ? '⚠️ 「現在の活用方法」に書かれているシナリオ（1. 2. 3. など）を削除・省略せず、必ず全て含めた上で、新しいシナリオを追加してください。' : ''}
${isEditOnly ? '⚠️ このスキルは編集時のみ使用するため、活用方法には記事編集時の活用シーンのみを含めてください。インタビュー質問生成での使用は想定していません。' : ''}`

      const result = await model.generateContent(prompt)
      newText = result.response.text()
      console.log('✅ Usage guide generated, length:', newText.length)

      // Get current history
      const currentHistory = kbData?.usageGuideHistory || []
      const newVersion = {
        version: currentHistory.length + 1,
        content: currentUsageGuide,
        feedback: feedback,
        feedbackType: feedbackMode,
        createdAt: new Date(),
        createdBy: userId,
      }

      // Update Firestore
      console.log('💾 Updating Firestore with history...')
      const updateData: any = {
        usageGuide: newText,
        usageGuideHistory: admin.firestore.FieldValue.arrayUnion(newVersion),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }

      // 編集時のみ使用フラグを更新
      if (isEditOnly !== undefined) {
        updateData.isEditOnly = isEditOnly
        console.log(`📝 isEditOnly set to: ${isEditOnly}`)
      }

      await kbRef.update(updateData)
      console.log('✅ Firestore updated')
    }

    console.log('🎉 Regeneration complete!')
    return NextResponse.json({
      success: true,
      newText,
    })
  } catch (error) {
    console.error('❌ Error regenerating content:', error)
    const errorMessage = error instanceof Error ? error.message : '再生成に失敗しました'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

