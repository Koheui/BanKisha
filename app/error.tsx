'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircleIcon } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-2 mb-2">
            <AlertCircleIcon className="w-6 h-6 text-red-600" />
            <CardTitle>エラーが発生しました</CardTitle>
          </div>
          <CardDescription>
            アプリケーションでエラーが発生しました。詳細はコンソールを確認してください。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-sm text-red-800 dark:text-red-200 font-mono break-all">
              {error.message || '不明なエラー'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={reset} variant="default">
              再試行
            </Button>
            <Button onClick={() => window.location.href = '/'} variant="outline">
              ホームに戻る
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


