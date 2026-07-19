import { getCoachChain, type CoachProvider } from './coachConfig.js'
import type { CoachResult } from '../types/index.js'

/**
 * 코치 모델 체인 순회 + 회로차단. provider별 러너를 받아 getCoachChain() 순서대로 시도.
 * 취업 브랜딩 표준 = Haiku 4.5 → Gemini 3.5 Flash(설정 시). 연속 쿼터/과부하 실패 시 잠시 429로 빠르게 실패.
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

export type CoachRunners = Record<CoachProvider, (model: string) => Promise<CoachResult>>

export type CoachFallbackResult = {
  value: CoachResult
  aiModel: string
  provider: CoachProvider
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

export async function withCoachFallback(runners: CoachRunners): Promise<CoachFallbackResult> {
  if (failureState.count >= maxFailures && Date.now() - failureState.openedAt < cooldownMs) {
    throw new CoachError(429, 'RATE_LIMIT', '지금 이용자가 많아요, 잠시 후 다시 시도해주세요.', 60)
  }

  const chain = getCoachChain()
  const errors: unknown[] = []

  for (let index = 0; index < chain.length; index += 1) {
    const ref = chain[index]!
    try {
      const value = await runners[ref.provider](ref.model)
      failureState.count = 0
      return { value, aiModel: ref.model, provider: ref.provider, fallbackUsed: index > 0 }
    } catch (error) {
      errors.push(error)
      if (index < chain.length - 1) continue
    }
  }

  failureState.count += 1
  failureState.openedAt = Date.now()
  if (errors.every(isQuotaError)) {
    throw new CoachError(429, 'RATE_LIMIT', '지금 이용자가 많아요, 잠시 후 다시 시도해주세요.', 45)
  }
  throw new CoachError(502, 'AI_UNAVAILABLE', '잠시 후 다시 시도해주세요.')
}
