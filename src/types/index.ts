export interface User {
  uid: string
  email: string | null
  displayName: string | null
  role: 'admin' | 'company'
  companyId: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Company {
  id: string
  name: string
  logoUrl?: string
  website?: string
  foundedYear?: number
  description?: string
  airtableId?: string
  onboarded: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Question {
  id: string
  text: string
  ttsTemplate?: string
}

export interface QuestionSet {
  id: string
  title: string
  questions: Question[]
}

export interface QARecord {
  q: string
  audioPath?: string
  transcript?: string
  durationSec?: number
  textAnswer?: string
}

export interface ArticleDraft {
  title: string
  lead: string
  bodyMd: string
  headings: string[]
}

export interface SNSDraft {
  x140: string
  linkedin300: string
}

export interface PublicMeta {
  publishedAt: Date
  byline: string
  mediaBadge: string
}

export interface Article {
  id: string
  companyId: string
  status: 'draft' | 'submitted' | 'approved' | 'public'
  questionSetId: string
  qa: QARecord[]
  draftArticle: ArticleDraft
  finalArticle?: ArticleDraft
  snsDraft: SNSDraft
  publicMeta?: PublicMeta
  createdAt: Date
  updatedAt: Date
}

export interface Session {
  id: string
  companyId: string
  questionSetId: string
  expiresAt: Date
  status: 'active' | 'completed'
}

export interface OpenAIResponse {
  article: ArticleDraft
  sns: SNSDraft
}

export interface AudioRecorderState {
  isRecording: boolean
  isPlaying: boolean
  duration: number
  currentTime: number
  error: string | null
}
