'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  audioUrl?: string
}

interface UseVoiceChatProps {
  onConversationComplete?: (messages: Message[]) => void
}

interface UseVoiceChatReturn {
  messages: Message[]
  isListening: boolean
  isSpeaking: boolean
  isProcessing: boolean
  error: string | null
  startConversation: () => Promise<void>
  stopConversation: () => void
  sendMessage: (text: string) => Promise<void>
  clearMessages: () => void
}

export function useVoiceChat({
  onConversationComplete
}: UseVoiceChatProps = {}): UseVoiceChatReturn {
  const [messages, setMessages] = useState<Message[]>([])
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<any>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  // Initialize Web Speech API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check for browser support
      const SpeechRecognition = (window as any).SpeechRecognition || 
                               (window as any).webkitSpeechRecognition
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'ja-JP'
        
        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('')
          
          if (event.results[event.results.length - 1].isFinal) {
            handleUserMessage(transcript)
          }
        }
        
        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error)
          setError(`音声認識エラー: ${event.error}`)
          setIsListening(false)
        }
        
        recognitionRef.current = recognition
      } else {
        setError('このブラウザは音声認識をサポートしていません')
      }

      synthRef.current = window.speechSynthesis
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (synthRef.current) {
        synthRef.current.cancel()
      }
    }
  }, [])

  const handleUserMessage = async (text: string) => {
    if (!text.trim()) return

    const userMessage: Message = {
      role: 'user',
      content: text,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setIsProcessing(true)

    try {
      // Call API to get AI response
      const response = await fetch('/api/voice-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
      })

      if (!response.ok) {
        throw new Error('AIからの応答を取得できませんでした')
      }

      const data = await response.json()
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])

      // Speak AI response
      await speakText(data.message)

      // Check if conversation is complete
      if (data.isComplete) {
        stopConversation()
        if (onConversationComplete) {
          onConversationComplete([...messages, userMessage, assistantMessage])
        }
      }
    } catch (err) {
      console.error('Error in voice chat:', err)
      setError('会話の処理中にエラーが発生しました')
    } finally {
      setIsProcessing(false)
    }
  }

  const speakText = async (text: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!synthRef.current) {
        reject(new Error('音声合成が利用できません'))
        return
      }

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'ja-JP'
      utterance.rate = 0.9
      utterance.pitch = 1.0
      utterance.volume = 1.0

      utterance.onend = () => {
        setIsSpeaking(false)
        resolve()
      }

      utterance.onerror = (event) => {
        setIsSpeaking(false)
        reject(new Error('音声合成エラー'))
      }

      setIsSpeaking(true)
      synthRef.current.speak(utterance)
    })
  }

  const startConversation = useCallback(async () => {
    try {
      setError(null)
      
      if (!recognitionRef.current) {
        setError('音声認識が利用できません')
        return
      }

      // Start with greeting
      const greeting: Message = {
        role: 'assistant',
        content: 'こんにちは！BanKishaの番記者です。今日はお時間をいただき、ありがとうございます。まず、御社の会社名と事業内容について教えていただけますか？',
        timestamp: new Date()
      }

      setMessages([greeting])
      await speakText(greeting.content)

      // Start speech recognition
      recognitionRef.current.start()
      setIsListening(true)
    } catch (err) {
      console.error('Error starting conversation:', err)
      setError('会話の開始に失敗しました')
    }
  }, [])

  const stopConversation = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    if (synthRef.current) {
      synthRef.current.cancel()
    }
    setIsListening(false)
    setIsSpeaking(false)
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    await handleUserMessage(text)
  }, [messages])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    isListening,
    isSpeaking,
    isProcessing,
    error,
    startConversation,
    stopConversation,
    sendMessage,
    clearMessages
  }
}
