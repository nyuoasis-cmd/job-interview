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

/** 면접 코치 결과 — 학생 답변에 대한 꼬리질문 + 다듬은 답변 + 근거 피드백. DB 미저장(면접 데이터 휘발). */
export interface CoachComment {
  /** 적용/위반한 변환규칙 키(정본 §4 traceability). 데이터의 _transformRules 키만. */
  rule?: string | undefined
  severity: 'good' | 'info' | 'warn'
  message: string
}

export interface CoachResult {
  /** 약점을 짚어 되묻는 꼬리질문. */
  probe: string
  /** 학생 답변을 두괄식으로 다듬은 예시(학생이 말한 사실만). */
  refinedAnswer: string
  feedback: CoachComment[]
  /** 이번 코치에 적용된 변환규칙 키 목록. */
  rulesApplied: string[]
  /** 지킨 허위방지 원칙 요약 또는 null. */
  guard: string | null
}
