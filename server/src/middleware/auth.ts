import type { Request, Response, NextFunction } from 'express'
import { supabaseAdmin } from '../db.js'

function isInvalidToken(token: string | null | undefined): boolean {
  if (!token) {
    return true
  }

  const normalized = token.trim()
  return normalized === '' || normalized === 'undefined' || normalized === 'null'
}

function extractAccessToken(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'access_token' in (parsed as object) &&
      typeof (parsed as Record<string, unknown>).access_token === 'string'
    ) {
      return (parsed as Record<string, unknown>).access_token as string
    }
  } catch {
    // not JSON, already a raw JWT
  }
  return raw
}

export async function verifySupabaseJwt(token: string | null | undefined) {
  if (isInvalidToken(token)) {
    return null
  }

  if (token == null) {
    return null
  }

  const normalizedToken = extractAccessToken(token.trim())
  const { data, error } = await supabaseAdmin.auth.getUser(normalizedToken)
  if (error || !data.user) {
    return null
  }

  return data.user
}

function readAuthToken(req: Request): string | null {
  const bearer = req.header('Authorization')
  if (bearer?.startsWith('Bearer ')) {
    return bearer.slice('Bearer '.length)
  }

  const cookieHeader = req.header('Cookie') || ''
  const cookies = cookieHeader.split(';').map((item) => item.trim())
  const authCookie = cookies.find((item) => item.startsWith('sb-auth-token='))
  if (!authCookie) {
    return null
  }

  return decodeURIComponent(authCookie.slice('sb-auth-token='.length))
}

export async function requireTeacherAuth(req: Request, res: Response, next: NextFunction) {
  const user = await verifySupabaseJwt(readAuthToken(req))
  if (!user) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }

  res.locals.user = user
  next()
}
