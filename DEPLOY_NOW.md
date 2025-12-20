# Firebase デプロイ手順

## ⚠️ 重要
ネットワークドライブでのビルドエラーが発生しているため、**ローカルのターミナルで実行**してください。

## デプロイ前の確認事項

### 1. 環境変数の確認
`.env.local` ファイルに以下が設定されているか確認してください：
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `GEMINI_API_KEY`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- その他の必要な環境変数

### 2. Firebase CLI のログイン確認
```bash
firebase login
firebase projects:list
```

## デプロイ手順

### ステップ1: プロジェクトのビルド

```bash
# プロジェクトルートで
cd /Volumes/T5c_1TB/BanKisha

# 依存関係の確認
npm install

# Next.jsアプリのビルド
npm run build
```

**注意**: ネットワークドライブでエラーが出る場合は、ローカルのSSDにコピーしてからビルドしてください。

### ステップ2: Firebase Functions のビルド

```bash
cd functions
npm install
npm run build
cd ..
```

### ステップ3: Firestore Rules と Storage Rules のデプロイ

```bash
# Firestore Rules
firebase deploy --only firestore:rules

# Storage Rules
firebase deploy --only storage:rules
```

### ステップ4: Firebase Functions のデプロイ

```bash
firebase deploy --only functions
```

### ステップ5: Next.js アプリのデプロイ（Cloud Run）

現在の設定では、Next.jsアプリはCloud Runにデプロイされます。

```bash
# Cloud Runにデプロイ（package.jsonのdeploy:quickスクリプトを使用）
npm run deploy:quick
```

または、手動で：

```bash
# ビルド
npm run build

# Cloud Runにデプロイ
gcloud run deploy bankisha-app \
  --image gcr.io/bankisha-654d0/bankisha-app:latest \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated
```

### ステップ6: Firebase Hosting の設定確認

Firebase Hostingは、Cloud Runへのリライト設定になっています。
`firebase.json` の設定を確認してください。

### ステップ7: 全体のデプロイ（オプション）

すべてを一度にデプロイする場合：

```bash
firebase deploy
```

## デプロイ後の確認

1. **Firebase Hosting URL**: `https://bankisha-654d0.web.app`
2. **Cloud Run URL**: `https://bankisha-app-xxxxx-an.a.run.app`
3. **動作確認**:
   - ログインページが表示されるか
   - インタビュー作成ができるか
   - 記事生成ができるか

## トラブルシューティング

### ビルドエラーが出る場合
- ネットワークドライブではなく、ローカルのSSDでビルドしてください
- `.next` ディレクトリを削除してから再ビルド: `rm -rf .next && npm run build`

### デプロイエラーが出る場合
- Firebase CLIが最新か確認: `npm install -g firebase-tools@latest`
- ログイン状態を確認: `firebase login:list`
- プロジェクトIDを確認: `firebase use`

### 環境変数が読み込めない場合
- Cloud Runの環境変数を設定: Google Cloud Console → Cloud Run → 環境変数
- Firebase Functionsの環境変数を設定: `firebase functions:config:set`

## クイックデプロイコマンド

```bash
# すべてを一度にデプロイ
npm run build && \
cd functions && npm run build && cd .. && \
firebase deploy --only firestore:rules,storage:rules,functions && \
npm run deploy:quick
```

