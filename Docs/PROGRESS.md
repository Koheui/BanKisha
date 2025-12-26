# Progress Log

最終更新: 2025-12-26

## 要旨（進行中の対応まとめ）
- **目的**: インタビュー作成フローの整理（重複排除・ステップ順序の適正化）および「質問生成」機能の安定化。
- **実施済み**: 
    - **インタビュフローの刷新**: モーダルおよびページを1:基本、2:方針、3:取材先、4:構成の4ステップに整理。「具体的に聞きたいこと」を最終ステップに移動し、重複を排除。
    - **ビルドエラー修正**: `app/api/interview/generate-questions/route.ts` での `JSON.parse` 型エラーを型ガードにより解消。
    - **記事作成連携**: 登録済みインタビュー情報からの自動補完と、項目がある場合の自動折りたたみ機能を実装。
- **現状**: 主要なUIのリファクタリングと、デプロイを阻害していたビルドエラーの修正が完了。Cloud Run への再デプロイが可能な状態。
- **次の優先タスク**:
  1. 修正版をデプロイし、実際の動作（特に Gemini からの質問生成）を確認する。
  2. Cloud Run のログで JSON 抽出の成功率を確認し、必要に応じてプロンプトをさらに調整。
- **関連ブランチ**: `add-kb-index`, `fix-gemini-json`

## 2025-12-24

- **Issue:** Deployment completed but the application shows Firebase environment variable errors.
- **Issue:** `npm run add:company` script fails with `SyntaxError: Cannot use import statement outside a module`.
- **Fix:** Modified `package.json` to add `ts-node` compiler options: `--compiler-options '{"module": "commonjs"}'`.
- **Current Issue:** `npm run add:company` script fails with `❌ Firebase Admin SDK の初期化に失敗しました`. The script requires admin credentials.
- **Next Step:** Generate a `service-account-key.json` from Google Cloud Console and place it in the project root to authenticate the admin script.

## 2025-12-24 (Continued)

- **Documentation:** Created `Docs/SPECIFICATION.md` which defines the architecture and data models for the Media publishing platform.
- **Data Model Update:** Extended `Article` type in `src/types/index.ts` to include AI metadata, slugs, and publishing status. Updated `src/lib/firestore.ts` to handle these fields.
- **Build Fix:** Resolved a critical TypeScript error in `app/dashboard/articles/page.tsx` where new `ArticleStatus` types (review, published) were not handled in `getStatusBadge`.
- **Deployment Status:** Deployment to Cloud Run initiated to push the latest profile and interview fixes.
- **User Profile Feature:** Created an Account Page (`/dashboard/profile`) to allow users to set their display name and company name. This automatically manages `companyId` association, resolving the blocker for creating interviews and interviewers.
- **Database Refinement**: Updated `Article` and `User` models, implemented unique slug generation, and ensured ownership tracking.
- **AI Accuracy**: Upgraded to `gemini-2.0-flash` across all routes and refined interview prompts for better flow and empathy.
- **Profile Enhancements**: Added `bio` support to user profiles.
- **Vulnerability Audit**: Conducted `npm audit` and identified critical legacy dependencies for future monitoring.

## 2025-12-22: メディアサイト実装（BanKisha-Kawaraban）

### 概要
BanKisha（インタビューアプリ）とBanKisha-Kawaraban（番記者瓦版・メディアサイト）を別サイトとして分離し、記事公開機能を実装しました。

### 実装内容

#### フェーズ1: MVP（記事一覧・個別記事・SEO）
- **ディレクトリ構造の作成**
  - `app/media/layout.tsx` - メディアサイト専用レイアウト
  - `app/media/page.tsx` - トップページ
  - `app/media/articles/page.tsx` - 記事一覧ページ
  - `app/media/articles/[id]/page.tsx` - 個別記事ページ
  - `components/media/ArticleCard.tsx` - 記事カードコンポーネント
  - `components/media/ArticleView.tsx` - 記事表示コンポーネント
  - `components/media/ArticlesList.tsx` - 記事一覧コンポーネント

