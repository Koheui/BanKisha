'use client'

import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* About */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              BanKishaについて
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              企業へのインタビューが簡単にできるウェブアプリ。
              音声インタビュー型のPRメディアを実現します。
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              リンク
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/articles" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                  記事一覧
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors">
                  ダッシュボード
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              お問い合わせ
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              ご質問やご要望がございましたら、お気軽にお問い合わせください。
            </p>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            © {new Date().getFullYear()} BanKisha. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}


