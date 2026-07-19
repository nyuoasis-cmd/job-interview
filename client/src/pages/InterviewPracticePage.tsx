import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import './interview-practice.css'

type PracticeQuestion = {
  id: string
  question: string
  category: string
  questionType: string
  intent: string | null
}

type CoachFeedback = { rule?: string; severity: 'good' | 'info' | 'warn'; message: string }
type CoachResult = {
  probe: string
  refinedAnswer: string
  feedback: CoachFeedback[]
  rulesApplied: string[]
  guard: string | null
}

type Msg =
  | { kind: 'interviewer'; text: string }
  | { kind: 'student'; text: string }
  | { kind: 'coach-probe'; data: CoachResult }
  | { kind: 'coach-refined'; data: CoachResult }

const RULE_LABEL: Record<string, string> = {
  두괄식: '두괄식',
  수치화_균형: '수치화',
  인정화법: '인정화법',
  근거_구조: '근거',
  직무연결: '직무 연결',
  설득_아니라_자랑: '설득',
  진짜_단점: '진짜 단점',
  모르면_인정: '모르면 인정',
  구어체_정리: '정리',
  답변길이: '길이',
}

function ruleLabel(rule?: string): string {
  if (!rule) return '코치'
  return RULE_LABEL[rule] ?? rule.replace(/_/g, ' ')
}

