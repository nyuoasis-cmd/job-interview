export interface InterviewSession {
  id: string
  code: string
  title: string
  status: 'active' | 'closed'
  teacher_id: string
  created_at: string
  closed_at: string | null
}

export interface InterviewParticipant {
  id: string
  session_id: string
  name: string
  join_token: string
  joined_at: string
  selected_industry: string | null
  selected_sub: string | null
  industry_confirmed: boolean
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
