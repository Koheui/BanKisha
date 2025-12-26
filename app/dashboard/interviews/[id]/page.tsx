'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { getFirebaseDb } from '@/src/lib/firebase'
import { doc, getDoc, collection, getDocs, deleteDoc, updateDoc, serverTimestamp, Timestamp, addDoc, query, where, orderBy } from 'firebase/firestore'
import { migrateInterviewMessages } from '@/src/lib/firestore'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { ArrowLeftIcon, LoaderIcon, MicIcon, PlayCircleIcon, FileTextIcon, TrashIcon, ShareIcon, CopyIcon, PlusIcon, RotateCcwIcon } from 'lucide-react'
import Link from 'next/link'

function InterviewModeSelectorContent() {
  const params = useParams()
  const interviewId = params.id as string
  const { user } = useAuth()
  const router = useRouter()
  const [interview, setInterview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)
  const [migrating, setMigrating] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [relatedSessions, setRelatedSessions] = useState<any[]>([])
  const [parentInterview, setParentInterview] = useState<any>(null)
  const [publicUrl, setPublicUrl] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPublicUrl(`${window.location.origin}/interviews/${interviewId}/public`)
    }
  }, [interviewId])

  useEffect(() => {
    if (interviewId && user) {
      loadInterview()
    }
  }, [interviewId, user])

  const loadInterview = async () => {
    try {
      const firestoreDb = getFirebaseDb()
      const docRef = doc(firestoreDb, 'interviews', interviewId)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data()

        // メッセージサブコレクションがあるか確認
        const messagesRef = collection(firestoreDb, 'interviews', interviewId, 'messages')
        const messagesSnap = await getDocs(messagesRef)
        const hasSubcollectionMessages = !messagesSnap.empty

        // 旧形式のメッセージ配列があるか確認
        const hasOldMessages = Array.isArray(data.messages) && data.messages.length > 0

        setInterview({
          id: docSnap.id,
          ...data,
          hasOldMessages: hasOldMessages && !hasSubcollectionMessages
        })
      } else {
        alert('❌ インタビューが見つかりません')
        router.push('/dashboard/interviews')
      }
    } catch (error) {
      console.error('Error loading interview:', error)
      alert('❌ インタビューの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const loadRelatedSessions = async () => {
    try {
      const firestoreDb = getFirebaseDb()

      // 子セッションを取得
      const q = query(
        collection(firestoreDb, 'interviews'),
        where('parentInterviewId', '==', interviewId),
        orderBy('createdAt', 'desc')
      )
      const querySnap = await getDocs(q)
      const sessions = querySnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setRelatedSessions(sessions)

      // 親セッションがある場合は取得
      if (interview?.parentInterviewId) {
        const parentRef = doc(firestoreDb, 'interviews', interview.parentInterviewId)
        const parentSnap = await getDoc(parentRef)
        if (parentSnap.exists()) {
          setParentInterview({
            id: parentSnap.id,
            ...parentSnap.data()
          })
        }
      }
    } catch (error) {
      console.error('Error loading related sessions:', error)
    }
  }

  useEffect(() => {
    if (interview) {
      loadRelatedSessions()
    }
  }, [interview])

  const handleClearHistory = async () => {
    if (!window.confirm('これまでの会話履歴をすべて削除し、最初からやり直しますか？\nこの操作は取り消せません。')) {
      return
    }

    setClearing(true)
    try {
      const firestoreDb = getFirebaseDb()

      // 1. messages サブコレクションのドキュメントをすべて取得して削除
      const messagesRef = collection(firestoreDb, 'interviews', interviewId, 'messages')
      const messagesSnap = await getDocs(messagesRef)

      const deletePromises = messagesSnap.docs.map(doc => deleteDoc(doc.ref))
      await Promise.all(deletePromises)

      // 2. インタビュー本体の状態をリセット
      const docRef = doc(firestoreDb, 'interviews', interviewId)
      await updateDoc(docRef, {
        currentQuestionIndex: 0,
        status: 'active',
        updatedAt: serverTimestamp()
      })

      // 3. ローカル状態を更新
      setInterview((prev: any) => ({
        ...prev,
        currentQuestionIndex: 0,
        status: 'active'
      }))

      alert('✅ 会話履歴をクリアしました。')
    } catch (error) {
      console.error('Error clearing history:', error)
      alert('❌ 履歴の削除に失敗しました。')
    } finally {
      setClearing(false)
    }
  }

  const handleCreateNewVersion = async () => {
    if (!interview || !user?.companyId) return

    const newName = window.prompt(
      '新しい対象者の名前を入力してください（空欄の場合は元の名前を引き継ぎます）:',
      interview.intervieweeName
    )

    if (newName === null) return // キャンセル

    setDuplicating(true)
    try {
      const firestoreDb = getFirebaseDb()

      // 親のIDを特定（既に子セッションなら親のIDを引き継ぐ、そうでなければ今のIDが親）
      const parentId = interview.parentInterviewId || interviewId

      const newInterviewData = {
        ...interview,
        title: `${interview.title.replace(/（コピー）| \(New Session\)/g, '')} (${newName})`,
        intervieweeName: newName || interview.intervieweeName,
        parentInterviewId: parentId, // 常に大元の親にリンクさせる
        messages: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'active',
        currentQuestionIndex: 0
      }

      // 不要なフィールドを削除
      delete newInterviewData.id
      delete newInterviewData.hasOldMessages

      const newDocRef = await addDoc(collection(firestoreDb, 'interviews'), newInterviewData)
      alert('✅ 新しいセッションを作成しました。')
      router.push(`/dashboard/interviews/${newDocRef.id}`)
      loadRelatedSessions() // 再読み込み
    } catch (error) {
      console.error('Error creating new version:', error)
      alert('❌ 新しいセッションの作成に失敗しました。')
    } finally {
      setDuplicating(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('✅ URLをクリップボードにコピーしました。')
  }

  const handleMigrateMessages = async () => {
    if (!interviewId) return

    setMigrating(true)
    try {
      const result = await migrateInterviewMessages(interviewId)
      if (result.success) {
        alert(`✅ ${result.migratedCount} 件のメッセージを移行しました。`)
        await loadInterview()
      }
    } catch (error) {
      console.error('Error migrating messages:', error)
      alert('❌ メッセージの移行に失敗しました。')
    } finally {
      setMigrating(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoaderIcon className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!interview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">インタビューが見つかりません</p>
          <Link href="/dashboard/interviews">
            <Button className="mt-4">インタビュー一覧に戻る</Button>
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
          <Link
            href="/dashboard/interviews"
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mb-4"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span>インタビュー一覧に戻る</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {interview.title}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {interview.intervieweeName}
            {interview.intervieweeCompany && ` (${interview.intervieweeCompany})`}
          </p>

          {parentInterview && (
            <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-lg flex items-center justify-between">
              <div className="text-sm text-indigo-700 dark:text-indigo-300">
                <span className="font-semibold">元になったインタビュー:</span> {parentInterview.title}
              </div>
              <Link href={`/dashboard/interviews/${parentInterview.id}`}>
                <Button size="sm" variant="ghost" className="text-indigo-600 hover:text-indigo-700">
                  元の設定を見る
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Migration Alert */}
        {interview.hasOldMessages && (
          <div className="mb-8 p-6 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
            <div>
              <p className="text-amber-800 dark:text-amber-300 font-bold text-lg">
                過去のインタビューデータが見つかりました
              </p>
              <p className="text-amber-700 dark:text-amber-400 text-sm mt-1">
                最新システムで記事作成や再開を行うには、データを新しい形式に移行する必要があります。
              </p>
            </div>
            <Button
              onClick={handleMigrateMessages}
              disabled={migrating}
              className="bg-amber-600 hover:bg-amber-700 text-white shadow-md w-full md:w-auto"
              size="lg"
            >
              {migrating ? <LoaderIcon className="w-5 h-5 animate-spin mr-2" /> : null}
              {migrating ? '移行中...' : 'データを新形式へ移行する'}
            </Button>
          </div>
        )}

        {/* Mode Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* リハーサル */}
          <Card className="border-2 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircleIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                リハーサル
              </CardTitle>
              <CardDescription>
                質問を確認し、インタビューの流れを練習できます
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 mb-4">
                <li>• 質問の内容を確認</li>
                <li>• インタビューの流れを練習</li>
                <li>• 会話履歴は保存されません</li>
              </ul>
              <Link href={`/dashboard/interviews/${interviewId}/run?mode=rehearsal`}>
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                  <PlayCircleIcon className="w-4 h-4 mr-2" />
                  リハーサルを開始
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* 本番 */}
          <Card className="border-2 border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-600 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MicIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                本番
              </CardTitle>
              <CardDescription>
                実際のインタビューを実施します。会話履歴が保存されます
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 mb-4">
                <li>• 実際のインタビューを実施</li>
                <li>• 会話履歴が保存されます</li>
                <li>• 記事制作に使用できます</li>
              </ul>
              <Link href={`/dashboard/interviews/${interviewId}/run?mode=live`}>
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                  <MicIcon className="w-4 h-4 mr-2" />
                  本番を開始
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* 記事作成 */}
          <Card className="md:col-span-2 border-2 border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileTextIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                記事を作成
              </CardTitle>
              <CardDescription>
                取材した内容をもとに、AIが記事の構成・執筆を行います
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                インタビューで得られた発言やエピソードを元に、ターゲットに合わせた最適な記事を生成します。
              </p>
              <Link href={`/dashboard/articles/new?interviewId=${interviewId}`}>
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white shadow-sm">
                  <FileTextIcon className="w-4 h-4 mr-2" />
                  この記事から記事を作成する
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* 公開URL */}
          <Card className="md:col-span-2 border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-gray-800 dark:text-gray-200">
                <ShareIcon className="w-6 h-6 text-indigo-500" />
                外部公開（インタビューURL）
              </CardTitle>
              <CardDescription>
                このURLを相手に送ることで、ログイン不要でインタビューを開始できます
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <div className="flex-1 w-full p-3 bg-gray-50 dark:bg-gray-900 rounded-lg font-mono text-sm border border-gray-200 dark:border-gray-700 break-all">
                  {publicUrl}
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(publicUrl)}
                    className="flex-1 sm:flex-none"
                  >
                    <CopyIcon className="w-4 h-4 mr-2" />
                    コピー
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => window.open(publicUrl, '_blank')}
                    className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <ShareIcon className="w-4 h-4 mr-2" />
                    開く
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-8">
          <Link href={`/dashboard/interviews/new?id=${interviewId}`} className="w-full sm:flex-1">
            <Button variant="outline" className="w-full h-12 border-gray-300 dark:border-gray-600">
              <FileTextIcon className="w-4 h-4 mr-2" />
              質問を編集
            </Button>
          </Link>
          <Button
            variant="outline"
            className="w-full sm:flex-1 h-12 bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-indigo-600 border-indigo-200 dark:border-indigo-800"
            onClick={handleCreateNewVersion}
            disabled={duplicating}
          >
            {duplicating ? <LoaderIcon className="w-4 h-4 animate-spin mr-2" /> : <PlusIcon className="w-4 h-4 mr-2" />}
            {duplicating ? '作成中...' : '新しいセッションを開始'}
          </Button>
          <Button
            variant="outline"
            className="w-full sm:flex-1 h-12 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
            onClick={handleClearHistory}
            disabled={clearing}
          >
            <RotateCcwIcon className="w-4 h-4 mr-2" />
            {clearing ? '削除中...' : '履歴をリセット'}
          </Button>
        </div>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 text-center">
          ※「履歴をリセット」はボイスチャットの会話内容のみを削除します。インタビューの基本設定や作成済みの記事は削除されません。
        </p>

        {/* Related Sessions Section */}
        {relatedSessions.length > 0 && (
          <div className="mt-12">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <ShareIcon className="w-5 h-5 text-indigo-500" />
              この設定から作成されたセッション
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {relatedSessions.map((session) => (
                <Card key={session.id} className="border border-gray-200 dark:border-gray-800 hover:border-indigo-300 transition-colors">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{session.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        参加者: {session.intervieweeName} {session.intervieweeCompany && `(${session.intervieweeCompany})`}
                      </p>
                    </div>
                    <Link href={`/dashboard/interviews/${session.id}`}>
                      <Button variant="ghost" size="sm">詳細を見る</Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function InterviewModeSelectorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoaderIcon className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    }>
      <InterviewModeSelectorContent />
    </Suspense>
  )
}
