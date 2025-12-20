# Firebase プロジェクト作成ガイド（簡易版）

## ステップ1: Firebaseプロジェクトを作成

1. [Firebase Console](https://console.firebase.google.com/)にアクセス
2. Googleアカウントでログイン
3. 「プロジェクトを追加」をクリック
4. プロジェクト名を入力（例: `bankisha`）
5. Google Analyticsは「今は設定しない」を選択（後で有効化可能）
6. 「プロジェクトを作成」をクリック
7. 数秒待って「続行」をクリック

## ステップ2: Authentication（認証）を有効化

1. 左メニューから「Authentication」をクリック
2. 「始める」をクリック
3. 「Sign-in method」タブをクリック
4. 「メール/パスワード」をクリック
5. 「有効にする」をトグルしてONにする
6. 「保存」をクリック

## ステップ3: Firestore Database（データベース）を作成

1. 左メニューから「Firestore Database」をクリック
2. 「データベースを作成」をクリック
3. **「本番環境モードで開始」を選択**（重要）
4. ロケーションを選択（`asia-northeast1 (Tokyo)` 推奨）
5. 「有効にする」をクリック

## ステップ4: Storage（ファイル保存）を有効化

1. 左メニューから「Storage」をクリック
2. 「始める」をクリック
3. セキュリティルールはデフォルトのまま「次へ」
4. ロケーションを選択（`asia-northeast1 (Tokyo)` 推奨）
5. 「完了」をクリック

## ステップ5: Functions（サーバー関数）を有効化

1. 左メニューから「Functions」をクリック
2. 「始める」をクリック
3. Node.js 18を選択
4. 「次へ」→「完了」をクリック

## ステップ6: Webアプリの設定を取得

1. 左メニューの⚙️アイコン（プロジェクト設定）をクリック
2. 「全般」タブで下にスクロール
3. 「アプリを追加」→「Web」アイコン（</>）をクリック
4. アプリのニックネームを入力（例: `bankisha-web`）
5. 「このアプリのFirebase Hostingも設定する」はチェックしない
6. 「アプリを登録」をクリック
7. 表示された設定値をコピー（後で使用します）

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## ステップ7: 環境変数ファイルを作成

プロジェクトルートで以下を実行：

```bash
cp env.example .env.local
```

`.env.local`ファイルを開いて、Firebase設定を入力：

```env
# Firebase設定
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123

# Firebase Functions URL（開発環境）
NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL=http://localhost:5001/your-project-id/us-central1

# Gemini API（必須）
GEMINI_API_KEY=your-gemini-api-key

# OpenAI API（音声認識用）
OPENAI_API_KEY=your-openai-api-key
```

## ステップ8: Firestoreセキュリティルールを設定

Firebase Console > Firestore Database > ルールタブで以下を設定：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own user document
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Company data - companies can read their own data, admins can read all
    match /companies/{companyId} {
      allow read: if request.auth != null && 
        (resource.data.owner == request.auth.uid || userHasRole('admin'));
      allow write: if request.auth != null && 
        (resource.data.owner == request.auth.uid || userHasRole('admin'));
      allow create: if request.auth != null && 
        (request.resource.data.owner == request.auth.uid || userHasRole('admin'));
    }
    
    // Articles - companies can read/write their own articles, admins can read/write all
    match /articles/{articleId} {
      allow read: if request.auth != null && 
        (resource.data.companyId == getCompanyId(request.auth.uid) || userHasRole('admin'));
      allow write: if request.auth != null && 
        (request.resource.data.companyId == getCompanyId(request.auth.uid) || userHasRole('admin'));
      allow create: if request.auth != null && 
        (request.resource.data.companyId == getCompanyId(request.auth.uid) || userHasRole('admin'));
    }
    
    // Question sets - readable by all authenticated users
    match /questionSets/{questionSetId} {
      allow read: if request.auth != null;
      allow write: if userHasRole('admin');
    }
    
    // Sessions - readable by company users and admins
    match /sessions/{sessionId} {
      allow read: if request.auth != null && 
        (resource.data.companyId == getCompanyId(request.auth.uid) || userHasRole('admin'));
      allow write: if request.auth != null && 
        (resource.data.companyId == getCompanyId(request.auth.uid) || userHasRole('admin'));
    }
    
    // Knowledge Bases - only admins can manage
    match /knowledgeBases/{knowledgeBaseId} {
      allow read: if request.auth != null;
      allow write: if userHasRole('admin');
    }
    
    // Knowledge Chunks - readable by all authenticated users (for search)
    match /knowledgeChunks/{chunkId} {
      allow read: if request.auth != null;
      allow write: if userHasRole('admin');
    }
    
    // Helper functions
    function userHasRole(role) {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == role;
    }
    
    function getCompanyId(uid) {
      return get(/databases/$(database)/documents/users/$(uid)).data.companyId;
    }
  }
}
```

「公開」をクリックして保存

## ステップ9: Storageセキュリティルールを設定

Firebase Console > Storage > ルールタブで以下を設定：

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Audio files - users can upload their own
    match /audio/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Knowledge base PDFs - only admins can upload
    match /knowledge-bases/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

「公開」をクリックして保存

## 完了！

これでFirebaseプロジェクトのセットアップが完了しました。

次に、開発サーバーを再起動してください：

```bash
npm run dev
```

ブラウザで http://localhost:3000 にアクセスして確認してください。

## トラブルシューティング

### エラー: "Firebase設定が完了していません"
- `.env.local`ファイルが正しく作成されているか確認
- 環境変数名が`NEXT_PUBLIC_`で始まっているか確認
- 開発サーバーを再起動

### エラー: "Permission denied"
- Firestoreセキュリティルールが正しく設定されているか確認
- ユーザーがログインしているか確認

### エラー: "Storage permission denied"
- Storageセキュリティルールが正しく設定されているか確認


