'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { getFirebaseDb } from '@/src/lib/firebase'
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeftIcon, LoaderIcon, SaveIcon, SparklesIcon, MessageSquareIcon, MicIcon, PauseIcon, PlayCircleIcon, StopCircleIcon, CheckCircleIcon, XIcon, AlertCircleIcon } from 'lucide-react'
import { FeedbackDialog } from '@/components/feedback/FeedbackDialog'
import Link from 'next/link'
// スキルナレッジベースはサーバー側で自動取得されるため、インポート不要
import { InterviewerProfile, Company } from '@/src/types'
import { getCompany } from '@/src/lib/firestore'

// 条件付き質問の型定義
interface ConditionalQuestion {
  text: string
  condition?: {
    dependsOn: number // 依存する質問のインデックス（0ベース）
    requiredElements: string[] // 必要な要素（例: ['会社名', '役職', '業務']）
  }
}

type QuestionItem = string | ConditionalQuestion

// 質問テキストを配列にパースする関数（条件付き質問対応）
const parseQuestionsFromText = (questionsText: string): QuestionItem[] => {
  if (!questionsText || !questionsText.trim()) return []

  const lines = questionsText.split('\n').filter(line => line.trim())
  const questions: QuestionItem[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    // 条件付き質問のパターンをチェック
    // 例: "[条件: 質問1で会社名・役職・業務が得られなかった場合] 質問2の内容"
    const conditionalMatch = trimmed.match(/^\[条件:\s*質問(\d+)で(.+?)が得られなかった場合\]\s*(.+)$/)
    if (conditionalMatch) {
      const dependsOnIndex = parseInt(conditionalMatch[1]) - 1 // 1ベースから0ベースに変換
      const requiredElements = conditionalMatch[2].split(/[・、,]/).map(e => e.trim()).filter(e => e)
      const questionText = conditionalMatch[3].trim()

      questions.push({
        text: questionText,
        condition: {
          dependsOn: dependsOnIndex,
          requiredElements: requiredElements
        }
      })
      continue
    }

    // 通常の質問（番号付き）
    const cleaned = trimmed.replace(/^\d+[\.\)、]\s*/, '').trim()
    if (cleaned && cleaned.length > 0) {
      questions.push(cleaned)
    }
  }

  return questions.length > 0 ? questions : [questionsText.trim()]
}

// 質問のテキストを取得する関数
const getQuestionText = (question: QuestionItem): string => {
  return typeof question === 'string' ? question : question.text
}

// 条件付き質問かどうかをチェックする関数
const isConditionalQuestion = (question: QuestionItem): question is ConditionalQuestion => {
  return typeof question === 'object' && question !== null && 'condition' in question
}

// 質問をテキスト形式に変換する関数（保存用）
const questionsToText = (questions: QuestionItem[]): string => {
  return questions.map((q, index) => {
    if (typeof q === 'string') {
      return `${index + 1}. ${q}`
    } else {
      const condition = q.condition
      if (condition) {
        const requiredElements = condition.requiredElements.join('・')
        return `[条件: 質問${condition.dependsOn + 1}で${requiredElements}が得られなかった場合] ${q.text}`
      }
      return `${index + 1}. ${q.text}`
    }
  }).join('\n')
}

// 条件付き質問が実行可能かチェックする関数
// 記事生成の観点から、これまでの会話全体を評価して判断
const checkConditionalQuestion = async (
  question: ConditionalQuestion,
  previousAnswers: Array<{ question: string, answer: string }>,
  interviewObjective: string,
  skillKnowledgeContext?: string
): Promise<boolean> => {
  if (!question.condition) return true

  const { dependsOn, requiredElements } = question.condition

  // 依存する質問の回答を取得
  if (dependsOn >= previousAnswers.length) {
    return false // まだ回答がない
  }

  const previousAnswer = previousAnswers[dependsOn]
  if (!previousAnswer || !previousAnswer.answer) {
    return true // 回答がない場合は条件を満たす（追加質問が必要）
  }

  // 記事生成の観点から、これまでの会話全体を評価
  // 個別の質問の回答ではなく、全体で記事が書けるだけの情報が揃っているかを判断
  try {
    // 会話履歴を構築（質問と回答のペア）
    const conversationHistory: Array<{ role: string, content: string }> = []
    for (let i = 0; i < previousAnswers.length; i++) {
      conversationHistory.push({
        role: 'interviewer',
        content: previousAnswers[i].question
      })
      conversationHistory.push({
        role: 'interviewee',
        content: previousAnswers[i].answer
      })
    }

    const evaluationResponse = await fetch('/api/interview/evaluate-response', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: previousAnswer.question,
        userResponse: previousAnswer.answer,
        interviewObjective: interviewObjective,
        conversationHistory: conversationHistory, // 全体の会話履歴を渡す
        skillKnowledgeContext: skillKnowledgeContext, // スキルナレッジベースのコンテキスト
        requiredElements: requiredElements // 必要な要素を指定
      }),
    })

    if (evaluationResponse.ok) {
      const evaluationData = await evaluationResponse.json()
      // 記事生成に必要な情報が不足している場合、条件付き質問を実行
      // 評価は記事生成の観点から行われるため、isSufficientがfalseの場合は追加質問が必要
      return !evaluationData.evaluation?.isSufficient
    }
  } catch (error) {
    console.error('Error checking conditional question:', error)
    // エラーの場合は条件を満たす（安全側に倒す）
    return true
  }

  return true
}

