/**
 * 면접 코치 모델 체인 설정 — provider 무관. 모델은 코드 하드코딩 금지(env 단일 소스).
 * 취업 브랜딩 표준: 1차 Claude Haiku 4.5(ANTHROPIC_COACH_MODEL).
 * 폴백(선택, 우선순위): ① Gemini(GEMINI_COACH_MODEL + GEMINI_API_KEY) ② 동일 provider(ANTHROPIC_COACH_FALLBACK_MODEL).
 */

export type CoachProvider = 'anthropic' | 'gemini'
export type CoachModelRef = { provider: CoachProvider; model: string }

export function getCoachChain(env = process.env): CoachModelRef[] {
  const primary = env.ANTHROPIC_COACH_MODEL?.trim()
  if (!primary) {
    throw new Error(
      'ANTHROPIC_COACH_MODEL 환경변수가 필요합니다. .env.example 참조 ' +
        '(모델 선택은 코드 하드코딩 금지 - env 단일 소스).',
    )
  }
  const chain: CoachModelRef[] = [{ provider: 'anthropic', model: primary }]

  const geminiModel = env.GEMINI_COACH_MODEL?.trim()
  const anthropicFallback = env.ANTHROPIC_COACH_FALLBACK_MODEL?.trim()
  if (geminiModel && env.GEMINI_API_KEY) {
    chain.push({ provider: 'gemini', model: geminiModel })
  } else if (anthropicFallback && anthropicFallback !== primary) {
    chain.push({ provider: 'anthropic', model: anthropicFallback })
  }
  return chain
}
