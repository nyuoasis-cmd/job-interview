import { getAnthropicClient } from './client.js'
import {
  buildCoachPrompt,
  coachSystemInstruction,
  extractJson,
  normalizeCoachResult,
  type CoachInput,
} from '../coachCore.js'
import type { CoachResult } from '../../types/index.js'

/**
 * Anthropic(Claude Haiku 4.5) 코치 실행. responseSchema가 없어 systemInstruction으로 JSON을 유도하고
 * 응답 텍스트에서 정규식으로 JSON을 추출한 뒤 방어적으로 정규화한다.
 */

export async function coachViaAnthropic(input: CoachInput, model: string): Promise<CoachResult> {
  const client = getAnthropicClient()
  const response = await client.messages.create({
    model,
    max_tokens: 1200,
    system: coachSystemInstruction +
      '\n반드시 아래 JSON 하나만 출력: {"probe": string, "refinedAnswer": string, "feedback": [{"rule": string, "severity": "good"|"info"|"warn", "message": string}], "rulesApplied": string[], "guard": string|null}',
    messages: [{ role: 'user', content: buildCoachPrompt(input) }],
  })
  const text = response.content.find((block) => block.type === 'text')?.text ?? ''
  return normalizeCoachResult(extractJson(text))
}
