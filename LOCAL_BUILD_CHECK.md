# ローカルでビルドを確認する方法

## 方法1: TypeScriptの型チェックのみ（推奨・高速）

型エラーだけを確認する場合：

```bash
npx tsc --noEmit
```

このコマンドは：
- ✅ 型エラーを検出
- ✅ コンパイルはしない（高速）
- ✅ ファイルは変更しない

## 方法2: Next.jsのビルド（完全確認）

完全なビルドを確認する場合：

```bash
npm run build
```

このコマンドは：
- ✅ 型チェック
- ✅ リンター
- ✅ 実際のビルド
- ⚠️ 時間がかかる（5-10分）

## 方法3: Dockerでローカルビルド（Cloud Buildと同じ環境）

Cloud Buildと同じ環境で確認する場合：

```bash
# Dockerイメージをビルド
docker build -t bankisha-app:local .

# ビルドが成功したら、イメージを確認
docker images | grep bankisha-app
```

## 推奨ワークフロー

1. **型チェックを実行**（高速）
   ```bash
   npx tsc --noEmit
   ```

2. **エラーがなければ、Cloud Buildに送る**
   ```bash
   gcloud builds submit --tag gcr.io/bankisha-654d0/bankisha-app:latest
   ```

3. **エラーが出た場合は修正してから再実行**

## トラブルシューティング

### エラー: "EPERM: operation not permitted"
- ネットワークドライブではなく、ローカルのSSDで実行してください
- または、`npx tsc --noEmit`を使用（ファイルを変更しないため、パーミッションエラーが出にくい）

### エラー: "Cannot find module"
- `npm install`を実行してからビルド

### エラー: "Type error"
- 型エラーを修正してから再実行

