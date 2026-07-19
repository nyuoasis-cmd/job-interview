import { getAnthropicClient } from './client.js'
import {
  guards,
  selectCommonQuestion,
  selectFewshot,
  selectJobGuide,
  transformRules,
  validRuleKeys,
  type FewshotItem,
} from '../../data/interviewCoaching.js'
import type { CoachComment, CoachResult } from '../../types/index.js'

/**
 * 면접 답변 코치. 학생의 거친 답변 → (약점 짚는) 꼬리질문 + 다듬은 두괄식 답변 + 근거 피드백.
 * 방법 정본: shared/BRANDING-METHOD.md. 데이터: shared/data/ai-interview.
 * 자소서 job-prep/services/gemini/coach.ts 미러하되 provider=Anthropic(responseSchema 없음 → 시스템 프롬프트로 JSON 강제 + 정규식 추출).
 */

export const coachPromptVersion = 'interview-coach-v1'

const severities = new Set(['good', 'info', 'warn'])

export type CoachInput = {
  question: string
  rawAnswer: string
  rawFollowup?: string | undefined
  questionType?: string | undefined
  industryHint: string
}

const systemPrompt = [
  '너는 특성화고 학생의 면접 답변을 도와주는 코치다.',
  '학생이 말한 사실(경험·숫자)만 쓰고, 없는 수치·경험·성과를 절대 만들어내지 않는다(guards 준수).',
  '반드시 아래 JSON 객체 하나만 출력한다. 코드블록·설명·앞뒤 문장 금지.',
  '{"probe": string, "refinedAnswer": string, "feedback": [{"rule": string, "severity": "good"|"info"|"warn", "message": string}], "rulesApplied": string[], "guard": string|null}',
].join('\n')

export async function coachInterviewAnswer(input: CoachInput, model: string): Promise<CoachResult> {
  const client = getAnthropicClient()
  const response = await client.messages.create({
    model,
    max_tokens: 1200,
    system: systemPrompt,
    messages: [{ role: 'user', content: buildCoachPrompt(input) }],
  })
  const text = response.content.find((block) => block.type === 'text')?.text ?? ''
  return normalizeCoachResult(parseJson(text))
}

function buildCoachPrompt(input: CoachInput): string {
  const common = selectCommonQuestion(input.question)
  const jobGuide = selectJobGuide(input.industryHint)
  const examples = selectFewshot(input.questionType ?? '', input.industryHint).map(trimExample)
  return JSON.stringify({
    질문: input.question,
    질문의도: common?.intent ?? null,
    답변가이드: common?.answerGuide ?? null,
    학생답변: input.rawAnswer,
    학생보충: input.rawFollowup ?? null,
    학과: jobGuide?.dept ?? null,
    실무용어: jobGuide?.실무용어 ?? [],
    학과안티패턴: jobGuide?.안티패턴 ?? [],
    변환규칙: transformRules,
    허위방지_guards: guards,
    예시: examples,
    지시: [
      'probe: 학생답변의 약점(수치 없음·두괄식 아님·근거 빈약·모르는데 추측·자기 자랑·but화법)을 짚어 되묻는 꼬리질문 1개. 학생 눈높이의 다정한 반말체.',
      'refinedAnswer: 학생답변(+학생보충)을 변환규칙에 맞춰 다듬은 두괄식 답변. 학생이 말한 사실만 사용. 없는 숫자·경험 생성 절대 금지.',
      'feedback: 2~4개. 각 항목의 rule은 반드시 변환규칙 키 중 하나. message는 왜 그렇게 고쳤는지 근거를 학생에게 설명.',
      'rulesApplied: 이번에 적용한 변환규칙 키 배열(변환규칙에 있는 키만).',
      'guard: 지킨 허위방지 원칙 요약(예: 숫자는 학생 보충에서만 가져옴) 또는 null.',
    ],
  })
}

function trimExample(item: FewshotItem) {
  return {
    question: item.question,
    rawAnswer: item.rawAnswer,
    probe: item.probe,
    rawFollowup: item.rawFollowup,
    answer: item.answer,
    rules: item.rules,
    guard: item.guard,
  }
}

function parseJson(text: string): Partial<CoachResult> {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return {}
  try {
    return JSON.parse(match[0]) as Partial<CoachResult>
  } catch {
    return {}
  }
}

function normalizeCoachResult(value: Partial<CoachResult>): CoachResult {
  return {
    probe: typeof value.probe === 'string' ? value.probe.trim() : '',
    refinedAnswer: typeof value.refinedAnswer === 'string' ? value.refinedAnswer.trim() : '',
    feedback: Array.isArray(value.feedback) ? value.feedback.map(normalizeComment).filter(Boolean) as CoachComment[] : [],
    rulesApplied: Array.isArray(value.rulesApplied)
      ? [...new Set(value.rulesApplied.filter((r): r is string => typeof r === 'string' && validRuleKeys.has(r)))]
      : [],
    guard: typeof value.guard === 'string' && value.guard.trim() ? value.guard.trim() : null,
  }
}

function normalizeComment(comment: Partial<CoachComment> | unknown): CoachComment | null {
  if (!comment || typeof comment !== 'object') return null
  const record = comment as Partial<CoachComment>
  const message = typeof record.message === 'string' ? record.message.trim() : ''
  if (!message) return null
  const rule = typeof record.rule === 'string' && validRuleKeys.has(record.rule) ? record.rule : undefined
  const severity = typeof record.severity === 'string' && severities.has(record.severity)
    ? record.severity as CoachComment['severity']
    : 'info'
  return { rule, severity, message }
}
