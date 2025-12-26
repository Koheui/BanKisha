# BanKisha Media 仕様書 v0.1

> 本書は BanKisha（インタビュー〜記事生成）に対し、CMS兼メディア（公開・配信・検索）を追加するための仕様書です。
> 既存アプリ仕様（Next.js App Router / Firestore / Firebase Auth / Gemini）を前提に、メディア領域の全体設計を定義します。

---

## 1. 目的

### 1.1 事業目的
- BanKishaアプリ内で生成した記事（取材記事・プレスリリース等）を **Webメディアとして公開**し、検索流入/広告/PR掲載/タイアップ等の収益機会を作る。
- 「検索をAIに委任」する前提で、**AIに解釈しやすい“仕訳（構造化）”**を徹底し、横断ジャンルでも破綻しない探索体験を実現する。

### 1.2 プロダクト目的
- 生成記事の「公開・編集・審査・配信」を行えるCMSを提供する。
- 検索UIは主役としつつ、実態は AI が意図解釈→内部クエリ化→推薦（サジェスト）する探索を提供する。

---

## 2. スコープ

### 2.1 対象
- 公開メディア（閲覧）
- CMS（投稿者・編集者・管理者向け）
- AI検索/推薦（UIエージェント）
- SEO/OGP/サイトマップ/RSS

### 2.2 非対象（v0.1）
- 外部メディアへの自動シンジケーション（API配信）
- 完全自動の広告配信基盤
- 多言語自動展開（将来）

---

## 3. 用語
- **BanKisha App**：取材（音声/テキスト）→質問生成→記事生成までの既存アプリ。
- **BanKisha Media**：公開メディア＋CMS＋検索/推薦。
- **AI UIエージェント**：ユーザーの入力/行動から意図を推定し、検索・推薦を制御するAI。
- **仕訳（構造化メタ）**：AIが記事を理解/検索/推薦しやすいように付与するメタデータ群。

---

## 4. 全体アーキテクチャ

### 4.1 主要コンポーネント
- Frontend（Next.js App Router）
  - Public Media（/media）
  - CMS（/studio）
- Backend
  - Firestore（記事/ユーザー/審査/閲覧ログ等）
  - Cloud Functions（公開処理、仕訳生成、OGP、sitemap更新、集計）
- AI
  - Gemini（本文生成、仕訳生成、クエリ解釈）
  - ベクトル検索（v0.1は暫定案あり、6章参照）

### 4.2 認証
- BanKishaアカウント（Firebase Authentication）で共通ログイン。
- Public閲覧は匿名可（公開記事のみ）。

---

## 5. 権限・ロール

### 5.1 ロール
- **Reader**（匿名/ログイン）
- **Author**（記事作成・編集・公開申請）
- **Editor**（審査・修正依頼・公開操作）
- **Admin**（設定・全体管理）

### 5.2 権限例
- Author
  - 自分の`draft/review`記事の閲覧/編集
  - `review`申請
- Editor
  - 全`review`記事の閲覧/コメント/差し戻し
  - 公開/非公開切替
- Admin
  - すべて

---

## 6. データモデル（Firestore）

> 既存：`companies`, `interviews`, `articles` 等を拡張。

### 6.1 `articles/{articleId}`（拡張）

#### A. 公開メディア必須
- `status`: `draft | review | published`
- `title`: string
- `slug`: string（URL用、ユニーク）
- `lead`: string
- `body`: object
  - `format`: `md | html | blocks`
  - `content`: any
- `coverImageUrl`: string | null
- `publishedAt`: Timestamp | null
- `updatedAt`: Timestamp
- `createdAt`: Timestamp
- `sourceInterviewId`: string | null

#### B. 所有・公開範囲
- `companyId`: string
- `ownerUserId`: string
- `visibility`: `public | unlisted | private`
- `isSponsored`: boolean（PR/タイアップ）
- `publishChannel`: `media | press_release | case_study`（既存categoryと整合）

