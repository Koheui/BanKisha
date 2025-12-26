import { ReactNode } from 'react'
import Link from 'next/link'

export default function MediaLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/media" className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                BanKisha-Kawaraban
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                番記者瓦版
              </span>
            </Link>
            <nav className="flex items-center space-x-6">
              <Link
                href="/media/articles"
                className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                記事一覧
              </Link>
              <Link
                href="/media/companies"
                className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                企業一覧
              </Link>
              <Link
                href="/media/search"
                className="text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                検索
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center text-gray-600 dark:text-gray-400">
            <p className="text-sm">
              © {new Date().getFullYear()} BanKisha-Kawaraban（番記者瓦版）. All rights reserved.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              Powered by{' '}
              <Link 
                href="/" 
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium"
                target="_blank"
                rel="noopener noreferrer"
              >
                BanKisha
              </Link>
              {' '}（AIインタビュアーアプリ）
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              このメディアサイトの記事は、BanKishaで作成されたインタビュー記事です
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

