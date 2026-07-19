import Anthropic from '@anthropic-ai/sdk'
import { getCoachChain } from '../coachConfig.js'

/**
 * 면접 코치 Anthropic 클라이언트(1차 provider = Claude Haiku 4.5).
 * 모델 체인 설정은 coachConfig.getCoachChain() 단일 소스(하드코딩 금지).
 */

let anthropicClient: Anthropic | null = null
let warnedMissingKey = false

const DEFAULT_TIMEOUT_MS = 60_000

export function warnCoachConfig(): void {
  getCoachChain()
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
