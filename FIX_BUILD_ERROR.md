# Cloud Build エラーの修正

## 問題の原因

`gcloud builds submit`で環境変数を渡していないため、DockerfileのARGが空になり、ビルドが失敗していました。

## 修正内容

1. **DockerfileのARGにデフォルト値を設定**
   - ARGが空でもビルドが通るようにデフォルト値を設定
   - 環境変数は実行時にCloud Runから注入されるため、ビルド時は空でも問題ありません

2. **環境変数の扱い**
   - ビルド時: ARGで受け取る（オプション、デフォルト値あり）
   - 実行時: Cloud Runの環境変数から注入される

## 修正後のビルド方法

### 方法1: 環境変数なしでビルド（推奨）

```bash
# 環境変数なしでビルド（実行時にCloud Runから注入される）
gcloud builds submit --tag gcr.io/bankisha-654d0/bankisha-app:latest
```

### 方法2: 環境変数を指定してビルド

```bash
# 環境変数を指定（オプション）
gcloud builds submit \
  --tag gcr.io/bankisha-654d0/bankisha-app:latest \
  --substitutions=_NEXT_PUBLIC_FIREBASE_API_KEY="your-key",...
```

## デプロイ

ビルド後、環境変数を設定してデプロイ：

```bash
gcloud run deploy bankisha-app \
  --image gcr.io/bankisha-654d0/bankisha-app:latest \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID,NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID,NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL=$NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL,GEMINI_API_KEY=$GEMINI_API_KEY"
```

## 現在の状況

✅ **デプロイは成功しています**
- サービスURL: `https://bankisha-app-804747870600.asia-northeast1.run.app`
- 既存のイメージで動作中

⚠️ **新しいコードを反映するには**
- 修正後のDockerfileで再ビルドが必要
- または、GitHub Actionsを使用（自動でビルド＆デプロイ）

## 次のステップ

1. 修正後のDockerfileで再ビルド
2. または、GitHubにプッシュしてGitHub Actionsで自動デプロイ

