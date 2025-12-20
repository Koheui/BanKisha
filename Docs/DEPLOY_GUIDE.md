# BanKisha デプロイガイド

## 前提条件

### 必要なツール
- Node.js 20.x
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase プロジェクト

## デプロイ手順

### ステップ1: Firebase プロジェクトの確認・作成

#### 1.1 Firebase にログイン
```bash
firebase login
```

#### 1.2 Firebase プロジェクトを作成（未作成の場合）
Firebaseコンソール（https://console.firebase.google.com/）で新規プロジェクトを作成

#### 1.3 プロジェクトを初期化
```bash
# プロジェクトIDを確認
firebase projects:list

# プロジェクトを設定
firebase use <your-project-id>

# または .firebaserc を作成
cat > .firebaserc << EOF
{
  "projects": {
    "default": "<your-project-id>"
  }
}
EOF
```

---

### ステップ2: 環境変数の設定

#### 2.1 Firebase プロジェクト設定を取得
1. Firebaseコンソール → プロジェクト設定 → 一般
2. 「マイアプリ」セクションでウェブアプリを作成（未作成の場合）
3. 設定値をコピー

#### 2.2 `.env.local` を作成
```bash
cp env.example .env.local
```

`.env.local` に以下を設定:
```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:xxxxx

# Gemini API Key
GEMINI_API_KEY=your_gemini_api_key

# OpenAI API Key (音声認識用)
OPENAI_API_KEY=sk-xxxxx

# Firebase Admin SDK
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@your_project.iam.gserviceaccount.com

# Application Settings
NEXT_PUBLIC_MEDIA_BRAND_NAME=BanKisha
NEXT_PUBLIC_BASE_URL=https://your-project.web.app
```

#### 2.3 Firebase Functions の環境変数を設定
```bash
# Gemini API Key
firebase functions:config:set gemini.api_key="your_gemini_api_key"

# Gmail SMTP（メール通知を使う場合）
firebase functions:config:set gmail.user="your_gmail@gmail.com"
firebase functions:config:set gmail.app_password="your_app_password"
```

---

### ステップ3: Firebase Functions のビルドとデプロイ

#### 3.1 依存関係のインストール
```bash
cd functions
npm install
```

#### 3.2 ビルド
```bash
npm run build
```

#### 3.3 Functions のデプロイ
```bash
cd ..
firebase deploy --only functions
```

**エラーが出た場合**:
- `npm run lint` でエラーがないか確認
- `functions/lib/` にビルド結果があるか確認

---

### ステップ4: Firestore Rules と Indexes のデプロイ

#### 4.1 Firestore Rules
```bash
firebase deploy --only firestore:rules
```

#### 4.2 Firestore Indexes
```bash
firebase deploy --only firestore:indexes
```

**注意**: インデックスの作成には数分かかる場合があります。

---

### ステップ5: Storage Rules のデプロイ

```bash
firebase deploy --only storage
```

---

### ステップ6: Next.js アプリのビルドとデプロイ

#### 6.1 依存関係のインストール
```bash
npm install
```

#### 6.2 本番ビルド
```bash
npm run build
```

#### 6.3 静的エクスポート（Firebase Hosting用）
```bash
npm run export
```

**注意**: `package.json` に以下のスクリプトを追加する必要があります:
```json
{
  "scripts": {
    "export": "next export"
  }
}
```

または、Next.js 13以降の場合は `next.config.js` に:
```javascript
module.exports = {
  output: 'export',
  // ...
}
```

#### 6.4 Firebase Hosting にデプロイ
```bash
firebase deploy --only hosting
```

---

### ステップ7: 初期データの投入

#### 7.1 デフォルト質問セットの作成
```bash
npx ts-node scripts/init-firestore.ts
```

#### 7.2 管理者ユーザーの作成
```bash
npx ts-node scripts/create-admin-user.ts
```

または、Firebase Functions経由:
```bash
# Functions がデプロイ済みの場合
curl -X POST https://<region>-<project-id>.cloudfunctions.net/createAdminUser \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "secure-password",
    "displayName": "Admin User"
  }'
```

---

### ステップ8: デプロイの確認

#### 8.1 アプリにアクセス
```
https://<your-project-id>.web.app
```

#### 8.2 動作確認
1. ログインページが表示されるか
2. 新規ユーザー登録ができるか
3. ダッシュボードにアクセスできるか

---

## よくあるエラーと対処法

### エラー1: "Permission denied" (Firestore Rules)
**原因**: Firestore Rulesが正しくデプロイされていない

**対処法**:
```bash
firebase deploy --only firestore:rules
```

### エラー2: Functions のビルドエラー
**原因**: TypeScriptのエラー、依存関係の問題

**対処法**:
```bash
cd functions
npm install
npm run build
# エラーメッセージを確認して修正
```

### エラー3: 環境変数が読み込めない
**原因**: `.env.local` が正しく設定されていない

**対処法**:
- `.env.local` ファイルが存在するか確認
- 環境変数名が `NEXT_PUBLIC_` で始まっているか確認（クライアント側で使用する場合）
- サーバー側で使用する変数は `NEXT_PUBLIC_` なしで設定

### エラー4: Storage Rules エラー
**原因**: Storage Rulesが正しく設定されていない

**対処法**:
`storage.rules` を確認:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /covers/{companyId}/{fileName} {
      allow write: if request.auth != null;
      allow read: if true;
    }
    match /audio/{companyId}/{fileName} {
      allow write: if request.auth != null;
      allow read: if request.auth != null;
    }
  }
}
```

### エラー5: "Module not found" エラー
**原因**: 依存関係がインストールされていない

**対処法**:
```bash
# ルートディレクトリ
npm install

# Functions
cd functions
npm install
cd ..
```

---

## 全体を一度にデプロイ

```bash
# すべてをデプロイ
firebase deploy
```

これには以下が含まれます:
- Firestore Rules
- Firestore Indexes
- Storage Rules
- Firebase Functions
- Firebase Hosting

---

## デプロイ後のチェックリスト

- [ ] Firebase Hosting にアプリがデプロイされた
- [ ] Firebase Functions がデプロイされた
- [ ] Firestore Rules がデプロイされた
- [ ] Storage Rules がデプロイされた
- [ ] 環境変数が正しく設定されている
- [ ] 初期データ（質問セット）が投入されている
- [ ] 管理者ユーザーが作成されている
- [ ] ログインができる
- [ ] インタビュー作成ができる
- [ ] 記事生成ができる

---

## ロールバック

問題が発生した場合:

```bash
# 以前のバージョンに戻す
firebase hosting:clone <source-site-id>:<channel-or-version-id> <target-site-id>:live
```

---

## 継続的デプロイ (CI/CD)

GitHub Actions を使用する場合、`.github/workflows/firebase-deploy.yml` を作成:

```yaml
name: Deploy to Firebase

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_FIREBASE_API_KEY: ${{ secrets.FIREBASE_API_KEY }}
          # ... 他の環境変数
      
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
          projectId: your-project-id
```

---

## サポート

問題が発生した場合:
1. Firebase コンソールでログを確認
2. `firebase-debug.log` を確認
3. ブラウザの開発者ツールでエラーを確認

