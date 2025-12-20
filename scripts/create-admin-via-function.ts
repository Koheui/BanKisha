/**
 * Firebase Functions経由で管理者ユーザーを作成するスクリプト
 * 
 * 実行方法:
 * 1. Firebase Functionsをデプロイ: npm run firebase:deploy -- --only functions
 * 2. ts-node scripts/create-admin-via-function.ts
 */

const email = 'office@futurestudio.co.jp'
const password = '12345678'
const displayName = '管理者'
const secret = 'bankisha-admin-setup-2024'

// Firebase Functions URL (本番環境)
const FUNCTIONS_URL = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL || 
  'https://us-central1-bankisha-654d0.cloudfunctions.net'

async function createAdminUser() {
  try {
    console.log('管理者ユーザーを作成中...')
    console.log(`Functions URL: ${FUNCTIONS_URL}`)

    const response = await fetch(`${FUNCTIONS_URL}/createAdminUser`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret,
        email,
        password,
        displayName
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to create admin user')
    }

    console.log('\n✅ 管理者ユーザーの作成が完了しました！')
    console.log(`メールアドレス: ${email}`)
    console.log(`パスワード: ${password}`)
    console.log(`ユーザーID: ${data.uid}`)
    console.log('\nこのアカウントでログインできます: http://localhost:3000/login')

  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message)
    if (error.message.includes('Failed to fetch')) {
      console.error('\nFirebase Functionsがデプロイされていない可能性があります。')
      console.error('以下のコマンドでデプロイしてください:')
      console.error('  npm run firebase:deploy -- --only functions')
    }
    process.exit(1)
  }
}

// Run the script
createAdminUser()
  .then(() => {
    console.log('\nスクリプトが正常に完了しました')
    process.exit(0)
  })
  .catch((error) => {
    console.error('スクリプト実行エラー:', error)
    process.exit(1)
  })

