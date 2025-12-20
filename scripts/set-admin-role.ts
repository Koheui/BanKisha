/**
 * 既存ユーザーを管理者に設定するスクリプト
 * 
 * 実行方法:
 * 1. Firebase Admin SDKの認証情報を設定（service-account-key.json）
 * 2. ts-node scripts/set-admin-role.ts <email>
 * 
 * 例: ts-node scripts/set-admin-role.ts office@futurestudio.co.jp
 */

import * as admin from 'firebase-admin'
import * as path from 'path'
import * as fs from 'fs'

// Initialize Firebase Admin
let initialized = false

// Method 1: Try service account key file
try {
  const serviceAccountPath = path.join(__dirname, '../service-account-key.json')
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath)
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id
    })
    initialized = true
    console.log('✅ Firebase Admin SDK initialized from service-account-key.json')
  }
} catch (error) {
  // Continue to next method
}

// Method 2: Try environment variables
if (!initialized) {
  try {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
    if (projectId) {
      admin.initializeApp({
        projectId: projectId
      })
      initialized = true
      console.log('✅ Firebase Admin SDK initialized from environment variables')
    }
  } catch (error) {
    // Continue to error handling
  }
}

if (!initialized) {
  console.error('❌ Error: Firebase Admin SDK could not be initialized')
  console.error('\n以下のいずれかの方法で認証情報を設定してください:')
  console.error('\n方法1: サービスアカウントキーファイルを作成')
  console.error('1. Firebase Console > プロジェクト設定 > サービスアカウント')
  console.error('2. 「新しい秘密鍵の生成」をクリック')
  console.error('3. ダウンロードしたJSONファイルを service-account-key.json としてプロジェクトルートに配置')
  process.exit(1)
}

const db = admin.firestore()
const auth = admin.auth()

async function setAdminRole(email: string) {
  try {
    console.log(`ユーザー "${email}" を管理者に設定中...`)

    // Get user by email
    const user = await auth.getUserByEmail(email)
    console.log(`✅ ユーザーが見つかりました: ${user.uid}`)

    // Update user document in Firestore
    const userRef = db.collection('users').doc(user.uid)
    const userDoc = await userRef.get()

    if (userDoc.exists) {
      // Update existing user to admin
      await userRef.update({
        role: 'admin',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
      console.log('✅ ユーザードキュメントを管理者に更新しました')
    } else {
      // Create new user document
      await userRef.set({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '管理者',
        role: 'admin',
        companyId: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
      console.log('✅ ユーザードキュメントを作成しました（管理者ロール）')
    }

    console.log(`\n✅ "${email}" を管理者に設定しました！`)

  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message)
    if (error.code === 'auth/user-not-found') {
      console.error(`\nユーザー "${email}" が見つかりません。`)
      console.error('先にFirebase Console > Authentication > ユーザーからユーザーを作成してください。')
    }
    if (error.code) {
      console.error('エラーコード:', error.code)
    }
    process.exit(1)
  }
}

// Get email from command line arguments
const email = process.argv[2]

if (!email) {
  console.error('❌ エラー: メールアドレスを指定してください')
  console.error('\n使用方法:')
  console.error('  npm run set:admin <email>')
  console.error('\n例:')
  console.error('  npm run set:admin office@futurestudio.co.jp')
  process.exit(1)
}

// Run the script
setAdminRole(email)
  .then(() => {
    console.log('\nスクリプトが正常に完了しました')
    process.exit(0)
  })
  .catch((error) => {
    console.error('スクリプト実行エラー:', error)
    process.exit(1)
  })

