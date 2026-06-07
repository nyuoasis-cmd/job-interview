import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { assertSameSupabaseProject } from './db.js'
import { computeCriteriaHash, computeQuestionsBankHash, NullSttProvider, validateCriteriaWeights } from './lib/bootGuards.js'
import { createApiRouter } from './routes/index.js'

async function main(): Promise<void> {
  const supabaseRef = await assertSameSupabaseProject()
  await validateCriteriaWeights()
  const criteriaHash = await computeCriteriaHash()
  const questionsBankHash = await computeQuestionsBankHash()
  const sttProvider = new NullSttProvider()

  const app = express()
  app.use(cors({ origin: true, credentials: true }))
  app.use(express.json())
  app.use(createApiRouter())
  app.get('/health', (_req, res) => {
    res.json({ ok: true })
  })
  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(error)
    res.status(500).json({ error: 'internal_server_error' })
  })

  const port = Number(process.env.PORT || 3000)
  app.listen(port, () => {
    console.log(
      JSON.stringify({
        event: 'server_started',
        port,
        supabaseRef,
        criteriaHash,
        questionsBankHash,
        sttProvider: sttProvider.constructor.name,
      }),
    )
  })
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
