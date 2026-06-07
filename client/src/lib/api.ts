const rawApiUrl = import.meta.env.VITE_API_URL?.trim()
export const apiBaseUrl = rawApiUrl && rawApiUrl !== '/' ? rawApiUrl.replace(/\/$/, '') : ''

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}
