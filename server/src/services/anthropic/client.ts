import Anthropic from '@anthropic-ai/sdk'

/**
 * 면접 코치 Anthropic 클라이언트 + 모델 설정.
 * 모델은 코드 하드코딩 금지 — env 단일 소스(ANTHROPIC_COACH_MODEL). .env.example 참조.
 * 취업 브랜딩 패키지 표준 모델 = Claude Haiku 4.5 (memory: project_job-branding-coach-model-standard-haiku).
 * ANTHROPIC_COACH_FALLBACK_MODEL 은 선택(미설정=폴백 없음). Gemini 3.5 Flash 교차 폴백은 fast-follow.
 */

let anthropicClient: Anthropic | null = null
let warnedMissingKey = false

const DEFAULT_TIMEOUT_MS = 60_000

export type CoachModelConfig = {
  primaryModel: string
  fallbackModel: string | null
}

export function getCoachModels(env = process.env): CoachModelConfig {
  const primaryModel = env.ANTHROPIC_COACH_MODEL?.trim()
  if (!primaryModel) {
    throw new Error(
      'ANTHROPIC_COACH_MODEL 환경변수가 필요합니다. .env.example 참조 ' +
        '(모델 선택은 코드 하드코딩 금지 - env 단일 소스).',
    )
  }
  const fallbackModel = env.ANTHROPIC_COACH_FALLBACK_MODEL?.trim() || null
  return { primaryModel, fallbackModel }
}

export function warnCoachConfig(): void {
  getCoachModels()
  if (!process.env.ANTHROPIC_API_KEY && !warnedMissingKey) {
    warnedMissingKey = true
    console.warn('[coach] ANTHROPIC_API_KEY is missing; coach route will fail until configured.')
  }
}

export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY_MISSING')
  if (!anthropicClient) {
    const timeout = Number(process.env.ANTHROPIC_COACH_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS
    anthropicClient = new Anthropic({ apiKey, maxRetries: 1, timeout })
  }
  return anthropicClient
}
