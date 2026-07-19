import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 면접 코칭 참조 데이터(few-shot + 질문 은행)의 메타/버전 로더.
 * 소스: shared/data/ai-interview/{fewshot-say-to-answer.json, interview-question-bank.json}
 * 자소서 job-prep/server/src/data/index.ts 미러. 파일이 없거나 깨져도 서버가 죽지 않도록 graceful degrade.
 */

type InterviewDataFile = {
  _metadata?: {
    collectedAt?: string
    data_version?: string
    sources?: string[]
  }
  items?: unknown[]
}

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
// server/src/data → ../../../shared/data/ai-interview (= job-interview/shared/data/ai-interview)
const dataDir = path.resolve(dirname, '../../../shared/data/ai-interview')

export function loadInterviewReferenceData(): InterviewDataFile[] {
  if (!fs.existsSync(dataDir)) {
    console.warn('[interview-data] shared/data/ai-interview directory is missing')
    return []
  }

  return fs.readdirSync(dataDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      const content = fs.readFileSync(path.join(dataDir, file), 'utf8')
      const parsed = JSON.parse(content) as InterviewDataFile
      const metadata = parsed._metadata
      if (!metadata?.collectedAt || !metadata.data_version) {
        console.warn(`[interview-data] ${file} is missing _metadata.collectedAt or data_version`)
      }
      return parsed
    })
}

export const interviewDataDir = dataDir
export const interviewReferenceData = loadInterviewReferenceData()
export const interviewDataVersion = interviewReferenceData[0]?._metadata?.data_version ?? 'unknown'