const Shield = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 2 3 6v6c0 5 3.8 8.4 9 10 5.2-1.6 9-5 9-10V6l-9-4Z" stroke="currentColor" strokeWidth="1.6" />
    <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export default function InterviewPracticePage({ disabled }: { disabled: boolean }) {
  const { code } = useParams()
  const navigate = useNavigate()
  const [questions, setQuestions] = useState<PracticeQuestion[]>([])
  const [qIndex, setQIndex] = useState(0)
  const [phase, setPhase] = useState<'answer' | 'followup' | 'refined' | 'finished'>('answer')
  const [messages, setMessages] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [rawAnswer, setRawAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [industry, setIndustry] = useState('면접')
  const chatRef = useRef<HTMLDivElement>(null)

  const participantId = useMemo(() => localStorage.getItem('interview_current_participant_id'), [])
  const joinToken = useMemo(
    () => (participantId ? localStorage.getItem(`interview_join_token_${participantId}`) : null),
    [participantId],
  )

  useEffect(() => {
    if (!participantId || !joinToken) {
      navigate(`/join?code=${code ?? ''}`, { replace: true })
      return
    }
    setIndustry(localStorage.getItem('interview_industry_label') || '면접')
    void apiFetch('/api/interview/questions')
      .then((r) => r.json())
      .then((payload: { questions: PracticeQuestion[] }) => {
        const list = payload.questions ?? []
        setQuestions(list)
        if (list[0]) setMessages([{ kind: 'interviewer', text: list[0].question }])
      })
      .catch(() => setError('질문을 불러오지 못했어요. 새로고침 해주세요.'))
  }, [participantId, joinToken, code, navigate])

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  const total = questions.length || 12
  const current = questions[qIndex]
  const progress = Math.round(((qIndex + (phase === 'refined' || phase === 'finished' ? 1 : 0)) / total) * 100)

  async function coach(body: Record<string, unknown>): Promise<CoachResult> {
    const res = await apiFetch(`/api/participants/${participantId}/coach`, {
      method: 'POST',
      headers: { 'X-Join-Token': joinToken as string },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const detail = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(detail.error || 'coach_failed')
    }
    return res.json() as Promise<CoachResult>
  }

  async function send() {
    const text = draft.trim()
    if (!text || loading || !current || phase === 'refined' || phase === 'finished') return
    setDraft('')
    setError('')

    if (phase === 'answer') {
      setRawAnswer(text)
      setMessages((m) => [...m, { kind: 'student', text }])
      setLoading(true)
      try {
        const data = await coach({ question: current.question, rawAnswer: text, questionType: current.questionType })
        setMessages((m) => [...m, { kind: 'coach-probe', data }])
        setPhase('followup')
      } catch {
        setError('코치 응답을 받지 못했어요. 잠시 후 다시 시도해 주세요.')
      } finally {
        setLoading(false)
      }
    } else if (phase === 'followup') {
      setMessages((m) => [...m, { kind: 'student', text }])
      setLoading(true)
      try {
        const data = await coach({
          question: current.question,
          rawAnswer,
          rawFollowup: text,
          questionType: current.questionType,
        })
        setMessages((m) => [...m, { kind: 'coach-refined', data }])
        setPhase('refined')
      } catch {
        setError('코치 응답을 받지 못했어요. 잠시 후 다시 시도해 주세요.')
      } finally {
        setLoading(false)
      }
    }
  }

  function nextQuestion() {
    const ni = qIndex + 1
    if (ni >= total) {
      setPhase('finished')
      setMessages((m) => [...m, { kind: 'interviewer', text: '수고했어요! 오늘 면접 연습을 모두 마쳤어요. 👏' }])
      return
    }
    setQIndex(ni)
    setPhase('answer')
    setRawAnswer('')
    setMessages((m) => [...m, { kind: 'interviewer', text: questions[ni]!.question }])
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <main className="ipc-root">
      <div className="ipc-shell">
        <div className="appbar">
          <div className="who">
            <span className="dot">🎤</span> {industry} · 면접 연습
          </div>
          <span className="prog">질문 {Math.min(qIndex + 1, total)} / {total}</span>
        </div>
        <div className="progbar">
          <i style={{ width: `${progress}%` }} />
        </div>

        <div className="chat" ref={chatRef}>
          {messages.map((msg, i) => (
            <MessageRow key={i} msg={msg} />
          ))}
          {loading && (
            <div className="msg">
              <div className="av ai">🧭</div>
              <div className="coach loading">코치가 답을 살펴보는 중이에요…</div>
            </div>
          )}
          {error && <div className="ipc-error">{error}</div>}
        </div>

        <div className="inputbar">
          {phase === 'refined' && (
            <button className="nextbtn" type="button" onClick={nextQuestion} disabled={disabled}>
              {qIndex + 1 >= total ? '연습 마치기' : '다음 질문 ›'}
            </button>
          )}
          {phase === 'finished' && (
            <button className="nextbtn" type="button" onClick={() => navigate('/')}>
              처음으로
            </button>
          )}
          {(phase === 'answer' || phase === 'followup') && (
            <div className="field">
              <textarea
                className="box"
                rows={1}
                placeholder={phase === 'answer' ? '편하게 답해보세요 (거칠어도 괜찮아요)' : '답을 이어서 적어보세요…'}
                value={draft}
                disabled={disabled || loading}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
              />
              <div className="mic" title="음성 입력은 준비중이에요" aria-hidden="true">
                🎙️<span className="beta">준비중</span>
              </div>
              <button className="send" type="button" aria-label="보내기" onClick={() => void send()} disabled={disabled || loading || !draft.trim()}>
                ➤
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}

function MessageRow({ msg }: { msg: Msg }) {
  if (msg.kind === 'interviewer') {
    return (
      <div className="msg itv-row">
        <div className="av itv">👔</div>
        <div>
          <div className="name">면접관</div>
          <div className="bubble">{msg.text}</div>
        </div>
      </div>
    )
  }
  if (msg.kind === 'student') {
    return (
      <div className="msg stu-row">
        <div className="av stu">나</div>
        <div>
          <div className="name">나</div>
          <div className="bubble">{msg.text}</div>
        </div>
      </div>
    )
  }
  const data = msg.data
  const isProbe = msg.kind === 'coach-probe'
  return (
    <div className="msg">
      <div className="av ai">🧭</div>
      <div className="coach">
        <div className="lead">{isProbe ? '📋 코치 진단' : '✨ 이렇게 말해보세요'}</div>
        <div className="chips">
          {isProbe
            ? data.feedback.slice(0, 4).map((f, i) => (
                <span key={i} className={`chip ${f.severity === 'good' ? 'ok' : 'warn'}`} title={f.message}>
                  {f.severity === 'good' ? '✓' : '△'} {ruleLabel(f.rule)}
                </span>
              ))
            : (data.rulesApplied.length ? data.rulesApplied : data.feedback.map((f) => f.rule).filter(Boolean) as string[])
                .slice(0, 4)
                .map((r, i) => (
                  <span key={i} className="chip ok">
                    ✓ {ruleLabel(r)}
                  </span>
                ))}
        </div>

        {isProbe && data.feedback.length > 0 && (
          <ul className="fb">
            {data.feedback.slice(0, 3).map((f, i) => (
              <li key={i}>{f.message}</li>
            ))}
          </ul>
        )}

        {isProbe && data.probe && (
          <div className="probe">
            <div className="plab">🔎 면접관이 이렇게 되물어요</div>
            <p>{data.probe}</p>
          </div>
        )}

        {!isProbe && data.refinedAnswer && (
          <div className="polish">
            <div className="plab">다듬은 답변</div>
            <p>{data.refinedAnswer}</p>
          </div>
        )}

        {data.guard && (
          <div className="guard">
            <Shield />
            <span>{data.guard}</span>
          </div>
        )}
      </div>
    </div>
  )
}
