# BanKisha

音声インタビュー型のPR TIMES を実現。企業はスマホまたはPCから質問に答えるだけで、取材記事スタイルの記事が生成される。

## 概要

### ゴール
企業がスマホまたはPCから質問に答えるだけで、取材記事スタイルの記事が生成されるシステム。「音声インタビュー型のPR TIMES」を実現します。

### 技術スタック
- フロント: Next.js (App Router) + TypeScript + Tailwind + Shadcn UI
- 認証: Firebase Auth
- DB/Storage: Firestore / Storage
- サーバー処理: Firebase Functions (Node18)
- AI: Whisper API（音声→テキスト変換）、GPT-4/5（記事化、SNS要約生成）、OpenAI TTS（質問読み上げ、番記者の声）

### ユーザーロール
- admin（編集部）: 全記事の承認・公開権限、全企業の管理権限
- company（企業ユーザー）: 自社記事の作成・編集・申請（公開は不可）

### 画面構成
- `/` → 記事一覧（status=public）にリダイレクト
- `/articles` → 記事一覧ページ
- `/articles/[id]` → 記事詳細ページ（発行元メディアバッジ付き）
- `/invite/[sessionId]` → 招待取材ページ（TTS＋録音UI）
- `/login` → ログインページ
- `/signup` → 新規登録ページ
- `/dashboard` → ダッシュボード（企業：自社記事管理、管理者：承認・公開）

## セットアップ

### 1. 環境変数設定
```bash
cp env.example .env.local
```

`.env.local`に以下を設定：
```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456

# OpenAI Configuration
OPENAI_API_KEY=sk-your_openai_api_key_here

# Firebase Admin SDK
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@your_project.iam.gserviceaccount.com

# Application Settings
NEXT_PUBLIC_MEDIA_BRAND_NAME=BanKisha
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 2. Firebase プロジェクト設定
1. Firebase プロジェクトを作成
2. Authentication を有効化 (Email/Password)
3. Firestore Database を有効化
4. Storage を有効化
5. Functions を有効化 (Node.js 18)

### 3. 依存関係インストール
```bash
# メインプロジェクト
npm install

# Firebase Functions
cd functions
npm install
cd ..
```

### 4. Firebaseエミュレーター起動（開発環境）
```bash
npm run firebase:emulator
```

### 5. アプリケーション起動
```bash
npm run dev
```

## 現在の実装状況

### ✅ 完了済み
- [x] Firebase初期化（Auth/Firestore/Storage/Functions）
- [x] Next.js + TypeScript + Tailwind + Shadcn UI の初期セットアップ
- [x] 公開記事ページ（一覧＋詳細）の実装
- [x] 基本的な認証システム（ログイン・新規登録）
- [x] Firebase Functions設定（GPT記事化、Whisper文字化）

### 🚧 開発中
- [ ] Firestoreデータベース構造の実装
- [ ] 招待取材ページ（TTS読み上げ＋録音UI）
- [ ] Whisper API連携（録音→テキスト変換）
- [ ] GPT記事化＋SNS要約生成
- [ ] ダッシュボード（企業：自社記事編集/管理者：承認・公開）
- [ ] AI番記者機能の実装

## フロー

### 1. 企業登録
1. `invite/[sessionId]` URLで招待
2. 初回質問セット（会社名・設立経緯・サービス・差別化・今後の計画）
3. 音声またはテキストで回答

### 2. 記事生成
1. 音声 → Storage保存 → Whisper APIで文字化
2. GPTで 取材記事スタイル の draftArticle を生成
3. 同時にSNS要約（X, LinkedIn）も生成

### 3. 承認フロー
1. 企業ユーザー：自社記事を修正し submitted に変更
2. 管理者：承認して approved → public
3. 初回公開と同時に companies.onboarded = true

### 4. 公開
1. `/articles/[id]` で公開記事表示（発行元バッジ付き）
2. SNS要約をAPI連携で投稿

## ライセンス

MIT License