import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    void supabase.auth.getSession().then(() => {
      navigate('/teacher/sessions', { replace: true })
    })
  }, [navigate])

  return <main className="mx-auto max-w-xl px-5 py-10">로그인 처리 중입니다.</main>
}
