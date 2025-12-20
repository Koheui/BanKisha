# Cloud Build エラーのデバッグ方法

## 現在の状況

- ✅ Cloud Runへのデプロイ: **成功**
- ❌ Cloud Buildのビルド: **失敗**

既存のイメージでデプロイは成功していますが、新しいコードが反映されていない可能性があります。

## エラーの確認方法

### 方法1: Cloud Buildのログを確認

```bash
# 最新のビルドログを確認
gcloud builds list --limit=1

# ビルドIDを取得してログを表示
gcloud builds log <BUILD_ID>
```

### 方法2: Google Cloud Consoleで確認

1. [Cloud Build コンソール](https://console.cloud.google.com/cloud-build/builds?project=bankisha-654d0) にアクセス
2. 失敗したビルドをクリック
3. ログを確認してエラーの詳細を確認

## よくある原因と対処法

### 原因1: Dockerfileの構文エラー

**確認方法**:
```bash
# ローカルでDockerfileをテスト
docker build -t test-image .
```

**対処法**:
- Dockerfileの構文を確認
- 特にARGとENVの設定を確認

### 原因2: 環境変数が不足

**確認方法**:
- `cloudbuild.yaml`の環境変数設定を確認
- DockerfileのARGが正しく設定されているか確認

**対処法**:
- `cloudbuild.yaml`で環境変数を正しく渡す
- または、Dockerfileでデフォルト値を設定

### 原因3: 依存関係の問題

**確認方法**:
- `package.json`の依存関係を確認
- ビルドログで`npm install`のエラーを確認

**対処法**:
```bash
# ローカルでビルドをテスト
npm install
npm run build
```

### 原因4: ファイルサイズの問題

**確認方法**:
- `.gcloudignore`で不要なファイルが除外されているか確認

**対処法**:
- `.gcloudignore`を確認して、不要なファイルを除外

## 一時的な対処法

新しいコードをデプロイするには、以下のいずれかの方法を使用：

### 方法1: ローカルでビルドしてプッシュ

```bash
# ローカルでDockerイメージをビルド
docker build -t gcr.io/bankisha-654d0/bankisha-app:latest .

# GCRにプッシュ
docker push gcr.io/bankisha-654d0/bankisha-app:latest

# Cloud Runにデプロイ
gcloud run deploy bankisha-app \
  --image gcr.io/bankisha-654d0/bankisha-app:latest \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated
```

### 方法2: Cloud Buildを直接使用（環境変数を指定）

```bash
gcloud builds submit \
  --tag gcr.io/bankisha-654d0/bankisha-app:latest \
  --substitutions=_NEXT_PUBLIC_FIREBASE_API_KEY="your-key",...
```

## 次のステップ

1. Cloud Buildのログを確認してエラーの詳細を把握
2. エラーに応じて対処法を実施
3. 再ビルドを実行

