/**
 * スーパーアドミン設定スクリプト（直接Firestore書き込み）
 * 
 * 実行方法:
 * node scripts/set-superadmin-direct.js
 */

const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
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

// 環境変数をチェック
if (!firebaseConfig.apiKey) {
  console.error('❌ エラー: 環境変数が設定されていません');
  console.error('以下のコマンドで実行してください:');
  console.error('source .env.local && node scripts/set-superadmin-direct.js');
  process.exit(1);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function setSuperAdmin() {
  const email = 'office@futurestudio.co.jp';
  const password = '12345678';
  
  try {
    console.log(`\n🔐 ${email} でログイン中...`);
    
    // Sign in with user credentials
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    console.log(`✅ ログイン成功: ${user.uid}`);
    console.log(`📝 Firestoreにrole: superAdminを書き込み中...`);
    
    // Write to Firestore
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      email: user.email,
      displayName: user.displayName || 'Super Admin',
      role: 'superAdmin',
      uid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    console.log(`\n✅ ${email} をsuperAdminに設定しました！`);
    console.log(`\nユーザー情報:`);
    console.log(`- UID: ${user.uid}`);
    console.log(`- Email: ${user.email}`);
    console.log(`- Role: superAdmin`);
    console.log(`\n🎉 完了！ブラウザでログアウト→ログインし直してください。`);
    
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error.message);
    
    if (error.code === 'auth/user-not-found') {
      console.error(`\n先にFirebase Authenticationでユーザーを作成してください`);
    } else if (error.code === 'auth/wrong-password') {
      console.error(`\nパスワードが間違っています`);
    } else if (error.code === 'permission-denied') {
      console.error(`\nFirestore権限エラー: firestore.rulesを確認してください`);
    }
    
    process.exit(1);
  }
  
  process.exit(0);
}

setSuperAdmin();


