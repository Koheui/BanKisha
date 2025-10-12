'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArticleManager } from '@/components/dashboard/ArticleManager'
import { AdminPanel } from '@/components/dashboard/AdminPanel'
import { 
  LoaderIcon, 
  FileTextIcon, 
  PlusCircleIcon,
  SettingsIcon,
  UserIcon
} from 'lucide-react'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState({
    drafts: 0,
    submitted: 0,
    approved: 0,
    public: 0
  })

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <LoaderIcon className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold gradient-text">
                ダッシュボード
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                ようこそ、{user.displayName || user.email}さん
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={user.role === 'admin' ? 'secondary' : 'outline'}>
                {user.role === 'admin' ? '管理者' : '企業ユーザー'}
              </Badge>
              <Button variant="outline" size="sm">
                <SettingsIcon className="w-4 h-4 mr-2" />
                設定
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>下書き</CardDescription>
              <CardTitle className="text-3xl font-bold text-gray-600">
                {stats.drafts}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="draft" className="text-xs">
                編集可能
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>申請中</CardDescription>
              <CardTitle className="text-3xl font-bold text-yellow-600">
                {stats.submitted}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="submitted" className="text-xs">
                承認待ち
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>承認済み</CardDescription>
              <CardTitle className="text-3xl font-bold text-blue-600">
                {stats.approved}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="approved" className="text-xs">
                公開準備中
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardDescription>公開済み</CardDescription>
              <CardTitle className="text-3xl font-bold text-green-600">
                {stats.public}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="public" className="text-xs">
                公開中
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        {user.role === 'company' && (
          <Card className="mb-8 border-0 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlusCircleIcon className="w-6 h-6" />
                クイックアクション
              </CardTitle>
              <CardDescription>
                新しいインタビューを開始するか、既存の記事を管理します
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button variant="gradient" size="lg">
                  <PlusCircleIcon className="w-5 h-5 mr-2" />
                  新規インタビュー
                </Button>
                <Button variant="outline" size="lg">
                  <FileTextIcon className="w-5 h-5 mr-2" />
                  記事を確認
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <div className="space-y-8">
          {user.role === 'admin' ? (
            <AdminPanel onStatsUpdate={setStats} />
          ) : (
            <ArticleManager companyId={user.companyId} onStatsUpdate={setStats} />
          )}
        </div>
      </div>
    </div>
  )
}
