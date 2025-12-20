# フロー検証チェックリスト

## 完全なユーザーフロー

### 1. ユーザー登録・ログイン ✅
- [x] メール＋パスワードでログイン
- [x] アカウント作成
- [x] Firebase Authentication統合
- [x] ロール管理（admin/company）

**実装状況**: 完全実装済み
**場所**: `/login`, `/signup`

---

### 2. 企業プロフィール設定 ✅
- [x] 企業名入力
- [x] 担当者名入力
- [x] 会社URL入力
- [x] 企業プロフィール（説明文）入力
- [x] 会社住所入力
- [x] 電話番号入力
- [x] 設立年入力
- [x] 保存機能

**実装状況**: 完全実装済み
**場所**: `/dashboard/profile`
**コンポーネント**: `CompanyProfileEditor.tsx`

---

### 3. インタビュー作成（管理者または企業） ✅
#### ステップ1: 基本情報入力
- [x] インタビュータイトル入力
- [x] 質問したい内容入力（箇条書き）
- [x] カバー画像アップロード
  - [x] ファイル選択
  - [x] プレビュー表示
  - [x] Firebase Storageアップロード
  - [x] バリデーション（形式・サイズ）

#### ステップ2: AI概要整理
- [x] AIが入力内容を整理
- [x] 概要を確認（テストボタン）
- [x] 編集可能

#### ステップ3: 質問セット選択・URL発行
- [x] 質問セットを選択
- [x] セッション作成
- [x] 取材URL生成
- [x] URLコピー機能
- [x] 新規タブで開く機能
- [x] 有効期限表示

**実装状況**: 完全実装済み
**場所**: `/dashboard` → 「新規インタビュー」ボタン
**コンポーネント**: `CreateInterviewDialog.tsx`

---

### 4. 取材URL送信 ⚠️ 手動
- [ ] 自動メール送信（無効化済み）
- [x] URLを手動でコピー＆送信

**実装状況**: 手動対応（開発期間中）
**今後**: Gmail SMTP実装済み（コメントアウト）

---

### 5. インタビュー実施 ✅
企業ユーザーが取材URLにアクセス

#### モード選択
- [x] AI音声チャット（メディア側が取材をAIが代行）
- [x] 質問形式（メディア側が取材をAIが代行）
- [x] コンテンツ入力（自分のコンテンツを取材スタイルで記事化）

#### AI音声チャット
- [x] 音声認識（Web Speech API）
- [x] AIとの対話
- [x] リアルタイム文字起こし
- [x] 会話履歴保存

#### 質問形式
- [x] 質問を1つずつ表示
- [x] 音声録音またはテキスト入力
- [x] 進捗表示
- [x] 前の質問に戻る機能
- [x] 回答の保存

#### コンテンツ入力
- [x] テキスト入力
- [x] 音声入力（複数回録音）
- [x] 箇条書きから質問生成（オプション）

**実装状況**: 完全実装済み
**場所**: `/invite/[sessionId]`
**コンポーネント**: `InterviewModeSelector.tsx`, `VoiceChat.tsx`, `InterviewWizard.tsx`, `ContentInput.tsx`

---

### 6. 記事自動生成 ✅
- [x] Q&Aから記事生成（Gemini Pro）
- [x] ナレッジベース活用（RAG）
- [x] タイトル生成（38字以内）
- [x] リード文生成（200字以内）
- [x] 本文生成（Markdown形式）
- [x] 見出し抽出
- [x] **サマリー自動生成（NEW）**
- [x] SNS投稿文生成（X/LinkedIn）
- [x] **カバー画像保存（NEW）**

**実装状況**: 完全実装済み
**場所**: `/api/generate-article`, `functions/src/index.ts`

---

### 7. 記事編集 ✅
- [x] **カバー画像編集（NEW）**
  - [x] 既存画像表示
  - [x] 新しい画像アップロード
  - [x] プレビュー
- [x] **サマリー編集（NEW）**
  - [x] テキストエリア
  - [x] 文字数カウント
- [x] タイトル編集
- [x] リード文編集
- [x] 本文編集（Markdown）
- [x] SNS投稿文編集
- [x] インタビュー回答の確認
  - [x] 質問と回答の表示
  - [x] 音声再生（AudioPlayer）
- [x] 保存機能
- [x] 承認申請機能

**実装状況**: 完全実装済み
**場所**: `/dashboard/articles/[id]/edit`
**コンポーネント**: `ArticleEditor.tsx`, `AudioPlayer.tsx`

---

### 8. 承認フロー ✅
#### 企業ユーザー側
- [x] 記事を編集
- [x] 承認申請（status: draft → submitted）

#### 管理者側
- [x] 申請された記事を確認
- [x] 承認（status: submitted → approved）
- [x] 差し戻し（status: submitted → draft）
- [x] 公開（status: approved → public）

**実装状況**: 完全実装済み
**場所**: `/dashboard`
**コンポーネント**: `AdminPanel.tsx`, `ArticleManager.tsx`

---

### 9. メディアサイトでの公開 📝 設計完了
- [x] URL設計完了（`/media/articles/[id]`）
- [x] データ構造準備完了（coverImageUrl, summary）
- [x] アクセス制御設計完了
- [x] Firestore Security Rules設計完了
- [ ] メディアサイト実装（今後）

