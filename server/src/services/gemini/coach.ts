import { getGeminiClient, geminiJsonConfig } from './client.js'
import {
  buildCoachPrompt,
  coachResponseSchema,
  coachSystemInstruction,
  normalizeCoachResult,
  type CoachInput,
} from '../coachCore.js'
import type { CoachResult } from '../../types/index.js'

/**
 * Gemini(3.5 Flash) 코치 실행 — 폴백 provider. responseSchema로 구조를 강제한 뒤 방어적으로 정규화.
 */

export async function coachViaGemini(input: CoachInput, model: string): Promise<CoachResult> {
  const response = await getGeminiClient().models.generateContent({
    model,
    contents: [{ role: 'user', parts: [{ text: buildCoachPrompt(input) }] }],
    config: {
      ...geminiJsonConfig,
      responseSchema: coachResponseSchema,
      maxOutputTokens: 1200,
      systemInstruction: coachSystemInstruction,
    },
  })
  return normalizeCoachResult(JSON.parse(response.text ?? '{}'))
}
