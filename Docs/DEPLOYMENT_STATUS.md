# デプロイ状況

## ✅ 完了したデプロイ

### 1. Firebase プロジェクト設定
- **プロジェクトID**: `bankisha-654d0`
- **ステータス**: 設定完了

### 2. Firestore Rules & Indexes
- **ステータス**: ✅ デプロイ完了
- **デプロイ日時**: 実行済み
- **確認**: Firebaseコンソールで確認可能

### 3. Storage Rules
- **ステータス**: ✅ デプロイ完了
- **デプロイ日時**: 実行済み
- **確認**: Firebaseコンソールで確認可能

### 4. Firebase Functions
- **ステータス**: ✅ デプロイ完了
- **Functions一覧**:
  - `generateArticle` - https://us-central1-bankisha-654d0.cloudfunctions.net/generateArticle
  - `onCreateUser` - 自動トリガー
  - `processKnowledgeBasePDF` - https://us-central1-bankisha-654d0.cloudfunctions.net/processKnowledgeBasePDF
  - `searchKnowledgeBase` - https://us-central1-bankisha-654d0.cloudfunctions.net/searchKnowledgeBase
  - `createAdminUser` - https://us-central1-bankisha-654d0.cloudfunctions.net/createAdminUser

## ⚠️ 次のステップ（必須）

### 1. 環境変数の設定

#### Firebase Functions の環境変数
```bash
# Gemini API Key（必須）
firebase functions:config:set gemini.api_key="YOUR_GEMINI_API_KEY"

# Gmail SMTP（メール通知を使う場合）
firebase functions:config:set gmail.user="your_gmail@gmail.com"
firebase functions:config:set gmail.app_password="your_app_password"

# 設定を反映
firebase deploy --only functions
```

#### Next.js アプリの環境変数
`.env.local` ファイルを作成:
```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=bankisha-654d0.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=bankisha-654d0
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=bankisha-654d0.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Gemini API Key
GEMINI_API_KEY=

# OpenAI API Key (音声認識用)
OPENAI_API_KEY=

# Firebase Admin SDK
FIREBASE_ADMIN_PROJECT_ID=bankisha-654d0
FIREBASE_ADMIN_PRIVATE_KEY=
FIREBASE_ADMIN_CLIENT_EMAIL=

# Application Settings
NEXT_PUBLIC_MEDIA_BRAND_NAME=BanKisha
NEXT_PUBLIC_BASE_URL=https://bankisha-654d0.web.app
```

### 2. 初期データの投入

#### デフォルト質問セットの作成
```bash
npx ts-node scripts/init-firestore.ts
```

#### 管理者ユーザーの作成
```bash
# オプション1: スクリプトから
npx ts-node scripts/create-admin-user.ts

# オプション2: Functions経由
curl -X POST https://us-central1-bankisha-654d0.cloudfunctions.net/createAdminUser \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@bankisha.com",
    "password": "secure-password-here",
    "displayName": "Admin User"
  }'
```

### 3. Next.js アプリのビルドとデプロイ

```bash
# 依存関係のインストール
npm install

# 本番ビルド
npm run build

# Firebase Hosting にデプロイ
firebase deploy --only hosting
```

**注意**: Next.js 13以降でFirebase Hostingにデプロイする場合、静的エクスポートが必要です。
`next.config.js` に以下を追加:
```javascript
module.exports = {
  output: 'export',
  images: {
    unoptimized: true,
  },
}
```

その後:
```bash
npm run build
firebase deploy --only hosting
```

## 📋 デプロイ後のチェックリスト

- [ ] Firebaseコンソールで Functions が正常に動作しているか確認
- [ ] Firebaseコンソールで Firestore Rules が設定されているか確認
- [ ] Firebaseコンソールで Storage Rules が設定されているか確認
- [ ] 環境変数（Gemini API Key等）が設定されているか確認
- [ ] 初期データ（質問セット）が投入されているか確認
- [ ] 管理者ユーザーが作成されているか確認
- [ ] Next.js アプリがビルドできるか確認
- [ ] Firebase Hosting にデプロイされているか確認
- [ ] アプリにアクセスしてログインできるか確認

## 🔗 重要なリンク

- **Firebaseコンソール**: https://console.firebase.google.com/project/bankisha-654d0/overview
- **Functions ログ**: https://console.firebase.google.com/project/bankisha-654d0/functions/logs
- **Firestore データ**: https://console.firebase.google.com/project/bankisha-654d0/firestore
- **Storage**: https://console.firebase.google.com/project/bankisha-654d0/storage
- **Hosting**: https://console.firebase.google.com/project/bankisha-654d0/hosting

## 📝 メモ

- Firebase Functions は Node.js 20 で動作
- 現在のNode.jsバージョンは v24.6.0（警告が出るが動作する）
- メール通知機能は一旦無効化済み（必要に応じて有効化可能）
- メディアサイト（`/media/*`）は今後実装予定

## ⚠️ トラブルシューティング

### Functions がエラーになる場合
1. Firebaseコンソールでログを確認
2. 環境変数が設定されているか確認: `firebase functions:config:get`
3. Functions を再デプロイ: `firebase deploy --only functions`

### Next.js ビルドエラー
1. 依存関係を再インストール: `rm -rf node_modules && npm install`
2. `.env.local` が正しく設定されているか確認
3. `npm run build` でエラーメッセージを確認

### 認証エラー
1. Firebase Authentication が有効になっているか確認
2. メール/パスワード認証が有効になっているか確認
3. Firebaseコンソールで確認: https://console.firebase.google.com/project/bankisha-654d0/authentication/providers

