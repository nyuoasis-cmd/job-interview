import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function requireEnv(name: 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY' | 'SUPABASE_ANON_KEY'): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

export function parseSupabaseRef(rawUrl: string): string {
  const hostname = new URL(rawUrl).hostname
  const [ref] = hostname.split('.')
  if (!ref) {
    throw new Error('supabase_ref_parse_failed')
  }
  return ref
}

function parseJwtRef(token: string): string | null {
  const [, payload] = token.split('.')
  if (!payload) {
    return null
  }

  const decoded = Buffer.from(payload, 'base64url').toString('utf8')
  const claims = JSON.parse(decoded) as { iss?: string; ref?: string }
  if (claims.ref) {
    return claims.ref
  }
  if (claims.iss) {
    return parseSupabaseRef(claims.iss)
  }
  return null
}

const supabaseUrl = requireEnv('SUPABASE_URL')
const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

export const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export function createUserScopedClient(accessToken: string): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}

export async function assertSameSupabaseProject(): Promise<string> {
  const urlRef = parseSupabaseRef(requireEnv('SUPABASE_URL'))
  const authUrlRef = parseSupabaseRef(process.env.SUPABASE_AUTH_URL || process.env.SUPABASE_URL || '')
  const serviceRef = parseJwtRef(requireEnv('SUPABASE_SERVICE_ROLE_KEY'))
  const anonRef = parseJwtRef(requireEnv('SUPABASE_ANON_KEY'))
  const refs = [urlRef, authUrlRef, serviceRef, anonRef].filter((ref): ref is string => Boolean(ref))
  const uniqueRefs = new Set(refs)

  if (uniqueRefs.size !== 1) {
    throw new Error(`supabase_project_mismatch: urls=[${urlRef},${authUrlRef}], keys=[${serviceRef},${anonRef}]`)
  }

  return urlRef
}
