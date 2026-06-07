import { createClient } from '@supabase/supabase-js'
import Cookies from 'js-cookie'
import { apiFetch } from './api'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || 'https://example.supabase.co'
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  || 'placeholder-anon-key-for-local-qa'

const cookieDomain = window.location.hostname.includes('teachermate.co.kr')
  ? '.teachermate.co.kr'
  : undefined

const cookieStorage = {
  getItem: (key: string) => Cookies.get(key) ?? null,
  setItem: (key: string, value: string) => {
    Cookies.set(key, value, {
      domain: cookieDomain,
      secure: window.location.protocol === 'https:',
      sameSite: 'lax' as const,
      expires: 365,
    })
  },
  removeItem: (key: string) => {
    Cookies.remove(key, { domain: cookieDomain })
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: cookieStorage,
    storageKey: 'sb-auth-token',
  },
})

export function parseSupabaseRef(rawUrl: string): string | null {
  try {
    const [ref] = new URL(rawUrl).hostname.split('.')
    return ref || null
  } catch {
    return null
  }
}

function parseJwtRef(token: string): string | null {
  const [, payload] = token.split('.')
  if (!payload) {
    return null
  }

  try {
    const decoded = JSON.parse(window.atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      iss?: string
      ref?: string
    }
    return decoded.ref || (decoded.iss ? parseSupabaseRef(decoded.iss) : null)
  } catch {
    return null
  }
}

export async function assertClientSupabaseConsistency(): Promise<boolean> {
  const urlRef = parseSupabaseRef(supabaseUrl)
  const anonRef = parseJwtRef(supabaseAnonKey)
  if (urlRef && anonRef && urlRef !== anonRef) {
    console.error('client_supabase_ref_mismatch')
    return false
  }

  try {
    const response = await apiFetch('/api/config')
    if (!response.ok) {
      return true
    }
    const config = (await response.json()) as { supabaseRef?: string }
    if (urlRef && config.supabaseRef && urlRef !== config.supabaseRef) {
      console.error('server_client_supabase_ref_mismatch')
      return false
    }
  } catch {
    return true
  }

  return true
}
