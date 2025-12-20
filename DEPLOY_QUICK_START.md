# 🚀 クイックスタート: Gitでデプロイ

## 3ステップでデプロイ開始

### ステップ1: GitHub Secretsを設定（初回のみ）

GitHubリポジトリの「Settings」→「Secrets and variables」→「Actions」で以下を追加：

1. **`GCP_SA_KEY`**: Google CloudサービスアカウントのJSONキー
   - [サービスアカウントの作成方法](https://console.cloud.google.com/iam-admin/serviceaccounts?project=bankisha-654d0)
   - 必要な権限: `Cloud Build Editor`, `Cloud Run Admin`, `Service Account User`, `Storage Admin`

2. **環境変数**（`.env.local`から取得）:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (= `bankisha-654d0`)
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL`
   - `GEMINI_API_KEY`

### ステップ2: コードをGitHubにプッシュ

```bash
git add .
git commit -m "デプロイ設定を追加"
git push origin main
```

**VS CodeやGitHub Desktopを使う場合**:
- 変更をステージング
- コミットメッセージを入力
- プッシュ

### ステップ3: デプロイの確認

1. GitHubリポジトリの「Actions」タブを開く
2. 「Deploy to Cloud Run」ワークフローが実行中であることを確認
3. 完了を待つ（約5-10分）
4. 緑色のチェックマークが表示されれば成功！

## ✅ デプロイ成功後

- **Cloud Run URL**: GitHub Actionsのログに表示されます
- **Firebase Hosting URL**: `https://bankisha-654d0.web.app`

## 🔄 今後のデプロイ

コードを変更してプッシュするだけで、自動的にデプロイされます！

```bash
git add .
git commit -m "機能追加"
git push origin main
```

## 📖 詳細な手順

詳しい手順は `DEPLOY_WITH_GIT.md` を参照してください。

