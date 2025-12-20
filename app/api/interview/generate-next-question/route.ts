import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as admin from 'firebase-admin'
import { initializeFirebaseAdmin } from '@/src/lib/firebase-admin'

// Initialize Firebase Admin SDK
initializeFirebaseAdmin()

const adminDb = admin.firestore()

export async function POST(request: NextRequest) {
  try {
    const { 
      conversationHistory, 
      remainingQuestions, 
      interviewPurpose, 
      targetAudience, 
      mediaType, 
      objective,
      knowledgeBaseIds,
      intervieweeName,
      intervieweeCompany,
      intervieweeTitle,
      intervieweeDepartment,
      intervieweeType,
      confirmNameAtInterview,
      confirmCompanyAtInterview,
      confirmTitleAtInterview,
      confirmDepartmentAtInterview
    } = await request.json()

    if (!conversationHistory || !Array.isArray(conversationHistory)) {
      return NextResponse.json(
        { error: '会話履歴が必要です' },
        { status: 400 }
      )
    }

    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: 'Gemini API Keyが設定されていません' },
        { status: 500 }
      )
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey)

    // スキルナレッジベースから対話手法の情報を取得
    let skillKnowledgeContext = ''
    if (knowledgeBaseIds && knowledgeBaseIds.length > 0 && adminDb) {
      try {
        const kbDocs = await Promise.all(
          knowledgeBaseIds.map(async (kbId: string) => {
            const kbDoc = await adminDb.collection('knowledgeBases').doc(kbId).get()
            if (kbDoc.exists) {
              const kbData = kbDoc.data()
              const isSkillKB = kbData?.type === 'skill' || 
                               kbData?.fileName?.toLowerCase().includes('skill') || 
                               kbData?.fileName?.toLowerCase().includes('スキル')
              
              // 編集時のみ使用のスキルは除外（インタビュー質問生成では使用しない）
              if (!isSkillKB || kbData?.isEditOnly) return null
              
              let chunksText = ''
              try {
                const chunksSnapshot = await adminDb
                  .collection('knowledgeBases')
                  .doc(kbId)
                  .collection('chunks')
                  .limit(50)
                  .get()
                
                if (!chunksSnapshot.empty) {
                  chunksText = chunksSnapshot.docs
                    .map(doc => doc.data().text || '')
                    .filter(text => text.length > 0)
                    .join('\n\n')
                }
              } catch (chunksError) {
                console.warn('⚠️ Error loading chunks:', chunksError)
              }
              
              return {
                summary: kbData?.summary || '',
                usageGuide: kbData?.usageGuide || '',
                fileName: kbData?.fileName || '',
                chunks: chunksText,
              }
            }
            return null
          })
        )
        
        const skillKBs = kbDocs.filter(kb => kb !== null)
        
        if (skillKBs.length > 0) {
          skillKnowledgeContext = skillKBs.map(kb => {
            let context = `【${kb?.fileName}】\n概要: ${kb?.summary}\n活用方法: ${kb?.usageGuide}`
            if (kb?.chunks && kb.chunks.length > 0) {
              context += `\n\n【対話設計・質問設計のベストプラクティス】\n${kb.chunks.substring(0, 10000)}`
            }
            return context
          }).join('\n\n')
        }
      } catch (kbError) {
        console.warn('⚠️ Error loading knowledge bases:', kbError)
      }
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.8, // より創造的な対話のため少し高め
        maxOutputTokens: 500, // 完全な質問文を生成するために増加
      },
    })

    // 会話履歴をテキスト形式に変換
    const conversationText = conversationHistory
      .map((msg: any) => {
        if (msg.role === 'interviewer') {
          return `インタビュアー: ${msg.content}`
        } else if (msg.role === 'interviewee') {
          return `回答者: ${msg.content}`
        }
        return ''
      })
      .filter((text: string) => text.length > 0)
      .join('\n')

    // 残りの質問リストをテキスト形式に変換
    const remainingQuestionsText = remainingQuestions && remainingQuestions.length > 0
      ? remainingQuestions.map((q: any, idx: number) => `${idx + 1}. ${typeof q === 'string' ? q : q.text || ''}`).join('\n')
      : 'なし'

    // 会話履歴が空の場合（最初の質問）で、確認が必要な場合は確認する質問を生成
    const isFirstQuestion = conversationHistory.length === 0 || 
      (conversationHistory.length === 1 && conversationHistory[0].role === 'interviewer')
    
    let confirmationContext = ''
    if (isFirstQuestion) {
      // 確認が必要な項目を収集
      const needsConfirmation: string[] = []
      const confirmedParts: string[] = []
      
      // 名前の確認
      if (confirmNameAtInterview) {
        needsConfirmation.push('お名前')
      } else if (intervieweeName) {
        confirmedParts.push(intervieweeName)
      }
      
      // 会社名の確認（企業・団体の場合のみ）
      if (intervieweeType === 'company') {
        if (confirmCompanyAtInterview) {
          needsConfirmation.push('会社名・団体名')
        } else if (intervieweeCompany) {
          confirmedParts.push(intervieweeCompany)
        }
        
        // 部署名の確認
        if (confirmDepartmentAtInterview) {
          needsConfirmation.push('部署名')
        } else if (intervieweeDepartment) {
          confirmedParts.push(intervieweeDepartment)
        }
        
        // 役職名の確認
        if (confirmTitleAtInterview) {
          needsConfirmation.push('役職名')
        } else if (intervieweeTitle) {
          confirmedParts.push(intervieweeTitle)
        }
      }
      
      // 確認が必要な項目がある場合
      if (needsConfirmation.length > 0) {
        const needsConfirmationText = needsConfirmation.join('・')
        confirmationContext = `【重要】最初の質問として、先方の情報を確認してください。\n\n「念の為、確認させていただきたいのですが、${needsConfirmationText}を教えていただけますか？もし補足がありましたら、お願いします。」\n\nこの確認の後、自然にインタビューを進めてください。`
      }
      // 確認が必要な項目がなく、情報が入力されている場合は、その情報を確認
      else if (confirmedParts.length > 0) {
        if (intervieweeType === 'company' && intervieweeCompany) {
          const companyPart = intervieweeCompany
          const departmentPart = intervieweeDepartment ? `${intervieweeDepartment}の` : ''
          const titlePart = intervieweeTitle ? `${intervieweeTitle}の` : ''
          const namePart = intervieweeName
          confirmationContext = `【重要】最初の質問として、以下の形式で確認してください。\n\n「念の為、確認させていただきたいのですが、${companyPart}の${departmentPart}${titlePart}${namePart}さんで間違いございませんか？もし補足がありましたら、お願いします。」\n\nこの確認の後、自然にインタビューを進めてください。`
        } else if (intervieweeType === 'individual' && intervieweeName) {
          const titlePart = intervieweeTitle ? `${intervieweeTitle}の` : ''
          confirmationContext = `【重要】最初の質問として、以下の形式で確認してください。\n\n「念の為、確認させていただきたいのですが、${titlePart}${intervieweeName}さんで間違いございませんか？もし補足がありましたら、お願いします。」\n\nこの確認の後、自然にインタビューを進めてください。`
        }
      }
    }

    const prompt = `${skillKnowledgeContext ? `【最重要：思考の起点 - 対話設計・質問設計のベストプラクティス（スキルナレッジベース）】\n${skillKnowledgeContext}\n\n**⚠️ 最重要**: 上記のスキルナレッジベースは、対話設計における思考の起点です。**必ず最初にこの内容を参照し、その原則と手法に基づいて次の質問を生成してください。** このスキルナレッジベースに記載されている効果的な対話の作り方、質問のタイミング、相手が話しやすい質問のテクニックを**必ず実践**してください。\n\n` : ''}あなたは経験豊富なプロのインタビュアーです。会話の流れに基づいて、自然で効果的な次の質問を生成してください。

【重要な原則】
${skillKnowledgeContext ? `0. **最重要：スキルナレッジベースを思考の起点として活用**: 上記のスキルナレッジベースに記載されている対話設計の原則と手法を**必ず最初に参照**し、それに基づいて次の質問を生成してください。スキルナレッジベースの内容を無視したり、軽視したりしないでください。\n` : ''}1. **対話を中心に組み立てる**: 質問リストの順序に拘らず、会話の流れを最優先する
2. **自然な流れを重視**: 直前の回答に基づいて、自然に次の質問に繋げる
3. **深掘りを意識**: 表面的な情報だけでなく、感情や背景、具体例を引き出す
4. **相手が話しやすい質問**: 相手が答えやすく、会話が続くような質問を選ぶ
5. **質問リストは参考程度**: 残りの質問リストは参考にしつつ、会話の流れに合わせて調整する
6. **似た質問を避ける**: 既に十分な回答が得られているトピックについては、似たような質問を避ける
7. **複数のトピックから情報を集める**: 一問一答ではなく、いろいろな事柄から個別の質問の回答率を少しずつ満たしていく

${confirmationContext ? `${confirmationContext}\n\n` : ''}【これまでの会話履歴】
${conversationText || '（まだ会話が始まっていません）'}

【残りの質問リスト（参考）】
${remainingQuestionsText}

【インタビューの目的】
${interviewPurpose || '未指定'}

【ターゲット読者】
${targetAudience || '未指定'}

【掲載メディア】
${mediaType || '未指定'}

【具体的な質問内容（参考）】
${objective || '未指定'}

【指示】
${skillKnowledgeContext ? `**最重要**: 上記のスキルナレッジベースを思考の起点として、以下の条件を満たす次の質問を1つ生成してください。スキルナレッジベースに記載されている対話設計の原則と手法を**必ず最初に参照**し、それに基づいて質問を生成してください。\n\n` : ''}上記の会話履歴${skillKnowledgeContext ? 'とスキルナレッジベース' : ''}を参考に、以下の条件を満たす次の質問を1つ生成してください：

${skillKnowledgeContext ? `0. **スキルナレッジベースを思考の起点として活用**: 上記のスキルナレッジベースに記載されている対話設計の原則と手法を**必ず最初に参照**し、それに基づいて質問を生成してください。スキルナレッジベースの内容を無視したり、軽視したりしないでください。\n` : ''}1. **会話の流れに自然に繋がる質問**: 直前の回答を受けて、自然に次の話題に進む
2. **深掘りできる質問**: 表面的な情報だけでなく、感情、背景、具体例を引き出す
3. **相手が話しやすい質問**: 開かれた質問（5W1H）を意識し、相手が自由に答えられる
4. **残りの質問リストとの整合性**: 残りの質問リストを参考にしつつ、会話の流れに合わせて調整
${skillKnowledgeContext ? `5. **スキルナレッジベースの手法を実践**: 上記のスキルナレッジベースに記載されている対話設計のベストプラクティスを**必ず実践**してください。これらは思考の起点であり、質問生成の基盤です。\n` : ''}6. **似た質問を避ける**: 会話履歴を確認し、既に十分な回答が得られているトピックについては、似たような質問を生成しない
7. **多角的に情報を集める**: 一問一答ではなく、いろいろな事柄から情報を集め、各質問の回答率を少しずつ満たしていくアプローチを取る
8. **新しいトピックを導入**: 既に聞いたことと似た質問ではなく、新しい角度やトピックから質問する

【出力形式】
説明文や前置きは一切含めず、質問文のみを出力してください。
質問は自然な会話形式で、1-2文で簡潔にしてください。
**重要：必ず完全な質問文を生成してください**
- 「念の為、確認させていただきたいのですが、」のような前振りだけで終わらず、必ず質問の内容まで含めてください
- 例（NG）：「念の為、確認させていただきたいのですが、」→ これは不完全です
- 例（OK）：「念の為、確認させていただきたいのですが、お名前を教えていただけますか？」→ これは完全な質問です
- 確認の質問の場合も、必ず「〜を教えていただけますか？」「〜で間違いございませんか？」などの完全な質問文を生成してください
- **質問文は必ず最後まで完成させてください。途中で終わらないでください。**

出力例：
本日はお時間をいただき、ありがとうございます。まず、簡単に自己紹介をいただけますか？

そのプロジェクトを始めるきっかけとなった、具体的な出来事や体験があれば教えていただけますか？

その経験から学んだことは何でしょうか？それが今の活動にどう活かされていますか？`

    const result = await model.generateContent(prompt)
    const response = await result.response
    let nextQuestion = response.text().trim()

    // デバッグログ：生成されたテキスト全体を確認
    console.log('📝 生成された質問テキスト（処理前）:', {
      length: nextQuestion.length,
      text: nextQuestion,
      first100: nextQuestion.substring(0, 100),
      last100: nextQuestion.substring(Math.max(0, nextQuestion.length - 100))
    })

    // 説明文や前置きを除去
    const lines = nextQuestion.split('\n')
    const validLines: string[] = []
    let foundFirstValidLine = false
    
    for (const line of lines) {
      const trimmed = line.trim()
      // 空行や説明文をスキップ
      if (trimmed.length === 0 || trimmed.startsWith('例：') || trimmed.startsWith('出力例：') || trimmed.startsWith('【')) {
        // 既に有効な行が見つかっている場合は、説明文が再び現れたので終了
        if (foundFirstValidLine) {
          break
        }
        continue
      }
      
      // 最初の有効な行を見つけたら、それ以降の行も含める
      if (trimmed.length > 0) {
        foundFirstValidLine = true
        validLines.push(trimmed)
      }
    }
    
    // 有効な行を結合（複数行の質問に対応）
    if (validLines.length > 0) {
      nextQuestion = validLines.join(' ').trim()
    } else {
      // 有効な行が見つからない場合は、元のテキストから説明文を除去
      const fallbackLines = lines.filter(line => {
        const trimmed = line.trim()
        return trimmed.length > 0 && !trimmed.startsWith('例：') && !trimmed.startsWith('出力例：') && !trimmed.startsWith('【')
      })
      if (fallbackLines.length > 0) {
        nextQuestion = fallbackLines.join(' ').trim()
      }
    }

    // デバッグログ：処理後のテキストを確認
    console.log('✅ 処理後の質問テキスト:', {
      length: nextQuestion.length,
      text: nextQuestion,
      first100: nextQuestion.substring(0, 100),
      last100: nextQuestion.substring(Math.max(0, nextQuestion.length - 100)),
      endsWithQuestionMark: nextQuestion.endsWith('？') || nextQuestion.endsWith('?'),
      endsWithPeriod: nextQuestion.endsWith('。') || nextQuestion.endsWith('.')
    })

    // 質問が不完全な場合（「念の為、確認させていただきたいのですが、」で終わっているなど）を検出
    if (nextQuestion.endsWith('、') || nextQuestion.endsWith(',')) {
      console.warn('⚠️ 質問が途中で終わっている可能性があります:', nextQuestion)
      // 不完全な質問の場合は、プロンプトを再生成するか、エラーを返す
      // ここでは警告のみを出し、そのまま返す（クライアント側で処理）
    }

    return NextResponse.json({
      question: nextQuestion,
      success: true,
    })
  } catch (error) {
    console.error('❌ Error generating next question:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { 
        error: '次の質問の生成に失敗しました', 
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}