- **SEO対策**
  - `generateMetadata` 関数で動的メタデータ生成
  - 構造化データ（JSON-LD）の追加
  - Open Graph と Twitter Card の設定

- **Firestore設定**
  - インデックス追加（`status + category + createdAt`, `status + companyId + createdAt`）
  - Firestore Rules更新（`status='public'`の記事のみ読み取り可能）

#### フェーズ2: 拡張機能（トップページ・企業ページ・カテゴリページ・フィルタ）
- **トップページ実装**
  - `components/media/HeroSection.tsx` - ヒーローセクション（注目記事）
  - `components/media/LatestArticlesSection.tsx` - 最新記事セクション
  - `components/media/CategorySection.tsx` - カテゴリ別セクション

- **企業ページ実装**
  - `app/media/companies/page.tsx` - 企業一覧ページ
  - `app/media/companies/[id]/page.tsx` - 個別企業ページ
  - `components/media/CompanyProfile.tsx` - 企業プロフィールコンポーネント
  - `components/media/CompanyArticles.tsx` - 企業別記事一覧コンポーネント
  - `components/media/CompaniesList.tsx` - 企業一覧コンポーネント

- **カテゴリページ実装**
  - `app/media/categories/[category]/page.tsx` - カテゴリ別記事一覧ページ
  - `components/media/CategoryArticles.tsx` - カテゴリ別記事コンポーネント

- **フィルタ・ソート機能**
  - `components/media/ArticleFilters.tsx` - フィルタコンポーネント
    - カテゴリフィルタ
    - 企業フィルタ
    - 日付フィルタ（今週、今月、今年）
    - ソート（新着順、古い順）

#### フェーズ3: 高度な機能（検索・閲覧数・関連記事・SNSシェア）
- **検索機能**
  - `app/media/search/page.tsx` - 検索ページ
  - `components/media/SearchResults.tsx` - 検索結果コンポーネント
  - 全文検索（タイトル、リード、本文）
  - 検索履歴の保存（ローカルストレージ）

- **閲覧数カウント**
  - `app/api/media/articles/[id]/view/route.ts` - 閲覧数カウントAPI
  - 記事閲覧時に `engagement.views` をインクリメント
  - 個別記事ページで閲覧数を表示

- **関連記事レコメンド**
  - `components/media/RelatedArticles.tsx` - 関連記事コンポーネント
  - 同じ企業または同じカテゴリの記事を表示

- **SNSシェア機能**
  - `components/media/ShareButtons.tsx` - シェアボタンコンポーネント
  - Twitter/X, LinkedIn, Facebook, リンクコピーに対応

### 記事公開フローの実装

#### ユーザー登録時の企業作成
- **`components/auth/AuthProvider.tsx`**
  - `signUp` 関数に企業作成機能を追加
  - ユーザー登録時に企業（Company）を自動作成
  - 企業名が未指定の場合は、メールアドレスのドメインから自動生成
  - ユーザードキュメントに `companyId` を設定

- **`app/signup/page.tsx`**
  - 企業名入力フィールドを追加（任意）
  - リダイレクト機能を追加（`redirect` クエリパラメータ）

- **`src/lib/firestore.ts`**
  - `createCompany` 関数を追加
  - `getArticles` 関数に `category` パラメータを追加

#### 記事公開機能
- **`app/media/publish/[articleId]/page.tsx`**（新規作成）
  - 記事公開専用ページ
  - 未ログイン時は登録画面にリダイレクト（記事IDを保持）
  - ログイン後、カテゴリとサマリーを入力して公開
  - 公開完了画面を表示

- **`components/articles/ArticleEditor.tsx`**
  - 「メディアに公開」ボタンを `/media/publish/[articleId]` へのリンクに変更
  - ダイアログから専用ページへの遷移に変更

- **`app/login/page.tsx`**
  - リダイレクト機能を追加

