'use client'

import Link from 'next/link'
import { Newspaper, Search } from 'lucide-react'

export const MediaHeader = () => {
  return (
    <div className="sticky top-0 z-50 bg-white/95 dark:bg-[#101622]/95 backdrop-blur-sm border-b border-[#f0f2f4] dark:border-gray-800">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between h-16">
          {/* Logo & Main Nav */}
          <div className="flex items-center gap-8">
            <Link href="/media" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-primary text-white rounded flex items-center justify-center">
                <Newspaper size={20} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-primary dark:text-white group-hover:opacity-80 transition-opacity">
                BanKisha-Kawaraban
              </h1>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/media"
                className="text-sm font-bold text-text-dark dark:text-text-light hover:text-primary dark:hover:text-primary transition-colors"
              >
                ホーム
              </Link>
              <Link
                href="/media/categories/economy"
                className="text-sm font-medium text-muted-light dark:text-muted-dark hover:text-primary dark:hover:text-primary transition-colors"
              >
                経済
              </Link>
              <Link
                href="/media/categories/technology"
                className="text-sm font-medium text-muted-light dark:text-muted-dark hover:text-primary dark:hover:text-primary transition-colors"
              >
                テクノロジー
              </Link>
              <Link
                href="/media/categories/market"
                className="text-sm font-medium text-muted-light dark:text-muted-dark hover:text-primary dark:hover:text-primary transition-colors"
              >
                マーケット
              </Link>
              <Link
                href="/media/categories/politics"
                className="text-sm font-medium text-muted-light dark:text-muted-dark hover:text-primary dark:hover:text-primary transition-colors"
              >
                政治
              </Link>
              <Link
                href="/media/categories/opinion"
                className="text-sm font-medium text-muted-light dark:text-muted-dark hover:text-primary dark:hover:text-primary transition-colors"
              >
                オピニオン
              </Link>
            </nav>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-4">
            <button className="text-muted-light dark:text-muted-dark hover:text-primary dark:hover:text-primary transition-colors">
              <Search size={24} />
            </button>
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block"></div>
            <div className="flex items-center gap-3 hidden sm:flex">
              <Link href="/login" className="text-sm font-bold text-muted-light dark:text-muted-dark hover:text-text-dark dark:hover:text-text-light transition-colors">
                ログイン
              </Link>
              <Link href="/signup" className="bg-primary hover:bg-primary/90 text-white text-sm font-bold py-2 px-4 rounded-lg transition-colors shadow-sm">
                購読する
              </Link>
            </div>
          </div>
        </header>
      </div>
    </div>
  )
}