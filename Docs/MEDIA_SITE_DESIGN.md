# メディアサイト設計メモ

## 概要
BanKishaで作成されたインタビュー記事を集約して表示する、独立したメディアサイトの設計メモです。
記事作成・管理は既存のダッシュボード、記事公開・閲覧はメディアサイトで行い、データベース（Firestore）は共有します。

## URL構造の分離

### 管理側（既存のダッシュボード）
**目的**: 記事の作成・編集・承認管理  
**アクセス**: 管理者・企業ユーザーのみ（認証必須）

```
https://bankisha.com/dashboard                    # ダッシュボード
https://bankisha.com/dashboard/articles/[id]/edit # 記事編集
https://bankisha.com/admin/knowledge-base         # ナレッジベース管理
https://bankisha.com/admin/question-sets          # 質問セット管理
https://bankisha.com/invite/[sessionId]           # インタビュー実施
```

### メディア側（新規：読者向け公開サイト）
**目的**: 公開記事の閲覧  
**アクセス**: 一般公開（認証不要）

#### 推奨URL構造（別ドメイン）
```
https://media.bankisha.com/                       # メディアトップページ
https://media.bankisha.com/articles               # 記事一覧
https://media.bankisha.com/articles/[id]          # 個別記事ページ（公開用）
https://media.bankisha.com/companies              # 企業一覧
https://media.bankisha.com/companies/[id]         # 企業ページ
https://media.bankisha.com/categories/[category]  # カテゴリ別記事一覧
```

#### 代替案（サブディレクトリ）
```
https://bankisha.com/media/                       # メディアトップページ
https://bankisha.com/media/articles/[id]          # 個別記事ページ（公開用）
```

### URL構造の重要ポイント
1. **完全分離**: 管理URL（`/dashboard/*`）と公開URL（`/media/*` or `media.bankisha.com`）は明確に分離
2. **同じArticle ID**: 両方のURLで同じArticle IDを使用（Firestoreで共有）
3. **公開条件**: メディア側は `status='public'` の記事のみ表示
4. **SEO最適化**: メディア側のURLはSEOに最適化（クリーンURL、メタデータ充実）

## データベース共有戦略

### 基本方針
- **単一のFirestoreデータベース**を管理側とメディア側で共有
- **`articles` コレクション**を両方で使用
- **アクセス制御**は `status` フィールドとFirestore Rulesで管理

### データフロー
```
1. 管理側（ダッシュボード）
   ↓
   Article作成・編集（status: draft, submitted, approved）
   ↓
   承認・公開（status: public）
   ↓
2. メディア側（公開サイト）
   ↓
   status='public'の記事のみ表示
```

## データ構造

### 必要なフィールド（既に実装済み）
- `Article.coverImageUrl`: カバー画像URL
- `Article.summary`: 記事サマリー（2〜3文、100文字程度）
- `Article.status`: 記事ステータス（'public'のみ表示）
- `Article.draftArticle.title`: 記事タイトル
- `Article.draftArticle.lead`: リード文
- `Article.draftArticle.bodyMd`: 本文（Markdown）
- `Article.finalArticle`: 承認後の最終記事（あれば使用）
- `Article.createdAt`: 作成日時
- `Article.updatedAt`: 更新日時
- `Article.companyId`: 企業ID

### 追加検討フィールド
```typescript
interface Article {
  // ... 既存フィールド ...
  
  // メディアサイト用追加フィールド（将来実装）
  category?: string            // カテゴリ（例: 'tech', 'startup', 'business'）
  tags?: string[]              // タグ配列
  viewCount?: number           // 閲覧数
  publishedAt?: Date           // 公開日時（status='public'になった日時）
  featured?: boolean           // 注目記事フラグ
  seoTitle?: string            // SEO用タイトル
  seoDescription?: string      // SEO用説明文
  ogImageUrl?: string          // OGP画像URL（coverImageUrlと同じでも可）
}
```

## ページ構成

