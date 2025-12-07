'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useVoiceChat } from '@/src/hooks/useVoiceChat'
import { createArticle } from '@/src/lib/firestore'
import { formatDuration } from '@/src/lib/utils'
import {
  MicIcon,
  MicOffIcon,
  Volume2Icon,
  MessageSquareIcon,
  SendIcon,
  LoaderIcon,
  CheckCircleIcon,
  AlertCircleIcon
} from 'lucide-react'

interface VoiceChatProps {
  sessionId: string
  companyId: string
  onComplete: (messages: Array<{ role: string; content: string }>) => void
}

export function VoiceChat({ sessionId, companyId, onComplete }: VoiceChatProps) {
  const router = useRouter()
  const [textInput, setTextInput] = useState('')
  const [conversationStarted, setConversationStarted] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const {
    messages,
    isListening,
    isSpeaking,
    isProcessing,
    error,
    startConversation,
    stopConversation,
    sendMessage,
    clearMessages
  } = useVoiceChat({
    onConversationComplete: async (msgs) => {
      await handleConversationComplete(msgs)
    }
  })

  const handleConversationComplete = async (msgs: any[]) => {
    try {
      setIsGenerating(true)
      
      // Convert conversation messages to Q&A format
      const qa = []
      for (let i = 0; i < msgs.length; i += 2) {
        if (msgs[i]?.role === 'assistant' && msgs[i + 1]?.role === 'user') {
          qa.push({
            q: msgs[i].content,
            textAnswer: msgs[i + 1].content
          })
        }
      }

      // Generate article from conversation
      const response = await fetch('/api/generate-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qa,
          companyName: '企業名' // TODO: Get from company data
        }),
      })

      if (!response.ok) {
        throw new Error('記事の生成に失敗しました')
      }

      const data = await response.json()

      // Create article in Firestore
      const articleId = await createArticle({
        companyId,
        status: 'draft',
        questionSetId: 'voice-chat', // Special ID for voice chat
        qa: qa.map(item => ({
          q: item.q,
          textAnswer: item.textAnswer
        })),
        draftArticle: data.article,
        snsDraft: data.sns,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      // Redirect to completion page
      router.push(`/interview/complete?articleId=${articleId}`)
    } catch (err) {
      console.error('Error completing conversation:', err)
      // Still call onComplete for fallback
      onComplete(msgs.map(m => ({ role: m.role, content: m.content })))
    } finally {
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleStart = async () => {
    setConversationStarted(true)
    await startConversation()
  }

  const handleStop = () => {
    stopConversation()
    setConversationStarted(false)
  }

  const handleSendText = async () => {
    if (!textInput.trim()) return
    await sendMessage(textInput)
    setTextInput('')
  }

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <MessageSquareIcon className="w-6 h-6" />
              AI音声チャットインタビュー
            </CardTitle>
            {conversationStarted && (
              <Badge variant={isListening ? 'success' : 'secondary'}>
                {isListening ? '聞いています' : isSpeaking ? '話しています' : '待機中'}
              </Badge>
            )}
          </div>
          <CardDescription>
            AI番記者と自然な会話形式でインタビューを行います。音声またはテキストで回答できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!conversationStarted ? (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto">
                <MicIcon className="w-10 h-10 text-white" />
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                準備ができたら、下のボタンでインタビューを開始してください
              </p>
              <Button
                onClick={handleStart}
                variant="gradient"
                size="lg"
                className="w-full max-w-xs"
              >
                <MicIcon className="w-5 h-5 mr-2" />
                インタビューを開始
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Control Buttons */}
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={handleStop}
                  variant="destructive"
                  size="lg"
                >
                  <MicOffIcon className="w-5 h-5 mr-2" />
                  会話を終了
                </Button>
              </div>

              {/* Status Indicators */}
              <div className="flex items-center justify-center gap-4">
                {isListening && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">音声を認識中...</span>
                  </div>
                )}
                {isSpeaking && (
                  <div className="flex items-center gap-2">
                    <Volume2Icon className="w-4 h-4 text-blue-600 animate-pulse" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">AIが話しています...</span>
                  </div>
                )}
                {isProcessing && (
                  <div className="flex items-center gap-2">
                    <LoaderIcon className="w-4 h-4 animate-spin text-blue-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">処理中...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generating Article */}
      {isGenerating && (
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 relative">
              <LoaderIcon className="w-8 h-8 text-white animate-spin" />
              <div className="absolute inset-0 rounded-full border-4 border-blue-500 animate-pulse-ring" />
            </div>
            <h3 className="text-xl font-bold gradient-text mb-2">記事を生成中...</h3>
            <p className="text-gray-600 dark:text-gray-400">
              会話内容から取材記事を作成しています。しばらくお待ちください。
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
              <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Messages */}
      {conversationStarted && (
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">会話履歴</CardTitle>
            <CardDescription>
              {messages.length} 件のメッセージ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-4 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {message.role === 'assistant' && (
                        <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <MessageSquareIcon className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1">
                          {message.role === 'user' ? 'あなた' : 'AI番記者'}
                        </p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>
                        <p className="text-xs opacity-70 mt-2">
                          {message.timestamp.toLocaleTimeString('ja-JP', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      {message.role === 'user' && (
                        <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <MicIcon className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Text Input Fallback */}
      {conversationStarted && (
        <Card className="border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendText()
                  }
                }}
                placeholder="音声が使えない場合は、こちらにテキストで入力..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isProcessing}
              />
              <Button
                onClick={handleSendText}
                variant="gradient"
                disabled={!textInput.trim() || isProcessing}
              >
                <SendIcon className="w-5 h-5" />
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              💡 音声認識が使えない場合や、より正確に入力したい場合はテキスト入力も利用できます
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
