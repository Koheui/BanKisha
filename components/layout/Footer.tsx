import Link from 'next/link'
import { FileTextIcon } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-md flex items-center justify-center">
              <FileTextIcon className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold gradient-text">BanKisha</span>
          </div>
          
          <div className="flex items-center space-x-6 text-sm text-gray-600 dark:text-gray-400">
            <Link href="/articles" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              記事一覧
            </Link>
            <Link href="/privacy" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              プライバシーポリシー
            </Link>
            <Link href="/terms" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              利用規約
            </Link>
            <Link href="/contact" className="hover:text-gray-900 dark:hover:text-white transition-colors">
              お問い合わせ
            </Link>
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-2 md:space-y-0">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              © 2024 BanKisha. All rights reserved.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              企業インタビュープラットフォーム
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
