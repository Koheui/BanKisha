import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { auth } from '@clerk/nextjs/server'
import * as admin from 'firebase-admin'
import { initializeFirebaseAdmin } from '@/src/lib/firebase-admin'

// Initialize Firebase Admin SDK
export async function POST(request: NextRequest) {
  try {
    await initializeFirebaseAdmin()
    const adminDb = admin.firestore()

    // 認証チェック
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }

    const body = await request.json()
    const {
      draft,
      targetWordCount,
      targetAudience,
      mediaType,
      interviewPurpose,
      supplementaryInfo,
      knowledgeBaseIds,
      companyId
    } = body

    if (!draft || !draft.sections || !Array.isArray(draft.sections)) {
      return NextResponse.json(
        { error: '敲きデータが必要です' },
        { status: 400 }
      )
    }

    if (!targetWordCount || targetWordCount < 500) {
      return NextResponse.json(
        { error: '目標文字数は500文字以上を指定してください' },
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

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: Math.min(16000, Math.floor(targetWordCount * 3)), // 文字数に応じてトークン数を調整（余裕を持たせる）
      },
    })

    // Fetch the master direction prompt
    let directionPromptContext = ''
    try {
      const settingsRef = adminDb.collection('systemSettings').doc('appDirection')
      const settingsDoc = await settingsRef.get()
      if (settingsDoc.exists) {
        directionPromptContext = settingsDoc.data()?.directionPrompt || ''
      }
    } catch (error) {
      console.warn('⚠️ Error loading app direction prompt:', error)
      // Continue without the master prompt if it fails
    }

    // 敲きのセクションを整理（現在・過去・未来を基本としつつ、それ以外があれば末尾に追加）
    const sectionOrder = ['現在', '過去', '未来']
    const prioritizedSections = sectionOrder.map(sectionName =>
      draft.sections.find((s: any) => s.section === sectionName)
    ).filter(Boolean)

    const otherSections = draft.sections.filter((s: any) => !sectionOrder.includes(s.section))
    const orderedSections = [...prioritizedSections, ...otherSections]

    // ナレッジベースから記事制作のベストプラクティスを取得（思考の起点として最優先）
    // 重要: スキルナレッジベースはサーバー側で自動取得（クライアント側から送信されなくても取得）
    let skillKnowledgeContext = ''
    let userKnowledgeContext = ''

    // 1. スキルナレッジベースを自動取得（サーバー側のみ、記事作成のベストプラクティスとして）
    if (adminDb) {
      try {
        // スキルナレッジベースをクエリで取得
        const skillKBQuery = adminDb
          .collection('knowledgeBases')
          .where('type', '==', 'skill')
          .limit(10) // 最大10個まで取得

        const skillKBSnapshot = await skillKBQuery.get()

        const skillKBDocs = await Promise.all(
          skillKBSnapshot.docs.map(async (doc) => {
            const kbData = doc.data()

            // 削除済みはスキップ
            if (kbData?.deleted === true) {
              return null
            }

            // スキルナレッジベースのchunksを取得
            let chunksText = ''
            try {
              const chunksSnapshot = await adminDb
                .collection('knowledgeBases')
                .doc(doc.id)
                .collection('chunks')
                .limit(50)
                .get()

              if (!chunksSnapshot.empty) {
                chunksText = chunksSnapshot.docs
                  .map(chunkDoc => chunkDoc.data().text || '')
                  .filter(text => text.length > 0)
                  .join('\n\n')
              }
            } catch (chunksError) {
              // 機密保護のため、エラーの詳細は出力しない
              console.warn('⚠️ Error loading chunks: [details masked]')
            }

            return {
              summary: kbData?.summary || '',
              usageGuide: kbData?.usageGuide || '',
              fileName: kbData?.fileName || '',
              chunks: chunksText,
              isSkillKB: true,
            }
          })
        )

        const validSkillKBs = skillKBDocs.filter(kb => kb !== null)

        if (validSkillKBs.length > 0) {
          skillKnowledgeContext = validSkillKBs.map(kb => {
            let context = `【${kb?.fileName}】\n概要: ${kb?.summary}`
            if (kb?.chunks && kb.chunks.length > 0) {
              context += `\n\n【記事制作のベストプラクティス】\n${kb.chunks.substring(0, 8000)}`
            }
            return context
          }).join('\n\n')
        }
      } catch (skillKBError) {
        // 機密保護のため、エラーの詳細は出力しない
        console.warn('⚠️ Error loading skill knowledge bases: [details masked]')
      }
    }

    // 2. ユーザーナレッジベースを取得（クライアント側から送信されたIDのみ、useForArticle === trueのもの）
    if (knowledgeBaseIds && knowledgeBaseIds.length > 0 && adminDb) {
      try {
        const kbDocs = await Promise.all(
          knowledgeBaseIds.map(async (kbId: string) => {
            const kbDoc = await adminDb.collection('knowledgeBases').doc(kbId).get()
            if (kbDoc.exists) {
              const kbData = kbDoc.data()

              // userタイプのみ処理（skill/infoはサーバー側で自動取得済み）
              if (kbData?.type !== 'user') {
                return null
              }

              // 記事作成で使用しない場合はスキップ
              if (kbData?.useForArticle === false) {
                return null
              }

              // スコープの確認
              const kbCompanyId = kbData?.companyId
              const isAllowed = (companyId && kbCompanyId === companyId)

              if (!isAllowed) {
                console.warn(`⚠️ Access denied to KB ${kbId}: KB companyId ${kbCompanyId} does not match request companyId ${companyId}`)
                return null
              }

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
                // 機密保護のため、エラーの詳細は出力しない
                console.warn('⚠️ Error loading chunks: [details masked]')
              }

              return {
                summary: kbData?.summary || '',
                fileName: kbData?.fileName || '',
                category: kbData?.category || '',
                chunks: chunksText,
                isSkillKB: false,
              }
            }
            return null
          })
        )

        // userタイプのみ処理（skill/infoはサーバー側で自動取得済み）
        const userKBs = kbDocs.filter(kb => kb !== null)

        // ユーザーナレッジベースのコンテキスト（会社固有の情報、SEO対策など）
        if (userKBs.length > 0) {
          userKnowledgeContext = userKBs.map(kb => {
            let context = `【${kb?.fileName}${kb?.category ? ` - ${kb.category}` : ''}】\n概要: ${kb?.summary}`
            if (kb?.chunks && kb.chunks.length > 0) {
              context += `\n\n【参考専門情報（${kb?.category || '業界知識'}）】\n${kb.chunks.substring(0, 5000)}`
            }
            return context
          }).join('\n\n')
        }
      } catch (userKBError) {
        // 機密保護のため、エラーの詳細は出力しない
        console.warn('⚠️ Error loading user knowledge bases: [details masked]')
        // スキルナレッジベースのみでも継続
        userKnowledgeContext = ''
      }
    }

    const draftText = orderedSections.map((section: any, idx: number) => {
      let sectionText = `【${section.section}】${section.heading}
見出し: ${section.heading}
要点:
${section.keyPoints.map((point: string, i: number) => `${i + 1}. ${point}`).join('\n')}
内容の概要: ${section.contentOutline}`

      // フィードバックがある場合は追加
      if (section.feedback && section.feedback.trim()) {
        sectionText += `\n\nフィードバック: ${section.feedback}`
      }

      return sectionText
    }).join('\n\n')

    // 各セクションの文字数を計算（均等に配分）
    const sectionCount = orderedSections.length
    const baseSectionWordCount = Math.floor(targetWordCount / sectionCount)
    const remainder = targetWordCount % sectionCount
    const sectionWordCounts = orderedSections.map((_, idx) =>
      baseSectionWordCount + (idx < remainder ? 1 : 0)
    )

    const knowledgeBaseContext = skillKnowledgeContext && userKnowledgeContext
      ? `${skillKnowledgeContext}\n\n${userKnowledgeContext}`
      : skillKnowledgeContext || userKnowledgeContext

    const prompt = `${directionPromptContext ? `【最重要の基本原則：アプリの方向性】\n${directionPromptContext}\n\n上記の原則を絶対に遵守してください。\n━━━━━━━━━━━━━━━━━━━━\n\n` : ''}${knowledgeBaseContext ? `【最重要：思考の起点 - 記事制作のベストプラクティス（ナレッジベース）】\n${knowledgeBaseContext}\n\n**⚠️ 最重要**: 上記のナレッジベースは、記事制作における思考の起点です。**必ず最初にこの内容を参照し、その原則と手法に基づいて記事を執筆してください。** このナレッジベースに記載されている記事制作のベストプラクティス、ターゲット読者に響く書き方、メディア特性に合わせた記事構成の手法、SEO対策、テキスト構成、タグの使い方などを**必ず実践**してください。\n\n` : ''}あなたは経験豊富なビジネス記事ライターです。以下の「敲き」（下書き/骨組み）を基に、指定された文字数で記事を執筆してください。

【重要な前提】
- この記事は「${mediaType}」に掲載されます
- ターゲット読者は「${targetAudience}」です
- 取材の目的は「${interviewPurpose}」です
- 補足情報（日時、住所など）: ${supplementaryInfo || '未指定'}
- 目標文字数: 約${targetWordCount}文字（リード文含む）

【敲き（下書き/骨組み）】
${draftText}

【記事制作の指示】
${knowledgeBaseContext ? `0. **最重要：ナレッジベースを思考の起点として活用**: 上記のナレッジベースに記載されている記事制作のベストプラクティス、手法、原則（SEO対策、テキスト構成、タグの使い方など）を**必ず最初に参照**し、それに基づいて記事を執筆してください。ナレッジベースの内容を無視したり、軽視したりしないでください。\n` : ''}1. 敲きを忠実に反映: 提供された敲きの構成、見出し、要点、内容の概要を基に記事を執筆してください
2. フィードバックを反映: 各セクションにフィードバックがある場合は、その内容を考慮して記事を執筆してください
3. 文字数を厳守: リード文を含めて合計${targetWordCount}文字程度になるようにしてください
   - リード文: 約${Math.floor(targetWordCount * 0.1)}文字（全体の10%程度）
   - 各セクション: 約${sectionWordCounts.map((count, idx) => `${orderedSections[idx].section}: ${count}文字`).join('、')}
4. セクションの順序を守る: 提供された敲きのセクション順序（基本：現在→過去→未来→その他詳細情報）に従って執筆してください
5. ターゲット読者を意識: 「${targetAudience}」が興味を持ち、価値を感じる内容にする
6. メディア特性に合わせる: 「${mediaType}」の特性（トーン、深さ、形式など）に合わせて執筆する
7. 読みやすさを重視: 見出し、段落、箇条書きなどを効果的に使用する
8. 具体性を重視: 敲きの要点を具体的な内容に展開する
${knowledgeBaseContext ? `9. **ナレッジベースの実践**: 上記のナレッジベースに記載されている記事制作の手法、原則、ベストプラクティス（SEO対策、テキスト構成、タグの使い方など）を**必ず実践**してください。これらは思考の起点であり、記事制作の基盤です。\n` : ''}

【出力形式】
重要: 以下のJSON形式のみを出力してください。説明文、前置き、コメント、マークダウン記号は一切含めないでください。JSONオブジェクトのみを出力してください。

{
  "title": "記事のタイトル（30-50文字程度、ターゲット読者に響くタイトル）",
  "lead": "リード文（${Math.floor(targetWordCount * 0.1)}文字程度、記事の要点を簡潔に）",
  "sections": [
${orderedSections.map((section, idx) => `    {
      "heading": "見出し（${section.section}の敲きの見出しを基に）",
      "body": "本文（${sectionWordCounts[idx]}文字程度、${section.section}の敲きの要点と内容の概要を具体的に展開）"
    }`).join(',\n')}
  ],
  "totalWordCount": ${targetWordCount},
  "explanation": "${(draft.explanation || 'なぜこういう記事にしたのか？という解説（※スキルナレッジベースの名称や具体的な引用を一切明かさず、専門家としての判断として説明すること）').replace(/"/g, '\\"')}",
  "wordCountBreakdown": {
    "lead": ${Math.floor(targetWordCount * 0.1)},
${orderedSections.map((section, idx) => `    "${section.section}": ${sectionWordCounts[idx]}`).join(',\n')}
  }
}

【注意事項】
- JSON形式のみを出力してください。説明文や前置き、マークダウン記号は一切含めないでください。
- 出力は必ず { で始まり } で終わるJSONオブジェクトのみにしてください
- セクションの順序を遵守してください（基本：現在→過去→未来→その他）
- 各セクションの本文は、敲きの要点と内容の概要を具体的に展開してください
- 文字数は目標値に近づけるようにしてください（±10%程度の誤差は許容）
- ターゲット読者が読みやすく、価値を感じられる記事にしてください
- JSON内の文字列は必ずダブルクォート（"）で囲んでください
- 改行文字は必ず\\nでエスケープしてください（本文内の改行も含む）
- 本文が複数行になる場合は、改行を\\nで表現してください
- JSONの構文エラーを避けるため、文字列内の特殊文字（改行、タブ、ダブルクォートなど）は必ずエスケープしてください`

    const result = await model.generateContent(prompt)
    const response = await result.response
    let articleText = response.text().trim()

    // JSONを抽出して修正
    let articleJson: any = null
    try {
      // まず、```json や ``` で囲まれている場合を処理
      let jsonString = ''
      const jsonBlockMatch = articleText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
      if (jsonBlockMatch) {
        jsonString = jsonBlockMatch[1]
      } else {
        // JSONオブジェクトを探す（最初の { から最後の } まで）
        const jsonObjectMatch = articleText.match(/\{[\s\S]*\}/)
        if (jsonObjectMatch) {
          jsonString = jsonObjectMatch[0]
        } else {
          jsonString = articleText
        }
      }

      // JSON文字列を修正する関数
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
      articleJson = JSON.parse(jsonString)
    } catch (parseError) {
      console.error('❌ JSON解析エラー:', parseError)
      console.error('📝 生成されたテキスト（最初の1500文字）:', articleText.substring(0, 1500))
      console.error('📝 生成されたテキスト（最後の500文字）:', articleText.substring(Math.max(0, articleText.length - 500)))

      // 再試行: より積極的な修正を試みる
      try {
        // JSONオブジェクトを抽出
        const jsonMatch = articleText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          let fixedJson = jsonMatch[0]

          // 文字列内の改行、タブ、キャリッジリターンをエスケープ
          let inString = false
          let escapeNext = false
          let result = ''

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
              inString = !inString
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

          articleJson = JSON.parse(fixedJson)
        } else {
          throw parseError
        }
      } catch (retryError) {
        // 最後の試行: 不完全なJSONを検出して、可能な限り修復を試みる
        try {
          const jsonMatch = articleText.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            let fixedJson = jsonMatch[0]

            // 不完全な文字列を検出して閉じる
            // 開いている文字列を探して閉じる
            let openQuotes = 0
            let inString = false
            let escapeNext = false
            let lastQuotePos = -1

            for (let i = 0; i < fixedJson.length; i++) {
              const char = fixedJson[i]

              if (escapeNext) {
                escapeNext = false
                continue
              }

              if (char === '\\') {
                escapeNext = true
                continue
              }

              if (char === '"') {
                inString = !inString
                if (inString) {
                  openQuotes++
                  lastQuotePos = i
                } else {
                  openQuotes--
                }
              }
            }

            // 開いている文字列がある場合、最後の文字列を閉じる
            if (inString && lastQuotePos >= 0) {
              // 最後の開いている文字列の後に " を追加
              fixedJson = fixedJson.substring(0, fixedJson.length) + '"'
            }

            // 改行をエスケープ
            let inString2 = false
            let escapeNext2 = false
            let result2 = ''

            for (let i = 0; i < fixedJson.length; i++) {
              const char = fixedJson[i]

              if (escapeNext2) {
                result2 += char
                escapeNext2 = false
                continue
              }

              if (char === '\\') {
                result2 += char
                escapeNext2 = true
                continue
              }

              if (char === '"') {
                inString2 = !inString2
                result2 += char
                continue
              }

              if (inString2) {
                if (char === '\n') {
                  result2 += '\\n'
                } else if (char === '\r') {
                  if (i + 1 < fixedJson.length && fixedJson[i + 1] === '\n') {
                    result2 += '\\n'
                    i++
                  } else {
                    result2 += '\\n'
                  }
                } else if (char === '\t') {
                  result2 += '\\t'
                } else {
                  result2 += char
                }
              } else {
                result2 += char
              }
            }

            fixedJson = result2

            // 配列やオブジェクトが閉じられていない場合、閉じる
            const openBraces = (fixedJson.match(/\{/g) || []).length
            const closeBraces = (fixedJson.match(/\}/g) || []).length
            const openBrackets = (fixedJson.match(/\[/g) || []).length
            const closeBrackets = (fixedJson.match(/\]/g) || []).length

            if (openBraces > closeBraces) {
              fixedJson += '}'.repeat(openBraces - closeBraces)
            }
            if (openBrackets > closeBrackets) {
              fixedJson += ']'.repeat(openBrackets - closeBrackets)
            }

            articleJson = JSON.parse(fixedJson)
          } else {
            throw retryError
          }
        } catch (finalError) {
          // より詳細なエラーメッセージを返す
          const errorMessage = parseError instanceof Error ? parseError.message : String(parseError)
          return NextResponse.json(
            {
              error: '記事の生成に失敗しました。JSON形式の解析に失敗しました。生成されたテキストが不完全な可能性があります。',
              details: errorMessage,
              generatedTextPreview: articleText.substring(0, 2000),
              suggestion: '文字数を減らすか、敲きを再生成してください。'
            },
            { status: 500 }
          )
        }
      }
    }

    // 記事データを検証
    if (!articleJson.title || !articleJson.lead || !articleJson.sections || !Array.isArray(articleJson.sections)) {
      return NextResponse.json(
        { error: '記事の生成に失敗しました。必要なフィールドが不足しています。' },
        { status: 500 }
      )
    }

    // セクションが必要最低限あるか確認
    if (articleJson.sections.length === 0) {
      return NextResponse.json(
        { error: '記事の生成に失敗しました。セクションが生成されませんでした。' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      article: {
        title: articleJson.title,
        lead: articleJson.lead,
        sections: articleJson.sections.map((section: any) => ({
          heading: section.heading || '',
          body: section.body || ''
        })),
        explanation: articleJson.explanation || draft.explanation || '',
        wordCountBreakdown: articleJson.wordCountBreakdown || {}
      }
    })
  } catch (error) {
    console.error('❌ Error generating article from draft:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        error: '記事の生成に失敗しました',
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}

