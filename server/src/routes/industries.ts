import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Router } from 'express'
import type { IndustryCategory } from '../types/index.js'

const dataDir = process.env.AI_INTERVIEW_DATA_DIR || '/home/claude/shared/data/ai-interview'
const taxonomyPath = path.join(dataDir, 'industry-taxonomy.json')

export const industriesRouter = Router()

let taxonomyCache: IndustryCategory[] | null = null

export async function loadTaxonomy(): Promise<IndustryCategory[]> {
  if (taxonomyCache) {
    return taxonomyCache
  }

  const raw = await readFile(taxonomyPath, 'utf8')
  const parsed = JSON.parse(raw) as {
    taxonomy: Array<{
      majorCategory: string
      subCategories: Array<{
        name: string
        keyCompetencies: string[]
        interviewStyle: string
      }>
    }>
  }

  taxonomyCache = parsed.taxonomy.map((category) => ({
    majorCategory: category.majorCategory,
    subCategories: category.subCategories.map((sub) => ({
      name: sub.name,
      keyCompetencies: sub.keyCompetencies,
      interviewStyle: sub.interviewStyle,
    })),
  }))

  return taxonomyCache
}

export async function isValidIndustry(selectedIndustry: string, selectedSub: string): Promise<boolean> {
  const taxonomy = await loadTaxonomy()
  return taxonomy.some(
    (category) =>
      category.majorCategory === selectedIndustry &&
      category.subCategories.some((sub) => sub.name === selectedSub),
  )
}

industriesRouter.get('/api/industries', async (_req, res, next) => {
  try {
    res.json({ taxonomy: await loadTaxonomy() })
  } catch (error) {
    next(error)
  }
})
