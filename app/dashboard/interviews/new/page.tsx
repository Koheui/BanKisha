'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { getFirebaseDb } from '@/src/lib/firebase'
import { collection, addDoc, updateDoc, serverTimestamp, query, where, getDocs, orderBy, doc, getDoc, setDoc } from 'firebase/firestore'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon, MicIcon, SparklesIcon, UserIcon, BuildingIcon, UsersIcon, LoaderIcon, RefreshCwIcon, CheckCircleIcon, ChevronUpIcon, ChevronDownIcon, PlusIcon, XIcon, GripVerticalIcon } from 'lucide-react'
import Link from 'next/link'
import { InterviewerProfile } from '@/src/types'
import { getSkillKnowledgeBases } from '@/src/lib/firestore'
import { Textarea } from '@/components/ui/textarea'

// 質問テキストを配列にパースする関数
const parseQuestionsFromText = (questionsText: string): string[] => {
  if (!questionsText || !questionsText.trim()) return []
  
  const lines = questionsText.split('\n').filter(line => line.trim())
  const questions: string[] = []
  
  for (const line of lines) {
    const trimmed = line.trim()
    // 番号（1. 2. など）を除去
    const cleaned = trimmed.replace(/^\d+[\.\)、]\s*/, '').trim()
    if (cleaned && cleaned.length > 0) {
      questions.push(cleaned)
    }
  }
  
  return questions.length > 0 ? questions : [questionsText.trim()]
}

