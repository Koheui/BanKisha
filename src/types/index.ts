// User types
export interface User {
  id: string
  email: string
  displayName?: string
  photoURL?: string
  companyId?: string
  role: 'user' | 'admin' | 'superAdmin'
  createdAt: Date
}

// Company types
export interface Company {
  id: string
  name: string
  logoUrl?: string
  onboarded: boolean
  globalRolePrompt?: string
  createdAt: Date
}

// Knowledge Base types
export type KnowledgeBaseType = 'skill' | 'info' | 'user'
export type FeedbackType = 'add' | 'modify' | 'remove'

export interface ContentVersion {
  version: number
  content: string
  feedback?: string
  feedbackType?: FeedbackType
  createdAt: Date
  createdBy: string
}

export interface KnowledgeBase {
  id: string
  type: KnowledgeBaseType
  title: string
  fileName: string
  fileSize: number
  storageUrl: string
  uploadedBy: string
  companyId?: string // userタイプの場合のみ
  status: 'processing' | 'indexed' | 'failed' | 'ready'
  pageCount?: number
  chunkCount?: number
  summary?: string
  usageGuide?: string
  isEditOnly?: boolean // 編集時のみ使用（インタビュー質問生成では使用しない）
  summaryHistory?: ContentVersion[]
  usageGuideHistory?: ContentVersion[]
  errorMessage?: string
  deleted?: boolean // ソフトデリート用
  deletedAt?: Date
  createdAt: Date
  updatedAt: Date
}

// Article types
export type ArticleStatus = 'draft' | 'submitted' | 'approved' | 'public'

export interface DraftArticle {
  title: string
  lead: string
  sections: ArticleSection[]
}

export interface ArticleSection {
  heading: string
  body: string
}

export interface FinalArticle extends DraftArticle {
  byline: string
  mediaBadge: string
}

export interface ArticleImage {
  id: string
  url: string
  alt?: string
  position: number // セクションのインデックス（-1はカバー画像）
}

export interface Article {
  id: string
  companyId: string
  interviewId?: string
  draftArticle: DraftArticle
  finalArticle?: FinalArticle
  status: ArticleStatus
  images?: ArticleImage[]
  submittedAt?: Date
  approvedAt?: Date
  publicMeta?: {
    publishedAt: Date
    byline: string
    mediaBadge: string
  }
  createdAt: Date
  updatedAt: Date
}

// Interviewer Profile types
export type GeminiVoiceType = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Aoede'

export interface InterviewerProfile {
  id: string
  companyId: string
  name: string
  role: string
  description?: string
  prompt?: string
  photoURL?: string // プロフィール写真のURL
  voiceSettings?: {
    voiceType: GeminiVoiceType // Gemini 2.5 Flash Native Audioの音声タイプ
    tone?: string
    speed?: number
    pitch?: number
  }
  reactionPatterns?: string // 基礎的な相槌や反応のパターン（例：なるほど、そうですか、それは興味深いですね、など）
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// Interview types
export type InterviewMode = 'text' | 'voice'

export interface InterviewSession {
  id: string
  parentInterviewId?: string // 親インタビューのID（バージョニング用）
  companyId: string
  interviewerId: string // インタビュアープロファイルのID
  interviewerName: string // キャッシュ用
  interviewerRole: string // キャッシュ用
  mode: InterviewMode
  title: string // インタビュータイトル
  category?: string // カテゴリ
  targetAudience?: string
  mediaType?: string
  interviewPurpose?: string
  intervieweeName: string // 取材先方の名前
  confirmNameAtInterview?: boolean // 名前をインタビュー時に確認するかどうか
  intervieweeCompany: string // 取材先の会社名
  confirmCompanyAtInterview?: boolean // 会社名をインタビュー時に確認するかどうか
  intervieweeTitle?: string // 役職名
  confirmTitleAtInterview?: boolean // 役職名をインタビュー時に確認するかどうか
  intervieweeDepartment?: string // 部署名
  confirmDepartmentAtInterview?: boolean // 部署名をインタビュー時に確認するかどうか
  intervieweeType?: 'company' | 'individual' // 企業・団体 or 個人
  isMultipleInterviewees: boolean // 複数人か1名か
  objective: string // 取材で聞きたいこと
  questions?: string // 生成された質問事項（編集可能）
  knowledgeBaseIds?: string[] // 使用するナレ-ジベースのIDリスト
  status: 'active' | 'paused' | 'completed'
  shareToken?: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

export interface Message {
  id: string
  role: 'interviewer' | 'interviewee' | 'system'
  content: string
  timestamp: Date
  audioUrl?: string
}

// Question Set types
export interface QuestionSet {
  id: string
  companyId: string
  title: string
  description: string
  questions: Question[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Question {
  id: string
  text: string
  order: number
  category?: string
}

// System Settings
export interface SystemSettings {
  appDirection?: {
    directionPrompt: string
    updatedAt: Date
    updatedBy: string
  }
}

