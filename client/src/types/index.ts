export interface Participant {
  id: string
  session_id: string
  name: string
  joined_at: string
}

export interface InterviewSession {
  id: string
  code: string
  title: string
  status: 'active' | 'closed'
  created_at?: string
}

export interface IndustrySubCategory {
  name: string
  keyCompetencies: string[]
  interviewStyle: string
}

export interface IndustryCategory {
  majorCategory: string
  subCategories: IndustrySubCategory[]
}

export interface JoinState {
  participantId: string
  code: string
}
