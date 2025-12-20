# Google Cloud サービスアカウントのJSONキー取得手順

## 📍 JSONキーのダウンロード場所

### ステップ1: Google Cloud Consoleにアクセス

1. **サービスアカウント一覧ページにアクセス**
   ```
   https://console.cloud.google.com/iam-admin/serviceaccounts?project=bankisha-654d0
   ```
   
   または、以下の手順でアクセス：
   - [Google Cloud Console](https://console.cloud.google.com/) にログイン
   - プロジェクトを選択: `bankisha-654d0`
   - 左側のメニューから「IAMと管理」→「サービスアカウント」を選択

### ステップ2: サービスアカウントを作成（まだ作成していない場合）

1. **「サービスアカウントを作成」ボタンをクリック**
   - ページ上部の「+ サービスアカウントを作成」をクリック

2. **サービスアカウントの詳細を入力**
   - **サービスアカウント名**: `github-actions-deploy`
   - **サービスアカウントID**: 自動生成されます（変更可能）
   - **説明**: `GitHub Actions用のデプロイサービスアカウント`
   - 「作成して続行」をクリック

3. **ロール（権限）を付与**
   - 「ロールを選択」ドロップダウンから以下を追加：
     - `Cloud Build Editor`
     - `Cloud Run Admin`
     - `Service Account User`
     - `Storage Admin`
   - 「続行」をクリック

4. **ユーザーアクセスの設定**
   - このステップはスキップして「完了」をクリック

### ステップ3: JSONキーをダウンロード

1. **作成したサービスアカウントをクリック**
   - サービスアカウント一覧から `github-actions-deploy` をクリック

2. **「キー」タブを選択**
   - サービスアカウントの詳細ページで、上部のタブから「キー」を選択

3. **「キーを追加」→「新しいキーを作成」をクリック**
   - ページ上部の「キーを追加」ボタンをクリック
   - 「新しいキーを作成」を選択

4. **キーのタイプを選択**
   - 「JSON」を選択
   - 「作成」をクリック

5. **JSONファイルが自動的にダウンロードされます**
   - ファイル名は `bankisha-654d0-xxxxx-xxxxx.json` のような形式
   - ダウンロードフォルダに保存されます

## 📋 JSONキーの内容

ダウンロードしたJSONファイルには以下のような内容が含まれています：

```json
{
  "type": "service_account",
  "project_id": "bankisha-654d0",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "github-actions-deploy@bankisha-654d0.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

## 🔐 GitHub Secretsへの設定方法

1. **JSONファイルを開く**
   - ダウンロードしたJSONファイルをテキストエディタで開く

2. **内容をすべてコピー**
   - JSONファイルの内容をすべて選択してコピー（`Cmd+A` → `Cmd+C`）

3. **GitHub Secretsに貼り付け**
   - GitHubリポジトリの「Settings」→「Secrets and variables」→「Actions」に移動
   - 「New repository secret」をクリック
   - **Name**: `GCP_SA_KEY`
   - **Secret**: コピーしたJSONの内容をそのまま貼り付け
   - 「Add secret」をクリック

## ⚠️ 重要な注意事項

1. **JSONキーは絶対にGitにコミットしない**
   - `.gitignore`に `*.json` が含まれているか確認
   - 誤ってコミットした場合は、すぐにキーを無効化して再生成

2. **JSONキーは安全に保管**
   - ダウンロードしたJSONファイルは安全な場所に保管
   - 不要になったら削除

3. **定期的にキーをローテーション**
   - セキュリティのため、定期的にキーを再生成

## 🔄 キーを再生成する場合

1. サービスアカウントの「キー」タブに移動
2. 古いキーを削除（「削除」アイコンをクリック）
3. 新しいキーを作成（上記のステップ3を参照）
4. GitHub Secretsを更新

## 📍 直接リンク

- **サービスアカウント一覧**: https://console.cloud.google.com/iam-admin/serviceaccounts?project=bankisha-654d0
- **IAMと管理**: https://console.cloud.google.com/iam-admin?project=bankisha-654d0

## 🆘 トラブルシューティング

### エラー: "キーを作成できません"
- **原因**: 権限が不足している
- **解決方法**: プロジェクトのオーナーまたはエディタ権限が必要です

### エラー: "サービスアカウントが見つかりません"
- **原因**: プロジェクトが正しく選択されていない
- **解決方法**: プロジェクト選択ドロップダウンで `bankisha-654d0` を選択

### エラー: "ダウンロードが開始されない"
- **原因**: ブラウザのポップアップブロッカーが有効
- **解決方法**: ポップアップブロッカーを無効化するか、手動でダウンロードフォルダを確認

