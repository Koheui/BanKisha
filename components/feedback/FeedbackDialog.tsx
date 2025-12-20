'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { XIcon, AlertCircleIcon, MessageSquareIcon } from 'lucide-react'
import type { FeedbackType } from '@/src/types/feedback'

interface FeedbackDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (type: FeedbackType, message: string) => Promise<void>
  context?: {
    question?: string
    answer?: string
    articleSection?: string
  }
  source: 'interview' | 'rehearsal' | 'article' | 'question_generation'
}

const feedbackTypes: Array<{ value: FeedbackType, label: string, description: string }> = [
  {
    value: 'duplicate_question',
    label: '重複質問',
    description: 'その質問は先ほども答えました'
  },
  {
    value: 'incorrect_name',
    label: '名称が違う',
    description: '名称や用語が正しくありません'
  },
  {
    value: 'unclear_question',
    label: '質問がわかりにくい',
    description: '質問の意図が理解できません'
  },
  {
    value: 'unclear_context',
    label: '文脈がわかりにくい',
    description: '会話の流れや文脈が理解できません'
  },
  {
    value: 'other',
    label: 'その他',
    description: 'その他のフィードバック'
  }
]

export function FeedbackDialog({ isOpen, onClose, onSubmit, context, source }: FeedbackDialogProps) {
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!selectedType || !message.trim()) {
      alert('フィードバックの種類と内容を入力してください')
      return
    }

    try {
      setSubmitting(true)
      await onSubmit(selectedType, message.trim())
      setSelectedType(null)
      setMessage('')
      onClose()
      alert('✅ フィードバックを送信しました。ありがとうございます！')
    } catch (error) {
      console.error('Error submitting feedback:', error)
      alert('❌ フィードバックの送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertCircleIcon className="w-5 h-5 text-orange-600" />
              フィードバック・クレーム
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <XIcon className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Context Info */}
          {context && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-2">
              {context.question && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    関連する質問:
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {context.question}
                  </p>
                </div>
              )}
              {context.answer && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    関連する回答:
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {context.answer.substring(0, 200)}{context.answer.length > 200 ? '...' : ''}
                  </p>
                </div>
              )}
              {context.articleSection && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    関連する記事セクション:
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {context.articleSection.substring(0, 200)}{context.articleSection.length > 200 ? '...' : ''}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Feedback Type Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              フィードバックの種類
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {feedbackTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSelectedType(type.value)}
                  className={`p-3 rounded-lg border-2 text-left transition-colors ${
                    selectedType === type.value
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                    {type.label}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    {type.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Message Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              詳細な内容
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="具体的な内容を入力してください..."
              rows={5}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !selectedType || !message.trim()}
              className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white"
            >
              {submitting ? '送信中...' : 'フィードバックを送信'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


