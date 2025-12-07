'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AudioRecorder } from './AudioRecorder'
import { getSession, getQuestionSet, getCompany, createArticle, uploadAudioFile } from '@/src/lib/firestore'
import type { Session, QuestionSet, QARecord } from '@/src/types'
import { 
  AlertCircleIcon, 
  CheckCircleIcon, 
  MicIcon, 
  TextIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  SendIcon
} from 'lucide-react'

interface InterviewWizardProps {
  sessionId: string
}

export function InterviewWizard({ sessionId }: InterviewWizardProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [questionSet, setQuestionSet] = useState<QuestionSet | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<QARecord[]>([])
  const [textAnswer, setTextAnswer] = useState('')
  const [answerMode, setAnswerMode] = useState<'audio' | 'text'>('audio')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const router = useRouter()

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
      
      // Load question set
      const questions = await getQuestionSet(sessionData.questionSetId)
      if (!questions) {
        setError('質問セットが見つかりません')
        return
      }
      
      setQuestionSet(questions)
      
      // Initialize answers array
      setAnswers(questions.questions.map(q => ({ q: q.text })))
      
      setError(null)
    } catch (err) {
      console.error('Error loading session:', err)
      setError('セッションの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleAudioRecorded = async (audioBlob: Blob, duration: number) => {
    try {
      // Upload audio file
      const audioPath = `companies/${session?.companyId}/interviews/${sessionId}/${currentQuestionIndex}.webm`
      const audioUrl = await uploadAudioFile(audioBlob, audioPath)
      
      // Update answer
      const newAnswers = [...answers]
      newAnswers[currentQuestionIndex] = {
        ...newAnswers[currentQuestionIndex],
        audioPath: audioUrl,
        durationSec: duration
      }
      setAnswers(newAnswers)
      
      // Move to next question
      if (currentQuestionIndex < (questionSet?.questions.length || 0) - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1)
      }
    } catch (err) {
      console.error('Error uploading audio:', err)
      setError('音声のアップロードに失敗しました')
    }
  }

  const handleTextAnswer = () => {
    if (!textAnswer.trim()) {
      setError('回答を入力してください')
      return
    }
    
    // Update answer
    const newAnswers = [...answers]
    newAnswers[currentQuestionIndex] = {
      ...newAnswers[currentQuestionIndex],
      textAnswer: textAnswer.trim()
    }
    setAnswers(newAnswers)
    setTextAnswer('')
    
    // Move to next question
    if (currentQuestionIndex < (questionSet?.questions.length || 0) - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
      // Load previous text answer if exists
      const prevAnswer = answers[currentQuestionIndex - 1]
      if (prevAnswer.textAnswer) {
        setTextAnswer(prevAnswer.textAnswer)
      }
    }
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      setError(null)
      
      // Check if all questions are answered
      const unanswered = answers.filter(a => !a.audioPath && !a.textAnswer)
      if (unanswered.length > 0) {
        setError(`${unanswered.length}個の質問が未回答です`)
        return
      }

      // Get company name for article generation
      const company = await getCompany(session!.companyId)
      const companyName = company?.name || '企業'

      // Process audio files: transcribe if needed
      const processedAnswers = await Promise.all(
        answers.map(async (answer) => {
          if (answer.audioPath && !answer.transcript) {
            try {
              // Transcribe audio
              const transcribeResponse = await fetch('/api/transcribe', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ audioUrl: answer.audioPath }),
              })

              if (transcribeResponse.ok) {
                const data = await transcribeResponse.json()
                return {
                  ...answer,
                  transcript: data.transcript
                }
              }
            } catch (err) {
              console.error('Error transcribing audio:', err)
            }
          }
          return answer
        })
      )

      // Generate article from Q&A
      const generateResponse = await fetch('/api/generate-article', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qa: processedAnswers.map(a => ({
            q: a.q,
            transcript: a.transcript,
            textAnswer: a.textAnswer
          })),
          companyName
        }),
      })

      if (!generateResponse.ok) {
        throw new Error('記事の生成に失敗しました')
      }

      const articleData = await generateResponse.json()
      
      // Create article with generated content
      const articleId = await createArticle({
        companyId: session!.companyId,
        status: 'draft',
        questionSetId: session!.questionSetId,
        qa: processedAnswers,
        draftArticle: articleData.article,
        snsDraft: articleData.sns,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      // Redirect to success page
      router.push(`/interview/complete?articleId=${articleId}`)
      
    } catch (err) {
      console.error('Error submitting interview:', err)
      setError(err instanceof Error ? err.message : 'インタビューの送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
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

  if (!session || !questionSet) {
    return null
  }

  const currentQuestion = questionSet.questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / questionSet.questions.length) * 100
  const isLastQuestion = currentQuestionIndex === questionSet.questions.length - 1
  const isAnswered = answers[currentQuestionIndex]?.audioPath || answers[currentQuestionIndex]?.textAnswer

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between mb-2">
            <Badge variant="outline">
              質問 {currentQuestionIndex + 1} / {questionSet.questions.length}
            </Badge>
            <Badge variant={isAnswered ? 'success' : 'secondary'}>
              {isAnswered ? '回答済み' : '未回答'}
            </Badge>
          </div>
          <CardTitle className="text-2xl">{questionSet.title}</CardTitle>
          <CardDescription>
            すべての質問に回答してインタビューを完了してください
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="h-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center">
            {Math.round(progress)}% 完了
          </p>
        </CardContent>
      </Card>

      {/* Question Card */}
      <Card className="border-0 shadow-lg interview-card">
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-lg">{currentQuestionIndex + 1}</span>
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl leading-tight">
                {currentQuestion.text}
              </CardTitle>
              {currentQuestion.ttsTemplate && (
                <CardDescription className="mt-2">
                  💡 ヒント: {currentQuestion.ttsTemplate}
                </CardDescription>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Answer Mode Toggle */}
          <div className="flex items-center gap-4 justify-center">
            <Button
              variant={answerMode === 'audio' ? 'gradient' : 'outline'}
              size="lg"
              onClick={() => setAnswerMode('audio')}
              className="flex-1 max-w-xs"
            >
              <MicIcon className="w-5 h-5 mr-2" />
              音声で回答
            </Button>
            <Button
              variant={answerMode === 'text' ? 'gradient' : 'outline'}
              size="lg"
              onClick={() => setAnswerMode('text')}
              className="flex-1 max-w-xs"
            >
              <TextIcon className="w-5 h-5 mr-2" />
              テキストで回答
            </Button>
          </div>

          {/* Answer Input */}
          {answerMode === 'audio' ? (
            <AudioRecorder
              onRecordingComplete={(blob, duration) => handleAudioRecorded(blob, duration)}
              maxDuration={180}
            />
          ) : (
            <div className="space-y-4">
              <textarea
                className="w-full min-h-[200px] p-4 border border-gray-300 dark:border-gray-700 dark:bg-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="こちらに回答を入力してください..."
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
              />
              <Button
                onClick={handleTextAnswer}
                variant="gradient"
                size="lg"
                className="w-full"
                disabled={!textAnswer.trim()}
              >
                <CheckCircleIcon className="w-5 h-5 mr-2" />
                回答を保存
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              size="lg"
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
            >
              <ArrowLeftIcon className="w-5 h-5 mr-2" />
              前の質問
            </Button>

            {isLastQuestion ? (
              <Button
                variant="gradient"
                size="lg"
                onClick={handleSubmit}
                disabled={submitting || !isAnswered}
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    送信中...
                  </>
                ) : (
                  <>
                    <SendIcon className="w-5 h-5 mr-2" />
                    インタビューを完了
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="gradient"
                size="lg"
                onClick={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                disabled={!isAnswered}
              >
                次の質問
                <ArrowRightIcon className="w-5 h-5 ml-2" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
