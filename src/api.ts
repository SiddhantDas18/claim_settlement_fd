// Small fetch wrapper: adds the login token and turns FastAPI error bodies into readable messages.

const BASE = import.meta.env.VITE_API_URL ?? ''
const TOKEN_KEY = 'claim-intake-token'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // storage unavailable (private window): the session just won't survive a reload
  }
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function describe(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d === 'string' ? d : `${(d.loc ?? []).filter((p: unknown) => p !== 'body').join('.')}: ${d.msg}`))
      .join('\n')
  }
  return 'Something went wrong.'
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let payload: BodyInit | undefined
  if (body instanceof FormData) payload = body
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, { method, headers, body: payload })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the backend running on port 8000?')
  }
  if (response.status === 204) return undefined as T
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, describe(data.detail))
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  del: (path: string) => request<void>('DELETE', path),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, form),
}

/** Open an uploaded document in a new tab (the download needs the login token, so a plain link won't do). */
export async function openDocument(path: string): Promise<void> {
  const token = getToken()
  const response = await fetch(`${BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!response.ok) throw new ApiError(response.status, 'Could not open the document.')
  const url = URL.createObjectURL(await response.blob())
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
