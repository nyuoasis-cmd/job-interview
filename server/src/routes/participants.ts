import { randomBytes, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { supabaseAdmin } from '../db.js'
import { isValidIndustry } from './industries.js'

export const participantsRouter = Router()

function normalizeCode(code: string): string {
  return code.trim().toUpperCase()
}

function isInvalidCode(code: string): boolean {
  return !/^[A-Z0-9]{6}$/.test(code)
}

function createJoinToken(): string {
  return randomBytes(32).toString('hex')
}

function tokenMatches(expected: string, actual: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(actual)) {
    return false
  }
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
}

participantsRouter.post('/api/sessions/:code/join', async (req, res, next) => {
  try {
    const code = normalizeCode(req.params.code ?? '')
    const name = String(req.body?.name ?? '').trim()

    if (isInvalidCode(code)) {
      res.status(400).json({ error: 'invalid_code_format' })
      return
    }
    if (!name) {
      res.status(400).json({ error: 'name_required' })
      return
    }
    if (name.length > 30) {
      res.status(400).json({ error: 'name_too_long' })
      return
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from('interview_sessions')
      .select('id, status')
      .eq('code', code)
      .maybeSingle()

    if (sessionError) {
      throw sessionError
    }
    if (!session) {
      res.status(404).json({ error: 'session_not_found' })
      return
    }
    if (session.status === 'closed') {
      res.status(410).json({ error: 'session_closed' })
      return
    }

    const joinToken = createJoinToken()
    const { data: participant, error: participantError } = await supabaseAdmin
      .from('interview_participants')
      .insert({
        session_id: session.id,
        name,
        join_token: joinToken,
      })
      .select('id, session_id, name, joined_at')
      .single()

    if (participantError) {
      throw participantError
    }

    res.json({ participant, joinToken })
  } catch (error) {
    next(error)
  }
})

participantsRouter.patch('/api/participants/:id/industry', async (req, res, next) => {
  try {
    const participantId = req.params.id
    const joinToken = req.header('X-Join-Token')
    const selectedIndustry = String(req.body?.selected_industry ?? '').trim()
    const selectedSub = String(req.body?.selected_sub ?? '').trim()

    const { data: participant, error } = await supabaseAdmin
      .from('interview_participants')
      .select('id, session_id, join_token, industry_confirmed, interview_sessions(status)')
      .eq('id', participantId)
      .maybeSingle()

    if (error) {
      throw error
    }
    if (!participant) {
      res.status(404).json({ error: 'participant_not_found' })
      return
    }
    if (!joinToken) {
      res.status(401).json({ error: 'join_token_required' })
      return
    }
    if (!tokenMatches(String(participant.join_token), joinToken.trim())) {
      res.status(403).json({ error: 'join_token_invalid' })
      return
    }

    const joinedSession = participant.interview_sessions as { status?: string } | null
    if (joinedSession?.status === 'closed') {
      res.status(410).json({ error: 'session_closed' })
      return
    }
    if (participant.industry_confirmed) {
      res.status(409).json({ error: 'industry_already_confirmed' })
      return
    }
    if (!(await isValidIndustry(selectedIndustry, selectedSub))) {
      res.status(400).json({ error: 'invalid_industry' })
      return
    }

    // 단일 atomic RPC: 세션 active + token + industry_confirmed=false 동시 검증 후 UPDATE
    const { data: rpcResult, error: rpcError } = await supabaseAdmin
      .rpc('confirm_participant_industry', {
        p_participant_id: participantId,
        p_join_token: joinToken.trim(),
        p_industry: selectedIndustry,
        p_sub: selectedSub,
      })

    if (rpcError) {
      throw rpcError
    }

    const result = rpcResult as { ok: boolean; reason?: string }
    if (!result.ok) {
      if (result.reason === 'already_confirmed') {
        res.status(409).json({ error: 'industry_already_confirmed' })
        return
      }
      // session_closed 또는 기타 race
      res.status(410).json({ error: 'session_closed' })
      return
    }

    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})
