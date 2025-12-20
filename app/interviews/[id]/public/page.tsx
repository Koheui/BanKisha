'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getFirebaseDb } from '@/src/lib/firebase'
import { doc, getDoc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore'
import { LoaderIcon, MicIcon, SquareIcon, PlayCircleIcon, PauseIcon, ArrowRightIcon } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// 質問文字列を配列にパースする関数
const parseQuestions = (questionsText?: string, objective?: string): string[] => {
  if (!questionsText && !objective) return []
  
  // questionsTextがある場合はそれを使用（優先）
  if (questionsText && questionsText.trim()) {
    console.log('📝 questionsTextを使用:', questionsText.substring(0, 100))
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
      console.log('✅ 質問をパースしました:', questions.length, '個')
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
    
    // 抽出できた場合は返す
    if (lines.length > 0) {
      return lines
    }
    
    // それでも抽出できなければ、objective全体を1つの質問として扱う
    return [objective.trim()]
  }
  
  return []
}

export default function PublicInterviewPage() {
  const params = useParams()
  const router = useRouter()
  const interviewId = params.id as string
  const [loading, setLoading] = useState(true)
  const [interview, setInterview] = useState<any>(null)
  const [modeSelected, setModeSelected] = useState(false) // モード選択状態
  const [interviewerProfile, setInterviewerProfile] = useState<any>(null)
  const [messages, setMessages] = useState<Array<{ role: string, content: string, timestamp?: any }>>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const generatingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [progressEvaluation, setProgressEvaluation] = useState<any>(null)
  const [evaluatingProgress, setEvaluatingProgress] = useState(false)
  const evaluationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // リハーサルモード関連の状態
  const [isRehearsalMode, setIsRehearsalMode] = useState(false)
  const [isRehearsalActive, setIsRehearsalActive] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [rehearsalMessages, setRehearsalMessages] = useState<Array<{ role: 'interviewer' | 'interviewee', content: string }>>([])
  const [listening, setListening] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [processing, setProcessing] = useState(false)
  const [playingQuestion, setPlayingQuestion] = useState(false)
  const recognitionRef = useRef<any>(null)
  const isRecognitionActiveRef = useRef<boolean>(false)
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const processingRef = useRef<boolean>(false)
  const transcriptRef = useRef<string>('') // 文字起こしを累積するためのref
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null) // 無音タイムアウト
  const [questions, setQuestions] = useState<string[]>([]) // 質問リスト
  const questionPlaybackStartTimeRef = useRef<number>(0) // 質問の読み上げ開始時刻

  // 効果音を再生する関数（knock音）
  const playKnockSound = useCallback(async () => {
    try {
      console.log('🔊 効果音を再生しようとしています...')
      // AudioContextの初期化（ユーザーインタラクションが必要な場合があるため、resumeを試みる）
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) {
        console.error('❌ AudioContextがサポートされていません')
        return
      }
      
      const audioContext = new AudioContextClass()
      console.log('✅ AudioContextを作成しました。状態:', audioContext.state)
      
      // AudioContextがsuspended状態の場合はresumeを試みる
      if (audioContext.state === 'suspended') {
        console.log('⏸️ AudioContextがsuspended状態です。resumeを試みます...')
        try {
          await audioContext.resume()
          console.log('✅ AudioContextをresumeしました。状態:', audioContext.state)
        } catch (error: any) {
          console.error('❌ AudioContextのresumeに失敗:', error)
          return
        }
      }
      
      // resume後、状態がrunningになるまで少し待つ
      if (audioContext.state !== 'running') {
        console.warn('⚠️ AudioContextの状態がrunningではありません:', audioContext.state)
        // 少し待ってから再試行
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
      
      // knock音の設定（短い低音）
      oscillator.type = 'sine' // サイン波を使用
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.1)
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.1)
      
      console.log('✅ 効果音のoscillatorを開始しました')
      
      oscillator.onended = () => {
        console.log('✅ 効果音の再生が完了しました')
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

  useEffect(() => {
    if (interviewId) {
      loadInterview()
    }
  }, [interviewId])

  useEffect(() => {
    // メッセージが更新されたら自動スクロール
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isGenerating, rehearsalMessages])

  // 本番メッセージが追加されたらリハーサルメッセージを削除
  useEffect(() => {
    const checkAndDeleteRehearsal = async () => {
      if (!interviewId || !interview) return
      
      // 本番メッセージ（messages）が存在し、リハーサルメッセージも存在する場合
      const hasRealMessages = interview.messages && interview.messages.length > 0
      const hasRehearsalMessages = interview.rehearsalMessages && interview.rehearsalMessages.length > 0
      
      if (hasRealMessages && hasRehearsalMessages) {
        console.log('🗑️ 本番録音が開始されたため、リハーサルメッセージを削除します')
        try {
          const firestoreDb = getFirebaseDb()
          const docRef = doc(firestoreDb, 'interviews', interviewId)
          await updateDoc(docRef, {
            rehearsalMessages: [],
            updatedAt: serverTimestamp()
          })
          setRehearsalMessages([])
          setIsRehearsalMode(false)
          setIsRehearsalActive(false)
        } catch (error) {
          console.error('Error deleting rehearsal messages:', error)
        }
      }
    }
    
    checkAndDeleteRehearsal()
  }, [interview?.messages, interviewId, interview])

  const loadInterview = async () => {
    try {
      setLoading(true)
      console.log('📋 インタビューを読み込み中...', interviewId)
      const firestoreDb = getFirebaseDb()
      const docRef = doc(firestoreDb, 'interviews', interviewId)
      const docSnap = await getDoc(docRef)
      
      console.log('📋 インタビュードキュメントの存在確認:', docSnap.exists(), 'ID:', interviewId)
      
      if (docSnap.exists()) {
        const data = docSnap.data()
        console.log('✅ インタビューデータを取得しました:', {
          id: docSnap.id,
          title: data.title,
          hasQuestions: !!data.questions,
          hasMessages: !!(data.messages && data.messages.length > 0),
          hasRehearsalMessages: !!(data.rehearsalMessages && data.rehearsalMessages.length > 0)
        })
        setInterview({
          id: docSnap.id,
          ...data
        })
        
        // インタビュアープロファイルを読み込む
        if (data.interviewerId) {
          const interviewerDocRef = doc(getFirebaseDb(), 'interviewers', data.interviewerId)
          const interviewerDocSnap = await getDoc(interviewerDocRef)
          if (interviewerDocSnap.exists()) {
            const interviewerData = interviewerDocSnap.data()
            setInterviewerProfile({
              id: interviewerDocSnap.id,
              ...interviewerData
            })
          }
        }
        
        // 質問を読み込む
        if (data.questions) {
          const parsedQuestions = parseQuestions(data.questions, data.objective)
          console.log('📋 質問を読み込みました:', parsedQuestions.length, '個')
          setQuestions(parsedQuestions)
        } else if (data.objective) {
          // questionsがない場合はobjectiveから質問を抽出
          const parsedQuestions = parseQuestions(undefined, data.objective)
          console.log('📋 objectiveから質問を抽出しました:', parsedQuestions.length, '個')
          setQuestions(parsedQuestions)
        }
        
        // リハーサルメッセージを読み込む
        if (data.rehearsalMessages && Array.isArray(data.rehearsalMessages)) {
          setRehearsalMessages(data.rehearsalMessages.map((msg: any) => ({
            role: msg.role,
            content: msg.content
          })))
        }
        
        // 会話履歴を読み込む（リハーサルメッセージと通常メッセージを結合）
        const allMessages = [
          ...(data.rehearsalMessages || []),
          ...(data.messages || [])
        ].sort((a: any, b: any) => {
          const aTime = a.timestamp?.toDate?.() || a.timestamp || new Date(0)
          const bTime = b.timestamp?.toDate?.() || b.timestamp || new Date(0)
          return aTime.getTime() - bTime.getTime()
        })
        
        setMessages(allMessages)
        
        // 開始時刻を設定（最初のメッセージの時刻）
        if (allMessages.length > 0) {
          const firstMessage = allMessages[0]
          const firstTime = firstMessage.timestamp?.toDate?.() || firstMessage.timestamp
          if (firstTime) {
            setStartTime(firstTime instanceof Date ? firstTime : new Date(firstTime))
          }
        }
        
        // リアルタイムでメッセージを監視
        const unsubscribe = onSnapshot(docRef, (snapshot) => {
          if (snapshot.exists()) {
            const updatedData = snapshot.data()
            
            // リハーサルメッセージを更新
            if (updatedData.rehearsalMessages && Array.isArray(updatedData.rehearsalMessages)) {
              setRehearsalMessages(updatedData.rehearsalMessages.map((msg: any) => ({
                role: msg.role,
                content: msg.content
              })))
            }
            
            const updatedMessages = [
              ...(updatedData.rehearsalMessages || []),
              ...(updatedData.messages || [])
            ].sort((a: any, b: any) => {
              const aTime = a.timestamp?.toDate?.() || a.timestamp || new Date(0)
              const bTime = b.timestamp?.toDate?.() || b.timestamp || new Date(0)
              return aTime.getTime() - bTime.getTime()
            })
            
            const previousMessagesCount = messages.length
            setMessages(updatedMessages)
            
            // 開始時刻を設定（最初のメッセージの時刻）
            if (updatedMessages.length > 0 && !startTime) {
              const firstMessage = updatedMessages[0]
              const firstTime = firstMessage.timestamp?.toDate?.() || firstMessage.timestamp
              if (firstTime) {
                setStartTime(firstTime instanceof Date ? firstTime : new Date(firstTime))
              }
            }
            
            // メッセージが増えた場合は生成中を解除
            if (updatedMessages.length > previousMessagesCount) {
              setIsGenerating(false)
              if (generatingTimeoutRef.current) {
                clearTimeout(generatingTimeoutRef.current)
                generatingTimeoutRef.current = null
              }
              
              // 進捗を再評価（回答が追加された場合）
              if (updatedMessages.length > 0 && interview?.objective) {
                // 前回のタイムアウトをクリア
                if (evaluationTimeoutRef.current) {
                  clearTimeout(evaluationTimeoutRef.current)
                }
                
                // 2秒後に進捗を評価（回答が完全に追加されるのを待つ）
                evaluationTimeoutRef.current = setTimeout(() => {
                  evaluateProgress(updatedMessages)
                }, 2000)
              }
            }
            
            // 最後のメッセージがインタビュアーからの質問で、次のメッセージがまだない場合は生成中と判断
            const lastMessage = updatedMessages[updatedMessages.length - 1]
            if (lastMessage && lastMessage.role === 'interviewer') {
              // 前回のタイムアウトをクリア
              if (generatingTimeoutRef.current) {
                clearTimeout(generatingTimeoutRef.current)
              }
              
              // 1秒後に生成中と判断（実際の生成処理が開始されるまでの時間）
              generatingTimeoutRef.current = setTimeout(() => {
                setIsGenerating(true)
              }, 1000)
            } else {
              // 最後のメッセージがインタビュアー以外の場合は生成中を解除
              setIsGenerating(false)
              if (generatingTimeoutRef.current) {
                clearTimeout(generatingTimeoutRef.current)
                generatingTimeoutRef.current = null
              }
            }
          }
        })
        
        return () => unsubscribe()
      } else {
        console.error('❌ インタビューが見つかりません。ID:', interviewId)
        setLoading(false)
        // interviewをnullに設定してエラーを表示
        setInterview(null as any)
      }
    } catch (error) {
      console.error('❌ インタビューの読み込みエラー:', error)
      console.error('エラー詳細:', {
        interviewId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      setLoading(false)
      // interviewをnullに設定してエラーを表示
      setInterview(null as any)
    } finally {
      setLoading(false)
    }
  }

  const evaluateProgress = async (conversationHistory: Array<{ role: string, content: string }>) => {
    if (!interview?.objective || !interview?.knowledgeBaseIds) return
    
    try {
      setEvaluatingProgress(true)
      
      const response = await fetch('/api/interview/evaluate-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationHistory: conversationHistory,
          objective: interview.objective,
          interviewPurpose: interview.interviewPurpose || '',
          knowledgeBaseIds: interview.knowledgeBaseIds || []
        }),
      })

      if (!response.ok) {
        throw new Error('進捗評価に失敗しました')
      }

      const data = await response.json()
      if (data.success && data.evaluation) {
        setProgressEvaluation(data.evaluation)
      }
    } catch (error) {
      console.error('Error evaluating progress:', error)
    } finally {
      setEvaluatingProgress(false)
    }
  }

  useEffect(() => {
    // 初回の進捗評価
    if (messages.length > 0 && interview?.objective && !progressEvaluation && !evaluatingProgress) {
      const timer = setTimeout(() => {
        evaluateProgress(messages)
      }, 1000) // 1秒後に評価（メッセージが安定するのを待つ）
      
      return () => clearTimeout(timer)
    }
  }, [messages.length, interview?.objective, progressEvaluation, evaluatingProgress])

  // 音声認識の初期化
  const initializeSpeechRecognition = useCallback(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'ja-JP'
        
        recognition.onresult = (event: any) => {
          // 質問の読み上げ開始直後（5秒以内）は質問の音声を誤認識する可能性があるため、無視する
          const timeSinceQuestionStart = Date.now() - questionPlaybackStartTimeRef.current
          if (timeSinceQuestionStart < 5000) {
            console.log('⚠️ 質問の読み上げ直後のため、音声認識結果を無視します:', {
              timeSinceQuestionStart,
              playingQuestion
            })
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
          
          // transcriptRefに累積
          if (newFinalTranscript) {
            transcriptRef.current += newFinalTranscript
          }
          
          // 表示用の文字起こし（累積 + 暫定）
          const fullTranscript = transcriptRef.current + interimTranscript
          setCurrentTranscript(fullTranscript)
          
          // 無音タイムアウトをリセット
          if (silenceTimeoutRef.current) {
            clearTimeout(silenceTimeoutRef.current)
          }
          
          // 最終的な回答が確定したら、一定時間無音が続いたら処理（10文字以上の場合のみ）
          if (newFinalTranscript && transcriptRef.current.trim().length >= 10) {
            silenceTimeoutRef.current = setTimeout(() => {
              if (transcriptRef.current.trim().length >= 10 && !processingRef.current && !playingQuestion) {
                const responseText = transcriptRef.current.trim()
                transcriptRef.current = '' // 処理後はクリア
                processRehearsalResponse(responseText)
              }
            }, 3000) // 3秒無音が続いたら処理
          }
        }
        
        recognition.onstart = () => {
          isRecognitionActiveRef.current = true
          setListening(true)
          console.log('✅ 音声認識が開始されました')
        }
        
        recognition.onerror = (event: any) => {
          if (event.error === 'aborted') {
            isRecognitionActiveRef.current = false
            setListening(false)
            return
          }
          
          // "no-speech"エラーは正常な動作の一部なので、エラーログを出さない
          if (event.error === 'no-speech') {
            isRecognitionActiveRef.current = false
            setListening(false)
            // リハーサルがアクティブな場合は再開を試みる
            if (isRehearsalActive && !isPaused && !processingRef.current) {
              setTimeout(() => {
                if (recognitionRef.current && !isRecognitionActiveRef.current) {
                  try {
                    recognitionRef.current.start()
                  } catch (e: any) {
                    if (e.name !== 'InvalidStateError') {
                      console.error('音声認識の再開に失敗:', e)
                    }
                  }
                }
              }, 1000)
            }
            return
          }
          
          // その他のエラーはログに記録
          console.error('音声認識エラー:', event.error)
          isRecognitionActiveRef.current = false
          setListening(false)
        }
        
        recognition.onend = () => {
          isRecognitionActiveRef.current = false
          setListening(false)
          console.log('⏹️ 音声認識が終了しました')
          
          // 音声認識が終了した場合、文字起こしがある場合は処理（10文字以上の場合のみ）
          if (transcriptRef.current && transcriptRef.current.trim().length >= 10 && !processingRef.current) {
            // 少し待ってから処理（回答が続く可能性があるため）
            setTimeout(() => {
              // 再度状態をチェック
              if (processingRef.current || playingQuestion) {
                return
              }
              
              if (transcriptRef.current && transcriptRef.current.trim().length >= 10 && !processingRef.current) {
                const responseText = transcriptRef.current.trim()
                transcriptRef.current = ''
                console.log('✅ 音声認識終了時に文字起こしを処理します:', responseText.substring(0, 50) + '...')
                processRehearsalResponse(responseText)
              } else {
                // 文字起こしがない、または短すぎる場合は再開
                if (isRehearsalActive && !isPaused && !processingRef.current) {
                  setTimeout(() => {
                    if (recognitionRef.current && !isRecognitionActiveRef.current) {
                      try {
                        console.log('🔄 音声認識を再開します（文字起こしなし）')
                        recognitionRef.current.start()
                      } catch (e: any) {
                        if (e.name !== 'InvalidStateError') {
                          console.error('音声認識の再開に失敗:', e)
                        }
                      }
                    }
                  }, 1000)
                }
              }
            }, 2000) // 2秒待ってから処理
          } else {
            // 回答がない、または短すぎる場合は再開
            if (isRehearsalActive && !isPaused && !processingRef.current) {
              setTimeout(() => {
                if (recognitionRef.current && !isRecognitionActiveRef.current) {
                  try {
                    console.log('🔄 音声認識を再開します（回答なし）')
                    recognitionRef.current.start()
                  } catch (e: any) {
                    if (e.name !== 'InvalidStateError') {
                      console.error('音声認識の再開に失敗:', e)
                    }
                  }
                }
              }, 1000)
            }
          }
        }
        
        recognitionRef.current = recognition
      }
    }
  }, [isRehearsalActive, isPaused])

  // 導入メッセージを生成する関数
  const generateIntroductionMessage = (): string => {
    if (!interview) return ''
    
    const parts: string[] = []
    
    parts.push('本日はお時間をいただき、ありがとうございます。')
    
    if (interview.interviewPurpose) {
      parts.push(`本日は、${interview.interviewPurpose}についてお話を伺いたいと思っています。`)
    }
    
    if (interview.targetAudience) {
      parts.push(`${interview.targetAudience}の方々に向けて、`)
    }
    
    if (interview.mediaType) {
      parts.push(`${interview.mediaType}に掲載予定です。`)
    }
    
    if (interview.objective) {
      const objectives = interview.objective.split('\n').filter((line: string) => line.trim()).slice(0, 3) // 最初の3つまで
      if (objectives.length > 0) {
        parts.push('特に、以下の点について詳しくお聞かせいただければと思います。')
        const objectiveParts: string[] = []
        objectives.forEach((obj: string, index: number) => {
          const cleaned = obj.replace(/^[-*•]\s*/, '').trim()
          if (cleaned) {
            if (index === objectives.length - 1) {
              // 最後の項目だけ「についてです」を付ける
              objectiveParts.push(`${index + 1}つ目は、${cleaned}についてです。`)
            } else {
              // それ以外は「について」を付けない
              objectiveParts.push(`${index + 1}つ目は、${cleaned}、`)
            }
          }
        })
        parts.push(...objectiveParts)
      }
    }
    
    parts.push('それでは、よろしくお願いいたします。')
    
    return parts.join(' ')
  }

  // 導入メッセージを読み上げる関数
  const handlePlayIntroduction = async (): Promise<void> => {
    if (!interviewerProfile) {
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
          voiceType: interviewerProfile.voiceSettings?.voiceType || 'Puck',
          speed: interviewerProfile.voiceSettings?.speed || 1.0,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`音声生成に失敗しました: ${response.status}`)
      }

      const audioBlob = await response.blob()
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

  // リハーサル開始
  const handleStartRehearsal = async () => {
    if (!interviewerProfile) {
      alert('⚠️ インタビュアープロファイルが読み込まれていません')
      return
    }
    
    setIsRehearsalMode(true)
    setIsRehearsalActive(true)
    setIsPaused(false)
    setRehearsalMessages([])
    setCurrentTranscript('')
    
    // 音声認識を初期化
    initializeSpeechRecognition()
    
    // まず導入メッセージを読み上げ、その後最初の質問を生成して読み上げ
    setTimeout(async () => {
      try {
        // 導入メッセージを読み上げ
        await handlePlayIntroduction()
        
        // 導入メッセージの後に少し待ってから最初の質問を生成して読み上げ
        setTimeout(async () => {
          try {
            await generateAndPlayNextQuestion()
          } catch (error) {
            console.error('❌ 質問の生成・読み上げに失敗:', error)
            alert(`❌ 質問の生成・読み上げに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
            setIsRehearsalActive(false)
          }
        }, 500)
      } catch (error) {
        console.error('❌ 導入メッセージの読み上げに失敗:', error)
        // 導入メッセージに失敗しても、最初の質問を読み上げる
        try {
          await generateAndPlayNextQuestion()
        } catch (questionError) {
          console.error('❌ 質問の生成・読み上げに失敗:', questionError)
          alert(`❌ 質問の生成・読み上げに失敗しました: ${questionError instanceof Error ? questionError.message : '不明なエラー'}`)
          setIsRehearsalActive(false)
        }
      }
    }, 100)
  }

  // リハーサル停止
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
    
    setListening(false)
    setPlayingQuestion(false)
    setProcessing(false)
  }

  // リハーサル再開
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

  // リハーサルリセット
  const handleResetRehearsal = () => {
    handleStopRehearsal()
    setRehearsalMessages([])
    setCurrentTranscript('')
  }

  // 次の質問を生成して読み上げ
  const generateAndPlayNextQuestion = async () => {
    if (!interview || !interviewerProfile) return
    
    try {
      setProcessing(true)
      setPlayingQuestion(true)
      
      const conversationHistory = rehearsalMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
      
      // 残りの質問リストを取得（会話履歴に基づいて使用済みの質問を除外）
      const usedQuestions = conversationHistory
        .filter(msg => msg.role === 'interviewer')
        .map(msg => msg.content)
      const remainingQuestions = questions.filter(q => !usedQuestions.includes(q))
      
      console.log('📋 質問リスト:', {
        total: questions.length,
        used: usedQuestions.length,
        remaining: remainingQuestions.length
      })
      
      const requestBody = {
        conversationHistory: conversationHistory,
        remainingQuestions: remainingQuestions, // 質問リストを渡す
        interviewPurpose: interview.interviewPurpose || '',
        targetAudience: interview.targetAudience || '',
        mediaType: interview.mediaType || '',
        objective: interview.objective || '',
        knowledgeBaseIds: interview.knowledgeBaseIds || [],
        intervieweeName: interview.intervieweeName,
        intervieweeCompany: interview.intervieweeCompany,
        intervieweeTitle: interview.intervieweeTitle,
        intervieweeDepartment: interview.intervieweeDepartment,
        intervieweeType: interview.intervieweeType,
        confirmNameAtInterview: interview.confirmNameAtInterview,
        confirmCompanyAtInterview: interview.confirmCompanyAtInterview,
        confirmTitleAtInterview: interview.confirmTitleAtInterview,
        confirmDepartmentAtInterview: interview.confirmDepartmentAtInterview
      }
      
      console.log('📤 質問生成APIを呼び出します:', {
        url: '/api/interview/generate-next-question',
        conversationHistoryLength: conversationHistory.length,
        remainingQuestionsLength: remainingQuestions.length
      })
      
      const response = await fetch('/api/interview/generate-next-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      console.log('📥 質問生成APIのレスポンス:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ 質問生成APIエラー:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText
        })
        throw new Error(`質問の生成に失敗しました: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log('✅ 質問生成APIのレスポンスデータ:', {
        hasQuestion: !!data.question,
        questionLength: data.question?.length || 0,
        questionPreview: data.question?.substring(0, 100) || '',
        success: data.success
      })
      
      if (!data.question || !data.question.trim()) {
        console.error('❌ 質問が生成されませんでした:', data)
        throw new Error('質問が生成されませんでした')
      }

      const questionText = data.question.trim()
      console.log('✅ 生成された質問:', {
        length: questionText.length,
        text: questionText,
        preview: questionText.substring(0, 100)
      })
      
      // 質問をメッセージとして追加
      setRehearsalMessages(prev => [...prev, {
        role: 'interviewer',
        content: questionText
      }])
      
      // 質問を音声で読み上げ
      console.log('🔊 音声生成APIを呼び出します:', {
        url: '/api/text-to-speech',
        textLength: questionText.length,
        voiceType: interviewerProfile.voiceSettings?.voiceType || 'Puck',
        speed: interviewerProfile.voiceSettings?.speed || 1.0
      })
      
      const audioResponse = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: questionText,
          voiceType: interviewerProfile.voiceSettings?.voiceType || 'Puck',
          speed: interviewerProfile.voiceSettings?.speed || 1.0,
        }),
      })

      console.log('📥 音声生成APIのレスポンス:', {
        status: audioResponse.status,
        statusText: audioResponse.statusText,
        ok: audioResponse.ok
      })

      if (!audioResponse.ok) {
        const errorText = await audioResponse.text()
        console.error('❌ 音声生成APIエラー:', {
          status: audioResponse.status,
          statusText: audioResponse.statusText,
          errorText: errorText
        })
        throw new Error(`音声生成に失敗しました: ${audioResponse.status} ${audioResponse.statusText}`)
      }

      const audioBlob = await audioResponse.blob()
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
      
      // 質問の読み上げ開始時刻を記録
      questionPlaybackStartTimeRef.current = Date.now()
      
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          console.log('✅ 質問の読み上げ完了')
          setPlayingQuestion(false)
          URL.revokeObjectURL(audioUrl)
          
          // 質問読み上げ後、少し待ってから音声認識を開始（質問の音声が完全に終了するまで待つ）
          setTimeout(() => {
            // 質問の読み上げが完全に終了していることを確認
            if (!playingQuestion && !processingRef.current && recognitionRef.current && !isRecognitionActiveRef.current) {
              console.log('🎤 質問の読み上げ完了後、音声認識を開始します')
              // さらに少し待ってから音声認識を開始（質問の音声が完全に消えるまで）
              setTimeout(() => {
                if (!playingQuestion && !processingRef.current && recognitionRef.current && !isRecognitionActiveRef.current) {
                  try {
                    recognitionRef.current.start()
                  } catch (e: any) {
                    if (e.name !== 'InvalidStateError') {
                      console.error('音声認識の開始に失敗:', e)
                    }
                  }
                }
              }, 2000) // 追加で2秒待機
            }
          }, 6000) // 6秒待機（質問の音声が完全に終了するまで）
          
          resolve()
        }
        
        audio.onerror = (e) => {
          console.error('❌ 音声再生エラー:', e)
          setPlayingQuestion(false)
          URL.revokeObjectURL(audioUrl)
          reject(new Error('音声の再生に失敗しました'))
        }
        
        audio.play().catch(reject)
      })
    } catch (error) {
      console.error('❌ 質問生成・読み上げエラー:', error)
      console.error('エラー詳細:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined
      })
      setPlayingQuestion(false)
      setProcessing(false)
      processingRef.current = false
      // エラーを再スローせず、処理を続行できるようにする
      alert(`❌ 質問の生成・読み上げに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
    } finally {
      setProcessing(false)
      processingRef.current = false
    }
  }

  // リハーサル回答を処理
  const processRehearsalResponse = async (transcript: string) => {
    if (processingRef.current || !transcript.trim()) {
      console.log('⚠️ processRehearsalResponse: 処理中または文字起こしが空のためスキップ')
      return
    }
    
    // 無音タイムアウトをクリア
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current)
      silenceTimeoutRef.current = null
    }
    
    processingRef.current = true
    setProcessing(true)
    setListening(false)
    setCurrentTranscript('')
    
    // 処理開始時に効果音を再生
    playKnockSound().catch((error) => {
      console.error('❌ 効果音の再生に失敗:', error)
    })
    
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
    
    console.log('🔄 リハーサル回答を処理します:', transcript.substring(0, 50) + '...')
    
    try {
      // 回答をメッセージとして追加
      const updatedRehearsalMessages = [...rehearsalMessages, {
        role: 'interviewee' as const,
        content: transcript
      }]
      setRehearsalMessages(updatedRehearsalMessages)
      
      // リハーサルメッセージを保存
      const firestoreDb = getFirebaseDb()
      const docRef = doc(firestoreDb, 'interviews', interviewId)
      await updateDoc(docRef, {
        rehearsalMessages: updatedRehearsalMessages,
        updatedAt: serverTimestamp()
      })
      
      // 次の質問を生成して読み上げ
      setTimeout(async () => {
        try {
          console.log('🚀 次の質問を生成します')
          await generateAndPlayNextQuestion()
        } catch (error) {
          console.error('❌ 次の質問の生成・読み上げに失敗:', error)
          // エラーが発生しても処理をリセット
          processingRef.current = false
          setProcessing(false)
        }
      }, 1000)
    } catch (error) {
      console.error('Error processing rehearsal response:', error)
    } finally {
      processingRef.current = false
      setProcessing(false)
    }
  }

  // リハーサルメッセージを保存
  const handleSaveRehearsalMessages = async () => {
    if (!interviewId || rehearsalMessages.length === 0) {
      alert('⚠️ 保存する会話履歴がありません')
      return
    }

    try {
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
    }
  }

  // リハーサルメッセージを削除
  const handleDeleteRehearsalMessages = async () => {
    if (!confirm('会話履歴を削除しますか？この操作は元に戻せません。')) {
      return
    }

    if (!interviewId) {
      alert('⚠️ インタビューIDがありません')
      return
    }

    try {
      const firestoreDb = getFirebaseDb()
      const docRef = doc(firestoreDb, 'interviews', interviewId)
      await updateDoc(docRef, {
        rehearsalMessages: [],
        updatedAt: serverTimestamp()
      })
      setRehearsalMessages([])
      setIsRehearsalMode(false)
      setIsRehearsalActive(false)
      alert('✅ 会話履歴を削除しました')
    } catch (error) {
      console.error('Error deleting rehearsal messages:', error)
      alert('❌ 会話履歴の削除に失敗しました')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <LoaderIcon className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
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
        </div>
      </div>
    )
  }

  // モード選択画面
  if (!modeSelected && !isRehearsalMode && !interview.messages?.length) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {interview.title || 'インタビュー'}
            </h1>
            {interview.intervieweeName && (
              <p className="text-gray-600 dark:text-gray-400">
                {interview.intervieweeName}
                {interview.intervieweeCompany && ` (${interview.intervieweeCompany})`}
              </p>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* リハーサルモード */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PlayCircleIcon className="w-5 h-5 text-blue-600" />
                  リハーサル
                </CardTitle>
                <CardDescription>
                  本番前に練習できます
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                  <li>✓ 質問を確認しながら練習</li>
                  <li>✓ 回答を試すことができます</li>
                  <li>✓ 本番には記録されません</li>
                </ul>
                <Button
                  onClick={() => {
                    setModeSelected(true)
                    setIsRehearsalMode(true)
                    handleStartRehearsal()
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={!interviewerProfile}
                >
                  <PlayCircleIcon className="w-4 h-4 mr-2" />
                  リハーサルを開始
                </Button>
              </CardContent>
            </Card>

            {/* 本番インタビュー */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-purple-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MicIcon className="w-5 h-5 text-purple-600" />
                  本番インタビュー
                </CardTitle>
                <CardDescription>
                  正式なインタビューを開始します
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                  <li>✓ 正式なインタビューを開始</li>
                  <li>✓ すべての会話が記録されます</li>
                  <li>✓ 記事制作に使用されます</li>
                </ul>
                <Button
                  onClick={() => {
                    router.push(`/interview/${interviewId}`)
                  }}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
                >
                  <ArrowRightIcon className="w-4 h-4 mr-2" />
                  本番インタビューを開始
                </Button>
              </CardContent>
            </Card>
          </div>

          {interviewerProfile && (
            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              <p>インタビュアー: {interviewerProfile.name || 'インタビュアー'}</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 進捗計算（聞きたいことが聞けているか、答えが得られているかを基準）
  const overallCompletionRate = progressEvaluation?.overallCompletionRate || 0
  const progressPercentage = overallCompletionRate
  
  // 聞きたいことの項目数
  const objectiveItems = interview?.objective 
    ? interview.objective.split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0)
        .map((line: string) => line.replace(/^[-*•]\s*/, '').trim())
        .filter((line: string) => line.length > 0)
    : []
  
  const totalItems = objectiveItems.length || 1
  const completedItems = progressEvaluation?.items 
    ? progressEvaluation.items.filter((item: any) => item.status === 'complete').length
    : 0
  const partialItems = progressEvaluation?.items
    ? progressEvaluation.items.filter((item: any) => item.status === 'partial').length
    : 0
  const remainingItems = totalItems - completedItems - partialItems
  
  // 残り時間の推定（達成率の進捗速度から計算）
  const calculateEstimatedTime = () => {
    if (!startTime || overallCompletionRate === 0 || overallCompletionRate >= 100) return null
    
    const now = new Date()
    const elapsed = (now.getTime() - startTime.getTime()) / 1000 / 60 // 分
    const progressPerMinute = overallCompletionRate / elapsed // 1分あたりの達成率
    const remainingProgress = 100 - overallCompletionRate
    const estimatedRemainingMinutes = remainingProgress / progressPerMinute
    
    if (estimatedRemainingMinutes < 1) {
      return 'あと数分'
    } else if (estimatedRemainingMinutes < 60) {
      return `あと約${Math.ceil(estimatedRemainingMinutes)}分`
    } else {
      const hours = Math.floor(estimatedRemainingMinutes / 60)
      const minutes = Math.ceil(estimatedRemainingMinutes % 60)
      return `あと約${hours}時間${minutes > 0 ? `${minutes}分` : ''}`
    }
  }
  
  const estimatedTime = calculateEstimatedTime()
  
  // 表示するメッセージ（リハーサルモードの場合はリハーサルメッセージ、そうでない場合は通常メッセージ）
  const displayMessages = isRehearsalMode && rehearsalMessages.length > 0 
    ? rehearsalMessages.map((msg, idx) => ({
        ...msg,
        timestamp: new Date(Date.now() - (rehearsalMessages.length - idx) * 1000)
      }))
    : messages

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ヘッダー */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {interview.title || 'インタビュー'}
          </h1>
          {interview.intervieweeName && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {interview.intervieweeName}
              {interview.intervieweeCompany && ` (${interview.intervieweeCompany})`}
            </p>
          )}
          
          {/* リハーサルモードコントロール */}
          {!isRehearsalMode && !interview.messages?.length && (
            <div className="mt-4 flex gap-2">
              <Button
                onClick={handleStartRehearsal}
                className="flex-1"
                variant="outline"
                size="sm"
              >
                <PlayCircleIcon className="w-4 h-4 mr-2" />
                リハーサル開始
              </Button>
            </div>
          )}
          
          {isRehearsalMode && (
            <div className="mt-4 flex gap-2">
              {!isRehearsalActive ? (
                <Button
                  onClick={handleResumeRehearsal}
                  className="flex-1"
                  variant="outline"
                  size="sm"
                >
                  <PlayCircleIcon className="w-4 h-4 mr-2" />
                  再開
                </Button>
              ) : (
                <Button
                  onClick={handleStopRehearsal}
                  className="flex-1"
                  variant="outline"
                  size="sm"
                >
                  <PauseIcon className="w-4 h-4 mr-2" />
                  一時停止
                </Button>
              )}
              <Button
                onClick={handleResetRehearsal}
                className="flex-1"
                variant="outline"
                size="sm"
              >
                <SquareIcon className="w-4 h-4 mr-2" />
                リセット
              </Button>
              {rehearsalMessages.length > 0 && (
                <Button
                  onClick={handleDeleteRehearsalMessages}
                  className="flex-1"
                  variant="outline"
                  size="sm"
                >
                  削除
                </Button>
              )}
            </div>
          )}
          
          {/* リハーサルモード表示 */}
          {isRehearsalMode && (
            <div className="mt-2 px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                🎭 リハーサルモード
                {listening && <span className="ml-2">🎤 音声認識中...</span>}
                {playingQuestion && <span className="ml-2">🔊 質問読み上げ中...</span>}
                {processing && <span className="ml-2">⏳ 処理中...</span>}
              </p>
            </div>
          )}
          
          {/* 進捗メーター */}
          {!isRehearsalMode && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                <span>
                  {evaluatingProgress ? (
                    <span className="flex items-center gap-1">
                      <LoaderIcon className="w-3 h-3 animate-spin" />
                      評価中...
                    </span>
                  ) : (
                    <span>
                      {completedItems > 0 && `${completedItems}項目完了`}
                      {completedItems > 0 && partialItems > 0 && ' / '}
                      {partialItems > 0 && `${partialItems}項目部分回答`}
                      {completedItems === 0 && partialItems === 0 && '聞きたいことを確認中...'}
                    </span>
                  )}
                </span>
                <span>{Math.round(progressPercentage)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                {progressPercentage < 100 ? (
                  <>
                    <span className="text-gray-600 dark:text-gray-400">
                      {remainingItems > 0 && `残り${remainingItems}項目`}
                      {remainingItems === 0 && partialItems > 0 && '深掘りが必要な項目あり'}
                      {remainingItems === 0 && partialItems === 0 && 'ほぼ完了'}
                    </span>
                    {estimatedTime && (
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        {estimatedTime}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    聞きたいことは全て聞けました
                  </span>
                )}
              </div>
              {progressEvaluation?.summary && (
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {progressEvaluation.summary}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* インタビュアープロフィール */}
        {interviewerProfile && (
          <div className="flex items-center gap-4 bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            {interviewerProfile.photoURL ? (
              <div className="relative w-16 h-16 rounded-full overflow-hidden flex-shrink-0">
                <Image
                  src={interviewerProfile.photoURL}
                  alt={interviewerProfile.name || 'インタビュアー'}
                  fill
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xl font-bold">
                  {interviewerProfile.name?.charAt(0) || 'I'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {interviewerProfile.name || 'インタビュアー'}
              </p>
              {interviewerProfile.role && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {interviewerProfile.role}
                </p>
              )}
            </div>
          </div>
        )}

        {/* 会話履歴 */}
        <div className="space-y-4">
          {displayMessages.map((msg, index) => (
            <div
              key={index}
              className={`flex gap-3 ${
                msg.role === 'interviewer' ? 'justify-start' : 'justify-end'
              }`}
            >
              {msg.role === 'interviewer' && interviewerProfile && (
                <div className="flex-shrink-0">
                  {interviewerProfile.photoURL ? (
                    <div className="relative w-10 h-10 rounded-full overflow-hidden">
                      <Image
                        src={interviewerProfile.photoURL}
                        alt={interviewerProfile.name || 'インタビュアー'}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white text-sm font-bold">
                        {interviewerProfile.name?.charAt(0) || 'I'}
                      </span>
                    </div>
                  )}
                </div>
              )}
              
              <div
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  msg.role === 'interviewer'
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-gray-900 dark:text-gray-100'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap break-words">
                  {msg.content}
                </p>
              </div>
            </div>
          ))}

          {/* リハーサルモードの現在の文字起こし */}
          {isRehearsalMode && isRehearsalActive && currentTranscript && (
            <div className="flex gap-3 justify-end">
              <div className="max-w-[80%] rounded-lg px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 opacity-70">
                <p className="text-sm whitespace-pre-wrap break-words italic">
                  {currentTranscript}
                </p>
              </div>
            </div>
          )}

          {/* 生成中インジケーター */}
          {isGenerating && !isRehearsalMode && (
            <div className="flex gap-3 justify-start">
              {interviewerProfile && (
                <div className="flex-shrink-0">
                  {interviewerProfile.photoURL ? (
                    <div className="relative w-10 h-10 rounded-full overflow-hidden">
                      <Image
                        src={interviewerProfile.photoURL}
                        alt={interviewerProfile.name || 'インタビュアー'}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white text-sm font-bold">
                        {interviewerProfile.name?.charAt(0) || 'I'}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">質問を準備中</span>
                  <span className="inline-flex gap-1 ml-2">
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  )
}