**実装状況**: 設計完了、実装は今後
**ドキュメント**: `MEDIA_SITE_DESIGN.md`, `URL_ARCHITECTURE.md`

---

## 潜在的な問題点チェック

### ✅ 問題なし
1. **データの永続化**: すべてFirestoreに保存
2. **画像保存**: Firebase Storageに保存、URLを取得
3. **AI処理**: Gemini Pro APIで記事・サマリー生成
4. **音声処理**: Web Speech APIで文字起こし
5. **認証**: Firebase Authenticationで管理
6. **ロール管理**: Custom Claimsで実装

### ⚠️ 要確認・改善点

#### 1. Firebase Storage Rules
**現状**: 未確認
**必要な設定**:
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // カバー画像のアップロード（認証必須）
    match /covers/{companyId}/{fileName} {
      allow write: if request.auth != null && 
        (request.auth.token.role == 'admin' || 
         request.auth.token.companyId == companyId);
      allow read: if true; // 公開読み取り可
    }
    
    // 音声ファイルのアップロード（認証必須）
    match /audio/{companyId}/{fileName} {
      allow write: if request.auth != null;
      allow read: if request.auth != null && 
        (request.auth.token.role == 'admin' || 
         request.auth.token.companyId == companyId);
    }
  }
}
```

#### 2. Firestore Indexes
**必要なインデックス**:
- `articles`: `status (ASC) + createdAt (DESC)`
- `articles`: `status (ASC) + companyId (ASC) + createdAt (DESC)`
- `articles`: `companyId (ASC) + status (ASC) + updatedAt (DESC)`

**確認方法**:
```bash
firebase deploy --only firestore:indexes
```

#### 3. 環境変数の設定
**必要な環境変数**:
```bash
# .env.local
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

GEMINI_API_KEY=
OPENAI_API_KEY=

FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_PRIVATE_KEY=
FIREBASE_ADMIN_CLIENT_EMAIL=

NEXT_PUBLIC_MEDIA_BRAND_NAME=BanKisha
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

#### 4. Firebase Functions デプロイ
**確認事項**:
- `functions/` ディレクトリの `package.json` に `nodemailer` が追加済み
- `functions/src/index.ts` が更新済み
- ビルドエラーがないか確認

**デプロイ**:
```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

#### 5. 初期データの投入
**必要な初期データ**:
- デフォルトの質問セット
- 管理者ユーザー

**スクリプト**:
```bash
# 質問セットとユーザーの初期化
npx ts-node scripts/init-firestore.ts
```

---

## フロー実行テスト手順

### テスト1: 企業ユーザー登録〜プロフィール設定
1. `/signup` でアカウント作成
2. `/login` でログイン
3. `/dashboard/profile` でプロフィール設定
4. 保存して確認

**期待結果**: プロフィールが正常に保存される

---

### テスト2: インタビュー作成〜URL発行
1. `/dashboard` にアクセス
2. 「新規インタビュー」をクリック
3. タイトル、質問内容、カバー画像を入力
4. 「概要を整理（テスト）」をクリック
5. AI整理された概要を確認
6. 質問セットを選択
7. 「取材URLを発行」をクリック
8. URLをコピー

**期待結果**: 取材URLが生成され、コピーできる

---

### テスト3: インタビュー実施（質問形式）
1. 発行されたURLにアクセス
2. 「質問形式」を選択
3. 各質問に回答（テキストまたは音声）
4. すべての質問に回答
5. 「インタビューを完了」をクリック

**期待結果**: 記事が自動生成され、完了ページに遷移

---

### テスト4: 記事編集〜承認申請
1. `/dashboard` にアクセス
2. 生成された記事の「編集」をクリック
3. カバー画像、サマリー、タイトル、本文を確認・編集
4. 「保存」をクリック
5. 「承認申請」をクリック

**期待結果**: ステータスが「申請中」になる

---

### テスト5: 管理者承認〜公開
1. 管理者アカウントでログイン
2. `/dashboard` にアクセス
3. 申請中の記事を確認
4. 「承認」をクリック
5. 「公開」をクリック

**期待結果**: ステータスが「公開中」になる

---

## 結論

### ✅ 実行可能
以下のフローは**完全に実装されており実行可能**です：

1. ✅ ユーザー登録・ログイン
2. ✅ 企業プロフィール設定
3. ✅ インタビュー作成（カバー画像、AI概要整理含む）
4. ✅ 取材URL発行
5. ✅ インタビュー実施（3つのモード）
6. ✅ 記事自動生成（サマリー含む）
7. ✅ 記事編集（カバー画像・サマリー編集含む）
8. ✅ 承認フロー
9. 📝 メディアサイト公開（設計完了、実装は今後）

### ⚠️ 実行前の確認事項
1. Firebase Storage Rulesの設定
2. Firestoreインデックスの作成
3. 環境変数の設定
4. Firebase Functionsのデプロイ
5. 初期データの投入（質問セット、管理者ユーザー）

### 📝 今後の実装
- メディアサイトの構築（`/media/*`）
- 自動メール通知の有効化（オプション）

**総評**: フローは実装完了しており、上記の確認事項をクリアすれば**すぐに実行可能**です！

