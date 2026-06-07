import { useEffect, useState } from 'react'
import { apiFetch } from '../lib/api'
import type { IndustryCategory } from '../types'

export default function DemoPage({ disabled }: { disabled: boolean }) {
  const [taxonomy, setTaxonomy] = useState<IndustryCategory[]>([])
  const [selected, setSelected] = useState('')

  useEffect(() => {
    void apiFetch('/api/industries')
      .then((response) => response.json())
      .then((payload: { taxonomy: IndustryCategory[] }) => setTaxonomy(payload.taxonomy))
  }, [])

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-3xl font-bold tracking-normal">데모 면접</h1>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        {taxonomy.map((category) => (
          <button
            key={category.majorCategory}
            type="button"
            onClick={() => setSelected(category.majorCategory)}
            className={`min-h-24 rounded-md border p-4 text-left font-bold ${
              selected === category.majorCategory ? 'border-[#2563eb] bg-white' : 'border-[#d8ddd2] bg-white'
            }`}
          >
            {category.majorCategory}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled || !selected}
        className="mt-6 rounded-md bg-[#172026] px-5 py-3 font-bold text-white disabled:bg-[#8a97a8]"
      >
        면접 시작
      </button>
      <p className="mt-3 text-sm text-[#5a675e]">질문 화면은 다음 단계에서 연결됩니다.</p>
    </main>
  )
}
