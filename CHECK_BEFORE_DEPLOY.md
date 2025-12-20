# デプロイ前の確認方法

## 🚀 クイックチェック（推奨）

Cloud Buildに送る前に、型エラーを確認：

```bash
npm run type-check
```

このコマンドは：
- ✅ 型エラーのみをチェック（高速、約30秒）
- ✅ ファイルを変更しない
- ✅ ネットワークドライブでも実行可能

## 📋 完全チェック

完全なビルドを確認する場合（ローカルのSSDで実行）：

```bash
npm run build
```

## 🔄 推奨ワークフロー

1. **コードを修正**

2. **型チェックを実行**
   ```bash
   npm run type-check
   ```

3. **エラーがなければ、Cloud Buildに送る**
   ```bash
   gcloud builds submit --tag gcr.io/bankisha-654d0/bankisha-app:latest
   ```

4. **エラーが出た場合は修正してから再実行**

## ⚠️ 注意

- `npm run type-check`は型エラーのみをチェックします
- 実際のビルドエラー（モジュールが見つからないなど）は検出されない場合があります
- 完全な確認には`npm run build`を実行してください（ローカルのSSDで）

