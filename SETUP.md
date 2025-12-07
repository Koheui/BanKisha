# BanKisha セットアップガイド

このガイドでは、BanKishaの開発環境をゼロから構築する手順を説明します。

## 前提条件

- Node.js 18以上
- npm または yarn
- Firebaseアカウント
- OpenAI APIキー

## 1. Firebase プロジェクトのセットアップ

### 1.1 Firebase プロジェクトの作成

1. [Firebase Console](https://console.firebase.google.com/)にアクセス
2. 「プロジェクトを追加」をクリック
3. プロジェクト名を入力（例: bankisha）
4. Google Analyticsを有効化（オプション）
5. プロジェクトを作成

### 1.2 Firebase Authentication の設定

1. Firebase Console > Authentication > Sign-in method
2. 「メール/パスワード」を有効化
3. 保存

### 1.3 Firestore Database の設定

1. Firebase Console > Firestore Database
2. 「データベースを作成」をクリック
3. 本番環境モードで開始
4. ロケーションを選択（asia-northeast1推奨）
5. 作成完了

### 1.4 Storage の設定

1. Firebase Console > Storage
2. 「始める」をクリック
3. セキュリティルールはデフォルトのまま
4. ロケーションを選択（asia-northeast1推奨）
5. 完了

### 1.5 Firebase Functions の設定

1. Firebase Console > Functions
2. 「始める」をクリック
3. Node.js 18を選択
4. 完了

### 1.6 Firebase 設定ファイルの取得

1. Firebase Console > プロジェクト設定（⚙️アイコン）
2. 「全般」タブで「アプリを追加」→「Web」を選択
3. アプリのニックネームを入力
4. Firebase SDKの設定をコピー

```javascript
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

### 1.7 Firebase Admin SDK の設定

1. Firebase Console > プロジェクト設定 > サービスアカウント
2. 「新しい秘密鍵の生成」をクリック
3. JSONファイルをダウンロード
4. ファイル名を `service-account-key.json` に変更
5. プロジェクトルートに配置（**注: .gitignoreに含まれています**）

## 2. AI API キーの取得

### 2.1 Gemini API キーの取得（推奨・必須）

1. [Google AI Studio](https://makersuite.google.com/app/apikey)にアクセス
2. Googleアカウントでログイン
3. 「Create API Key」をクリック
4. キーをコピーして保存（**重要: このキーは再表示できません**）

**Gemini APIの利点:**
- 日本語処理が優秀
- コストが安い
- 高速なレスポンス
- 記事生成と音声チャット会話管理に使用

### 2.2 OpenAI API キーの取得（音声認識用）

1. [OpenAI Platform](https://platform.openai.com/)にアクセス
2. アカウント作成 or ログイン
3. API Keys > Create new secret key
4. キーをコピーして保存

**OpenAI APIの用途:**
- Whisper API（音声→テキスト変換）のみ
- 記事生成はGeminiを使用するため、必須ではありません

## 3. プロジェクトのセットアップ

### 3.1 依存関係のインストール

```bash
npm install
```

### 3.2 環境変数の設定

```bash
cp env.example .env.local
```

`.env.local` を編集：

```bash
# Firebase Configuration（1.6でコピーした値）
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef

# AI Configuration
# Gemini API（2.1で取得した値 - 必須）
GEMINI_API_KEY=your_gemini_api_key

# OpenAI Configuration（2.2で取得した値 - 音声認識用、オプション）
OPENAI_API_KEY=sk-your_openai_api_key

# Firebase Admin SDK（1.7のJSONファイルから）
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxx@your_project.iam.gserviceaccount.com

# Application Settings
NEXT_PUBLIC_MEDIA_BRAND_NAME=BanKisha
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3.3 Firebase のルールをデプロイ

```bash
# Firestore ルール
firebase deploy --only firestore:rules

# Storage ルール
firebase deploy --only storage
```

### 3.4 Firebase Functions のセットアップ

```bash
cd functions
npm install
npm run build
cd ..
```

### 3.5 Firebase Functions の環境変数設定

```bash
# Gemini API（必須）
firebase functions:config:set gemini.api_key="your_gemini_api_key"

# OpenAI API（音声認識用、オプション）
firebase functions:config:set openai.api_key="sk-your_openai_api_key"
```

### 3.6 初期データの投入

```bash
npm run init:firestore
```

このスクリプトは以下を作成します：
- デフォルトの質問セット
- テスト用の企業
- テスト用のセッション（招待URL）

## 4. 開発サーバーの起動

### 4.1 Firebase Emulator の起動（推奨）

別のターミナルで：

```bash
npm run firebase:emulator
```

これにより以下が起動します：
- Auth Emulator (port 9099)
- Firestore Emulator (port 8080)
- Functions Emulator (port 5001)
- Emulator UI (port 4000)

### 4.2 Next.js 開発サーバーの起動

```bash
npm run dev
```

http://localhost:3000 にアクセス

## 5. 管理者ユーザーの作成

### 5.1 Firebase Console で作成

1. Firebase Console > Authentication > Users
2. 「ユーザーを追加」をクリック
3. メールアドレスとパスワードを入力
4. UIDをコピー

### 5.2 Firestore に管理者情報を追加

Firebase Console > Firestore Database でドキュメントを作成：

```
コレクション: users
ドキュメントID: {上記のUID}
フィールド:
  - email: "admin@example.com" (string)
  - displayName: "管理者" (string)
  - role: "admin" (string)
  - companyId: null
  - createdAt: {現在のタイムスタンプ}
  - updatedAt: {現在のタイムスタンプ}
```

## 6. 動作確認

### 6.1 ログイン

1. http://localhost:3000/login にアクセス
2. 管理者アカウントでログイン
3. ダッシュボードが表示されることを確認

### 6.2 インタビューのテスト

1. `npm run init:firestore` で表示された招待URLにアクセス
2. 質問に回答（音声またはテキスト）
3. インタビュー完了
4. ダッシュボードで記事を確認

### 6.3 記事の承認・公開

1. 管理者ダッシュボードで記事を承認
2. 公開
3. `/articles` で公開記事を確認

## 7. 本番デプロイ

### 7.1 Firebase Functions のデプロイ

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

### 7.2 Next.js のデプロイ

#### Vercel の場合

```bash
npm install -g vercel
vercel
```

環境変数を Vercel Dashboard で設定

#### Firebase Hosting の場合

```bash
npm run build
firebase deploy --only hosting
```

## トラブルシューティング

### Firestore permission denied

- Firestoreのルールが正しくデプロイされているか確認
- ユーザーがログインしているか確認
- ユーザーのroleとcompanyIdが正しく設定されているか確認

### Firebase Functions のエラー

- Functions の環境変数が設定されているか確認：
  ```bash
  firebase functions:config:get
  ```
- Functions のログを確認：
  ```bash
  firebase functions:log
  ```

### OpenAI API エラー

- APIキーが正しいか確認
- APIの使用制限を確認
- 請求情報が設定されているか確認

## サポート

問題が解決しない場合は、GitHubのIssuesで報告してください。
