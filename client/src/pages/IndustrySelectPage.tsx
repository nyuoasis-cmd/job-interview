import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { apiFetch } from '../lib/api'
import type { IndustryCategory, IndustrySubCategory } from '../types'

const patchMessages: Record<string, string> = {
  join_token_required: '인증 정보가 없습니다. 다시 입장해주세요.',
  join_token_invalid: '입장 정보가 올바르지 않습니다. 다시 입장해주세요.',
  session_closed: '세션이 종료되어 직종을 선택할 수 없습니다.',
  industry_already_confirmed: '이미 직종을 선택하고 면접을 시작했습니다.',
  invalid_industry: '선택한 직종 정보가 올바르지 않습니다.',
}

function useExitGuard(enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return
    }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    const popstate = () => {
      if (!window.confirm('직종 선택을 취소하시겠습니까?')) {
        window.history.pushState(null, '', window.location.href)
      }
    }

    window.history.pushState(null, '', window.location.href)
    window.addEventListener('beforeunload', beforeUnload)
    window.addEventListener('popstate', popstate)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      window.removeEventListener('popstate', popstate)
    }
  }, [enabled])
}

export default function IndustrySelectPage({ disabled }: { disabled: boolean }) {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [taxonomy, setTaxonomy] = useState<IndustryCategory[]>([])
  const [selectedMajor, setSelectedMajor] = useState('')
  const [selectedSub, setSelectedSub] = useState<IndustrySubCategory | null>(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)

  useExitGuard(ready && !done)

  const selectedCategory = useMemo(
    () => taxonomy.find((category) => category.majorCategory === selectedMajor),
    [selectedMajor, taxonomy],
  )

  useEffect(() => {
    let mounted = true
    async function load() {
      const sessionResponse = await apiFetch(`/api/sessions/${code}`)
      const participantId = localStorage.getItem('interview_current_participant_id')
      const token = participantId ? localStorage.getItem(`interview_join_token_${participantId}`) : null

      if (!token) {
        if (sessionResponse.status === 410) {
          setError('이 세션은 이미 종료됐습니다.')
          setReady(true)
          return
        }
        navigate(`/join?code=${code}`, { replace: true })
        return
      }

      const industriesResponse = await apiFetch('/api/industries')
      const payload = (await industriesResponse.json()) as { taxonomy: IndustryCategory[] }
      if (mounted) {
        setTaxonomy(payload.taxonomy)
        setReady(true)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [code, navigate])

  async function confirmIndustry() {
    const participantId = localStorage.getItem('interview_current_participant_id')
    const token = participantId ? localStorage.getItem(`interview_join_token_${participantId}`) : null
    if (!participantId || !token || !selectedSub) {
      setError('인증 정보가 없습니다. 다시 입장해주세요.')
      return
    }

    const response = await apiFetch(`/api/participants/${participantId}/industry`, {
      method: 'PATCH',
      headers: { 'X-Join-Token': token },
      body: JSON.stringify({
        selected_industry: selectedMajor,
        selected_sub: selectedSub.name,
      }),
    })
    const payload = (await response.json()) as { error?: string }
    if (!response.ok) {
      setError(patchMessages[payload.error || ''] || '직종 선택 중 문제가 발생했습니다.')
      return
    }
    localStorage.setItem('interview_industry_label', selectedSub.name)
    setDone(true)
  }

  if (!ready) {
    return <main className="mx-auto max-w-6xl px-5 py-10">불러오는 중입니다.</main>
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <h1 className="text-3xl font-bold tracking-normal">직종 선택</h1>
      <p className="mt-2 text-[#5a675e]">세션 코드 {code.toUpperCase()}</p>
      {done ? (
        <section className="mt-8 rounded-md border border-[#b7d3bf] bg-white p-6">
          <CheckCircle className="text-green-700" size={32} aria-hidden="true" />
          <h2 className="mt-4 text-xl font-bold">직종을 선택했어요</h2>
          <p className="mt-2 text-[#5a675e]">이제 실제 면접처럼 질문에 답해볼까요? 답하면 AI 코치가 바로 봐줘요.</p>
          <button
            type="button"
            onClick={() => navigate(`/session/${code}/practice`)}
            className="mt-5 rounded-md bg-[#3b5bdb] px-5 py-3 font-bold text-white"
          >
            면접 연습 시작 ›
          </button>
        </section>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            {taxonomy.map((category) => (
              <button
                key={category.majorCategory}
                type="button"
                onClick={() => {
                  setSelectedMajor(category.majorCategory)
                  setSelectedSub(null)
                  setError('')
                }}
                className={`min-h-28 rounded-md border p-4 text-left font-bold ${
                  selectedMajor === category.majorCategory
                    ? 'border-[#2563eb] bg-[#eaf1ff] text-[#173d86]'
                    : 'border-[#d8ddd2] bg-white'
                }`}
              >
                {category.majorCategory}
              </button>
            ))}
          </div>
          {selectedCategory && (
            <section className="mt-8">
              <button
                type="button"
                onClick={() => setSelectedMajor('')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#395064]"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                대분류 다시 선택
              </button>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                {selectedCategory.subCategories.map((sub) => (
                  <button
                    key={sub.name}
                    type="button"
                    onClick={() => setSelectedSub(sub)}
                    className={`rounded-md border p-4 text-left ${
                      selectedSub?.name === sub.name ? 'border-[#2563eb] bg-white' : 'border-[#d8ddd2] bg-white'
                    }`}
                  >
                    <span className="font-bold">{sub.name}</span>
                    <span className="mt-2 block text-sm text-[#5a675e]">{sub.interviewStyle}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {error && <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>}
          <button
            type="button"
            disabled={disabled || !selectedSub}
            onClick={confirmIndustry}
            className="mt-6 w-full rounded-md bg-[#2563eb] px-5 py-4 font-bold text-white disabled:bg-[#8a97a8] sm:w-auto"
          >
            면접 시작
          </button>
        </>
      )}
    </main>
  )
}
