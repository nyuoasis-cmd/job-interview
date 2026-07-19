import { timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { supabaseAdmin } from '../db.js'
import { coachInterviewAnswer } from '../services/anthropic/coach.js'
import { CoachError, withCoachFallback } from '../services/anthropic/fallback.js'

export const coachRouter = Router()

const MAX_QUESTION_LEN = 300
const MAX_ANSWER_LEN = 2000

function tokenMatches(expected: string, actual: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(actual)) {
    return false
  }
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
}

// POST /api/participants/:id/coach — 학생 참여자 인증(X-Join-Token) 후 면접 답변 코치.
// 결과는 DB 저장하지 않는다(면접 데이터 휘발 원칙).
coachRouter.post('/api/participants/:id/coach', async (req, res, next) => {
  try {
    const participantId = req.params.id
    const joinToken = req.header('X-Join-Token')
    const question = String(req.body?.question ?? '').trim()
    const rawAnswer = String(req.body?.rawAnswer ?? '').trim()
    const rawFollowup = String(req.body?.rawFollowup ?? '').trim()
    const questionType = String(req.body?.questionType ?? '').trim()

    if (!question) {
      res.status(400).json({ error: 'question_required' })
      return
    }
    if (!rawAnswer) {
      res.status(400).json({ error: 'answer_required' })
      return
    }
    if (question.length > MAX_QUESTION_LEN || rawAnswer.length > MAX_ANSWER_LEN || rawFollowup.length > MAX_ANSWER_LEN) {
      res.status(400).json({ error: 'input_too_long' })
      return
    }

    const { data: participant, error } = await supabaseAdmin
      .from('interview_participants')
      .select('id, join_token, selected_industry, selected_sub, interview_sessions(status)')
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

    const industryHint = [participant.selected_industry, participant.selected_sub]
      .filter((v): v is string => Boolean(v))
      .join(' ')

    const result = await withCoachFallback((model) =>
      coachInterviewAnswer(
        { question, rawAnswer, rawFollowup: rawFollowup || undefined, questionType: questionType || undefined, industryHint },
        model,
      ),
    )

    res.json({ ...result.value, aiModel: result.aiModel, fallbackUsed: result.fallbackUsed })
  } catch (err) {
    if (err instanceof CoachError) {
      const body: Record<string, unknown> = { error: err.code, message: err.message }
      if (err.retryAfter) body.retryAfter = err.retryAfter
      res.status(err.status).json(body)
      return
    }
    if (err instanceof Error && (err.message === 'ANTHROPIC_API_KEY_MISSING' || err.message.includes('ANTHROPIC_COACH_MODEL'))) {
      res.status(503).json({ error: 'coach_not_configured' })
      return
    }
    next(err)
  }
})
