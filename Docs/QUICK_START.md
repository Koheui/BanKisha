# 🚀 クイックスタート - 今すぐローカル開発を始める

## 📋 前提条件

すべてインストール済み ✅
- Node.js 20+
- npm
- Firebase CLI

---

## ⚡ 5分で開始

### 1. 環境変数の設定（初回のみ）

プロジェクトルートに`.env.local`ファイルを作成：

```bash
# ファイルを作成
touch .env.local
```

以下の内容をコピー＆ペースト：

```env
# Firebase本番環境設定
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDl8xpCQEOJNYy8kZmX8kBvFQxYmQxYxYY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=bankisha-654d0.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=bankisha-654d0
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=bankisha-654d0.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=804747870600
NEXT_PUBLIC_FIREBASE_APP_ID=1:804747870600:web:abcdef123456
NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL=https://us-central1-bankisha-654d0.cloudfunctions.net

# 開発モード
NODE_ENV=development
```

### 2. 開発サーバー起動

```bash
npm run dev
```

**出力例**:
```
   ▲ Next.js 15.5.9
   - Local:        http://localhost:3000
   - Environments: .env.local

 ✓ Ready in 2.3s
```

### 3. ブラウザでアクセス

http://localhost:3000

**完了！** これで開発環境が稼働中です。

---

## 💻 開発の流れ

### コード変更
1. VSCodeなどでファイルを編集
2. 保存（Cmd+S / Ctrl+S）
3. **自動的にブラウザが更新**（Hot Reload）

**所要時間**: 1秒以内 ⚡

### 例: ボタンの色を変更
```tsx
// Before
<Button className="bg-blue-600">クリック</Button>

// After
<Button className="bg-red-600">クリック</Button>
```

保存 → 即座に画面に反映！

---

## 🔧 便利なコマンド

```bash
# 開発サーバー起動（最もよく使う）
npm run dev

# ビルドテスト（デプロイ前に確認）
npm run build

# Firebase Emulator起動（完全オフライン開発）
npm run firebase:emulator

# Lintチェック
npm run lint
```

---

## 📱 開発中のアクセス

### ローカル
- http://localhost:3000

### 同じネットワーク内の他デバイス
```bash
# 表示されるIPアドレスにアクセス
# 例: http://192.168.1.10:3000
```

スマホでのテストも可能！

---

## 🐛 トラブルシューティング

### ポート3000が使用中
```bash
# 別のポートを使用
PORT=3001 npm run dev
```

### キャッシュクリア
```bash
rm -rf .next
npm run dev
```

### 依存関係の問題
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 🎯 今日から始める開発フロー

### ❌ 今までの開発フロー
```
コード変更
  ↓
git commit
  ↓
gcloud builds submit (10分待機...)
  ↓
gcloud run deploy (3分待機...)
  ↓
確認
```
**1回の修正に15分** 😱

### ✅ 新しい開発フロー
```
npm run dev（1回起動するだけ）
  ↓
コード変更 → 保存 → 即座に確認（1秒）
  ↓
コード変更 → 保存 → 即座に確認（1秒）
  ↓
... 何度でも繰り返し ...
  ↓
機能完成したら、1日の最後にデプロイ（15分）
```
**1回の修正に1秒** 🚀

---

## 💡 開発のコツ

### 1. デプロイは1日1回でOK
朝から夕方までローカルで開発 → 夕方にまとめてデプロイ

### 2. Hot Reloadを活用
変更を保存するだけで自動更新。ブラウザのリロード不要。

### 3. 本番環境への影響
- 認証: 本番環境を使用（テストアカウントを作成推奨）
- データベース: 本番Firestoreを使用（テストデータに注意）
- ストレージ: 本番Storageを使用

### 4. エミュレーターの活用（完全隔離）
本番に影響を与えたくない場合：
```bash
# ターミナル1
npm run firebase:emulator

# ターミナル2（別ウィンドウ）
npm run dev
```

---

## 📊 時間節約の例

### ケース1: ボタンの配置調整（10回試行）
- **従来**: 15分 × 10 = 150分（2.5時間）
- **ローカル**: 1秒 × 10 = 10秒
- **節約**: 149分50秒 ⏱️

### ケース2: 新機能開発（100回の修正）
- **従来**: 15分 × 100 = 1,500分（25時間）
- **ローカル**: 1秒 × 100 = 100秒 + 最終デプロイ15分 = 約17分
- **節約**: 1,483分（24時間以上！）⏱️

---

## 🎉 まとめ

```bash
# これだけ覚えればOK！
npm run dev

# ブラウザでアクセス
http://localhost:3000

# コード変更→保存→即座に確認
```

**開発時間が90%削減されます！**

---

## 📚 さらに詳しく

詳細は `DEVELOPMENT_GUIDE.md` を参照してください。

---

## ❓ 質問

何か問題があれば、以下を確認：
1. `.env.local` は作成済み？
2. `npm install` は実行済み？
3. ポート3000は空いている？

Happy Coding! 🚀


