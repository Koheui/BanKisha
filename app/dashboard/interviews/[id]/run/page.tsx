'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { LoaderIcon } from 'lucide-react'

function RunInterviewContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const interviewId = params.id as string
  const mode = searchParams.get('mode') // 'rehearsal' or 'live'

  useEffect(() => {
    if (!mode) {
      // モードが指定されていない場合は選択ページに戻る
      router.push(`/dashboard/interviews/${interviewId}`)
      return
    }

    if (mode === 'rehearsal') {
      // リハーサルモード: 既存のリハーサルページにリダイレクト
      router.replace(`/dashboard/interviews/${interviewId}/rehearsal`)
    } else if (mode === 'live') {
      // 本番モード: 既存の本番ページにリダイレクト
      router.replace(`/interview/${interviewId}`)
    } else {
      // 無効なモードの場合は選択ページに戻る
      router.push(`/dashboard/interviews/${interviewId}`)
    }
  }, [mode, interviewId, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <LoaderIcon className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
      </div>
    </div>
  )
}

export default function RunInterviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoaderIcon className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    }>
      <RunInterviewContent />
    </Suspense>
  )
}




