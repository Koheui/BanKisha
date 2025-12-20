import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as admin from 'firebase-admin'

import { initializeFirebaseAdmin } from '@/src/lib/firebase-admin'

// Initialize Firebase Admin SDK
initializeFirebaseAdmin()

const adminDb = admin.firestore()

export async function POST(request: NextRequest) {
  try {
    const { interviewId, category, targetAudience, mediaType, interviewPurpose, objective, interviewerPrompt, knowledgeBaseIds, previousQuestions, userFeedback, intervieweeName, intervieweeCompany, intervieweeTitle, intervieweeDepartment, intervieweeType, confirmNameAtInterview, confirmCompanyAtInterview, confirmTitleAtInterview, confirmDepartmentAtInterview, interviewerName } = await request.json()

    if (!interviewId || !category || !targetAudience || !mediaType || !interviewPurpose || !objective) {
      return NextResponse.json(
        { error: 'インタビューID、カテゴリ、ターゲット読者、掲載メディア、取材の目的、具体的な質問が必要です' },
        { status: 400 }
      )
    }

    const geminiApiKey = process.env.GEMINI_API_KEY
    if (!geminiApiKey) {
      console.error('❌ GEMINI_API_KEY is not set')
      return NextResponse.json(
        { error: 'Gemini API Keyが設定されていません。GEMINI_API_KEY環境変数を設定してください。' },
        { status: 500 }
      )
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey)

    // ナレッジベースから関連情報を取得
    let knowledgeBaseContext = ''
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
              
              // ナレッジベースのchunksを取得（スキルナレッジベースの場合はより多く取得）
              let chunksText = ''
              try {
                const chunksLimit = isSkillKB ? 50 : 20 // スキルナレッジベースは50個、その他は20個
                const chunksSnapshot = await adminDb
                  .collection('knowledgeBases')
                  .doc(kbId)
                  .collection('chunks')
                  .limit(chunksLimit)
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
                isSkillKB: isSkillKB,
              }
            }
            return null
          })
        )
        
        const validKBs = kbDocs.filter(kb => kb !== null)
        const skillKBs = validKBs.filter(kb => kb?.isSkillKB) // 既にisEditOnlyで除外済み
        const userKBs = validKBs.filter(kb => !kb?.isSkillKB)
        
        // スキルナレッジベースのコンテキスト（質問設計・対話設計に重要）
        // 注意：isEditOnlyがtrueのスキルは除外（編集時のみ使用）
        if (skillKBs.length > 0) {
          skillKnowledgeContext = skillKBs.map(kb => {
            let context = `【${kb?.fileName}】\n概要: ${kb?.summary}\n活用方法: ${kb?.usageGuide}`
            if (kb?.chunks && kb.chunks.length > 0) {
              // スキルナレッジベースは最大8000文字まで使用（質問設計に重要）
              context += `\n\n【質問設計・対話設計のベストプラクティス】\n${kb.chunks.substring(0, 8000)}`
            }
            return context
          }).join('\n\n')
        }
        
        // ユーザーナレッジベースのコンテキスト（会社固有の情報）
        if (userKBs.length > 0) {
          const userKBContext = userKBs.map(kb => {
            let context = `【${kb?.fileName}】\n概要: ${kb?.summary}\n活用方法: ${kb?.usageGuide}`
            if (kb?.chunks && kb.chunks.length > 0) {
              context += `\n\n【参考コンテンツ】\n${kb.chunks.substring(0, 2000)}`
            }
            return context
          }).join('\n\n')
          
          knowledgeBaseContext = skillKnowledgeContext 
            ? `${skillKnowledgeContext}\n\n${userKBContext}`
            : userKBContext
        } else {
          knowledgeBaseContext = skillKnowledgeContext
        }
        
        console.log('📚 ナレッジベースコンテキスト:', {
          スキルナレッジベース数: skillKBs.length,
          ユーザーナレッジベース数: userKBs.length,
          スキルコンテキスト長: skillKnowledgeContext.length,
          全体コンテキスト長: knowledgeBaseContext.length
        })
      } catch (kbError) {
        console.warn('⚠️ Error loading knowledge bases:', kbError)
        // Continue without knowledge base context
      }
    }

    // 質問を生成
    // ⚠️ 重要: モデル名は 'gemini-2.5-flash' を使用すること
    // - gemini-1.5-flash は存在しない（404エラー）
    // - gemini-pro は動作するが、gemini-2.5-flash の方が新しい
    // - functions/src/index.ts と同じモデルを使用して一貫性を保つ
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash', // ✅ 動作確認済み
      generationConfig: {
        temperature: 0.7,
      },
    })

    // カテゴリに応じた説明を取得
    const categoryDescriptions: Record<string, string> = {
      business: 'ビジネス・経営者インタビュー：経営戦略、ビジネスモデル、組織運営、市場分析、競合分析、成長戦略など、ビジネスに関する深い洞察を得るための質問を生成してください。',
      engineer: '技術者・エンジニアインタビュー：技術的な課題、開発プロセス、アーキテクチャ、イノベーション、技術トレンドなど、技術に関する深い洞察を得るための質問を生成してください。',
      creator: 'クリエイター・アーティストインタビュー：創作プロセス、インスピレーション、表現方法、作品への想い、クリエイティビティの源泉など、創作に関する深い洞察を得るための質問を生成してください。',
      lifestyle: 'ライフスタイル・個人インタビュー：ライフスタイル、価値観、人生観、日常の過ごし方、趣味、興味関心など、個人のライフスタイルに関する深い洞察を得るための質問を生成してください。',
      casual: 'カジュアル・雑談インタビュー：カジュアルで親しみやすい雰囲気で、日常的な話題、興味関心、体験談、エピソードなど、気軽に話せる質問を生成してください。',
      other: 'その他：上記のカテゴリに当てはまらない、カスタムなインタビューです。具体的な質問内容を最優先に反映してください。'
    }

    const categoryDescription = categoryDescriptions[category] || categoryDescriptions.other

    // フィードバックがある場合は改善版を生成、ない場合は初回生成
    const isImprovement = previousQuestions && previousQuestions.length > 0 && userFeedback
    
    let prompt = `${skillKnowledgeContext ? `【最重要：思考の起点 - 質問設計・対話設計のベストプラクティス（スキルナレッジベース）】\n${skillKnowledgeContext}\n\n**⚠️ 最重要**: 上記のスキルナレッジベースは、質問設計における思考の起点です。**必ず最初にこの内容を参照し、その原則と手法に基づいて質問を生成してください。** このスキルナレッジベースに記載されている効果的なインタビュー質問の作り方、対話の流れの設計方法、相手が話しやすい質問のテクニックを**必ず実践**してください。\n\n` : ''}あなたは経験豊富なプロのインタビュアーです。以下の情報を基に、対話を中心に組み立てた質問リストを生成してください。

【重要な前提】
- 生成する質問は「参考リスト」です。実際のインタビューでは、会話の流れに合わせて適切な質問を選び、順序を変更したり、追加の質問を生成したりします。
- 質問リストの順序に拘らず、会話の流れを最優先にします。
- 各質問は、前の回答に自然に繋がるように設計してください。
${skillKnowledgeContext ? `- **最重要**: 上記のスキルナレッジベースに記載されている質問設計の原則と手法を**必ず思考の起点として参照**してください。\n` : ''}

【重要】出力は質問のみです。説明文や前置きは一切含めないでください。番号付きリスト形式で質問文だけを出力してください。

【インタビューのカテゴリ】
${categoryDescription}

【ターゲット読者】
${targetAudience}

【掲載メディア】
${mediaType}

【取材の目的】
${interviewPurpose}

【具体的な質問（箇条書き）】**最重要：この内容を最優先に反映してください**
${objective}

**重要**：上記の「具体的な質問」は、ユーザーが実際に聞きたい質問内容です。この内容をそのまま反映し、質問のトーンや深さを調整する形で質問を生成してください。この内容を無視したり、一般的なビジネスインタビューのパターンに置き換えたりしないでください。
${skillKnowledgeContext ? `**重要**: ただし、スキルナレッジベースに記載されている質問設計の原則と手法を**思考の起点として活用**し、具体的な質問の内容をスキルナレッジベースの手法で表現・調整してください。\n` : ''}

${interviewerPrompt ? `【インタビュアーの特徴・口調】\n${interviewerPrompt}\n` : ''}
${knowledgeBaseContext && !skillKnowledgeContext ? `【参考情報（ナレッジベース）】\n${knowledgeBaseContext}\n` : ''}`

    if (isImprovement) {
      prompt += `\n\n【前回の質問（改善が必要）】\n${previousQuestions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}

【ユーザーのフィードバック・要望】\n${userFeedback}

【指示】
上記のフィードバックを踏まえて、前回の質問を改善してください。
- ユーザーの要望を反映した質問に変更
- 対話の流れを意識した自然な質問の順序
- **より深掘りできる質問構成（最重要）**
- 一問一答ではなく、会話の流れの中で深掘りする質問設計を実践
- 表面的な情報を聞く質問の後には、必ず深掘りする質問を配置
- ユーザーが指摘した問題点を解決

【深掘り質問の例（参考）】
以下のような深掘り質問を含めてください：
- 表面的な質問：「どのような業務を行われていますか？」
  → 深掘り質問：「その業務の中で、特に力を入れている点は何でしょうか？具体的な事例があれば教えていただけますか？」
- 表面的な質問：「プロジェクトは順調に進んでいますか？」
  → 深掘り質問：「その中で最も苦労した点は何でしたか？どのように乗り越えられたのでしょうか？」

【出力形式】
説明文や前置きは一切含めず、番号付きリスト形式で質問文のみを出力してください。
各質問は自然な会話形式で、1-2文で簡潔にしてください。
**重要：初期質問は10問を生成してください。** 会話の流れで追加の質問（例：「もっと詳しく教えてください」など）が必要になる場合は、インタビュー中に動的に生成されますが、初期の質問リストは10問にしてください。

出力例（深掘り質問を含む）：
1. 今日はお時間いただき、ありがとうございます。まず、正式な企業名とご自身の役職、それから担当されている業務について教えていただけますか？
2. 今回のプロジェクトについて、どのような経緯で始まったのでしょうか？
3. そのプロジェクトを始めるきっかけとなった、具体的な出来事や体験があれば教えていただけますか？
4. 開発過程で最も苦労した点を教えていただけますか？
5. その苦労をどのように乗り越えられたのでしょうか？特に印象的だったエピソードがあればお聞かせください。
...`
    } else {
      prompt += `\n\n【重要な指示】
1. **具体的な質問（${objective}）の内容を最優先に反映してください（最重要）**
   - 上記の「具体的な質問」は、ユーザーが実際に聞きたい質問内容です
   - この内容をそのまま反映し、質問のトーンや深さを調整する形で質問を生成してください
   - この内容を無視したり、一般的なビジネスインタビューのパターンに置き換えたりしないでください
   - 例えば、「今日のお昼ご飯は何を食べた？」という質問がある場合、これを「キャリアの壁」などの別の質問に置き換えないでください
   - 質問の表現は自然な会話形式に調整できますが、質問の本質的な内容は変えないでください

2. **ターゲット読者と掲載メディアを意識した質問の表現を調整してください**
   - ターゲット読者（${targetAudience}）が興味を持つ表現に調整してください
   - 掲載メディア（${mediaType}）の特性に合わせた質問のトーンや深さを調整してください
   - 取材の目的（${interviewPurpose}）を達成するための質問の順序や構成を調整してください
   - ただし、上記の「具体的な質問」の内容は必ず反映してください

3. **最初の質問について（最重要）**
   - **必ず最初に挨拶と自己紹介、メディア・趣旨の説明を含めてください**
   - 最初の質問は以下の構成で生成してください：
     1. 挨拶：「本日はお時間いただき、ありがとうございます。」
     2. 自己紹介：インタビュアーの名前を名乗る（インタビュアーの特徴・口調に基づいて自然に）
       - インタビュアー名: ${interviewerName || 'インタビュアー'}
       - 「[あなたの名前]」や「インタビュアー」という表現は使わず、実際の名前（${interviewerName || 'インタビュアー'}）を必ず使用してください
     3. メディア・趣旨の説明：「${mediaType}に掲載予定の記事で、${interviewPurpose}という目的で取材させていただいております。${targetAudience}の方々に向けた記事を制作する予定です。」
     4. 相手方の名前確認：必ず相手方の名前を確認してください
       - 相手方の名前が入力されている場合（${intervieweeName || '未入力'}）：「${intervieweeName || 'お名前'}さんで間違いございませんか？」と確認してください
       - 相手方の名前が入力されていない場合：「お名前を教えていただけますか？」と確認してください
     5. 確認（必要な場合のみ）：インタビュー情報に企業名や役職が入力されている場合、または確認が必要な場合のみ、自然な形で確認
     6. 本題への導入：「それでは、早速ですが...」という形で本題の質問へ自然に繋げる
   
   ${(() => {
     const needsConfirmation: string[] = []
     if (confirmNameAtInterview) needsConfirmation.push('お名前')
     if (confirmCompanyAtInterview) needsConfirmation.push('会社名・団体名')
     if (confirmDepartmentAtInterview) needsConfirmation.push('部署名')
     if (confirmTitleAtInterview) needsConfirmation.push('役職名')
     
     if (needsConfirmation.length > 0) {
       return `   - 確認が必要な場合：上記の挨拶・自己紹介・メディア・趣旨の説明の後に、「念の為、確認させていただきたいのですが、${needsConfirmation.join('・')}を教えていただけますか？もし補足がありましたら、お願いします。」という形式で確認してください。`
     } else if (intervieweeName || intervieweeCompany) {
       const companyPart = intervieweeCompany || ''
       const departmentPart = intervieweeDepartment ? `${intervieweeDepartment}の` : ''
       const titlePart = intervieweeTitle ? `${intervieweeTitle}の` : ''
       const namePart = intervieweeName || ''
       return `   - 確認が必要な場合：上記の挨拶・自己紹介・メディア・趣旨の説明の後に、「念の為、確認させていただきたいのですが、${companyPart}${departmentPart}${titlePart}${namePart}さんで間違いございませんか？もし補足がありましたら、お願いします。」という形式で確認してください。`
     } else {
       return `   - 確認が不要な場合：挨拶・自己紹介・メディア・趣旨の説明の後、直接本題の質問に進んでください。`
     }
   })()}
   
   - **重要**：「具体的な質問」に最初の質問が指定されている場合でも、必ず上記の挨拶・自己紹介・メディア・趣旨の説明を最初に含めてから、その質問に進んでください。

4. **深掘りする質問設計について（参考）**
   - 「具体的な質問」に深掘りに関する質問（例：「なぜそうしたのか？」）が含まれている場合は、それを反映してください
   - 「具体的な質問」に深掘りに関する質問が含まれていない場合は、必要に応じて深掘り質問を追加できますが、元の質問の内容は必ず反映してください
   - 深掘り質問の例（参考）：
     * 「なぜそうなったのか？」「どのような経緯で？」（背景・経緯の深掘り）
     * 「具体的にはどのような事例がありますか？」「実際のエピソードを教えていただけますか？」（具体例の深掘り）
     * 「その中で最も印象的だったことは何ですか？」「特に苦労した点は？」（感情・体験の深掘り）
     * 「それはどのような意味を持ちますか？」「なぜそれが重要なのでしょうか？」（価値観・哲学の深掘り）
     * 「そこから学んだことは何ですか？」「その経験が今にどう活かされていますか？」（学び・応用の深掘り）
   - **重要：上記の「具体的な質問」の内容を最優先にし、深掘り質問は補助的に使用してください**

4. **質問の流れを意識してください**
   - 最初：親しみやすい導入質問（自己紹介、今日のテーマなど）
   - 中盤：目的に沿った深掘り質問（ターゲット読者が知りたい内容を深掘り）
   - 終盤：まとめや今後の展望に関する質問（さらに深い洞察を得る）

5. **質問の表現を工夫してください**
   - 「〜ですか？」という硬い表現を避け、「〜について教えていただけますか？」「〜を聞かせていただけますか？」など自然な表現を使用
   - 相手が答えやすいように、具体的な例を求める質問も含める
   - 会話の流れを意識した自然な質問にする
   - **重要：自然で理解しやすい会話形式にしてください**
     * 不自然な間投詞（「えー」「あー」など）は避け、自然な話し言葉で質問してください
     * 例：「それでは、まず...」「そうですね、その点について...」「具体的には...」
   - **重要：1つの質問は1つのトピックに絞ってください。複数の質問を1つにまとめないでください**
   - 例：「どのような業務を行われているか、具体的な事例を交えて教えていただけますか？特に、最近注力されている点があればお伺いしたいです。」→ これは3つの質問が混在しているのでNG
   - 正しい例：「どのような業務を行われているか教えていただけますか？」（1つの質問）
   - 相手の回答に基づいて、次の質問で深掘りする形にしてください

6. **対話を中心に組み立てる質問を生成してください**
   ${skillKnowledgeContext ? `   - 上記のスキルナレッジベースには、対話を中心に組み立てる質問設計のベストプラクティスが含まれています
   - スキルナレッジベースに記載されている「対話を中心に組み立てる手法」「会話の流れを重視する質問設計」「相手の回答に基づいて自然に次の質問に繋げる方法」を参考にしてください
   - **ただし、上記の「具体的な質問」の内容を最優先にし、スキルナレッジベースは質問の表現や順序を調整する際の参考として使用してください**
   - 質問リストの順序に拘らず、会話の流れを最優先にする質問を生成してください
   - 各質問は、前の回答を受けて自然に次の話題に進めるように設計してください
   - **質問は「参考リスト」として生成し、実際の会話では流れに合わせて選ぶことを前提にしてください**` : `   - 対話を中心に組み立てる質問を生成してください
   - 質問リストの順序に拘らず、会話の流れを最優先にする質問を設計してください
   - 各質問は、前の回答に自然に繋がるようにしてください
   - 効果的な対話のテクニックや、相手が話しやすい質問の作り方を活用してください`}

7. **質問の柔軟性を意識してください**
   - 生成する質問は「参考リスト」であり、実際の会話では流れに合わせて選びます
   - 各質問は独立して使えるように設計し、前後の文脈に依存しすぎないようにしてください
   - ただし、会話の流れに自然に繋がるような質問を心がけてください

【出力形式】
説明文や前置きは一切含めず、番号付きリスト形式で質問文のみを出力してください。
各質問は自然な会話形式で、1-2文で簡潔にしてください。
**重要：初期質問は10問を生成してください。** 会話の流れで追加の質問（例：「もっと詳しく教えてください」など）が必要になる場合は、インタビュー中に動的に生成されますが、初期の質問リストは10問にしてください。

【深掘り質問の例（参考）】
以下のような深掘り質問を含めてください：
- 表面的な質問：「どのような業務を行われていますか？」
  → 深掘り質問：「その業務の中で、特に力を入れている点は何でしょうか？具体的な事例があれば教えていただけますか？」
- 表面的な質問：「プロジェクトは順調に進んでいますか？」
  → 深掘り質問：「その中で最も苦労した点は何でしたか？どのように乗り越えられたのでしょうか？」
- 表面的な質問：「今後の展望を教えてください」
  → 深掘り質問：「その展望を実現するために、どのような価値観や哲学が重要だと考えていますか？」

出力例（深掘り質問を含む）：
1. 今日はお時間いただき、ありがとうございます。まず、正式な企業名とご自身の役職、それから担当されている業務について教えていただけますか？
2. 今回のプロジェクトについて、どのような経緯で始まったのでしょうか？
3. そのプロジェクトを始めるきっかけとなった、具体的な出来事や体験があれば教えていただけますか？
4. 開発過程で最も苦労した点を教えていただけますか？
5. その苦労をどのように乗り越えられたのでしょうか？特に印象的だったエピソードがあればお聞かせください。
6. その経験から学んだことは何でしょうか？それが今の活動にどう活かされていますか？
...`
    }

    const result = await model.generateContent(prompt)
    const response = await result.response
    let questions = response.text()

    // 説明文や前置きを除去（番号付きリストの前のテキストを削除）
    const lines = questions.split('\n')
    let startIndex = 0
    
    // 最初の番号付きリスト（1. または 1) など）を見つける
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (/^[0-9]+[\.\)、]\s/.test(line)) {
        startIndex = i
        break
      }
    }
    
    // 番号付きリストの前の説明文を除去
    if (startIndex > 0) {
      questions = lines.slice(startIndex).join('\n')
    }
    
    // 最後の説明文も除去（番号付きリストの後に続くテキストを削除）
    const questionLines = questions.split('\n')
    let endIndex = questionLines.length
    
    // 最後の番号付きリストの後に説明文がないか確認
    for (let i = questionLines.length - 1; i >= 0; i--) {
      const line = questionLines[i].trim()
      if (line.length === 0) {
        continue
      }
      if (/^[0-9]+[\.\)、]\s/.test(line)) {
        endIndex = i + 1
        break
      }
      // 番号付きリストでない行が見つかったら、その前まで
      if (!/^[0-9]+[\.\)、]\s/.test(line)) {
        endIndex = i
        break
      }
    }
    
    questions = questionLines.slice(0, endIndex).join('\n').trim()

    // 解説を生成
    let explanation = ''
    try {
      const explanationPrompt = `あなたは経験豊富なプロのインタビュアーです。以下の質問セットについて、専門家としての観点から解説を生成してください。

【生成された質問】
${questions}

【ターゲット読者】
${targetAudience}

【掲載メディア】
${mediaType}

【取材の目的】
${interviewPurpose}

【具体的な質問（箇条書き）】
${objective}

${skillKnowledgeContext ? `【スキルナレッジベース（質問設計・対話設計のベストプラクティス）】\n${skillKnowledgeContext.substring(0, 4000)}\n` : ''}

【解説の要件】
以下の2つの観点から解説を生成してください：

1. **なぜこのような質問を採用したのか（スキルナレッジを背景とした、専門家としての観点）**
   - スキルナレッジベースに基づく質問設計の理論的背景
   - プロのインタビュアーとしての観点から見た質問の選定理由
   - 質問の順序や構成の意図
   - 効果的なインタビューを実現するための戦略

2. **どう4つの質問内容にフィットした質問になっているか**
   - ターゲット読者（${targetAudience}）に響く質問になっている理由
   - 掲載メディア（${mediaType}）に適した質問の深さやトーンになっている理由
   - 取材の目的（${interviewPurpose}）を達成するための質問構成になっている理由
   - 具体的な質問（${objective}）をどのように発展させたか

【出力形式】
以下の形式で出力してください：

## 質問採用の理由（専門家としての観点）

（スキルナレッジベースを背景とした、専門家としての観点から説明）

## 4つの質問内容への適合性

（ターゲット読者、掲載メディア、取材の目的、具体的な質問への適合性を説明）

【重要】
- 専門的で具体的な解説を提供してください
- スキルナレッジベースの内容を引用しながら説明してください
- 各質問がなぜ選ばれたのか、どのような効果が期待できるかを説明してください`

      const explanationResult = await model.generateContent(explanationPrompt)
      const explanationResponse = await explanationResult.response
      explanation = explanationResponse.text()
    } catch (explanationError) {
      console.warn('⚠️ Error generating explanation:', explanationError)
      // 解説の生成に失敗しても質問は返す
    }

    return NextResponse.json({
      questions,
      explanation: explanation || undefined,
      success: true,
    })
  } catch (error) {
    console.error('❌ Error generating questions:', error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      geminiApiKey: process.env.GEMINI_API_KEY ? 'Set' : 'Not set',
      adminDbInitialized: adminDb !== null,
      adminAppsLength: admin.apps.length,
    })
    
    // Check for specific Gemini API errors
    let userFriendlyMessage = '質問の生成に失敗しました'
    let hint = 'サーバーログを確認してください'
    
    if (errorMessage.includes('API_KEY_SERVICE_BLOCKED') || errorMessage.includes('403 Forbidden')) {
      userFriendlyMessage = 'Gemini APIがブロックされています'
      hint = 'Google Cloud ConsoleでGemini APIが有効化されているか確認してください。また、APIキーが正しく設定されているか確認してください。'
    } else if (errorMessage.includes('API key')) {
      hint = 'GEMINI_API_KEY環境変数を確認してください'
    } else if (errorMessage.includes('model') && errorMessage.includes('not found')) {
      userFriendlyMessage = '指定されたモデルが見つかりません'
      hint = 'モデル名を確認してください（gemini-1.5-flash または gemini-1.5-pro を使用）'
    } else if (errorMessage.includes('Firebase')) {
      hint = 'Firebase Admin SDKの初期化を確認してください'
    }
    
    return NextResponse.json(
      { 
        error: userFriendlyMessage,
        details: errorMessage,
        hint: hint,
        helpUrl: errorMessage.includes('API_KEY_SERVICE_BLOCKED') 
          ? 'https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com'
          : undefined,
      },
      { status: 500 }
    )
  }
}

