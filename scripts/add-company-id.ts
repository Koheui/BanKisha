import * as admin from 'firebase-admin'
import * as path from 'path'
import * as fs from 'fs'

// Initialize Firebase Admin
let initialized = false

// Method 1: Try service account key file
try {
  const serviceAccountPath = path.join(__dirname, '../Keys/bankisha-654d0-b46f8ce3b8d9.json')
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
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
      console.log('✅ Firebase Admin SDK initialized with project ID:', projectId)
    }
  } catch (error) {
    // Continue
  }
}

if (!initialized) {
  console.error('❌ Firebase Admin SDK の初期化に失敗しました')
  console.error('以下のいずれかを設定してください:')
  console.error('1. service-account-key.json ファイルをプロジェクトルートに配置')
  console.error('2. FIREBASE_PROJECT_ID 環境変数を設定')
  process.exit(1)
}

const db = admin.firestore()

async function addCompanyIdToUser(email: string, companyId?: string) {
  try {
    // Find user by email
    const usersSnapshot = await db.collection('users').where('email', '==', email).get()
    
    if (usersSnapshot.empty) {
      console.error(`❌ ユーザーが見つかりません: ${email}`)
      return
    }

    const userDoc = usersSnapshot.docs[0]
    const userId = userDoc.id
    const userData = userDoc.data()

    // If companyId not provided, create a new company
    let finalCompanyId = companyId
    
    if (!finalCompanyId) {
      console.log('📝 新しい会社を作成中...')
      const companyRef = await db.collection('companies').add({
        name: `${userData.displayName || email}の会社`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
      finalCompanyId = companyRef.id
      console.log(`✅ 会社を作成しました: ${finalCompanyId}`)
    }

    // Update user with companyId
    await db.collection('users').doc(userId).update({
      companyId: finalCompanyId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    })

    console.log(`✅ ユーザーに companyId を設定しました`)
    console.log(`   Email: ${email}`)
    console.log(`   User ID: ${userId}`)
    console.log(`   Company ID: ${finalCompanyId}`)
  } catch (error) {
    console.error('❌ エラーが発生しました:', error)
  }
}

// Get email from command line arguments
const email = process.argv[2]
const companyId = process.argv[3]

if (!email) {
  console.log('使用方法:')
  console.log('  npm run add-company-id <email> [companyId]')
  console.log('')
  console.log('例:')
  console.log('  npm run add-company-id office@futurestudio.co.jp')
  console.log('  npm run add-company-id office@futurestudio.co.jp existing-company-id')
  process.exit(1)
}

addCompanyIdToUser(email, companyId)
  .then(() => {
    console.log('\n✅ 完了しました')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ エラー:', error)
    process.exit(1)
  })

