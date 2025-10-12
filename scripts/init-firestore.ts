/**
 * Firestore初期データ投入スクリプト
 * 
 * 実行方法:
 * 1. Firebase Admin SDKの認証情報を設定
 * 2. ts-node scripts/init-firestore.ts
 */

import * as admin from 'firebase-admin'
import * as path from 'path'

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../service-account-key.json'))

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
})

const db = admin.firestore()

async function initQuestionSets() {
  console.log('質問セットを作成中...')

  const defaultQuestionSet = {
    title: '企業インタビュー - 基本セット',
    questions: [
      {
        id: '1',
        text: '会社名と事業内容を教えてください。',
        ttsTemplate: 'まず、御社の会社名と主な事業内容について教えていただけますか？'
      },
      {
        id: '2',
        text: '会社を設立した経緯やきっかけを教えてください。',
        ttsTemplate: '御社を設立されたきっかけや経緯について、詳しくお聞かせいただけますか？'
      },
      {
        id: '3',
        text: '提供しているサービスや製品の特徴を教えてください。',
        ttsTemplate: '御社が提供されているサービスや製品には、どのような特徴がありますか？'
      },
      {
        id: '4',
        text: '競合他社との差別化ポイントを教えてください。',
        ttsTemplate: '競合他社と比較して、御社ならではの強みや差別化ポイントは何でしょうか？'
      },
      {
        id: '5',
        text: '今後の展望や目標について教えてください。',
        ttsTemplate: '最後に、今後の展望や目標について教えていただけますか？'
      }
    ]
  }

  const ref = await db.collection('questionSets').add(defaultQuestionSet)
  console.log(`✅ 質問セット作成完了 ID: ${ref.id}`)

  return ref.id
}

async function createTestCompany(questionSetId: string) {
  console.log('テスト企業を作成中...')

  const testCompany = {
    name: 'テスト株式会社',
    description: 'これはテスト用の企業です',
    website: 'https://example.com',
    foundedYear: 2024,
    onboarded: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }

  const ref = await db.collection('companies').add(testCompany)
  console.log(`✅ テスト企業作成完了 ID: ${ref.id}`)

  // Create test session
  const testSession = {
    companyId: ref.id,
    questionSetId: questionSetId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    status: 'active'
  }

  const sessionRef = await db.collection('sessions').add(testSession)
  console.log(`✅ テストセッション作成完了 ID: ${sessionRef.id}`)
  console.log(`\n招待URL: http://localhost:3000/invite/${sessionRef.id}`)

  return ref.id
}

async function createAdminUser() {
  console.log('管理者ユーザーを作成中...')

  // Note: This requires Firebase Auth user to be created first
  // You'll need to manually create a user in Firebase Console or use Firebase Admin SDK

  console.log(`
⚠️  管理者ユーザーを作成するには:
1. Firebase Console > Authentication で新しいユーザーを作成
2. そのユーザーのUIDを取得
3. Firestoreの users/{uid} に以下のデータを追加:
   {
     email: "admin@example.com",
     displayName: "管理者",
     role: "admin",
     companyId: null,
     createdAt: Timestamp.now(),
     updatedAt: Timestamp.now()
   }
  `)
}

async function main() {
  try {
    console.log('🚀 Firestore初期化スクリプトを開始します...\n')

    const questionSetId = await initQuestionSets()
    await createTestCompany(questionSetId)
    await createAdminUser()

    console.log('\n✅ すべての初期データを作成しました！')
    console.log('\n次のステップ:')
    console.log('1. Firebase Consoleで管理者ユーザーを作成')
    console.log('2. 招待URLでインタビューをテスト')
    console.log('3. ダッシュボードで記事を管理')

    process.exit(0)
  } catch (error) {
    console.error('❌ エラーが発生しました:', error)
    process.exit(1)
  }
}

main()
