'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { getFirebaseDb } from '@/src/lib/firebase'
import { collection, addDoc, updateDoc, serverTimestamp, query, where, getDocs, orderBy, doc, getDoc, setDoc } from 'firebase/firestore'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon, MicIcon, SparklesIcon, UserIcon, BuildingIcon, UsersIcon, LoaderIcon, RefreshCwIcon, CheckCircleIcon, ChevronUpIcon, ChevronDownIcon, PlusIcon, XIcon, GripVerticalIcon, LayoutIcon, TargetIcon, GlobeIcon, FileTextIcon, InfoIcon, MessageSquareIcon, ChevronRightIcon, ChevronLeftIcon, SaveIcon, Volume2Icon, VolumeXIcon } from 'lucide-react'
import Link from 'next/link'
import { InterviewerProfile, KnowledgeBase } from '@/src/types/index'
// スキルナレッジベースはサーバー側で自動取得されるため、インポート不要
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { getCompany } from '@/src/lib/firestore'

// カテゴリIDとラベルのマッピング
const CATEGORY_LABELS: Record<string, string> = {
  'business': 'ビジネス・起業',
  'technology': 'テクノロジー・IT',
  'lifestyle': 'ライフスタイル',
  'career': 'キャリア・転職',
  'education': '教育・学習',
  'health': '健康・医療',
  'entertainment': 'エンターテインメント',
  'sports': 'スポーツ',
  'food': 'グルメ・料理',
  'fashion': 'ファッション・美容',
  'travel': '旅行・観光',
  'real-estate': '不動産',
  'finance': '金融・投資',
  'parenting': '子育て・教育',
  'hobby': '趣味・娯楽',
  'society': '社会・政治',
  'environment': '環境・サステナビリティ',
  'local': 'ローカル',
  'business-news': 'ビジネスニュース',
  'press-release': 'プレスリリース',
  'case-study': '導入事例 (Case Study)',
  'executive': '経営者インタビュー',
  'service-intro': '新サービス紹介',
  'drinking': '飲み会・忘年会',
  'reunion': '同窓会・オフ会',
  'event-promo': 'イベント告知',
  'event-report': 'イベントレポート',
  'community': 'コミュニティ紹介'
}

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
  const [interviewSource, setInterviewSource] = useState<'self' | 'other'>('other') // 自薦・他薦
  const [supplementaryInfo, setSupplementaryInfo] = useState('') // 補足情報
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
  const [openingMessage, setOpeningMessage] = useState<string>('') // 生成されたオープニングメッセージ
  const [openingTemplate, setOpeningTemplate] = useState<string>(`本日はお忙しい中ご対応いただきありがとうございます。
[アカウント名]の[インタビュアー名]と申します。
今回は[インタビュー名]ということで、
[ターゲット]のかたに向けて、
[目的]と考えておりまして、
[媒体]に掲載予定です。
それではさっそくインタビューに入らせていただきます.`)
  const [showOpeningTemplateEditor, setShowOpeningTemplateEditor] = useState(false)
  const [companyName, setCompanyName] = useState<string>('') // 会社名
  const [mediaName, setMediaName] = useState<string>('') // メディア名（表示名）
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [selectedInterviewer, setSelectedInterviewer] = useState<InterviewerProfile | null>(null)
  const [questionCount, setQuestionCount] = useState<number>(10) // 質問数のデフォルト値
  const [showQuestionModal, setShowQuestionModal] = useState(false) // 質問生成モーダルの表示状態
  const [currentStep, setCurrentStep] = useState(1) // 現在のステップ (1-4)
  const [availableKBs, setAvailableKBs] = useState<KnowledgeBase[]>([])
  const [selectedKBIds, setSelectedKBIds] = useState<string[]>([])
  const [loadingKBs, setLoadingKBs] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (user?.companyId) {
      loadInterviewers()
      loadAvailableKBs()
      loadCompanyName()
    }
  }, [user])

  const loadCompanyName = async () => {
    if (!user?.companyId) return
    try {
      const company = await getCompany(user.companyId)
      if (company) {
        setCompanyName(company.name)
        // メディア名が未設定なら会社名を初期値にする
        if (!mediaName) {
          setMediaName(company.name)
        }
      }
    } catch (error) {
      console.error('Error loading company name:', error)
    }
  }

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

  const loadAvailableKBs = async () => {
    if (!user?.companyId) return

    try {
      setLoadingKBs(true)
      const firestoreDb = getFirebaseDb()
      const kbRef = collection(firestoreDb, 'knowledgeBases')

      // ユーザーKB（type: user）かつ、自分がアップロードしたものを取得
      const q = query(
        kbRef,
        where('type', '==', 'user'),
        where('uploadedBy', '==', user.uid),
        orderBy('createdAt', 'desc')
      )

      const snapshot = await getDocs(q)
      const kbs = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date()
        } as KnowledgeBase))
        .filter(kb => !kb.deleted) // 論理削除されていないものを表示

      setAvailableKBs(kbs)
    } catch (error) {
      console.error('Error loading knowledge bases:', error)
    } finally {
      setLoadingKBs(false)
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
        setMediaName(data.mediaName || data.companyName || '')
        setTargetAudience(data.targetAudience || '')
        setMediaType(data.mediaType || '')
        setInterviewPurpose(data.interviewPurpose || '')
        setSupplementaryInfo(data.supplementaryInfo || '')
        setInterviewSource(data.interviewSource || 'other')
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

        // 使用するナレッジベースIDを読み込む
        if (data.knowledgeBaseIds) {
          setSelectedKBIds(data.knowledgeBaseIds)
        }

        // オープニングメッセージを読み込む
        if (data.openingMessage) {
          setOpeningMessage(data.openingMessage)
        }
        if (data.openingTemplate) {
          setOpeningTemplate(data.openingTemplate)
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

    // 最低限の必須項目をチェック
    if (!targetAudience.trim() || !mediaType.trim() || !interviewPurpose.trim()) {
      alert('⚠️ 質問を生成するには、ターゲット読者、掲載メディア、取材の目的をすべて入力してください')
      return
    }

    try {
      setLoadingQuestions(true)
      setShowQuestionGeneration(true)

      if (!user) throw new Error('ログインが必要です')

      // ユーザーナレッジベースのみを送信
      const knowledgeBaseIds = selectedKBIds

      const response = await fetch('/api/interview/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          interviewId: interviewId,
          companyId: user?.companyId,
          title: title.trim(),
          category: category === 'custom' ? customCategory : category,
          targetAudience: targetAudience.trim(),
          mediaType: mediaType.trim(),
          interviewPurpose: interviewPurpose.trim(),
          supplementaryInfo: supplementaryInfo.trim(),
          objective: objective.trim(), // 具体的な質問を箇条書き
          interviewerPrompt: currentInterviewer.prompt || '',
          interviewerName: currentInterviewer.name || '', // インタビュアー名を渡す
          knowledgeBaseIds: knowledgeBaseIds, // ユーザーナレッジベースのIDのみ（スキルはサーバー側で自動取得）
          intervieweeName: intervieweeName,
          intervieweeCompany: intervieweeCompany,
          intervieweeTitle: intervieweeTitle,
          intervieweeDepartment: intervieweeDepartment,
          intervieweeType: intervieweeType,
          confirmNameAtInterview: confirmNameAtInterview,
          confirmCompanyAtInterview: confirmCompanyAtInterview,
          confirmTitleAtInterview: confirmTitleAtInterview,
          confirmDepartmentAtInterview: confirmDepartmentAtInterview,
          interviewSource: interviewSource,
          questionCount: questionCount, // 質問数を追加
          companyName: companyName, // 会社名を渡す
          openingTemplate: openingTemplate,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '質問の生成に失敗しました')
      }

      const data = await response.json()
      setGeneratedQuestions(data.questions)
      setQuestionExplanation(data.explanation || '')
      if (data.openingMessage) {
        setOpeningMessage(data.openingMessage)
      }

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

  // 読み上げ機能（プレミアムTTS）
  const handleReadAloud = async () => {
    if (!openingMessage) return

    // もし既に読み上げ中なら停止
    if (isSpeaking) {
      handleStopReadAloud()
      return
    }

    try {
      setIsSpeaking(true)

      // インタビュアーを取得
      const currentInterviewer = interviewers.find(i => i.id === selectedInterviewerId)
      // 音声設定を取得
      const voiceType = (currentInterviewer as any)?.voiceSettings?.voiceType || 'Puck'
      const speed = (currentInterviewer as any)?.voiceSettings?.speed || (currentInterviewer as any)?.speakingRate || 1.1

      console.log('🎤 Calling TTS API with:', { voiceType, speed })

      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: openingMessage,
          voiceType: voiceType,
          speed: speed,
        }),
      })

      if (!response.ok) {
        throw new Error('音声生成に失敗しました')
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      audioUrlRef.current = audioUrl

      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => {
        setIsSpeaking(false)
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current)
          audioUrlRef.current = null
        }
      }

      audio.onerror = () => {
        setIsSpeaking(false)
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current)
          audioUrlRef.current = null
        }
      }

      await audio.play()
    } catch (error) {
      console.error('Error in handleReadAloud:', error)
      setIsSpeaking(false)
      alert('❌ 音声の再生に失敗しました')
    }
  }


  // 停止機能
  const handleStopReadAloud = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    setIsSpeaking(false)
  }

  // コンポーネントのクリーンアップ時に音声を停止
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current)
      }
    }
  }, [])

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

      const interviewData: any = {
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
        mediaName: mediaName.trim(),
        interviewPurpose: interviewPurpose.trim(),
        interviewSource: interviewSource,
        supplementaryInfo: supplementaryInfo.trim(),
        objective: objective.trim(),
        openingTemplate: openingTemplate.trim(),
        openingMessage: openingMessage.trim(), // オープニングメッセージを保存
        knowledgeBaseIds: selectedKBIds, // ナレッジベースを保存
        status: 'active' as const,
        updatedAt: serverTimestamp(),
      }

      // 質問がある場合のみquestionsフィールドを追加（undefinedを避ける）
      const questionsText = questionsList.length > 0
        ? questionsList.map((q, i) => `${i + 1}. ${q}`).join('\n')
        : (generatedQuestions.trim() || '')
      if (questionsText) {
        interviewData.questions = questionsText
      }

      let targetId = interviewId
      if (interviewId) {
        // 編集モード：更新
        await updateDoc(doc(getFirebaseDb(), 'interviews', interviewId), interviewData)
      } else {
        // 新規作成モード
        const newInterviewRef = doc(collection(getFirebaseDb(), 'interviews'))
        await setDoc(newInterviewRef, {
          ...interviewData,
          createdAt: serverTimestamp(),
        })
        targetId = newInterviewRef.id
        setInterviewId(targetId)
      }

      // 質問があるか確認
      const qText = questionsList.length > 0
        ? questionsList.map((q, i) => `${i + 1}. ${q}`).join('\n')
        : (generatedQuestions.trim() || '')

      if (!qText || qText.trim().length === 0) {
        // 質問がない場合は、モーダルを表示
        setShowQuestionModal(true)
        if (!interviewId) {
          router.replace(`/dashboard/interviews/new?id=${targetId}`, { scroll: false })
        }
      } else {
        // 質問がある場合は、インタビュー詳細ページへ遷移
        router.push(`/dashboard/interviews/${targetId}`)
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

      // 質問を準備（undefinedの場合はフィールドを除外）
      const questionsText = questionsList.length > 0
        ? questionsList.map((q, i) => `${i + 1}. ${q}`).join('\n')
        : (generatedQuestions.trim() || '')

      const interviewData: any = {
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
        mediaName: mediaName.trim(),
        interviewPurpose: interviewPurpose.trim(),
        interviewSource: interviewSource,
        supplementaryInfo: supplementaryInfo.trim(),
        objective: objective.trim(), // 具体的な質問を箇条書き
        openingMessage: openingMessage.trim(), // オープニングメッセージを保存
        updatedAt: serverTimestamp(),
      }

      // 質問がある場合のみquestionsフィールドを追加（undefinedを避ける）
      if (questionsText) {
        interviewData.questions = questionsText
      }

      if (isEditMode && interviewId) {
        // 編集モード：更新
        await updateDoc(doc(getFirebaseDb(), 'interviews', interviewId), interviewData)

        // 質問がない場合は、質問生成を促す
        if (!questionsText || questionsText.trim().length === 0) {
          alert('✅ インタビューを更新しました！\n\n⚠️ 質問が生成されていません。\n「インタビューを生成」ボタンをクリックして質問を生成してください。')
          setShowQuestionGeneration(true)
          return // 質問生成セクションを表示したままにする
        }

        alert('✅ インタビューを更新しました！')
        // インタビュー一覧に戻る
        router.push('/dashboard/interviews')
      } else {
        // 新規作成モード
        const newInterviewData = {
          ...interviewData,
          status: 'active',
          messages: [],
          createdAt: serverTimestamp(),
        }
        const docRef = await addDoc(collection(getFirebaseDb(), 'interviews'), newInterviewData)

        // 質問がない場合は、質問生成を促す
        if (!questionsText || questionsText.trim().length === 0) {
          // インタビューIDを設定して編集モードに切り替え
          setInterviewId(docRef.id)
          router.replace(`/dashboard/interviews/new?id=${docRef.id}`, { scroll: false })
          setShowQuestionGeneration(true)
          alert('✅ インタビューを作成しました！\n\n⚠️ 質問が生成されていません。\n「インタビューを生成」ボタンをクリックして質問を生成してください。')
          return // 質問生成セクションを表示したままにする
        }

        alert('✅ インタビューを作成しました！')
        // インタビュー一覧に戻る
        router.push('/dashboard/interviews')
      }
    } catch (error) {
      console.error('Error saving interview:', error)
      alert(`❌ インタビューの${isEditMode ? '更新' : '作成'}に失敗しました`)
    } finally {
      setCreating(false)
    }
  }

  const handleSkipIntervieweeInfo = () => {
    setConfirmNameAtInterview(true)
    setConfirmCompanyAtInterview(true)
    setConfirmDepartmentAtInterview(true)
    setConfirmTitleAtInterview(true)
    setCurrentStep(4)
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
            <div className="space-y-8">
              {/* Step Indicator */}
              <div className="relative pb-8 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between relative z-10">
                  {[
                    { step: 1, label: '基本設定', icon: MicIcon },
                    { step: 2, label: '執筆方針', icon: TargetIcon },
                    { step: 3, label: '取材先情報', icon: UserIcon },
                    { step: 4, label: '質問構成', icon: SparklesIcon }
                  ].map((item, idx) => (
                    <div key={item.step} className="flex flex-col items-center flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all duration-300 ${currentStep >= item.step
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg scale-110'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                        }`}>
                        <item.icon className="w-5 h-5" />
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${currentStep >= item.step ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'
                        }`}>
                        Step {item.step}
                      </span>
                      <span className={`text-xs mt-1 font-medium ${currentStep === item.step ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500'
                        }`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Connecting Lines */}
                <div className="absolute top-5 left-[12.5%] right-[12.5%] h-0.5 bg-gray-100 dark:bg-gray-800 -z-0">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-500 ease-in-out"
                    style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-6 pt-4">
                {/* Step 1: 基本設定 */}
                {currentStep === 1 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        インタビュー名 *
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="例：新サービス開発秘話インタビュー"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>

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

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                        <UserIcon className="w-4 h-4 inline mr-1" />
                        インタビューの対象 *
                      </label>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-700">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <input
                            type="radio"
                            checked={interviewSource === 'self'}
                            onChange={() => {
                              setInterviewSource('self')
                              if (user) {
                                setIntervieweeName(user.displayName || '')
                                setIntervieweeType('individual')
                              }
                            }}
                            className="w-4 h-4 text-pink-600 focus:ring-pink-500"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-pink-600 transition-colors">自薦（自分が対象）</span>
                            <p className="text-xs text-gray-500 dark:text-gray-400">自分のことについて話す</p>
                          </div>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group border-t sm:border-t-0 sm:border-l border-gray-200 dark:border-gray-700 pt-4 sm:pt-0 sm:pl-8">
                          <input
                            type="radio"
                            checked={interviewSource === 'other'}
                            onChange={() => setInterviewSource('other')}
                            className="w-4 h-4 text-pink-600 focus:ring-pink-500"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-pink-600 transition-colors">他薦（他人に取材）</span>
                            <p className="text-xs text-gray-500 dark:text-gray-400">他の方にインタビューを行う</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <Button
                        onClick={() => setCurrentStep(2)}
                        disabled={!title.trim() || !selectedInterviewerId}
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8"
                      >
                        次へ：執筆方針の設定
                        <ChevronRightIcon className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 3: 取材先情報 */}
                {currentStep === 3 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
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

                    <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <Button
                        variant="ghost"
                        onClick={() => setCurrentStep(2)}
                        className="text-gray-600 dark:text-gray-400 w-full sm:w-auto"
                      >
                        <ChevronLeftIcon className="w-4 h-4 mr-2" />
                        戻る
                      </Button>

                      <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          onClick={handleSkipIntervieweeInfo}
                          className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 w-full sm:w-auto"
                        >
                          あとで入力する
                        </Button>
                        <Button
                          onClick={() => setCurrentStep(4)}
                          disabled={!confirmNameAtInterview && !intervieweeName.trim()}
                          className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 w-full sm:w-auto"
                        >
                          次へ：具体的な質問内容
                          <ChevronRightIcon className="w-4 h-4 ml-2" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: 執筆方針 (Previously placed after Step 3 fields) */}
                {currentStep === 2 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 border-l-4 border-indigo-600 pl-3">
                        目的 *
                      </label>
                      <textarea
                        value={interviewPurpose}
                        onChange={(e) => setInterviewPurpose(e.target.value)}
                        placeholder="例：新サービスの開発背景や苦労した点、今後の展望を伝えるため"
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 border-l-4 border-indigo-600 pl-3">
                        ターゲット *
                      </label>
                      <textarea
                        value={targetAudience}
                        onChange={(e) => setTargetAudience(e.target.value)}
                        placeholder="例：20代〜30代のビジネスパーソン、スタートアップ経営者、技術者など"
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 border-l-4 border-indigo-600 pl-3">
                        媒体 *
                      </label>
                      <textarea
                        value={mediaType}
                        onChange={(e) => setMediaType(e.target.value)}
                        placeholder="例：Webメディア、雑誌、ブログ、SNSなど"
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 border-l-4 border-indigo-600 pl-3">
                        カテゴリ
                      </label>
                      <select
                        value={category}
                        onChange={(e) => {
                          setCategory(e.target.value)
                          if (e.target.value !== 'custom') {
                            setCustomCategory('')
                          }
                        }}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="">カテゴリを選択してください（任意）</option>
                        {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                        <option value="custom">その他（カスタム）</option>
                      </select>
                      {category === 'custom' && (
                        <input
                          type="text"
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                          placeholder="カスタムカテゴリを入力してください"
                          className="w-full mt-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                      )}
                    </div>

                    <div className="pt-4 flex items-center justify-between">
                      <Button
                        variant="ghost"
                        onClick={() => setCurrentStep(1)}
                        className="text-gray-600 dark:text-gray-400"
                      >
                        <ChevronLeftIcon className="w-4 h-4 mr-2" />
                        戻る
                      </Button>
                      <Button
                        onClick={() => setCurrentStep(3)}
                        disabled={!interviewPurpose.trim() || !targetAudience.trim() || !mediaType.trim()}
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8"
                      >
                        次へ：取材先情報の入力
                        <ChevronRightIcon className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Step 4: 質問構成 */}
                {currentStep === 4 && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                    {/* Supplementary Info */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 border-l-4 border-pink-600 pl-3">
                        補足資料・事実関係 {interviewSource === 'self' && <span className="text-pink-600">(重要)</span>}
                      </label>
                      <textarea
                        value={supplementaryInfo}
                        onChange={(e) => setSupplementaryInfo(e.target.value)}
                        placeholder={
                          interviewSource === 'self'
                            ? "【自薦の方へ】開催日時、場所、URL、伝えたい事実関係などを詳しく記載してください。ここに入力された内容はAIが事前に把握するため、インタビューでの重複質問を避けられます。"
                            : "開催日時や住所など詳細情報を記載"
                        }
                        rows={4}
                        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${interviewSource === 'self' ? 'border-pink-200 dark:border-pink-900 ring-1 ring-pink-50/50' : 'border-gray-300 dark:border-gray-600'
                          }`}
                      />
                      {interviewSource === 'self' && (
                        <p className="text-xs text-pink-600 dark:text-pink-400 mt-2">
                          💡 詳細を入力しておくことで、より深く、本質的な会話が楽しめます。
                        </p>
                      )}
                    </div>

                    {/* Knowledge Base Selection */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 border-l-4 border-pink-600 pl-3">
                        参照するナレッジベース（任意）
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 ml-4">
                        特定の業界や技術に関するPDF資料があれば選択してください。より専門的な質問が可能になります。
                      </p>
                      {loadingKBs ? (
                        <div className="flex items-center gap-2 ml-4">
                          <LoaderIcon className="w-4 h-4 animate-spin text-gray-400" />
                          <span className="text-sm text-gray-400">読み込み中...</span>
                        </div>
                      ) : availableKBs.length === 0 ? (
                        <div className="ml-4 p-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-center">
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            登録済みのナレッジベースはありません。<br />
                            <Link href="/dashboard/user-kb" className="text-indigo-600 hover:underline">ナレッジベース設定</Link>からPDFをアップロードできます。
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-4">
                          {availableKBs.map((kb) => (
                            <label
                              key={kb.id}
                              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all ${selectedKBIds.includes(kb.id)
                                ? 'border-pink-500 bg-pink-50/30 dark:bg-pink-900/10 ring-1 ring-pink-500'
                                : 'border-gray-200 dark:border-gray-700 hover:border-pink-300'
                                }`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedKBIds.includes(kb.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedKBIds([...selectedKBIds, kb.id])
                                  } else {
                                    setSelectedKBIds(selectedKBIds.filter(id => id !== kb.id))
                                  }
                                }}
                                className="mt-1 w-4 h-4 text-pink-600 focus:ring-pink-500 rounded"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  {kb.category && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 whitespace-nowrap">
                                      {kb.category}
                                    </Badge>
                                  )}
                                  <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                                    {kb.fileName}
                                  </span>
                                </div>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                                  {kb.summary || kb.fileName}
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Objective - 具体的な質問を箇条書き */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 border-l-4 border-pink-600 pl-3">
                        具体的に聞きたいこと *
                      </label>
                      <textarea
                        value={objective}
                        onChange={(e) => setObjective(e.target.value)}
                        placeholder="例：&#10;1. 新サービスの開発背景&#10;2. 開発で苦労した点&#10;3. 今後の展望"
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    </div>

                    {/* Opening template preview & editor */}
                    <div className="mt-4 space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0 flex items-center">
                          <SparklesIcon className="h-4 w-4 mr-2 text-primary" /> オープニングテンプレート（話す順）
                        </label>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => setShowOpeningTemplateEditor(prev => !prev)}>
                            {showOpeningTemplateEditor ? '閉じる' : '編集'}
                          </Button>
                        </div>
                      </div>

                      {!showOpeningTemplateEditor ? (
                        <div className="bg-white dark:bg-gray-800 p-3 rounded-md text-sm whitespace-pre-wrap border">
                          {openingTemplate
                            .replace(/\[アカウント名\]/g, user?.companyId ? (user?.companyId) : 'BanKisha')
                            .replace(/\[インタビュアー名\]/g, interviewers.find(i => i.id === selectedInterviewerId)?.name || '')
                            .replace(/\[インタビュー名\]/g, title || '')
                            .replace(/\[ターゲット\]/g, targetAudience || '')
                            .replace(/\[目的\]/g, interviewPurpose || '')
                            .replace(/\[媒体\]/g, mediaType || '')
                          }
                        </div>
                      ) : (
                        <textarea
                          className="min-h-[140px] text-sm p-3 leading-relaxed w-full border rounded"
                          value={openingTemplate}
                          onChange={(e) => setOpeningTemplate(e.target.value)}
                        />
                      )}
                      <p className="text-[10px] text-muted-foreground italic">※[] 内はプレースホルダです。編集すると生成時に使用されます。</p>
                    </div>

                    <div className="pt-4 flex items-center justify-between">
                      <Button
                        variant="ghost"
                        onClick={() => setCurrentStep(3)}
                        className="text-gray-600 dark:text-gray-400"
                      >
                        <ChevronLeftIcon className="w-4 h-4 mr-2" />
                        戻る
                      </Button>
                      <Button
                        onClick={handleSave}
                        disabled={saving || !objective.trim()}
                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8"
                      >
                        {saving ? (
                          <>
                            <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                            保存中...
                          </>
                        ) : (
                          <>
                            <SparklesIcon className="w-4 h-4 mr-2" />
                            インタビュー構成を完成させる
                          </>
                        )}
                      </Button>
                    </div>
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
                  <CardContent className="space-y-6">
                    {/* 回答の文脈（コンテキスト）の可視化 */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-purple-200 dark:border-purple-800 p-4 shadow-sm">
                      <h4 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <InfoIcon className="w-3.5 h-3.5" />
                        生成の前提条件（オープニング構成）
                      </h4>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase flex items-center gap-1.5">
                              <BuildingIcon className="w-3 h-3" />
                              表示名 (メディア名等)
                            </label>
                            <input
                              type="text"
                              value={mediaName}
                              onChange={(e) => setMediaName(e.target.value)}
                              className="w-full px-3 py-1.5 text-sm bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg focus:ring-1 focus:ring-indigo-400 outline-none text-indigo-700 dark:text-indigo-300 font-medium"
                              placeholder="表示名を入力..."
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase flex items-center gap-1.5">
                              <FileTextIcon className="w-3 h-3" />
                              インタビュー名
                            </label>
                            <input
                              type="text"
                              value={title}
                              onChange={(e) => setTitle(e.target.value)}
                              className="w-full px-3 py-1.5 text-sm bg-pink-50/50 dark:bg-pink-900/20 border border-pink-100 dark:border-pink-800 rounded-lg focus:ring-1 focus:ring-pink-400 outline-none text-pink-700 dark:text-pink-300 font-medium"
                              placeholder="インタビュー名を入力..."
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase flex items-center gap-1.5">
                              <TargetIcon className="w-3 h-3" />
                              ターゲット
                            </label>
                            <input
                              type="text"
                              value={targetAudience}
                              onChange={(e) => setTargetAudience(e.target.value)}
                              className="w-full px-3 py-1.5 text-sm bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg focus:ring-1 focus:ring-blue-400 outline-none text-blue-700 dark:text-blue-300 font-medium"
                              placeholder="ターゲットを入力..."
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase flex items-center gap-1.5">
                              <GlobeIcon className="w-3 h-3" />
                              媒体
                            </label>
                            <input
                              type="text"
                              value={mediaType}
                              onChange={(e) => setMediaType(e.target.value)}
                              className="w-full px-3 py-1.5 text-sm bg-green-50/50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-lg focus:ring-1 focus:ring-green-400 outline-none text-green-700 dark:text-green-300 font-medium"
                              placeholder="媒体を入力..."
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase flex items-center gap-1.5">
                            <ArrowLeftIcon className="w-3 h-3 rotate-90" />
                            目的
                          </label>
                          <textarea
                            value={interviewPurpose}
                            onChange={(e) => setInterviewPurpose(e.target.value)}
                            className="w-full px-3 py-1.5 text-sm bg-purple-50/50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-lg focus:ring-1 focus:ring-purple-400 outline-none text-purple-700 dark:text-purple-300 font-medium min-h-[60px]"
                            placeholder="目的を入力..."
                          />
                        </div>
                      </div>

                      {/* 全体のプレビューテキストを一番下に強調して表示 */}
                      <div className="mt-6 pt-4 border-t border-purple-100 dark:border-purple-900/50">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-tighter mb-2">
                          📝 実際の冒頭スクリプト（プレビュー）
                        </label>
                        <textarea
                          value={openingMessage}
                          onChange={(e) => setOpeningMessage(e.target.value)}
                          className="w-full p-3 bg-purple-50/50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800/30 text-sm leading-relaxed text-gray-800 dark:text-gray-200 min-h-[120px] focus:ring-1 focus:ring-purple-400 outline-none"
                          placeholder="冒頭の挨拶文がここに表示されます。自由に編集可能です。"
                        />
                      </div>
                      <div className="mt-2 flex justify-end gap-2">
                        <Button
                          onClick={handleReadAloud}
                          variant="outline"
                          size="sm"
                          className={`text-xs ${isSpeaking ? 'border-red-200 text-red-600 bg-red-50' : 'border-purple-200 text-purple-600 font-bold'}`}
                        >
                          {isSpeaking ? (
                            <>
                              <VolumeXIcon className="w-3 h-3 mr-1" />
                              読み上げ停止
                            </>
                          ) : (
                            <>
                              <Volume2Icon className="w-3 h-3 mr-1" />
                              🔊 冒頭を読み上げる
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleSave}
                          variant="outline"
                          size="sm"
                          disabled={saving}
                          className="text-xs border-purple-200 hover:bg-purple-50"
                        >
                          <SaveIcon className="w-3 h-3 mr-1" />
                          冒頭挨拶のみ保存
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Question Generation Section */}
              {showQuestionGeneration && (
                <Card className="border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>📚 インタビューを生成</span>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={handleSave}
                          variant="outline"
                          size="sm"
                          disabled={saving}
                          className="text-xs border-purple-200"
                        >
                          <SaveIcon className="w-3 h-3 mr-1" />
                          質問構成のみ保存
                        </Button>
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
                      </div>
                    </CardTitle>
                    <CardDescription>
                      より良いインタビューを構成します
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* 質問数入力 */}
                    <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <label className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        質問数:
                      </label>
                      <input
                        type="number"
                        min="3"
                        max="30"
                        value={questionCount}
                        onChange={(e) => {
                          const value = parseInt(e.target.value, 10)
                          if (!isNaN(value) && value >= 3 && value <= 30) {
                            setQuestionCount(value)
                          }
                        }}
                        className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center"
                        disabled={loadingQuestions}
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        (3〜30問)
                      </span>
                    </div>
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
                              onClick={async () => {
                                // 質問をテキスト形式に変換
                                const questionsText = questionsList.map((q, i) => `${i + 1}. ${q}`).join('\n')
                                setGeneratedQuestions(questionsText)
                                setQuestionsConfirmed(true)
                                // 保存して詳細ページへ（handleSave内で遷移が行われる）
                                await handleSave()
                              }}
                              disabled={saving || questionsList.some(q => !q.trim())}
                              variant="default"
                              size="sm"
                              className="flex-1"
                            >
                              {saving ? (
                                <>
                                  <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                                  保存中...
                                </>
                              ) : (
                                <>
                                  <CheckCircleIcon className="w-4 h-4 mr-2" />
                                  この質問で保存して確定
                                </>
                              )}
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
                        {/* オープニングメッセージの編集（テキスト形式時も表示） */}
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-indigo-200 dark:border-indigo-800 p-4 shadow-sm mb-4">
                          <label className="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">
                            🎤 オープニングメッセージ
                          </label>
                          <Textarea
                            value={openingMessage}
                            onChange={(e) => setOpeningMessage(e.target.value)}
                            placeholder="生成されたオープニングメッセージがここに表示されます"
                            rows={4}
                            className="w-full text-sm"
                          />
                        </div>

                        <Textarea
                          value={generatedQuestions}
                          onChange={(e) => setGeneratedQuestions(e.target.value)}
                          placeholder="生成された質問がここに表示されます"
                          rows={10}
                          className="w-full font-mono text-sm"
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            onClick={async () => {
                              setQuestionsConfirmed(true)
                              await handleSave()
                            }}
                            disabled={saving || !generatedQuestions.trim()}
                            variant="default"
                            size="sm"
                            className="flex-1"
                          >
                            {saving ? (
                              <>
                                <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                                保存中...
                              </>
                            ) : (
                              <>
                                <CheckCircleIcon className="w-4 h-4 mr-2" />
                                この内容で保存して確定
                              </>
                            )}
                          </Button>
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

              {/* Question Generation Modal */}
              {showQuestionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                  <Card className="w-full max-w-md mx-4">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center justify-between">
                        <span>📚 質問を生成</span>
                        <Button
                          onClick={() => setShowQuestionModal(false)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <XIcon className="w-4 h-4" />
                        </Button>
                      </CardTitle>
                      <CardDescription>
                        インタビュー情報を保存しました。AIで質問を生成しますか？
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* 質問数入力 */}
                      <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <label className="text-sm font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                          質問数:
                        </label>
                        <input
                          type="number"
                          min="3"
                          max="30"
                          value={questionCount}
                          onChange={(e) => {
                            const value = parseInt(e.target.value, 10)
                            if (!isNaN(value) && value >= 3 && value <= 30) {
                              setQuestionCount(value)
                            }
                          }}
                          className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center"
                        />
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          (3〜30問)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={async () => {
                            setShowQuestionModal(false)
                            setShowQuestionGeneration(true)
                            await handleGenerateQuestionsWithKnowledge()
                          }}
                          disabled={loadingQuestions || !interviewId}
                          className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                        >
                          <SparklesIcon className="w-4 h-4 mr-2" />
                          AIで質問を生成
                        </Button>
                        <Button
                          onClick={() => {
                            setShowQuestionModal(false)
                            router.push(`/dashboard/interviews/${interviewId}`)
                          }}
                          variant="outline"
                        >
                          後で生成
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          )}
        </div>
      </div >
    </div >
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
