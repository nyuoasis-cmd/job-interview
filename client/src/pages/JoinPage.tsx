import { FormEvent, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { apiFetch } from '../lib/api'
import type { Participant } from '../types'

const messages: Record<string, string> = {
  invalid_code_format: '6자리 세션 코드를 입력해주세요.',
  name_required: '이름을 입력해주세요.',
  name_too_long: '이름은 30자 이내로 입력해주세요.',
  session_not_found: '세션을 찾을 수 없습니다.',
  session_closed: '이미 종료된 세션입니다.',
}

export default function JoinPage({ disabled }: { disabled: boolean }) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const initialCode = useMemo(() => (searchParams.get('code') || '').toUpperCase(), [searchParams])
  const [code, setCode] = useState(initialCode)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')

    const normalizedCode = code.trim().toUpperCase()
    const response = await apiFetch(`/api/sessions/${normalizedCode}/join`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    })
    const payload = (await response.json()) as {
      participant?: Participant
      joinToken?: string
      error?: string
    }

    setSubmitting(false)
    if (!response.ok || !payload.participant || !payload.joinToken) {
      setError(messages[payload.error || ''] || '입장 중 문제가 발생했습니다.')
      return
    }

    localStorage.setItem(`interview_join_token_${payload.participant.id}`, payload.joinToken)
    localStorage.setItem('interview_current_participant_id', payload.participant.id)
    navigate(`/session/${normalizedCode}/industry`)
  }

  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <h1 className="text-3xl font-bold tracking-normal">세션 참여</h1>
      <form onSubmit={handleSubmit} className="mt-8 rounded-md border border-[#d8ddd2] bg-white p-6">
        <label className="block text-sm font-semibold text-[#4a5750]" htmlFor="code">
          6자리 코드
        </label>
        <input
          id="code"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 6))}
          className="mt-2 w-full rounded-md border border-[#b8c1b8] px-4 py-3 text-xl font-bold uppercase tracking-[0.25em]"
          placeholder="A3K9PL"
          disabled={disabled || submitting}
        />
        <label className="mt-5 block text-sm font-semibold text-[#4a5750]" htmlFor="name">
          이름
        </label>
        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-2 w-full rounded-md border border-[#b8c1b8] px-4 py-3"
          placeholder="이름"
          disabled={disabled || submitting}
        />
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={disabled || submitting}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#2563eb] px-5 py-3 font-bold text-white disabled:bg-[#8a97a8]"
        >
          참여
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </form>
    </main>
  )
}
