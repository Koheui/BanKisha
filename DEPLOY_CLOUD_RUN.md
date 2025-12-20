# Cloud Run デプロイ手順

## ⚠️ 重要
この手順は**ローカルのターミナルで実行**してください。

## 前提条件

1. **Google Cloud SDK のインストールとログイン**
   ```bash
   # gcloud CLIがインストールされているか確認
   gcloud --version
   
   # ログイン
   gcloud auth login
   
   # プロジェクトを設定
   gcloud config set project bankisha-654d0
   ```

2. **必要なAPIの有効化**
   ```bash
   # Cloud Build API
   gcloud services enable cloudbuild.googleapis.com
   
   # Cloud Run API
   gcloud services enable run.googleapis.com
   
   # Container Registry API
   gcloud services enable containerregistry.googleapis.com
   ```

3. **環境変数の確認**
   `.env.local` ファイルから以下の環境変数を確認してください：
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL`
   - `GEMINI_API_KEY`

## デプロイ方法（2つの方法）

### 方法1: Cloud Buildを使用（推奨）

Cloud Buildを使用すると、環境変数を安全に管理できます。

#### ステップ1: 環境変数をCloud Buildの置換変数として設定

```bash
# 環境変数を読み込む（.env.localから）
source .env.local

# Cloud Buildの置換変数を設定
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_NEXT_PUBLIC_FIREBASE_API_KEY="$NEXT_PUBLIC_FIREBASE_API_KEY",_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",_NEXT_PUBLIC_FIREBASE_PROJECT_ID="$NEXT_PUBLIC_FIREBASE_PROJECT_ID",_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",_NEXT_PUBLIC_FIREBASE_APP_ID="$NEXT_PUBLIC_FIREBASE_APP_ID",_NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL="$NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL",_GEMINI_API_KEY="$GEMINI_API_KEY"
```

#### ステップ2: デプロイの確認

Cloud Buildのコンソールでビルドの進行状況を確認できます：
https://console.cloud.google.com/cloud-build/builds?project=bankisha-654d0

### 方法2: 直接デプロイ（シンプル）

#### ステップ1: DockerイメージをビルドしてGCRにプッシュ

```bash
# プロジェクトディレクトリに移動
cd /Volumes/T5c_1TB/BanKisha

# DockerイメージをビルドしてGCRにプッシュ
gcloud builds submit --tag gcr.io/bankisha-654d0/bankisha-app:latest
```

**注意**: この方法では、DockerfileのARGで指定された環境変数は使用されません。代わりに、Cloud Runの環境変数として設定します。

#### ステップ2: Cloud Runにデプロイ

```bash
# Cloud Runにデプロイ（環境変数を設定）
gcloud run deploy bankisha-app \
  --image gcr.io/bankisha-654d0/bankisha-app:latest \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID,NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID,NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL=$NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL,GEMINI_API_KEY=$GEMINI_API_KEY"
```

または、環境変数を個別に設定：

```bash
gcloud run deploy bankisha-app \
  --image gcr.io/bankisha-654d0/bankisha-app:latest \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY" \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID" \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID" \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID" \
  --set-env-vars="NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL=$NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL" \
  --set-env-vars="GEMINI_API_KEY=$GEMINI_API_KEY"
```

## クイックデプロイ

### 方法A: デプロイスクリプトを使用（最も簡単・推奨）

```bash
# デプロイスクリプトを実行
./deploy.sh
```

このスクリプトは以下を自動的に実行します：
- 環境変数の確認
- gcloud認証の確認
- 必要なAPIの有効化
- Dockerイメージのビルドとプッシュ
- Cloud Runへのデプロイ

### 方法B: npmスクリプトを使用

`package.json`に追加したスクリプトを使用：

```bash
# ビルドとデプロイを一度に実行
npm run deploy:quick
```

または、個別に実行：

```bash
# ビルドのみ
npm run deploy:build

# デプロイのみ（既にビルド済みの場合）
npm run deploy:run
```

## デプロイ後の確認

1. **Cloud RunのURLを確認**
   ```bash
   gcloud run services describe bankisha-app --region asia-northeast1 --format 'value(status.url)'
   ```

2. **アプリにアクセス**
   - Cloud Run URL: `https://bankisha-app-xxxxx-an.a.run.app`
   - Firebase Hosting URL: `https://bankisha-654d0.web.app`（Firebase Hostingが設定されている場合）

3. **動作確認**
   - ログインページが表示されるか
   - インタビュー作成ができるか
   - 記事生成ができるか

## トラブルシューティング

### エラー1: "Permission denied" または "Operation not permitted"
- ネットワークドライブではなく、ローカルのSSDで実行してください
- gcloud CLIの権限を確認: `gcloud auth list`

### エラー2: "API not enabled"
```bash
# 必要なAPIを有効化
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### エラー3: "Image not found"
- ビルドが完了しているか確認: `gcloud builds list`
- イメージがGCRに存在するか確認: `gcloud container images list`

### エラー4: 環境変数が読み込めない
- Cloud Runの環境変数を確認: 
  ```bash
  gcloud run services describe bankisha-app --region asia-northeast1 --format 'value(spec.template.spec.containers[0].env)'
  ```
- 環境変数を再設定:
  ```bash
  gcloud run services update bankisha-app \
    --region asia-northeast1 \
    --set-env-vars="KEY=value"
  ```

### エラー5: ビルドが失敗する
- Dockerfileの構文を確認
- `.gcloudignore`で不要なファイルが除外されているか確認
- ビルドログを確認: `gcloud builds log <BUILD_ID>`

## 環境変数の管理（推奨）

セキュリティのため、環境変数はCloud Runのシークレットとして管理することを推奨します：

```bash
# シークレットを作成
echo -n "$GEMINI_API_KEY" | gcloud secrets create gemini-api-key --data-file=-

# Cloud Runでシークレットを使用
gcloud run services update bankisha-app \
  --region asia-northeast1 \
  --update-secrets="GEMINI_API_KEY=gemini-api-key:latest"
```

## ロールバック

以前のバージョンに戻す場合：

```bash
# 以前のリビジョンを確認
gcloud run revisions list --service bankisha-app --region asia-northeast1

# 特定のリビジョンに戻す
gcloud run services update-traffic bankisha-app \
  --region asia-northeast1 \
  --to-revisions=<REVISION_NAME>=100
```

## デプロイの自動化

GitHub ActionsやCloud Build Triggersを使用して、自動デプロイを設定することもできます。

詳細は `Docs/DEPLOY_GUIDE.md` を参照してください。