export default function RehearsalPage() {
  const params = useParams()
  const interviewId = params.id as string
  const { user } = useAuth()
  const router = useRouter()

  const [interview, setInterview] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [questionsText, setQuestionsText] = useState('')
  const [questionsList, setQuestionsList] = useState<QuestionItem[]>([])
  const [generatingQuestions, setGeneratingQuestions] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userFeedback, setUserFeedback] = useState('')
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false)

  // リハーサル関連の状態
  const [interviewerProfile, setInterviewerProfile] = useState<InterviewerProfile | null>(null)
  const [companyName, setCompanyName] = useState<string>('')
  const [rehearsalMessages, setRehearsalMessages] = useState<Array<{ role: 'interviewer' | 'interviewee', content: string }>>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isRehearsalActive, setIsRehearsalActive] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [listening, setListening] = useState(false)
  const [playingQuestion, setPlayingQuestion] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const [currentQuestionText, setCurrentQuestionText] = useState<string>('') // 現在の質問テキスト
  const [totalQuestions, setTotalQuestions] = useState<number>(0) // 総質問数
  const [micTestPassed, setMicTestPassed] = useState(false) // マイクテストが成功したか
  const [micTestFailed, setMicTestFailed] = useState(false) // マイクテストが失敗したか
  const [micTestInProgress, setMicTestInProgress] = useState(false) // マイクテスト実施中か

  // リハーサル用のref
  const recognitionRef = useRef<any>(null)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isRecognitionActiveRef = useRef<boolean>(false)
  const processingRef = useRef<boolean>(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const currentQuestionIndexRef = useRef<number>(0)
  const transcriptRef = useRef<string>('')
  const reactionAudioRef = useRef<HTMLAudioElement | null>(null)
  const questionPlaybackStartTimeRef = useRef<number>(0) // 質問の読み上げ開始時刻
  const questionsListRef = useRef<QuestionItem[]>([]) // 質問リストのref（クロージャの問題を回避）
  const interviewerProfileRef = useRef<typeof interviewerProfile>(null) // インタビュアープロファイルのref（クロージャの問題を回避）
  const processNextQuestionCallRef = useRef<boolean>(false) // processNextQuestionの重複実行を防ぐ

  useEffect(() => {
    if (interviewId && user) {
      loadInterview()
    }
  }, [interviewId, user])

  const loadInterview = async () => {
    try {
      setLoading(true)
      const firestoreDb = getFirebaseDb()
      const docRef = doc(firestoreDb, 'interviews', interviewId)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data()
        setInterview({
          id: docSnap.id,
          ...data
        })

        // 質問を読み込む
        if (data.questions) {
          setQuestionsText(data.questions)
          const parsed = parseQuestionsFromText(data.questions)
          setQuestionsList(parsed)
          questionsListRef.current = parsed // refも更新
          setTotalQuestions(parsed.length) // 総質問数を設定
        }

        // リハーサル会話履歴を読み込む
        if (data.rehearsalMessages && Array.isArray(data.rehearsalMessages)) {
          setRehearsalMessages(data.rehearsalMessages.map((msg: any) => ({
            role: msg.role,
            content: msg.content
          })))
        }

        // インタビュアープロファイルを読み込む
        if (data.interviewerId) {
          const interviewerDocRef = doc(getFirebaseDb(), 'interviewers', data.interviewerId)
          const interviewerDocSnap = await getDoc(interviewerDocRef)
          if (interviewerDocSnap.exists()) {
            const interviewerData = interviewerDocSnap.data() as any
            const profile = {
              id: interviewerDocSnap.id,
              ...interviewerData,
              createdAt: interviewerData.createdAt?.toDate() || new Date(),
              updatedAt: interviewerData.updatedAt?.toDate() || new Date(),
            }
            setInterviewerProfile(profile)
            interviewerProfileRef.current = profile // refも更新
          }
        }

        // 会社名を読み込む
        if (data.companyId) {
          const company = await getCompany(data.companyId)
          if (company) {
            setCompanyName(company.name)
          }
        }
      } else {
        alert('⚠️ インタビューが見つかりません')
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Error loading interview:', error)
      alert('❌ インタビューの読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateQuestions = async () => {
    if (!interview) {
      alert('⚠️ インタビューデータが読み込まれていません')
      return
    }

    try {
      setGeneratingQuestions(true)

      // スキルナレッジベースはサーバー側で自動取得されるため、クライアント側では空配列を送信
      // 機密保護のため、クライアント側からはスキルナレッジベースのIDを送信しない
      const knowledgeBaseIds: string[] = []

      const response = await fetch('/api/interview/generate-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          interviewId: interviewId,
          category: interview.category || '',
          targetAudience: interview.targetAudience || '',
          mediaType: interview.mediaType || '',
          interviewPurpose: interview.interviewPurpose || '',
          objective: interview.objective || '',
          interviewerPrompt: interview.interviewerPrompt || '',
          interviewerName: interviewerProfile?.name || interview.interviewerName || '', // インタビュアー名を渡す
          knowledgeBaseIds: knowledgeBaseIds,
          previousQuestions: questionsList.length > 0 ? questionsToText(questionsList) : undefined,
          userFeedback: userFeedback.trim() || undefined,
          intervieweeName: interview.intervieweeName,
          intervieweeCompany: interview.intervieweeCompany,
          intervieweeTitle: interview.intervieweeTitle,
          intervieweeDepartment: interview.intervieweeDepartment,
          intervieweeType: interview.intervieweeType,
          confirmNameAtInterview: interview.confirmNameAtInterview,
          confirmCompanyAtInterview: interview.confirmCompanyAtInterview,
          confirmTitleAtInterview: interview.confirmTitleAtInterview,
          confirmDepartmentAtInterview: interview.confirmDepartmentAtInterview,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '質問の生成に失敗しました')
      }

      const data = await response.json()
      setQuestionsText(data.questions)

      // 質問をパースして配列に変換
      const parsed = parseQuestionsFromText(data.questions)
      setQuestionsList(parsed)
      questionsListRef.current = parsed // refも更新

      // フィードバックをクリア
      setUserFeedback('')

      alert('✅ 質問を生成しました！')
    } catch (error) {
      console.error('Error generating questions:', error)
      alert('❌ 質問の生成に失敗しました: ' + (error instanceof Error ? error.message : String(error)))
    } finally {
      setGeneratingQuestions(false)
    }
  }

  const handleSaveQuestions = async () => {
    if (!interviewId) {
      alert('⚠️ インタビューIDが取得できません')
      return
    }

    try {
      setSaving(true)

      // 質問テキストを更新
      const questionsToSave = questionsList.length > 0
        ? questionsToText(questionsList)
        : questionsText.trim()

      await updateDoc(doc(getFirebaseDb(), 'interviews', interviewId), {
        questions: questionsToSave,
        updatedAt: serverTimestamp()
      })

      alert('✅ 質問を保存しました！')
    } catch (error) {
      console.error('Error saving questions:', error)
      alert('❌ 質問の保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  const handleQuestionsTextChange = (text: string) => {
    setQuestionsText(text)
    const parsed = parseQuestionsFromText(text)
    setQuestionsList(parsed)
    questionsListRef.current = parsed // refも更新
  }

  // 導入メッセージを生成する関数
  const generateIntroductionMessage = (): string => {
    // 保存されたオープニングメッセージがあればそれを使用
    if (interview?.openingMessage) {
      return interview.openingMessage
    }

    // なければテンプレートに従って生成
    const accountName = companyName || 'BanKisha'
    const interviewerName = interviewerProfile?.name || '担当者'
    const interviewName = interview?.title || 'インタビュー'
    const target = interview?.targetAudience || '皆様'
    const purpose = interview?.interviewPurpose || 'お話'
    const media = interview?.mediaType || '弊社メディア'

    return `本日はお忙しい中ご対応いただきありがとうございます。${accountName}の${interviewerName}と申します。今回は${interviewName}ということで、${target}のかたに向けて、${purpose}と考えておりまして、${media}に掲載予定です。それではさっそくインタビューに入らせていただきます。`
  }

  // 導入メッセージを読み上げる関数
  const handlePlayIntroduction = async (): Promise<void> => {
    const currentInterviewerProfile = interviewerProfileRef.current || interviewerProfile

    if (!currentInterviewerProfile) {
      console.warn('⚠️ インタビュアープロファイルが読み込まれていません')
      return
    }

    const introductionText = generateIntroductionMessage()

    if (!introductionText || !introductionText.trim()) {
      console.warn('⚠️ 導入メッセージが生成されませんでした')
      return
    }

    console.log('🎤 導入メッセージを読み上げます:', introductionText.substring(0, 100) + '...')

    try {
      setPlayingQuestion(true)

      // Text-to-Speech APIを呼び出し
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: introductionText,
          voiceType: currentInterviewerProfile.voiceSettings?.voiceType || 'Puck',
          speed: currentInterviewerProfile.voiceSettings?.speed || 1.0,
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
        console.error('❌ 音声生成APIエラー (Rehearsal Introduction):', {
          status: response.status,
          error: errorData,
        })
        const diag = `${errorData.error || '不明なエラー'} (${errorData.details || '詳細なし'})`
        throw new Error(`音声生成に失敗しました: ${response.status} - ${diag}`)
      }

      const audioBlob = await response.blob()
      if (audioBlob.size === 0) {
        throw new Error('音声データが空です')
      }

      const audioUrl = URL.createObjectURL(audioBlob)

      // 音声を再生
      if (audioElementRef.current) {
        audioElementRef.current.pause()
        audioElementRef.current = null
      }
      const audio = new Audio(audioUrl)
      audioElementRef.current = audio

      await new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          console.log('✅ 導入メッセージの読み上げ完了')
          setPlayingQuestion(false)
          URL.revokeObjectURL(audioUrl)
          resolve()
        }

        audio.onerror = (e) => {
          console.error('❌ 導入メッセージの音声再生エラー:', e)
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
  }

  // 音声認識の初期化（performMicTestより前に定義）
  const initializeSpeechRecognition = useCallback(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'ja-JP'

        recognition.onresult = (event: any) => {
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

          // 質問の読み上げ開始直後（3秒以内）は質問の音声を誤認識する可能性があるため、無視する
          const timeSinceQuestionStart = Date.now() - questionPlaybackStartTimeRef.current
          if (timeSinceQuestionStart < 3000 && playingQuestion) {
            console.log('⚠️ 質問の読み上げ直後のため、音声認識結果を無視します:', {
              timeSinceQuestionStart,
              playingQuestion
            })
            return
          }

          if (newFinalTranscript) {
            transcriptRef.current += newFinalTranscript
          }

          const fullTranscript = transcriptRef.current + interimTranscript
          setCurrentTranscript(fullTranscript)

          // ユーザーが話し始めた場合、質問の読み上げまたは反応の音声再生を中断
          if (interimTranscript.trim() || newFinalTranscript.trim()) {
            if (audioElementRef.current && !audioElementRef.current.paused) {
              audioElementRef.current.pause()
              console.log('⏸️ ユーザーが話し始めたため、質問の読み上げを中断')
            }
            // 反応の音声再生も中断
            if (reactionAudioRef.current && !reactionAudioRef.current.paused) {
              const interruptedReaction = reactionAudioRef.current
              const reactionText = interruptedReaction.getAttribute('data-reaction-text') || ''
              reactionAudioRef.current.pause()
              reactionAudioRef.current = null
              console.log('⏸️ ユーザーが話し始めたため、反応の音声再生を中断')

              // 反応が中断された場合、反応をメッセージとして追加し、次の質問へ進む
              if (reactionText) {
                setRehearsalMessages(prev => {
                  // 既に反応が追加されているかチェック
                  const hasReaction = prev.some(msg =>
                    msg.role === 'interviewer' && msg.content === reactionText
                  )

                  if (!hasReaction) {
                    const finalMessages = [...prev, {
                      role: 'interviewer' as const,
                      content: reactionText
                    }]

                    // 反応追加後、すぐに次の質問を処理
                    // processingRefをfalseに設定してからprocessNextQuestionを呼ぶ
                    processingRef.current = false
                    setProcessing(false)
                    stopProcessingSound() // 処理中の効果音を停止
                    processNextQuestionCallRef.current = false // 呼び出しフラグをリセット

                    setTimeout(() => {
                      processNextQuestion(finalMessages)
                    }, 100)

                    return finalMessages
                  } else {
                    // 既に反応が追加されている場合、次の質問を処理
                    // processingRefをfalseに設定してからprocessNextQuestionを呼ぶ
                    processingRef.current = false
                    setProcessing(false)
                    stopProcessingSound() // 処理中の効果音を停止
                    processNextQuestionCallRef.current = false // 呼び出しフラグをリセット

                    setTimeout(() => {
                      processNextQuestion(prev)
                    }, 100)
                    return prev
                  }
                })
              }
            }
          }
        }

        recognition.onerror = (event: any) => {
          console.error('❌ 音声認識エラー:', event.error)
          if (event.error === 'no-speech' || event.error === 'aborted') {
            isRecognitionActiveRef.current = false
            setListening(false)
            return
          }
        }

        recognition.onend = () => {
          isRecognitionActiveRef.current = false
          setListening(false)
        }

        recognitionRef.current = recognition
      }
    }
  }, [playingQuestion, setRehearsalMessages, setCurrentTranscript, setListening, setProcessing])

  // マイクテストを実施する関数
  const performMicTest = useCallback(async (): Promise<boolean> => {
    console.log('🎤 マイクテストを開始します（リハーサル）')
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
  }, [initializeSpeechRecognition])

  // リハーサル機能のハンドラー
  const handleStartRehearsal = async () => {
    // questionsListRefを使用して最新の値を確認
    const currentQuestionsList = questionsListRef.current.length > 0 ? questionsListRef.current : questionsList

    if (currentQuestionsList.length === 0) {
      alert('⚠️ 質問がありません。まず質問を生成・保存してください。')
      return
    }

    if (!interviewerProfile) {
      alert('⚠️ インタビュアープロファイルが読み込まれていません')
      return
    }

    console.log('🚀 リハーサル開始:', {
      questionsCount: currentQuestionsList.length,
      interviewerProfile: !!interviewerProfile
    })

    // 1. まずマイクテストを実施（導入メッセージの前）
    console.log('🎤 マイクテストを実施します（リハーサル）')
    const micTestResult = await performMicTest()
    if (!micTestResult) {
      console.error('❌ マイクテストに失敗しました。リハーサルを開始できません。')
      return
    }
    console.log('✅ マイクテストが成功しました（リハーサル）')

    setIsRehearsalActive(true)
    setIsPaused(false)
    setIsComplete(false)
    setCurrentQuestionIndex(0)
    currentQuestionIndexRef.current = 0
    setRehearsalMessages([])
    setCurrentTranscript('')

    // 音声認識を初期化
    initializeSpeechRecognition()

    // 少し待ってから導入メッセージを読み上げ、その後最初の質問を読み上げ
    setTimeout(async () => {
      try {
        // まず導入メッセージを読み上げ
        await handlePlayIntroduction()

        // 導入メッセージの後に少し待ってから最初の質問を読み上げ
        setTimeout(async () => {
          try {
            await handlePlayQuestion(0)
          } catch (error) {
            console.error('❌ 最初の質問の読み上げに失敗:', error)
            alert(`❌ 質問の読み上げに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
            setIsRehearsalActive(false)
          }
        }, 500)
      } catch (error) {
        console.error('❌ 導入メッセージの読み上げに失敗:', error)
        // 導入メッセージに失敗しても、最初の質問を読み上げる
        try {
          await handlePlayQuestion(0)
        } catch (questionError) {
          console.error('❌ 最初の質問の読み上げに失敗:', questionError)
          alert(`❌ 質問の読み上げに失敗しました: ${questionError instanceof Error ? questionError.message : '不明なエラー'}`)
          setIsRehearsalActive(false)
        }
      }
    }, 100)
  }

  const handleStopRehearsal = () => {
    setIsPaused(true)
    setIsRehearsalActive(false)

    // 音声認識を停止
    if (recognitionRef.current && isRecognitionActiveRef.current) {
      try {
        recognitionRef.current.stop()
        isRecognitionActiveRef.current = false
      } catch (e) {
        console.error('音声認識の停止エラー:', e)
      }
    }

    // 音声再生を停止
    if (audioElementRef.current) {
      audioElementRef.current.pause()
      audioElementRef.current = null
    }

    // メディアストリームを停止
    if (typeof window !== 'undefined') {
      const stopMedia = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          stream.getTracks().forEach(track => track.stop())
        } catch (e) {
          // すでに停止している場合は無視
        }
      }
      stopMedia()
    }

    setListening(false)
    setPlayingQuestion(false)
    setProcessing(false)
  }

  const handleResumeRehearsal = async () => {
    setIsPaused(false)
    setIsRehearsalActive(true)

    // 音声認識を再開
    if (recognitionRef.current && !isRecognitionActiveRef.current) {
      try {
        recognitionRef.current.start()
      } catch (e: any) {
        if (e.name !== 'InvalidStateError') {
          console.error('音声認識の再開に失敗:', e)
        }
      }
    }
  }

  const handleResetRehearsal = () => {
    handleStopRehearsal()
    setCurrentQuestionIndex(0)
    currentQuestionIndexRef.current = 0
    setRehearsalMessages([])
    setCurrentTranscript('')
    setIsComplete(false)
    setMicTestPassed(false)
    setMicTestFailed(false)
  }

  // リハーサル会話履歴を保存
  const handleSaveRehearsalMessages = async () => {
    if (!interviewId || rehearsalMessages.length === 0) {
      alert('⚠️ 保存する会話履歴がありません')
      return
    }

    try {
      setSaving(true)
      const firestoreDb = getFirebaseDb()
      const docRef = doc(firestoreDb, 'interviews', interviewId)
      await updateDoc(docRef, {
        rehearsalMessages: rehearsalMessages,
        updatedAt: serverTimestamp()
      })
      alert('✅ 会話履歴を保存しました')
    } catch (error) {
      console.error('Error saving rehearsal messages:', error)
      alert('❌ 会話履歴の保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  // リハーサル会話履歴を削除
  const handleDeleteRehearsalMessages = async () => {
    if (!confirm('会話履歴を削除しますか？この操作は元に戻せません。')) {
      return
    }

    if (!interviewId) {
      alert('⚠️ インタビューIDがありません')
      return
    }

    try {
      setSaving(true)
      const firestoreDb = getFirebaseDb()
      const docRef = doc(firestoreDb, 'interviews', interviewId)
      await updateDoc(docRef, {
        rehearsalMessages: [],
        updatedAt: serverTimestamp()
      })
      setRehearsalMessages([])
      alert('✅ 会話履歴を削除しました')
    } catch (error) {
      console.error('Error deleting rehearsal messages:', error)
      alert('❌ 会話履歴の削除に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  // 生成された質問を音声で読み上げる関数
  const handlePlayGeneratedQuestion = async (questionText: string, profile: typeof interviewerProfile) => {
    if (!questionText || !questionText.trim()) {
      console.warn('⚠️ 質問が空です')
      return
    }

    if (!profile) {
      console.warn('⚠️ インタビュアープロファイルが読み込まれていません')
      return
    }

    console.log('🎤 生成された質問を読み上げます:', questionText.substring(0, 100) + '...')

    try {
      setPlayingQuestion(true)

      // Text-to-Speech APIを呼び出し
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: questionText,
          voiceType: profile.voiceSettings?.voiceType || 'Puck',
          speed: profile.voiceSettings?.speed || 1.0,
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
        console.error('❌ 音声生成APIエラー (Rehearsal Generated Question):', {
          status: response.status,
          error: errorData,
        })
        const diag = `${errorData.error || '不明なエラー'} (${errorData.details || '詳細なし'})`
        throw new Error(`音声生成に失敗しました: ${response.status} - ${diag}`)
      }

      const audioBlob = await response.blob()
      if (audioBlob.size === 0) {
        throw new Error('音声データが空です')
      }

      const audioUrl = URL.createObjectURL(audioBlob)

      // 音声を再生
      if (audioElementRef.current) {
        audioElementRef.current.pause()
        audioElementRef.current = null
      }
      const audio = new Audio(audioUrl)
      audioElementRef.current = audio

      await new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          console.log('✅ 生成された質問の読み上げ完了')
          setPlayingQuestion(false)
          URL.revokeObjectURL(audioUrl)

          // 質問をメッセージとして追加
          setRehearsalMessages(prev => [...prev, {
            role: 'interviewer',
            content: questionText
          }])

          // 質問読み上げ後、少し待ってから音声認識を開始（質問の音声が完全に終了するまで待つ）
          setTimeout(() => {
            // 質問の読み上げが完全に終了していることを確認
            if (!playingQuestion && !processingRef.current) {
              console.log('🎤 質問の読み上げ完了後、音声認識を開始します')
              startListening()
            }
          }, 2000) // 2秒待機（質問の音声が完全に終了するまで）

          resolve()
        }

        audio.onerror = (e) => {
          console.error('❌ 音声再生エラー:', e)
          setPlayingQuestion(false)
          URL.revokeObjectURL(audioUrl)
          reject(new Error('音声の再生に失敗しました'))
        }

        questionPlaybackStartTimeRef.current = Date.now()
        audio.play().catch(reject)
        console.log('▶️ 音声再生開始')
      })
    } catch (error) {
      console.error('❌ 生成された質問の読み上げエラー:', error)
      setPlayingQuestion(false)
      throw error
    }
  }

  // 質問を音声で読み上げる
  const handlePlayQuestion = useCallback(async (questionIndex: number) => {
    // questionsListRefを使用して最新の値を取得（クロージャの問題を回避）
    const currentQuestionsList = questionsListRef.current.length > 0 ? questionsListRef.current : questionsList
    // interviewerProfileRefを使用して最新の値を取得（クロージャの問題を回避）
    const currentInterviewerProfile = interviewerProfileRef.current || interviewerProfile

    console.log('🎤 handlePlayQuestion呼び出し:', {
      questionIndex,
      questionsListLength: currentQuestionsList.length,
      questionsListRefLength: questionsListRef.current.length,
      interviewerProfile: !!currentInterviewerProfile,
      isRehearsalActive: isRehearsalActive,
      isPaused: isPaused
    })

    if (currentQuestionsList.length === 0) {
      console.warn('⚠️ 質問リストが空です')
      alert('⚠️ 質問がありません。まず質問を生成・保存してください。')
      return
    }

    if (questionIndex >= currentQuestionsList.length) {
      console.warn('⚠️ 質問インデックスが範囲外です:', questionIndex, currentQuestionsList.length)
      return
    }

    const questionItem = currentQuestionsList[questionIndex]
    if (!questionItem) {
      console.warn('⚠️ 質問アイテムが存在しません:', questionIndex)
      return
    }

    const question = getQuestionText(questionItem)

    if (!question || !question.trim()) {
      console.warn('⚠️ 質問が空です:', questionIndex, questionItem)
      return
    }

    if (!currentInterviewerProfile) {
      console.warn('⚠️ インタビュアープロファイルが読み込まれていません')
      alert('⚠️ インタビュアープロファイルが読み込まれていません')
      return
    }

    console.log('🎤 質問を読み上げます:', question.substring(0, 100) + (question.length > 100 ? '...' : ''))

    try {
      setPlayingQuestion(true)

      // Text-to-Speech APIを呼び出し
      let response: Response
      try {
        response = await fetch('/api/text-to-speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: question,
            voiceType: currentInterviewerProfile.voiceSettings?.voiceType || 'Puck',
            speed: currentInterviewerProfile.voiceSettings?.speed || 1.0,
          }),
        })
      } catch (fetchError) {
        console.error('❌ TTS API リクエストエラー:', fetchError)
        throw new Error(`音声生成APIへの接続に失敗しました: ${fetchError instanceof Error ? fetchError.message : '不明なエラー'}`)
      }

      if (!response.ok) {
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText }
        }
        console.error('❌ 音声生成APIエラー (TTS):', {
          status: response.status,
          error: errorData,
        })
        const diag = `${errorData.error || '不明なエラー'} (${errorData.details || '詳細なし'})`
        throw new Error(`音声生成に失敗しました: ${response.status} - ${diag}`)
      }

      let audioBlob: Blob
      try {
        audioBlob = await response.blob()
        if (audioBlob.size === 0) {
          throw new Error('音声データが空です')
        }
      } catch (blobError) {
        console.error('❌ 音声データの取得エラー:', blobError)
        throw new Error(`音声データの取得に失敗しました: ${blobError instanceof Error ? blobError.message : '不明なエラー'}`)
      }
      const audioUrl = URL.createObjectURL(audioBlob)

      // 音声を再生
      if (audioElementRef.current) {
        audioElementRef.current.pause()
        audioElementRef.current = null
      }
      const audio = new Audio(audioUrl)
      audioElementRef.current = audio

      // 質問の読み上げ中にユーザーが話し始めた場合、読み上げを中断するためのフラグ
      let questionPlaybackInterrupted = false

      audio.onended = () => {
        console.log('✅ 質問の読み上げ完了')
        setPlayingQuestion(false)
        URL.revokeObjectURL(audioUrl)

        // 質問をメッセージとして追加
        setRehearsalMessages(prev => [...prev, {
          role: 'interviewer',
          content: question
        }])

        // 質問テキストを表示
        setCurrentQuestionText(question)

        // 質問読み上げ後、少し待ってから音声認識を開始（質問の音声が完全に終了するまで待つ）
        // ただし、質問の読み上げが中断された場合は既に音声認識が開始されている可能性がある
        if (!questionPlaybackInterrupted) {
          setTimeout(() => {
            // 質問の読み上げが完全に終了していることを確認
            if (!playingQuestion && !processingRef.current) {
              console.log('🎤 質問の読み上げ完了後、音声認識を開始します')
              startListening()
            }
          }, 4000) // 4秒待機（質問の音声が完全に終了するまで）
        }
      }

      // 質問の読み上げ中にユーザーが話し始めた場合、読み上げを中断
      // ただし、質問の読み上げ開始直後（1秒以内）は質問の音声を誤認識する可能性があるため、
      // 音声認識の結果を無視する

      audio.onerror = (e) => {
        console.error('❌ 音声再生エラー:', e)
        setPlayingQuestion(false)
        URL.revokeObjectURL(audioUrl)
        alert('❌ 音声の再生に失敗しました。ブラウザが音声形式をサポートしていない可能性があります。')
      }

      // 質問の読み上げ開始時刻を記録
      questionPlaybackStartTimeRef.current = Date.now()

      await audio.play()
      console.log('▶️ 音声再生開始')
    } catch (error) {
      console.error('❌ 質問読み上げエラー:', error)
      setPlayingQuestion(false)
      if (error instanceof Error && error.message.includes('NotAllowedError')) {
        alert('❌ 音声の再生にはユーザーの操作が必要です。ページをクリックしてから再度お試しください。')
      } else {
        alert(`❌ 質問の読み上げに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
      }
    }
  }, [questionsList, interviewerProfile])

  const startListening = async () => {
    if (!recognitionRef.current) {
      initializeSpeechRecognition()
    }

    try {
      if (!streamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
      }

      setListening(true)
      setCurrentTranscript('')

      if (recognitionRef.current && !isRecognitionActiveRef.current) {
        try {
          recognitionRef.current.start()
        } catch (e: any) {
          if (e.name === 'InvalidStateError') {
            console.log('⚠️ 音声認識は既に開始されています')
            isRecognitionActiveRef.current = true
          } else {
            throw e
          }
        }
      }
    } catch (error) {
      console.error('Error starting listening:', error)
      alert('❌ マイクへのアクセスに失敗しました。マイクの使用を許可してください。')
    }
  }

  const processResponse = async (transcript: string) => {
    if (processingRef.current || !transcript.trim() || isPaused) return

    // 返答終了時のマリンバ効果音を再生
    playMarimbaSound()

    processingRef.current = true
    setProcessing(true)
    setListening(false)
    startProcessingSound() // 処理中の効果音を開始

    // 音声認識を停止
    if (recognitionRef.current && isRecognitionActiveRef.current) {
      try {
        recognitionRef.current.stop()
        isRecognitionActiveRef.current = false
      } catch (e) {
        console.error('音声認識の停止エラー:', e)
        isRecognitionActiveRef.current = false
      }
    }

    try {
      const userResponse = transcript.trim()

      // 回答をメッセージとして追加（最新の状態を取得するため、コールバックを使用）
      let updatedMessages: Array<{ role: 'interviewer' | 'interviewee', content: string }> = []
      setRehearsalMessages(prev => {
        updatedMessages = [...prev, {
          role: 'interviewee',
          content: userResponse
        }]
        return updatedMessages
      })

      // 回答に対して相槌や反応を生成して読み上げ（タイムアウトを短縮）
      // 反応生成をスキップして、すぐに次の質問に進むオプションも検討
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000) // 5秒 → 3秒に短縮

        const reactionResponse = await fetch('/api/interview/generate-reaction', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userResponse: userResponse,
            interviewerPrompt: interviewerProfile?.prompt || '',
            reactionPatterns: interviewerProfile?.reactionPatterns || '',
            conversationHistory: updatedMessages.map(msg => ({
              role: msg.role,
              content: msg.content
            })),
          }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        let reactionProcessed = false

        if (reactionResponse.ok) {
          const reactionData = await reactionResponse.json()
          if (reactionData.reaction && reactionData.reaction.trim()) {
            reactionProcessed = true

            // 反応を音声で読み上げ
            const reactionAudioResponse = await fetch('/api/text-to-speech', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: reactionData.reaction,
                voiceType: interviewerProfile?.voiceSettings?.voiceType || 'Puck',
                speed: interviewerProfile?.voiceSettings?.speed || 1.0,
              }),
            })

            if (!reactionAudioResponse.ok) {
              const errorText = await reactionAudioResponse.text()
              console.warn('⚠️ 反応の音声生成に失敗しました（続行）:', reactionAudioResponse.status, errorText)
              // 失敗しても本体の処理は続ける

              // 反応の音声生成に失敗した場合でも、テキストとして追加して次の質問を処理
              setRehearsalMessages(prev => {
                const finalMessages = [...prev, {
                  role: 'interviewer' as const,
                  content: reactionData.reaction
                }]

                // すぐに次の質問を処理
                processNextQuestion(finalMessages)

                return finalMessages
              })
            } else {
              const reactionAudioBlob = await reactionAudioResponse.blob()
              const reactionAudioUrl = URL.createObjectURL(reactionAudioBlob)
              const reactionAudio = new Audio(reactionAudioUrl)
              reactionAudioRef.current = reactionAudio

              // 反応のテキストをaudio要素に保存（中断時に使用）
              reactionAudio.setAttribute('data-reaction-text', reactionData.reaction)

              // 反応の音声再生中にユーザーが話し始めた場合、再生を中断
              let reactionInterrupted = false

              // 反応の音声再生中でも音声認識を開始（ユーザーが途中で話し始められるように）
              reactionAudio.onplay = () => {
                setTimeout(() => {
                  if (!isRecognitionActiveRef.current && recognitionRef.current) {
                    try {
                      recognitionRef.current.start()
                    } catch (e: any) {
                      if (e.name !== 'InvalidStateError') {
                        console.error('音声認識の開始エラー:', e)
                      }
                    }
                  }
                }, 100) // 200ms → 100msに短縮
              }

              await reactionAudio.play()

              reactionAudio.onended = async () => {
                if (!reactionInterrupted && reactionAudioRef.current === reactionAudio) {
                  reactionAudioRef.current = null
                  URL.revokeObjectURL(reactionAudioUrl)

                  console.log('✅ 反応の音声再生完了。次の質問へ進みます。')

                  // 反応をメッセージとして追加
                  setRehearsalMessages(prev => {
                    // 既に反応が追加されているかチェック
                    const hasReaction = prev.some(msg =>
                      msg.role === 'interviewer' && msg.content === reactionData.reaction
                    )

                    if (!hasReaction) {
                      const finalMessages = [...prev, {
                        role: 'interviewer' as const,
                        content: reactionData.reaction
                      }]

                      console.log('📝 反応をメッセージに追加。次の質問を処理します。', {
                        currentIndex: currentQuestionIndexRef.current,
                        messagesCount: finalMessages.length
                      })

                      // 反応追加後、すぐに次の質問を処理（ブランクを短くする）
                      // processingRefをfalseに設定してからprocessNextQuestionを呼ぶ
                      processingRef.current = false
                      setProcessing(false)
                      stopProcessingSound() // 処理中の効果音を停止
                      processNextQuestionCallRef.current = false // 呼び出しフラグをリセット

                      // 待機時間を削減（100ms → 50ms）
                      setTimeout(() => {
                        console.log('🚀 processNextQuestionを呼び出します')
                        processNextQuestion(finalMessages)
                      }, 50)

                      return finalMessages
                    } else {
                      // 既に反応が追加されている場合、次の質問を処理
                      console.log('📝 反応は既に追加済み。次の質問を処理します。', {
                        currentIndex: currentQuestionIndexRef.current,
                        messagesCount: prev.length
                      })

                      // processingRefをfalseに設定してからprocessNextQuestionを呼ぶ
                      processingRef.current = false
                      setProcessing(false)
                      stopProcessingSound() // 処理中の効果音を停止
                      processNextQuestionCallRef.current = false // 呼び出しフラグをリセット

                      // 待機時間を削減（100ms → 50ms）
                      setTimeout(() => {
                        console.log('🚀 processNextQuestionを呼び出します（既存メッセージ）')
                        processNextQuestion(prev)
                      }, 50)
                      return prev
                    }
                  })
                } else {
                  console.log('⚠️ 反応の音声再生が中断されました。processNextQuestionは別の場所で呼ばれます。')
                }
              }

              // 音声認識のonresultイベントで反応の音声再生を中断する処理は、
              // 既にrecognition.onresult内で実装されている
            }
          }
        }

        // 反応が生成されなかった場合のフォールバック
        if (!reactionProcessed) {
          setRehearsalMessages(prev => {
            // すぐに次の質問を処理（待機時間なし）
            processingRef.current = false
            setProcessing(false)
            stopProcessingSound()
            processNextQuestionCallRef.current = false
            processNextQuestion(prev)
            return prev
          })
        }
      } catch (error) {
        console.error('Error generating reaction:', error)
        // 反応の生成に失敗した場合でも、次の質問を処理（待機時間なし）
        setRehearsalMessages(prev => {
          processingRef.current = false
          setProcessing(false)
          stopProcessingSound()
          processNextQuestionCallRef.current = false
          processNextQuestion(prev)
          return prev
        })
      }

      // processingRefは、processNextQuestionが完了するまで保持
      // processNextQuestion内でfalseに設定される
      return
    } catch (error) {
      console.error('Error processing response:', error)
      alert('❌ 回答の処理に失敗しました')
      processingRef.current = false
      setProcessing(false)
      stopProcessingSound() // 処理中の効果音を停止
      processNextQuestionCallRef.current = false // 呼び出しフラグをリセット
      setCurrentTranscript('')
    }
    // finallyブロックを削除（processNextQuestionが完了するまでprocessingRefを保持）
  }

  // 効果音を生成する関数
  const playMarimbaSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // マリンバのような音色（複数の周波数を短時間で鳴らす）
      const frequencies = [523.25, 659.25, 783.99] // C5, E5, G5
      const duration = 0.3
      const startTime = audioContext.currentTime

      frequencies.forEach((freq, index) => {
        const osc = audioContext.createOscillator()
        const gain = audioContext.createGain()

        osc.type = 'sine'
        osc.frequency.value = freq
        osc.connect(gain)
        gain.connect(audioContext.destination)

        gain.gain.setValueAtTime(0.3, startTime + index * 0.1)
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + index * 0.1 + duration)

        osc.start(startTime + index * 0.1)
        osc.stop(startTime + index * 0.1 + duration)
      })
    } catch (error) {
      console.warn('⚠️ 効果音の再生に失敗:', error)
    }
  }

  // ノック音を再生する関数（短く、うるさくない）
  const playKnockSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      // ノックのような音（短い、低めの周波数）
      oscillator.type = 'sine'
      oscillator.frequency.value = 200 // 低めの周波数でノックのような音
      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime) // 控えめな音量
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1) // 0.1秒でフェードアウト

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.1) // 0.1秒で停止
    } catch (error) {
      console.warn('⚠️ ノック音の再生に失敗:', error)
    }
  }

  // 処理中の効果音は削除（継続的な音は耳に悪いため）
  // 代わりにノック音で間をつぶす
  const startProcessingSound = () => {
    // ノック音を再生（処理開始時）
    playKnockSound()
  }

  const stopProcessingSound = () => {
    // ノック音は自動で停止するため、何もしない
  }

  const processNextQuestion = async (messages: Array<{ role: 'interviewer' | 'interviewee', content: string }>) => {
    // 重複実行を防ぐ
    if (processNextQuestionCallRef.current) {
      console.log('⚠️ processNextQuestion: 既に呼び出し中です。スキップします。')
      return
    }

    // questionsListを最新の値で取得（クロージャの問題を回避）
    const currentQuestionsList = questionsListRef.current.length > 0 ? questionsListRef.current : questionsList

    // 既に処理中の場合はスキップ（ただし、反応の音声再生が完了した場合は処理を続行）
    if (processingRef.current) {
      console.log('⚠️ processNextQuestion: 既に処理中です。少し待ってから再試行します。', {
        currentIndex: currentQuestionIndexRef.current,
        isPaused: isPaused,
        playingQuestion: playingQuestion
      })
      // 少し待ってから再試行（反応の音声再生が完了するのを待つ）
      setTimeout(() => {
        if (!processingRef.current && !isPaused && !playingQuestion && !processNextQuestionCallRef.current) {
          console.log('🔄 processNextQuestionを再試行します')
          processNextQuestion(messages)
        } else {
          console.log('⚠️ processNextQuestionの再試行をスキップ:', {
            processing: processingRef.current,
            isPaused: isPaused,
            playingQuestion: playingQuestion,
            alreadyCalled: processNextQuestionCallRef.current
          })
        }
      }, 300)
      return
    }

    // 呼び出しフラグを設定
    processNextQuestionCallRef.current = true

    // 処理開始
    processingRef.current = true
    setProcessing(true)
    startProcessingSound() // 処理中の効果音を開始

    console.log('🚀 processNextQuestion開始:', {
      currentIndex: currentQuestionIndexRef.current,
      questionsListLength: currentQuestionsList.length,
      messagesCount: messages.length,
      isPaused: isPaused,
      playingQuestion: playingQuestion
    })

    // 質問リストが空の場合はエラー
    if (currentQuestionsList.length === 0) {
      console.error('❌ 質問リストが空です。処理を中断します。')
      processingRef.current = false
      setProcessing(false)
      stopProcessingSound() // 処理中の効果音を停止
      processNextQuestionCallRef.current = false // 呼び出しフラグをリセット
      return
    }

    try {
      // 次の質問を決定（条件付き質問のチェックを含む）
      const currentIndex = currentQuestionIndexRef.current
      const nextIndex = currentIndex + 1

      console.log('🔍 processNextQuestion開始:', {
        currentIndex,
        nextIndex,
        questionsListLength: currentQuestionsList.length,
        messagesCount: messages.length,
        isComplete: isComplete,
        isRehearsalActive: isRehearsalActive
      })

      // デバッグ: 質問リストの内容を確認
      if (currentQuestionsList.length > 0) {
        console.log('📋 質問リスト:', currentQuestionsList.map((q, idx) => {
          const isConditional = typeof q === 'object' && q !== null && 'condition' in q
          return {
            index: idx,
            text: getQuestionText(q).substring(0, 50) + '...',
            isConditional: isConditional
          }
        }))
      } else {
        console.warn('⚠️ 質問リストが空です！')
      }

      // 対話を中心に組み立てる: 会話履歴に基づいて次の質問を動的に生成
      // スキルナレッジベースを活用して、自然な対話の流れを作る

      // 残りの質問リストを取得（参考用）
      const remainingQuestions = currentQuestionsList.slice(nextIndex)

      // 会話履歴に基づいて次の質問を動的に生成（タイムアウトを短縮）
      try {
        console.log('💬 会話履歴に基づいて次の質問を生成します...')

        // ナレッジベースIDを取得（インタビューから）
        const knowledgeBaseIds = interview?.knowledgeBaseIds || []

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000) // 8秒でタイムアウト

        const response = await fetch('/api/interview/generate-next-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationHistory: messages,
            remainingQuestions: remainingQuestions.map(q => getQuestionText(q)),
            interviewPurpose: interview?.interviewPurpose || '',
            targetAudience: interview?.targetAudience || '',
            mediaType: interview?.mediaType || '',
            objective: interview?.objective || '',
            knowledgeBaseIds: knowledgeBaseIds,
            intervieweeName: interview?.intervieweeName,
            intervieweeCompany: interview?.intervieweeCompany,
            intervieweeTitle: interview?.intervieweeTitle,
            intervieweeDepartment: interview?.intervieweeDepartment,
            intervieweeType: interview?.intervieweeType
          }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error(`次の質問の生成に失敗しました: ${response.status}`)
        }

        const data = await response.json()
        const generatedQuestion = data.question

        if (!generatedQuestion || !generatedQuestion.trim()) {
          // 生成に失敗した場合は、質問リストから次の質問を使用
          if (nextIndex < currentQuestionsList.length) {
            const nextQuestionText = getQuestionText(currentQuestionsList[nextIndex])
            console.log('⚠️ 質問生成に失敗したため、質問リストから次の質問を使用:', nextQuestionText.substring(0, 50) + '...')
            currentQuestionIndexRef.current = nextIndex
            setCurrentQuestionIndex(nextIndex)
            processingRef.current = false
            setProcessing(false)
            stopProcessingSound()
            processNextQuestionCallRef.current = false
            setTimeout(() => {
              handlePlayQuestion(nextIndex).catch(error => {
                console.error('❌ handlePlayQuestionエラー:', error)
                processingRef.current = false
                setProcessing(false)
                stopProcessingSound()
                processNextQuestionCallRef.current = false
              })
            }, 100)
            return
          } else {
            // すべての質問が完了
            console.log('🎉 すべての質問が完了しました')
            processingRef.current = false
            setProcessing(false)
            stopProcessingSound()
            processNextQuestionCallRef.current = false
            setIsComplete(true)
            setIsRehearsalActive(false)
            return
          }
        }

        console.log('✅ 生成された次の質問:', generatedQuestion.substring(0, 100) + '...')

        // 生成された質問を読み上げ
        const currentInterviewerProfile = interviewerProfileRef.current || interviewerProfile
        if (!currentInterviewerProfile) {
          throw new Error('インタビュアープロファイルが読み込まれていません')
        }

        processingRef.current = false
        setProcessing(false)
        stopProcessingSound()
        processNextQuestionCallRef.current = false

        // 生成された質問を直接読み上げる
        setCurrentQuestionText(generatedQuestion) // 質問テキストを表示
        await handlePlayGeneratedQuestion(generatedQuestion, currentInterviewerProfile)

        // 質問インデックスを進める（質問リストの順序は参考程度）
        currentQuestionIndexRef.current = nextIndex
        setCurrentQuestionIndex(nextIndex)

      } catch (error) {
        console.error('❌ 次の質問の生成エラー:', error)
        // エラーが発生した場合は、質問リストから次の質問を使用
        if (nextIndex < currentQuestionsList.length) {
          const nextQuestionText = getQuestionText(currentQuestionsList[nextIndex])
          console.log('⚠️ エラーのため、質問リストから次の質問を使用:', nextQuestionText.substring(0, 50) + '...')
          currentQuestionIndexRef.current = nextIndex
          setCurrentQuestionIndex(nextIndex)
          processingRef.current = false
          setProcessing(false)
          stopProcessingSound()
          processNextQuestionCallRef.current = false
          setTimeout(() => {
            handlePlayQuestion(nextIndex).catch(error => {
              console.error('❌ handlePlayQuestionエラー:', error)
              processingRef.current = false
              setProcessing(false)
              stopProcessingSound()
              processNextQuestionCallRef.current = false
            })
          }, 100)
        } else {
          // すべての質問が完了
          console.log('🎉 すべての質問が完了しました')
          processingRef.current = false
          setProcessing(false)
          stopProcessingSound()
          processNextQuestionCallRef.current = false
          setIsComplete(true)
          setIsRehearsalActive(false)
        }
      }
    } catch (error) {
      console.error('Error in processNextQuestion:', error)
      processingRef.current = false
      setProcessing(false)
      stopProcessingSound() // 処理中の効果音を停止
      processNextQuestionCallRef.current = false // 呼び出しフラグをリセット
    }
  }

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (recognitionRef.current && isRecognitionActiveRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          // 既に停止している場合は無視
        }
        isRecognitionActiveRef.current = false
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current)
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause()
        audioElementRef.current = null
      }
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <LoaderIcon className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!interview) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/dashboard/interviews"
            className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mb-4"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span>戻る</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            取材リハーサル
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {interview.title} - {interview.intervieweeName} ({interview.intervieweeCompany})
          </p>
        </div>

        {/* 質問生成セクション */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SparklesIcon className="w-5 h-5" />
              質問生成
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                フィードバック（任意）
              </label>
              <Textarea
                value={userFeedback}
                onChange={(e) => setUserFeedback(e.target.value)}
                placeholder="質問についてのフィードバックや改善要望を入力してください..."
                rows={3}
                className="w-full"
              />
            </div>
            <Button
              onClick={handleGenerateQuestions}
              disabled={generatingQuestions}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
            >
              {generatingQuestions ? (
                <>
                  <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <SparklesIcon className="w-4 h-4 mr-2" />
                  質問を生成
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 質問編集セクション */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquareIcon className="w-5 h-5" />
              質問プレビュー・編集
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                質問テキスト
              </label>
              <Textarea
                value={questionsText}
                onChange={(e) => handleQuestionsTextChange(e.target.value)}
                placeholder="質問を入力するか、上記の「質問を生成」ボタンで自動生成してください..."
                rows={15}
                className="w-full font-mono text-sm"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                条件付き質問の記述例: [条件: 質問1で会社名・役職・業務が得られなかった場合] 現在担当されている業務について、もう少し具体的にどのようなことを行っていらっしゃるのかお聞かせいただけますでしょうか？
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {questionsList.length} 個の質問が認識されました
              </p>
              <Button
                onClick={handleSaveQuestions}
                disabled={saving || !questionsText.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {saving ? (
                  <>
                    <LoaderIcon className="w-4 h-4 mr-2 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <SaveIcon className="w-4 h-4 mr-2" />
                    質問を保存
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* リハーサルセクション */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>取材リハーサル</span>
              {isRehearsalActive && (
                <div className="flex items-center gap-2">
                  {isPaused ? (
                    <Button
                      onClick={handleResumeRehearsal}
                      size="sm"
                      variant="outline"
                      className="bg-green-600 hover:bg-green-700 text-white border-green-600"
                    >
                      <PlayCircleIcon className="w-4 h-4 mr-2" />
                      再開
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStopRehearsal}
                      size="sm"
                      variant="outline"
                      className="bg-red-600 hover:bg-red-700 text-white border-red-600"
                    >
                      <StopCircleIcon className="w-4 h-4 mr-2" />
                      停止
                    </Button>
                  )}
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isRehearsalActive && questionsList.length === 0 && (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <MessageSquareIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>まず「質問プレビュー」で質問を生成・保存してください</p>
              </div>
            )}

            {!isRehearsalActive && questionsList.length > 0 && (
              <div className="text-center py-4">
                {micTestInProgress && (
                  <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg">
                    <div className="flex items-center justify-center gap-2 text-blue-800 dark:text-blue-200">
                      <LoaderIcon className="w-4 h-4 animate-spin" />
                      <span className="text-sm font-medium">マイクテストを実施中...</span>
                    </div>
                  </div>
                )}
                {micTestFailed && (
                  <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg">
                    <div className="flex items-center justify-center gap-2 text-red-800 dark:text-red-200">
                      <span className="text-sm font-medium">❌ マイクテストに失敗しました。マイクの設定を確認してください。</span>
                    </div>
                  </div>
                )}
                {micTestPassed && (
                  <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg">
                    <div className="flex items-center justify-center gap-2 text-green-800 dark:text-green-200">
                      <CheckCircleIcon className="w-4 h-4" />
                      <span className="text-sm font-medium">✅ マイクテスト成功</span>
                    </div>
                  </div>
                )}
                <Button
                  onClick={handleStartRehearsal}
                  disabled={!interviewerProfile || micTestInProgress}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                  size="lg"
                >
                  {micTestInProgress ? (
                    <>
                      <LoaderIcon className="w-5 h-5 mr-2 animate-spin" />
                      マイクテスト中...
                    </>
                  ) : (
                    <>
                      <MicIcon className="w-5 h-5 mr-2" />
                      リハーサルを開始
                    </>
                  )}
                </Button>
                {!interviewerProfile && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    インタビュアープロファイルを読み込み中...
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  ※ 開始前にマイクテストを実施します
                </p>
              </div>
            )}

            {isRehearsalActive && (
              <div className="space-y-4">
                {/* 進捗表示 */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      進捗状況
                    </span>
                    <span className="text-sm text-blue-700 dark:text-blue-300">
                      {currentQuestionIndex + 1} / {totalQuestions || questionsList.length} 問目
                    </span>
                  </div>
                  <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                    <div
                      className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${totalQuestions || questionsList.length > 0
                          ? ((currentQuestionIndex + 1) / (totalQuestions || questionsList.length)) * 100
                          : 0}%`
                      }}
                    />
                  </div>
                </div>

                {/* 現在の質問テキスト表示 */}
                {currentQuestionText && (
                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <MessageSquareIcon className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-1">
                          現在の質問
                        </p>
                        <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed">
                          {currentQuestionText}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {/* 現在の状態表示 */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      質問 {currentQuestionIndex + 1} / {questionsList.length}
                    </span>
                    {listening && (
                      <div className="flex items-center gap-2 text-red-600">
                        <MicIcon className="w-4 h-4 animate-pulse" />
                        <span className="text-sm">音声認識中...</span>
                      </div>
                    )}
                    {playingQuestion && (
                      <div className="flex items-center gap-2 text-blue-600">
                        <LoaderIcon className="w-4 h-4 animate-spin" />
                        <span className="text-sm">質問を読み上げ中...</span>
                      </div>
                    )}
                    {processing && (
                      <div className="flex items-center gap-2 text-purple-600">
                        <LoaderIcon className="w-4 h-4 animate-spin" />
                        <span className="text-sm">処理中...</span>
                      </div>
                    )}
                  </div>
                  {currentTranscript && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">
                      {currentTranscript}
                    </p>
                  )}
                </div>

                {/* 会話履歴 */}
                {rehearsalMessages.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">会話履歴</h3>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleSaveRehearsalMessages}
                          variant="outline"
                          size="sm"
                          disabled={saving}
                        >
                          <SaveIcon className="w-4 h-4 mr-1" />
                          {saving ? '保存中...' : '保存'}
                        </Button>
                        <Button
                          onClick={handleDeleteRehearsalMessages}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                        >
                          <XIcon className="w-4 h-4 mr-1" />
                          削除
                        </Button>
                      </div>
                    </div>
                    <div className="h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800 space-y-3">
                      {rehearsalMessages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex ${msg.role === 'interviewee' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] p-3 rounded-lg ${msg.role === 'interviewee'
                              ? 'bg-indigo-500 text-white'
                              : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                              }`}
                          >
                            <p className="text-xs font-semibold mb-1 opacity-80">
                              {msg.role === 'interviewee' ? 'あなた' : interviewerProfile?.name || 'インタビュアー'}
                            </p>
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 完了メッセージ */}
                {isComplete && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg text-center">
                    <CheckCircleIcon className="w-12 h-12 text-green-600 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">
                      リハーサルが完了しました！
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      すべての質問に回答しました。
                    </p>
                    <Button
                      onClick={handleResetRehearsal}
                      variant="outline"
                      size="sm"
                    >
                      最初からやり直す
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feedback Dialog */}
      <FeedbackDialog
        isOpen={showFeedbackDialog}
        onClose={() => setShowFeedbackDialog(false)}
        onSubmit={async (type, message) => {
          if (!user?.companyId || !interviewId) {
            throw new Error('ユーザー情報またはインタビューIDが取得できません')
          }

          // 現在の質問と回答を取得
          const currentMessages = rehearsalMessages
          const lastQuestion = currentMessages.filter(m => m.role === 'interviewer').pop()
          const lastAnswer = currentMessages.filter(m => m.role === 'interviewee').pop()

          const response = await fetch('/api/feedback/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId: user.companyId,
              interviewId: interviewId,
              source: 'rehearsal',
              type: type,
              message: message,
              context: {
                question: lastQuestion?.content || currentQuestionText,
                answer: lastAnswer?.content,
                timestamp: new Date()
              },
              createdBy: user.uid
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'フィードバックの送信に失敗しました')
          }
        }}
        context={{
          question: currentQuestionText,
          answer: rehearsalMessages.filter(m => m.role === 'interviewee').pop()?.content
        }}
        source="rehearsal"
      />
    </div>
  )
}


