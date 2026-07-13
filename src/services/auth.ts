import { reactive } from 'vue'
import { config } from '../config'

type AuthUser = { user_id: string; email: string; roles: string[] }
type Tokens = { accessToken: string; refreshToken: string }

const ACCESS_KEY = 'afiet-admin:access'
const REFRESH_KEY = 'afiet-admin:refresh'

export const auth = reactive<{
  status: 'loading' | 'authenticated' | 'anonymous'
  user: AuthUser | null
}>({ status: 'loading', user: null })

let initialized = false

function stackHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Stack-Access-Type': 'client',
    'X-Stack-Project-Id': config.stackProjectId,
  }
}

function readTokens(): Tokens | null {
  const accessToken = sessionStorage.getItem(ACCESS_KEY)
  const refreshToken = sessionStorage.getItem(REFRESH_KEY)
  return accessToken && refreshToken ? { accessToken, refreshToken } : null
}

function saveTokens(tokens: Tokens) {
  sessionStorage.setItem(ACCESS_KEY, tokens.accessToken)
  sessionStorage.setItem(REFRESH_KEY, tokens.refreshToken)
}

export function signOut() {
  sessionStorage.removeItem(ACCESS_KEY)
  sessionStorage.removeItem(REFRESH_KEY)
  auth.user = null
  auth.status = 'anonymous'
}

async function readMessage(response: Response) {
  try {
    const body = await response.json()
    if (body?.code === 'EMAIL_PASSWORD_MISMATCH') return 'E-posta veya şifre hatalı.'
    return body?.error?.message || body?.error || 'İşlem tamamlanamadı.'
  } catch {
    return 'İşlem tamamlanamadı.'
  }
}

async function refreshAccessToken(): Promise<string> {
  const tokens = readTokens()
  if (!tokens) throw new Error('Oturum bulunamadı.')
  const response = await fetch(`${config.stackBaseUrl}/api/v1/auth/sessions/current/refresh`, {
    method: 'POST',
    headers: { ...stackHeaders(), 'X-Stack-Refresh-Token': tokens.refreshToken },
  })
  if (!response.ok) throw new Error(await readMessage(response))
  const body = (await response.json()) as { access_token: string }
  saveTokens({ accessToken: body.access_token, refreshToken: tokens.refreshToken })
  return body.access_token
}

export async function authorizedFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const tokens = readTokens()
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')
  if (tokens?.accessToken) headers.set('Authorization', `Bearer ${tokens.accessToken}`)
  let response = await fetch(`${config.apiUrl}${path}`, { ...init, headers })
  if (response.status === 401 && retry && tokens?.refreshToken) {
    try {
      const access = await refreshAccessToken()
      headers.set('Authorization', `Bearer ${access}`)
      response = await fetch(`${config.apiUrl}${path}`, { ...init, headers })
    } catch {
      signOut()
    }
  }
  return response
}

async function verifySession() {
  const response = await authorizedFetch('/v1/me')
  if (!response.ok) throw new Error(await readMessage(response))
  auth.user = (await response.json()) as AuthUser
  const adminCheck = await authorizedFetch('/v1/admin/summary')
  if (!adminCheck.ok) {
    if (adminCheck.status === 403) throw new Error('Bu hesapta admin yetkisi bulunmuyor.')
    throw new Error(await readMessage(adminCheck))
  }
  auth.status = 'authenticated'
}

export async function initializeAuth() {
  if (initialized) return
  initialized = true
  if (!readTokens()) {
    auth.status = 'anonymous'
    return
  }
  try {
    await verifySession()
  } catch {
    signOut()
  }
}

export async function signIn(email: string, password: string) {
  if (!config.stackProjectId) throw new Error('VITE_STACK_PROJECT_ID yapılandırılmamış.')
  const response = await fetch(`${config.stackBaseUrl}/api/v1/auth/password/sign-in`, {
    method: 'POST',
    headers: stackHeaders(),
    body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
  })
  if (!response.ok) throw new Error(await readMessage(response))
  const body = (await response.json()) as { access_token: string; refresh_token: string }
  saveTokens({ accessToken: body.access_token, refreshToken: body.refresh_token })
  try {
    await verifySession()
  } catch (error) {
    signOut()
    throw error
  }
}
