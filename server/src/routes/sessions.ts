import { Router } from 'express'
import { supabaseAdmin } from '../db.js'
import { generateUniqueCode } from '../lib/sessionCode.js'
import { requireTeacherAuth } from '../middleware/auth.js'

export const sessionsRouter = Router()

function normalizeCode(code: string): string {
  return code.trim().toUpperCase()
}

function isInvalidCode(code: string): boolean {
  return !/^[A-Z0-9]{6}$/.test(code)
}

sessionsRouter.post('/api/sessions', requireTeacherAuth, async (req, res, next) => {
  try {
    const title = String(req.body?.title ?? '').trim()
    if (!title) {
      res.status(422).json({ error: 'title_required' })
      return
    }

    let code: string
    try {
      code = await generateUniqueCode(supabaseAdmin)
    } catch {
      res.status(500).json({ error: 'code_generation_failed' })
      return
    }

    const { data, error } = await supabaseAdmin
      .from('interview_sessions')
      .insert({
        code,
        title,
        teacher_id: res.locals.user.id,
      })
      .select('id, code, title, status, created_at')
      .single()

    if (error) {
      throw error
    }

    res.json({ session: data })
  } catch (error) {
    next(error)
  }
})

sessionsRouter.get('/api/sessions/:code', async (req, res, next) => {
  try {
    const code = normalizeCode(req.params.code ?? '')
    if (isInvalidCode(code)) {
      res.status(400).json({ error: 'invalid_code_format' })
      return
    }

    const { data, error } = await supabaseAdmin
      .from('interview_sessions')
      .select('id, code, title, status')
      .eq('code', code)
      .maybeSingle()

    if (error) {
      throw error
    }
    if (!data) {
      res.status(404).json({ error: 'session_not_found' })
      return
    }
    if (data.status === 'closed') {
      res.status(410).json({ error: 'session_closed' })
      return
    }

    res.json({ session: data })
  } catch (error) {
    next(error)
  }
})
