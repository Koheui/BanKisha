/**
 * スーパーアドミン設定スクリプト（直接Firestore書き込み）
 * 
 * 実行方法:
 * node scripts/set-superadmin-direct.js [CLERK_USER_ID] [EMAIL]
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, serverTimestamp } = require('firebase/firestore');

// Firebase設定
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// 引数チェック
const clerkUserId = process.argv[2];
const email = process.argv[3] || 'office@futurestudio.co.jp';

if (!clerkUserId) {
  console.error('❌ エラー: Clerk User IDを指定してください');
  console.log('使用法: node scripts/set-superadmin-direct.js [CLERK_USER_ID] [EMAIL]');
  process.exit(1);
}

// 環境変数をチェック
if (!firebaseConfig.apiKey) {
  console.error('❌ エラー: 環境変数が設定されていません');
  console.error('以下のコマンドで実行してください:');
  console.error('source .env.local && node scripts/set-superadmin-direct.js [UID]');
  process.exit(1);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function setSuperAdmin() {
  try {
    console.log(`📝 Firestoreに ${email} (UID: ${clerkUserId}) を role: superAdmin として書き込み中...`);

    // Write to Firestore
    const userRef = doc(db, 'users', clerkUserId);
    await setDoc(userRef, {
      email: email,
      displayName: 'Super Admin',
      role: 'superAdmin',
      uid: clerkUserId,
      updatedAt: serverTimestamp()
    }, { merge: true });

    console.log(`\n✅ ${email} をsuperAdminに設定しました！`);
    console.log(`\nユーザー情報:`);
    console.log(`- UID: ${clerkUserId}`);
    console.log(`- Email: ${email}`);
    console.log(`- Role: superAdmin`);
    console.log(`\n🎉 完了！`);

  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

setSuperAdmin();


