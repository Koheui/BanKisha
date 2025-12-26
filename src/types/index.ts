// User types
export interface User {
  id: string
  email: string
  displayName?: string
  photoURL?: string
  bio?: string
  companyId?: string
  role: 'user' | 'admin' | 'superAdmin'
  customGenres?: string[]
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
  category?: string // ジャンル・業界（野球、スタートアップ等）
  // 活用方法（どのプロセスで使用するか）
  useForDialogue?: boolean   // 対話術（デフォルト: true）
  useForArticle?: boolean    // 記事作成（デフォルト: false）
  useForSummary?: boolean    // サマリー作成（デフォルト: false）
  createdAt: Date
  updatedAt: Date
}

// Article types
export type ArticleStatus = 'draft' | 'review' | 'published' | 'submitted' | 'approved' | 'public'
export type ArticleVisibility = 'public' | 'unlisted' | 'private'

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

export interface AIMetadata {
  aiMetaVersion: number
  summaryShort: string
  summaryLong: string
  keyPoints: string[]
  topics: string[]
  industry: string[]
  intent: string[] // e.g., ['pr', 'recruit', 'sales']
  audienceLevel: 'beginner' | 'practitioner' | 'executive'
  entities: {
    companies: string[]
    people: string[]
    products: string[]
    places: string[]
  }
  timeSensitivity: 'evergreen' | 'news' | 'event'
  region: string[]
  faq: { q: string, a: string }[]
  qualitySignals: {
    firstPerson: boolean
    hasNumbers: boolean
    hasQuotes: boolean
  }
  safetyFlags: {
    piiRisk: boolean
    claimsRisk: boolean
  }
}

// Generic label/value item used for company profiles and custom fields
export interface LabelValueItem {
  label: string
  value: string
}

export interface IntervieweeCompanyInfo {
  serviceName?: string
  companyName?: string
  address?: string
  url?: string
  items?: LabelValueItem[] // カスタムフィールド
}

export interface Article {
  id: string
  companyId: string
  ownerUserId?: string
  interviewId?: string
  sourceInterviewId?: string // 互換性のためのエイリアス
  slug?: string
  draftArticle: DraftArticle
  finalArticle?: FinalArticle
  aiMetadata?: AIMetadata
  companyProfile?: LabelValueItem[] // 会社・サービス概要（label/valueの配列）
  status: ArticleStatus
  visibility?: ArticleVisibility
  category?: string
  publishChannel?: 'media' | 'press_release' | 'case_study'
  isSponsored?: boolean
  images?: ArticleImage[]
  readingTimeSec?: number
  language?: string
  summary?: string
  coverImageUrl?: string
  featured?: boolean
  submittedAt?: Date
  approvedAt?: Date
  publishedAt?: Date
  publicMeta?: {
    publishedAt: Date
    byline: string
    mediaBadge: string
    summaryShort?: string
    summary?: string
    coverImageUrl?: string
  }
  engagement?: {
    views: number
    bookmarks: number
    likes: number
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
  supplementaryInfo?: string // 補足情報
  intervieweeCompanyInfo?: IntervieweeCompanyInfo // 取材先が入力した会社・サービス情報（サービス名、会社名、住所、URL、カスタム項目）
  questions?: string // 生成された質問事項（編集可能）
  openingMessage?: string // 生成されたオープニングメッセージ
  knowledgeBaseIds?: string[] // 使用するナレ-ジベースのIDリスト
  interviewerVoiceType?: GeminiVoiceType // インタビュアーの音声タイプ
  interviewerSpeed?: number // インタビュアーの音声速度
  currentQuestionIndex?: number // 現在の質問インデックス
  rehearsalMessages?: any[] // 練習用メッセージ
  status: 'active' | 'paused' | 'completed' | 'cancelled'
  interviewSource?: 'self' | 'other' // 取材の属性（自薦/他薦）
  shareToken?: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

export interface Message {
  id: string
  role: 'interviewer' | 'interviewee' | 'system' | 'user'
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

