# ビルドコマンド一覧

## 基本的なビルドコマンド

### 1. 環境変数なしでビルド（推奨）

```bash
gcloud builds submit --tag gcr.io/bankisha-654d0/bankisha-app:latest
```

このコマンドで、修正後のDockerfileを使用してビルドが実行されます。

### 2. ビルドログを確認

```bash
# 最新のビルドを確認
gcloud builds list --limit=1

# ビルドIDを取得してログを表示
gcloud builds log <BUILD_ID>
```

### 3. ビルド成功後のデプロイ

```bash
# 環境変数を読み込む
source .env.local

# Cloud Runにデプロイ（環境変数を設定）
gcloud run deploy bankisha-app \
  --image gcr.io/bankisha-654d0/bankisha-app:latest \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID,NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID,NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL=$NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL,GEMINI_API_KEY=$GEMINI_API_KEY"
```

## トラブルシューティング

### エラー: "Permission denied"
- プロジェクトが正しく設定されているか確認: `gcloud config get-value project`
- プロジェクトを設定: `gcloud config set project bankisha-654d0`

### エラー: "API not enabled"
```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### エラー: "Build failed"
- ビルドログを確認: `gcloud builds log <BUILD_ID>`
- ローカルでDockerfileをテスト: `docker build -t test .`

## 一括実行（ビルド + デプロイ）

```bash
# ビルド
gcloud builds submit --tag gcr.io/bankisha-654d0/bankisha-app:latest

# 環境変数を読み込む
source .env.local

# デプロイ
gcloud run deploy bankisha-app \
  --image gcr.io/bankisha-654d0/bankisha-app:latest \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID,NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID,NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL=$NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL,GEMINI_API_KEY=$GEMINI_API_KEY"
```

