import { Link } from 'react-router-dom'
import { LogIn, PlayCircle } from 'lucide-react'

export default function LandingPage({ disabled }: { disabled: boolean }) {
  return (
    <main>
      <section
        className="relative min-h-[calc(100vh-88px)] overflow-hidden bg-cover bg-center"
        style={{
          backgroundImage:
            'linear-gradient(90deg, rgba(23,32,38,.92), rgba(23,32,38,.62), rgba(23,32,38,.2)), url(https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1800&q=80)',
        }}
      >
        <div className="mx-auto flex min-h-[calc(100vh-88px)] max-w-6xl items-center px-5 py-12">
          <div className="max-w-2xl text-white">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#b9e3c6]">
              직업계고 면접 준비
            </p>
            <h1 className="text-4xl font-bold leading-tight tracking-normal sm:text-5xl">
              AI 면접 코칭
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-white/88">
              교사가 만든 세션에 참여하고, 지원 직종을 고른 뒤 다음 단계의 면접 연습으로 이어지는 준비 화면입니다.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/join"
                aria-disabled={disabled}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#f5c451] px-5 py-3 font-bold text-[#172026] shadow-lg shadow-black/20"
              >
                <LogIn size={20} aria-hidden="true" />
                세션 참여하기
              </Link>
              <Link
                to="/demo"
                aria-disabled={disabled}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-white/60 bg-white/12 px-5 py-3 font-bold text-white backdrop-blur"
              >
                <PlayCircle size={20} aria-hidden="true" />
                데모 면접 해보기
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="bg-white px-5 py-10">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-3">
          {['6자리 세션 코드', '8대 직종 분류', '교사 세션 생성'].map((item) => (
            <div key={item} className="rounded-md border border-[#d8ddd2] p-5">
              <p className="text-sm font-semibold text-[#5a675e]">{item}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
