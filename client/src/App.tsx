import { useEffect, useState, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { supabase, assertClientSupabaseConsistency } from './lib/supabase'
import AuthCallback from './pages/AuthCallback'
import DemoPage from './pages/DemoPage'
import DevLoginPage from './pages/DevLoginPage'
import IndustrySelectPage from './pages/IndustrySelectPage'
import InterviewPracticePage from './pages/InterviewPracticePage'
import JoinPage from './pages/JoinPage'
import LandingPage from './pages/LandingPage'
import TeacherSessionPage from './pages/TeacherSessionPage'

const isSttFeatureEnabled = import.meta.env.VITE_FEATURE_STT === 'true'

function AuthGuard({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'authed' | 'guest'>('checking')
  const location = useLocation()

  useEffect(() => {
    let mounted = true
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setStatus(data.session ? 'authed' : 'guest')
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  if (status === 'checking') {
    return <main className="min-h-screen bg-[#f7f8f4] p-6 text-[#172026]">확인 중입니다.</main>
  }
  if (status === 'guest') {
    return <Navigate to="/dev-login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

function Layout() {
  const [configOk, setConfigOk] = useState(true)

  useEffect(() => {
    void assertClientSupabaseConsistency().then(setConfigOk)
  }, [])

  return (
    <div className="min-h-screen bg-[#f7f8f4] text-[#172026]" data-stt-enabled={String(isSttFeatureEnabled)}>
      {!configOk && (
        <div className="flex items-center justify-center gap-2 bg-red-700 px-4 py-3 text-sm font-semibold text-white">
          <AlertTriangle size={18} aria-hidden="true" />
          서버 설정 불일치 - 관리자에게 문의
        </div>
      )}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link to="/" className="text-lg font-bold tracking-normal">
          AI 면접 코칭
        </Link>
        <nav className="flex items-center gap-3 text-sm font-semibold">
          <Link to="/join" className="rounded-md px-3 py-2 hover:bg-white">
            세션 참여
          </Link>
          <Link to="/teacher/sessions" className="rounded-md bg-[#172026] px-3 py-2 text-white">
            교사 로그인
          </Link>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<LandingPage disabled={!configOk} />} />
        <Route path="/join" element={<JoinPage disabled={!configOk} />} />
        <Route path="/session/:code/industry" element={<IndustrySelectPage disabled={!configOk} />} />
        <Route path="/session/:code/practice" element={<InterviewPracticePage disabled={!configOk} />} />
        <Route path="/teacher/sessions" element={<AuthGuard><TeacherSessionPage disabled={!configOk} /></AuthGuard>} />
        <Route path="/demo" element={<DemoPage disabled={!configOk} />} />
        <Route path="/dev-login" element={<DevLoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  )
}
