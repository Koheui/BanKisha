import { getArticles } from '@/src/lib/firestore'
import { HeroSection } from '@/components/media/HeroSection'
import { SubHeroGrid } from '@/components/media/SubHeroGrid'
import { LatestNews } from '@/components/media/LatestNews'
import { MarketSummary } from '@/components/media/MarketSummary'
import { OpinionSection } from '@/components/media/OpinionSection'

export const metadata = {
  title: 'BanKisha-Kawaraban（番記者瓦版）| ビジネスインタビュー記事メディア',
  description: 'BanKisha-Kawaraban（番記者瓦版）は、AIインタビュアー「BanKisha」で作成されたビジネスリーダーや起業家へのインタビュー記事を掲載するメディアサイトです。',
}

export const dynamic = 'force-dynamic'

export default async function MediaPage() {
  // Fetch all articles in parallel
  const [
    allPublicArticles,
    opinionArticles
  ] = await Promise.all([
    getArticles({ status: 'public', limit: 10 }),
    getArticles({ status: 'public', category: 'オピニオン', limit: 4 })
  ]);

  const heroArticle = allPublicArticles.find(a => a.featured) || allPublicArticles[0];
  const subHeroArticles = allPublicArticles.filter(a => a.id !== heroArticle?.id).slice(0, 2);
  const latestNews = allPublicArticles.slice(0, 5);

  return (
    <main className="flex-grow max-w-[1280px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Section: Hero + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
        {/* Main Content (Left 8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {heroArticle && <HeroSection article={heroArticle} />}
          <SubHeroGrid articles={subHeroArticles} />
        </div>

        {/* Sidebar (Right 4 cols) */}
        <aside className="lg:col-span-4 flex flex-col gap-8">
          <LatestNews articles={latestNews} />
          <MarketSummary />
          {/* Ad Placeholder */}
          <div className="w-full aspect-[4/3] bg-gray-100 dark:bg-[#151b2d] flex items-center justify-center rounded-lg border border-dashed border-gray-300 dark:border-gray-700 text-xs text-muted-light">
            広告スペース
          </div>
        </aside>
      </div>

      {/* Opinion Section */}
      <OpinionSection articles={opinionArticles} />

      {/* TODO: Add Industry Trends Section */}
    </main>
  )
}
