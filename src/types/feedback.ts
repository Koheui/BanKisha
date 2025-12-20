// Feedback types
export type FeedbackType = 
  | 'duplicate_question' // 重複質問
  | 'incorrect_name' // 名称が違う
  | 'unclear_question' // 質問がわかりにくい
  | 'unclear_context' // 文脈がわかりにくい
  | 'other' // その他

export type FeedbackSource = 
  | 'interview' // インタビュー中
  | 'rehearsal' // リハーサル中
  | 'article' // 記事閲覧時
  | 'question_generation' // 質問生成時

export interface Feedback {
  id: string
  companyId: string
  interviewId?: string
  articleId?: string
  source: FeedbackSource
  type: FeedbackType
  message: string // フィードバックの詳細
  context?: {
    question?: string // 関連する質問
    answer?: string // 関連する回答
    articleSection?: string // 関連する記事セクション
    timestamp?: Date // フィードバックが発生した時刻
  }
  resolved: boolean // 解決済みかどうか
  resolvedAt?: Date
  resolvedBy?: string
  createdAt: Date
  createdBy: string
}


