import fs from 'node:fs'
import path from 'node:path'
import { interviewDataDir } from './index.js'

/**
 * 면접 코칭 데이터(few-shot 예시 + 직무별 질문 은행)를 코치 프롬프트에 주입하기 위한 셀렉터.
 * 데이터 소스: shared/data/ai-interview/{fewshot-say-to-answer.json, interview-question-bank.json}
 * 방법 근거 정본: shared/BRANDING-METHOD.md (규칙 키 = 정본 ID로 역추적, §4 Traceability).
 * 자소서 job-prep/server/src/data/resumeCoaching.ts 미러. 파일이 없거나 깨져도 코치가 죽지 않도록 graceful degrade.
 */

export type FewshotItem = {
  id: string
  dept: string
  questionType: string
  question: string
  rawAnswer: string
  probe?: string
  rawFollowup?: string
  answer: string
  rules?: string[]
  guard?: string
}

export type CommonQuestion = {
  id: string
  category: string
  question: string
  intent?: string
  probes?: string[]
  answerGuide?: string
  guard?: string
}

export type JobGuide = {
  dept: string
  대표직무?: string[]
  요구역량?: string[]
  실무용어?: string[]
  jobKnowledgeQuestions?: string[]
  experienceQuestions?: string[]
  안티패턴?: string[]
}

function readJson<T>(file: string): T | null {
  try {
    const full = path.join(interviewDataDir, file)
    if (!fs.existsSync(full)) return null
    return JSON.parse(fs.readFileSync(full, 'utf8')) as T
  } catch (error) {
    console.warn(`[interview-coaching] ${file} 로드 실패:`, error instanceof Error ? error.message : error)
    return null
  }
}

type FewshotFile = {
  _transformRules?: Record<string, unknown>
  _guards?: Record<string, unknown>
  items?: FewshotItem[]
}
type BankFile = { commonQuestions?: CommonQuestion[]; items?: JobGuide[] }

const fewshotFile = readJson<FewshotFile>('fewshot-say-to-answer.json')
const bankFile = readJson<BankFile>('interview-question-bank.json')

const fewshotItems: FewshotItem[] = Array.isArray(fewshotFile?.items) ? fewshotFile!.items : []
const commonQuestions: CommonQuestion[] = Array.isArray(bankFile?.commonQuestions) ? bankFile!.commonQuestions : []
const jobGuides: JobGuide[] = Array.isArray(bankFile?.items) ? bankFile!.items : []

/** 시스템 지침으로 바로 쓸 수 있는 답변 변환 규칙(두괄식·인정화법·수치화_균형 등). 정본 §1~§3 ID와 1:1. */
export const transformRules: Record<string, string> = normalizeRuleMap(fewshotFile?._transformRules)
/** 허위 방지 가드(없는_수치_경험_생성·부정확한_추측·but화법 등). 정본 §4 guards 매핑. */
export const guards: Record<string, string> = normalizeRuleMap(fewshotFile?._guards)

/** 코치가 rulesApplied로 인용할 수 있는 유효 규칙 키 집합(정본 traceability 무결성). */
export const validRuleKeys: ReadonlySet<string> = new Set(Object.keys(transformRules))

function normalizeRuleMap(raw: Record<string, unknown> | undefined): Record<string, string> {
  if (!raw) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'note') continue
    out[key] = Array.isArray(value) ? value.join(', ') : String(value)
  }
  return out
}

/** 앱의 업종/직무 라벨 → 데이터의 학과명 별칭 매핑(직접 키워드 매칭 실패 시 보조). */
const deptAliases: Array<{ keys: string[]; dept: string }> = [
  { keys: ['미용', '헤어', '네일', '피부'], dept: '미용' },
  { keys: ['조리', '외식', '급식', '요리', '제과', '제빵'], dept: '조리외식' },
  { keys: ['자동차', '정비', '차량'], dept: '자동차정비' },
  { keys: ['전기', '배선', '차단기'], dept: '전기' },
  { keys: ['전자', '납땜', 'pcb', '회로'], dept: '전자' },
  { keys: ['사무', '회계', '경리', '총무', '행정'], dept: '사무회계' },
  { keys: ['보건', '간호', '요양', '병원', '복지'], dept: '보건간호' },
  { keys: ['제조', '생산', '품질', '기계', '공장', '설비', '스마트팩토리'], dept: '스마트팩토리' },
  { keys: ['디자인', '포스터', '영상', '콘텐츠'], dept: '디자인' },
]

