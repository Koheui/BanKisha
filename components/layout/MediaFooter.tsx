import Link from 'next/link'
import { Newspaper, Languages } from 'lucide-react'

const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...props}>
    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
  </svg>
)

const InstagramIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...props}>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.072 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
)

const LinkedInIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" {...props}>
    <path d="M4.98 3.5c0 1.381-1.11 2.5-2.48 2.5s-2.48-1.119-2.48-2.5c0-1.38 1.11-2.5 2.48-2.5s2.48 1.12 2.48 2.5zm.02 4.5h-5v16h5v-16zm7.982 0h-4.968v16h5v-8.321c0-4.605 5.438-4.3 5.438 0v8.321h5v-9.388c0-7.711-8.47-7.461-10.47-3.931v-1.002z" />
  </svg>
)

export const MediaFooter = () => {
  return (
    <footer className="bg-white dark:bg-[#101622] border-t border-gray-200 dark:border-gray-800 pt-16 pb-8">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand Col */}
          <div className="lg:col-span-2">
            <Link href="/media" className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-primary text-white rounded flex items-center justify-center">
                <Newspaper size={20} />
              </div>
              <h2 className="text-2xl font-bold text-primary dark:text-white">
                BanKisha-Kawaraban
              </h2>
            </Link>
            <p className="text-muted-light dark:text-muted-dark text-sm mb-6 max-w-sm font-sans">
              BanKisha-Kawarabanは、ビジネスリーダーのための信頼できる情報源です。最新の経済ニュース、市場分析、テクノロジートレンドを公平な視点でお届けします。
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
                <TwitterIcon className="w-5 h-5 fill-current" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
                <InstagramIcon className="w-5 h-5 fill-current" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
                <LinkedInIcon className="w-5 h-5 fill-current" />
              </a>
            </div>
          </div>

          {/* Link Col 1 */}
          <div>
            <h4 className="font-bold text-lg mb-4">ニュース</h4>
            <ul className="space-y-3 font-sans text-sm">
              <li><Link href="/media/categories/economy" className="text-muted-light dark:text-muted-dark hover:text-primary transition-colors">経済</Link></li>
              <li><Link href="/media/categories/market" className="text-muted-light dark:text-muted-dark hover:text-primary transition-colors">マーケット</Link></li>
              <li><Link href="/media/categories/technology" className="text-muted-light dark:text-muted-dark hover:text-primary transition-colors">テクノロジー</Link></li>
              <li><Link href="/media/categories/politics" className="text-muted-light dark:text-muted-dark hover:text-primary transition-colors">政治</Link></li>
              <li><Link href="/media/categories/international" className="text-muted-light dark:text-muted-dark hover:text-primary transition-colors">国際</Link></li>
            </ul>
          </div>

          {/* Link Col 2 */}
          <div>
            <h4 className="font-bold text-lg mb-4">分析・コラム</h4>
            <ul className="space-y-3 font-sans text-sm">
              <li><Link href="/media/categories/opinion" className="text-muted-light dark:text-muted-dark hover:text-primary transition-colors">オピニオン</Link></li>
              <li><Link href="/media/articles" className="text-muted-light dark:text-muted-dark hover:text-primary transition-colors">特集記事</Link></li>
              <li><Link href="/interviews" className="text-muted-light dark:text-muted-dark hover:text-primary transition-colors">インタビュー</Link></li>
            </ul>
          </div>

          {/* Link Col 3 */}
          <div>
            <h4 className="font-bold text-lg mb-4">サポート</h4>
            <ul className="space-y-3 font-sans text-sm">
              <li><Link href="/about" className="text-muted-light dark:text-muted-dark hover:text-primary transition-colors">会社概要</Link></li>
              <li><Link href="/contact" className="text-muted-light dark:text-muted-dark hover:text-primary transition-colors">お問い合わせ</Link></li>
              <li><Link href="/privacy" className="text-muted-light dark:text-muted-dark hover:text-primary transition-colors">プライバシーポリシー</Link></li>
              <li><Link href="/terms" className="text-muted-light dark:text-muted-dark hover:text-primary transition-colors">利用規約</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-100 dark:border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-light dark:text-muted-dark font-sans">
            &copy; {new Date().getFullYear()} BanKisha-Kawaraban. All rights reserved.
          </p>
          <div className="flex gap-4">
            <button className="text-xs font-bold text-muted-light dark:text-muted-dark hover:text-primary flex items-center gap-1">
              <Languages size={14} /> 日本語
            </button>
          </div>
        </div>
      </div>
    </footer>
  )
}
