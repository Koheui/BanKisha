# 🚀 今すぐ実行するコマンド

## ステップ1: ビルドを実行

以下のコマンドを**1つずつ**実行してください：

```bash
gcloud builds submit --tag gcr.io/bankisha-654d0/bankisha-app:latest
```

**所要時間**: 約5-10分

このコマンドで、修正後のDockerfileを使用して新しいイメージがビルドされます。

---

## ステップ2: ビルドが成功したら、環境変数を設定してデプロイ

ビルドが成功したら（`SUCCESS`と表示されたら）、以下を実行：

```bash
# まず環境変数を読み込む
source .env.local
```

その後、以下を実行：

```bash
gcloud run deploy bankisha-app \
  --image gcr.io/bankisha-654d0/bankisha-app:latest \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID,NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID,NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL=$NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL,GEMINI_API_KEY=$GEMINI_API_KEY"
```

---

## 📋 コマンドをコピー&ペーストする場合

### コマンド1（ビルド）
```bash
gcloud builds submit --tag gcr.io/bankisha-654d0/bankisha-app:latest
```

### コマンド2（環境変数を読み込む）
```bash
source .env.local
```

### コマンド3（デプロイ）
```bash
gcloud run deploy bankisha-app --image gcr.io/bankisha-654d0/bankisha-app:latest --platform managed --region asia-northeast1 --allow-unauthenticated --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID,NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID,NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL=$NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL,GEMINI_API_KEY=$GEMINI_API_KEY"
```

---

## ⚠️ エラーが出た場合

### エラー: "Permission denied" または "Access denied"

```bash
# プロジェクトを確認・設定
gcloud config set project bankisha-654d0
```

### エラー: "API not enabled"

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### エラー: ".env.local not found"

`.env.local`ファイルが存在するか確認してください。存在しない場合は、`.env.local.example`をコピーして作成してください。

---

## ✅ 成功の確認

デプロイが成功すると、以下のようなメッセージが表示されます：

```
Service [bankisha-app] revision [bankisha-app-xxxxx] has been deployed and is serving 100 percent of traffic.
Service URL: https://bankisha-app-xxxxx.asia-northeast1.run.app
```

このURLにアクセスして、アプリが正常に動作するか確認してください。

