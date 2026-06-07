import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

interface CriteriaFile {
  criteria: Array<{ weight: number }>
}

const dataDir = process.env.AI_INTERVIEW_DATA_DIR || '/home/claude/shared/data/ai-interview'
const criteriaPath = path.join(dataDir, 'evaluation-criteria.json')
const questionsPath = path.join(dataDir, 'questions-by-industry.json')

async function readJsonFile(filePath: string): Promise<string> {
  return readFile(filePath, 'utf8')
}

export async function validateCriteriaWeights(): Promise<void> {
  const raw = await readJsonFile(criteriaPath)
  const parsed = JSON.parse(raw) as CriteriaFile
  const total = parsed.criteria.reduce((sum, item) => sum + item.weight, 0)

  if (total !== 100) {
    throw new Error(`criteria_weight_sum_invalid: got ${total}, expected 100`)
  }
}

function hashRawJson(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export async function computeCriteriaHash(): Promise<string> {
  return hashRawJson(await readJsonFile(criteriaPath))
}

export async function computeQuestionsBankHash(): Promise<string> {
  return hashRawJson(await readJsonFile(questionsPath))
}

export interface SttProvider {
  transcribe(audioBuffer: Buffer): Promise<string>
}

export class NullSttProvider implements SttProvider {
  transcribe(_: Buffer): Promise<string> {
    return Promise.resolve('')
  }
}
