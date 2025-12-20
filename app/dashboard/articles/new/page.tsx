'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { getFirebaseDb } from '@/src/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { createArticle } from '@/src/lib/firestore'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeftIcon, LoaderIcon, FileTextIcon, SaveIcon, SparklesIcon, AlertCircleIcon, PlusIcon, XIcon, CheckIcon } from 'lucide-react'
import Link from 'next/link'
import { FeedbackDialog } from '@/components/feedback/FeedbackDialog'

function NewArticlePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const interviewId = searchParams.get('interviewId')
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [generatingDraft, setGeneratingDraft] = useState(false)
  const [generatingArticle, setGeneratingArticle] = useState(false)
  const [saving, setSaving] = useState(false)
  const [interview, setInterview] = useState<any>(null)
  const [draft, setDraft] = useState<any>(null)
  const [article, setArticle] = useState<any>(null)
  const [targetWordCount, setTargetWordCount] = useState<number>(2000)
  const [step, setStep] = useState<'draft' | 'wordCount' | 'article'>('draft')
  const [error, setError] = useState<string | null>(null)
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false)
  const [feedbackContext, setFeedbackContext] = useState<{ articleSection?: string } | null>(null)
  const [sectionFeedbacks, setSectionFeedbacks] = useState<Record<number, string>>({})
  
  // 編集可能な記事生成パラメータ
  const [targetAudience, setTargetAudience] = useState<string>('')
  const [mediaType, setMediaType] = useState<string>('')
  const [interviewPurpose, setInterviewPurpose] = useState<string>('')
  
  // バリエーション管理
  const [variations, setVariations] = useState<Array<{ id: string, name: string, targetAudience: string, mediaType: string, interviewPurpose: string }>>([])
  const [currentVariationId, setCurrentVariationId] = useState<string | null>(null)
  const [showVariationDialog, setShowVariationDialog] = useState(false)
  const [variationName, setVariationName] = useState<string>('')

  useEffect(() => {
    if (interviewId && user) {
      loadInterview()
    } else if (!interviewId) {
      setError('インタビューIDが指定されていません')
      setLoading(false)
    }
  }, [interviewId, user])

  const loadInterview = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const firestoreDb = getFirebaseDb()
      const docRef = doc(firestoreDb, 'interviews', interviewId!)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        const data = docSnap.data()
        setInterview({
          id: docSnap.id,
          ...data
        })
        
        // 初期値を設定
        setTargetAudience(data.targetAudience || '')
        setMediaType(data.mediaType || '')
        setInterviewPurpose(data.interviewPurpose || '')
      } else {
        setError('インタビューが見つかりません')
      }
    } catch (error) {
      console.error('Error loading interview:', error)
      setError('インタビューの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateDraft = async () => {
    if (!interview) return

    try {
      setGeneratingDraft(true)
      setError(null)

      // 会話履歴を取得
      const conversationHistory = [
        ...(interview.messages || []),
        ...(interview.rehearsalMessages || [])
      ]

      if (conversationHistory.length === 0) {
        setError('会話履歴がありません。敲きを生成するには、インタビューまたはリハーサルの会話履歴が必要です。')
        return
      }

      const response = await fetch('/api/article/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: interview.id,
          conversationHistory: conversationHistory,
          targetAudience: targetAudience || interview.targetAudience || '',
          mediaType: mediaType || interview.mediaType || '',
          interviewPurpose: interviewPurpose || interview.interviewPurpose || '',
          objective: interview.objective || '',
          intervieweeName: interview.intervieweeName || '',
          intervieweeCompany: interview.intervieweeCompany || '',
          knowledgeBaseIds: interview.knowledgeBaseIds || []
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || '敲きの生成に失敗しました'
        const details = errorData.details ? `\n詳細: ${errorData.details}` : ''
        const preview = errorData.generatedTextPreview ? `\n\n生成されたテキストのプレビュー:\n${errorData.generatedTextPreview}` : ''
        throw new Error(`${errorMessage}${details}${preview}`)
      }

      const data = await response.json()
      setDraft(data.draft)
      setStep('wordCount')
    } catch (error) {
      console.error('Error generating draft:', error)
      setError(error instanceof Error ? error.message : '敲きの生成に失敗しました')
    } finally {
      setGeneratingDraft(false)
    }
  }

  const handleGenerateArticle = async () => {
    if (!draft) return

    try {
      setGeneratingArticle(true)
      setError(null)

      if (!targetWordCount || targetWordCount < 500) {
        setError('目標文字数は500文字以上を指定してください')
        return
      }

      // フィードバックを敲きに反映
      const draftWithFeedback = {
        ...draft,
        sections: draft.sections.map((section: any, idx: number) => ({
          ...section,
          feedback: sectionFeedbacks[idx] || ''
        }))
      }

      const response = await fetch('/api/article/generate-from-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draft: draftWithFeedback,
          targetWordCount: targetWordCount,
          targetAudience: targetAudience || interview?.targetAudience || '',
          mediaType: mediaType || interview?.mediaType || '',
          interviewPurpose: interviewPurpose || interview?.interviewPurpose || '',
          knowledgeBaseIds: interview?.knowledgeBaseIds || []
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || '記事の生成に失敗しました'
        const details = errorData.details ? `\n詳細: ${errorData.details}` : ''
        const preview = errorData.generatedTextPreview ? `\n\n生成されたテキストのプレビュー:\n${errorData.generatedTextPreview}` : ''
        throw new Error(`${errorMessage}${details}${preview}`)
      }

      const data = await response.json()
      setArticle(data.article)
      setStep('article')
    } catch (error) {
      console.error('Error generating article:', error)
      setError(error instanceof Error ? error.message : '記事の生成に失敗しました')
    } finally {
      setGeneratingArticle(false)
    }
  }

  const handleApplyFeedback = async () => {
    if (!draft) return

    try {
      setGeneratingDraft(true)
      setError(null)

      // フィードバックを集約
      const feedbackText = draft.sections.map((section: any, idx: number) => {
        const feedback = sectionFeedbacks[idx]
        if (!feedback) return null
        return `${section.section}（${section.heading}）へのフィードバック:\n${feedback}`
      }).filter(Boolean).join('\n\n')

      if (!feedbackText) {
        setError('フィードバックが入力されていません')
        return
      }

      // 会話履歴を取得
      const conversationHistory = [
        ...(interview?.messages || []),
        ...(interview?.rehearsalMessages || [])
      ]

      if (conversationHistory.length === 0) {
        setError('会話履歴がありません')
        return
      }

      // フィードバックを反映した敲きを再生成
      const response = await fetch('/api/article/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interviewId: interview?.id,
          conversationHistory: conversationHistory,
          targetAudience: targetAudience || interview?.targetAudience || '',
          mediaType: mediaType || interview?.mediaType || '',
          interviewPurpose: interviewPurpose || interview?.interviewPurpose || '',
          objective: `${interview?.objective || ''}\n\n【フィードバック】\n${feedbackText}`,
          intervieweeName: interview?.intervieweeName || '',
          intervieweeCompany: interview?.intervieweeCompany || '',
          knowledgeBaseIds: interview?.knowledgeBaseIds || []
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || '敲きの再生成に失敗しました'
        const details = errorData.details ? `\n詳細: ${errorData.details}` : ''
        throw new Error(`${errorMessage}${details}`)
      }

      const data = await response.json()
      setDraft(data.draft)
      setSectionFeedbacks({}) // フィードバックをクリア
    } catch (error) {
      console.error('Error applying feedback:', error)
      setError(error instanceof Error ? error.message : 'フィードバックの反映に失敗しました')
    } finally {
      setGeneratingDraft(false)
    }
  }

  const handleSaveArticle = async () => {
    if (!article || !interview || !user?.companyId) return

    try {
      setSaving(true)
      setError(null)

      const articleData = {
        companyId: user.companyId,
        interviewId: interview.id,
        draftArticle: {
          title: article.title,
          lead: article.lead,
          sections: article.sections
        },
        status: 'draft' as const
      }

      const articleId = await createArticle(articleData)
      
      alert('✅ 記事を保存しました！')
      router.push(`/dashboard/articles/${articleId}/edit`)
    } catch (error) {
      console.error('Error saving article:', error)
      setError('記事の保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoaderIcon className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error && !interview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <Link href="/dashboard/interviews">
            <Button>インタビュー一覧に戻る</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={interviewId ? `/dashboard/interviews/${interviewId}` : '/dashboard/interviews'}
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <span>戻る</span>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  記事を生成
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {interview?.title || 'インタビューから記事を生成'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Interview Info */}
        {interview && (
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>取材情報</CardTitle>
                <Button
                  onClick={() => setShowVariationDialog(true)}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  <SparklesIcon className="w-3 h-3 mr-1" />
                  バリエーション管理
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="font-semibold">取材先: </span>
                <span>{interview.intervieweeName} ({interview.intervieweeCompany})</span>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  ターゲット読者:
                </label>
                <Textarea
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="例：起業を目指す20-30代"
                  rows={2}
                  className="text-sm"
                />
                {targetAudience !== interview.targetAudience && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    ※ 元の設定: {interview.targetAudience || '未指定'}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  掲載メディア:
                </label>
                <Textarea
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value)}
                  placeholder="例：創業支援施設が運営しているウェブメディア"
                  rows={2}
                  className="text-sm"
                />
                {mediaType !== interview.mediaType && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    ※ 元の設定: {interview.mediaType || '未指定'}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  取材の目的:
                </label>
                <Textarea
                  value={interviewPurpose}
                  onChange={(e) => setInterviewPurpose(e.target.value)}
                  placeholder="例：起業家を増やしたい、何かアイデアにつながれば"
                  rows={2}
                  className="text-sm"
                />
                {interviewPurpose !== interview.interviewPurpose && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    ※ 元の設定: {interview.interviewPurpose || '未指定'}
                  </p>
                )}
              </div>
              <div>
                <span className="font-semibold">会話履歴: </span>
                <span>
                  {((interview.messages?.length || 0) + (interview.rehearsalMessages?.length || 0))} 件
                </span>
              </div>
              
              {/* バリエーション選択 */}
              {variations.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">保存されたバリエーション:</p>
                  <div className="space-y-2">
                    {variations.map((variation) => (
                      <button
                        key={variation.id}
                        onClick={() => {
                          setTargetAudience(variation.targetAudience)
                          setMediaType(variation.mediaType)
                          setInterviewPurpose(variation.interviewPurpose)
                          setCurrentVariationId(variation.id)
                        }}
                        className={`w-full text-left p-2 rounded border text-xs ${
                          currentVariationId === variation.id
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <div className="font-semibold">{variation.name}</div>
                        <div className="text-gray-600 dark:text-gray-400 mt-1">
                          {variation.targetAudience.substring(0, 30)}...
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 1: Generate Draft */}
        {step === 'draft' && !draft && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SparklesIcon className="w-5 h-5" />
                ステップ1: 敲き（下書き/骨組み）を生成
              </CardTitle>
              <CardDescription>
                現在・過去・未来の構成で記事の骨組みを作成します
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleGenerateDraft}
                disabled={generatingDraft || !interview}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                size="lg"
              >
                {generatingDraft ? (
                  <>
                    <LoaderIcon className="w-5 h-5 mr-2 animate-spin" />
                    敲きを生成中...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-5 h-5 mr-2" />
                    敲きを生成する
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Draft Review & Word Count */}
        {step === 'wordCount' && draft && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileTextIcon className="w-5 h-5" />
                  ステップ2: 敲きの確認と文字数指定
                </CardTitle>
                <CardDescription>
                  生成された敲きを確認し、目標文字数を指定して記事を生成します
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Explanation */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
                    なぜこういう記事にしたのか？
                  </h3>
                  <p className="text-blue-800 dark:text-blue-200 text-sm leading-relaxed">
                    {draft.explanation}
                  </p>
                </div>

                {/* Draft Sections */}
                {draft.sections && draft.sections.map((section: any, idx: number) => (
                  <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {section.section}: {section.heading}
                      </h3>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">要点:</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        {section.keyPoints && section.keyPoints.map((point: string, i: number) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">内容の概要:</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {section.contentOutline}
                      </p>
                    </div>
                    {/* Feedback for each section */}
                    <div className="mt-3">
                      <textarea
                        placeholder="このセクションへのフィードバックを入力..."
                        value={sectionFeedbacks[idx] || ''}
                        onChange={(e) => setSectionFeedbacks({ ...sectionFeedbacks, [idx]: e.target.value })}
                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        rows={2}
                      />
                    </div>
                  </div>
                ))}

                {/* Word Count Input */}
                <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-3">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      目標文字数
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="500"
                        max="10000"
                        step="100"
                        value={targetWordCount}
                        onChange={(e) => setTargetWordCount(parseInt(e.target.value) || 2000)}
                        className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">文字</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      500文字以上、10,000文字以下で指定してください
                    </p>
                  </div>
                  
                  {/* Quick Word Count Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTargetWordCount(1500)}
                      className="text-xs"
                    >
                      1,500文字
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTargetWordCount(2000)}
                      className="text-xs"
                    >
                      2,000文字
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTargetWordCount(3000)}
                      className="text-xs"
                    >
                      3,000文字
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTargetWordCount(5000)}
                      className="text-xs"
                    >
                      5,000文字
                    </Button>
                  </div>
                </div>

                {/* Apply Feedback Button */}
                {Object.keys(sectionFeedbacks).length > 0 && (
                  <Button
                    onClick={handleApplyFeedback}
                    disabled={generatingDraft}
                    variant="outline"
                    className="w-full border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                  >
                    {generatingDraft ? (
                      <>
                        <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                        フィードバックを反映中...
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="w-4 h-4 mr-2" />
                        フィードバックを反映して敲きを再生成
                      </>
                    )}
                  </Button>
                )}

                {/* Generate Article Button */}
                <Button
                  onClick={handleGenerateArticle}
                  disabled={generatingArticle || !targetWordCount}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                  size="lg"
                >
                  {generatingArticle ? (
                    <>
                      <LoaderIcon className="w-5 h-5 mr-2 animate-spin" />
                      記事を生成中...
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-5 h-5 mr-2" />
                      記事を生成する
                    </>
                  )}
                </Button>

                {/* Back to Draft Generation */}
                <Button
                  onClick={() => {
                    setDraft(null)
                    setStep('draft')
                  }}
                  variant="outline"
                  className="w-full"
                >
                  敲きを再生成
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Generated Article */}
        {step === 'article' && article && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileTextIcon className="w-5 h-5" />
                    ステップ3: 生成された記事
                  </CardTitle>
                  <Button
                    onClick={handleSaveArticle}
                    disabled={saving}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                  >
                    {saving ? (
                      <>
                        <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <SaveIcon className="w-4 h-4 mr-2" />
                        記事を保存
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Explanation */}
                {article.explanation && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
                      なぜこういう記事にしたのか？
                    </h3>
                    <p className="text-blue-800 dark:text-blue-200 text-sm leading-relaxed">
                      {article.explanation}
                    </p>
                  </div>
                )}

                {/* Title */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {article.title}
                  </h2>
                </div>

                {/* Lead */}
                <div>
                  <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                    {article.lead}
                  </p>
                </div>

                {/* Sections */}
                {article.sections && article.sections.map((section: any, idx: number) => (
                  <div key={idx} className="space-y-3 border-b border-gray-200 dark:border-gray-700 pb-6 last:border-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {section.heading}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFeedbackContext({ articleSection: `${section.heading}\n\n${section.body}` })
                          setShowFeedbackDialog(true)
                        }}
                        className="h-7 px-2 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                      >
                        <AlertCircleIcon className="w-3 h-3 mr-1" />
                        フィードバック
                      </Button>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {section.body}
                    </p>
                    {/* Feedback for each section */}
                    <div className="mt-3">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        このセクションへのフィードバック
                      </label>
                      <textarea
                        placeholder="このセクションへのフィードバックを入力..."
                        value={sectionFeedbacks[idx] || ''}
                        onChange={(e) => setSectionFeedbacks({ ...sectionFeedbacks, [idx]: e.target.value })}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                        rows={3}
                      />
                    </div>
                  </div>
                ))}

                {/* Word Count Info */}
                {article.wordCountBreakdown && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      文字数内訳
                    </h4>
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <div>リード文: 約{article.wordCountBreakdown.lead || 0}文字</div>
                      <div>現在: 約{article.wordCountBreakdown.現在 || 0}文字</div>
                      <div>過去: 約{article.wordCountBreakdown.過去 || 0}文字</div>
                      <div>未来: 約{article.wordCountBreakdown.未来 || 0}文字</div>
                      <div className="font-semibold mt-2">
                        合計: 約{article.totalWordCount || 0}文字
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                onClick={() => {
                  setArticle(null)
                  setStep('wordCount')
                }}
                variant="outline"
                className="flex-1"
              >
                文字数を変更して再生成
              </Button>
              <Button
                onClick={() => {
                  setDraft(null)
                  setArticle(null)
                  setStep('draft')
                }}
                variant="outline"
                className="flex-1"
              >
                敲きからやり直す
              </Button>
            </div>
          </div>
        )}

        {/* Feedback Dialog */}
        <FeedbackDialog
          isOpen={showFeedbackDialog}
          onClose={() => {
            setShowFeedbackDialog(false)
            setFeedbackContext(null)
          }}
          onSubmit={async (type, message) => {
            if (!user?.companyId || !interviewId) {
              throw new Error('ユーザー情報またはインタビューIDが取得できません')
            }

            const response = await fetch('/api/feedback/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                companyId: user.companyId,
                interviewId: interviewId,
                articleId: article?.id,
                source: 'article',
                type: type,
                message: message,
                context: feedbackContext || undefined,
                createdBy: user.uid
              }),
            })

            if (!response.ok) {
              const errorData = await response.json()
              throw new Error(errorData.error || 'フィードバックの送信に失敗しました')
            }
          }}
          context={feedbackContext || undefined}
          source="article"
        />
      </div>

      {/* バリエーションダイアログ */}
      {showVariationDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>バリエーションを保存</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowVariationDialog(false)
                    setVariationName('')
                  }}
                >
                  <XIcon className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  バリエーション名
                </label>
                <input
                  type="text"
                  value={variationName}
                  onChange={(e) => setVariationName(e.target.value)}
                  placeholder="例：起業家向け記事、一般読者向け記事など"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <p><strong>ターゲット読者:</strong> {targetAudience || '未設定'}</p>
                <p><strong>掲載メディア:</strong> {mediaType || '未設定'}</p>
                <p><strong>取材の目的:</strong> {interviewPurpose || '未設定'}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    if (!variationName.trim()) {
                      alert('バリエーション名を入力してください')
                      return
                    }
                    const newVariation = {
                      id: `var-${Date.now()}`,
                      name: variationName.trim(),
                      targetAudience,
                      mediaType,
                      interviewPurpose
                    }
                    setVariations([...variations, newVariation])
                    setCurrentVariationId(newVariation.id)
                    setShowVariationDialog(false)
                    setVariationName('')
                  }}
                  className="flex-1"
                >
                  <CheckIcon className="w-4 h-4 mr-2" />
                  保存
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowVariationDialog(false)
                    setVariationName('')
                  }}
                >
                  キャンセル
                </Button>
              </div>
              
              {/* 既存のバリエーション一覧 */}
              {variations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">保存済みバリエーション:</p>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {variations.map((variation) => (
                      <div
                        key={variation.id}
                        className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium">{variation.name}</p>
                          <p className="text-xs text-gray-500">{variation.targetAudience.substring(0, 40)}...</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setVariations(variations.filter(v => v.id !== variation.id))
                            if (currentVariationId === variation.id) {
                              setCurrentVariationId(null)
                            }
                          }}
                        >
                          <XIcon className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function NewArticlePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoaderIcon className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    }>
      <NewArticlePageContent />
    </Suspense>
  )
}

