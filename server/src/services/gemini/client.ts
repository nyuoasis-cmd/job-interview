import { GoogleGenAI } from '@google/genai'

/**
 * 면접 코치 Gemini 클라이언트(폴백 provider). 모델은 env(GEMINI_COACH_MODEL) 단일 소스.
 * 취업 브랜딩 폴백 표준 = Gemini 3.5 Flash (memory: project_job-branding-coach-model-standard-haiku).
 */

let geminiClient: GoogleGenAI | null = null

export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY_MISSING')
  if (!geminiClient) geminiClient = new GoogleGenAI({ apiKey })
  return geminiClient
}

export const geminiJsonConfig = {
  responseMimeType: 'application/json',
  thinkingConfig: { thinkingBudget: 0 },
}