### ブランディングの更新
- メディアサイトの名称を「BanKisha-Kawaraban（番記者瓦版）」に変更
- すべてのページのメタデータ、タイトル、フッターを更新
- フッターに「Powered by BanKisha（AIインタビュアーアプリ）」リンクを追加
- トップページに「BanKisha-Kawaraban（番記者瓦版）について」セクションを追加

### ワークフロー
1. **ユーザー登録** → 企業（Company）が自動作成され、ユーザーに紐付け
2. **記事作成** → インタビューから記事を生成（`companyId`が自動設定）
3. **メディア公開** → 記事編集画面で「メディアに公開」をクリック
   - 未ログインの場合: 登録画面に遷移 → 登録後、公開ページに戻る
   - ログイン済みの場合: 公開ページでカテゴリ選択 → 公開
4. **メディアサイトで閲覧** → BanKisha-Kawaraban（`/media/articles/[id]`）で記事が閲覧可能

### 既存システムへの影響
- **記事作成システム**: 最小限の変更（公開フローの変更のみ）
- **記事の生成・保存・編集機能**: 変更なし
- **ステータス管理**: 変更なし

詳細は `docs/ARTICLE_SYSTEM_UPDATES.md` を参照してください。

## 2025-12-24: ナレッジベース活用機能の実装と機密保護対策

### 概要
全生成プロセスでアプリの方向性とナレッジベースを一貫して活用する仕組みを実装し、機密ナレッジベース（スキル/情報タイプ）の情報漏洩を防止しながら、機能を維持する対策を実施しました。

### 実装内容

#### フェーズ1: ナレッジベース活用方法選択機能の実装

##### 型定義の追加
- **`src/types/index.ts`**
  - `KnowledgeBase`インターフェースに以下を追加：
    - `useForDialogue?: boolean` - 対話術での使用（デフォルト: `true`）
    - `useForArticle?: boolean` - 記事作成での使用（デフォルト: `false`）
    - `useForSummary?: boolean` - サマリー作成での使用（デフォルト: `false`）

##### ナレッジベース管理ページのUI追加
- **`app/dashboard/user-kb/page.tsx`**
  - 各ナレッジベースに「対話術」「記事作成」「サマリー作成」のチェックボックスを追加
  - `handleUsageChange`関数を実装し、Firestoreとローカル状態を更新
  - リアルタイムで活用方法を変更可能

##### デフォルト値の設定
- **`app/api/knowledge-base/create/route.ts`**
  - 新規作成時に以下を設定：
    - `useForDialogue: true`（デフォルト: 有効）
    - `useForArticle: false`（デフォルト: 無効）
    - `useForSummary: false`（デフォルト: 無効）

#### フェーズ2: 全生成プロセスでのアプリ方向性・ナレッジベース活用指示の確認と修正

##### アプリの方向性の取得と活用
すべてのAPIエンドポイントで以下を実装：
- **`systemSettings.appDirection.directionPrompt`**を取得
- プロンプトの最初に「【最重要の基本原則：アプリの方向性】」として含める
- エラーハンドリングを追加（取得失敗時も処理を継続）

##### スキルナレッジベースの自動取得
以下のエンドポイントで、サーバー側でスキルナレッジベースを自動取得：
- `app/api/interview/generate-questions/route.ts`
- `app/api/interview/generate-follow-up/route.ts`
- `app/api/interview/generate-next-question/route.ts`
- `app/api/interview/generate-reaction/route.ts`
- `app/api/interview/evaluate-response/route.ts`
- `app/api/interview/evaluate-progress/route.ts`
- `app/api/article/generate-from-draft/route.ts`
- `app/api/article/generate-draft/route.ts`

**実装内容：**
- クライアント側から`knowledgeBaseIds`を送信する必要がなくなり、サーバー側で自動取得
- `useForDialogue === false`または`useForArticle === false`のナレッジベースをフィルタリング
- 削除済み（`deleted === true`）と編集時のみ使用（`isEditOnly === true`）を除外

