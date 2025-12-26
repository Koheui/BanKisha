'use client'

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { getFirebaseDb } from '@/src/lib/firebase'
import { doc, getDoc, updateDoc, deleteDoc, collection, addDoc, query, orderBy, onSnapshot, getDocs, serverTimestamp } from 'firebase/firestore'
import { getCompany } from '@/src/lib/firestore'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { ArrowLeftIcon, PlusIcon, MicIcon, CalendarIcon, UserIcon, BuildingIcon, LoaderIcon, EditIcon, TrashIcon, CopyIcon, FileTextIcon, Volume2Icon, PauseIcon, SquareIcon, CheckCircleIcon, Sparkles as SparklesIcon, PlusCircleIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { InterviewSession, Message, InterviewerProfile, GeminiVoiceType } from '@/src/types'

// 質問文字列を配列にパースする関数
const parseQuestions = (questionsText?: string, objective?: string): string[] => {
  if (!questionsText && !objective) return []

  // questionsTextがある場合はそれを使用（優先）
  if (questionsText && questionsText.trim()) {
    // 改行で分割し、空行を除去
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

    // パースできた場合は返す
    if (questions.length > 0) {
      return questions
    }

    // パースできなかった場合は、元の文字列をそのまま返す
    if (questionsText.trim().length > 0) {
      console.log('⚠️ パースできなかったため、元の文字列をそのまま使用')
      return [questionsText.trim()]
    }
  }

  // questionsTextがない場合はobjectiveから質問を抽出
  if (objective && objective.trim()) {
    // まず、改行で分割を試みる
    let lines = objective.split('\n').map(line => line.trim()).filter(line => line.length > 0)

    // 改行がない場合は、疑問符で分割を試みる（「？」「?」）
    if (lines.length <= 1) {
      lines = objective.split(/[？\?]/).map(line => line.trim()).filter(line => line.length > 0)
    }

    // それでも1つしかない場合は、句点で分割を試みる
    if (lines.length <= 1) {
      lines = objective.split(/[。！]/).map(line => line.trim()).filter(line => line.length > 0)
    }

    // それでも1つしかない場合は、長い文をスペースで分割（複数の質問が含まれている可能性）
    if (lines.length <= 1 && objective.length > 50) {
      // 長い文を「。」「？」「？」などで分割
      lines = objective.split(/[。？\?！]/).map(line => line.trim()).filter(line => line.length > 5)

      // それでも1つしかない場合は、スペースで分割（ただし、短い単語は除外）
      if (lines.length <= 1) {
        const spaceSplit = objective.split(/\s+/).filter(word => word.length > 10)
        if (spaceSplit.length > 1) {
          // スペースで分割した結果が複数ある場合は、元の文を適切に分割
          // 文の長さに基づいて分割点を探す
          const sentences: string[] = []
          let currentSentence = ''

          for (const word of objective.split(/\s+/)) {
            currentSentence += (currentSentence ? ' ' : '') + word
            // 疑問符や句点がある場合、または長さが一定以上の場合に分割
            if (word.match(/[？\?。！]$/) || currentSentence.length > 40) {
              if (currentSentence.trim().length > 5) {
                sentences.push(currentSentence.trim())
                currentSentence = ''
              }
            }
          }

          if (currentSentence.trim().length > 5) {
            sentences.push(currentSentence.trim())
          }

          if (sentences.length > 0) {
            lines = sentences
          }
        }
      }
    }

    // 抽出できた場合は返す
    if (lines.length > 0) {
      return lines
    }

    // それでも抽出できなければ、objective全体を1つの質問として扱う
    return [objective.trim()]
  }

  return []
}

// 質問リストから導入部分を除去する関数
// 質問リストから導入部分を除去する関数
const filterIntroductoryQuestions = (questions: string[]): string[] => {
  if (questions.length === 0) {
    return []
  }
  const firstQuestion = questions[0]
  const introductionKeywords = ['本日はお時間', 'と申します', '私、', 'よろしくお願い', '申します']
  const isIntroduction = introductionKeywords.some(keyword => firstQuestion.includes(keyword)) ||
    (firstQuestion.includes('本日は') && firstQuestion.includes('申します')) ||
    (firstQuestion.includes('私、') && firstQuestion.includes('と申します'))

  if (isIntroduction) {
    console.log('⏭️ 導入部分と判断された最初の質問をリストから削除:', firstQuestion)
    return questions.slice(1)
  }

  return questions
}

function VoiceChatInterviewContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const interviewId = params.id as string
  const router = useRouter()
  const isTestMode = searchParams.get('mode') === 'test'
  const [interview, setInterview] = useState<InterviewSession | null>(null)
  const [interviewerProfile, setInterviewerProfile] = useState<InterviewerProfile | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [questions, setQuestions] = useState<string[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const questionsRef = useRef<string[]>([]) // 質問リストのref版
  const [companyName, setCompanyName] = useState<string>('')

  // currentQuestionIndexRefとquestionsRefをstateと同期
  useEffect(() => {
    currentQuestionIndexRef.current = currentQuestionIndex
  }, [currentQuestionIndex])

  useEffect(() => {
    questionsRef.current = questions
  }, [questions])

  const [loading, setLoading] = useState(true)
  const [listening, setListening] = useState(false) // 音声認識中かどうか
  const [playing, setPlaying] = useState(false)
  const [processing, setProcessing] = useState(false)
  const processingRef = useRef<boolean>(false)
  useEffect(() => {
    processingRef.current = processing
  }, [processing])
  const [playingQuestion, setPlayingQuestion] = useState(false)
  const playingQuestionRef = useRef<boolean>(false)
  useEffect(() => {
    playingQuestionRef.current = playingQuestion
  }, [playingQuestion])
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [volume, setVolume] = useState(1.0) // 音量（0.0-1.0）
  const [progressEvaluation, setProgressEvaluation] = useState<any>(null)
  const [evaluatingProgress, setEvaluatingProgress] = useState(false)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [audioCheckCompleted, setAudioCheckCompleted] = useState(false) // 音声・マイク確認が完了したか
  const [micTestPassed, setMicTestPassed] = useState(false) // マイクテストが成功したか
  const [micTestFailed, setMicTestFailed] = useState(false) // マイクテストが失敗したか
  const [micTestInProgress, setMicTestInProgress] = useState(false) // マイクテスト実施中か
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const recognitionRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isRecognitionActiveRef = useRef<boolean>(false)
  const questionPlaybackStartTimeRef = useRef<number>(0) // 質問の読み上げ開始時刻
  const transcriptRef = useRef<string>('') // 音声認識のトランスクリプトを保持
  const startListeningRef = useRef<boolean>(false) // 再試行のフラグ（無限ループを防ぐ）
  const recognitionRestartTimeoutRef = useRef<NodeJS.Timeout | null>(null) // 再開のタイマー
  const audioCheckCompletedRef = useRef<boolean>(false) // 音声・マイク確認が完了したか（ref版）
  const messagesLengthRef = useRef<number>(0) // メッセージ数（ref版）
  const isInitializingRef = useRef<boolean>(false) // 初期化中かどうか
  const currentQuestionIndexRef = useRef<number>(0) // 現在の質問インデックス（ref版）
  const messagesListenerUnsubscribeRef = useRef<(() => void) | null>(null) // メッセージリスナーのunsubscribe関数
  const interviewerProfileRef = useRef<InterviewerProfile | null>(null) // インタビュアープロファイルのref版
  const isLoadingDataRef = useRef<boolean>(false) // データ読み込み中かどうか（重複実行防止）
  const isStoppedRef = useRef<boolean>(false) // インタビューが中止されたかどうかのフラグ
  const [isPaused, setIsPaused] = useState(false) // 一時停止中かどうか
  const isPausedRef = useRef<boolean>(false)
  const [hasStarted, setHasStarted] = useState(false)
  const hasStartedRef = useRef(false)
  const [isInterviewComplete, setIsInterviewComplete] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [extraInfo, setExtraInfo] = useState('')
  const [updatingExtraInfo, setUpdatingExtraInfo] = useState(false)
  // 再開確認モーダル
  const [resumeConfirmOpen, setResumeConfirmOpen] = useState(false)

  // 取材先が入力する会社・サービス情報（補足情報モーダル）
  const [companyInfoOpen, setCompanyInfoOpen] = useState(false)
  const [serviceName, setServiceName] = useState('')
  const [companyNameInput, setCompanyNameInput] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [companyUrl, setCompanyUrl] = useState('')
  const [companyItems, setCompanyItems] = useState<{ label: string, value: string }[]>([])
  const [savingCompanyInfo, setSavingCompanyInfo] = useState(false)
  const companySaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // interviewがロードされたらフォームに反映
    if (interview?.intervieweeCompanyInfo) {
      setServiceName(interview.intervieweeCompanyInfo.serviceName || '')
      setCompanyNameInput(interview.intervieweeCompanyInfo.companyName || '')
      setCompanyAddress(interview.intervieweeCompanyInfo.address || '')
      setCompanyUrl(interview.intervieweeCompanyInfo.url || '')
      setCompanyItems(interview.intervieweeCompanyInfo.items || [])
    }
  }, [interview])

  const scheduleSaveCompanyInfo = () => {
    if (companySaveTimeoutRef.current) clearTimeout(companySaveTimeoutRef.current)
    companySaveTimeoutRef.current = setTimeout(() => {
      handleSaveCompanyInfo().catch(console.error)
    }, 1000)
  }

  const handleSaveCompanyInfo = async () => {
    if (!interviewId) return
    try {
      setSavingCompanyInfo(true)
      await updateDoc(doc(getFirebaseDb(), 'interviews', interviewId), {
        intervieweeCompanyInfo: {
          serviceName,
          companyName: companyNameInput,
          address: companyAddress,
          url: companyUrl,
          items: companyItems
        },
        updatedAt: serverTimestamp()
      })

      setInterview(prev => prev ? { ...prev, intervieweeCompanyInfo: { serviceName, companyName: companyNameInput, address: companyAddress, url: companyUrl, items: companyItems } } : prev)
    } catch (e) {
      console.error('Error saving company info:', e)
    } finally {
      setSavingCompanyInfo(false)
    }
  }

  const handleAddCompanyItem = () => {
    setCompanyItems(prev => [...prev, { label: '', value: '' }])
  }

  const handleUpdateCompanyItem = (index: number, field: 'label' | 'value', value: string) => {
    setCompanyItems(prev => prev.map((it, i) => i === index ? { ...it, [field]: value } : it))
  }

  const handleRemoveCompanyItem = (index: number) => {
    setCompanyItems(prev => prev.filter((_, i) => i !== index))
  }

  // 告知系カテゴリーの定義
  const announcementCategories = useMemo(() => [
    'イベント告知',
    'プレスリリース',
    '新サービス紹介',
    'ビジネスニュース',
    'イベントレポート',
    'コミュニティ紹介'
  ], [])

  const isAnnouncementType = useMemo(() => {
    if (!interview?.category) return false
    return announcementCategories.some(cat => interview.category?.includes(cat))
  }, [interview?.category, announcementCategories])

  useEffect(() => {
    if (interview?.supplementaryInfo) {
      setExtraInfo(interview.supplementaryInfo)
    }
  }, [interview?.supplementaryInfo])

  // 再開を待機する関数
  const waitForResume = useCallback(async () => {
    while (isPausedRef.current) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }, [])

  // 自動スクロール
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, currentTranscript, processing])


  // テキスト読み上げ用のテキストを正規化する関数
  const normalizeTextForTTS = useCallback((text: string): string => {
    if (!text) return text
    // 相手の名前を取得
    const intervieweeName = interview?.intervieweeName || ''

    // 「〇〇」を相手の名前に置換（フォームに入力された名前を使用）
    let normalized = text
    if (intervieweeName) {
      // 「〇〇さん」を「[相手の名前]さん」に置換
      normalized = normalized.replace(/〇〇さん/g, `${intervieweeName}さん`)
      normalized = normalized.replace(/○○さん/g, `${intervieweeName}さん`)
      // 「〇〇」を「[相手の名前]」に置換
      normalized = normalized.replace(/〇〇/g, intervieweeName)
      normalized = normalized.replace(/○○/g, intervieweeName)
      // 「〇」単体も「[相手の名前]」に置換（ただし、文脈を考慮）
      normalized = normalized.replace(/〇/g, intervieweeName)
    } else {
      // 名前が入力されていない場合は「なになに」に置換
      normalized = normalized.replace(/〇〇/g, 'なになに')
      normalized = normalized.replace(/○○/g, 'なになに')
      normalized = normalized.replace(/〇/g, 'なに')
    }
    return normalized
  }, [interview?.intervieweeName])

  const playKnockSound = useCallback(async () => {
    try {
      console.log('🔊 効果音を再生しようとしています...')
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) {
        console.error('❌ AudioContextがサポートされていません')
        return
      }

      const audioContext = new AudioContextClass()
      if (audioContext.state === 'suspended') {
        try {
          await audioContext.resume()
        } catch (error: any) {
          console.error('❌ AudioContextのresumeに失敗:', error)
          return
        }
      }

      if (audioContext.state !== 'running') {
        await new Promise(resolve => setTimeout(resolve, 100))
        if (audioContext.state === 'suspended') {
          try {
            await audioContext.resume()
          } catch (error: any) {
            console.error('❌ AudioContextのresume再試行に失敗:', error)
            return
          }
        }
      }

      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.1)
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.1)

      oscillator.onended = () => {
        setTimeout(() => {
          audioContext.close().catch((error: any) => {
            console.warn('⚠️ AudioContextのcloseに失敗:', error)
          })
        }, 100)
      }
    } catch (error) {
      console.error('❌ 効果音の再生エラー:', error)
    }
  }, [])

  const handlePlayQuestion = useCallback(async (questionIndex: number) => {
    // 一時停止中の場合は再開を待つ
    await waitForResume()

    // 既に質問を再生中の場合はスキップ（二重再生を防ぐ）
    if (playingQuestion) {
      console.log('⏸️ 既に質問を再生中のため、新しい再生をスキップします:', questionIndex)
      return
    }

    // refを使用して最新の値を取得（クロージャの問題を回避）
    const currentQuestions = questionsRef.current
    const currentInterviewerProfile = interviewerProfileRef.current

    if (questionIndex >= currentQuestions.length || !currentQuestions[questionIndex] || !currentInterviewerProfile) {
      console.warn('⚠️ 質問の読み上げをスキップ:', {
        questionIndex,
        questionsLength: currentQuestions.length,
        questionsState: questions.length,
        interviewerProfile: !!currentInterviewerProfile,
        interviewerProfileState: !!interviewerProfile
      })
      return
    }

    let question = currentQuestions[questionIndex]
    const interviewerName = currentInterviewerProfile.name || interview?.interviewerName || 'インタビュアー'
    question = question.replace(/あなたの名前/g, interviewerName).replace(/あなたの名前/g, interviewerName)

    // テキスト読み上げ用に正規化（「〇〇」を「なになに」に置換）
    const normalizedQuestion = normalizeTextForTTS(question)

    // 音声設定を一貫して使用（設定が変更されないように）
    const voiceType = currentInterviewerProfile.voiceSettings?.voiceType || 'Puck'
    const speed = currentInterviewerProfile.voiceSettings?.speed || 1.0

    console.log('🎤 質問を読み上げます:', { questionText: normalizedQuestion.substring(0, 100), voiceType, speed })

    try {
      if (isStoppedRef.current) return
      // 一時停止した瞬間に再生が始まらないように再チェック
      if (isPausedRef.current) {
        await waitForResume()
      }
      setPlayingQuestion(true)
      const ttsController = new AbortController()
      const ttsTimeoutId = setTimeout(() => ttsController.abort("Timeout"), 60000) // 60秒に延長

      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: normalizedQuestion,
          voiceType: voiceType,
          speed: speed,
        }),
        signal: ttsController.signal
      }).finally(() => clearTimeout(ttsTimeoutId))

      if (!response.ok) {
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText }
        }
        console.error('❌ 音声生成APIエラー:', {
          status: response.status,
          error: errorData,
          questionLength: normalizedQuestion.length,
          questionPreview: normalizedQuestion.substring(0, 200)
        })
        throw new Error(`音声生成に失敗しました: ${response.status} - ${errorData.error || '不明なエラー'}`)
      }

      if (isStoppedRef.current) return
      const audioBlob = await response.blob()
      console.log('✅ 音声データを受信:', {
        size: audioBlob.size,
        type: audioBlob.type,
        questionLength: normalizedQuestion.length,
        questionPreview: normalizedQuestion.substring(0, 100) + '...'
      })

      if (audioBlob.size === 0) {
        console.error('❌ 音声データが空です')
        throw new Error('音声データが空です。テキストが長すぎる可能性があります。')
      }

      const audioUrl = URL.createObjectURL(audioBlob)

      if (isStoppedRef.current) {
        URL.revokeObjectURL(audioUrl)
        setPlayingQuestion(false)
        return
      }

      if (audioElementRef.current) {
        audioElementRef.current.pause()
        audioElementRef.current = null
      }
      const audio = new Audio(audioUrl)
      audioElementRef.current = audio
      audio.volume = volume

      questionPlaybackStartTimeRef.current = Date.now()

      // 音声の読み込み完了を待つ
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('音声データの読み込みがタイムアウトしました（10秒）'))
        }, 10000)

        audio.onloadeddata = () => {
          clearTimeout(timeout)
          console.log('✅ 音声データの読み込み完了')
          resolve()
        }
        audio.onerror = (e) => {
          clearTimeout(timeout)
          const audioError = (audio as any).error
          console.error('❌ 音声データの読み込みエラー:', {
            error: e,
            errorCode: audioError?.code,
            errorMessage: audioError?.message
          })
          reject(new Error(`音声データの読み込みに失敗しました: ${audioError?.message || '不明なエラー'}`))
        }
      })

      audio.onended = () => {
        if (isStoppedRef.current) {
          URL.revokeObjectURL(audioUrl)
          setPlayingQuestion(false)
          return
        }
        console.log('✅ 質問の読み上げが完了しました:', questionIndex, '質問長:', normalizedQuestion.length)
        setPlayingQuestion(false)
        URL.revokeObjectURL(audioUrl)
        addDoc(collection(getFirebaseDb(), `interviews/${interviewId}/messages`), {
          role: 'interviewer',
          content: question,
          timestamp: serverTimestamp(),
        }).catch(saveError => console.error('⚠️ メッセージ保存エラー（続行）:', saveError))

        // 質問の読み上げが終わったら、ユーザーの回答を待つ
        // 音声認識を開始する（マイクチェック完了後は常に開始）
        setTimeout(() => {
          if (!playingQuestion && !processing && !isRecognitionActiveRef.current) {
            console.log('🎤 質問の読み上げ完了後、音声認識を開始します')
            startListening().catch(error => {
              console.error('❌ 音声認識の開始に失敗:', error)
            })
          } else {
            console.log('⏸️ 音声認識を開始できません:', {
              playingQuestion,
              processing,
              isRecognitionActive: isRecognitionActiveRef.current
            })
          }
        }, 1000) // 1秒待ってから音声認識を開始
      }

      audio.onerror = (e) => {
        const audioError = (audio as any).error
        console.error('❌ 音声再生エラー:', {
          error: e,
          readyState: audio.readyState,
          networkState: audio.networkState,
          errorCode: audioError?.code,
          errorMessage: audioError?.message,
          questionLength: normalizedQuestion.length,
          audioBlobSize: audioBlob.size,
          questionPreview: normalizedQuestion.substring(0, 200)
        })
        setPlayingQuestion(false)
        URL.revokeObjectURL(audioUrl)
        alert(`❌ 音声の再生に失敗しました。\nエラーコード: ${audioError?.code || '不明'}\n質問の長さ: ${normalizedQuestion.length}文字\n\nテキストが長すぎる可能性があります。`)
      }

      audio.onstalled = () => {
        console.warn('⚠️ 音声再生が停止しました（stalled）')
      }

      audio.onabort = () => {
        console.warn('⚠️ 音声再生が中断されました（abort）')
        setPlayingQuestion(false)
        URL.revokeObjectURL(audioUrl)
      }

      console.log('▶️ 音声再生を開始します')
      await audio.play().catch((error) => {
        console.error('❌ 音声再生開始エラー:', error)
        setPlayingQuestion(false)
        URL.revokeObjectURL(audioUrl)
        throw error
      })
      console.log('✅ 音声再生が開始されました')
    } catch (error) {
      console.error('❌ 質問読み上げエラー:', error)
      setPlayingQuestion(false)
      alert(`❌ 質問の読み上げに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
    }
  }, [interviewId, volume, interview?.interviewerName, normalizeTextForTTS, playingQuestion, waitForResume])

  const handleStopAudio = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause()
      audioElementRef.current.currentTime = 0
      setPlaying(false)
    }
  }, [])

  useEffect(() => {
    if (audioElementRef.current) {
      audioElementRef.current.volume = volume
    }
  }, [volume])

  const loadInterviewData = useCallback(async () => {
    if (!interviewId) {
      console.warn('⚠️ interviewIdがありません')
      setLoading(false)
      return
    }

    // 既に読み込み中の場合はスキップ（重複実行防止）
    if (isLoadingDataRef.current) {
      return
    }

    isLoadingDataRef.current = true
    setLoading(true)

    try {
      const firestoreDb = getFirebaseDb()
      const docRef = doc(firestoreDb, 'interviews', interviewId)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data() as any
        const loadedInterview: InterviewSession = {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        }

        // 会社名を読み込む
        if (data.companyId) {
          try {
            const company = await getCompany(data.companyId)
            if (company) {
              setCompanyName(company.name)
            }
          } catch (companyError) {
            console.warn('⚠️ 会社名の読み込みに失敗しました:', companyError)
          }
        }

        // インタビューが中止/完了されている場合、またはテストモードでメッセージが存在する場合は初期化
        const isCancelled = loadedInterview.status === 'cancelled'
        const isCompleted = loadedInterview.status === 'completed'
        let hasMessages = false
        let messagesSnapshot = null

        // intervieweeCompanyInfoがあればフォームにプリセット
        if (data.intervieweeCompanyInfo) {
          const info = data.intervieweeCompanyInfo;
          setServiceName(info.serviceName || '');
          setCompanyNameInput(info.companyName || '');
          setCompanyAddress(info.address || '');
          setCompanyUrl(info.url || '');
          setCompanyItems(info.items || []);
        }

        let hasPermissionError = false

        try {
          const messagesQuery = query(collection(firestoreDb, `interviews/${interviewId}/messages`))
          messagesSnapshot = await getDocs(messagesQuery)
          hasMessages = messagesSnapshot.size > 0
        } catch (messagesError: any) {
          if (messagesError.code === 'permission-denied' || messagesError.message?.includes('permissions')) {
            hasPermissionError = true
          } else {
            console.warn('⚠️ メッセージの確認中にエラーが発生しました（続行）:', messagesError)
          }
        }

        // キャンセルや完了のみでは履歴を消さない（記事作成に必要）
        if (isTestMode && hasMessages && !hasPermissionError && loadedInterview.currentQuestionIndex === 0) {
          isInitializingRef.current = true

          // ローカル状態をリセット
          setCurrentQuestionIndex(0)
          setAudioCheckCompleted(false)
          audioCheckCompletedRef.current = false
          setHasStarted(false)
          setMessages([])
          messagesLengthRef.current = 0
          setListening(false)
          setProcessing(false)
          setPlayingQuestion(false)
          isRecognitionActiveRef.current = false

          // メッセージを削除（テストモード時の最初のみ）
          if (messagesSnapshot) {
            const deletePromises = messagesSnapshot.docs.map((mDoc: any) => deleteDoc(mDoc.ref))
            await Promise.all(deletePromises)
          }
        }

        setInterview(loadedInterview)

        const parsedQuestions = parseQuestions(loadedInterview.questions, loadedInterview.objective)
        const filteredQuestions = filterIntroductoryQuestions(parsedQuestions)
        setQuestions(filteredQuestions)
        questionsRef.current = filteredQuestions

        const resumeIndex = loadedInterview.currentQuestionIndex || 0
        setCurrentQuestionIndex(resumeIndex)
        currentQuestionIndexRef.current = resumeIndex

        if (loadedInterview.interviewerId) {
          const interviewerDocRef = doc(firestoreDb, 'interviewers', loadedInterview.interviewerId)
          const interviewerDocSnap = await getDoc(interviewerDocRef)
          if (interviewerDocSnap.exists()) {
            const interviewerData = interviewerDocSnap.data() as any
            const profile = {
              id: interviewerDocSnap.id,
              ...interviewerData,
              createdAt: interviewerData.createdAt?.toDate(),
              updatedAt: interviewerData.updatedAt?.toDate(),
            }
            setInterviewerProfile(profile)
            interviewerProfileRef.current = profile
          }
        }
      } else {
        console.error('❌ インタビューが見つかりません:', interviewId)
        alert('⚠️ インタビューが見つかりません')
        router.push('/')
      }

      isInitializingRef.current = false
    } catch (error) {
      console.error('❌ インタビューデータの読み込みエラー:', error)
    } finally {
      isLoadingDataRef.current = false
      setLoading(false)
    }
  }, [interviewId, router])

  const evaluateProgress = useCallback(async (conversationHistory: Array<{ role: string, content: string }>) => {
    if (!interview?.objective || !interview?.knowledgeBaseIds) return
    setEvaluatingProgress(true)
    try {
      const response = await fetch('/api/interview/evaluate-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationHistory,
          objective: interview.objective,
          interviewPurpose: interview.interviewPurpose || '',
          supplementaryInfo: interview.supplementaryInfo || '',
          knowledgeBaseIds: interview.knowledgeBaseIds || [],
        }),
      })
      if (!response.ok) throw new Error('進捗評価に失敗しました')
      const data = await response.json()
      if (data.success && data.evaluation) {
        setProgressEvaluation(data.evaluation)
      }
    } catch (error) {
      console.error('Error evaluating progress:', error)
    } finally {
      setEvaluatingProgress(false)
    }
  }, [interview?.objective, interview?.knowledgeBaseIds, interview?.interviewPurpose])

  // 考え中効果音用の参照
  const thinkingAudioContextRef = useRef<AudioContext | null>(null)
  const thinkingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const setupMessagesListener = useCallback(() => {
    // 既にリスナーが設定されている場合はスキップ（重複防止）
    if (messagesListenerUnsubscribeRef.current) {
      return messagesListenerUnsubscribeRef.current
    }

    const q = query(collection(getFirebaseDb(), `interviews/${interviewId}/messages`), orderBy('timestamp', 'asc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // 初期化中はメッセージリスナーを無視（ログを減らす）
      if (isInitializingRef.current) {
        return
      }

      // メッセージが存在し、かつインタビューが未開始、かつ完了もしていない場合のみ
      // (完了済みの場合は単に表示、アクティブでメッセージありは再開)
      const isComplete = interview?.status === 'completed'
      if (snapshot.size > 0 && !hasStartedRef.current && !isInitializingRef.current && !isLoadingDataRef.current && !isComplete) {
        // ログを削減（権限エラーでメッセージが残っている場合は正常な動作）
        // 初期化フラグをセットして、無限ループを防ぐ
        isInitializingRef.current = true

        // ローカル状態のみリセット（Firebaseの削除は権限エラーの可能性があるためスキップ）
        setMessages([])
        messagesLengthRef.current = 0
        setCurrentQuestionIndex(0)
        currentQuestionIndexRef.current = 0
        setAudioCheckCompleted(false)
        audioCheckCompletedRef.current = false
        setHasStarted(false)
        setListening(false)
        setProcessing(false)
        setPlayingQuestion(false)
        isRecognitionActiveRef.current = false
        setCurrentTranscript('')
        transcriptRef.current = ''

        // 初期化フラグを解除
        setTimeout(() => {
          isInitializingRef.current = false
        }, 2000)
        return
      }

      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
      })) as Message[]

      // インタビューがキャンセルされている場合でもメッセージを表示し続ける
      setMessages(newMessages)
      messagesLengthRef.current = newMessages.length // refも更新

      if (newMessages.length > 0 && interview?.objective) {
        const conversationHistory = newMessages.map(msg => ({ role: msg.role, content: msg.content || '' }))
        setTimeout(() => evaluateProgress(conversationHistory), 2000)
      }
    }, (error) => {
      console.error('Error listening to messages:', error)
    })
    return unsubscribe
  }, [interviewId, interview?.objective, interview?.status, evaluateProgress])

  useEffect(() => {
    if (interviewId) {
      loadInterviewData()
      // initializeSpeechRecognitionは後で定義されるため、ここでは呼び出さない
      // マイクテストや音声認識開始時に必要に応じて初期化される
    }
  }, [interviewId, loadInterviewData])

  // ページ読み込み時にスクロール位置を最上部に設定
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // インタビューデータが読み込まれたときにスクロール位置を最上部に設定
  useEffect(() => {
    if (!loading && interview) {
      window.scrollTo(0, 0)
    }
  }, [loading, interview])

  // interviewが読み込まれた後にメッセージリスナーを設定（初期化完了後）
  useEffect(() => {
    if (interviewId && interview && !loading) {
      // 既にリスナーが設定されている場合はスキップ
      if (messagesListenerUnsubscribeRef.current) {
        return
      }

      // 初期化が完了するまで待つ
      let unsubscribe: (() => void) | undefined = undefined
      const timer = setTimeout(() => {
        // 初期化中でないことを確認
        if (!isInitializingRef.current && !messagesListenerUnsubscribeRef.current) {
          unsubscribe = setupMessagesListener()
        } else {
          // 初期化中の場合は、もう少し待ってから再試行
          const retryTimer = setTimeout(() => {
            if (!isInitializingRef.current && !messagesListenerUnsubscribeRef.current) {
              unsubscribe = setupMessagesListener()
            }
          }, 2000)

          return () => {
            clearTimeout(retryTimer)
            if (unsubscribe && unsubscribe !== messagesListenerUnsubscribeRef.current) {
              unsubscribe()
            }
          }
        }
      }, 3000) // 初期化処理が完了するまで3秒待つ

      return () => {
        clearTimeout(timer)
        if (unsubscribe && unsubscribe !== messagesListenerUnsubscribeRef.current) {
          unsubscribe()
        }
      }
    }
  }, [interviewId, interview, loading, setupMessagesListener])

  // クリーンアップ：コンポーネントのアンマウント時にメッセージリスナーを解除
  useEffect(() => {
    return () => {
      if (messagesListenerUnsubscribeRef.current) {
        messagesListenerUnsubscribeRef.current()
        messagesListenerUnsubscribeRef.current = null
      }
    }
  }, [])

  // クリーンアップ用のuseEffect
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (recognitionRef.current && isRecognitionActiveRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) { /* ignore */ }
        isRecognitionActiveRef.current = false
      }
      streamRef.current?.getTracks().forEach(track => track.stop())
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
        silenceTimeoutRef.current = null
      }
      if (recognitionRestartTimeoutRef.current) {
        clearTimeout(recognitionRestartTimeoutRef.current)
        recognitionRestartTimeoutRef.current = null
      }
      startListeningRef.current = false
    }
  }, [])

  const generateIntroductionMessage = useCallback((): string => {
    if (!interview) return ''

    // 生成されたオープニングメッセージがあればそれを使用
    if (interview.openingMessage && interview.openingMessage.trim().length > 0) {
      return interview.openingMessage
    }

    // なければテンプレートに従って生成
    const accountName = companyName || 'BanKisha'
    const interviewerName = interview.interviewerName || interviewerProfile?.name || '担当者'
    const interviewName = interview.title || 'インタビュー'
    const target = interview.targetAudience || '皆様'
    const purpose = interview.interviewPurpose || 'お話'
    const media = interview.mediaType || '弊社メディア'

    return `本日はお忙しい中ご対応いただきありがとうございます。${accountName}の${interviewerName}と申します。今回は${interviewName}ということで、${target}のかたに向けて、${purpose}と考えておりまして、${media}に掲載予定です。それではさっそくインタビューに入らせていただきます。`
  }, [interview, interviewerProfile, companyName])

  const generateAudioCheckMessage = useCallback((): string => {
    // インタビュアー名の取得順序を修正（interview.interviewerNameを優先）
    const interviewerName = interview?.interviewerName || interviewerProfile?.name || 'インタビュアー'
    console.log('🎤 音声・マイク確認メッセージ生成時のインタビュアー名:', interviewerName)
    // マイクチェックと名前確認を兼ねる
    return `はじめにマイクのチェックを行います。まずはあなたのお名前を教えて下さい。`
  }, [interview, interviewerProfile])

  const handlePlayAudioCheck = useCallback(async (): Promise<void> => {
    // 一時停止中の場合は再開を待つ
    await waitForResume()

    if (!interviewerProfile) return
    const audioCheckText = generateAudioCheckMessage()
    if (!audioCheckText) return

    // テキスト読み上げ用に正規化（「〇〇」を相手の名前に置換）
    const normalizedAudioCheckText = normalizeTextForTTS(audioCheckText)

    // 音声設定を一貫して使用
    const voiceType = interviewerProfileRef.current?.voiceSettings?.voiceType || 'Puck'
    const speed = interviewerProfileRef.current?.voiceSettings?.speed || 1.0

    setPlayingQuestion(true)
    try {
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: normalizedAudioCheckText,
          voiceType: voiceType,
          speed: speed,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText }
        }
        console.error('❌ 音声生成APIエラー (AudioCheck):', {
          status: response.status,
          error: errorData,
          textLength: normalizedAudioCheckText.length,
        })
        const diag = `${errorData.error || '不明なエラー'} (${errorData.details || '詳細なし'})`
        throw new Error(`音声生成に失敗しました: ${response.status} - ${diag}`)
      }
      if (isStoppedRef.current) return
      // 一時停止した瞬間に再生が始まらないように再チェック
      if (isPausedRef.current) {
        await waitForResume()
      }
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      if (audioElementRef.current) audioElementRef.current.pause()
      const audio = new Audio(audioUrl)
      audioElementRef.current = audio
      audio.volume = volume

      await new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          setPlayingQuestion(false)
          URL.revokeObjectURL(audioUrl)
          resolve()
        }
        audio.onerror = (e) => {
          console.error('❌ 音声再生エラー:', e)
          setPlayingQuestion(false)
          URL.revokeObjectURL(audioUrl)
          reject(e)
        }
        audio.play().catch(reject)
      })
    } catch (error) {
      console.error('❌ 音声・マイク確認メッセージの読み上げエラー:', error)
      setPlayingQuestion(false)
      throw error
    }
  }, [interviewerProfile, generateAudioCheckMessage, volume, normalizeTextForTTS, waitForResume])

  const handlePlayIntroduction = useCallback(async (): Promise<void> => {
    console.log('📢 handlePlayIntroduction が呼び出されました', { hasInterviewerProfile: !!interviewerProfile })
    if (!interviewerProfile) {
      console.warn('⚠️ interviewerProfile がないため導入メッセージをスキップします')
      return
    }
    const introductionText = generateIntroductionMessage()
    console.log('📢 導入メッセージ内容:', introductionText)
    if (!introductionText) {
      console.warn('⚠️ 導入メッセージが空のためスキップします')
      return
    }

    // テキスト読み上げ用に正規化（「〇〇」を「なになに」に置換）
    const normalizedIntroductionText = normalizeTextForTTS(introductionText)

    // 音声設定を一貫して使用
    const voiceType = interviewerProfileRef.current?.voiceSettings?.voiceType || 'Puck'
    const speed = interviewerProfileRef.current?.voiceSettings?.speed || 1.0

    setPlayingQuestion(true)
    try {
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: normalizedIntroductionText,
          voiceType: voiceType,
          speed: speed,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText }
        }
        console.error('❌ 音声生成APIエラー (Introduction):', {
          status: response.status,
          error: errorData,
          textLength: normalizedIntroductionText.length,
        })
        const diag = `${errorData.error || '不明なエラー'} (${errorData.details || '詳細なし'})`
        throw new Error(`音声生成に失敗しました: ${response.status} - ${diag}`)
      }
      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      if (audioElementRef.current) audioElementRef.current.pause()
      const audio = new Audio(audioUrl)
      audioElementRef.current = audio
      audio.volume = volume

      await new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          setPlayingQuestion(false)
          URL.revokeObjectURL(audioUrl)
          resolve()
        }
        audio.onerror = (e) => {
          setPlayingQuestion(false)
          URL.revokeObjectURL(audioUrl)
          reject(new Error('音声の再生に失敗しました'))
        }
        audio.play().catch(reject)
      })
    } catch (error) {
      console.error('❌ 導入メッセージの読み上げエラー:', error)
      setPlayingQuestion(false)
      throw error
    }
  }, [interviewerProfile, generateIntroductionMessage, volume])

  // 考え中効果音を停止する関数
  const stopThinkingSound = useCallback(() => {
    if (thinkingIntervalRef.current) {
      clearInterval(thinkingIntervalRef.current)
      thinkingIntervalRef.current = null
    }
    if (thinkingAudioContextRef.current) {
      if (thinkingAudioContextRef.current.state !== 'closed') {
        thinkingAudioContextRef.current.close().catch(console.error)
      }
      thinkingAudioContextRef.current = null
    }
    console.log('🔇 考え中効果音を停止しました')
  }, [])

  // 考え中効果音を再生する関数（Web Audio APIを使用）

  const playThinkingSound = useCallback(() => {
    // 既に再生中の場合や一時停止中の場合は何もしない
    if (thinkingIntervalRef.current || isPausedRef.current) return

    console.log('🔊 考え中効果音を開始します')

    // 新しいAudioContextを作成
    thinkingAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()

    // 定期的に音を鳴らす関数
    const beep = () => {
      if (!thinkingAudioContextRef.current || thinkingAudioContextRef.current.state === 'closed') return

      const osc = thinkingAudioContextRef.current.createOscillator()
      const gain = thinkingAudioContextRef.current.createGain()

      osc.connect(gain)
      gain.connect(thinkingAudioContextRef.current.destination)

      // ポーンという優しい音
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, thinkingAudioContextRef.current.currentTime) // A5
      osc.frequency.exponentialRampToValueAtTime(440, thinkingAudioContextRef.current.currentTime + 0.1)

      gain.gain.setValueAtTime(0.05, thinkingAudioContextRef.current.currentTime) // 非常に小さい音量
      gain.gain.exponentialRampToValueAtTime(0.001, thinkingAudioContextRef.current.currentTime + 0.1)

      osc.start(thinkingAudioContextRef.current.currentTime)
      osc.stop(thinkingAudioContextRef.current.currentTime + 0.1)
    }

    // 初回再生
    beep()

    // 1.5秒ごとに再生（思考中であることを伝えるリズム）
    thinkingIntervalRef.current = setInterval(beep, 1500)

  }, [])


  const handleTogglePause = useCallback(() => {
    const nextPaused = !isPausedRef.current

    // If we're trying to resume, show confirmation modal instead of immediate resume
    if (!nextPaused) {
      setResumeConfirmOpen(true)
      return
    }

    // Pause logic
    setIsPaused(true)
    isPausedRef.current = true

    console.log('⏸️ 一時停止します')
    // 音声認識を停止
    if (recognitionRef.current && isRecognitionActiveRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) { /* ignore */ }
      isRecognitionActiveRef.current = false
      setListening(false)
    }
    // 再生中の音声を停止（質問読み上げ）
    if (audioElementRef.current) {
      audioElementRef.current.pause()
    }
    // 考え中効果音を停止
    stopThinkingSound()
  }, [playingQuestion, processing, hasStarted, stopThinkingSound, playThinkingSound])

  const handleResumeAndReRead = useCallback(() => {
    setIsPaused(false)
    isPausedRef.current = false
    console.log('▶️ 読み直して再開します')

    if (playingQuestion) {
      // 現在の質問を最初から再生
      handlePlayQuestion(currentQuestionIndexRef.current).catch(console.error)
    } else if (processing) {
      // 処理中なら効果音を再開
      playThinkingSound()
    } else if (hasStarted) {
      // 待機中なら今の質問を読み直す
      handlePlayQuestion(currentQuestionIndexRef.current).catch(console.error)
    }
  }, [playingQuestion, processing, hasStarted, handlePlayQuestion, playThinkingSound])


  // クリーンアップ用のuseEffect
  useEffect(() => {
    hasStartedRef.current = hasStarted
  }, [hasStarted])

  // マイクテストを実施する関数
  const performMicTest = useCallback(async (): Promise<boolean> => {
    console.log('🎤 マイクテストを開始します')
    setMicTestInProgress(true)
    setMicTestFailed(false)

    try {
      // マイクの利用可能性を確認
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('❌ このブラウザはマイクへのアクセスをサポートしていません。HTTPS接続またはlocalhostでアクセスしてください。')
        setMicTestFailed(true)
        setMicTestInProgress(false)
        return false
      }

      // 音声認識を初期化
      if (!recognitionRef.current) {
        console.log('🎤 音声認識を初期化します')
        initializeSpeechRecognition()
        if (!recognitionRef.current) {
          alert('❌ 音声認識の初期化に失敗しました。ChromeまたはEdgeブラウザをご使用ください。')
          setMicTestFailed(true)
          setMicTestInProgress(false)
          return false
        }
      }

      // マイクのアクセス許可を取得
      console.log('🎤 マイクへのアクセスを要求します...')
      let testStream: MediaStream | null = null
      try {
        testStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
        console.log('✅ マイクへのアクセスが許可されました')

        // マイクが正常に動作しているか確認
        const audioTracks = testStream.getAudioTracks()
        if (audioTracks.length === 0) {
          throw new Error('マイクが見つかりませんでした')
        }
        console.log('✅ マイクが検出されました:', audioTracks[0].label)

        // マイクの動作確認（短時間録音して確認）
        const testRecorder = new MediaRecorder(testStream)
        const testChunks: Blob[] = []
        testRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) testChunks.push(event.data)
        }

        // 1秒間録音してマイクの動作を確認
        testRecorder.start()
        await new Promise(resolve => setTimeout(resolve, 1000))
        testRecorder.stop()

        // 録音データが取得できたか確認
        await new Promise<void>((resolve) => {
          testRecorder.onstop = () => {
            const audioBlob = new Blob(testChunks, { type: 'audio/webm' })
            if (audioBlob.size > 0) {
              console.log('✅ マイクの録音テスト成功:', audioBlob.size, 'bytes')
              resolve()
            } else {
              console.warn('⚠️ マイクの録音データが取得できませんでした')
              resolve()
            }
          }
        })

        // テスト用ストリームを本番用のストリームとして使用（クリーンアップしない）
        streamRef.current = testStream
        const mediaRecorder = new MediaRecorder(testStream)
        mediaRecorderRef.current = mediaRecorder
        audioChunksRef.current = []
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data)
        }
        mediaRecorder.start()
        console.log('✅ 録音を開始しました')

        setMicTestPassed(true)
        setMicTestInProgress(false)
        return true

      } catch (error: any) {
        console.error('❌ マイクアクセスエラー:', error)

        // テスト用ストリームをクリーンアップ
        if (testStream) {
          testStream.getTracks().forEach(track => track.stop())
        }

        setMicTestFailed(true)
        setMicTestInProgress(false)

        // エラーの種類に応じて適切なメッセージを表示
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          alert('❌ マイクへのアクセスが拒否されました。ブラウザの設定でマイクの使用を許可してください。\n\n設定方法:\n1. ブラウザのアドレスバー左側の🔒アイコンをクリック\n2. 「マイク」を「許可」に変更\n3. ページを再読み込みしてください。')
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          alert('❌ マイクが見つかりませんでした。マイクが接続されているか確認してください。')
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
          alert('❌ マイクが他のアプリケーションで使用されています。他のアプリケーションを閉じてから再度お試しください。')
        } else {
          alert(`❌ マイクへのアクセスに失敗しました: ${error.message || error.name}\n\nHTTPS接続またはlocalhostでアクセスしているか確認してください。`)
        }

        return false
      }
    } catch (error: any) {
      console.error('❌ マイクテストエラー:', error)
      setMicTestFailed(true)
      setMicTestInProgress(false)
      alert(`❌ マイクテストに失敗しました: ${error.message || '不明なエラー'}`)
      return false
    }
  }, [])

  // ユーザーインタラクション後に音声を再生するハンドラー
  const handleStartInterview = useCallback(async () => {
    // 既に開始済みの場合はスキップ（重複実行防止）
    if (hasStarted) {
      console.log('⏸️ インタビューは既に開始済みのため、スキップします')
      return
    }
    if (!isTestMode && questions.length > 0 && currentQuestionIndex === 0 && messages.length === 0 && !playingQuestion && !hasStarted && interviewerProfile && interview && !loading) {
      setHasStarted(true)
      hasStartedRef.current = true // [FIX] レースコンディションを防ぐため、refを即座に更新
      try {
        console.log('🎤 インタビューを開始します')

        // 1. まずマイクテストを実施（導入メッセージの前）
        console.log('🎤 マイクテストを実施します')
        const micTestResult = await performMicTest()
        if (!micTestResult) {
          console.error('❌ マイクテストに失敗しました。インタビューを開始できません。')
          setHasStarted(false)
          return
        }
        console.log('✅ マイクテストが成功しました')

        // 2. 音声・マイク確認メッセージを再生
        console.log('🎤 音声・マイク確認メッセージを再生します')
        await handlePlayAudioCheck()
        console.log('✅ 音声・マイク確認メッセージの再生が完了しました')

        // 3. 音声認識を開始して、相手の名前を待つ
        console.log('🎤 音声認識を開始します（マイクテスト応答待ち）')
        await new Promise(resolve => setTimeout(resolve, 500))

        if (recognitionRef.current && !isRecognitionActiveRef.current) {
          console.log('🎤 音声認識を開始します')
          recognitionRef.current.start()
          setListening(true)
          isRecognitionActiveRef.current = true
          console.log('✅ 音声認識が開始されました（マイクテスト応答待ち）')
        } else if (isRecognitionActiveRef.current) {
          console.log('⚠️ 音声認識は既にアクティブです（スキップ）')
        }
      } catch (error) {
        console.error('❌ マイクテストまたは音声・マイク確認の読み上げに失敗:', error)
        setHasStarted(false)
        alert('❌ インタビューの開始に失敗しました。ページを再読み込みして再度お試しください。')
      }
    }
  }, [isTestMode, questions.length, currentQuestionIndex, messages.length, interviewerProfile, interview, loading, playingQuestion, hasStarted, handlePlayAudioCheck, processing, performMicTest])

  // 自動再生は無効化（ブラウザの自動再生ポリシーに準拠）
  // useEffect(() => {
  //   if (!isTestMode && questions.length > 0 && currentQuestionIndex === 0 && messages.length === 0 && !playingQuestion && !hasStarted && interviewerProfile && interview && !loading) {
  //     setHasStarted(true)
  //     setTimeout(async () => {
  //       try {
  //         await handlePlayIntroduction()
  //         setTimeout(() => handlePlayQuestion(0), 500)
  //       } catch (error) {
  //         console.error('❌ 導入メッセージまたは最初の質問の読み上げに失敗:', error)
  //         handlePlayQuestion(0)
  //       }
  //     }, 100)
  //   }
  // }, [questions, currentQuestionIndex, messages.length, interviewerProfile, interview, loading, playingQuestion, handlePlayQuestion, handlePlayIntroduction, isTestMode, hasStarted])

  const handleStartTestInterview = async () => {
    if (questions.length === 0 || !interviewerProfile) {
      alert('質問が生成されていないか、インタビュアープロファイルが読み込まれていません')
      return
    }
    setHasStarted(true)
    await handlePlayQuestion(0)
  }

  const initializeSpeechRecognition = () => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (!SpeechRecognition) {
        alert('❌ このブラウザは音声認識をサポートしていません。ChromeまたはEdgeブラウザをご使用ください。')
        return
      }
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'ja-JP'

      // transcriptRefは既にコンポーネントのトップレベルで定義されている
      transcriptRef.current = ''

      recognition.onresult = (event: any) => {
        // 質問の読み上げ中または処理中は入力を無視
        // ただし、完全に無視するのではなく、読み上げ開始から極端に短い時間の場合のみブロック
        const timeSincePlaybackStart = Date.now() - questionPlaybackStartTimeRef.current
        if (playingQuestionRef.current || processingRef.current) {
          // 読み上げ中または処理中はログのみ出力してスキップ
          if (event.results[event.results.length - 1].isFinal) {
            console.log('⏳ 読み上げ中または処理中のため、入力をスキップしました')
          }
          return
        }

        // 読み上げ直後（0.5秒以内）もエコーや残響を拾う可能性があるためブロック
        if (timeSincePlaybackStart < 500) {
          return
        }

        let interimTranscript = ''
        let newFinalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            newFinalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }

        if (newFinalTranscript) {
          transcriptRef.current += newFinalTranscript
          console.log('[onresult] final:', newFinalTranscript, 'total:', transcriptRef.current)
        }
        setCurrentTranscript(transcriptRef.current + interimTranscript)

        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current)

        // 一定時間の無音を検出したら自動的に送信（オートサブミッション）
        // マイクチェック中は2秒、通常の質問は3秒の無音で送信
        const isAudioCheckResponse = !audioCheckCompletedRef.current && messagesLengthRef.current === 0
        const timeoutDuration = isAudioCheckResponse ? 2000 : 3000

        if (transcriptRef.current.trim().length >= 2) {
          silenceTimeoutRef.current = setTimeout(() => {
            // 再度チェック（状態が変わっている可能性があるため）
            if (!processingRef.current && !playingQuestionRef.current && transcriptRef.current.trim().length >= 2) {
              const responseText = transcriptRef.current.trim()
              console.log(`[AutoSubmit] ${isAudioCheckResponse ? 'MicCheck' : 'Normal'}: "${responseText}"`)
              transcriptRef.current = ''
              setCurrentTranscript('')
              processResponse(responseText)
            }
          }, timeoutDuration)
        }
      }

      recognition.onstart = () => {
        isRecognitionActiveRef.current = true
        setListening(true)
      }

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          // no-speechエラーは正常な状態（ユーザーがまだ話していない場合など）
          // 自動的に再開しない（ループを防ぐ）
          console.log('🔇 音声が検出されませんでした（正常）')
          return
        }

        if (event.error === 'aborted') {
          isRecognitionActiveRef.current = false
          setListening(false)
          // abortedエラーの場合も自動的に再開しない（ユーザーが手動で停止した可能性がある）
          console.log('⏹️ 音声認識が中断されました')
          return
        }

        console.error('音声認識エラー:', event.error)
        isRecognitionActiveRef.current = false
        setListening(false)
      }

      recognition.onend = () => {
        isRecognitionActiveRef.current = false
        setListening(false)
        console.log('⏹️ 音声認識が終了しました')

        // 既存の再開タイマーをクリア
        if (recognitionRestartTimeoutRef.current) {
          clearTimeout(recognitionRestartTimeoutRef.current)
          recognitionRestartTimeoutRef.current = null
        }

        // continuous: trueでも、音声が検出されないと自動的に終了することがある
        // しかし、自動再開は無限ループの原因になるため、完全に無効化
        // ユーザーが手動で送信ボタンを押すか、次の質問が始まるまで待つ
        // 自動再開は行わない
      }
      recognitionRef.current = recognition
    }
  }

  const startListening = async () => {
    // 既にアクティブな場合は何もしない
    if (isRecognitionActiveRef.current) {
      console.log('⚠️ 音声認識は既にアクティブです')
      return
    }

    if (playingQuestion || processing) {
      console.log('⏸️ 質問の読み上げ中または処理中のため、音声認識を待機します')
      // 再試行のフラグをチェック（無限ループを防ぐ）
      if (startListeningRef.current) {
        console.log('⚠️ 既に再試行が予約されています')
        return
      }
      startListeningRef.current = true
      setTimeout(() => {
        startListeningRef.current = false
        if (!playingQuestion && !processing && !isRecognitionActiveRef.current) {
          startListening()
        }
      }, 2000) // 2秒待ってから再試行
      return
    }

    // マイクの利用可能性を確認
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('❌ このブラウザはマイクへのアクセスをサポートしていません。HTTPS接続またはlocalhostでアクセスしてください。')
      return
    }

    if (!recognitionRef.current) {
      console.log('🎤 音声認識を初期化します')
      initializeSpeechRecognition()
      if (!recognitionRef.current) {
        alert('❌ 音声認識の初期化に失敗しました。ChromeまたはEdgeブラウザをご使用ください。')
        return
      }
    }

    try {
      // マイクのアクセス許可を取得
      console.log('🎤 マイクへのアクセスを要求します...')
      if (!streamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
        console.log('✅ マイクへのアクセスが許可されました')
        streamRef.current = stream

        // マイクが正常に動作しているか確認
        const audioTracks = stream.getAudioTracks()
        if (audioTracks.length === 0) {
          throw new Error('マイクが見つかりませんでした')
        }
        console.log('✅ マイクが検出されました:', audioTracks[0].label)

        const mediaRecorder = new MediaRecorder(stream)
        mediaRecorderRef.current = mediaRecorder
        audioChunksRef.current = []
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data)
        }
        mediaRecorder.start()
        console.log('✅ 録音を開始しました')
      }

      if (recognitionRef.current && !isRecognitionActiveRef.current) {
        console.log('🎤 音声認識を開始します')
        recognitionRef.current.start()
      } else if (isRecognitionActiveRef.current) {
        console.log('⚠️ 音声認識は既にアクティブです（スキップ）')
      }
    } catch (error: any) {
      console.error('❌ マイクアクセスエラー:', error)
      isRecognitionActiveRef.current = false
      setListening(false)
      startListeningRef.current = false

      // エラーの種類に応じて適切なメッセージを表示
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('❌ マイクへのアクセスが拒否されました。ブラウザの設定でマイクの使用を許可してください。\n\n設定方法:\n1. ブラウザのアドレスバー左側の🔒アイコンをクリック\n2. 「マイク」を「許可」に変更\n3. ページを再読み込みしてください。')
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        alert('❌ マイクが見つかりませんでした。マイクが接続されているか確認してください。')
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        alert('❌ マイクが他のアプリケーションで使用されています。他のアプリケーションを閉じてから再度お試しください。')
      } else {
        alert(`❌ マイクへのアクセスに失敗しました: ${error.message || error.name}\n\nHTTPS接続またはlocalhostでアクセスしているか確認してください。`)
      }
    }
  }

  const processResponse = useCallback(async (transcript: string) => {
    // 一時停止中の場合は処理を開始しない
    if (isPausedRef.current) {
      console.log('⏳ 一時停止中のため、入力を保留します')
      return
    }

    if (processing || !transcript.trim()) return




    console.log(`[processResponse START] transcript: "${transcript.substring(0, 30)}...", currentIndex: ${currentQuestionIndexRef.current}, audioCheckCompleted: ${audioCheckCompletedRef.current}, messages: ${messagesLengthRef.current}`)



    setProcessing(true)
    setListening(false)
    transcriptRef.current = ''
    setCurrentTranscript('')



    // 「もう一度」「繰り返し」「聞こえなかった」などの再読み上げリクエストを検出

    const reReadKeywords = ['もう一度', '繰り返し', '繰り返して', '聞こえなかった', '聞こえません', '聞き取れなかった', '聞き取れません', 'もう一回', 'もういちど', 'もういっかい', 'もう一度お願い', 'もう一度お願いします', 'もう一度言って', 'もう一度言ってください', 'もう一度言って下さい', 'もう一度言ってもらえますか', 'もう一度言ってもらえませんか', 'もう一度言ってもらえますか？', 'もう一度言ってもらえませんか？']

    const transcriptLower = transcript.toLowerCase().trim()

    const isReReadRequest = reReadKeywords.some(keyword => transcriptLower.includes(keyword.toLowerCase()))



    // マイクチェック完了後、かつ再読み上げリクエストの場合

    if (isReReadRequest && audioCheckCompletedRef.current && currentQuestionIndexRef.current >= 0 && questionsRef.current.length > currentQuestionIndexRef.current) {

      console.log('🔄 再読み上げリクエストを検出:', transcript)

      setProcessing(false)

      setCurrentTranscript('')



      // 現在の質問を再読み上げ

      const currentIndex = currentQuestionIndexRef.current

      if (currentIndex >= 0 && currentIndex < questionsRef.current.length) {

        console.log('▶️ 現在の質問を再読み上げします:', currentIndex)

        // 音声認識を停止

        if (recognitionRef.current && isRecognitionActiveRef.current) {

          try {

            recognitionRef.current.stop()

          } catch (e) { console.error('音声認識の停止エラー:', e) }

          isRecognitionActiveRef.current = false

        }

        // 質問を再読み上げ

        setTimeout(() => {

          handlePlayQuestion(currentIndex).catch(error => {

            console.error('❌ 質問の再読み上げに失敗:', error)

            setProcessing(false)

          })

        }, 500)

      }

      return

    }



    // 音声・マイク確認の応答を処理（最初の応答の場合）

    // refを使用して最新の状態を取得（クロージャの問題を回避）

    console.log('🔍 processResponse 状態確認:', {

      audioCheckCompleted: audioCheckCompletedRef.current,

      messagesLength: messagesLengthRef.current,

      currentQuestionIndex: currentQuestionIndexRef.current,

      transcriptLength: transcript.trim().length,

      questionsLength: questionsRef.current.length

    })



    // マイクチェック完了後（audioCheckCompletedがtrue）の場合は、通常の応答処理に進む

    // マイクチェック未完了（audioCheckCompletedがfalse）かつメッセージが0件の場合のみ、マイクチェック処理を行う

    if (!audioCheckCompletedRef.current && messagesLengthRef.current === 0) {

      console.log('🎤 音声・マイク確認の応答を受信:', transcript)

      setAudioCheckCompleted(true)

      audioCheckCompletedRef.current = true // refも更新



      if (recognitionRef.current && isRecognitionActiveRef.current) {

        try {

          recognitionRef.current.stop()

        } catch (e) { console.error('音声認識の停止エラー:', e) }

        isRecognitionActiveRef.current = false

      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {

        mediaRecorderRef.current.stop()

      }



      // 効果音を確実に再生（ユーザーインタラクション後なので再生可能）

      try {

        console.log('🔊 効果音を再生します（マイクチェック応答）')

        await playKnockSound()

      } catch (e) {

        console.error('❌ 効果音の再生に失敗:', e)

      }



      // 音声・マイク確認の応答をメッセージに保存
      const micCheckAudioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })

      await addDoc(collection(getFirebaseDb(), `interviews/${interviewId}/messages`), {

        role: 'interviewee',

        content: transcript,

        audioUrl: URL.createObjectURL(micCheckAudioBlob),

        timestamp: serverTimestamp(),

      })



      // 名前を聞いた後の反応を追加（インタビュアーの音声設定を使用）
      try {
        // マイクテスト成功のフィードバックを明示的に
        const reactionText = `ありがとうございます。お声、しっかり届いていますよ。マイクの状態も良好ですね。`

        const normalizedReaction = normalizeTextForTTS(reactionText)

        // インタビュアーの音声設定を確実に使用

        const reactionVoiceType = interviewerProfileRef.current?.voiceSettings?.voiceType || interview?.interviewerVoiceType || 'Puck'

        const reactionSpeed = interviewerProfileRef.current?.voiceSettings?.speed || interview?.interviewerSpeed || 1.0



        const reactionAudioResponse = await fetch('/api/text-to-speech', {

          method: 'POST',

          headers: { 'Content-Type': 'application/json' },

          body: JSON.stringify({ text: normalizedReaction, voiceType: reactionVoiceType, speed: reactionSpeed }),

        })



        if (!reactionAudioResponse.ok) {
          const errorText = await reactionAudioResponse.text()
          let errorData
          try {
            errorData = JSON.parse(errorText)
          } catch {
            errorData = { error: errorText }
          }
          console.error('❌ 音声生成APIエラー (Reaction):', {
            status: reactionAudioResponse.status,
            error: errorData,
          })
          const diag = `${errorData.error || '不明なエラー'} (${errorData.details || '詳細なし'})`
          console.warn('⚠️ 反応の音声生成に失敗しました（続行）:', reactionAudioResponse.status, diag)
          return
        }

        const reactionAudioBlob = await reactionAudioResponse.blob()

        const reactionAudioUrl = URL.createObjectURL(reactionAudioBlob)

        const reactionAudio = new Audio(reactionAudioUrl)



        await new Promise<void>((resolve, reject) => {

          reactionAudio.onended = () => {

            URL.revokeObjectURL(reactionAudioUrl)

            resolve()

          }

          reactionAudio.onerror = () => {

            URL.revokeObjectURL(reactionAudioUrl)

            resolve() // エラーでも続行

          }

          reactionAudio.play().catch(reject)

        })



        await addDoc(collection(getFirebaseDb(), `interviews/${interviewId}/messages`), {

          role: 'interviewer',

          content: reactionText,

          audioUrl: reactionAudioUrl,

          timestamp: serverTimestamp(),

        })


      } catch (error) {

        console.error('❌ 反応生成エラー:', error)

        // エラーでも続行

      }



      // messagesLengthRefはメッセージリスナーで自動更新されるため、ここでは更新しない



      // 音声・マイク確認の応答を分析（マイクの状態を確認）

      const responseLower = transcript.toLowerCase()

      const hasAudioIssue = responseLower.includes('聞こえない') || responseLower.includes('聞こえません') ||

        (responseLower.includes('マイク') && (responseLower.includes('動かない') || responseLower.includes('動作') && responseLower.includes('しない')))



      if (hasAudioIssue) {

        console.log('⚠️ 音声・マイクに問題がある可能性があります')

        alert('⚠️ 音声・マイクに問題がある可能性があります。マイクの設定を確認してください。')

        // 問題がある場合は、インタビューを中断するか、ユーザーに確認する

        const shouldContinue = confirm('音声・マイクに問題がある可能性がありますが、インタビューを続行しますか？')

        if (!shouldContinue) {

          setHasStarted(false)

          return

        }

      }



      // 導入メッセージを再生してから最初の質問に進む
      // ↓ ここではまだ processing を false にしない（導入メッセージの再生が終わるまで待つ）
      // setProcessing(false) 
      setCurrentTranscript('')

      audioChunksRef.current = []

      if (streamRef.current && mediaRecorderRef.current) {

        mediaRecorderRef.current = new MediaRecorder(streamRef.current)

        mediaRecorderRef.current.ondataavailable = (event) => {

          if (event.data.size > 0) audioChunksRef.current.push(event.data)

        }

        mediaRecorderRef.current.start()

      }



      // 導入メッセージを再生
      try {
        console.log('📢 導入メッセージの再生を開始します...')
        await handlePlayIntroduction()
        console.log('✅ 導入メッセージの再生が完了しました')

      } catch (error) {

        console.error('❌ 導入メッセージの読み上げに失敗:', error)

        // エラーが発生しても最初の質問に進む

      }



      // 最初の質問に進む（導入メッセージ再生完了後、確実に実行）

      // refを使用して最新の質問リストを取得（クロージャの問題を回避）

      const currentQuestions = questionsRef.current

      if (currentQuestions.length > 0) {

        const startQuestionIndex = 0 // 質問リストは既にフィルタリング済み



        // 質問インデックスを設定

        setCurrentQuestionIndex(startQuestionIndex)

        currentQuestionIndexRef.current = startQuestionIndex



        console.log('🎤 最初の質問を再生します（マイクチェック完了後）', {

          questionsLength: currentQuestions.length,

          questionsState: questions.length,

          questionIndex: startQuestionIndex,

          questionPreview: currentQuestions[startQuestionIndex]?.substring(0, 50) || 'N/A'

        })
        // 一時停止中の場合は再開を待つ
        await waitForResume()
        // 少し待ってから質問を再生（導入メッセージの音声が完全に終了してから）

        setTimeout(async () => {

          try {

            // refを使用して最新の質問リストを取得（状態が変わっている可能性があるため）

            const latestQuestions = questionsRef.current

            if (latestQuestions.length > startQuestionIndex && latestQuestions[startQuestionIndex]) {

              console.log('▶️ 最初の質問を再生します:', {

                questionsLength: latestQuestions.length,

                questionsState: questions.length,

                questionIndex: startQuestionIndex,

                questionPreview: latestQuestions[startQuestionIndex].substring(0, 50)

              })

              await handlePlayQuestion(startQuestionIndex)
              console.log('✅ 最初の質問の再生を開始しました')
              setProcessing(false)

            } else {

              console.error('❌ 質問が存在しません（再生時）', {
                questionsLength: latestQuestions.length,
              })
              setProcessing(false)
            }
          } catch (error) {
            console.error('❌ 最初の質問の再生に失敗:', error)
            setProcessing(false)
            alert('❌ 最初の質問の再生に失敗しました。ページを再読み込みしてください。')
          }

        }, 500) // 0.5秒待つ（導入メッセージの音声が完全に終了してから）

      } else {

        console.error('❌ 質問が存在しません（マイクチェック完了後）', {

          questionsLength: currentQuestions.length,

          questionsState: questions.length,

          questionsRef: questionsRef.current.length

        })

        setProcessing(false)

        alert('❌ 質問が存在しません。インタビューを再作成してください。')

      }

      return

    }



    // 通常の応答処理（マイクチェック完了後）

    // audioCheckCompletedがfalseの場合は、trueに設定（質問に答えた後は通常の応答処理に進む）

    if (!audioCheckCompletedRef.current) {

      console.log('🔄 audioCheckCompletedをtrueに設定します（質問に答えた後）')

      setAudioCheckCompleted(true)

      audioCheckCompletedRef.current = true

    }

    console.log('💬 通常の応答処理を開始:', {

      audioCheckCompleted: audioCheckCompletedRef.current,

      messagesLength: messagesLengthRef.current,

      currentQuestionIndex: currentQuestionIndexRef.current,

      transcriptLength: transcript.trim().length

    })

    // 効果音を確実に再生（ユーザーインタラクション後なので再生可能）

    try {

      console.log('🔊 効果音を再生します（話が終わったことを認識）')

      await playKnockSound()

    } catch (e) {

      console.error('❌ 効果音の再生に失敗:', e)

    }



    if (recognitionRef.current && isRecognitionActiveRef.current) {

      try {

        recognitionRef.current.stop()

      } catch (e) { console.error('音声認識の停止エラー:', e) }

      isRecognitionActiveRef.current = false

    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop()



    try {


      const userResponse = transcript.trim()



      const interviewDocRef = doc(getFirebaseDb(), 'interviews', interviewId)

      const interviewDocSnap = await getDoc(interviewDocRef)

      if (interviewDocSnap.exists() && interviewDocSnap.data().rehearsalMessages?.length > 0) {

        await updateDoc(interviewDocRef, { rehearsalMessages: [], updatedAt: serverTimestamp() })

      }



      const userAudioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
      const audioUrl = URL.createObjectURL(userAudioBlob)

      await addDoc(collection(getFirebaseDb(), `interviews/${interviewId}/messages`), {
        role: 'interviewee',
        content: userResponse,
        audioUrl: audioUrl,
        timestamp: serverTimestamp(),
      })



      audioChunksRef.current = []

      if (streamRef.current && mediaRecorderRef.current) {

        mediaRecorderRef.current = new MediaRecorder(streamRef.current)

        mediaRecorderRef.current.ondataavailable = (event) => {

          if (event.data.size > 0) audioChunksRef.current.push(event.data)

        }

        mediaRecorderRef.current.start()

      }



      // 相槌と評価を並列で開始して高速化
      console.log('⚡ 相槌と評価を並列で開始します')
      playThinkingSound()

      const reactionPromise = (async () => {
        try {
          const reactionResponse = await fetch('/api/interview/generate-reaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userResponse,
              interviewerPrompt: interviewerProfile?.prompt || '',
              reactionPatterns: interviewerProfile?.reactionPatterns || '',
              knowledgeBaseIds: interview?.knowledgeBaseIds || []
            })
          })
          if (reactionResponse.ok) return await reactionResponse.json()
        } catch (e) { console.error('❌ 相槌生成失敗:', e) }
        return { reaction: '承知いたしました。' }
      })()

      const evaluationPromise = (async () => {
        try {
          const currentIndex = currentQuestionIndexRef.current
          const currentQuestionsList = questionsRef.current
          const currentQuestion = currentQuestionsList[currentIndex] || "インタビュー"

          const historyForAI = [...messages, { role: 'interviewee', content: userResponse }].map(msg => ({
            role: msg.role === 'user' ? 'interviewee' : (msg.role === 'interviewee' ? 'interviewee' : 'interviewer'),
            content: msg.content || ''
          }))

          const evaluationResponse = await fetch('/api/interview/evaluate-response', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: currentQuestion,
              userResponse,
              interviewObjective: interview?.objective || '',
              supplementaryInfo: interview?.supplementaryInfo || '',
              conversationHistory: historyForAI
            })
          })
          if (evaluationResponse.ok) return await evaluationResponse.json()
        } catch (e) { console.error('❌ 評価失敗:', e) }
        return null
      })()

      // 1. 相槌の再生を優先して体感速度を上げる
      const reactionData = await reactionPromise

      if (reactionData?.reaction && !isStoppedRef.current) {
        const reactionVoiceType = interviewerProfileRef.current?.voiceSettings?.voiceType || interview?.interviewerVoiceType || 'Puck'
        const reactionSpeed = interviewerProfileRef.current?.voiceSettings?.speed || interview?.interviewerSpeed || 1.0
        const normalizedReaction = normalizeTextForTTS(reactionData.reaction)

        const reactionAudioResponse = await fetch('/api/text-to-speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: normalizedReaction, voiceType: reactionVoiceType, speed: reactionSpeed }),
        })

        if (!reactionAudioResponse.ok) {
          const errorText = await reactionAudioResponse.text()
          let errorData
          try {
            errorData = JSON.parse(errorText)
          } catch {
            errorData = { error: errorText }
          }
          console.warn('⚠️ 反応の音声生成に失敗しました（続行）:', reactionAudioResponse.status, errorData.details || errorData.error || '不明なエラー')
          // 失敗しても本体の処理は続ける
        } else if (!isStoppedRef.current) {
          const reactionAudioBlob = await reactionAudioResponse.blob()
          const reactionAudioUrl = URL.createObjectURL(reactionAudioBlob)
          const reactionAudio = new Audio(reactionAudioUrl)

          await new Promise<void>((resolve) => {
            stopThinkingSound()
            reactionAudio.onended = () => {
              URL.revokeObjectURL(reactionAudioUrl)
              resolve()
            }
            reactionAudio.onerror = () => {
              URL.revokeObjectURL(reactionAudioUrl)
              resolve()
            }
            reactionAudio.play().catch(resolve)
          })

          if (!isStoppedRef.current) {
            await addDoc(collection(getFirebaseDb(), `interviews/${interviewId}/messages`), {
              role: 'interviewer',
              content: reactionData.reaction,
              audioUrl: reactionAudioUrl,
              timestamp: serverTimestamp(),
            })
          }
        }
      }

      // 2. 評価結果を確認
      playThinkingSound() // 再度「考え中」を表示
      const evaluationResult = await evaluationPromise

      if (isStoppedRef.current) return

      if (evaluationResult?.evaluation) {
        const evalData = evaluationResult.evaluation
        console.log('📊 回答評価結果:', evalData)

        // 終了意図の確認
        if (evalData.userStopIntent) {
          console.log('🛑 ユーザーの終了意図を検知しました')
          setIsInterviewComplete(true)
          setProcessing(false)
          stopThinkingSound()

          // ステータスを完了に更新
          await updateDoc(doc(getFirebaseDb(), 'interviews', interviewId), {
            status: 'completed',
            updatedAt: serverTimestamp()
          })
          return
        }

        // 深掘りが必要な場合
        if (!evalData.isSufficient && evalData.followUpQuestion) {
          console.log('🔍 深掘り質問を使用します:', evalData.followUpQuestion)
          const newQuestions = [...questionsRef.current]
          const nextIndex = currentQuestionIndexRef.current + 1

          if (!newQuestions.includes(evalData.followUpQuestion)) {
            newQuestions.splice(nextIndex, 0, evalData.followUpQuestion)
            setQuestions(newQuestions)
            questionsRef.current = newQuestions

            setCurrentQuestionIndex(nextIndex)
            currentQuestionIndexRef.current = nextIndex

            stopThinkingSound()
            setProcessing(false)
            setTimeout(() => handlePlayQuestion(nextIndex).catch(console.error), 500)
            return
          }
        }
      }

      // 3. 次の予定質問へ
      const nextIndex = currentQuestionIndexRef.current + 1
      const finalQuestions = questionsRef.current

      if (nextIndex < finalQuestions.length) {
        console.log('▶️ 次の予定質問へ進みます:', nextIndex)
        setCurrentQuestionIndex(nextIndex)
        currentQuestionIndexRef.current = nextIndex
        stopThinkingSound()
        setProcessing(false)
        setTimeout(() => handlePlayQuestion(nextIndex).catch(console.error), 500)
        return
      }

      // 4. 完了処理（質問切れ）
      console.log('🏁 質問が終了しました。完了メッセージを再生します。')
      const finalMessage = '貴重なお話をありがとうございました。これでインタビューを終了いたします。'
      const normalizedFinalMessage = normalizeTextForTTS(finalMessage)
      const finalVoiceType = interviewerProfileRef.current?.voiceSettings?.voiceType || interview?.interviewerVoiceType || 'Puck'
      const finalSpeed = interviewerProfileRef.current?.voiceSettings?.speed || interview?.interviewerSpeed || 1.0

      const finalAudioResponse = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: normalizedFinalMessage, voiceType: finalVoiceType, speed: finalSpeed }),
      })

      if (!finalAudioResponse.ok) {
        const errorText = await finalAudioResponse.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText }
        }
        console.error('❌ 音声生成APIエラー (Final):', {
          status: finalAudioResponse.status,
          error: errorData,
        })
        const diag = `${errorData.error || '不明なエラー'} (${errorData.details || '詳細なし'})`
        throw new Error(`音声生成に失敗しました: ${finalAudioResponse.status} - ${diag}`)
      } else if (!isStoppedRef.current) {
        const finalAudioBlob = await finalAudioResponse.blob()
        const finalAudioUrl = URL.createObjectURL(finalAudioBlob)
        const finalAudio = new Audio(finalAudioUrl)

        await new Promise<void>((resolve) => {
          stopThinkingSound()
          finalAudio.onended = () => { resolve() }
          finalAudio.onerror = () => { resolve() }
          finalAudio.play().catch(resolve)
        })

        await addDoc(collection(getFirebaseDb(), `interviews/${interviewId}/messages`), {
          role: 'interviewer',
          content: finalMessage,
          audioUrl: finalAudioUrl,
          timestamp: serverTimestamp(),
        })
      }

      await updateDoc(doc(getFirebaseDb(), 'interviews', interviewId), {
        status: 'completed',
        updatedAt: serverTimestamp()
      })
      setIsInterviewComplete(true)
      setProcessing(false)
    } catch (error) {
      console.error('❌ processResponse 致命的エラー:', error)
      setProcessing(false)
    } finally {
      setProcessing(false)
    }
  }, [
    interviewId,
    messages,
    interview,
    interviewerProfile,
    questions,
    normalizeTextForTTS,
    handlePlayQuestion,
    handlePlayIntroduction,
    playKnockSound,
    playThinkingSound,
    stopThinkingSound,
    waitForResume
  ])

  useEffect(() => {
    if (messages.length > 0 && !startTime) {
      setStartTime(new Date())
    }
  }, [messages.length, startTime])

  const currentQuestion = useMemo(() => questions[currentQuestionIndex], [questions, currentQuestionIndex]);

  // requiredElements extracted from interview objective for the checklist
  const requiredElements = useMemo(() => {
    if (!interview?.objective) return [];
    // Extract bullet points or items separated by newlines/punctuation
    return interview.objective
      .split(/[\n、。・]/)
      .map(item => item.trim())
      .filter(item => item.length > 1 && item.length < 20)
      .slice(0, 8); // Limit to reasonable number
  }, [interview?.objective]);

  return (
    <>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="text-center">
            <LoaderIcon className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
          </div>
        </div>
      ) : !interview ? (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <Card className="p-6 text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">インタビューが見つかりません</h2>
            <Button onClick={() => router.push('/')}>ホームに戻る</Button>
          </Card>
        </div>
      ) : (
        <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
          {/* 統合型固定ヘッダー */}
          <header className="flex-none bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-30 shadow-sm sticky top-0">
            <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
              {/* 1段目: タイトルと操作ボタン */}
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 line-clamp-1">
                    {interview.title || 'インタビュー'}
                  </h1>
                  {interview.intervieweeName && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {interview.intervieweeName}
                      {interview.intervieweeCompany && ` (${interview.intervieweeCompany})`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* 補足情報ボタン（モーダル） */}
                  <Button onClick={() => setCompanyInfoOpen(true)} className="h-10 rounded-full px-3 py-2 text-sm" variant="outline" size="sm"><BuildingIcon className="w-4 h-4 mr-2" />補足情報を入力</Button>

                  <Button
                    onClick={async () => {
                      if (confirm('インタビューを終了しますか？ここまでの内容は保存され、記事を作成することができます。')) {
                        setIsInterviewComplete(true)
                        setProcessing(false)
                        stopThinkingSound()
                        try {
                          const firestoreDb = getFirebaseDb()
                          await updateDoc(doc(firestoreDb, 'interviews', interviewId), {
                            status: 'completed', // 中止ではなく完了として扱い、記事作成を可能にする
                            updatedAt: serverTimestamp()
                          })
                        } catch (e) {
                          console.error('終了処理エラー:', e)
                        }
                      }
                    }}
                    className="h-10 w-10 p-0 rounded-full shadow-sm text-red-500 border-red-100 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
                    variant="outline"
                    size="icon"
                    title="中止"
                  >
                    <SquareIcon className="w-5 h-5" />
                  </Button>

                  {/* 再開確認モーダル */}
                  <Dialog open={resumeConfirmOpen} onOpenChange={(open) => setResumeConfirmOpen(open)}>
                    <DialogContent className="max-w-sm">
                      <DialogHeader>
                        <DialogTitle>反復処理を続行しますか?</DialogTitle>
                        <DialogDescription>再開すると、音声認識と質問の再生が再開されます。</DialogDescription>
                      </DialogHeader>
                      <div className="flex justify-end gap-2 mt-4">
                        <Button variant="ghost" onClick={() => setResumeConfirmOpen(false)}>キャンセル</Button>
                        <Button onClick={() => { setResumeConfirmOpen(false); handleResumeAndReRead(); }}>続行</Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                </div>
              </div>

              {/* 2段目: 進捗メーターと概要 */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 py-1">
                {!isInterviewComplete && questions.length > 0 && (
                  <div className="flex-1">
                    <div className="flex justify-between items-center text-[11px] text-gray-400 mb-1 font-medium">
                      <span>PROGRESS {Math.min(100, Math.round((currentQuestionIndex / questions.length) * 100))}%</span>
                      <span>{currentQuestionIndex} / {questions.length}</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-500 ease-out"
                        style={{ width: `${Math.min(100, (currentQuestionIndex / questions.length) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {interviewerProfile && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-100 dark:border-gray-700 flex-shrink-0">
                    {interviewerProfile.photoURL ? (
                      <div className="relative w-6 h-6 rounded-full overflow-hidden">
                        <Image src={interviewerProfile.photoURL} alt={interviewerProfile.name || 'I'} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                        <span className="text-white text-[10px] font-bold">{interviewerProfile.name?.charAt(0) || 'I'}</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300 truncate leading-none">
                        {interviewerProfile.name}
                      </p>
                      <p className="text-[9px] text-gray-500 dark:text-gray-400 truncate leading-tight mt-0.5">
                        {interviewerProfile.role || 'Interviewer'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* 3段目: 質問予定リストと必須項目 */}
              <div className="flex flex-col gap-2">
                {questions.length > 0 && !isInterviewComplete && (
                  <div className="space-y-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCompanyInfoOpen(true)}
                      className="w-full flex items-center justify-center gap-2 text-xs py-1.5 h-auto border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:text-primary hover:border-primary transition-all bg-gray-50/50 dark:bg-gray-800/30"
                    >
                      <PlusCircleIcon className="w-3.5 h-3.5" />
                      <span>会社・サービス情報を補足する</span>
                    </Button>

                    <details className="group">
                      <summary className="list-none cursor-pointer flex items-center gap-2 text-[11px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 font-semibold transition-colors">
                        <FileTextIcon className="w-3.5 h-3.5" />
                        <span>質問予定リスト ({currentQuestionIndex}/{questions.length})</span>
                        <span className="group-open:rotate-180 transition-transform text-[8px] ml-auto">▼</span>
                      </summary>
                      <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
                        {questions.map((q, idx) => (
                          <div key={idx} className={`text-[11px] p-2.5 rounded-lg transition-all ${idx === currentQuestionIndex ? 'bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 shadow-sm font-medium' : idx < currentQuestionIndex ? 'text-gray-400 bg-gray-50/50 dark:bg-gray-800/20' : 'text-gray-500 bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700'}`}>
                            <div className="flex gap-2">
                              <span className="font-bold opacity-30 w-4 flex-shrink-0">{idx + 1}.</span>
                              <span>{q}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}

                {!isInterviewComplete && requiredElements && requiredElements.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {requiredElements.map((element: string, idx: number) => {
                      // AIの進捗評価結果から対応する項目を探す
                      const evaluationItem = progressEvaluation?.items?.find((item: any) =>
                        item.objective.trim() === element.trim()
                      )

                      const isComplete = evaluationItem?.status === 'complete'
                      const isPartial = evaluationItem?.status === 'partial'

                      // フォールバックとして従来のキーワード一致も併用
                      const hasKeywordMatch = messages.some(m =>
                        (m.role === 'interviewee' || m.role === 'user') && m.content?.includes(element)
                      )

                      const isCollected = isComplete || (!evaluationItem && hasKeywordMatch)

                      return (
                        <div
                          key={idx}
                          className={`text-[10px] px-2.5 py-1 rounded-full border flex items-center gap-1.5 transition-all ${isCollected
                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 font-semibold group cursor-default'
                            : isPartial
                              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                              : 'bg-white text-gray-400 border-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700'
                            }`}
                          title={evaluationItem?.reason || ''}
                        >
                          {isCollected ? (
                            <CheckCircleIcon className="w-3 h-3 text-green-500" />
                          ) : isPartial ? (
                            <div className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                          ) : (
                            <div className="w-3 h-3 rounded-full border border-gray-300" />
                          )}
                          {element}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* スクロール可能なチャットエリア */}
          <main className="flex-1 overflow-y-auto px-4 py-8 scroll-smooth z-0">
            <div className="max-w-3xl mx-auto space-y-8">
              {/* 会話開始前の状態表示 */}
              {!hasStarted && (
                <div className="grid gap-6">
                  {/* 音量調整 */}
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <Volume2Icon className="w-4 h-4 text-blue-500" />
                        スピーカー音量
                      </h3>
                      <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/40 px-2 py-1 rounded">
                        {Math.round(volume * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  {/* インタビュー種別表示 */}
                  <div className="flex items-center gap-3 px-5 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-md text-white">
                    <MicIcon className="w-5 h-5 opacity-80" />
                    <span className="text-sm font-bold tracking-wide">本番インタビューを開始します</span>
                  </div>
                </div>
              )}

              {/* 会話履歴 */}
              <div className="space-y-6">
                {messages.map((message, index) => (
                  <div key={message.id || index} className={`flex gap-4 ${message.role === 'interviewer' ? 'justify-start' : 'justify-end'}`}>
                    {message.role === 'interviewer' && interviewerProfile && (
                      <div className="flex-shrink-0 mt-1">
                        {interviewerProfile.photoURL ? (
                          <div className="relative w-10 h-10 rounded-full border-2 border-white dark:border-gray-800 shadow-sm overflow-hidden">
                            <Image src={interviewerProfile.photoURL} alt="I" fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
                            {interviewerProfile.name?.charAt(0)}
                          </div>
                        )}
                      </div>
                    )}
                    <div className={`max-w-[85%] rounded-2xl px-5 py-4 shadow-sm ${message.role === 'interviewer' ? 'bg-white text-gray-800 dark:bg-gray-800 dark:text-gray-100 rounded-tl-none border border-gray-100 dark:border-gray-700' : 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-tr-none'}`}>
                      <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                  </div>
                ))}

                {/* 自動スクロール用Ref */}
                <div ref={messagesEndRef} className="h-4" />

                {/* ユーザー入力中表示 */}
                {listening && currentTranscript && (
                  <div className="flex flex-col items-end gap-3 animate-in fade-in slide-in-from-bottom-2">
                    <div className="max-w-[85%] rounded-2xl px-5 py-4 bg-blue-50 dark:bg-blue-800/40 text-blue-800 dark:text-blue-100 rounded-tr-none border border-blue-100 dark:border-blue-800/80">
                      <p className="text-[15px] leading-relaxed italic opacity-80">{currentTranscript}</p>
                    </div>
                    <Button
                      onClick={() => {
                        if (currentTranscript.trim().length > 0) {
                          const responseText = currentTranscript.trim()
                          transcriptRef.current = ''
                          setCurrentTranscript('')
                          processResponse(responseText)
                        }
                      }}
                      disabled={processing || currentTranscript.trim().length === 0}
                      className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg rounded-full px-6 py-2 h-auto text-sm font-bold"
                    >
                      回答を送信
                    </Button>
                  </div>
                )}

                {/* システム処理中表示 */}
                {processing && !isInterviewComplete && (
                  <div className="flex gap-4 justify-start animate-in fade-in">
                    {interviewerProfile && (
                      <div className="flex-shrink-0 mt-1">
                        {interviewerProfile.photoURL ? (
                          <div className="relative w-10 h-10 rounded-full border-2 border-white dark:border-gray-800 shadow-sm overflow-hidden grayscale">
                            <Image src={interviewerProfile.photoURL} alt="I" fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 font-bold">
                            {interviewerProfile.name?.charAt(0)}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl px-5 py-4 shadow-sm border border-gray-100 dark:border-gray-700 rounded-tl-none">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">回答を分析しています</span>
                        <div className="flex gap-1.5">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 完了メッセージ */}
                {isInterviewComplete && questions.length > 0 && (
                  <div className="flex gap-4 justify-start animate-in zoom-in-95 duration-300">
                    {interviewerProfile && (
                      <div className="flex-shrink-0 mt-1">
                        {interviewerProfile.photoURL ? (
                          <div className="relative w-10 h-10 rounded-full border-2 border-white dark:border-gray-800 shadow-sm overflow-hidden">
                            <Image src={interviewerProfile.photoURL} alt="I" fill className="object-cover" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                            {interviewerProfile.name?.charAt(0)}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl px-6 py-6 border-2 border-green-100 dark:border-green-800/60 shadow-lg max-w-[85%] rounded-tl-none">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center flex-shrink-0">
                          <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-300" />
                        </div>
                        <div className="flex-1">
                          <p className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2">
                            {interview?.interviewSource === 'other' ? 'インタビューが終了しました！' : 'インタビューが完了しました！'}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                            {interview?.interviewSource === 'other'
                              ? '取材にご協力いただき、誠にありがとうございました。内容はメディア担当者へ共有されます。'
                              : 'すべての質問への回答、ありがとうございました。この音声は正しく記録されました。'}
                          </p>

                          {/* 告知系インタビュー用の詳細入力 */}
                          <div className="mb-6 bg-white dark:bg-gray-800 p-4 rounded-xl border border-green-200 dark:border-green-800/50">
                            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                              <SparklesIcon className="w-3 h-3 text-blue-500" />
                              {isAnnouncementType ? '告知詳細情報（日時・場所・URLなど）' : '追加の補足情報'}
                            </label>
                            <textarea
                              value={extraInfo}
                              onChange={(e) => setExtraInfo(e.target.value)}
                              placeholder={isAnnouncementType ? "開催日時、会場、参加費、URLなどの詳細情報を入力してください。これらは記事の末尾に整理して記載されます。" : "その他、記事に含めたい日時や場所などの補足情報があれば入力してください。"}
                              className="w-full p-3 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-green-500 transition-all min-h-[100px]"
                            />
                            {isAnnouncementType && (
                              <p className="text-[10px] text-gray-500 mt-2">
                                ※告知系インタビューでは、この情報を基に記事の末尾に詳細セクションを作成します。
                              </p>
                            )}
                          </div>

                          <Button
                            onClick={async () => {
                              try {
                                setUpdatingExtraInfo(true)
                                await updateDoc(doc(getFirebaseDb(), 'interviews', interviewId), {
                                  supplementaryInfo: extraInfo,
                                  updatedAt: serverTimestamp()
                                })

                                if (interview?.interviewSource === 'other') {
                                  // 他薦（ゲスト）の場合は、終了のメッセージを表示するか、安全なページへ
                                  alert('インタビューを終了しました。ご協力ありがとうございました！')
                                  router.push('/dashboard') // または適切なサンクスページ
                                } else {
                                  router.push(`/dashboard/articles/new?interviewId=${interviewId}`)
                                }
                              } catch (e) {
                                console.error('Error updating info:', e)
                                alert('保存に失敗しました')
                              } finally {
                                setUpdatingExtraInfo(false)
                              }
                            }}
                            disabled={updatingExtraInfo}
                            className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-xl h-11 text-base font-bold rounded-xl ring-offset-2 hover:ring-2 ring-green-500 transition-all"
                          >
                            {updatingExtraInfo ? (
                              <LoaderIcon className="w-5 h-5 animate-spin mr-2" />
                            ) : (
                              interview?.interviewSource === 'other'
                                ? <CheckCircleIcon className="w-5 h-5 mr-2" />
                                : <FileTextIcon className="w-5 h-5 mr-2" />
                            )}
                            {updatingExtraInfo
                              ? '保存中...'
                              : (interview?.interviewSource === 'other' ? 'インタビューを終了する' : '情報を保存して記事を作成する')}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* インタビュー開始ボタン（最下部に配置） */}
              {!hasStarted && !isTestMode && questions.length > 0 && currentQuestionIndex === 0 && messages.length === 0 && interviewerProfile && interview && !loading && (
                <div className="pt-10 pb-20 animate-in fade-in slide-in-from-bottom-5 duration-500">
                  <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-2xl border border-gray-100 dark:border-gray-700 text-center space-y-8 overflow-hidden relative">
                    {/* 装飾用背景 */}
                    <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-3xl opacity-50" />
                    <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-purple-50 dark:bg-purple-900/10 rounded-full blur-3xl opacity-50" />

                    <div className="relative z-10 space-y-4">
                      <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
                        インタビューを開始する準備ができました
                      </h2>
                      <p className="text-gray-600 dark:text-gray-400 text-base leading-relaxed max-w-sm mx-auto">
                        マイクテストを実施し、正常に音声が取得できるかを確認して取材を開始します。
                      </p>
                    </div>

                    <div className="relative z-10 max-w-xs mx-auto space-y-4">
                      {micTestInProgress && (
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-2xl flex items-center justify-center gap-3 text-blue-700 dark:text-blue-300 animate-pulse">
                          <LoaderIcon className="w-5 h-5 animate-spin" />
                          <span className="text-sm font-bold">マイクチェック中...</span>
                        </div>
                      )}
                      {micTestFailed && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-2xl flex items-center justify-center gap-3 text-red-700 dark:text-red-300">
                          <SquareIcon className="w-5 h-5" />
                          <span className="text-sm font-bold">マイクが見つかりません</span>
                        </div>
                      )}
                      {micTestPassed && (
                        <div className="p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-2xl flex items-center justify-center gap-3 text-green-700 dark:text-green-300">
                          <CheckCircleIcon className="w-5 h-5" />
                          <span className="text-sm font-bold tracking-wider">マイク接続 OK</span>
                        </div>
                      )}

                      <Button
                        onClick={handleStartInterview}
                        className="w-full h-16 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-xl hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 transition-all duration-300 group overflow-hidden"
                        disabled={loading || playingQuestion || micTestInProgress}
                      >
                        <div className="relative z-10 flex items-center justify-center gap-3">
                          {loading || micTestInProgress ? (
                            <LoaderIcon className="w-6 h-6 animate-spin" />
                          ) : (
                            <>
                              <MicIcon className="w-6 h-6 group-hover:animate-bounce" />
                              <span className="text-lg font-black tracking-widest uppercase">インタビューを始める</span>
                            </>
                          )}
                        </div>
                        {/* ボタン内アニメーション */}
                        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      )}
      {/* 会社・サービス情報補足ダイアログ */}
      <Dialog open={companyInfoOpen} onOpenChange={(open) => {
        if (!open) handleSaveCompanyInfo() // 閉じる時に即時保存
        setCompanyInfoOpen(open)
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BuildingIcon className="w-5 h-5 text-primary" />
              <span>会社・サービス情報を補足する</span>
            </DialogTitle>
            <DialogDescription>
              ここに入力した情報は記事執筆の際、会社概要やサービス紹介として活用されます。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>サービス名</Label>
                <Input
                  placeholder="例: BanKisha"
                  value={serviceName}
                  onChange={(e) => {
                    setServiceName(e.target.value)
                    scheduleSaveCompanyInfo()
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>会社名</Label>
                <Input
                  placeholder="例: 株式会社インプレッション"
                  value={companyNameInput}
                  onChange={(e) => {
                    setCompanyNameInput(e.target.value)
                    scheduleSaveCompanyInfo()
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>所在地</Label>
                <Input
                  placeholder="例: 東京都渋谷区..."
                  value={companyAddress}
                  onChange={(e) => {
                    setCompanyAddress(e.target.value)
                    scheduleSaveCompanyInfo()
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>URL</Label>
                <Input
                  placeholder="https://..."
                  value={companyUrl}
                  onChange={(e) => {
                    setCompanyUrl(e.target.value)
                    scheduleSaveCompanyInfo()
                  }}
                />
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold">追加情報（自由項目）</Label>
                <Button variant="ghost" size="sm" onClick={handleAddCompanyItem} className="h-8 py-0 gap-1 text-primary">
                  <PlusIcon className="w-4 h-4" />
                  <span>項目を追加</span>
                </Button>
              </div>

              <div className="space-y-3">
                {companyItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start group">
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="項目名 (例: 設立)"
                        value={item.label}
                        onChange={(e) => {
                          handleUpdateCompanyItem(idx, 'label', e.target.value)
                          scheduleSaveCompanyInfo()
                        }}
                        className="h-8 text-xs font-semibold bg-gray-50/50"
                      />
                      <Textarea
                        placeholder="内容 (例: 2024年4月)"
                        value={item.value}
                        onChange={(e) => {
                          handleUpdateCompanyItem(idx, 'value', e.target.value)
                          scheduleSaveCompanyInfo()
                        }}
                        className="min-h-[60px] text-sm py-2"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        handleRemoveCompanyItem(idx)
                        scheduleSaveCompanyInfo()
                      }}
                      className="h-8 w-8 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                {companyItems.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed rounded-xl bg-gray-50/50 dark:bg-gray-800/20">
                    <p className="text-xs text-gray-400">追加の会社情報はありません</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between border-t pt-4">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {savingCompanyInfo ? (
                <>
                  <LoaderIcon className="w-3 h-3 animate-spin" />
                  <span>保存中...</span>
                </>
              ) : (
                <>
                  <CheckCircleIcon className="w-3 h-3 text-green-500" />
                  <span>自動保存済み</span>
                </>
              )}
            </div>
            <Button onClick={() => setCompanyInfoOpen(false)}>閉じる</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function VoiceChatInterviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoaderIcon className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    }>
      <VoiceChatInterviewContent />
    </Suspense>
  )
}