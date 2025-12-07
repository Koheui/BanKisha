'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { InterviewWizard } from './InterviewWizard'
import { VoiceChat } from './VoiceChat'
import { getSession } from '@/src/lib/firestore'
import type { Session } from '@/src/types'
import {
  MessageSquareIcon,
  FileTextIcon,
  MicIcon,
  SparklesIcon,
  LoaderIcon,
  AlertCircleIcon,
  CheckCircleIcon
} from 'lucide-react'

interface InterviewModeSelectorProps {
  sessionId: string
}

type InterviewMode = 'select' | 'wizard' | 'voicechat'

export function InterviewModeSelector({ sessionId }: InterviewModeSelectorProps) {
  const [mode, setMode] = useState<InterviewMode>('select')
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSession()
  }, [sessionId])

  const loadSession = async () => {
    try {
      setLoading(true)
      const sessionData = await getSession(sessionId)
      
      if (!sessionData) {
        setError('セッションが見つかりません')
        return
      }
      
      if (sessionData.status === 'completed') {
        setError('このセッションは既に完了しています')
        return
      }
      
      if (new Date() > sessionData.expiresAt) {
        setError('このセッションは有効期限切れです')
        return
      }
      
      setSession(sessionData)
      setError(null)
    } catch (err) {
      console.error('Error loading session:', err)
      setError('セッションの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async (data: any) => {
    // Handle completion - convert to article format
    // This will be called from both modes
    console.log('Interview completed:', data)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-900 dark:to-pink-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-red-600 dark:text-red-400">エラー</CardTitle>
            <CardDescription>{error}</CardDescription>
          </div>
        </CardHeader>
      </Card>
    )
  }

  if (mode === 'wizard') {
    return <InterviewWizard sessionId={sessionId} />
  }

  if (mode === 'voicechat' && session) {
    return (
      <VoiceChat
        sessionId={sessionId}
        companyId={session.companyId}
        onComplete={handleComplete}
      />
    )
  }

  // Mode selection
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <SparklesIcon className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-bold gradient-text">
            インタビューモードを選択
          </CardTitle>
          <CardDescription className="text-lg">
            どちらの方法でインタビューを行いますか？
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Mode Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Voice Chat Mode */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer group" onClick={() => setMode('voicechat')}>
          <CardHeader>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageSquareIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">AI音声チャット</CardTitle>
                <Badge variant="secondary" className="mt-1">推奨</Badge>
              </div>
            </div>
            <CardDescription>
              AI番記者と自然な会話形式でインタビューを行います
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                リアルタイム音声認識
              </li>
              <li className="flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                AIが質問を自動生成
              </li>
              <li className="flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                より自然な会話体験
              </li>
              <li className="flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                会話から自動で記事生成
              </li>
            </ul>
            <Button
              variant="gradient"
              className="w-full mt-6"
              onClick={() => setMode('voicechat')}
            >
              <MessageSquareIcon className="w-5 h-5 mr-2" />
              音声チャットで開始
            </Button>
          </CardContent>
        </Card>

        {/* Wizard Mode */}
        <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow cursor-pointer group" onClick={() => setMode('wizard')}>
          <CardHeader>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileTextIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">質問形式</CardTitle>
                <Badge variant="outline" className="mt-1">従来型</Badge>
              </div>
            </div>
            <CardDescription>
              事前に用意された質問に順番に回答します
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                質問ごとに回答
              </li>
              <li className="flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                音声またはテキスト入力
              </li>
              <li className="flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                進捗を確認しながら回答
              </li>
              <li className="flex items-center gap-2">
                <CheckCircleIcon className="w-4 h-4 text-green-600" />
                確実にすべての質問に回答
              </li>
            </ul>
            <Button
              variant="outline"
              className="w-full mt-6"
              onClick={() => setMode('wizard')}
            >
              <FileTextIcon className="w-5 h-5 mr-2" />
              質問形式で開始
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Info */}
      <Card className="border-0 shadow-md bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <SparklesIcon className="w-6 h-6 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                どちらを選べばいいですか？
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                <strong>AI音声チャット</strong>は、より自然で会話的なインタビュー体験を提供します。
                AIが会話の流れに応じて質問を生成するため、より深い情報を得られます。
                <br /><br />
                <strong>質問形式</strong>は、事前に用意された質問に確実に回答したい場合に適しています。
                すべての質問に漏れなく回答できます。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