##### ナレッジベースのプロンプトへの組み込み
すべての生成プロセスで、ナレッジベースを「思考の起点」としてプロンプトに含める：
- プロンプト構造: **アプリの方向性** → **ナレッジベース（思考の起点）** → **具体的な指示**
- 「⚠️ 最重要」マーカーで強調し、必ず最初に参照するよう指示

#### フェーズ3: 機密ナレッジベース情報漏洩防止対策（機能維持版）

##### Firestoreセキュリティルールの強化
- **`firestore.rules`**
  - `knowledgeBases`コレクションの読み取りルールを更新
  - `skill`/`info`タイプのナレッジベースは`superAdmin`のみ読み取り可能
  - `user`タイプのナレッジベースは通常通り読み取り可能

##### クライアント側関数の制限
- **`src/lib/firestore.ts`**
  - `getKnowledgeBases`関数で、クライアント側からの`skill`/`info`取得を禁止
  - クライアント側から呼び出された場合、空配列を返す
  - `getSkillKnowledgeBases`と`getInfoKnowledgeBases`も同様に制限

##### クライアント側コンポーネントの修正
以下のファイルで`getSkillKnowledgeBases()`の呼び出しを削除：
- `app/dashboard/interviews/new/page.tsx`
- `app/dashboard/interviews/[id]/rehearsal/page.tsx`
- `components/interviews/CreateInterviewModal.tsx`
- `knowledgeBaseIds`を空配列に設定（サーバー側で自動取得されるため）

##### APIエンドポイントでのログ出力のマスク
すべてのAPIエンドポイントで以下を実装：
- ナレッジベースの内容を含むログを削除またはマスク
- エラーメッセージで「[details masked]」と表示
- コンソールログでナレッジベースの詳細を出力しない

##### エラーハンドリングの改善
- ナレッジベース関連のエラーで、内容を含むメッセージを返さない
- クライアント側に機密情報が漏洩しないよう、エラーレスポンスを汎用的に

#### フェーズ4: 活用方法フィルタリングの実装

##### 対話術プロセスでのフィルタリング
以下のエンドポイントで`useForDialogue === false`のナレッジベースをスキップ：
- `app/api/interview/generate-questions/route.ts`
- `app/api/interview/generate-follow-up/route.ts`
- `app/api/interview/generate-next-question/route.ts`
- `app/api/interview/generate-reaction/route.ts`
- `app/api/interview/evaluate-response/route.ts`
- `app/api/interview/evaluate-progress/route.ts`

**実装内容：**
- スキルナレッジベース: サーバー側で自動取得し、`useForDialogue === false`をフィルタリング
- ユーザーナレッジベース: クライアント側から送信されたIDから取得し、`useForDialogue === false`をフィルタリング

##### 記事作成プロセスでのフィルタリング
- **`app/api/article/generate-from-draft/route.ts`**
  - スキルナレッジベース: サーバー側で自動取得し、`useForArticle === false`をフィルタリング（未設定の場合は使用）
  - ユーザーナレッジベース: `useForArticle === true`のもののみ使用

- **`app/api/article/generate-draft/route.ts`**
  - スキルナレッジベース: サーバー側で自動取得し、`useForArticle === false`をフィルタリング（未設定の場合は使用）

##### サマリー作成プロセス
- サマリー生成APIエンドポイントが存在しないため、実装不要

### 実装順序の問題修正

#### 修正内容
1. **`app/api/interview/generate-reaction/route.ts`**
   - スキルナレッジベースをサーバー側で自動取得するように修正
   - 以前は`knowledgeBaseIds`から取得していたが、サーバー側で自動取得に変更

2. **`app/api/article/generate-draft/route.ts`**
   - アプリの方向性を取得・活用するように追加
   - スキルナレッジベースをサーバー側で自動取得するように修正

3. **`app/api/interview/generate-questions/route.ts`**
   - ユーザーナレッジベースでも`useForDialogue === false`のフィルタリングを追加

