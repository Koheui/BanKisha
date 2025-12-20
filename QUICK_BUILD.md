# クイックビルドガイド

## 基本的なビルドコマンド

### ステップ1: ビルド

```bash
gcloud builds submit --tag gcr.io/bankisha-654d0/bankisha-app:latest
```

このコマンドで、修正後のDockerfileを使用してビルドが実行されます。

**所要時間**: 約5-10分

### ステップ2: ビルド状況の確認

別のターミナルで以下を実行して進行状況を確認：

```bash
# 最新のビルドを確認
gcloud builds list --limit=1

# ビルドIDを取得してログを表示
gcloud builds log <BUILD_ID>
```

または、[Cloud Build コンソール](https://console.cloud.google.com/cloud-build/builds?project=bankisha-654d0)で確認

### ステップ3: ビルド成功後のデプロイ

```bash
# 環境変数を読み込む
source .env.local

# Cloud Runにデプロイ
gcloud run deploy bankisha-app \
  --image gcr.io/bankisha-654d0/bankisha-app:latest \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID,NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID,NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL=$NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL,GEMINI_API_KEY=$GEMINI_API_KEY"
```

## エラーが出た場合

### エラー: "Permission denied" または "Access denied"

```bash
# プロジェクトが正しく設定されているか確認
gcloud config get-value project

# プロジェクトを設定
gcloud config set project bankisha-654d0

# 認証を確認
gcloud auth list
```

### エラー: "API not enabled"

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### エラー: "Build failed"

1. **ビルドログを確認**
   ```bash
   gcloud builds list --limit=1
   gcloud builds log <BUILD_ID>
   ```

2. **ローカルでDockerfileをテスト**（オプション）
   ```bash
   docker build -t test-image .
   ```

3. **エラーの詳細を確認**
   - [Cloud Build コンソール](https://console.cloud.google.com/cloud-build/builds?project=bankisha-654d0)でログを確認

## 成功の確認

ビルドが成功すると、以下のメッセージが表示されます：

```
SUCCESS
```

その後、デプロイを実行してください。