function NewInterviewPageContent() {
  const { user } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [interviewId, setInterviewId] = useState<string | undefined>(searchParams?.get('id') || undefined)
  const isEditMode = !!interviewId

  // URLパラメータが変更されたときに状態を更新
  useEffect(() => {
    const id = searchParams?.get('id') || undefined
    setInterviewId(id)
  }, [searchParams])
  
  const [title, setTitle] = useState('')
  const [intervieweeName, setIntervieweeName] = useState('')
  const [confirmNameAtInterview, setConfirmNameAtInterview] = useState(false) // 名前をインタビュー時に確認するかどうか
  const [intervieweeCompany, setIntervieweeCompany] = useState('')
  const [confirmCompanyAtInterview, setConfirmCompanyAtInterview] = useState(false) // 会社名をインタビュー時に確認するかどうか
  const [intervieweeTitle, setIntervieweeTitle] = useState('') // 役職名
  const [confirmTitleAtInterview, setConfirmTitleAtInterview] = useState(false) // 役職名をインタビュー時に確認するかどうか
  const [intervieweeDepartment, setIntervieweeDepartment] = useState('') // 部署名
  const [confirmDepartmentAtInterview, setConfirmDepartmentAtInterview] = useState(false) // 部署名をインタビュー時に確認するかどうか
  const [intervieweeType, setIntervieweeType] = useState<'company' | 'individual'>('company') // 企業・団体 or 個人
  const [isMultiple, setIsMultiple] = useState(false)
  const [category, setCategory] = useState('') // インタビューのカテゴリ
  const [customCategory, setCustomCategory] = useState('') // カスタムカテゴリ
  const [targetAudience, setTargetAudience] = useState('') // ターゲット読者
  const [mediaType, setMediaType] = useState('') // 掲載メディア
  const [interviewPurpose, setInterviewPurpose] = useState('') // 取材の目的
  const [objective, setObjective] = useState('') // 具体的な質問を箇条書き
  const [selectedInterviewerId, setSelectedInterviewerId] = useState('')
  const [interviewers, setInterviewers] = useState<InterviewerProfile[]>([])
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false) // 保存中の状態
  const [loadingInterviewers, setLoadingInterviewers] = useState(true)
  const [loadingInterview, setLoadingInterview] = useState(isEditMode)
  const [showQuestionGeneration, setShowQuestionGeneration] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState<string>('')
  const [questionExplanation, setQuestionExplanation] = useState<string>('')
  const [questionsConfirmed, setQuestionsConfirmed] = useState(false) // 質問が確定されたかどうか
  const [questionsList, setQuestionsList] = useState<string[]>([])
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [selectedInterviewer, setSelectedInterviewer] = useState<InterviewerProfile | null>(null)

  useEffect(() => {
    if (user?.companyId) {
      loadInterviewers()
    }
  }, [user])

  useEffect(() => {
    if (isEditMode && interviewId && user?.companyId) {
      loadInterview()
    }
  }, [isEditMode, interviewId, user])

  const loadInterviewers = async () => {
    if (!user?.companyId) return

    try {
      setLoadingInterviewers(true)
      const q = query(
        collection(getFirebaseDb(), 'interviewers'),
        where('companyId', '==', user.companyId),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      )
      const snapshot = await getDocs(q)
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date()
      } as InterviewerProfile))
      setInterviewers(data)
      
      // デフォルトで最初のインタビュアーを選択（編集モードでない場合のみ）
      if (data.length > 0 && !isEditMode) {
        setSelectedInterviewerId(data[0].id)
        setSelectedInterviewer(data[0])
      }
    } catch (error) {
      console.error('Error loading interviewers:', error)
    } finally {
      setLoadingInterviewers(false)
    }
  }

  const loadInterview = async () => {
    if (!interviewId || !user?.companyId) return

    try {
      setLoadingInterview(true)
      const firestoreDb = getFirebaseDb()
      const interviewDoc = await getDoc(doc(firestoreDb, 'interviews', interviewId))
      
      if (interviewDoc.exists()) {
        const data = interviewDoc.data()
        setTitle(data.title || '')
        setIntervieweeName(data.intervieweeName || '')
        setConfirmNameAtInterview(data.confirmNameAtInterview || false)
        setIntervieweeCompany(data.intervieweeCompany || '')
        setConfirmCompanyAtInterview(data.confirmCompanyAtInterview || false)
        setIntervieweeTitle(data.intervieweeTitle || '')
        setConfirmTitleAtInterview(data.confirmTitleAtInterview || false)
        setIntervieweeDepartment(data.intervieweeDepartment || '')
        setConfirmDepartmentAtInterview(data.confirmDepartmentAtInterview || false)
        setIntervieweeType(data.intervieweeType || 'company')
        setIsMultiple(data.isMultipleInterviewees || false)
        // カテゴリが定義済みのリストにない場合は、カスタムカテゴリとして扱う
        const predefinedCategories = ['business', 'technology', 'lifestyle', 'career', 'education', 'health', 'entertainment', 'sports', 'food', 'fashion', 'travel', 'real-estate', 'finance', 'parenting', 'hobby', 'society', 'environment', 'local', 'other']
        if (data.category && !predefinedCategories.includes(data.category)) {
          setCustomCategory(data.category)
          setCategory('custom')
        } else {
          setCategory(data.category || '')
          setCustomCategory('')
        }
        setTargetAudience(data.targetAudience || '')
        setMediaType(data.mediaType || '')
        setInterviewPurpose(data.interviewPurpose || '')
        setObjective(data.objective || '')
        setSelectedInterviewerId(data.interviewerId || '')
        
        // 質問を読み込む
        if (data.questions) {
          setGeneratedQuestions(data.questions)
          const parsed = parseQuestionsFromText(data.questions)
          setQuestionsList(parsed)
          // 質問が既にある場合は質問生成セクションを表示
          if (parsed.length > 0) {
            setShowQuestionGeneration(true)
          }
        }
        
        // インタビュアーを設定（インタビュアーリストが読み込まれた後）
        if (data.interviewerId && interviewers.length > 0) {
          const interviewer = interviewers.find(i => i.id === data.interviewerId)
          if (interviewer) {
            setSelectedInterviewer(interviewer)
          }
        }
      } else {
        alert('⚠️ インタビューが見つかりません')
        router.push('/dashboard/interviews')
      }
    } catch (error) {
      console.error('Error loading interview:', error)
      alert('❌ インタビューの読み込みに失敗しました')
    } finally {
      setLoadingInterview(false)
    }
  }

  // インタビュアーリストが読み込まれた後、編集モードの場合はインタビュアーを設定
  useEffect(() => {
    if (isEditMode && interviewId && interviewers.length > 0 && selectedInterviewerId && !selectedInterviewer) {
      const interviewer = interviewers.find(i => i.id === selectedInterviewerId)
      if (interviewer) {
        setSelectedInterviewer(interviewer)
      }
    }
  }, [interviewers, selectedInterviewerId, isEditMode, interviewId, selectedInterviewer])

  // インタビュアーが読み込まれた後、新規作成モードでまだ選択されていない場合は自動選択
  useEffect(() => {
    if (!isEditMode && !loadingInterviewers && interviewers.length > 0 && !selectedInterviewerId) {
      console.log('Auto-selecting interviewer:', interviewers[0].id)
      setSelectedInterviewerId(interviewers[0].id)
      setSelectedInterviewer(interviewers[0])
    }
  }, [interviewers, loadingInterviewers, isEditMode, selectedInterviewerId])

  const handleGenerateQuestionsWithKnowledge = async () => {
    // インタビューが保存されていない場合は、先に保存を促す
    if (!interviewId) {
      alert('⚠️ 質問を生成する前に、まず「インタビュー情報を保存」ボタンを押して保存してください。')
      return
    }

    // インタビュアーを取得
    const currentInterviewer = interviewers.find(i => i.id === selectedInterviewerId)
    if (!currentInterviewer) {
      alert('⚠️ インタビュアーを選択してください')
      return
    }
    
    // 最低限の必須項目をチェック（カテゴリは任意）
    if (!targetAudience.trim() && !mediaType.trim() && !interviewPurpose.trim() && !objective.trim()) {
      alert('⚠️ 質問を生成するには、ターゲット読者、掲載メディア、取材の目的、具体的な質問のいずれか1つ以上を入力してください')
      return
    }

    try {
      setLoadingQuestions(true)
      setShowQuestionGeneration(true)

      // スキルナレッジベースを取得
      const skillKBs = await getSkillKnowledgeBases()
      const knowledgeBaseIds = skillKBs.map(kb => kb.id)
      
      console.log('📚 スキルナレッジベース:', knowledgeBaseIds.length, '個')

      const response = await fetch('/api/interview/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interviewId: interviewId,
          category: category === 'custom' ? customCategory : category,
          targetAudience: targetAudience.trim(),
          mediaType: mediaType.trim(),
          interviewPurpose: interviewPurpose.trim(),
          objective: objective.trim(), // 具体的な質問を箇条書き
          interviewerPrompt: currentInterviewer.prompt || '',
          knowledgeBaseIds: knowledgeBaseIds,
          intervieweeName: intervieweeName,
          intervieweeCompany: intervieweeCompany,
          intervieweeTitle: intervieweeTitle,
          intervieweeDepartment: intervieweeDepartment,
          intervieweeType: intervieweeType,
          confirmNameAtInterview: confirmNameAtInterview,
          confirmCompanyAtInterview: confirmCompanyAtInterview,
          confirmTitleAtInterview: confirmTitleAtInterview,
          confirmDepartmentAtInterview: confirmDepartmentAtInterview,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '質問の生成に失敗しました')
      }

      const data = await response.json()
      setGeneratedQuestions(data.questions)
      setQuestionExplanation(data.explanation || '')
      
      // 質問をパースして配列に変換
      const parsedQuestions = parseQuestionsFromText(data.questions)
      setQuestionsList(parsedQuestions)
    } catch (error) {
      console.error('Error generating questions:', error)
      alert('❌ 質問の生成に失敗しました: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setLoadingQuestions(false)
    }
  }

  // 保存のみを行う関数（質問生成前）
  const handleSave = async () => {
    // 最低限の必須項目のみチェック
    if (!title.trim()) {
      alert('⚠️ タイトルを入力してください')
      return
    }

    if (!selectedInterviewerId) {
      alert('⚠️ インタビュアーを選択してください')
      return
    }

    if (!user || !user.companyId) {
      alert('⚠️ ユーザー情報が取得できません')
      return
    }

    if (interviewers.length === 0) {
      alert('⚠️ インタビュアーが登録されていません。インタビュアー設定で登録してください。')
      return
    }

    try {
      setSaving(true)

      const selectedInterviewer = interviewers.find(i => i.id === selectedInterviewerId)
      if (!selectedInterviewer) {
        alert('⚠️ 選択されたインタビュアーが見つかりません')
        return
      }

      const interviewData = {
        companyId: user.companyId,
        interviewerId: selectedInterviewerId,
        interviewerName: selectedInterviewer.name,
        interviewerRole: selectedInterviewer.role,
        mode: 'voice' as const,
        title: title.trim(),
        intervieweeName: intervieweeName.trim() || '',
        confirmNameAtInterview: confirmNameAtInterview,
        intervieweeCompany: intervieweeCompany.trim() || '',
        confirmCompanyAtInterview: confirmCompanyAtInterview,
        intervieweeTitle: intervieweeTitle.trim() || '',
        confirmTitleAtInterview: confirmTitleAtInterview,
        intervieweeDepartment: intervieweeDepartment.trim() || '',
        confirmDepartmentAtInterview: confirmDepartmentAtInterview,
        intervieweeType: intervieweeType,
        isMultipleInterviewees: isMultiple,
        category: category === 'custom' ? customCategory : category,
        targetAudience: targetAudience.trim(),
        mediaType: mediaType.trim(),
        interviewPurpose: interviewPurpose.trim(),
        objective: objective.trim(),
        status: 'active' as const,
        updatedAt: serverTimestamp(),
      }

      if (interviewId) {
        // 編集モード：更新
        await updateDoc(doc(getFirebaseDb(), 'interviews', interviewId), interviewData)
        alert('✅ インタビュー情報を保存しました！')
      } else {
        // 新規作成モード
        const newInterviewRef = doc(collection(getFirebaseDb(), 'interviews'))
        await setDoc(newInterviewRef, {
          ...interviewData,
          createdAt: serverTimestamp(),
        })
        const newInterviewId = newInterviewRef.id
        alert('✅ インタビュー情報を保存しました！')
        // 状態を更新
        setInterviewId(newInterviewId)
        // URLを更新して編集モードに切り替え
        router.replace(`/dashboard/interviews/new?id=${newInterviewId}`, { scroll: false })
      }
    } catch (error) {
      console.error('Error saving interview:', error)
      alert('❌ 保存に失敗しました: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async () => {
    // 最低限の必須項目のみチェック
    if (!title.trim()) {
      alert('⚠️ タイトルを入力してください')
      return
    }

    if (!selectedInterviewerId) {
      alert('⚠️ インタビュアーを選択してください')
      return
    }

    if (!user || !user.companyId) {
      alert('⚠️ ユーザー情報が取得できません')
      return
    }

    if (interviewers.length === 0) {
      alert('⚠️ インタビュアーが登録されていません。インタビュアー設定で登録してください。')
      return
    }

    try {
      setCreating(true)

      const selectedInterviewer = interviewers.find(i => i.id === selectedInterviewerId)
      if (!selectedInterviewer) {
        alert('⚠️ 選択されたインタビュアーが見つかりません')
        return
      }

      const interviewData = {
        companyId: user.companyId,
        interviewerId: selectedInterviewerId,
        interviewerName: selectedInterviewer.name,
        interviewerRole: selectedInterviewer.role,
        mode: 'voice' as const, // 基本的に音声形式
        title: title.trim(),
        intervieweeName: intervieweeName.trim(),
        confirmNameAtInterview: confirmNameAtInterview,
        intervieweeCompany: intervieweeCompany.trim(),
        confirmCompanyAtInterview: confirmCompanyAtInterview,
        intervieweeTitle: intervieweeTitle.trim(),
        confirmTitleAtInterview: confirmTitleAtInterview,
        intervieweeDepartment: intervieweeDepartment.trim(),
        confirmDepartmentAtInterview: confirmDepartmentAtInterview,
        intervieweeType: intervieweeType,
        isMultipleInterviewees: isMultiple,
        category: category === 'custom' ? customCategory : category,
        targetAudience: targetAudience.trim(),
        mediaType: mediaType.trim(),
        interviewPurpose: interviewPurpose.trim(),
        objective: objective.trim(), // 具体的な質問を箇条書き
        questions: questionsList.length > 0 
          ? questionsList.map((q, i) => `${i + 1}. ${q}`).join('\n')
          : (generatedQuestions.trim() || undefined), // 生成された質問があれば保存
        updatedAt: serverTimestamp(),
      }

      if (isEditMode && interviewId) {
        // 編集モード：更新
        await updateDoc(doc(getFirebaseDb(), 'interviews', interviewId), interviewData)
        alert('✅ インタビューを更新しました！')
        // リハーサルページに遷移
        router.push(`/dashboard/interviews/${interviewId}/rehearsal`)
      } else {
        // 新規作成モード
        const newInterviewData = {
          ...interviewData,
          status: 'active',
          messages: [],
          createdAt: serverTimestamp(),
        }
        const docRef = await addDoc(collection(getFirebaseDb(), 'interviews'), newInterviewData)
        alert('✅ インタビューを作成しました！')
        // リハーサルページに遷移
        router.push(`/dashboard/interviews/${docRef.id}/rehearsal`)
      }
    } catch (error) {
      console.error('Error saving interview:', error)
      alert(`❌ インタビューの${isEditMode ? '更新' : '作成'}に失敗しました`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/interviews"
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <span>戻る</span>
              </Link>
              <div className="flex items-center gap-3">
                <MicIcon className="w-8 h-8 text-pink-600 dark:text-pink-400" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {isEditMode ? 'インタビュー編集' : '新規インタビュー作成'}
                </h1>
              </div>
            </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          {(loadingInterviewers || loadingInterview) ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
            </div>
          ) : interviewers.length === 0 ? (
            <div className="text-center py-12">
              <UserIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                インタビュアーが登録されていません
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-6">
                先にインタビュアーを登録してください
              </p>
              <Link href="/dashboard/interviewer">
                <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white">
                  <UserIcon className="w-4 h-4 mr-2" />
                  インタビュアー設定に移動
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  <SparklesIcon className="w-4 h-4 inline mr-1" />
                  タイトル *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例：新サービス開発秘話インタビュー"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Interviewee Name */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                    <UserIcon className="w-4 h-4 inline mr-1" />
                    取材先方の名前 {!confirmNameAtInterview && '*'}
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmNameAtInterview}
                      onChange={(e) => setConfirmNameAtInterview(e.target.checked)}
                      className="w-4 h-4 text-pink-600 focus:ring-pink-500 rounded"
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400">インタビュー時に確認</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={intervieweeName}
                  onChange={(e) => setIntervieweeName(e.target.value)}
                  placeholder="例：山田太郎"
                  disabled={confirmNameAtInterview}
                  className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${confirmNameAtInterview ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
              </div>

              {/* Interviewee Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  <BuildingIcon className="w-4 h-4 inline mr-1" />
                  取材先の種類 *
                </label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={intervieweeType === 'company'}
                      onChange={() => setIntervieweeType('company')}
                      className="w-4 h-4 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-sm text-gray-900 dark:text-gray-100">企業・団体</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={intervieweeType === 'individual'}
                      onChange={() => setIntervieweeType('individual')}
                      className="w-4 h-4 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-sm text-gray-900 dark:text-gray-100">個人</span>
                  </label>
                </div>
              </div>

              {/* Company Name (企業・団体の場合のみ) */}
              {intervieweeType === 'company' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                      <BuildingIcon className="w-4 h-4 inline mr-1" />
                      会社名・団体名 {!confirmCompanyAtInterview && '*'}
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmCompanyAtInterview}
                        onChange={(e) => setConfirmCompanyAtInterview(e.target.checked)}
                        className="w-4 h-4 text-pink-600 focus:ring-pink-500 rounded"
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">インタビュー時に確認</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={intervieweeCompany}
                    onChange={(e) => setIntervieweeCompany(e.target.value)}
                    placeholder="例：株式会社サンプル"
                    disabled={confirmCompanyAtInterview}
                    className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${confirmCompanyAtInterview ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
              )}

              {/* Department (企業・団体の場合のみ) */}
              {intervieweeType === 'company' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                      <BuildingIcon className="w-4 h-4 inline mr-1" />
                      部署名
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmDepartmentAtInterview}
                        onChange={(e) => setConfirmDepartmentAtInterview(e.target.checked)}
                        className="w-4 h-4 text-pink-600 focus:ring-pink-500 rounded"
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">インタビュー時に確認</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={intervieweeDepartment}
                    onChange={(e) => setIntervieweeDepartment(e.target.value)}
                    placeholder="例：営業部、開発部など（任意）"
                    disabled={confirmDepartmentAtInterview}
                    className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${confirmDepartmentAtInterview ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
              )}

              {/* Title (役職名) - 企業・団体の場合のみ */}
              {intervieweeType === 'company' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
                      <UserIcon className="w-4 h-4 inline mr-1" />
                      役職名
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmTitleAtInterview}
                        onChange={(e) => setConfirmTitleAtInterview(e.target.checked)}
                        className="w-4 h-4 text-pink-600 focus:ring-pink-500 rounded"
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">インタビュー時に確認</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={intervieweeTitle}
                    onChange={(e) => setIntervieweeTitle(e.target.value)}
                    placeholder="例：代表取締役、部長、マネージャーなど（任意）"
                    disabled={confirmTitleAtInterview}
                    className={`w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${confirmTitleAtInterview ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
              )}

              {/* Multiple Interviewees */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                  <UsersIcon className="w-4 h-4 inline mr-1" />
                  取材対象
                </label>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!isMultiple}
                      onChange={() => setIsMultiple(false)}
                      className="w-4 h-4 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-sm text-gray-900 dark:text-gray-100">1名</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={isMultiple}
                      onChange={() => setIsMultiple(true)}
                      className="w-4 h-4 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-sm text-gray-900 dark:text-gray-100">複数名</span>
                  </label>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  カテゴリ（メディアサイトのカテゴリ）
                </label>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value)
                    if (e.target.value !== 'custom') {
                      setCustomCategory('')
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">カテゴリを選択してください（任意）</option>
                  <option value="business">ビジネス・起業</option>
                  <option value="technology">テクノロジー・IT</option>
                  <option value="lifestyle">ライフスタイル</option>
                  <option value="career">キャリア・転職</option>
                  <option value="education">教育・学習</option>
                  <option value="health">健康・医療</option>
                  <option value="entertainment">エンターテインメント</option>
                  <option value="sports">スポーツ</option>
                  <option value="food">グルメ・料理</option>
                  <option value="fashion">ファッション・美容</option>
                  <option value="travel">旅行・観光</option>
                  <option value="real-estate">不動産</option>
                  <option value="finance">金融・投資</option>
                  <option value="parenting">子育て・教育</option>
                  <option value="hobby">趣味・娯楽</option>
                  <option value="society">社会・政治</option>
                  <option value="environment">環境・サステナビリティ</option>
                  <option value="local">ローカル</option>
                  <option value="custom">その他（カスタム）</option>
                </select>
                {category === 'custom' && (
                  <input
                    type="text"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="カスタムカテゴリを入力してください"
                    className="w-full mt-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                )}
              </div>

              {/* Target Audience */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  ターゲットである読者はどんな人ですか？ *
                </label>
                <textarea
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="例：20代〜30代のビジネスパーソン、スタートアップ経営者、技術者など"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Media Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  どのようなメディアに掲載しますか？ *
                </label>
                <textarea
                  value={mediaType}
                  onChange={(e) => setMediaType(e.target.value)}
                  placeholder="例：Webメディア、雑誌、ブログ、SNSなど"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Interview Purpose */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  取材の目的 *
                </label>
                <textarea
                  value={interviewPurpose}
                  onChange={(e) => setInterviewPurpose(e.target.value)}
                  placeholder="例：新サービスの開発背景や苦労した点、今後の展望を伝えるため"
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Objective - 具体的な質問を箇条書き */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  取材で聞きたいこと（具体的な質問を箇条書きにしてください） *
                </label>
                <textarea
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="例：&#10;1. 新サービスの開発背景&#10;2. 開発で苦労した点&#10;3. 今後の展望"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                {/* 保存ボタン */}
                <div className="mt-3">
                  <Button
                    onClick={handleSave}
                    disabled={
                      saving || 
                      loadingInterviewers ||
                      !title.trim() || 
                      !selectedInterviewerId ||
                      interviewers.length === 0
                    }
                    variant="outline"
                    size="sm"
                    className="w-full"
                    title={
                      loadingInterviewers ? 'インタビュアーを読み込み中...' :
                      interviewers.length === 0 ? 'インタビュアーが登録されていません。インタビュアー設定で登録してください。' :
                      !title.trim() ? 'タイトルを入力してください' :
                      !selectedInterviewerId ? 'インタビュアーを選択してください' :
                      ''
                    }
                  >
                    {saving ? (
                      <>
                        <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="w-4 h-4 mr-2" />
                        インタビュー情報を保存
                      </>
                    )}
                  </Button>
                  {interviewers.length === 0 && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                      ⚠️ インタビュアーが登録されていません。
                      <Link href="/dashboard/interviewer" className="underline ml-1">
                        インタビュアー設定
                      </Link>
                      で登録してください。
                    </p>
                  )}
                </div>
                {targetAudience.trim().length > 0 && 
                 mediaType.trim().length > 0 && 
                 interviewPurpose.trim().length > 0 && 
                 objective.trim().length > 20 && 
                 !showQuestionGeneration && (
                  <div className="mt-3">
                    <Button
                      onClick={handleGenerateQuestionsWithKnowledge}
                      disabled={!interviewId}
                      variant="outline"
                      size="sm"
                      className="w-full"
                      title={!interviewId ? '質問を生成するには、まず「インタビュー情報を保存」ボタンを押して保存してください。' : ''}
                    >
                      <SparklesIcon className="w-4 h-4 mr-2" />
                      インタビューを生成
                      {!interviewId && (
                        <span className="ml-2 text-xs text-gray-500">（保存後に有効化）</span>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Question Generation Section */}
              {showQuestionGeneration && (
                <Card className="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>📚 インタビューを生成</span>
                      <Button
                        onClick={handleGenerateQuestionsWithKnowledge}
                        disabled={loadingQuestions || !interviewId}
                        variant="outline"
                        size="sm"
                        title={!interviewId ? '質問を生成するには、まず「インタビュー情報を保存」ボタンを押して保存してください。' : ''}
                      >
                        <RefreshCwIcon className={`w-4 h-4 mr-2 ${loadingQuestions ? 'animate-spin' : ''}`} />
                        {loadingQuestions ? '生成中...' : '再生成'}
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      より良いインタビューを構成します
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loadingQuestions ? (
                      <div className="text-center py-8">
                        <LoaderIcon className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          インタビューを生成中...
                        </p>
                      </div>
                    ) : questionsList.length > 0 ? (
                      <>
                        <div className="space-y-3">
                          {!questionsConfirmed && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              より良いインタビューを構成しました。
                              質問の順序を変更したり、追加・削除・編集ができます。
                            </p>
                          )}
                          {questionsConfirmed && (
                            <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                              ✓ 質問が確定されました。必要に応じて編集できます。
                            </p>
                          )}
                          {questionsList.map((question, index) => (
                            <div key={index} className="flex items-start gap-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                              <div className="flex flex-col gap-1">
                                <Button
                                  onClick={() => {
                                    if (index > 0) {
                                      const newList = [...questionsList]
                                      const temp = newList[index]
                                      newList[index] = newList[index - 1]
                                      newList[index - 1] = temp
                                      setQuestionsList(newList)
                                    }
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  disabled={index === 0}
                                >
                                  <ChevronUpIcon className="w-4 h-4" />
                                </Button>
                                <Button
                                  onClick={() => {
                                    if (index < questionsList.length - 1) {
                                      const newList = [...questionsList]
                                      const temp = newList[index]
                                      newList[index] = newList[index + 1]
                                      newList[index + 1] = temp
                                      setQuestionsList(newList)
                                    }
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  disabled={index === questionsList.length - 1}
                                >
                                  <ChevronDownIcon className="w-4 h-4" />
                                </Button>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                    質問 {index + 1}
                                  </span>
                                </div>
                                <Textarea
                                  value={question}
                                  onChange={(e) => {
                                    const newList = [...questionsList]
                                    newList[index] = e.target.value
                                    setQuestionsList(newList)
                                  }}
                                  placeholder="質問を入力..."
                                  rows={2}
                                  className="w-full text-sm"
                                />
                              </div>
                              <Button
                                onClick={() => {
                                  const newList = questionsList.filter((_, i) => i !== index)
                                  setQuestionsList(newList)
                                }}
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              >
                                <XIcon className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            onClick={() => {
                              setQuestionsList([...questionsList, ''])
                            }}
                            variant="outline"
                            size="sm"
                            className="w-full"
                          >
                            <PlusIcon className="w-4 h-4 mr-2" />
                            質問を追加
                          </Button>
                        </div>
                        
                        {!questionsConfirmed && (
                          <div className="flex items-center gap-2 mt-4">
                            <Button
                              onClick={() => {
                                // 質問をテキスト形式に変換して保存
                                const questionsText = questionsList.map((q, i) => `${i + 1}. ${q}`).join('\n')
                                setGeneratedQuestions(questionsText)
                                setQuestionsConfirmed(true)
                                // 解説は表示したままにするため、showQuestionGenerationはfalseにしない
                              }}
                              variant="default"
                              size="sm"
                              className="flex-1"
                            >
                              <CheckCircleIcon className="w-4 h-4 mr-2" />
                              この質問を使用
                            </Button>
                            <Button
                              onClick={() => setShowQuestionGeneration(false)}
                              variant="outline"
                              size="sm"
                            >
                              閉じる
                            </Button>
                          </div>
                        )}
                      </>
                    ) : generatedQuestions ? (
                      <>
                        <Textarea
                          value={generatedQuestions}
                          onChange={(e) => setGeneratedQuestions(e.target.value)}
                          placeholder="生成された質問がここに表示されます"
                          rows={10}
                          className="w-full font-mono text-sm"
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            onClick={() => {
                              const parsed = parseQuestionsFromText(generatedQuestions)
                              setQuestionsList(parsed)
                              setShowQuestionGeneration(true)
                            }}
                            variant="outline"
                            size="sm"
                          >
                            質問を編集モードに切り替え
                          </Button>
                          <Button
                            onClick={() => {
                              setShowQuestionGeneration(false)
                            }}
                            variant="outline"
                            size="sm"
                          >
                            閉じる
                          </Button>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-4">
                        上記の「再生成」ボタンをクリックして質問を生成してください
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* 解説セクション - 質問確定後も表示 */}
              {questionExplanation && (
                <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                  <CardHeader>
                    <CardTitle className="text-lg">
                      💡 質問生成の解説
                    </CardTitle>
                    <CardDescription>
                      専門家としての観点から、質問採用の理由と4つの質問内容への適合性を説明します
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {questionExplanation.split(/\n\n+/).map((paragraph, idx) => {
                        const trimmed = paragraph.trim()
                        if (trimmed.startsWith('## ')) {
                          const title = trimmed.replace(/^##\s+/, '').trim()
                          return (
                            <h3 key={idx} className="text-lg font-bold mt-6 mb-3 text-gray-900 dark:text-gray-100 first:mt-0">
                              {title}
                            </h3>
                          )
                        }
                        if (trimmed.startsWith('### ')) {
                          const title = trimmed.replace(/^###\s+/, '').trim()
                          return (
                            <h4 key={idx} className="text-base font-semibold mt-4 mb-2 text-gray-900 dark:text-gray-100">
                              {title}
                            </h4>
                          )
                        }
                        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                          const items = paragraph.split(/\n/).filter(line => {
                            const t = line.trim()
                            return t.startsWith('- ') || t.startsWith('* ')
                          })
                          return (
                            <ul key={idx} className="list-disc list-inside space-y-2 ml-4">
                              {items.map((item, itemIdx) => {
                                const cleanItem = item.replace(/^[-*]\s+/, '')
                                // 太字と斜体を処理
                                const parts: (string | JSX.Element)[] = []
                                let lastIndex = 0
                                let keyCounter = 0
                                
                                // **太字**を処理
                                const boldRegex = /\*\*(.*?)\*\*/g
                                let match
                                while ((match = boldRegex.exec(cleanItem)) !== null) {
                                  if (match.index > lastIndex) {
                                    parts.push(cleanItem.substring(lastIndex, match.index))
                                  }
                                  parts.push(<strong key={`bold-${keyCounter++}`} className="font-semibold">{match[1]}</strong>)
                                  lastIndex = match.index + match[0].length
                                }
                                if (lastIndex < cleanItem.length) {
                                  parts.push(cleanItem.substring(lastIndex))
                                }
                                
                                return (
                                  <li key={itemIdx} className="text-sm">
                                    {parts.length > 0 ? parts : cleanItem}
                                  </li>
                                )
                              })}
                            </ul>
                          )
                        }
                        // 通常の段落
                        const parts: (string | JSX.Element)[] = []
                        let lastIndex = 0
                        let keyCounter = 0
                        
                        // **太字**を処理
                        const boldRegex = /\*\*(.*?)\*\*/g
                        let match
                        while ((match = boldRegex.exec(paragraph)) !== null) {
                          if (match.index > lastIndex) {
                            parts.push(paragraph.substring(lastIndex, match.index))
                          }
                          parts.push(<strong key={`bold-${keyCounter++}`} className="font-semibold">{match[1]}</strong>)
                          lastIndex = match.index + match[0].length
                        }
                        if (lastIndex < paragraph.length) {
                          parts.push(paragraph.substring(lastIndex))
                        }
                        
                        return (
                          <p key={idx} className="leading-relaxed">
                            {parts.length > 0 ? parts : paragraph}
                          </p>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Interviewer Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  <MicIcon className="w-4 h-4 inline mr-1" />
                  インタビュアー *
                </label>
                <select
                  value={selectedInterviewerId || ''}
                  onChange={(e) => {
                    const interviewer = interviewers.find(i => i.id === e.target.value)
                    setSelectedInterviewerId(e.target.value)
                    setSelectedInterviewer(interviewer || null)
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  {interviewers.length === 0 ? (
                    <option value="">インタビュアーが登録されていません</option>
                  ) : !selectedInterviewerId && interviewers.length > 0 ? (
                    <option value="">インタビュアーを選択してください</option>
                  ) : null}
                  {interviewers.map((interviewer) => (
                    <option key={interviewer.id} value={interviewer.id}>
                      {interviewer.name} ({interviewer.role})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                  インタビュアーは
                  <Link href="/dashboard/interviewer" className="text-indigo-600 hover:underline ml-1">
                    インタビュアー設定
                  </Link>
                  で管理できます
                </p>
              </div>

              {/* Info Card */}
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                <CardContent className="pt-6">
                  <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                    🎤 音声インタビューについて
                  </h3>
                  <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
                    <li>• AIインタビュアーが音声で質問を生成します</li>
                    <li>• ナレッジベースの内容を活用して深掘りします</li>
                    <li>• インタビュー後、記事を自動生成できます</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex items-center gap-4">
                <Button
                  onClick={handleCreate}
                  disabled={
                    creating || 
                    loadingInterviewers ||
                    !title.trim() || 
                    !selectedInterviewerId ||
                    interviewers.length === 0
                  }
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                  title={
                    loadingInterviewers ? 'インタビュアーを読み込み中...' :
                    interviewers.length === 0 ? 'インタビュアーが登録されていません。インタビュアー設定で登録してください。' :
                    !title.trim() ? 'タイトルを入力してください' :
                    !selectedInterviewerId ? 'インタビュアーを選択してください' :
                    ''
                  }
                >
                  {creating ? '保存中...' : isEditMode ? 'インタビューを更新' : 'インタビューを保存'}
                </Button>
                <Link href="/dashboard">
                  <Button variant="outline">
                    キャンセル
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function NewInterviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoaderIcon className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    }>
      <NewInterviewPageContent />
    </Suspense>
  )
}

