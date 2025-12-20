'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/components/auth/AuthProvider'
import { Badge } from '@/components/ui/badge'
import { 
  MenuIcon, 
  UserIcon, 
  LogOutIcon,
  FileTextIcon,
  SettingsIcon
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/src/lib/utils'

export function Header() {
  const { user, loading, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    setMobileMenuOpen(false)
  }

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <FileTextIcon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">BanKisha</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="/articles" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors">
              記事一覧
            </Link>
            
            {user && (
              <>
                <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors">
                  ダッシュボード
                </Link>
                
                {user?.role === 'superAdmin' && (
                  <Badge className="text-xs bg-red-600 text-white hover:bg-red-700 border-red-600">
                    Super Admin
                  </Badge>
                )}
                
                {user?.role === 'admin' && (
                  <Badge variant="secondary" className="text-xs">
                    管理者
                  </Badge>
                )}
              </>
            )}
          </nav>

          {/* Desktop User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {loading ? (
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
            ) : user ? (
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {user?.displayName || user?.email || 'ユーザー'}
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleLogout}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <LogOutIcon className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link href="/login">
                  <Button variant="ghost">
                    ログイン
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button variant="gradient">
                    新規登録
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-md text-gray-500 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <MenuIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 dark:border-gray-800 py-4">
            <div className="flex flex-col space-y-4">
              <Link 
                href="/articles" 
                className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                記事一覧
              </Link>
              
              {user && (
                <>
                  <Link 
                    href="/dashboard" 
                    className="text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    ダッシュボード
                  </Link>
                  
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                        <UserIcon className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {user?.displayName || user?.email || 'ユーザー'}
                      </span>
                      {user?.role === 'superAdmin' && (
                        <Badge className="text-xs ml-2 bg-red-600 text-white hover:bg-red-700 border-red-600">
                          Super Admin
                        </Badge>
                      )}
                      {user?.role === 'admin' && (
                        <Badge variant="secondary" className="text-xs ml-2">
                          管理者
                        </Badge>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleLogout}
                    >
                      <LogOutIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
              
              {!user && !loading && (
                <div className="flex flex-col space-y-2">
                  <Link href="/login">
                    <Button variant="outline" className="w-full">
                      ログイン
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button variant="gradient" className="w-full">
                      新規登録
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
