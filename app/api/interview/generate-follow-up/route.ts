import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as admin from 'firebase-admin'
import { initializeFirebaseAdmin } from '@/src/lib/firebase-admin'

// Initialize Firebase Admin SDK
initializeFirebaseAdmin()

const adminDb = admin.firestore()

export async function POST(request: NextRequest) {
  try {
    const { question, userResponse, interviewObjective, interviewerPrompt, knowledgeBaseIds, conversationHistory, needsMoreInfo, suggestedAngle } = await request.json()

    if (!question || !userResponse) {
      return NextResponse.json(
        { error: '質問と回答が必要です' },
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    // スキルナレッジベースから質問設計のベストプラクティスを取得
    let skillKnowledgeContext = ''
    if (knowledgeBaseIds && knowledgeBaseIds.length > 0 && adminDb) {
      try {
        const skillKBDocs = await Promise.all(
          knowledgeBaseIds.map(async (kbId: string) => {
            const kbDoc = await adminDb.collection('knowledgeBases').doc(kbId).get()
            if (kbDoc.exists) {
              const kbData = kbDoc.data()
              const isSkillKB = kbData?.type === 'skill' || 
                               kbData?.fileName?.toLowerCase().includes('skill') || 
                               kbData?.fileName?.toLowerCase().includes('スキル')
              
              if (!isSkillKB) return null
              
              // スキルナレッジベースのchunksを取得
              let chunksText = ''
              try {
                const chunksSnapshot = await adminDb
                  .collection('knowledgeBases')
                  .doc(kbId)
                  .collection('chunks')
                  .limit(30)
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
        
        const validSkillKBs = skillKBDocs.filter(kb => kb !== null)
        if (validSkillKBs.length > 0) {
          skillKnowledgeContext = validSkillKBs.map(kb => {
            let context = `【${kb?.fileName}】\n概要: ${kb?.summary}\n活用方法: ${kb?.usageGuide}`
            if (kb?.chunks && kb.chunks.length > 0) {
              context += `\n\n【質問設計・対話設計のベストプラクティス】\n${kb.chunks.substring(0, 5000)}`
            }
            return context
          }).join('\n\n')
          
          console.log('📚 スキルナレッジベースコンテキスト:', {
            スキルナレッジベース数: validSkillKBs.length,
            コンテキスト長: skillKnowledgeContext.length
          })
        }
      } catch (kbError) {
        console.warn('⚠️ Error loading skill knowledge bases:', kbError)
      }
    }

    // 会話履歴をフォーマット
    let conversationContext = ''
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContext = '\n【これまでの会話履歴】\n'
      conversationHistory.forEach((msg: any, index: number) => {
        if (msg.role === 'interviewer') {
          conversationContext += `質問${index + 1}: ${msg.content}\n`
        } else if (msg.role === 'interviewee' || msg.role === 'user') {
          conversationContext += `回答${index + 1}: ${msg.content}\n`
        }
      })
      conversationContext += '\n【重要】既に聞いた質問と同じ内容や類似した質問は絶対に生成しないでください。\n'
    }

    const prompt = `あなたは経験豊富なプロのインタビュアーです。ユーザーの回答を分析して、次の質問を1つ生成してください。

【インタビューの目的】
${interviewObjective || '一般的なインタビュー'}

${interviewerPrompt ? `【インタビュアーの特徴・口調】\n${interviewerPrompt}\n` : ''}
${skillKnowledgeContext ? `【重要：質問設計・対話設計のベストプラクティス（スキルナレッジベース）】\n${skillKnowledgeContext}\n\nこのスキルナレッジベースには、効果的なフォローアップ質問の作り方、対話の流れの設計方法、相手が話しやすい質問のテクニックなどが含まれています。**必ずこの内容を参考にして質問を生成してください。**\n` : ''}
${conversationContext}
【前の質問】
${question}

【ユーザーの回答】
${userResponse}

【指示】
1. ユーザーの回答を分析し、興味深い点や深掘りできるポイントを見つけてください
${needsMoreInfo ? `2. **重要：回答が表面的で記事が書けるほどの情報が得られていません。以下の角度から別の質問を生成してください：**
   - ${suggestedAngle || '具体的な事例や数字、エピソードを求める角度'}
   - 前の質問とは異なる視点や角度から質問してください
   - より深い情報や具体的な内容を引き出す質問にしてください` : '2. 回答に基づいて、自然な流れで次の質問を1つ生成してください'}
3. 回答に基づいて、自然な流れで次の質問を1つ生成してください
4. 1つの質問は1つのトピックに絞ってください（複数の質問を1つにまとめない）
5. 回答の内容に合わせて、具体的で深掘りできる質問にしてください
6. 自然な会話形式で、親しみやすい表現を使用してください
7. **既に聞いた質問と同じ内容や類似した質問は絶対に生成しないでください**
8. 会話履歴を確認し、新しい視点や角度から質問を生成してください
9. ユーザーの回答に対して相槌を打ったり、共感を示したりしながら、自然に話を広げる質問をしてください
${skillKnowledgeContext ? `10. **スキルナレッジベースに記載されている質問のテクニックや対話設計の方法を必ず活用してください**
11. スキルナレッジベースに記載されている質問の例やパターンを参考にしてください` : ''}

【出力形式】
説明文や前置きは一切含めず、質問文のみを出力してください。
**重要：自然で理解しやすい会話形式にしてください**
- 不自然な間投詞（「えー」「あー」など）は避け、自然な話し言葉で質問してください
- 例：「それでは、具体的には...」「そうですね、その点について...」「もう少し詳しく...」

出力例：
具体的な事例を教えていただけますか？

または

その点について、もう少し詳しく聞かせていただけますか？`

    const result = await model.generateContent(prompt)
    const response = await result.response
    let followUpQuestion = response.text().trim()

    // 説明文や前置きを除去
    const lines = followUpQuestion.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('【') && !trimmed.includes('出力例')) {
        followUpQuestion = trimmed
        break
      }
    }

    return NextResponse.json({
      question: followUpQuestion,
      success: true,
    })
  } catch (error) {
    console.error('❌ Error generating follow-up question:', error)
    return NextResponse.json(
      { 
        error: '追加質問の生成に失敗しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