#### C. 仕訳（AI構造化メタ） ※公開時に必須生成
- `aiMetaVersion`: number
- `summaryShort`: string（120–200字）
- `summaryLong`: string（300–600字）
- `keyPoints`: string[]（3–7）
- `topics`: string[]（トピック）
- `industry`: string[]（業界）
- `intent`: string[]（例：`pr/recruit/sales/learning/invest`）
- `audienceLevel`: `beginner | practitioner | executive`
- `entities`: object
  - `companies`: string[]
  - `people`: string[]
  - `products`: string[]
  - `places`: string[]
- `timeSensitivity`: `evergreen | news | event`
- `region`: string[]
- `faq`: { `q`: string, `a`: string }[]
- `qualitySignals`: object
  - `firstPerson`: boolean
  - `hasNumbers`: boolean
  - `hasQuotes`: boolean
- `safetyFlags`: object
  - `piiRisk`: boolean
  - `claimsRisk`: boolean

#### D. 検索/推薦向け（計算済み）
- `readingTimeSec`: number
- `language`: string（default: `ja`）
- `embeddingRef`: string | null（外部ベクトルID、またはサブコレ参照）
- `engagement`: object
  - `views`: number
  - `bookmarks`: number
  - `likes`: number

### 6.2 `articleReviews/{id}`（審査ワークフロー）
- `articleId`: string
- `status`: `pending | approved | rejected | changes_requested`
- `reviewerUserId`: string | null
- `notes`: string
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

### 6.3 `userProfiles/{userId}`（メディア向けプロフィール）
- `displayName`: string
- `companyId`: string | null
- `bio`: string | null
- `avatarUrl`: string | null
- `roles`: string[]（author/editor/admin）
- `preferences`: object（興味タグ等、将来）

### 6.4 `mediaEvents/{id}`（閲覧・行動ログ：集計用）
- `userId`: string | null
- `sessionId`: string
- `type`: `view | search | click | bookmark | like`
- `articleId`: string | null
- `query`: string | null
- `aiQuery`: object | null（AI解釈結果）
- `createdAt`: Timestamp

### 6.5 ベクトル（v0.1提案）
- 推奨：外部ベクトルストア（Vertex AI Vector Search 等）
- 暫定：`articles/{id}/embeddings/{v}`
  - `provider`, `model`, `dim`, `vector:number[]`, `createdAt`

---

## 7. 公開フロー（CMS）

### 7.1 ステータス遷移
- `draft` → `review`（公開申請）
- `review` → `published`（公開）
- `review` → `draft`（差し戻し）
- `published` → `private/unlisted`（非公開）

### 7.2 公開申請時処理（Cloud Function）
`onPublishRequest(articleId)`
1. 本文正規化（format統一）
2. 仕訳生成（summary/keyPoints/topics/intent/entities/faq等）
3. safetyFlags生成（PII/誤認）
4. embedding生成・保存（外部 or サブコレ）
5. `slug`確定（衝突回避）
6. `articleReviews`生成（pending）

### 7.3 公開承認時処理（Cloud Function）
`onReviewApprove(articleId)`
1. `status=published`, `publishedAt`設定
2. sitemap更新
3. RSS更新（対象チャンネル）
4. OGP生成（必要なら）

---

## 8. Public Media（閲覧体験）

### 8.1 ルーティング（案）
- `/media`：トップ（AIサジェスト＋新着）
- `/media/search`：検索結果
- `/media/a/{slug}`：記事ページ
- `/media/t/{topic}`：トピック束
- `/media/i/{industry}`：業界束
- `/media/pr`：プレスリリース一覧
- `/media/about`：媒体説明

### 8.2 トップ構成（v0.1）
- Hero：AIサジェスト（「あなた向け」）
- トレンド束（topics）
- 新着（publishedAt desc）
- チャンネル（media/press_release/case_study）

---

## 9. 検索UI & AI UIエージェント

