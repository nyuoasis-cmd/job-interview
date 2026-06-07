import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function DevLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })
    if (loginError) {
      setError('로그인 정보를 확인해주세요.')
      return
    }
    navigate('/teacher/sessions')
  }

  async function kakaoLogin() {
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <h1 className="text-3xl font-bold tracking-normal">교사 로그인</h1>
      <button
        type="button"
        onClick={kakaoLogin}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#f5c451] px-5 py-3 font-bold text-[#172026]"
      >
        <LogIn size={18} aria-hidden="true" />
        카카오 로그인
      </button>
      <form onSubmit={login} className="mt-6 rounded-md border border-[#d8ddd2] bg-white p-6">
        <label htmlFor="email" className="block text-sm font-semibold text-[#4a5750]">
          개발용 이메일
        </label>
        <input
          id="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-md border border-[#b8c1b8] px-4 py-3"
        />
        <label htmlFor="password" className="mt-4 block text-sm font-semibold text-[#4a5750]">
          비밀번호
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-md border border-[#b8c1b8] px-4 py-3"
        />
        {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        <button type="submit" className="mt-5 w-full rounded-md bg-[#172026] px-5 py-3 font-bold text-white">
          로그인
        </button>
      </form>
    </main>
  )
}
