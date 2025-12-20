'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { getFirebaseDb } from '@/src/lib/firebase'
import { doc, getDoc, updateDoc, addDoc, collection, arrayUnion, serverTimestamp } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeftIcon, LoaderIcon, ShareIcon, CopyIcon, FileTextIcon, DownloadIcon, FileIcon, MessageSquareIcon } from 'lucide-react'
import Link from 'next/link'

function InterviewPageContent() {
  const params = useParams()
  const interviewId = params.id as string
  const { user } = useAuth()
  const router = useRouter()
  const [interview, setInterview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [shareUrl, setShareUrl] = useState<string>('')
  const [urlCopied, setUrlCopied] = useState(false)

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
        setInterview({
          id: docSnap.id,
          ...data
        })
        
        // shareUrlは初期化しない（URL発行/再発行時に設定される）
        // 既存のURLが自動的に表示されないようにする
      } else {
        alert('❌ インタビューが見つかりません')
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Error loading interview:', error)
      alert('❌ インタビューの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateShareUrl = async () => {
    if (!interview) return

    try {
      const firestoreDb = getFirebaseDb()
      
      // バージョン番号を生成（既存のバージョン数 + 1）
      const existingVersions = interview.versions || []
      const versionNumber = existingVersions.length + 1
      
      // バージョンインタビューを作成してから、そのIDを取得してバージョン情報を作成
      // まず、バージョンインタビューのデータを作成
      const cleanData = (obj: any): any => {
        const cleaned: any = {}
        for (const key in obj) {
          if (obj[key] !== undefined) {
            cleaned[key] = obj[key]
          }
        }
        return cleaned
      }
      
      const versionInterviewData = cleanData({
        title: interview.title,
        intervieweeName: interview.intervieweeName,
        intervieweeCompany: interview.intervieweeCompany,
        intervieweeTitle: interview.intervieweeTitle,
        intervieweeDepartment: interview.intervieweeDepartment,
        intervieweeType: interview.intervieweeType,
        interviewerId: interview.interviewerId,
        interviewerName: interview.interviewerName,
        interviewerRole: interview.interviewerRole,
        interviewPurpose: interview.interviewPurpose,
        targetAudience: interview.targetAudience,
        mediaType: interview.mediaType,
        category: interview.category,
        objective: interview.objective,
        questions: interview.questions,
        interviewerPrompt: interview.interviewerPrompt,
        knowledgeBaseIds: interview.knowledgeBaseIds || [],
        confirmNameAtInterview: interview.confirmNameAtInterview,
        confirmCompanyAtInterview: interview.confirmCompanyAtInterview,
        confirmTitleAtInterview: interview.confirmTitleAtInterview,
        confirmDepartmentAtInterview: interview.confirmDepartmentAtInterview,
        status: 'active',
        messages: [],
        rehearsalMessages: [],
        parentInterviewId: interview.id, // 親インタビューIDを設定
        versionNumber, // バージョン番号を設定
        isParent: false, // 親インタビューではない
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.uid || '',
        companyId: interview.companyId || user?.companyId || ''
      })
      
      // バージョンインタビューを作成
      const versionInterviewRef = await addDoc(collection(firestoreDb, 'interviews'), versionInterviewData)
      const versionInterviewId = versionInterviewRef.id
      
      // バージョン情報を作成（serverTimestamp()は使用しない - arrayUnion()内では使用できない）
      const newVersion = {
        versionNumber,
        shareUrl: `${window.location.origin}/interviews/${versionInterviewId}/public`,
        shareToken: '',
        versionInterviewId, // バージョンインタビューのIDを保存
        messages: [],
        rehearsalMessages: [],
        createdAt: new Date(), // serverTimestamp()の代わりに通常のDateを使用
        createdBy: user?.uid || ''
      }
      
      // 親インタビューにバージョン情報を追加
      await updateDoc(doc(firestoreDb, 'interviews', interview.id), {
        versions: arrayUnion(newVersion),
        shareUrl: newVersion.shareUrl, // 最新のURLを保存
        updatedAt: serverTimestamp()
      })
      
      setShareUrl(newVersion.shareUrl)
      
      // Copy to clipboard
      await navigator.clipboard.writeText(newVersion.shareUrl)
      setUrlCopied(true)
      setTimeout(() => setUrlCopied(false), 3000)
      
      alert(`✅ インタビューURLを生成しました！\n\nURL: ${newVersion.shareUrl}\n\nクリップボードにコピーしました。`)
    } catch (error) {
      console.error('Error generating share URL:', error)
      alert('❌ URLの生成に失敗しました')
    }
  }

  const handleRegenerateShareUrl = async () => {
    // 再生成も同じ処理（新しいバージョンを作成）
    await handleGenerateShareUrl()
  }

  const handleCopyUrl = async () => {
    if (!shareUrl) return
    
    try {
      await navigator.clipboard.writeText(shareUrl)
      setUrlCopied(true)
      setTimeout(() => setUrlCopied(false), 3000)
      alert('✅ URLをクリップボードにコピーしました！')
    } catch (error) {
      console.error('Error copying URL:', error)
      alert('❌ URLのコピーに失敗しました')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoaderIcon className="w-12 h-12 animate-spin text-pink-600 mx-auto mb-4" />
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
          <Link href="/dashboard">
            <Button className="mt-4">ダッシュボードに戻る</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <span>戻る</span>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {interview.title}
                </h1>
                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mt-1">
                  <span>取材先: {interview.intervieweeName} ({interview.intervieweeCompany})</span>
                  <span>•</span>
                  <span>インタビュアー: {interview.interviewerName}</span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">取材データ確認・記事制作</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {shareUrl ? (
                <>
                  <Button
                    onClick={handleCopyUrl}
                    variant="outline"
                    size="sm"
                  >
                    <CopyIcon className="w-4 h-4 mr-2" />
                    {urlCopied ? 'コピーしました！' : 'URLを発行'}
                  </Button>
                  <Button
                    onClick={handleRegenerateShareUrl}
                    variant="outline"
                    size="sm"
                  >
                    <ShareIcon className="w-4 h-4 mr-2" />
                    URL再発行
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleGenerateShareUrl}
                  variant="outline"
                  size="sm"
                >
                  <ShareIcon className="w-4 h-4 mr-2" />
                  URLを発行
                </Button>
              )}
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                interview.status === 'active' 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                  : interview.status === 'paused'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
              }`}>
                {interview.status === 'active' ? '進行中' : interview.status === 'paused' ? '一時停止' : '完了'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Data View */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* 取材データ確認・記事制作画面 */}
          <div className="space-y-6">
              {/* データ種別の確認 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileTextIcon className="w-5 h-5" />
                    取材データの種類
                  </CardTitle>
                  <CardDescription>
                    このインタビューで記録されたデータの種類を確認できます
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* テキストデータ */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileTextIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">テキストデータ</h3>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        会話履歴（メッセージ）が記録されています
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                          {interview.messages?.length || 0} 件のメッセージ
                        </Badge>
                        {interview.rehearsalMessages && interview.rehearsalMessages.length > 0 && (
                          <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                            リハーサル: {interview.rehearsalMessages.length} 件
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* 録音データ */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">録音データ</h3>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {interview.audioUrl || interview.recordingUrl
                          ? '録音ファイルが保存されています'
                          : '録音データは保存されていません（テキストのみ）'}
                      </p>
                      {interview.audioUrl || interview.recordingUrl ? (
                        <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                          録音あり
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700">
                          テキストのみ
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 会話履歴（テキスト） */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <MessageSquareIcon className="w-5 h-5" />
                        会話履歴（テキスト）
                      </CardTitle>
                      <CardDescription>
                        インタビューで記録されたすべての会話を確認できます
                      </CardDescription>
                    </div>
                    {(interview.messages?.length > 0 || interview.rehearsalMessages?.length > 0) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          // 会話履歴をテキストファイルとしてダウンロード
                          const allMessages = [
                            ...(interview.messages || []),
                            ...(interview.rehearsalMessages || [])
                          ]
                          const text = allMessages
                            .map((msg: any) => {
                              const role = msg.role === 'interviewer' ? 'インタビュアー' : '回答者'
                              return `[${role}]\n${msg.content}\n`
                            })
                            .join('\n---\n\n')
                          
                          const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
                          const url = URL.createObjectURL(blob)
                          const a = document.createElement('a')
                          a.href = url
                          a.download = `${interview.title || 'interview'}_transcript_${new Date().toISOString().split('T')[0]}.txt`
                          a.click()
                          URL.revokeObjectURL(url)
                        }}
                      >
                        <DownloadIcon className="w-4 h-4 mr-2" />
                        テキストをダウンロード
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {interview.messages && interview.messages.length > 0 ? (
                      interview.messages.map((msg: any, idx: number) => (
                        <div
                          key={msg.id || idx}
                          className={`p-4 rounded-lg border ${
                            msg.role === 'interviewer'
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                              : 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {msg.role === 'interviewer' ? interview.interviewerName || 'インタビュアー' : '回答者'}
                            </span>
                            {msg.timestamp && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {new Date(msg.timestamp.seconds ? msg.timestamp.seconds * 1000 : msg.timestamp).toLocaleString('ja-JP')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>
                      ))
                    ) : interview.rehearsalMessages && interview.rehearsalMessages.length > 0 ? (
                      interview.rehearsalMessages.map((msg: any, idx: number) => (
                        <div
                          key={idx}
                          className={`p-4 rounded-lg border ${
                            msg.role === 'interviewer'
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                              : 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {msg.role === 'interviewer' ? interview.interviewerName || 'インタビュアー' : '回答者'}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              リハーサル
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <FileTextIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>会話履歴がありません</p>
                        <p className="text-sm mt-2">インタビューまたはリハーサルを実行すると、ここに会話履歴が表示されます</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 記事制作への導線 */}
              {(interview.messages?.length > 0 || interview.rehearsalMessages?.length > 0) && (
                <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileTextIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                      記事制作
                    </CardTitle>
                    <CardDescription>
                      取材データから記事を生成できます
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-green-200 dark:border-green-800">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">利用可能なデータ</h4>
                      <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <li>✓ 会話履歴（テキスト）: {interview.messages?.length || 0} 件</li>
                        {interview.rehearsalMessages && interview.rehearsalMessages.length > 0 && (
                          <li>✓ リハーサル会話履歴: {interview.rehearsalMessages.length} 件</li>
                        )}
                        {interview.audioUrl || interview.recordingUrl ? (
                          <li>✓ 録音ファイル: あり</li>
                        ) : (
                          <li className="text-gray-400">- 録音ファイル: なし（テキストのみ）</li>
                        )}
                      </ul>
                    </div>
                    <Button
                      onClick={() => {
                        // 会話履歴をQA形式に変換して記事生成ページに遷移
                        const allMessages = [
                          ...(interview.messages || []),
                          ...(interview.rehearsalMessages || [])
                        ]
                        
                        // 質問と回答をペアにする
                        const qaPairs: Array<{ question: string, answer: string }> = []
                        let currentQuestion = ''
                        
                        allMessages.forEach((msg: any) => {
                          if (msg.role === 'interviewer') {
                            currentQuestion = msg.content
                          } else if (msg.role === 'interviewee' && currentQuestion) {
                            qaPairs.push({
                              question: currentQuestion,
                              answer: msg.content
                            })
                            currentQuestion = ''
                          }
                        })
                        
                        // 記事作成ページに遷移
                        router.push(`/dashboard/articles/new?interviewId=${interviewId}`)
                      }}
                      className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                      size="lg"
                    >
                      <FileTextIcon className="w-5 h-5 mr-2" />
                      この取材データから記事を制作する
                    </Button>
                  </CardContent>
                </Card>
              )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InterviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoaderIcon className="w-12 h-12 animate-spin text-pink-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    }>
      <InterviewPageContent />
    </Suspense>
  )
}

