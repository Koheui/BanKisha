'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useAudioRecorder } from '@/src/hooks/useAudioRecorder'
import { formatDuration } from '@/src/lib/utils'
import {
  MicIcon,
  StopCircleIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon,
  CheckCircleIcon,
  AlertCircleIcon
} from 'lucide-react'

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number, transcript?: string) => void
  maxDuration?: number
}

export function AudioRecorder({ onRecordingComplete, maxDuration = 180 }: AudioRecorderProps) {
  const {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
    error: recorderError
  } = useAudioRecorder({ maxDuration })

  const [isPlaying, setIsPlaying] = useState(false)
  const [transcript, setTranscript] = useState('')
  const audioRef = useRef<HTMLAudioElement>(null)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onended = () => setIsPlaying(false)
    }
  }, [audioUrl])

  // Initialize Web Speech API for transcription
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || 
                               (window as any).webkitSpeechRecognition
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'ja-JP'
        
        recognition.onresult = (event: any) => {
          const currentTranscript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('')
          setTranscript(currentTranscript)
        }
        
        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error)
          // Don't show error to user, just log it
        }
        
        recognitionRef.current = recognition
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  const handlePlayPause = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const handleStartRecording = () => {
    setTranscript('')
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start()
      } catch (err) {
        // Already started, ignore
      }
    }
    startRecording()
  }

  const handleStopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    stopRecording()
  }

  const handlePauseRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    pauseRecording()
  }

  const handleResumeRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start()
      } catch (err) {
        // Already started, ignore
      }
    }
    resumeRecording()
  }

  const handleConfirm = () => {
    if (audioBlob) {
      onRecordingComplete(audioBlob, duration, transcript.trim())
      clearRecording()
      setTranscript('')
    }
  }

  const progress = (duration / maxDuration) * 100

  return (
    <div className="space-y-6">
      {/* Recording Status */}
      <Card className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 border-0">
        <div className="text-center space-y-4">
          {/* Microphone Icon */}
          <div className="relative inline-block">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center ${
              isRecording && !isPaused 
                ? 'bg-gradient-to-r from-red-500 to-pink-500 recording-button' 
                : 'bg-gradient-to-r from-blue-600 to-purple-600'
            }`}>
              <MicIcon className="w-12 h-12 text-white" />
            </div>
            {isRecording && !isPaused && (
              <>
                <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-pulse-ring" />
                <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-pulse-ring animation-delay-500" />
              </>
            )}
          </div>

          {/* Duration Display */}
          <div className="space-y-2">
            <div className="text-4xl font-bold gradient-text">
              {formatDuration(duration)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              最大 {formatDuration(maxDuration)}
            </div>
          </div>

          {/* Progress Bar */}
          {(isRecording || audioBlob) && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{formatDuration(duration)}</span>
                <span>{formatDuration(maxDuration - duration)} 残り</span>
              </div>
            </div>
          )}

          {/* Status Message */}
          {isRecording && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {isPaused ? '一時停止中' : '録音中...'}
                </span>
              </div>
              {transcript && (
                <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">認識中のテキスト:</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{transcript}</p>
                </div>
              )}
            </div>
          )}

          {audioBlob && !isRecording && (
            <div className="flex items-center justify-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                録音完了！ 確認してください
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Error Message */}
      {recorderError && (
        <Card className="p-4 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-2">
            <AlertCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-600 dark:text-red-400">{recorderError}</span>
          </div>
        </Card>
      )}

      {/* Control Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {!isRecording && !audioBlob && (
          <Button
            onClick={handleStartRecording}
            variant="gradient"
            size="lg"
            className="col-span-2 md:col-span-4"
          >
            <MicIcon className="w-5 h-5 mr-2" />
            録音開始
          </Button>
        )}

        {isRecording && (
          <>
            {!isPaused ? (
              <Button
                onClick={handlePauseRecording}
                variant="outline"
                size="lg"
                className="col-span-1 md:col-span-2"
              >
                <PauseIcon className="w-5 h-5 mr-2" />
                一時停止
              </Button>
            ) : (
              <Button
                onClick={handleResumeRecording}
                variant="gradient"
                size="lg"
                className="col-span-1 md:col-span-2"
              >
                <PlayIcon className="w-5 h-5 mr-2" />
                再開
              </Button>
            )}
            
            <Button
              onClick={handleStopRecording}
              variant="destructive"
              size="lg"
              className="col-span-1 md:col-span-2"
            >
              <StopCircleIcon className="w-5 h-5 mr-2" />
              停止
            </Button>
          </>
        )}

        {audioBlob && !isRecording && (
          <>
            <Button
              onClick={handlePlayPause}
              variant="outline"
              size="lg"
            >
              {isPlaying ? (
                <>
                  <PauseIcon className="w-5 h-5 mr-2" />
                  一時停止
                </>
              ) : (
                <>
                  <PlayIcon className="w-5 h-5 mr-2" />
                  再生
                </>
              )}
            </Button>

            <Button
              onClick={clearRecording}
              variant="outline"
              size="lg"
            >
              <TrashIcon className="w-5 h-5 mr-2" />
              削除
            </Button>

            <Button
              onClick={handleConfirm}
              variant="gradient"
              size="lg"
              className="col-span-2"
            >
              <CheckCircleIcon className="w-5 h-5 mr-2" />
              この録音を使用
            </Button>
          </>
        )}
      </div>

      {/* Hidden Audio Element */}
      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} className="hidden" />
      )}

      {/* Visual Feedback */}
      {isRecording && !isPaused && (
        <div className="flex items-center justify-center gap-2">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-gradient-to-t from-blue-600 to-purple-600 rounded-full voice-wave"
              style={{
                height: `${20 + Math.random() * 40}px`,
                animationDelay: `${i * 0.1}s`
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
