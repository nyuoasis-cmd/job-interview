import { Router } from 'express'
import { parseSupabaseRef } from '../db.js'

export const configRouter = Router()

configRouter.get('/api/config', (_req, res) => {
  res.json({ supabaseRef: parseSupabaseRef(process.env.SUPABASE_URL || '') })
})