### 9.1 方針
- 検索UIは主役。
- ただし内部では、ユーザー入力をAIが解釈し、**多軸メタ（仕訳）＋意味検索**で探索を行う。

### 9.2 検索の2レーン表示（推奨）
- レーンA：AIおすすめ束（意図に合う上位）
- レーンB：厳密一致（タイトル/エンティティ一致）

### 9.3 Query Understanding（AI解釈）
入力：`q`（自然文/キーワード）
出力：内部クエリJSON（例）
```json
{
  "queryType": "discover",
  "intent": ["pr"],
  "topics": ["SaaS", "AI"],
  "industry": ["IT"],
  "entities": {"companies": ["BanKisha"], "people": []},
  "timeSensitivity": "evergreen",
  "filters": {"region": ["東京"], "audienceLevel": "executive"},
  "sort": "relevance",
  "needClarification": false,
  "suggestedChips": ["採用向け", "導入事例", "プレスリリース"]
}
```

### 9.4 検索実行ロジック（推奨）
1. 意味検索（ベクトル）で候補K件取得
2. 仕訳メタでフィルタ（topics/intent/industry/timeSensitivity等）
3. engagement・freshnessでリランキング
4. 表示：束ね（理由付き）＋厳密一致

### 9.5 “検索しない”導線（将来）
- ログイン後の自動提案
- 閲覧履歴からの次記事提示
- 目的別ナビ（PR/採用/営業…）

---

## 10. SEO / 配信

### 10.1 必須
- `slug`の安定運用
- canonical
- title/description（summaryShort）
- OGP（title/cover/summary）
- sitemap.xml（publishedのみ）

### 10.2 RSS
- `/media/rss.xml`
- チャンネル別RSS（press_release等）

---

## 11. モデレーション（公開品質）

### 11.1 自動フラグ
- PIIリスク（電話/住所/個人名の扱い）
- 誤認リスク（断定表現・根拠不明）
- 誹謗中傷/差別

### 11.2 審査UI（Editor）
- 指摘コメント
- 差し戻しテンプレ
- 修正依頼→再申請

---

## 12. アナリティクス
- 記事：PV/滞在/スクロール/CTR
- 検索：クエリ、AI解釈、クリック
- レコメンド：提示→クリック率

---

## 13. インデックス（Firestore）
- `status + publishedAt(desc)`
- `visibility + publishedAt(desc)`
- `topics(array-contains) + publishedAt(desc)`
- `intent(array-contains) + publishedAt(desc)`
- `companyId + status + updatedAt(desc)`

---

## 14. 画面（v0.1最小）

### Public
- Media Top
- Search Results
- Article Detail
- Topic/Industry Listing

### Studio
- Article List（draft/review/published）
- Article Editor
- Publish Request
- Review Queue（Editor）

---

## 15. API（Next.js Route Handlers / Functions）

### 15.1 Public
- `GET /api/media/search?q=&chips=`
- `GET /api/media/article?slug=`

### 15.2 Studio
- `POST /api/studio/article/create`
- `POST /api/studio/article/update`
- `POST /api/studio/article/requestPublish`
- `POST /api/studio/review/approve`
- `POST /api/studio/review/reject`

---

## 16. リリース計画（v0.1）

### Phase 0：土台
- articles拡張
- 公開フロー（review/publish）

### Phase 1：検索UI（主役）
- Query Understanding
- 2レーン結果

### Phase 2：AIサジェスト
- トップのあなた向け枠
- 次に読む導線

---

## 17. 未決事項（決めると精度が上がる）
- ベクトルストア選定（外部/内部）
- トピック/業界/意図のマスター運用（自由入力 vs 正規化）
- PR/広告の表示方針（isSponsoredの表示義務）
- 公開ドメイン戦略（/media サブパス or サブドメイン）

---

## 18. 変更履歴
- v0.1：初版（CMS + Public Media + AI検索/仕訳の最小要件）

