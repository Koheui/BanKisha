'use client'

import Link from 'next/link'
import { useAuth } from '@/components/auth/AuthProvider'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  MicIcon,
  FileTextIcon,
  SparklesIcon,
  UsersIcon,
  TrendingUpIcon,
  CheckCircleIcon,
  ArrowRightIcon
} from 'lucide-react'

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  // ログイン済みの場合はダッシュボードにリダイレクト
  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold gradient-text mb-6">
              AIインタビューで
              <br />
              プロの取材記事を作成
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-3xl mx-auto">
              音声・テキストで簡単にインタビュー。AIが自動的にプロフェッショナルな記事を生成します。
              ビジネスメディア向けの次世代インタビュープラットフォーム。
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link href="/signup">
                <Button size="lg" variant="gradient" className="text-lg px-8 py-6">
                  無料で始める
                  <ArrowRightIcon className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                  ログイン
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              BanKishaの特徴
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              AIと専門ナレッジベースを活用した、プロフェッショナルなインタビュー体験
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center mb-4">
                  <MicIcon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-xl">音声インタビュー</CardTitle>
                <CardDescription>
                  音声で自然な会話形式のインタビュー。AIが適切な質問を投げかけ、深掘りします。
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 2 */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center justify-center mb-4">
                  <SparklesIcon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-xl">AI記事生成</CardTitle>
                <CardDescription>
                  インタビュー内容から、自動的にプロフェッショナルな記事を生成します。
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 3 */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg flex items-center justify-center mb-4">
                  <FileTextIcon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-xl">ナレッジベース</CardTitle>
                <CardDescription>
                  スキル・情報・専門知識を統合。AIがコンテキストを理解した質問を生成します。
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 4 */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-r from-orange-600 to-red-600 rounded-lg flex items-center justify-center mb-4">
                  <UsersIcon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-xl">共有URL発行</CardTitle>
                <CardDescription>
                  インタビュー対象者に共有URLを送るだけ。簡単にインタビューを開始できます。
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 5 */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center mb-4">
                  <TrendingUpIcon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-xl">記事管理</CardTitle>
                <CardDescription>
                  作成した記事の編集・承認・公開をワンストップで管理できます。
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Feature 6 */}
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-gradient-to-r from-pink-600 to-rose-600 rounded-lg flex items-center justify-center mb-4">
                  <CheckCircleIcon className="w-6 h-6 text-white" />
                </div>
                <CardTitle className="text-xl">簡単ワークフロー</CardTitle>
                <CardDescription>
                  テスト取材→チューニング→本番取材→記事化。直感的なフローで誰でも使えます。
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <Card className="border-0 shadow-2xl bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
            <CardContent className="p-12">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                今すぐ始めましょう
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                プロフェッショナルなインタビュー記事を、数分で作成できます
              </p>
              <div className="flex items-center justify-center gap-4">
                <Link href="/signup">
                  <Button size="lg" variant="gradient" className="text-lg px-8 py-6">
                    無料アカウント作成
                    <ArrowRightIcon className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}

