# Gitを使った自動デプロイ設定ガイド

GitHubにプッシュするだけで、自動的にCloud Runにデプロイされるように設定します。

## 📋 前提条件

1. **GitHubリポジトリが作成されていること**
2. **Google Cloud サービスアカウントの作成とキーの取得**

## 🔧 セットアップ手順

### ステップ1: Google Cloud サービスアカウントの作成

1. **Google Cloud Consoleにアクセス**
   - 直接リンク: https://console.cloud.google.com/iam-admin/serviceaccounts?project=bankisha-654d0
   - または、Google Cloud Console → プロジェクト選択 (`bankisha-654d0`) → 「IAMと管理」→「サービスアカウント」

2. **サービスアカウントを作成**
   - 「+ サービスアカウントを作成」ボタンをクリック
   - **サービスアカウント名**: `github-actions-deploy`
   - **説明**: `GitHub Actions用のデプロイサービスアカウント`
   - 「作成して続行」をクリック

3. **必要な権限を付与**
   - 「ロールを選択」ドロップダウンから以下を追加：
     - `Cloud Build Editor`
     - `Cloud Run Admin`
     - `Service Account User`
     - `Storage Admin` (GCRへのプッシュ用)
   - 「続行」→「完了」をクリック

4. **JSONキーをダウンロード**
   - 作成したサービスアカウント `github-actions-deploy` をクリック
   - 上部のタブから「キー」を選択
   - 「キーを追加」→「新しいキーを作成」をクリック
   - 「JSON」を選択して「作成」をクリック
   - **JSONファイルが自動的にダウンロードされます**（ダウンロードフォルダに保存されます）
   
   📖 **詳細な手順**: `GCP_SERVICE_ACCOUNT_SETUP.md` を参照してください

### ステップ2: GitHub Secretsの設定

1. **GitHubリポジトリにアクセス**
   - リポジトリの「Settings」→「Secrets and variables」→「Actions」

2. **以下のSecretsを追加**

   | Secret名 | 説明 | 取得方法 |
   |---------|------|---------|
   | `GCP_SA_KEY` | Google CloudサービスアカウントのJSONキー | ステップ1でダウンロードしたJSONファイルの内容をそのまま貼り付け |
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API Key | `.env.local`から取得 |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | `.env.local`から取得 |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Project ID | `.env.local`から取得（`bankisha-654d0`） |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage Bucket | `.env.local`から取得 |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID | `.env.local`から取得 |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase App ID | `.env.local`から取得 |
   | `NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL` | Firebase Functions URL | `.env.local`から取得 |
   | `GEMINI_API_KEY` | Gemini API Key | `.env.local`から取得 |

   **重要**: `GCP_SA_KEY`は、JSONファイルの内容を**そのまま**（改行を含めて）貼り付けてください。

### ステップ3: GitHubリポジトリにプッシュ

1. **Gitリポジトリを初期化（まだの場合）**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **GitHubリポジトリを作成して接続**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git branch -M main
   git push -u origin main
   ```

   **注意**: ターミナルが使えない場合は、GitHub DesktopやVS CodeのGit機能を使用してください。

### ステップ4: デプロイの実行

1. **コードをプッシュ**
   - `main`ブランチまたは`master`ブランチにプッシュすると、自動的にデプロイが開始されます

2. **デプロイ状況の確認**
   - GitHubリポジトリの「Actions」タブでデプロイの進行状況を確認できます
   - 緑色のチェックマークが表示されればデプロイ成功です

3. **手動でデプロイを実行する場合**
   - 「Actions」タブ → 「Deploy to Cloud Run」→ 「Run workflow」→ 「Run workflow」ボタンをクリック

## 🎯 デプロイの流れ

```
コードをプッシュ
    ↓
GitHub Actionsが自動実行
    ↓
Dockerイメージをビルド
    ↓
Google Container Registryにプッシュ
    ↓
Cloud Runにデプロイ
    ↓
完了！
```

## 📝 ワークフローファイルの説明

`.github/workflows/deploy-cloud-run.yml` が自動デプロイの設定ファイルです。

- **トリガー**: `main`または`master`ブランチへのプッシュ
- **実行内容**:
  1. コードをチェックアウト
  2. Google Cloud SDKをセットアップ
  3. DockerイメージをビルドしてGCRにプッシュ
  4. Cloud Runにデプロイ

## 🔍 トラブルシューティング

### エラー1: "Permission denied" または "Access denied"
- **原因**: サービスアカウントに必要な権限が付与されていない
- **解決方法**: Google Cloud Consoleでサービスアカウントに以下の権限を確認
  - `Cloud Build Editor`
  - `Cloud Run Admin`
  - `Service Account User`
  - `Storage Admin`

### エラー2: "Secret not found"
- **原因**: GitHub Secretsが正しく設定されていない
- **解決方法**: リポジトリの「Settings」→「Secrets and variables」→「Actions」で、必要なSecretsがすべて設定されているか確認

### エラー3: "Image build failed"
- **原因**: Dockerfileの構文エラーや依存関係の問題
- **解決方法**: 
  - ローカルで `docker build` を実行してエラーを確認
  - `.gcloudignore`で不要なファイルが除外されているか確認

### エラー4: "Environment variable not set"
- **原因**: Cloud Runの環境変数が正しく設定されていない
- **解決方法**: GitHub Secretsの値が正しいか確認（特に改行や特殊文字が含まれていないか）

## 🔐 セキュリティのベストプラクティス

1. **サービスアカウントキーの管理**
   - JSONキーは絶対にGitにコミットしない
   - GitHub Secretsのみに保存
   - 定期的にキーをローテーション

2. **最小権限の原則**
   - サービスアカウントには必要最小限の権限のみを付与

3. **Secretsの管理**
   - 定期的にSecretsを確認
   - 不要になったSecretsは削除

## 📚 参考リンク

- [GitHub Actions ドキュメント](https://docs.github.com/ja/actions)
- [Google Cloud Run ドキュメント](https://cloud.google.com/run/docs)
- [Google Cloud Build ドキュメント](https://cloud.google.com/build/docs)

## 🚀 次のステップ

デプロイが成功したら：

1. **Cloud RunのURLを確認**
   - GitHub Actionsのログに表示されます
   - または、Google Cloud Consoleで確認

2. **アプリの動作確認**
   - デプロイされたURLにアクセス
   - ログイン、インタビュー作成、記事生成などが正常に動作するか確認

3. **Firebase Hostingの設定（オプション）**
   - `firebase.json`の設定により、Firebase HostingからCloud Runにリライトされます
   - Firebase HostingのURL: `https://bankisha-654d0.web.app`

