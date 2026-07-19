import { getCoachModels } from './client.js'

/**
 * 코치 호출 회로차단 + 모델 폴백 루프. 자소서 job-prep/services/gemini/fallback.ts 미러.
 * PR1: primary(Haiku)만. ANTHROPIC_COACH_FALLBACK_MODEL 설정 시 2차 모델까지 순회.
 * 쿼터/과부하 연속 실패 시 열려서 잠시 429로 빠르게 실패(수업 대량 인입 보호).
 */

const quotaPattern = /\b429\b|\b529\b|too many requests|rate[_ ]?limit|overloaded|resource[_ ]?exhausted|quota/i
const failureState = { count: 0, openedAt: 0 }
const maxFailures = 5
const cooldownMs = 60_000

export class CoachError extends Error {
  status: number
  code: string
  retryAfter?: number | undefined
  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(message)
    this.name = 'CoachError'
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

export type CoachFallbackResult<T> = {
  value: T
  aiModel: string
  fallbackUsed: boolean
}

export function isQuotaError(error: unknown): boolean {
  if (typeof error === 'string') return quotaPattern.test(error)
  if (!error || typeof error !== 'object') return false
  const record = error as { status?: unknown; code?: unknown; message?: unknown }
  if (record.status === 429 || record.status === 529 || record.code === 429) return true
  const message = error instanceof Error ? error.message : String(record.message ?? '')
  return quotaPattern.test(message)
}

export async function withCoachFallback<T>(task: (model: string) => Promise<T>): Promise<CoachFallbackResult<T>> {
  if (failureState.count >= maxFailures && Date.now() - failureState.openedAt < cooldownMs) {
    throw new CoachError(429, 'RATE_LIMIT', '지금 이용자가 많아요, 잠시 후 다시 시도해주세요.', 60)
  }

  const { primaryModel, fallbackModel } = getCoachModels()
  const models = fallbackModel && fallbackModel !== primaryModel ? [primaryModel, fallbackModel] : [primaryModel]
  const errors: unknown[] = []

  for (let index = 0; index < models.length; index += 1) {
    const model = models[index]!
    try {
      const value = await task(model)
      failureState.count = 0
      return { value, aiModel: model, fallbackUsed: index > 0 }
    } catch (error) {
      errors.push(error)
      if (index < models.length - 1) continue
    }
  }

  failureState.count += 1
  failureState.openedAt = Date.now()
  if (errors.every(isQuotaError)) {
    throw new CoachError(429, 'RATE_LIMIT', '지금 이용자가 많아요, 잠시 후 다시 시도해주세요.', 45)
  }
  throw new CoachError(502, 'AI_UNAVAILABLE', '잠시 후 다시 시도해주세요.')
}
