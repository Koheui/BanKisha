'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { getFirebaseDb } from '@/src/lib/firebase'
import { collection, query, where, getDocs, orderBy, Timestamp, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon, PlusIcon, MicIcon, CalendarIcon, UserIcon, BuildingIcon, LoaderIcon, EditIcon, TrashIcon, CopyIcon, FileTextIcon } from 'lucide-react'
import Link from 'next/link'
import { InterviewSession } from '@/src/types'
import { CreateInterviewModal } from '@/components/interviews/CreateInterviewModal'

export default function InterviewsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [interviews, setInterviews] = useState<InterviewSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // ブラウザのスクロール位置復元を無効化（最優先で実行）
  useLayoutEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual'
    }
    // 即座にスクロール位置を最上部に設定
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
  }, [])

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    } else if (user?.companyId) {
      loadInterviews()
    }
  }, [user, authLoading, router])

  // ページ読み込み時にスクロール位置を最上部に設定（レンダリング前）
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo(0, 0)
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    document.documentElement.scrollTop = 0
    document.documentElement.scrollLeft = 0
    document.body.scrollTop = 0
    document.body.scrollLeft = 0
  }, [])

  // データ読み込み完了時にスクロール位置を最上部に設定
  useLayoutEffect(() => {
    if (!loading) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
  }, [loading])

  // インタビューリストが更新された時にスクロール位置を最上部に設定
  useLayoutEffect(() => {
    if (interviews.length > 0) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }
  }, [interviews.length])

  // 追加のフォールバック：複数のタイミングでスクロール位置を設定
  useEffect(() => {
    if (typeof window === 'undefined') return

    const scrollToTop = () => {
      window.scrollTo(0, 0)
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      if (document.documentElement) {
        document.documentElement.scrollTop = 0
        document.documentElement.scrollLeft = 0
      }
      if (document.body) {
        document.body.scrollTop = 0
        document.body.scrollLeft = 0
      }
      if (containerRef.current) {
        containerRef.current.scrollTop = 0
        containerRef.current.scrollLeft = 0
      }
    }

    // 即座に実行
    scrollToTop()

    // 複数のタイミングで実行（リロード時の復元を防ぐ）
    const timers = [
      setTimeout(scrollToTop, 0),
      setTimeout(scrollToTop, 10),
      setTimeout(scrollToTop, 50),
      setTimeout(scrollToTop, 100),
      setTimeout(scrollToTop, 200),
      setTimeout(scrollToTop, 500),
      setTimeout(scrollToTop, 1000),
    ]

    return () => {
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [loading, interviews.length])

  // ページ表示時（loadイベント）にもスクロール位置を最上部に設定
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleLoad = () => {
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }

    // 既に読み込み完了している場合
    if (document.readyState === 'complete') {
      handleLoad()
    } else {
      window.addEventListener('load', handleLoad)
    }

    // DOMContentLoadedイベントでも実行
    document.addEventListener('DOMContentLoaded', handleLoad)

    return () => {
      window.removeEventListener('load', handleLoad)
      document.removeEventListener('DOMContentLoaded', handleLoad)
    }
  }, [])

  // beforeunload時にスクロール位置を最上部に設定（リロード時の復元を防ぐ）
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleBeforeUnload = () => {
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  const loadInterviews = async () => {
    if (!user?.companyId) return

    try {
      setLoading(true)
      setError(null)

      // 親インタビューのみを取得（バージョンは除外）
      // 注意: Firestoreではnullの比較ができないため、クライアント側でフィルタリング
      const q = query(
        collection(getFirebaseDb(), 'interviews'),
        where('companyId', '==', user.companyId),
        orderBy('createdAt', 'desc')
      )

      const snapshot = await getDocs(q)
      const data = snapshot.docs
        .map(doc => {
          const docData = doc.data()
          return {
            id: doc.id,
            ...docData,
            createdAt: docData.createdAt?.toDate ? docData.createdAt.toDate() : (docData.createdAt instanceof Timestamp ? docData.createdAt.toDate() : new Date(docData.createdAt)),
            updatedAt: docData.updatedAt?.toDate ? docData.updatedAt.toDate() : (docData.updatedAt instanceof Timestamp ? docData.updatedAt.toDate() : new Date(docData.updatedAt))
          } as InterviewSession
        })
        .filter(interview => {
          // 親インタビューのみを表示（バージョンは除外）
          // parentInterviewIdが存在しないものを表示（親インタビュー）
          return !interview.parentInterviewId
        })

      setInterviews(data)
    } catch (err: any) {
      console.error('Error loading interviews:', err)
      const errorMessage = err?.message || 'インタビューの読み込みに失敗しました'
      if (errorMessage.includes('permission') || errorMessage.includes('PERMISSION_DENIED')) {
        setError('Firestoreのアクセス権限がありません。Firebase設定を確認してください。')
      } else if (errorMessage.includes('index')) {
        setError('Firestoreインデックスが必要です。Firebaseコンソールでインデックスを作成してください。')
      } else {
        setError(`インタビューの読み込みに失敗しました: ${errorMessage}`)
      }
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (date: Date | undefined) => {
    if (!date) return '日付不明'
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const handleDeleteInterview = async (interviewId: string, interviewTitle: string) => {
    if (!confirm(`「${interviewTitle}」を削除してもよろしいですか？\nこの操作は取り消せません。`)) {
      return
    }

    try {
      setDeletingId(interviewId)
      await deleteDoc(doc(getFirebaseDb(), 'interviews', interviewId))

      // リストから削除
      setInterviews(prev => prev.filter(interview => interview.id !== interviewId))

      alert('✅ インタビューを削除しました')
    } catch (error) {
      console.error('Error deleting interview:', error)
      alert('❌ インタビューの削除に失敗しました')
    } finally {
      setDeletingId(null)
    }
  }

  const handleDuplicateInterview = async (interview: InterviewSession) => {
    if (!user?.companyId) {
      alert('⚠️ ユーザー情報が取得できません')
      return
    }

    const newName = window.prompt(
      '新しい対象者の名前を入力してください（空欄の場合は元の名前を引き継ぎます）:',
      interview.intervieweeName
    )

    if (newName === null) return // キャンセル

    try {
      setDuplicatingId(interview.id)

      // 元のインタビューのデータをコピー
      const duplicatedData = {
        ...interview,
        title: `${interview.title.replace(/（コピー）| \(New Session\)/g, '')}（コピー）`,
        intervieweeName: newName || interview.intervieweeName,
        status: 'active' as const,
        messages: [], // 会話履歴はコピーしない
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      // 不要なフィールドを削除/上書き
      delete (duplicatedData as any).id

      const newInterviewRef = await addDoc(collection(getFirebaseDb(), 'interviews'), duplicatedData)

      alert('✅ インタビューを複製しました')

      // リストを再読み込み
      await loadInterviews()

      // 編集ページに遷移
      router.push(`/dashboard/interviews/new?id=${newInterviewRef.id}`)
    } catch (error) {
      console.error('Error duplicating interview:', error)
      alert('❌ インタビューの複製に失敗しました')
    } finally {
      setDuplicatingId(null)
    }
  }

  // コンテナがマウントされた時にスクロール位置を最上部に設定
  useEffect(() => {
    if (typeof window === 'undefined') return

    const scrollToTop = () => {
      window.scrollTo(0, 0)
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
      if (document.documentElement) {
        document.documentElement.scrollTop = 0
        document.documentElement.scrollLeft = 0
      }
      if (document.body) {
        document.body.scrollTop = 0
        document.body.scrollLeft = 0
      }
      if (containerRef.current) {
        containerRef.current.scrollTop = 0
        containerRef.current.scrollLeft = 0
      }
    }

    // 即座に実行
    scrollToTop()

    // 複数のタイミングで実行（レンダリング完了を待つ）
    const timers = [
      setTimeout(scrollToTop, 0),
      setTimeout(scrollToTop, 10),
      setTimeout(scrollToTop, 50),
      setTimeout(scrollToTop, 100),
      setTimeout(scrollToTop, 200),
      setTimeout(scrollToTop, 500),
      setTimeout(scrollToTop, 1000),
    ]

    return () => {
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [])

  // データ読み込み完了時にもスクロール位置を最上部に設定
  useEffect(() => {
    if (!loading && typeof window !== 'undefined') {
      const scrollToTop = () => {
        window.scrollTo(0, 0)
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
        document.documentElement.scrollTop = 0
        document.documentElement.scrollLeft = 0
        document.body.scrollTop = 0
        document.body.scrollLeft = 0
      }
      scrollToTop()
      setTimeout(scrollToTop, 0)
      setTimeout(scrollToTop, 50)
      setTimeout(scrollToTop, 100)
      setTimeout(scrollToTop, 200)
    }
  }, [loading])

  // ページ表示時（loadイベント）にもスクロール位置を最上部に設定
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleLoad = () => {
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0
    }

    // 既に読み込み完了している場合
    if (document.readyState === 'complete') {
      handleLoad()
    } else {
      window.addEventListener('load', handleLoad)
    }

    // DOMContentLoadedイベントでも実行
    document.addEventListener('DOMContentLoaded', handleLoad)

    return () => {
      window.removeEventListener('load', handleLoad)
      document.removeEventListener('DOMContentLoaded', handleLoad)
    }
  }, [])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoaderIcon className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8"
      style={{ scrollBehavior: 'auto' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <span>ダッシュボードに戻る</span>
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  インタビュー一覧
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  保存されたインタビューを確認・管理できます
                </p>
              </div>
            </div>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              新規インタビュー作成
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Interviews List */}
        {interviews.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <MicIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                インタビューがありません
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                新しいインタビューを作成して開始しましょう
              </p>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white"
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                新規インタビュー作成
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {interviews.map((interview) => (
              <Card key={interview.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <CardTitle className="text-lg line-clamp-2">{interview.title}</CardTitle>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ml-2 ${interview.status === 'active'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : interview.status === 'paused'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                      {interview.status === 'active' ? '進行中' : interview.status === 'paused' ? '一時停止' : '完了'}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4" />
                      <span>{interview.intervieweeName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BuildingIcon className="w-4 h-4" />
                      <span>{interview.intervieweeCompany}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4" />
                      <span>{formatDate(interview.createdAt)}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {interview.objective && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                      {interview.objective}
                    </p>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/interviews/${interview.id}`} className="flex-1">
                        <Button className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white">
                          <MicIcon className="w-4 h-4 mr-2" />
                          インタビュー
                        </Button>
                      </Link>
                      <Link href={`/dashboard/articles/new?interviewId=${interview.id}`} className="flex-1">
                        <Button className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white">
                          <FileTextIcon className="w-4 h-4 mr-2" />
                          記事作成
                        </Button>
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/interviews/new?id=${interview.id}`} className="flex-1">
                        <Button variant="outline" className="w-full">
                          <EditIcon className="w-4 h-4 mr-2" />
                          質問を編集
                        </Button>
                      </Link>
                      <Button
                        onClick={() => handleDuplicateInterview(interview)}
                        variant="outline"
                        className="flex-1"
                        disabled={duplicatingId === interview.id}
                        title="インタビューを複製"
                      >
                        {duplicatingId === interview.id ? (
                          <>
                            <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                            複製中...
                          </>
                        ) : (
                          <>
                            <CopyIcon className="w-4 h-4 mr-2" />
                            複製
                          </>
                        )}
                      </Button>
                    </div>
                    <Button
                      onClick={() => handleDeleteInterview(interview.id, interview.title)}
                      variant="outline"
                      className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                      disabled={deletingId === interview.id}
                    >
                      {deletingId === interview.id ? (
                        <>
                          <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                          削除中...
                        </>
                      ) : (
                        <>
                          <TrashIcon className="w-4 h-4 mr-2" />
                          削除
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <CreateInterviewModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onComplete={(id) => {
          setIsCreateModalOpen(false)
          loadInterviews()
        }}
      />
    </div>
  )
}


