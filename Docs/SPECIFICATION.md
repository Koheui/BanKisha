# BanKisha アプリケーション全体仕様書

## 1. 概要
BanKishaは、ビジネスメディア向けのAIインタビュアーおよび記事作成支援プラットフォームです。プロのインタビュー技術（スキルナレッジ）と専門分野の知識（情報ナレッジ）をAIに学習させることで、質の高い取材から記事の下書き生成、メディアサイトでの公開までを一貫してサポートします。

## 2. 技術スタック
- **Frontend/Backend**: Next.js (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, Lucide React (Icons)
- **Database**: Firebase Firestore
- **Authentication**: Firebase Authentication
- **AI Engine**: Google Gemini 2.5 Flash
- **Voice Capabilities**: 
  - Speech-To-Text: Browser Web Speech API / Gemini Native Audio (一部)
  - Text-To-Speech: Gemini TTS / Browser TTS
- **Infrastructure**: Docker, Google Cloud Run (推奨)

## 3. データ構造 (Firestore)

### 3.1 `companies` (会社/組織)
- 組織単位での管理。ユーザーは特定のCompanyに所属。

### 3.2 `interviews` (インタビュープロジェクト)
- `title`: 取材タイトル
- `objective`: 聞きたいこと（箇条書き）
- `interviewPurpose`: 取材の目的
- `targetAudience`: ターゲット読者
- `mediaType`: 掲載メディア
- `status`: ステータス (active, completed)
- `category`: カテゴリー (一般, イベント告知, プレスリリース 等)
- `supplementaryInfo`: 詳細情報（日時、場所、価格など）
- `knowledgeBaseIds`: 参照するナレッジベースのIDリスト

### 3.3 `interviews/{id}/messages` (会話履歴)
- `role`: interviewer または interviewee
- `content`: 発言内容
- `timestamp`: 送信時刻
- `audioUrl`: 録音データのURL (Firebase Storage)

### 3.4 `knowledgeBases` (RAG用データ)
- `type`: skill (技術), info (専門知識), user (ユーザー固有)
- `fileName`: ファイル名
- `summary`: 内容の要約
- `chunks` (Subcollection): 分割されたテキストデータ

### 3.5 `articles` (生成された記事)
- `interviewId`: 元となるインタビューのID
- `draftArticle`: タイトル、リード文、各セクションの本文を含むJSON
- `status`: draft, review, published, public
  - `draft`: 下書き
  - `review`: レビュー中
  - `published`: 公開済み（管理側での表示用）
  - `public`: 公開済み（メディアサイトでの表示用）
- `coverImageUrl`: カバー画像URL（メディアサイト用）
- `summary`: 記事サマリー（2〜3文、100文字程度）
- `category`: カテゴリ（メディアサイト用）
- `publishedAt`: 公開日時（`status='public'` になった日時）

## 4. 主要機能

### 4.1 AIインタビュアー設定
- **人格のカスタマイズ**: 名前、所属、話し方、プロンプトの調整。
- **音声設定**: 音声の種類、スピードの設定。

### 4.2 インタビュー実行 (Voice Chat)
- **リハーサルモード**: 質問の流れを確認・練習。
- **本番モード**: 実際の会話を録音・保存。
- **プログレス評価**: 設定した「聞きたいこと」がどの程度回収できているかをリアルタイムで分析。
- **深掘り質問**: 回答が不十分な場合、AIが自動的に深掘り質問を生成。
- **告知詳細入力**: インタビュー終了後、イベントの日時やURLなどの定型情報を入力可能。

### 4.3 記事生成エンジン
- **敲き（下書き）生成**: インタビュー記録から構成（現在・過去・未来）を自動作成。
- **フィードバック反映**: 敲きに対するユーザーの修正指示を反映して再生成。
- **本文執筆**: 目標文字数に合わせた詳細な記事執筆。告知系インタビューの場合は詳細情報を末尾に自動整理。

### 4.4 RAG (Retrieval-Augmented Generation)
- **スキルKB**: プロの質問技術をAIの思考に反映。
  - インタビュー生成時に自動取得される（ユーザーが選択する必要はない）
  - 質問設計・対話設計のベストプラクティスを提供
  - プロンプトの最初に配置され、「思考の起点」として機能
- **情報KB**: 業界知識をAIに補完。
- **ユーザーKB**: ユーザーがアップロードした資料（PDF等）を基に質問内容を最適化。
- **詳細仕様**: ナレッジベースの活用方法については `docs/INTERVIEW_FLOW_AND_ISSUES.md` の「ナレッジベースの活用」セクションを参照。

### 4.5 メディアサイト（記事公開）
- **公開記事の閲覧**: 一般公開サイトで記事を閲覧可能。
- **URL構造の分離**: 管理側（`/dashboard/*`）とメディア側（`/media/*` または `media.bankisha.com`）を完全分離。
- **データベース共有**: 単一のFirestoreデータベースを共有し、`status='public'` の記事のみ表示。
- **SEO最適化**: メタデータ、OGP画像、構造化データ（JSON-LD）の自動生成。
- **詳細仕様**: 詳細は `Docs/MEDIA_SITE_DESIGN.md` を参照。

## 5. ワークフロー
1. **設定**: インタビュアーの人格を設定（スキルナレッジベースは自動取得される）。
2. **企画**: 取材の目的、聞きたいこと、カテゴリを設定。
3. **リハーサル**: AIとプレ取材を行い、質問の精度を調整。
4. **本番取材**: インタビューイーと本番取材。音声と文字で記録。
5. **情報補足**: 取材終了後、日時等の詳細情報を追加。
6. **構成案作成**: 取材データを基に記事の骨組みを生成・修正。
7. **執筆**: 本文を生成し、エディタで最終調整して保存。
8. **公開**: 記事を承認し、`status='public'` に設定してメディアサイトに公開。

## 6. ディレクトリ構造
- `/app`: ページ(Next.js App Router)とAPIルート
  - `/dashboard`: 管理側（認証必須）
  - `/media`: メディア側（一般公開）
  - `/interview`: インタビュー実施ページ
- `/components`: UIコンポーネント (Atomic Designライク)
- `/src/lib`: Firebase、Firestore、共通ユーティリティ
- `/Docs`: 各種仕様書・ガイドライン
- `/functions`: Firebase Cloud Functions (トリガー処理等)
- `/public`: 静的アセット、音声ファイル

## 7. 関連ドキュメント
- **インタビューフロー詳細**: `docs/INTERVIEW_FLOW_AND_ISSUES.md`
  - インタビューの実施フロー、ナレッジベースの活用方法、現在の問題点と改善提案
- **メディアサイト設計**: `Docs/MEDIA_SITE_DESIGN.md`
  - メディアサイトのURL構造、データベース共有戦略、ページ構成、SEO対策
