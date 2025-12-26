'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { getFirebaseDb } from '@/src/lib/firebase'
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeftIcon, UserIcon, PlusIcon, EditIcon, TrashIcon, SaveIcon, XIcon, ImageIcon, UploadIcon, Volume2Icon, VolumeXIcon, SparklesIcon } from 'lucide-react'
import Link from 'next/link'
import { InterviewerProfile, GeminiVoiceType } from '@/src/types'
import { getFirebaseStorage } from '@/src/lib/firebase'

// Gemini 2.5 Flash Native Audio の音声オプション
const VOICE_OPTIONS: { value: GeminiVoiceType; label: string; description: string }[] = [
  { value: 'Puck', label: 'Puck（パック）', description: '中性的で明るい声' },
  { value: 'Charon', label: 'Charon（カロン）', description: '落ち着いた低めの声' },
  { value: 'Kore', label: 'Kore（コレ）', description: '柔らかく優しい声' },
  { value: 'Fenrir', label: 'Fenrir（フェンリル）', description: '知性的で深みのある声' },
  { value: 'Aoede', label: 'Aoede（アオイデ）', description: '明るく親しみやすい声' }
]

// インタビュアーのテンプレート設定
const INTERVIEWER_TEMPLATES = [
  {
    id: 'passionate',
    name: '熱血記者',
    role: '敏腕記者',
    description: 'エネルギッシュで、本質に切り込む鋭い質問を投げかけます。',
    prompt: 'あなたは熱血な記者です。相手の心に切り込むような質問を投げかけます。エネルギーに溢れ、読者をワクワクさせるような深いエピソードを徹底的に引き出そうとします。「なぜ」「どうして」を情熱的に尋ね、表面的な回答を許しません。',
    voiceType: 'Charon' as GeminiVoiceType,
    speakingRate: 1.2,
    reactionPatterns: 'それは素晴らしいエピソードですね！\nもっと詳しく聞かせてください！\nなるほど、熱い想いを感じます。\nその時、魂が震えるような感覚はありましたか？\nまさに、プロの仕事ですね。'
  },
  {
    id: 'empathetic',
    name: '共感カウンセラー',
    role: 'インタビュー専門カウンセラー',
    description: '穏やかで温かく、相手の感情や想いに深く寄り添います。',
    prompt: 'あなたは共感力の高いカウンセラーのようなインタビュアーです。相手の感情に寄り添い、安心感を与える対話を心がけます。「それは大変でしたね」「その時、どのようにお感じになりましたか？」といった、言葉になりにくい微細な感情や想いを優しく聞き出します。',
    voiceType: 'Kore' as GeminiVoiceType,
    speakingRate: 1.0,
    reactionPatterns: 'そのお気持ち、よく分かります。\nそれは、大切にされている想いなのですね。\nお話しいただき、ありがとうございます。\n心が温まるようなお話です。\n無理にお話しいただかなくても大丈夫ですよ。'
  },
  {
    id: 'logical',
    name: '論理的アナリスト',
    role: 'シニアアナリスト',
    description: '事実、数値、論理を重視し、構造的に情報を整理します。',
    prompt: 'あなたは論理的で冷静なアナリストです。事実とロジックを重視し、具体的かつ客観的な情報を引き出します。数値、経緯、構造を正確に把握しようとし、曖昧な部分を明確にするためのシャープな質問を投げかけます。プロフェッショナルで知的な口調を保ちます。',
    voiceType: 'Fenrir' as GeminiVoiceType,
    speakingRate: 1.1,
    reactionPatterns: '非常に論理的で分かりやすいです。\n具体的数値や指標はありますか？\nなるほど、その構造的な要因は何でしょうか？\n事実関係を整理すると、そういうことですね。\n客観的に見て、非常に整合性が取れています。'
  },
  {
    id: 'friendly',
    name: '親しみやすい編集者',
    role: 'コミュニティ編集者',
    description: '雑談のようにリラックスした雰囲気で、自然な言葉を引き出します。',
    prompt: 'あなたは親しみやすく、好奇心旺盛な編集者です。雑談を交えながら、リラックスした雰囲気で会話を進めます。難しい話も噛み砕いて聞き、相手が自然体で話せるようにリードします。「面白いですね！」「もっと聞かせてください」と、一人のファンとして応援するような姿勢で接します。',
    voiceType: 'Aoede' as GeminiVoiceType,
    speakingRate: 1.2,
    reactionPatterns: 'うわぁ、面白いですね！\nそれ、もっと詳しく教えてください！\nあはは、最高ですね。\nなるほどなぁ、勉強になります！\nうんうん、分かります！'
  }
]