### 1. トップページ (`/media/`)
- **ヒーローセクション**
  - 注目記事（featured=true）のスライダー
  - カバー画像、タイトル、サマリー表示
  
- **最新記事セクション**
  - 最新の公開記事を6〜12件表示
  - カード形式（カバー画像、タイトル、サマリー、企業名、公開日）
  
- **カテゴリ別セクション**
  - カテゴリごとに記事を表示
  
- **企業一覧へのリンク**

### 2. 記事一覧ページ (`/media/articles`)
- **フィルタ機能**
  - カテゴリフィルタ
  - 日付フィルタ
  - 企業フィルタ
  
- **ソート機能**
  - 新着順
  - 人気順（viewCount）
  
- **ページネーション**
  - 1ページあたり12〜24件表示
  
- **記事カード**
  - カバー画像（16:9 or 4:3）
  - タイトル
  - サマリー
  - 企業名
  - 公開日
  - カテゴリタグ

### 3. 個別記事ページ (`/media/articles/[id]`)
- **ヘッダー**
  - カバー画像（フルワイド）
  - タイトル
  - 公開日、企業名、カテゴリ
  - SNSシェアボタン
  
- **記事本文**
  - Markdownレンダリング
  - 目次（見出しから自動生成）
  - 画像の最適化表示
  
- **企業情報サイドバー**
  - 企業ロゴ
  - 企業名
  - 企業プロフィール
  - 企業ページへのリンク
  - 会社URL
  
- **関連記事**
  - 同じ企業の他の記事
  - 同じカテゴリの記事
  
- **SNSシェア**
  - Twitter/X
  - LinkedIn
  - Facebook
  - コピーリンク

### 4. 企業ページ (`/media/companies/[id]`)
- **企業情報**
  - 企業ロゴ
  - 企業名
  - 企業プロフィール
  - 設立年
  - 会社URL
  - 住所
  
- **この企業の記事一覧**
  - 記事カード形式で表示

### 5. カテゴリページ (`/media/categories/[category]`)
- カテゴリ別の記事一覧
- カテゴリ説明
- フィルタ・ソート機能

## 技術スタック

### フロントエンド
- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Shadcn UI**

### データ取得
- **Firestore**
  - `status='public'`の記事のみ取得
  - インデックス: `status`, `createdAt`, `category`, `companyId`
  
### 画像最適化
- **Next.js Image**コンポーネント
- Firebase Storageからの画像配信
- 必要に応じてCDN（Cloudflare Images等）

### SEO対策
- **Next.js Metadata API**
- **動的OGP画像生成**（@vercel/og）
- **サイトマップ自動生成**
- **構造化データ（JSON-LD）**
  - Article schema
  - Organization schema

## Firestore クエリ例

### 公開記事一覧取得
```typescript
const articlesQuery = query(
  collection(db, 'articles'),
  where('status', '==', 'public'),
  orderBy('createdAt', 'desc'),
  limit(12)
)
```

### カテゴリ別記事取得
```typescript
const categoryQuery = query(
  collection(db, 'articles'),
  where('status', '==', 'public'),
  where('category', '==', 'tech'),
  orderBy('createdAt', 'desc')
)
```

### 企業別記事取得
```typescript
const companyQuery = query(
  collection(db, 'articles'),
  where('status', '==', 'public'),
  where('companyId', '==', companyId),
  orderBy('createdAt', 'desc')
)
```

## 必要なFirestoreインデックス
```
articles
  - status (ASC) + createdAt (DESC)
  - status (ASC) + category (ASC) + createdAt (DESC)
  - status (ASC) + companyId (ASC) + createdAt (DESC)
  - status (ASC) + featured (DESC) + createdAt (DESC)
```

## デザインガイドライン

### カラースキーム
- プライマリ: ブルー系（既存のBanKishaブランドカラー）
- セカンダリ: パープル系
- アクセント: グリーン系（公開ステータス）

