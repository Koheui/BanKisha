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
        const { articleId } = await request.json()

        if (!articleId) {
            return NextResponse.json({ error: '記事IDが必要です' }, { status: 400 })
        }

        const geminiApiKey = process.env.GEMINI_API_KEY
        if (!geminiApiKey) {
            return NextResponse.json({ error: 'Gemini API Keyが設定されていません' }, { status: 500 })
        }

        // 記事データの取得
        const articleDoc = await adminDb.collection('articles').doc(articleId).get()
        if (!articleDoc.exists) {
            return NextResponse.json({ error: '記事が見つかりません' }, { status: 404 })
        }

        const articleData = articleDoc.data()
        const draftArticle = articleData?.draftArticle

        if (!draftArticle) {
            return NextResponse.json({ error: '記事の内容がありません' }, { status: 400 })
        }

        // 取材データの取得（もしあれば）
        let interviewData = null
        if (articleData?.interviewId) {
            const interviewDoc = await adminDb.collection('interviews').doc(articleData.interviewId).get()
            if (interviewDoc.exists) {
                interviewData = interviewDoc.data()
            }
        }

        const genAI = new GoogleGenerativeAI(geminiApiKey)
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            generationConfig: {
                temperature: 0.2, // 解析的なタスクなので低めに設定
                responseMimeType: "application/json",
            },
        })

        const articleText = `
タイトル: ${draftArticle.title}
リード: ${draftArticle.lead}
${draftArticle.sections.map((s: any) => `## ${s.heading}\n${s.body}`).join('\n\n')}
`.trim()

        const prompt = `あなたは高度なコンテンツ解析AIです。提供された記事の内容と背景情報を分析し、SEOとコンテンツ管理に役立つ構造化メタデータ（仕訳）を生成してください。

【背景情報】
取材目的: ${interviewData?.interviewPurpose || '未指定'}
ターゲット: ${interviewData?.targetAudience || '未指定'}
メディアタイプ: ${interviewData?.mediaType || '未指定'}
カテゴリ: ${interviewData?.category || '未指定'}

【記事内容】
${articleText}

【出力形式】
以下のJSON形式で出力してください：
{
  "aiMetaVersion": 1,
  "summaryShort": "100文字程度の要約",
  "summaryLong": "300文字程度の詳細な要約",
  "keyPoints": ["要点1", "要点2", "要点3"],
  "topics": ["トピック1", "トピック2"],
  "industry": ["業界1", "業界2"],
  "intent": ["目的1（例: pr, recruit, sales, education）"],
  "audienceLevel": "beginner | practitioner | executive のいずれか",
  "entities": {
    "companies": ["登場する会社名"],
    "people": ["登場する人物名"],
    "products": ["登場する製品・サービス名"],
    "places": ["登場する地名・場所"]
  },
  "timeSensitivity": "evergreen | news | event のいずれか",
  "region": ["対象地域"],
  "faq": [{ "q": "想定される質問", "a": "記事に基づいた回答" }],
  "qualitySignals": {
    "firstPerson": true/false (一人称の体験談が含まれるか),
    "hasNumbers": true/false (具体的な数値が含まれるか),
    "hasQuotes": true/false (発言や引用が含まれるか)
  },
  "safetyFlags": {
    "piiRisk": true/false (個人情報の露出リスクがあるか),
    "claimsRisk": true/false (過度な主張やつじつまの合わない点があるか)
  }
}

注意事項：
- JSONのみを出力し、説明文は含めないでください。
- 記事の内容に基づいた客観的な分析を行ってください。
- entitiesは該当するものがない場合は空配列にしてください。`

        const result = await model.generateContent(prompt)
        const metadata = JSON.parse(result.response.text())

        // Firestoreの更新
        await adminDb.collection('articles').doc(articleId).update({
            aiMetadata: metadata,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        })

        return NextResponse.json({ success: true, metadata })
    } catch (error) {
        console.error('❌ Error generating metadata:', error)
        return NextResponse.json({
            error: 'メタデータの生成に失敗しました',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 })
    }
}