### 実装完了の確認

すべてのAPIエンドポイントで以下を確認済み：
- ✅ アプリの方向性を取得し、プロンプトの最初に含める
- ✅ スキルナレッジベースをサーバー側で自動取得（クライアント側から送信不要）
- ✅ ナレッジベースを「思考の起点」としてプロンプトに含める
- ✅ 適切な`useFor*`フィルタリングを実装
- ✅ 機密保護のため、ログ出力とエラーハンドリングで内容をマスク
- ✅ Firestoreセキュリティルールで`skill`/`info`タイプの読み取りを制限
- ✅ クライアント側関数で`skill`/`info`取得を禁止

### 影響範囲

#### 既存システムへの影響
- **ナレッジベース管理**: UI追加のみ（既存機能に影響なし）
- **生成プロセス**: すべての生成プロセスでアプリの方向性とナレッジベースが一貫して活用されるよう改善
- **セキュリティ**: 機密ナレッジベースの情報漏洩リスクを大幅に削減

#### パフォーマンスへの影響
- スキルナレッジベースの自動取得により、クライアント側の処理が軽減
- サーバー側での取得により、一貫性とセキュリティが向上

### 技術的詳細

#### プロンプト構造の統一
すべての生成プロセスで以下の構造を採用：
```
【最重要の基本原則：アプリの方向性】
{directionPromptContext}

【最重要：思考の起点 - {用途}のベストプラクティス（ナレッジベース）】
{knowledgeBaseContext}

⚠️ 最重要: 上記のナレッジベースは、{用途}における思考の起点です。
必ず最初にこの内容を参照し、その原則と手法に基づいて{処理}してください。

{具体的な指示}
```

#### フィルタリングロジック
```typescript
// スキルナレッジベースのフィルタリング例
if (kbData?.deleted === true) return null
if (kbData?.useForDialogue === false) return null
if (kbData?.isEditOnly === true) return null
```

## ❗️ 今の課題（未解決・要対応）
- **TypeScript のビルドエラー**: `app/api/interview/generate-questions/route.ts` の JSON 抽出で `RegExpMatchArray | string` を `JSON.parse` に渡してしまい、型エラーで Cloud Build が失敗している。対策: マッチ結果を明示的に `string` に取り出す型ガード、`try/catch` と詳細ログを追加してビルドを通す。
- **AI 応答が純粋な JSON にならないケース**: プロンプト厳格化を行ったが、まだ自然文が返る場合がある。対策: プロンプトをさらに強化（"出力は純粋なJSONオブジェクトのみ" を明示）し、非JSON応答時の再試行・整形ロジックを導入する。
- **本番ログの追加サンプル収集が必要**: Cloud Run の raw Gemini レスポンスサンプルを収集してパターン分析を行い、パーサを改善する。
- **リポジトリの方針決定**: ローカル `.git` が壊れているため、今後の作業ベースを新規クローンに移すか、ローカルの復旧作業を行うか決める必要がある。

**優先対応の順序（提案）**: 1) TypeScript の型安全化でビルドを通す → 2) デプロイして Cloud Run ログを確認 → 3) JSON 抽出失敗が続くならプロンプト強化と寛容パーサを実装 → 4) 必要ならローカル Git を復旧。

## Current Focus
 
 1. **Deployment & Verification:** 修正したインタビュー作成フローと質問生成ロジックのデプロイ、および実地検証。
 2. **AI Metadata:** 記事の内容から構造化メタデータ（仕訳）を Gemini で自動生成するロジックの実装。
 3. **Publishing Workflow:** 記事のレビュー・公開プロセスの UI とロジックのブラッシュアップ。
 4. **Media Site:** BanKisha-Kawaraban（番記者瓦版）の実装継続と公開フローの最適化。
 5. **System Stability:** `generate-questions` をはじめとする全生成プロセスでの例外処理と再試行ロジックの強化。