### タイポグラフィ
- 見出し: 太字、大きめ
- 本文: 読みやすいサイズ（16px〜18px）
- 行間: 1.6〜1.8

### レイアウト
- レスポンシブデザイン
- モバイルファースト
- カード形式の記事表示
- グリッドレイアウト（記事一覧）

## 実装優先順位

### フェーズ1（MVP）
1. 記事一覧ページ
2. 個別記事ページ
3. 基本的なSEO対策

### フェーズ2
1. トップページ
2. 企業ページ
3. カテゴリページ
4. フィルタ・ソート機能

### フェーズ3
1. 検索機能
2. 閲覧数カウント
3. 関連記事レコメンド
4. SNSシェア統計

## セキュリティ考慮事項

### Firestore Security Rules
```javascript
// メディア側からのアクセス制御
match /articles/{articleId} {
  // 公開記事は誰でも読める
  allow read: if resource.data.status == 'public';
  
  // 書き込みは管理側のみ（認証ユーザー）
  allow write: if request.auth != null && (
    request.auth.token.role == 'admin' ||
    request.auth.token.companyId == resource.data.companyId
  );
}

// 企業情報は公開記事がある企業のみ読める
match /companies/{companyId} {
  allow read: if exists(/databases/$(database)/documents/articles/$(articleId)) 
    && get(/databases/$(database)/documents/articles/$(articleId)).data.status == 'public'
    && get(/databases/$(database)/documents/articles/$(articleId)).data.companyId == companyId;
}
```

### アクセス制御
- **メディア側**: 
  - 公開記事（`status='public'`）のみ表示
  - 認証不要でアクセス可能
  - 下書きや申請中の記事は非表示
  
- **管理側（ダッシュボード）**:
  - 全ステータスの記事を表示
  - 認証必須
  - ロールベースのアクセス制御

### データ保護
- 企業情報は公開可能な情報のみ表示
- 画像URLは直接アクセス可能（Firebase Storage Rules設定）
- 個人情報（担当者名、電話番号等）はメディア側では非表示

## パフォーマンス最適化
- **静的生成（SSG）**
  - 記事ページは静的生成
  - ISR（Incremental Static Regeneration）で定期更新
  
- **キャッシング**
  - 記事一覧はキャッシュ
  - 画像はCDNキャッシュ
  
- **遅延読み込み**
  - 画像の遅延読み込み
  - 無限スクロール（記事一覧）

## アナリティクス
- **Google Analytics 4**
- **閲覧数トラッキング**
- **人気記事ランキング**
- **企業別統計**

## 今後の拡張機能
- コメント機能
- いいね機能
- ブックマーク機能
- ニュースレター購読
- RSS/Atomフィード
- AMP対応
- PWA化

## URL・データベース分離の実装メモ

### 記事URLの対応表
| 用途 | URL | アクセス | 表示内容 |
|------|-----|---------|---------|
| 記事編集 | `/dashboard/articles/[id]/edit` | 管理者・企業 | 全ステータスの記事 |
| 記事公開 | `/media/articles/[id]` | 一般公開 | `status='public'`のみ |

### 同じArticle IDの利用
```typescript
// 例: Article ID = "abc123"

// 管理側URL
https://bankisha.com/dashboard/articles/abc123/edit

// メディア側URL  
https://media.bankisha.com/articles/abc123

// どちらも同じFirestoreドキュメントを参照
db.collection('articles').doc('abc123')
```

### データベース共有のメリット
1. **データ整合性**: 単一ソースで管理
2. **リアルタイム反映**: 公開した記事が即座にメディアに反映
3. **開発効率**: 別々のデータベースを管理する必要がない
4. **コスト削減**: 1つのFirestoreプロジェクトで運用

### 注意点
- メディア側では `status='public'` のクエリフィルタを**必ず**適用
- Firestore Rulesで適切なアクセス制御を設定
- メディア側では編集・削除機能を提供しない（読み取り専用）
- 記事URLは管理側とメディア側で異なる（混同しないように）

