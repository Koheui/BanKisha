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
      interviewId,
      conversationHistory,
      targetAudience,
      mediaType,
      interviewPurpose,
      objective,
      intervieweeName,
      intervieweeCompany,
      knowledgeBaseIds
    } = await request.json()

    if (!conversationHistory || !Array.isArray(conversationHistory)) {
      return NextResponse.json(
        { error: '会話履歴が必要です' },
        { status: 400 }
      )
    }

    if (!targetAudience || !mediaType) {
      return NextResponse.json(
        { error: 'ターゲット読者と掲載メディアの情報が必要です' },
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

    // スキルナレッジベースから記事制作のベストプラクティスを取得
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
              
              if (!isSkillKB) return null
              
              let chunksText = ''
              try {
                const chunksSnapshot = await adminDb
                  .collection('knowledgeBases')
                  .doc(kbId)
                  .collection('chunks')
                  .limit(100)
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
              context += `\n\n【記事制作のベストプラクティス】\n${kb.chunks.substring(0, 15000)}`
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
        temperature: 0.7,
        maxOutputTokens: 8000, // 敲き生成には十分なトークン数を確保
      },
    })

    // 会話履歴をQA形式に変換
    const qaPairs: Array<{ question: string, answer: string }> = []
    let currentQuestion = ''
    
    conversationHistory.forEach((msg: any) => {
      if (msg.role === 'interviewer') {
        currentQuestion = msg.content
      } else if (msg.role === 'interviewee' && currentQuestion) {
        qaPairs.push({
          question: currentQuestion,
          answer: msg.content
        })
        currentQuestion = ''
      }
    })

    // QAペアをテキスト形式に変換
    const qaText = qaPairs
      .map((qa, idx) => `Q${idx + 1}: ${qa.question}\nA${idx + 1}: ${qa.answer}`)
      .join('\n\n')

    const prompt = `${skillKnowledgeContext ? `【最重要：思考の起点 - 記事制作のベストプラクティス（スキルナレッジベース）】\n${skillKnowledgeContext}\n\n**⚠️ 最重要**: 上記のスキルナレッジベースは、記事制作における思考の起点です。**必ず最初にこの内容を参照し、その原則と手法に基づいて記事の敲きを作成してください。** このスキルナレッジベースに記載されている効果的な記事制作の手法、ターゲット読者に響く書き方、メディア特性に合わせた記事構成の手法を**必ず実践**してください。\n\n` : ''}あなたは経験豊富なビジネス記事ライターです。以下の取材データを基に、記事の「敲き」（下書き/骨組み）を作成してください。

【重要な前提】
- この記事は「${mediaType}」に掲載されます
- ターゲット読者は「${targetAudience}」です
- 取材の目的は「${interviewPurpose}」です
- 取材先: ${intervieweeName}（${intervieweeCompany}）
${skillKnowledgeContext ? `- **最重要**: 上記のスキルナレッジベースに記載されている記事制作の原則と手法を**必ず思考の起点として参照**してください。\n` : ''}

【取材データ（Q&A形式）】
${qaText}

【具体的な質問内容（参考）】
${objective || '未指定'}

【記事の基本構成（必須）】
記事は以下の3つのセクションで構成してください：

1. **現在**: 実際にやっている取組み
   - 現在進行形で取り組んでいる具体的な活動
   - 実際の事例や成果
   - 現在の状況や取り組みの内容

2. **過去**: そうなった経緯や失敗や成功
   - 現在の取り組みに至った経緯
   - 過去の失敗や成功体験
   - 学んだことや気づき

3. **未来**: 現在何を目指して取り組んでいるか、将来の展望
   - 現在の取り組みの目的や目標
   - 将来の展望やビジョン
   - 今後どのように発展させていくか

【敲き（下書き/骨組み）作成の指示】
${skillKnowledgeContext ? `0. **最重要：スキルナレッジベースを思考の起点として活用**: 上記のスキルナレッジベースに記載されている記事制作のベストプラクティス、手法、原則を**必ず最初に参照**し、それに基づいて敲きを作成してください。スキルナレッジベースの内容を無視したり、軽視したりしないでください。\n` : ''}1. **ターゲット読者を意識**: 「${targetAudience}」が興味を持ち、価値を感じる内容にする
2. **メディア特性に合わせる**: 「${mediaType}」の特性（トーン、深さ、形式など）に合わせて構成する
3. **取材目的を達成**: 「${interviewPurpose}」を達成する記事にする
${skillKnowledgeContext ? `4. **スキルナレッジベースの実践**: 上記のスキルナレッジベースに記載されている記事制作の手法、原則、ベストプラクティスを**必ず実践**してください。これらは思考の起点であり、記事制作の基盤です。\n` : ''}5. **現在・過去・未来の構成**: 必ず上記の3つのセクションで構成する

【出力形式】
重要: 以下のJSON形式のみを出力してください。説明文、前置き、コメント、マークダウン記号は一切含めないでください。JSONオブジェクトのみを出力してください。

{
  "explanation": "なぜこういう記事にしたのか？という解説（200-300文字程度）",
  "sections": [
    {
      "section": "現在",
      "heading": "見出し（20-30文字程度）",
      "keyPoints": [
        "要点1（50-100文字程度）",
        "要点2（50-100文字程度）",
        "要点3（50-100文字程度）"
      ],
      "contentOutline": "このセクションで伝える内容の概要（100-200文字程度）"
    },
    {
      "section": "過去",
      "heading": "見出し（20-30文字程度）",
      "keyPoints": [
        "要点1（50-100文字程度）",
        "要点2（50-100文字程度）",
        "要点3（50-100文字程度）"
      ],
      "contentOutline": "このセクションで伝える内容の概要（100-200文字程度）"
    },
    {
      "section": "未来",
      "heading": "見出し（20-30文字程度）",
      "keyPoints": [
        "要点1（50-100文字程度）",
        "要点2（50-100文字程度）",
        "要点3（50-100文字程度）"
      ],
      "contentOutline": "このセクションで伝える内容の概要（100-200文字程度）"
    }
  ]
}

【注意事項】
- JSON形式のみを出力してください。説明文や前置き、マークダウン記号は一切含めないでください。
- 出力は必ず { で始まり } で終わるJSONオブジェクトのみにしてください
- 必ず「現在」「過去」「未来」の3つのセクションを含めてください
- 各セクションには見出し、要点（3-5個）、内容の概要を含めてください
- ターゲット読者が読みやすく、価値を感じられる構成にしてください
- 取材データを基に、具体的で説得力のある内容にしてください
- JSON内の文字列は必ずダブルクォート（"）で囲んでください
- 改行文字は\\nでエスケープしてください`

    const result = await model.generateContent(prompt)
    const response = await result.response
    let draftText = response.text().trim()

    // JSONを抽出して修正
    let draftJson: any = null
    try {
      // まず、```json や ``` で囲まれている場合を処理
      let jsonString = ''
      const jsonBlockMatch = draftText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
      if (jsonBlockMatch) {
        jsonString = jsonBlockMatch[1]
      } else {
        // JSONオブジェクトを探す（最初の { から最後の } まで）
        const jsonObjectMatch = draftText.match(/\{[\s\S]*\}/)
        if (jsonObjectMatch) {
          jsonString = jsonObjectMatch[0]
        } else {
          jsonString = draftText
        }
      }

      // JSON文字列を修正する関数（改行をエスケープ）
      const fixJsonString = (str: string): string => {
        let fixed = str
        let inString = false
        let escapeNext = false
        let result = ''
        
        for (let i = 0; i < fixed.length; i++) {
          const char = fixed[i]
          
          if (escapeNext) {
            result += char
            escapeNext = false
            continue
          }
          
          if (char === '\\') {
            result += char
            escapeNext = true
            continue
          }
          
          if (char === '"') {
            inString = !inString
            result += char
            continue
          }
          
          if (inString) {
            // 文字列内の改行、タブ、キャリッジリターンをエスケープ
            if (char === '\n') {
              result += '\\n'
            } else if (char === '\r') {
              // \r\n の場合は次の文字を確認
              if (i + 1 < fixed.length && fixed[i + 1] === '\n') {
                result += '\\n'
                i++ // 次の文字をスキップ
              } else {
                result += '\\n'
              }
            } else if (char === '\t') {
              result += '\\t'
            } else {
              result += char
            }
          } else {
            result += char
          }
        }
        
        return result
      }

      // JSON文字列を修正
      jsonString = fixJsonString(jsonString)
      
      // JSONを解析
      draftJson = JSON.parse(jsonString)
    } catch (parseError) {
      console.error('❌ JSON解析エラー:', parseError)
      console.error('📝 生成されたテキスト（最初の1500文字）:', draftText.substring(0, 1500))
      console.error('📝 生成されたテキスト（最後の500文字）:', draftText.substring(Math.max(0, draftText.length - 500)))
      
      // 再試行: より積極的な修正を試みる
      try {
        // JSONオブジェクトを抽出
        const jsonMatch = draftText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          let fixedJson = jsonMatch[0]
          
          // 文字列内の改行、タブ、キャリッジリターンをエスケープ
          let inString = false
          let escapeNext = false
          let result = ''
          let stringStart = -1
          
          for (let i = 0; i < fixedJson.length; i++) {
            const char = fixedJson[i]
            
            if (escapeNext) {
              result += char
              escapeNext = false
              continue
            }
            
            if (char === '\\') {
              result += char
              escapeNext = true
              continue
            }
            
            if (char === '"') {
              if (inString) {
                // 文字列の終了
                inString = false
                stringStart = -1
              } else {
                // 文字列の開始
                inString = true
                stringStart = result.length
              }
              result += char
              continue
            }
            
            if (inString) {
              // 文字列内の改行、タブ、キャリッジリターンをエスケープ
              if (char === '\n') {
                result += '\\n'
              } else if (char === '\r') {
                if (i + 1 < fixedJson.length && fixedJson[i + 1] === '\n') {
                  result += '\\n'
                  i++
                } else {
                  result += '\\n'
                }
              } else if (char === '\t') {
                result += '\\t'
              } else {
                result += char
              }
            } else {
              result += char
            }
          }
          
          fixedJson = result
          
          // 開いている文字列を閉じる（文字列が途中で切れている場合）
          if (inString) {
            fixedJson += '"'
          }
          
          // 配列やオブジェクトが閉じられていない場合、閉じる
          const openBraces = (fixedJson.match(/\{/g) || []).length
          const closeBraces = (fixedJson.match(/\}/g) || []).length
          const openBrackets = (fixedJson.match(/\[/g) || []).length
          const closeBrackets = (fixedJson.match(/\]/g) || []).length
          
          // 配列を先に閉じる（ネストされている可能性があるため）
          if (openBrackets > closeBrackets) {
            fixedJson += ']'.repeat(openBrackets - closeBrackets)
          }
          
          // オブジェクトを閉じる
          if (openBraces > closeBraces) {
            fixedJson += '}'.repeat(openBraces - closeBraces)
          }
          
          // 最後にカンマの問題を修正（配列要素の後にカンマがない場合）
          // ただし、これは慎重に行う必要がある
          fixedJson = fixedJson.replace(/,\s*([}\]])/g, '$1') // 末尾のカンマを削除
          
          draftJson = JSON.parse(fixedJson)
        } else {
          throw parseError
        }
      } catch (retryError) {
        // より詳細なエラーメッセージを返す
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError)
        return NextResponse.json(
          { 
            error: '敲きの生成に失敗しました。JSON形式の解析に失敗しました。生成されたテキストが不完全な可能性があります。',
            details: errorMessage,
            generatedTextPreview: draftText.substring(0, 2000),
            suggestion: '敲きを再生成してください。'
          },
          { status: 500 }
        )
      }
    }

    // 敲きデータを検証
    if (!draftJson.explanation || !draftJson.sections || !Array.isArray(draftJson.sections)) {
      return NextResponse.json(
        { error: '敲きの生成に失敗しました。必要なフィールドが不足しています。' },
        { status: 500 }
      )
    }

    // セクションが現在・過去・未来の3つあるか確認
    const sections = draftJson.sections
    const requiredSections = ['現在', '過去', '未来']
    const sectionNames = sections.map((s: any) => s.section)
    const missingSections = requiredSections.filter(req => !sectionNames.includes(req))
    
    if (missingSections.length > 0) {
      return NextResponse.json(
        { error: `敲きの生成に失敗しました。以下のセクションが不足しています: ${missingSections.join(', ')}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      draft: {
        explanation: draftJson.explanation,
        sections: sections.map((section: any) => ({
          section: section.section,
          heading: section.heading || '',
          keyPoints: section.keyPoints || [],
          contentOutline: section.contentOutline || ''
        }))
      }
    })
  } catch (error) {
    console.error('❌ Error generating draft:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { 
        error: '敲きの生成に失敗しました', 
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}

