'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircleIcon, 
  SparklesIcon, 
  FileTextIcon,
  ArrowRightIcon,
  LoaderIcon
} from 'lucide-react'

export default function InterviewCompletePage() {
  const searchParams = useSearchParams()
  const articleId = searchParams.get('articleId')
  const [generating, setGenerating] = useState(true)

  useEffect(() => {
    // Simulate article generation time
    const timer = setTimeout(() => {
      setGenerating(false)
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900">
      <div className="max-w-2xl w-full space-y-8">
        {generating ? (
          // Generating State
          <Card className="border-0 shadow-2xl">
            <CardHeader className="text-center pb-4">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                <SparklesIcon className="w-10 h-10 text-white animate-pulse" />
                <div className="absolute inset-0 rounded-full border-4 border-blue-500 animate-pulse-ring" />
              </div>
              <CardTitle className="text-3xl font-bold gradient-text mb-4">
                記事を生成中...
              </CardTitle>
              <CardDescription className="text-lg">
                AIがあなたの回答を分析して、プロの取材記事を作成しています
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Progress Steps */}
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <LoaderIcon className="w-5 h-5 text-white animate-spin" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100">音声を文字起こし中</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Whisper AIが音声を解析しています</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg opacity-60">
                  <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center">
                    <FileTextIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100">取材記事を生成中</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">GPT-4が記事を執筆しています</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg opacity-60">
                  <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center">
                    <SparklesIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100">SNS投稿文を作成中</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">X・LinkedIn用の要約を生成しています</p>
                  </div>
                </div>
              </div>

              <div className="text-center pt-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  この処理には数分かかる場合があります...
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Complete State
          <Card className="border-0 shadow-2xl">
            <CardHeader className="text-center pb-4">
              <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircleIcon className="w-12 h-12 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold gradient-text mb-4">
                インタビュー完了！
              </CardTitle>
              <CardDescription className="text-lg">
                ご協力ありがとうございました。記事のドラフトが作成されました。
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Success Message */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 p-6 rounded-lg space-y-4">
                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                  次のステップ
                </h3>
                <ul className="space-y-3 text-gray-700 dark:text-gray-300">
                  <li className="flex items-start gap-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>記事のドラフトを確認・編集できます</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>編集部に承認申請を送信できます</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>承認後、記事が公開されます</span>
                  </li>
                </ul>
              </div>

              {/* Article Info */}
              {articleId && (
                <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">記事ID</p>
                    <p className="font-mono text-sm font-medium text-gray-900 dark:text-gray-100">
                      {articleId}
                    </p>
                  </div>
                  <Badge variant="draft">下書き</Badge>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <Link href={`/dashboard`}>
                  <Button variant="gradient" size="lg" className="w-full">
                    ダッシュボードで記事を確認
                    <ArrowRightIcon className="w-5 h-5 ml-2" />
                  </Button>
                </Link>

                <Link href="/articles">
                  <Button variant="outline" size="lg" className="w-full">
                    公開記事を見る
                  </Button>
                </Link>
              </div>

              {/* Additional Info */}
              <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  ご不明な点がございましたら、<Link href="/contact" className="text-blue-600 hover:text-blue-700 dark:text-blue-400">お問い合わせ</Link>ください
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
