import { HeroSection } from '@/components/media/HeroSection'
import { LatestArticlesSection } from '@/components/media/LatestArticlesSection'
import { CategorySection } from '@/components/media/CategorySection'
import Link from 'next/link'
import { BuildingIcon } from 'lucide-react'

export const metadata = {
  title: 'BanKisha-Kawaraban（番記者瓦版）| ビジネスインタビュー記事メディア',
  description: 'BanKisha-Kawaraban（番記者瓦版）は、AIインタビュアー「BanKisha」で作成されたビジネスリーダーや起業家へのインタビュー記事を掲載するメディアサイトです。',
  openGraph: {
    title: 'BanKisha-Kawaraban（番記者瓦版）',
    description: 'AIインタビュアー「BanKisha」で作成されたビジネスインタビュー記事を掲載',
    type: 'website',
  },
}

export default function MediaPage() {
  // 主要カテゴリ（実際のデータから動的に取得することも可能）
  const mainCategories = ['ビジネス', 'テクノロジー', 'スタートアップ']

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Hero Section */}
      <HeroSection />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* About Section */}
        <section className="mb-12 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            BanKisha-Kawaraban（番記者瓦版）について
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
            BanKisha-Kawaraban（番記者瓦版）は、AIインタビュアー「BanKisha」で作成されたビジネスインタビュー記事を掲載するメディアサイトです。
            <br />
            企業様が自社のストーリーを語り、それを記事として公開することで、PRtimesのようにプレスリリースを掲載したり、
            インタビュー形式で自社を紹介することができます。
          </p>
        </section>

        {/* Latest Articles */}
        <LatestArticlesSection />

        {/* Category Sections */}
        {mainCategories.map((category) => (
          <CategorySection key={category} category={category} limit={3} />
        ))}

        {/* Companies Link */}
        <section className="py-12 border-t border-gray-200 dark:border-gray-700 mt-12">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              企業一覧
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              インタビューにご協力いただいた企業様の一覧です。
            </p>
            <Link
              href="/media/companies"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <BuildingIcon className="w-5 h-5" />
              企業一覧を見る
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
