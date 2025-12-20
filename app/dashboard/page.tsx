'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  BookOpenIcon,
  CompassIcon,
  FileTextIcon,
  MicIcon,
  SettingsIcon,
  UsersIcon,
  DatabaseIcon,
  InfoIcon,
  UserIcon,
  TrashIcon
} from 'lucide-react'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            ダッシュボード
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {user?.displayName || user?.email || 'ユーザー'} としてログイン中
          </p>
        </div>

        {/* Super Admin Section */}
        {user?.role === 'superAdmin' && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
              <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">
                🔴 Super Admin専用機能
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* App Direction */}
              <Link href="/admin/app-direction">
                <Card className="border-2 border-red-200 dark:border-red-800 shadow-md hover:shadow-lg hover:border-red-300 dark:hover:border-red-700 transition-all cursor-pointer h-full bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950 dark:to-orange-950">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-orange-600 rounded-lg flex items-center justify-center shadow-lg">
                        <CompassIcon className="w-6 h-6 text-white" />
                      </div>
                      <CardTitle className="text-lg">アプリの方向性</CardTitle>
                    </div>
                    <CardDescription>
                      インタビューアプリ全体の基本方針とプロンプトを設定
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              {/* Skill Knowledge Base */}
              <Link href="/admin/skill-kb">
                <Card className="border-2 border-red-200 dark:border-red-800 shadow-md hover:shadow-lg hover:border-red-300 dark:hover:border-red-700 transition-all cursor-pointer h-full bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950 dark:to-pink-950">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-pink-600 rounded-lg flex items-center justify-center shadow-lg">
                        <BookOpenIcon className="w-6 h-6 text-white" />
                      </div>
                      <CardTitle className="text-lg">ナレッジベース</CardTitle>
                    </div>
                    <CardDescription>
                      インタビュー技術・編集術などのスキルKBを管理
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              {/* Info Knowledge Base */}
              <Link href="/admin/info-kb">
                <Card className="border-2 border-red-200 dark:border-red-800 shadow-md hover:shadow-lg hover:border-red-300 dark:hover:border-red-700 transition-all cursor-pointer h-full bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-rose-600 rounded-lg flex items-center justify-center shadow-lg">
                        <InfoIcon className="w-6 h-6 text-white" />
                      </div>
                      <CardTitle className="text-lg">情報ナレッジベース</CardTitle>
                    </div>
                    <CardDescription>
                      業界知識・専門情報などの情報KBを管理
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              {/* Trash */}
              <Link href="/admin/trash">
                <Card className="border-2 border-red-200 dark:border-red-800 shadow-md hover:shadow-lg hover:border-red-300 dark:hover:border-red-700 transition-all cursor-pointer h-full bg-gradient-to-br from-gray-50 to-red-50 dark:from-gray-950 dark:to-red-950">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 bg-gradient-to-r from-gray-600 to-red-600 rounded-lg flex items-center justify-center shadow-lg">
                        <TrashIcon className="w-6 h-6 text-white" />
                      </div>
                      <CardTitle className="text-lg">ゴミ箱</CardTitle>
                    </div>
                    <CardDescription>
                      削除されたナレッジベースを復元・完全削除
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </div>
          </div>
        )}

        {/* User Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              ユーザー機能
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* User Knowledge Base */}
            <Link href="/dashboard/user-kb">
              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-gradient-to-r from-orange-600 to-red-600 rounded-lg flex items-center justify-center">
                      <DatabaseIcon className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">ユーザーナレッジベース</CardTitle>
                  </div>
                  <CardDescription>
                    自分専用のナレッジベース
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            {/* Interviewer Profile */}
            <Link href="/dashboard/interviewer">
              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                      <UserIcon className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">インタビュアー設定</CardTitle>
                  </div>
                  <CardDescription>
                    AIインタビュアーの人格・口調・プロンプトを設定
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            {/* Interviews List */}
            <Link href="/dashboard/interviews">
              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center">
                      <MicIcon className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">インタビュー一覧</CardTitle>
                  </div>
                  <CardDescription>
                    保存されたインタビューを確認・管理
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            {/* Create Interview */}
            <Link href="/dashboard/interviews/new">
              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-gradient-to-r from-pink-600 to-rose-600 rounded-lg flex items-center justify-center">
                      <MicIcon className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">新規インタビュー作成</CardTitle>
                  </div>
                  <CardDescription>
                    取材企画を作成してテスト取材を開始
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            {/* Articles */}
            <Link href="/dashboard/articles">
              <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 bg-gradient-to-r from-teal-600 to-cyan-600 rounded-lg flex items-center justify-center">
                      <FileTextIcon className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">記事管理</CardTitle>
                  </div>
                  <CardDescription>
                    作成した記事の確認・編集・公開
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>
        </div>

        {/* Admin Section */}
        {(user?.role === 'admin' || user?.role === 'superAdmin') && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 bg-red-600 rounded-full"></div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                管理者機能
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Admin Panel */}
              <Link href="/admin/articles">
                <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 bg-gradient-to-r from-red-600 to-orange-600 rounded-lg flex items-center justify-center">
                        <SettingsIcon className="w-6 h-6 text-white" />
                      </div>
                      <CardTitle className="text-lg">記事承認・管理</CardTitle>
                    </div>
                    <CardDescription>
                      すべての記事を承認・公開・管理
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              {/* User Management */}
              <Link href="/admin/users">
                <Card className="border-0 shadow-md hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-12 h-12 bg-gradient-to-r from-yellow-600 to-orange-600 rounded-lg flex items-center justify-center">
                        <UsersIcon className="w-6 h-6 text-white" />
                      </div>
                      <CardTitle className="text-lg">ユーザー管理</CardTitle>
                    </div>
                    <CardDescription>
                      ユーザーの権限・設定を管理
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

