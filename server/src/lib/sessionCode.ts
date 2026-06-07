import type { SupabaseClient } from '@supabase/supabase-js'

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const codeLength = 6
const maxAttempts = 5

function createCandidateCode(): string {
  let code = ''

  for (let index = 0; index < codeLength; index += 1) {
    const randomIndex = Math.floor(Math.random() * alphabet.length)
    code += alphabet[randomIndex]
  }

  return code
}

export async function generateUniqueCode(supabase: SupabaseClient): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = createCandidateCode()
    const { data, error } = await supabase
      .from('interview_sessions')
      .select('id')
      .eq('code', candidate)
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      return candidate
    }
  }

  throw new Error('failed_to_generate_unique_session_code')
}