/** 자유 텍스트(선택 업종 + 하위분류 등)에서 데이터 학과를 최선 추정. 못 찾으면 null. */
export function matchDept(hintText: string): string | null {
  const hay = (hintText || '').toLowerCase()
  if (!hay.trim()) return null
  // 1) 질문 은행의 실제 학과명·대표직무·실무용어 직접 매칭
  for (const guide of jobGuides) {
    const keywords = [guide.dept, ...(guide.대표직무 ?? []), ...(guide.실무용어 ?? [])]
    if (keywords.some((k) => k && hay.includes(String(k).toLowerCase()))) return guide.dept
  }
  // 2) 별칭 매핑
  for (const alias of deptAliases) {
    if (alias.keys.some((k) => hay.includes(k))) return alias.dept
  }
  return null
}

/** 해당 학과의 직무 가이드(실무용어·안티패턴·직무지식 질문 등). */
export function selectJobGuide(hintText: string): JobGuide | null {
  const dept = matchDept(hintText)
  if (!dept) return null
  return jobGuides.find((g) => g.dept === dept) ?? null
}

/**
 * 문항 유형에 맞는 few-shot 예시 선택.
 * 학과가 추정되면 해당 학과 우선, 부족분은 다른 학과에서 채워 다양성 확보.
 */
export function selectFewshot(questionType: string, hintText: string, limit = 3): FewshotItem[] {
  const sameType = questionType ? fewshotItems.filter((i) => i.questionType === questionType) : []
  const pool = sameType.length ? sameType : fewshotItems
  const dept = matchDept(hintText)
  const preferred = dept ? pool.filter((i) => i.dept === dept) : []
  const rest = pool.filter((i) => !preferred.includes(i))
  return [...preferred, ...rest].slice(0, limit)
}

/** commonQuestion id → coach few-shot 선택용 questionType. 미매핑은 ''(전체 pool 폴백). */
const questionTypeById: Record<string, string> = {
  'common-selfintro': 'self-intro-strategic',
  'common-selfintro-real': 'self-intro-natural',
  'common-motivation': 'motivation',
  'common-whyyou': 'motivation',
  'common-strength': 'strength',
  'common-weakness': 'weakness',
  'common-teamwork': 'personality',
  'common-adversity': 'adversity',
  'common-stress': 'adversity',
  'common-closing': 'closing',
}

export type PracticeQuestion = {
  id: string
  question: string
  category: string
  questionType: string
  intent: string | null
}

/** 학생 연습용 공통 질문 시퀀스(순서 고정) + few-shot 선택용 questionType. */
export function listPracticeQuestions(): PracticeQuestion[] {
  return commonQuestions.map((q) => ({
    id: q.id,
    question: q.question,
    category: q.category,
    questionType: questionTypeById[q.id] ?? '',
    intent: q.intent ?? null,
  }))
}

/** 공통 질문 은행에서 질문 텍스트로 의도·가이드를 최선 매칭(자기소개·지원동기 등). */
export function selectCommonQuestion(questionText: string): CommonQuestion | null {
  const q = (questionText || '').trim()
  if (!q) return null
  const exact = commonQuestions.find((c) => c.question.trim() === q)
  if (exact) return exact
  return commonQuestions.find((c) => q.includes(c.question.trim()) || c.question.trim().includes(q)) ?? null
}

export const interviewCoachingLoaded = {
  fewshotCount: fewshotItems.length,
  commonQuestionCount: commonQuestions.length,
  jobGuideCount: jobGuides.length,
  ruleCount: Object.keys(transformRules).length,
  guardCount: Object.keys(guards).length,
}