export default function InterviewerSettingsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [interviewers, setInterviewers] = useState<InterviewerProfile[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // フォーム状態
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    description: '',
    prompt: '',
    photoURL: '',
    voiceType: 'Puck' as GeminiVoiceType,
    speakingRate: 1.2, // 音声速度（0.25-4.0、デフォルト: 1.2 = 少し速め）
    reactionPatterns: '', // 基礎的な相槌や反応のパターン
    isActive: true
  })
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const [playingDemo, setPlayingDemo] = useState(false)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    } else if (!loading && user) {
      loadInterviewers()
    }
  }, [user, loading, router])

  const loadInterviewers = async () => {
    if (!user?.companyId) {
      console.warn('User has no companyId')
      setLoadingData(false)
      return
    }

    try {
      setLoadingData(true)
      const q = query(
        collection(getFirebaseDb(), 'interviewers'),
        where('companyId', '==', user.companyId),
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
    } catch (error) {
      console.error('Error loading interviewers:', error)
      alert('❌ インタビュアーの読み込みに失敗しました\n\nエラー: ' + (error as Error).message)
    } finally {
      setLoadingData(false)
    }
  }

  const handleCreate = () => {
    setEditingId(null)
    setFormData({
      name: '',
      role: '',
      description: '',
      prompt: '',
      photoURL: '',
      voiceType: 'Puck',
      speakingRate: 1.2,
      reactionPatterns: '',
      isActive: true
    })
    setPhotoFile(null)
    setPhotoPreview('')
    setSelectedTemplate(null)
    setShowDialog(true)
  }

  const applyTemplate = (templateId: string) => {
    const template = INTERVIEWER_TEMPLATES.find(t => t.id === templateId)
    if (!template) return

    setFormData({
      ...formData,
      name: template.name,
      role: template.role,
      description: template.description,
      prompt: template.prompt,
      voiceType: template.voiceType,
      speakingRate: template.speakingRate,
      reactionPatterns: template.reactionPatterns
    })
    setSelectedTemplate(templateId)
  }

  const handleEdit = (interviewer: InterviewerProfile) => {
    setEditingId(interviewer.id)
    setFormData({
      name: interviewer.name,
      role: interviewer.role,
      description: interviewer.description || '',
      prompt: interviewer.prompt || '',
      photoURL: interviewer.photoURL || '',
      voiceType: interviewer.voiceSettings?.voiceType || 'Puck',
      speakingRate: interviewer.voiceSettings?.speed || 1.2,
      reactionPatterns: interviewer.reactionPatterns || '',
      isActive: interviewer.isActive
    })
    setPhotoFile(null)
    setPhotoPreview(interviewer.photoURL || '')
    setShowDialog(true)
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 画像ファイルのみ許可
    if (!file.type.startsWith('image/')) {
      alert('⚠️ 画像ファイルを選択してください')
      return
    }

    // ファイルサイズ制限（5MB）
    if (file.size > 5 * 1024 * 1024) {
      alert('⚠️ ファイルサイズは5MB以下にしてください')
      return
    }

    setPhotoFile(file)

    // プレビュー表示
    const reader = new FileReader()
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const uploadPhoto = async (file: File, interviewerId: string): Promise<string> => {
    const firebaseStorage = getFirebaseStorage()
    const storageRef = ref(firebaseStorage, `interviewers/${user?.companyId}/${interviewerId}/${Date.now()}_${file.name}`)
    const uploadTask = uploadBytesResumable(storageRef, file)

    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        null,
        (error) => reject(error),
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
          resolve(downloadURL)
        }
      )
    })
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('⚠️ インタビュアーの名前を入力してください')
      return
    }
    if (!formData.role.trim()) {
      alert('⚠️ インタビュアーの役割を入力してください')
      return
    }

    try {
      setSaving(true)
      setUploadingPhoto(!!photoFile)

      let photoURL = formData.photoURL

      if (editingId) {
        // 更新
        // 新しい写真がある場合はアップロード
        if (photoFile) {
          photoURL = await uploadPhoto(photoFile, editingId)
        }

        const { voiceType, speakingRate, ...restFormData } = formData
        await updateDoc(doc(getFirebaseDb(), 'interviewers', editingId), {
          ...restFormData,
          photoURL,
          voiceSettings: {
            voiceType,
            speed: speakingRate
          },
          reactionPatterns: formData.reactionPatterns || '',
          updatedAt: serverTimestamp()
        })
        alert('✅ インタビュアーを更新しました')
      } else {
        // 新規作成
        // まずドキュメントを作成
        const { voiceType, speakingRate, ...restFormData } = formData
        const docRef = await addDoc(collection(getFirebaseDb(), 'interviewers'), {
          ...restFormData,
          photoURL: '',
          voiceSettings: {
            voiceType,
            speed: speakingRate
          },
          reactionPatterns: formData.reactionPatterns || '',
          companyId: user?.companyId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })

        // 写真がある場合はアップロードしてURLを更新
        if (photoFile) {
          photoURL = await uploadPhoto(photoFile, docRef.id)
          await updateDoc(doc(getFirebaseDb(), 'interviewers', docRef.id), {
            photoURL,
            updatedAt: serverTimestamp()
          })
        }

        alert('✅ インタビュアーを作成しました')
      }

      setShowDialog(false)
      setPhotoFile(null)
      setPhotoPreview('')
      await loadInterviewers()
    } catch (error) {
      console.error('Error saving interviewer:', error)
      alert('❌ 保存に失敗しました')
    } finally {
      setSaving(false)
      setUploadingPhoto(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このインタビュアーを削除してもよろしいですか？')) {
      return
    }

    try {
      await deleteDoc(doc(getFirebaseDb(), 'interviewers', id))
      alert('✅ インタビュアーを削除しました')
      await loadInterviewers()
    } catch (error) {
      console.error('Error deleting interviewer:', error)
      alert('❌ 削除に失敗しました')
    }
  }

  const handlePlayDemo = async () => {
    if (!formData.name.trim()) {
      alert('⚠️ デモ再生には、最低でも名前を入力してください')
      return
    }

    // 停止中の場合は既存のオーディオを停止
    if (audioElement) {
      audioElement.pause()
      audioElement.currentTime = 0
      audioElement.onended = null
      audioElement.onerror = null
      setAudioElement(null)
    }

    setPlayingDemo(true)

    try {
      // デモテキストを生成
      let demoText = `こんにちは、${formData.name}です。`
      if (formData.role.trim()) {
        demoText += `私は${formData.role}として活動しています。`
      }
      if (formData.description.trim()) {
        demoText += `${formData.description}`
      } else {
        demoText += `よろしくお願いいたします。`
      }

      // API経由で高品質な音声を生成
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: demoText,
          voiceType: formData.voiceType,
          speakingRate: formData.speakingRate,
        }),
      })

      if (!response.ok) {
        let errorMessage = '音声生成に失敗しました'
        let helpUrl = ''
        try {
          const error = await response.json()
          errorMessage = error.error || error.details || errorMessage
          helpUrl = error.helpUrl || ''
          console.error('API Error:', error)

          // より分かりやすいエラーメッセージを表示
          if (error.status === 403) {
            const fullMessage = `${errorMessage}\n\n高品質な音声にはText-to-Speech APIの有効化が必要です。\n\n${helpUrl ? `有効化: ${helpUrl}` : 'Google Cloud ConsoleでText-to-Speech APIを有効化してください。'}`
            alert(`❌ ${fullMessage}`)
          }
        } catch (e) {
          console.error('Failed to parse error response:', e)
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      // 音声データをBlobとして取得
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      // 新しいAudioエレメントを作成して再生
      const audio = new Audio(audioUrl)
      setAudioElement(audio)

      audio.onended = () => {
        setPlayingDemo(false)
        URL.revokeObjectURL(audioUrl)
      }

      audio.onerror = () => {
        setPlayingDemo(false)
        URL.revokeObjectURL(audioUrl)
        alert('❌ 音声の再生に失敗しました')
      }

      await audio.play()
    } catch (error) {
      console.error('Demo playback error:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      // エラーメッセージは既にalertで表示されているので、ここでは状態をリセット
      setPlayingDemo(false)
    }
  }

  const handleStopDemo = () => {
    try {
      if (audioElement) {
        audioElement.pause()
        audioElement.currentTime = 0
        // イベントリスナーを削除
        audioElement.onended = null
        audioElement.onerror = null
      }
      setPlayingDemo(false)
      setAudioElement(null)
    } catch (error) {
      console.error('Error stopping demo:', error)
      setPlayingDemo(false)
      setAudioElement(null)
    }
  }

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    )
  }

  // Check if user has companyId
  if (user && !user.companyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md mx-auto px-4">
          <Card className="border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20">
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold text-yellow-900 dark:text-yellow-300 mb-2">
                ⚠️ 会社情報が未設定です
              </h2>
              <p className="text-sm text-yellow-800 dark:text-yellow-400 mb-4">
                インタビュアーを作成するには、ユーザープロファイルに会社情報（companyId）を設定する必要があります。
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-500 mb-4">
                管理者にお問い合わせいただくか、Firestore Consoleで以下のパスにcompanyIdを追加してください：
              </p>
              <code className="block bg-yellow-100 dark:bg-yellow-900/50 p-2 rounded text-xs text-yellow-900 dark:text-yellow-300 mb-4">
                users/{user.uid}/companyId
              </code>
              <Link href="/dashboard">
                <Button className="w-full">
                  ダッシュボードに戻る
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
              <div className="flex items-center gap-3">
                <UserIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  インタビュアー設定
                </h1>
              </div>
            </div>
            <Button
              onClick={handleCreate}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
            >
              <PlusIcon className="w-4 h-4 mr-2" />
              新規作成
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            インタビュアープロファイルについて
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            AIインタビュアーの人格・口調・プロンプトを設定します。
            複数のインタビュアーを作成し、インタビュー作成時に選択できます。
          </p>
        </div>

        {/* Interviewers List */}
        <div className="space-y-4">
          {interviewers.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <UserIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  インタビュアーがまだ登録されていません
                </p>
                <Button onClick={handleCreate}>
                  <PlusIcon className="w-4 h-4 mr-2" />
                  最初のインタビュアーを作成
                </Button>
              </CardContent>
            </Card>
          ) : (
            interviewers.map((interviewer) => (
              <Card key={interviewer.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {/* Profile Photo */}
                      {interviewer.photoURL ? (
                        <img
                          src={interviewer.photoURL}
                          alt={interviewer.name}
                          className="w-16 h-16 rounded-full object-cover border-2 border-indigo-200 dark:border-indigo-700"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 flex items-center justify-center border-2 border-indigo-200 dark:border-indigo-700">
                          <UserIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CardTitle className="text-lg">{interviewer.name}</CardTitle>
                          <span className={`px-2 py-0.5 text-xs rounded ${interviewer.isActive
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                            {interviewer.isActive ? '有効' : '無効'}
                          </span>
                        </div>
                        <CardDescription>{interviewer.role}</CardDescription>
                        {interviewer.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                            {interviewer.description}
                          </p>
                        )}
                        {interviewer.voiceSettings?.voiceType && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                              🎤 {VOICE_OPTIONS.find(v => v.value === interviewer.voiceSettings?.voiceType)?.label}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(interviewer)}
                      >
                        <EditIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(interviewer.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {interviewer.prompt && (
                  <CardContent>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                        カスタムプロンプト:
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                        {interviewer.prompt}
                      </p>
                    </div>
                  </CardContent>
                )}
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      {showDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                {editingId ? 'インタビュアーを編集' : '新規インタビュアーを作成'}
              </h2>

              <div className="space-y-4">
                {/* Template Selection */}
                {!editingId && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <label className="block text-sm font-semibold text-indigo-900 dark:text-indigo-300 mb-3">
                      <SparklesIcon className="w-4 h-4 inline mr-1 text-indigo-600 dark:text-indigo-400" />
                      テンプレートから作成（推奨）
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {INTERVIEWER_TEMPLATES.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => applyTemplate(template.id)}
                          className={`p-2 text-xs rounded-lg border transition-all text-center flex flex-col items-center gap-1 ${selectedTemplate === template.id
                              ? 'bg-white dark:bg-indigo-600 border-indigo-600 text-indigo-700 dark:text-white shadow-sm ring-2 ring-indigo-500/20'
                              : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-indigo-300'
                            }`}
                        >
                          <span className="font-bold">{template.name}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-indigo-600/70 dark:text-indigo-400/70 mt-2">
                      各テンプレートには最適な声と性格（プロンプト）が設定されています。
                    </p>
                  </div>
                )}
                {/* Profile Photo */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    <ImageIcon className="w-4 h-4 inline mr-1" />
                    プロフィール写真（任意）
                  </label>
                  <div className="flex items-center gap-4">
                    {/* Preview */}
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-20 h-20 rounded-full object-cover border-2 border-indigo-200 dark:border-indigo-700"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 flex items-center justify-center border-2 border-indigo-200 dark:border-indigo-700">
                        <UserIcon className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                      </div>
                    )}
                    {/* Upload Button */}
                    <div className="flex-1">
                      <input
                        type="file"
                        id="photo-upload"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="hidden"
                      />
                      <label
                        htmlFor="photo-upload"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/50 cursor-pointer transition-colors"
                      >
                        <UploadIcon className="w-4 h-4" />
                        <span>写真を選択</span>
                      </label>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                        JPG、PNG、GIF（最大5MB）
                      </p>
                    </div>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    インタビュアーの名前 *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例：田中太郎"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    役割・肩書き *
                  </label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="例：ジャーナリスト、編集者など"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    説明（任意）
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="このインタビュアーの特徴や得意分野など"
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Voice Settings */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    🎤 音声タイプ
                  </label>
                  <select
                    value={formData.voiceType}
                    onChange={(e) => setFormData({ ...formData, voiceType: e.target.value as GeminiVoiceType })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    {VOICE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} - {option.description}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    Gemini 2.5 Flash Native Audioの音声タイプを選択します
                  </p>

                  {/* Speaking Rate */}
                  <div className="mt-4">
                    <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      ⚡ 音声速度: {formData.speakingRate.toFixed(1)}x
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={formData.speakingRate}
                      onChange={(e) => setFormData({ ...formData, speakingRate: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>0.5x（遅い）</span>
                      <span>1.0x（標準）</span>
                      <span>2.0x（速い）</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      現在: {formData.speakingRate.toFixed(1)}x {formData.speakingRate > 1.0 ? '（速め）' : formData.speakingRate < 1.0 ? '（遅め）' : '（標準）'}
                    </p>
                  </div>

                  <div className="mt-3">
                    <Button
                      type="button"
                      onClick={playingDemo ? handleStopDemo : handlePlayDemo}
                      disabled={!playingDemo && !formData.name.trim()}
                      variant="outline"
                      className="w-full flex items-center justify-center gap-2"
                    >
                      {playingDemo ? (
                        <>
                          <VolumeXIcon className="w-4 h-4" />
                          再生中... (クリックで停止)
                        </>
                      ) : (
                        <>
                          <Volume2Icon className="w-4 h-4" />
                          デモ音声を再生
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      名前・役割・説明を使って音声デモを再生します
                    </p>
                  </div>
                </div>

                {/* Prompt */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    カスタムプロンプト（任意）
                  </label>
                  <textarea
                    value={formData.prompt}
                    onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                    placeholder="このインタビュアーの口調や振る舞いを指定するプロンプト"
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                </div>

                {/* Reaction Patterns */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    基礎的な相槌・反応パターン（任意）
                  </label>
                  <textarea
                    value={formData.reactionPatterns}
                    onChange={(e) => setFormData({ ...formData, reactionPatterns: e.target.value })}
                    placeholder={`例：
なるほど、それは興味深いですね。
そうですか、それは素晴らしい取り組みですね。
理解しました。
それは重要なポイントですね。
詳しく聞かせていただけますか？`}
                    rows={6}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    このインタビュアーが使用する基礎的な相槌や反応のパターンを記入してください。1行に1つのパターンを記入します。AIはこのパターンを参考にして、ユーザーの回答に対して自然な相槌を生成します。
                  </p>
                </div>

                {/* Is Active */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="isActive" className="text-sm text-gray-900 dark:text-gray-100">
                    このインタビュアーを有効にする
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-4 mt-6">
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                >
                  <SaveIcon className="w-4 h-4 mr-2" />
                  {uploadingPhoto ? '写真をアップロード中...' : saving ? '保存中...' : '保存'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDialog(false)}
                  disabled={saving}
                  className="flex-1"
                >
                  <XIcon className="w-4 h-4 mr-2" />
                  キャンセル
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

