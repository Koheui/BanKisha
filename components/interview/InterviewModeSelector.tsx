'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getFirebaseDb } from '@/src/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MicIcon, LoaderIcon, ArrowRightIcon } from 'lucide-react'
import { InterviewSession } from '@/src/types'

interface InterviewModeSelectorProps {
  sessionId: string
}

export function InterviewModeSelector({ sessionId }: InterviewModeSelectorProps) {
  const router = useRouter()
  const [interview, setInterview] = useState<InterviewSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadInterview()
  }, [sessionId])

  const loadInterview = async () => {
    try {
      setLoading(true)
      // shareTokenでインタビューを検索
      const q = query(
        collection(getFirebaseDb(), 'interviews'),
        where('shareToken', '==', sessionId)
      )
      const snapshot = await getDocs(q)

      if (snapshot.empty) {
        setError('インタビューが見つかりません。URLが正しいか確認してください。')
        return
      }

      const doc = snapshot.docs[0]
      const data = doc.data() as Omit<InterviewSession, 'id' | 'createdAt' | 'updatedAt'> & { createdAt: any, updatedAt: any }
      setInterview({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate(),
      })
    } catch (error) {
      console.error('Error loading interview:', error)
      setError('インタビューの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleStartInterview = () => {
    if (interview) {
      // 音声チャットインタビューページに遷移
      router.push(`/interview/${interview.id}`)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <LoaderIcon className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">インタビューを準備中...</p>
        </CardContent>
      </Card>
    )
  }

  if (error || !interview) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error || 'インタビューが見つかりません'}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            URLが正しいか確認してください。
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">音声チャットインタビュー</CardTitle>
        <CardDescription>インタビューに参加します</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            {interview.title}
          </h3>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>取材先: {interview.intervieweeName} ({interview.intervieweeCompany})</p>
            <p>インタビュアー: {interview.interviewerName} ({interview.interviewerRole})</p>
            {interview.objective && (
              <div>
                <p className="font-semibold mb-1">取材目的:</p>
                <p className="whitespace-pre-wrap">{interview.objective}</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <p className="text-sm text-blue-900 dark:text-blue-300">
            💡 このインタビューは音声形式で行われます。マイクの使用を許可してください。
          </p>
        </div>

        <Button
          onClick={handleStartInterview}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
          size="lg"
        >
          <MicIcon className="w-5 h-5 mr-2" />
          音声チャットインタビューを開始
          <ArrowRightIcon className="w-5 h-5 ml-2" />
        </Button>
      </CardContent>
    </Card>
  )
}

