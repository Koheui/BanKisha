'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { getFirebaseDb } from '@/src/lib/firebase'
import { doc, getDoc, updateDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MicIcon, Volume2Icon, PauseIcon, SquareIcon, ArrowLeftIcon, CheckCircleIcon, LoaderIcon } from 'lucide-react'
import Image from 'next/image'
import { InterviewSession, Message, InterviewerProfile } from '@/src/types'

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

export default function VoiceChatInterviewPage() {
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
  const [loading, setLoading] = useState(true)
  const [listening, setListening] = useState(false) // 音声認識中かどうか
  const [playing, setPlaying] = useState(false)
  const [playingQuestion, setPlayingQuestion] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState('')
  const [volume, setVolume] = useState(1.0) // 音量（0.0-1.0）
  const [progressEvaluation, setProgressEvaluation] = useState<any>(null)
  const [evaluatingProgress, setEvaluatingProgress] = useState(false)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioElementRef = useRef<HTMLAudioElement | null>(null)
  const recognitionRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isRecognitionActiveRef = useRef<boolean>(false)
  const questionPlaybackStartTimeRef = useRef<number>(0) // 質問の読み上げ開始時刻

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
    if (questionIndex >= questions.length || !questions[questionIndex] || !interviewerProfile) {
      console.warn('⚠️ 質問の読み上げをスキップ:', { questionIndex, questionsLength: questions.length, interviewerProfile: !!interviewerProfile })
      return
    }

    let question = questions[questionIndex]
    const interviewerName = interviewerProfile.name || interview?.interviewerName || 'インタビュアー'
    question = question.replace(/あなたの名前/g, interviewerName).replace(/あなたの名前/g, interviewerName)

    console.log('🎤 質問を読み上げます:', { questionText: question.substring(0, 100) })

    try {
      setPlayingQuestion(true)
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: question,
          voiceType: interviewerProfile.voiceSettings?.voiceType || 'Puck',
          speed: interviewerProfile.voiceSettings?.speed || 1.0,
        }),
      })

      if (!response.ok) throw new Error(`音声生成に失敗しました: ${response.status}`)

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      
      if (audioElementRef.current) {
        audioElementRef.current.pause()
      }
      const audio = new Audio(audioUrl)
      audioElementRef.current = audio
      audio.volume = volume
      
      questionPlaybackStartTimeRef.current = Date.now()
      
      audio.onended = () => {
        setPlayingQuestion(false)
        URL.revokeObjectURL(audioUrl)
        addDoc(collection(getFirebaseDb(), `interviews/${interviewId}/messages`), {
          role: 'interviewer',
          content: question,
          timestamp: serverTimestamp(),
        }).catch(saveError => console.error('⚠️ メッセージ保存エラー（続行）:', saveError))
        
        setTimeout(() => {
          if (!playingQuestion && !processing) {
            startListening()
          }
        }, 2000)
      }
      
      audio.onerror = (e) => {
        console.error('❌ 音声再生エラー:', e)
        setPlayingQuestion(false)
        URL.revokeObjectURL(audioUrl)
        alert('❌ 音声の再生に失敗しました')
      }
      
      await audio.play()
    } catch (error) {
      console.error('❌ 質問読み上げエラー:', error)
      setPlayingQuestion(false)
      alert(`❌ 質問の読み上げに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`)
    }
  }, [questions, interviewerProfile, interviewId, volume, interview?.interviewerName])

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
        setInterview(loadedInterview)
        
        const parsedQuestions = parseQuestions(loadedInterview.questions, loadedInterview.objective)
        if (parsedQuestions.length === 0) {
          console.warn('⚠️ 質問が見つかりませんでした。')
        }
        setQuestions(parsedQuestions)

        if (loadedInterview.interviewerId) {
          const interviewerDocRef = doc(getFirebaseDb(), 'interviewers', loadedInterview.interviewerId)
          const interviewerDocSnap = await getDoc(interviewerDocRef)
          if (interviewerDocSnap.exists()) {
            const interviewerData = interviewerDocSnap.data() as any
            setInterviewerProfile({
              id: interviewerDocSnap.id,
              ...interviewerData,
              createdAt: interviewerData.createdAt?.toDate(),
              updatedAt: interviewerData.updatedAt?.toDate(),
            })
          }
        }
      } else {
        alert('⚠️ インタビューが見つかりません')
        router.push('/')
      }
    } catch (error) {
      console.error('Error loading interview data:', error)
      alert('❌ インタビューデータの読み込みに失敗しました')
    } finally {
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

  const setupMessagesListener = useCallback(() => {
    const q = query(collection(getFirebaseDb(), `interviews/${interviewId}/messages`), orderBy('timestamp', 'asc'))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate(),
      })) as Message[]
      setMessages(newMessages)
      
      if (newMessages.length > 0 && interview?.objective) {
        const conversationHistory = newMessages.map(msg => ({ role: msg.role, content: msg.content || '' }))
        setTimeout(() => evaluateProgress(conversationHistory), 2000)
      }
    }, (error) => {
      console.error('Error listening to messages:', error)
    })
    return unsubscribe
  }, [interviewId, interview?.objective, evaluateProgress])

  useEffect(() => {
    if (interviewId) {
      loadInterviewData()
      const unsubscribe = setupMessagesListener()
      initializeSpeechRecognition()
      return () => {
        unsubscribe?.()
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop()
        if (recognitionRef.current && isRecognitionActiveRef.current) {
          try {
            recognitionRef.current.stop()
          } catch (e) { /* ignore */ }
          isRecognitionActiveRef.current = false
        }
        streamRef.current?.getTracks().forEach(track => track.stop())
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current)
      }
    }
  }, [interviewId, loadInterviewData, setupMessagesListener])
  
  const generateIntroductionMessage = useCallback((): string => {
    if (!interview) return ''
    const parts: string[] = []
    const interviewerName = interviewerProfile?.name || interview.interviewerName || 'インタビュアー'
    parts.push('本日はお時間をいただき、ありがとうございます。')
    parts.push(`私、${interviewerName}と申します。`)
    if (interview.interviewPurpose) parts.push(`本日は、${interview.interviewPurpose}についてお話を伺いたいと思っています。`)
    if (interview.targetAudience) parts.push(`${interview.targetAudience}の方々に向けて、`)
    if (interview.mediaType) parts.push(`${interview.mediaType}に掲載予定です。`)
    if (interview.objective) {
      const objectives = interview.objective.split('\n').filter((line: string) => line.trim()).slice(0, 3)
      if (objectives.length > 0) {
        parts.push('特に、以下の点について詳しくお聞かせいただければと思います。')
        objectives.forEach((obj: string, index: number) => {
          const cleaned = obj.replace(/^[-*•]\s*/, '').trim()
          if (cleaned) {
            if (index === objectives.length - 1) {
              parts.push(`${index + 1}つ目は、${cleaned}についてです。`)
            } else {
              parts.push(`${index + 1}つ目は、${cleaned}、`)
            }
          }
        })
      }
    }
    parts.push('それでは、よろしくお願いいたします。')
    return parts.join(' ')
  }, [interview, interviewerProfile])

  const handlePlayIntroduction = useCallback(async (): Promise<void> => {
    if (!interviewerProfile) return
    const introductionText = generateIntroductionMessage()
    if (!introductionText) return

    setPlayingQuestion(true)
    try {
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: introductionText,
          voiceType: interviewerProfile.voiceSettings?.voiceType || 'Puck',
          speed: interviewerProfile.voiceSettings?.speed || 1.0,
        }),
      })
      if (!response.ok) throw new Error(`音声生成に失敗しました: ${response.status}`)
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

  const [hasStarted, setHasStarted] = useState(false)
  
  useEffect(() => {
    if (!isTestMode && questions.length > 0 && currentQuestionIndex === 0 && messages.length === 0 && !playingQuestion && !hasStarted && interviewerProfile && interview && !loading) {
      setHasStarted(true)
      setTimeout(async () => {
        try {
          await handlePlayIntroduction()
          setTimeout(() => handlePlayQuestion(0), 500)
        } catch (error) {
          console.error('❌ 導入メッセージまたは最初の質問の読み上げに失敗:', error)
          handlePlayQuestion(0)
        }
      }, 100)
    }
  }, [questions, currentQuestionIndex, messages.length, interviewerProfile, interview, loading, playingQuestion, handlePlayQuestion, handlePlayIntroduction, isTestMode, hasStarted])
  
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
      
      const transcriptRef = { current: '' }
      
      recognition.onresult = (event: any) => {
        if ((Date.now() - questionPlaybackStartTimeRef.current) < 5000) return
        
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
        
        if (newFinalTranscript) transcriptRef.current += newFinalTranscript
        setCurrentTranscript(transcriptRef.current + interimTranscript)
        
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current)
        
        if (newFinalTranscript && transcriptRef.current.trim().length >= 10) {
          silenceTimeoutRef.current = setTimeout(() => {
            if (transcriptRef.current.trim().length >= 10 && !processing && !playingQuestion) {
              const responseText = transcriptRef.current.trim()
              transcriptRef.current = ''
              processResponse(responseText)
            }
          }, 5000)
        }
      }
      
      recognition.onstart = () => {
        isRecognitionActiveRef.current = true
        setListening(true)
      }
      
      recognition.onerror = (event: any) => {
        if (event.error === 'aborted' || event.error === 'no-speech') {
          isRecognitionActiveRef.current = false
          if (event.error === 'no-speech' && transcriptRef.current.trim().length >= 10) {
             processResponse(transcriptRef.current.trim())
             transcriptRef.current = ''
          } else if (!processing && !playingQuestion && !isRecognitionActiveRef.current) {
            setTimeout(() => {
              if (!processing && !playingQuestion && recognitionRef.current && !isRecognitionActiveRef.current) {
                try {
                  recognitionRef.current.start()
                } catch (e: any) {
                  if (e.name !== 'InvalidStateError') console.error('音声認識の再開に失敗:', e)
                }
              }
            }, 1000)
          }
          return
        }
        console.error('音声認識エラー:', event.error)
        isRecognitionActiveRef.current = false
      }
      
      recognition.onend = () => {
        isRecognitionActiveRef.current = false
        if (processing || playingQuestion) return
        
        const currentTranscriptText = transcriptRef.current.trim()
        if (currentTranscriptText.length >= 10) {
          setTimeout(() => {
            if (!processing && !playingQuestion && transcriptRef.current.trim().length >= 10) {
              processResponse(transcriptRef.current.trim())
              transcriptRef.current = ''
            }
          }, 2000)
        } else {
          setTimeout(() => {
            if (!processing && !playingQuestion && recognitionRef.current && !isRecognitionActiveRef.current) {
              try {
                recognitionRef.current.start()
              } catch (e: any) {
                if (e.name !== 'InvalidStateError') console.error('音声認識の再開に失敗:', e)
              }
            }
          }, 1000)
        }
      }
      recognitionRef.current = recognition
    }
  }

  const startListening = async () => {
    if (playingQuestion || processing) {
      setTimeout(() => {
        if (!playingQuestion && !processing) startListening()
      }, 1000)
      return
    }
    
    if (!recognitionRef.current) initializeSpeechRecognition()
    
    try {
      if (!streamRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream
        const mediaRecorder = new MediaRecorder(stream)
        mediaRecorderRef.current = mediaRecorder
        audioChunksRef.current = []
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data)
        }
        mediaRecorder.start()
      }
      
      if (recognitionRef.current && !isRecognitionActiveRef.current) {
        recognitionRef.current.start()
      }
      setListening(true)
      setCurrentTranscript('')
    } catch (error) {
      console.error('Error starting listening:', error)
      alert('❌ マイクへのアクセスに失敗しました。マイクの使用を許可してください。')
    }
  }

  const processResponse = async (transcript: string) => {
    if (processing || !transcript.trim()) return
    setProcessing(true)
    setListening(false)
    playKnockSound().catch(e => console.error('❌ 効果音の再生に失敗:', e))
    
    if (recognitionRef.current && isRecognitionActiveRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) { console.error('音声認識の停止エラー:', e) }
      isRecognitionActiveRef.current = false
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop()

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
      const userResponse = transcript.trim()
      
      const interviewDocRef = doc(getFirebaseDb(), 'interviews', interviewId)
      const interviewDocSnap = await getDoc(interviewDocRef)
      if (interviewDocSnap.exists() && interviewDocSnap.data().rehearsalMessages?.length > 0) {
        await updateDoc(interviewDocRef, { rehearsalMessages: [], updatedAt: serverTimestamp() })
      }
      
      await addDoc(collection(getFirebaseDb(), `interviews/${interviewId}/messages`), {
        role: 'interviewee',
        content: userResponse,
        audioUrl: URL.createObjectURL(audioBlob),
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
      
      // 相槌生成
      try {
        const reactionResponse = await fetch('/api/interview/generate-reaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userResponse, interviewerPrompt: interviewerProfile?.prompt || '', reactionPatterns: interviewerProfile?.reactionPatterns || '' }),
        })
        if (reactionResponse.ok) {
          const reactionData = await reactionResponse.json()
          if (reactionData.reaction) {
            const reactionAudioResponse = await fetch('/api/text-to-speech', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: reactionData.reaction, voiceType: interviewerProfile?.voiceSettings?.voiceType || 'Puck', speed: interviewerProfile?.voiceSettings?.speed || 1.0 }),
            })
            if (reactionAudioResponse.ok) {
              const reactionAudioBlob = await reactionAudioResponse.blob()
              const reactionAudioUrl = URL.createObjectURL(reactionAudioBlob)
              const reactionAudio = new Audio(reactionAudioUrl)
              await reactionAudio.play()
              reactionAudio.onended = () => URL.revokeObjectURL(reactionAudioUrl)
              await addDoc(collection(getFirebaseDb(), `interviews/${interviewId}/messages`), {
                role: 'interviewer',
                content: reactionData.reaction,
                audioUrl: reactionAudioUrl,
                timestamp: serverTimestamp(),
              })
            }
          }
        }
      } catch (error) { console.error('❌ 反応生成エラー:', error) }
      
      const conversationHistory = [...messages, { role: 'interviewee', content: userResponse }].map(msg => ({ role: msg.role, content: msg.content || '' }))
      
      let needsMoreInfo = false
      let suggestedAngle = ''
      // 回答評価
      try {
        const evaluationResponse = await fetch('/api/interview/evaluate-response', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: questions[currentQuestionIndex], userResponse, interviewObjective: interview?.objective || '', conversationHistory }),
        })
        if (evaluationResponse.ok) {
          const evaluationData = await evaluationResponse.json()
          if (evaluationData.evaluation && !evaluationData.evaluation.isSufficient) {
            needsMoreInfo = true
            suggestedAngle = evaluationData.evaluation.suggestedAngle || evaluationData.evaluation.missingElements?.join('、') || ''
          }
        }
      } catch (error) { console.error('Error evaluating response:', error) }

      // 追加質問生成
      try {
        const response = await fetch('/api/interview/generate-follow-up', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: questions[currentQuestionIndex], userResponse, interviewObjective: interview?.objective || '', interviewerPrompt: interviewerProfile?.prompt || '', knowledgeBaseIds: interview?.knowledgeBaseIds || [], conversationHistory, needsMoreInfo, suggestedAngle }),
        })
        if (response.ok) {
          const data = await response.json()
          if (data.question) {
            const newQuestions = [...questions, data.question]
            setQuestions(newQuestions)
            const followUpIndex = newQuestions.length - 1
            setCurrentQuestionIndex(followUpIndex)
            setTimeout(() => handlePlayQuestion(followUpIndex), 1000)
            setProcessing(false)
            setCurrentTranscript('')
            return
          }
        }
      } catch (error) { console.error('Error generating follow-up question:', error) }

      // 動的質問生成
      try {
        playKnockSound().catch(e => console.error('❌ 効果音の再生に失敗:', e))
        const nextQuestionResponse = await fetch('/api/interview/generate-next-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationHistory, interviewPurpose: interview?.interviewPurpose || '', targetAudience: interview?.targetAudience || '', mediaType: interview?.mediaType || '', objective: interview?.objective || '', knowledgeBaseIds: interview?.knowledgeBaseIds || [] }),
        })
        if (nextQuestionResponse.ok) {
          const nextQuestionData = await nextQuestionResponse.json()
          if (nextQuestionData.question) {
            const newQuestions = [...questions, nextQuestionData.question]
            setQuestions(newQuestions)
            const newQuestionIndex = newQuestions.length - 1
            setCurrentQuestionIndex(newQuestionIndex)
            setTimeout(() => handlePlayQuestion(newQuestionIndex), 1000)
            setProcessing(false)
            setCurrentTranscript('')
            return
          }
        }
      } catch (error) { console.error('Error generating next question dynamically:', error) }

      // 次の質問へ
      const nextIndex = currentQuestionIndex + 1
      if (nextIndex < questions.length) {
        setCurrentQuestionIndex(nextIndex)
        setTimeout(() => handlePlayQuestion(nextIndex), 1000)
      } else {
        if (userResponse.length < 10) {
          // 短い回答の場合は完了しない
          return
        }
        
        // 完了処理
        const finalMessage = 'もし言い残したことがあればぜひお話ください。'
        try {
          if (interviewerProfile) {
            const finalAudioResponse = await fetch('/api/text-to-speech', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: finalMessage, voiceType: interviewerProfile.voiceSettings?.voiceType || 'Puck', speed: interviewerProfile.voiceSettings?.speed || 1.0 }),
            })
            if (finalAudioResponse.ok) {
              const finalAudioBlob = await finalAudioResponse.blob()
              if (finalAudioBlob.size > 0) {
                const finalAudioUrl = URL.createObjectURL(finalAudioBlob)
                const finalAudio = new Audio(finalAudioUrl)
                await finalAudio.play()
                finalAudio.onended = () => URL.revokeObjectURL(finalAudioUrl)
                await addDoc(collection(getFirebaseDb(), `interviews/${interviewId}/messages`), {
                  role: 'interviewer',
                  content: finalMessage,
                  audioUrl: finalAudioUrl,
                  timestamp: serverTimestamp(),
                })
              }
            }
          }
        } catch (error) { console.error('Error adding final message:', error) }
        
        await updateDoc(doc(getFirebaseDb(), 'interviews', interviewId), {
          status: 'completed',
          updatedAt: serverTimestamp(),
        })
        alert('✅ インタビューが完了しました！')
      }
    } catch (error) {
      console.error('Error processing response:', error)
      alert('❌ 回答の保存に失敗しました')
    } finally {
      setProcessing(false)
      setCurrentTranscript('')
    }
  }

  useEffect(() => {
    if (messages.length > 0 && !startTime) {
      setStartTime(new Date())
    }
  }, [messages.length, startTime])
  
  const currentQuestion = useMemo(() => questions[currentQuestionIndex], [questions, currentQuestionIndex]);
  const isInterviewComplete = useMemo(() => questions.length === 0 || currentQuestionIndex >= questions.length, [questions, currentQuestionIndex]);

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
          
          {/* 音量調整と停止ボタン */}
          {!isInterviewComplete && questions.length > 0 && (
            <div className="mt-4 space-y-3">
              {/* 音量調整 */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 dark:text-gray-400 w-12">音量</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                />
                <span className="text-xs text-gray-600 dark:text-gray-400 w-8 text-right">
                  {Math.round(volume * 100)}%
                </span>
              </div>
              
              {/* 停止ボタン */}
              <Button
                onClick={async () => {
                  console.log('⏹️ 停止ボタンがクリックされました')
                  if (playing) handleStopAudio()
                  if (playingQuestion) {
                    if (audioElementRef.current) {
                      audioElementRef.current.pause()
                      audioElementRef.current.currentTime = 0
                      audioElementRef.current = null
                    }
                    setPlayingQuestion(false)
                  }
                  if (recognitionRef.current) {
                    try {
                      recognitionRef.current.stop()
                    } catch (e: any) {
                      console.error('音声認識の停止エラー:', e)
                    } finally {
                      isRecognitionActiveRef.current = false
                      setListening(false)
                    }
                  }
                  if (processing) setProcessing(false)
                  if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current)
                  streamRef.current?.getTracks().forEach(track => track.stop())
                  streamRef.current = null
                  if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                    try {
                      mediaRecorderRef.current.stop()
                    } catch (e: any) { console.error('録音の停止エラー:', e) }
                  }
                  console.log('⏹️ インタビューを停止しました')
                }}
                className="w-full"
                variant="outline"
                size="sm"
              >
                <SquareIcon className="w-4 h-4 mr-2" />
                停止
              </Button>
            </div>
          )}
          
          {/* 状態表示 */}
          {!isInterviewComplete && questions.length > 0 && (
            <div className="mt-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs text-blue-800 dark:text-blue-200">
                🎤 本番インタビュー
                {listening && <span className="ml-2">🎤 音声認識中...</span>}
                {playingQuestion && <span className="ml-2">🔊 質問読み上げ中...</span>}
                {processing && <span className="ml-2">⏳ 処理中...</span>}
              </p>
            </div>
          )}
          
          {/* 進捗メーター */}
          {!isInterviewComplete && questions.length > 0 && interview?.objective && (
            <div className="mt-4 space-y-2">
              {(() => {
                const overallCompletionRate = progressEvaluation?.overallCompletionRate || 0
                const progressPercentage = overallCompletionRate
                const objectiveItems = interview?.objective ? interview.objective.split('\n').map((line: string) => line.trim()).filter((line: string) => line.length > 0).map((line: string) => line.replace(/^[-*•]\s*/, '').trim()).filter((line: string) => line.length > 0) : []
                const totalItems = objectiveItems.length || 1
                const completedItems = progressEvaluation?.items ? progressEvaluation.items.filter((item: any) => item.status === 'complete').length : 0
                const partialItems = progressEvaluation?.items ? progressEvaluation.items.filter((item: any) => item.status === 'partial').length : 0
                const remainingItems = totalItems - completedItems - partialItems
                
                const calculateEstimatedTime = () => {
                  if (!startTime || overallCompletionRate === 0 || overallCompletionRate >= 100) return null
                  const now = new Date()
                  const elapsed = (now.getTime() - startTime.getTime()) / 1000 / 60
                  const progressPerMinute = overallCompletionRate / elapsed
                  const remainingProgress = 100 - overallCompletionRate
                  const estimatedRemainingMinutes = remainingProgress / progressPerMinute
                  if (estimatedRemainingMinutes < 1) return 'あと数分'
                  if (estimatedRemainingMinutes < 60) return `あと約${Math.ceil(estimatedRemainingMinutes)}分`
                  const hours = Math.floor(estimatedRemainingMinutes / 60)
                  const minutes = Math.ceil(estimatedRemainingMinutes % 60)
                  return `あと約${hours}時間${minutes > 0 ? `${minutes}分` : ''}`
                }
                const estimatedTime = calculateEstimatedTime()
                
                return (
                  <>
                    <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                      <span>
                        {evaluatingProgress ? (
                          <span className="flex items-center gap-1"><LoaderIcon className="w-3 h-3 animate-spin" /> 評価中...</span>
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
                          {estimatedTime && <span className="text-blue-600 dark:text-blue-400 font-medium">{estimatedTime}</span>}
                        </>
                      ) : (
                        <span className="text-green-600 dark:text-green-400 font-medium">聞きたいことは全て聞けました</span>
                      )}
                    </div>
                    {progressEvaluation?.summary && <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{progressEvaluation.summary}</p>}
                  </>
                )
              })()}
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
                <Image src={interviewerProfile.photoURL} alt={interviewerProfile.name || 'インタビュアー'} fill className="object-cover" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xl font-bold">{interviewerProfile.name?.charAt(0) || 'I'}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 dark:text-gray-100">{interviewerProfile.name || 'インタビュアー'}</p>
              {interviewerProfile.role && <p className="text-sm text-gray-600 dark:text-gray-400">{interviewerProfile.role}</p>}
            </div>
          </div>
        )}

        {/* 会話履歴 */}
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div key={message.id || index} className={`flex gap-3 ${message.role === 'interviewer' ? 'justify-start' : 'justify-end'}`}>
              {message.role === 'interviewer' && interviewerProfile && (
                <div className="flex-shrink-0">
                  {interviewerProfile.photoURL ? (
                    <div className="relative w-10 h-10 rounded-full overflow-hidden">
                      <Image src={interviewerProfile.photoURL} alt={interviewerProfile.name || 'インタビュアー'} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white text-sm font-bold">{interviewerProfile.name?.charAt(0) || 'I'}</span>
                    </div>
                  )}
                </div>
              )}
              <div className={`max-w-[80%] rounded-lg px-4 py-3 ${message.role === 'interviewer' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-gray-200 dark:bg-gray-700'} text-gray-900 dark:text-gray-100`}>
                <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
              </div>
            </div>
          ))}

          {listening && currentTranscript && (
            <div className="flex gap-3 justify-end">
              <div className="max-w-[80%] rounded-lg px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 opacity-70">
                <p className="text-sm whitespace-pre-wrap break-words italic">{currentTranscript}</p>
              </div>
            </div>
          )}

          {processing && (
            <div className="flex gap-3 justify-start">
              {interviewerProfile && (
                <div className="flex-shrink-0">
                  {interviewerProfile.photoURL ? (
                    <div className="relative w-10 h-10 rounded-full overflow-hidden">
                      <Image src={interviewerProfile.photoURL} alt={interviewerProfile.name || 'インタビュアー'} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white text-sm font-bold">{interviewerProfile.name?.charAt(0) || 'I'}</span>
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

          {isInterviewComplete && questions.length > 0 && (
            <div className="flex gap-3 justify-start">
              {interviewerProfile && (
                <div className="flex-shrink-0">
                  {interviewerProfile.photoURL ? (
                    <div className="relative w-10 h-10 rounded-full overflow-hidden">
                      <Image src={interviewerProfile.photoURL} alt={interviewerProfile.name || 'インタビュアー'} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <span className="text-white text-sm font-bold">{interviewerProfile.name?.charAt(0) || 'I'}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg px-4 py-3">
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  ✅ インタビューが完了しました！すべての質問にご回答いただき、ありがとうございました。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    )}
    </>
  )
}