/**
 * スーパーアドミン設定スクリプト
 * 
 * 実行方法:
 * ts-node scripts/set-superadmin.ts
 */

import * as admin from 'firebase-admin'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../service-account-key.json.json'), 'utf-8')
)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
})

const db = admin.firestore()
const auth = admin.auth()

async function setSuperAdmin() {
  const email = 'office@futurestudio.co.jp'
  
  try {
    console.log(`\n🔍 ${email} のユーザーを検索中...`)
    
    // Get user by email
    const userRecord = await auth.getUserByEmail(email)
    console.log(`✅ ユーザーが見つかりました: ${userRecord.uid}`)
    
    // Update Firestore document
    const userRef = db.collection('users').doc(userRecord.uid)
    const userDoc = await userRef.get()
    
    if (!userDoc.exists) {
      console.log('📝 Firestoreにユーザードキュメントを作成します...')
      await userRef.set({
        email: userRecord.email,
        displayName: userRecord.displayName || null,
        role: 'superAdmin',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
    } else {
      console.log('📝 Firestoreのユーザードキュメントを更新します...')
      await userRef.update({
        role: 'superAdmin',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
    }
    
    console.log(`\n✅ ${email} をsuperAdminに設定しました！`)
    console.log(`\nユーザー情報:`)
    console.log(`- UID: ${userRecord.uid}`)
    console.log(`- Email: ${userRecord.email}`)
    console.log(`- Role: superAdmin`)
    console.log(`\n🎉 完了！ログインし直してください。`)
    
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      console.error(`\n❌ エラー: ${email} のユーザーが見つかりません`)
      console.error(`\n先にFirebase Authenticationでユーザーを作成してください:`)
      console.error(`1. Firebase Console > Authentication`)
      console.error(`2. ユーザーを追加`)
      console.error(`   - Email: ${email}`)
      console.error(`   - Password: 12345678`)
    } else {
      console.error('\n❌ エラーが発生しました:', error)
    }
    process.exit(1)
  }
  
  process.exit(0)
}

setSuperAdmin()

