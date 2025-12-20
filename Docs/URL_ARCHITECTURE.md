# URL アーキテクチャ設計

## 概要
BanKishaは「記事管理システム」と「メディア公開サイト」の2つのURLスペースを持ちます。
データベース（Firestore）は共有しますが、URLとアクセス権限は明確に分離します。

## URL構造

### 1. 管理側（Dashboard）
**ドメイン**: `https://bankisha.com`  
**目的**: 記事の作成・編集・承認管理  
**アクセス**: 認証必須（管理者・企業ユーザー）

```
/                              # ランディングページ
/login                         # ログイン
/signup                        # サインアップ
/dashboard                     # ダッシュボード（記事一覧、統計）
/dashboard/articles/[id]/edit  # 記事編集
/dashboard/profile             # 企業プロフィール編集
/admin/knowledge-base          # ナレッジベース管理（管理者のみ）
/admin/question-sets           # 質問セット管理（管理者のみ）
/invite/[sessionId]            # インタビュー実施
/interview/complete            # インタビュー完了
```

### 2. メディア側（Public Media Site）
**ドメイン**: `https://media.bankisha.com` **（推奨）**  
または `https://bankisha.com/media/` **（代替案）**

**目的**: 公開記事の閲覧  
**アクセス**: 一般公開（認証不要）

```
/                              # メディアトップページ
/articles                      # 記事一覧
/articles/[id]                 # 個別記事ページ
/companies                     # 企業一覧
/companies/[id]                # 企業ページ
/categories                    # カテゴリ一覧
/categories/[category]         # カテゴリ別記事一覧
/about                         # メディアについて
/contact                       # お問い合わせ
```

## データベース構造（共有）

### Firestore コレクション
```
articles/                      # 記事（管理側・メディア側で共有）
  {articleId}/
    - companyId: string
    - status: 'draft' | 'submitted' | 'approved' | 'public'
    - coverImageUrl: string
    - summary: string
    - draftArticle: {...}
    - finalArticle: {...}
    - createdAt: Timestamp
    - updatedAt: Timestamp
    
companies/                     # 企業情報（管理側・メディア側で共有）
  {companyId}/
    - name: string
    - logoUrl: string
    - profile: string
    - website: string
    - ...
```

## アクセス制御

### 管理側の動作
- **全ステータスの記事を表示**: `draft`, `submitted`, `approved`, `public`
- **編集可能**: 記事の作成・編集・削除・ステータス変更
- **認証チェック**: Firebase Authenticationで認証
- **ロールチェック**: `admin` または自社の記事のみ編集可能

### メディア側の動作
- **公開記事のみ表示**: `status='public'` のみ
- **読み取り専用**: 記事の閲覧のみ、編集不可
- **認証不要**: 誰でもアクセス可能
- **SEO最適化**: メタデータ、OGP、構造化データを提供

## 実装例

### 管理側（Dashboard）の記事取得
```typescript
// /dashboard - 自社の全記事を表示
const articlesQuery = query(
  collection(db, 'articles'),
  where('companyId', '==', user.companyId),
  orderBy('updatedAt', 'desc')
)

// /dashboard/articles/[id]/edit - 記事編集
const article = await getDoc(doc(db, 'articles', articleId))
// ステータスに関係なく取得・編集可能
```

### メディア側（Public）の記事取得
```typescript
// /media/articles - 公開記事一覧
const articlesQuery = query(
  collection(db, 'articles'),
  where('status', '==', 'public'),
  orderBy('createdAt', 'desc'),
  limit(12)
)

// /media/articles/[id] - 個別記事ページ
const article = await getDoc(doc(db, 'articles', articleId))
if (article.data()?.status !== 'public') {
  // 404エラーを返す（公開されていない記事）
  return notFound()
}
```

## Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // 記事のアクセス制御
    match /articles/{articleId} {
      // 認証済みユーザー: 自社の記事は全ステータス読み取り可
      allow read: if request.auth != null && (
        request.auth.token.role == 'admin' ||
        resource.data.companyId == request.auth.token.companyId
      );
      
      // 未認証ユーザー: 公開記事のみ読み取り可
      allow read: if request.auth == null && resource.data.status == 'public';
      
      // 書き込み: 認証済みで権限があるユーザーのみ
      allow create: if request.auth != null && (
        request.auth.token.role == 'admin' ||
        request.resource.data.companyId == request.auth.token.companyId
      );
      
      allow update, delete: if request.auth != null && (
        request.auth.token.role == 'admin' ||
        resource.data.companyId == request.auth.token.companyId
      );
    }
    
    // 企業情報のアクセス制御
    match /companies/{companyId} {
      // 認証済みユーザー: 自社情報は読み書き可
      allow read, write: if request.auth != null && (
        request.auth.token.role == 'admin' ||
        request.auth.token.companyId == companyId
      );
      
      // 未認証ユーザー: 公開記事がある企業の基本情報のみ読み取り可
      allow read: if request.auth == null;
    }
  }
}
```

## リダイレクト設定

### Next.js rewrites（代替案でサブディレクトリを使う場合）
```javascript
// next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: '/media/:path*',
        destination: '/media/:path*', // メディア側のページへルーティング
      },
    ]
  },
}
```

### 別ドメインの場合
- `bankisha.com`: 管理側（Next.jsアプリ）
- `media.bankisha.com`: メディア側（別のNext.jsアプリ or 同じアプリの別ルート）
- 両方とも同じFirestoreプロジェクトを参照

## 記事公開フロー

```
1. 企業ユーザーがインタビュー実施
   ↓
2. 記事が自動生成（status: 'draft'）
   ↓
3. 企業ユーザーが編集して承認申請（status: 'submitted'）
   ↓
4. 管理者が承認（status: 'approved'）
   ↓
5. 管理者が公開（status: 'public'）
   ↓
6. メディア側（/media/articles/[id]）で即座に閲覧可能
```

## URL変換ヘルパー関数

```typescript
// utils/urls.ts

/**
 * 管理側の記事編集URLを生成
 */
export function getDashboardArticleEditUrl(articleId: string): string {
  return `/dashboard/articles/${articleId}/edit`
}

/**
 * メディア側の記事公開URLを生成
 */
export function getMediaArticleUrl(articleId: string): string {
  const mediaBaseUrl = process.env.NEXT_PUBLIC_MEDIA_URL || 'https://media.bankisha.com'
  return `${mediaBaseUrl}/articles/${articleId}`
}

/**
 * 記事のステータスに応じて適切なURLを返す
 */
export function getArticleUrl(article: Article): string {
  if (article.status === 'public') {
    return getMediaArticleUrl(article.id)
  } else {
    return getDashboardArticleEditUrl(article.id)
  }
}
```

## 環境変数

```bash
# .env.local

# 管理側のベースURL
NEXT_PUBLIC_DASHBOARD_URL=https://bankisha.com

# メディア側のベースURL
NEXT_PUBLIC_MEDIA_URL=https://media.bankisha.com

# または、サブディレクトリの場合
# NEXT_PUBLIC_MEDIA_URL=https://bankisha.com/media
```

## メリット

### URL分離のメリット
1. **明確な責任分離**: 管理機能と公開機能が混在しない
2. **SEO最適化**: メディアURLはSEOに特化できる
3. **パフォーマンス**: 公開サイトは静的生成で高速化
4. **セキュリティ**: 管理機能へのアクセスが隔離される
5. **スケーラビリティ**: メディア側だけCDN配信可能

### データベース共有のメリット
1. **データ整合性**: 単一ソースで管理
2. **リアルタイム反映**: 公開がすぐにメディアに反映
3. **開発効率**: 重複したデータ管理が不要
4. **コスト削減**: 1つのFirestoreで運用

## 注意事項

1. **公開記事のフィルタリング**: メディア側では必ず `status='public'` でフィルタ
2. **URLの混同を避ける**: 管理側とメディア側のURLを明確に区別
3. **Firestore Rules**: 適切なアクセス制御を設定
4. **カノニカルURL**: SEOのため、公開記事のcanonical URLはメディア側に設定
5. **リダイレクト**: 誤って管理側URLが公開された場合のリダイレクト処理

## 今後の実装タスク

- [ ] メディア側のNext.jsアプリケーション作成
- [ ] Firestore Security Rulesの更新
- [ ] URL変換ヘルパー関数の実装
- [ ] メディア側のページコンポーネント作成
- [ ] SEO最適化（メタデータ、OGP、構造化データ）
- [ ] サイトマップ生成
- [ ] RSS/Atomフィード

