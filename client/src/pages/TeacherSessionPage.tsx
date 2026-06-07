import { FormEvent, useState } from 'react'
import { Copy, Plus } from 'lucide-react'
import { apiFetch } from '../lib/api'
import type { InterviewSession } from '../types'

export default function TeacherSessionPage({ disabled }: { disabled: boolean }) {
  const [title, setTitle] = useState('모의면접 세션')
  const [session, setSession] = useState<InterviewSession | null>(null)
  const [error, setError] = useState('')
  const [copyLabel, setCopyLabel] = useState('복사')

  async function createSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const response = await apiFetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ title }),
    })
    const payload = (await response.json()) as { session?: InterviewSession; error?: string }
    if (!response.ok || !payload.session) {
      setError(payload.error === 'unauthorized' ? '로그인이 필요합니다.' : '세션 생성 중 문제가 발생했습니다.')
      return
    }
    setSession(payload.session)
  }

  async function copyCode() {
    if (!session) {
      return
    }
    await navigator.clipboard.writeText(session.code)
    setCopyLabel('복사됨')
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="text-3xl font-bold tracking-normal">교사 세션</h1>
      <form onSubmit={createSession} className="mt-8 rounded-md border border-[#d8ddd2] bg-white p-6">
        <label htmlFor="title" className="block text-sm font-semibold text-[#4a5750]">
          세션 제목
        </label>
        <input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-2 w-full rounded-md border border-[#b8c1b8] px-4 py-3"
          disabled={disabled}
        />
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={disabled}
          className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#172026] px-5 py-3 font-bold text-white disabled:bg-[#8a97a8]"
        >
          <Plus size={18} aria-hidden="true" />
          새 세션 만들기
        </button>
      </form>
      {session && (
        <section className="mt-6 rounded-md border border-[#d8ddd2] bg-white p-6">
          <p className="text-sm font-semibold text-[#5a675e]">{session.title}</p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-5xl font-black tracking-[0.18em] text-[#2563eb]">{session.code}</p>
            <button
              type="button"
              onClick={copyCode}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-[#b8c1b8] px-4 py-3 font-bold"
            >
              <Copy size={18} aria-hidden="true" />
              {copyLabel}
            </button>
          </div>
          <div className="mt-5 flex h-28 w-28 items-center justify-center rounded-md border border-dashed border-[#8a97a8] text-sm font-bold text-[#5a675e]">
            [QR]
          </div>
        </section>
      )}
    </main>
  )
}
