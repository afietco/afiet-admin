import { reactive } from 'vue'
import { config } from '../config'

/**
 * Panel oturumu.
 *
 * SAKLAMA. Uzun ömürlü refresh token `localStorage`ta yaşar (tarayıcı
 * kapansa da oturum sürsün diye), access token YALNIZ bu modülün belleğinde
 * durur ve hiçbir zaman diske yazılmaz. Eskiden ikisi de `sessionStorage`
 * içindeydi: her yeni sekme yeniden giriş demekti, "token çok hızlı doluyor"
 * şikâyetinin asıl kaynağı oydu.
 *
 * PENCERE. Kayan 30 gün: panele her uğrayış damgayı tazeler, 30 gün hiç
 * uğranmazsa oturum kendiliğinden düşer ve token silinir. Pencere bizim
 * tarafımızda uygulanır; Stack Auth kendi refresh token'ını daha erken
 * geçersiz kılarsa akış yine aynı yere, giriş ekranına çıkar.
 *
 * YENİLEME. Access token bitişine yaklaşınca peşinen yenilenir (zamanlayıcı +
 * sekme öne geldiğinde). Yenileme TEK UÇUŞLUDUR: aynı anda on istek 401 alsa
 * bile sağlayıcıya tek bir yenileme çağrısı gider.
 *
 * DÜŞÜŞ. Oturum nerede biterse bitsin (istek sırasında, arka planda,
 * başka sekmede çıkış yapıldığında) kullanıcı bozuk bir ekranda bırakılmaz:
 * `endSession` giriş ekranına yönlendirir, sebebi söyler ve giriş sonrası
 * kaldığı yere döndürür.
 */

type AuthUser = { user_id: string; email: string; roles: string[] }

export type SessionEndReason = 'suresi-doldu' | 'yetki-yok' | 'cikis'

/** Kayan oturum penceresi: son kullanımdan itibaren 30 gün. */
const SESSION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
/** Access token'ı bitişine bu kadar kala peşinen yenile. */
const REFRESH_LEEWAY_MS = 90 * 1000
/** Admin yetkisi en fazla bu aralıkla yeniden doğrulanır. */
const REVALIDATE_INTERVAL_MS = 10 * 60 * 1000
/** "Son kullanım" damgası her istekte değil, bu aralıkla diske yazılır. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000
/** Zamanlayıcı en fazla bu kadar uykuya yatar (uzun uykular güvenilmez). */
const MAX_TIMER_MS = 10 * 60 * 1000
/** Ağ arızasında yenilemeyi bu aralıkla tekrar dene. */
const NETWORK_RETRY_MS = 30 * 1000

const REFRESH_KEY = 'afiet-admin:refresh'
const LAST_SEEN_KEY = 'afiet-admin:son-kullanim'
/** Sekmeler arası "oturum bitti" duyurusu (değer: sebep + damga). */
const SESSION_END_KEY = 'afiet-admin:oturum-sonu'
/** 0.1 sürümünde token'lar burada dururdu; kalıntı bırakmamak için siliniyor. */
const LEGACY_ACCESS_KEY = 'afiet-admin:access'
const LEGACY_REFRESH_KEY = 'afiet-admin:refresh'

export const auth = reactive<{
  status: 'loading' | 'authenticated' | 'anonymous'
  user: AuthUser | null
  /** Oturum en son neden bitti: giriş ekranı doğru cümleyi kursun diye. */
  endReason: SessionEndReason | null
}>({ status: 'loading', user: null, endReason: null })

let accessToken = ''
let accessExpiresAt = 0
let lastVerifiedAt = 0
let lastTouchedAt = 0
let initPromise: Promise<void> | null = null
let listenersInstalled = false
let devBypass = false
let refreshInFlight: Promise<string> | null = null
let adminCheckInFlight: Promise<boolean> | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null
let onSessionEnd: ((reason: SessionEndReason) => void) | null = null

/** Oturum bittiğinde nereye gidileceğini router kaydeder (döngüsel import olmasın). */
export function registerSessionEndHandler(handler: (reason: SessionEndReason) => void) {
  onSessionEnd = handler
}

/* ------------------------------------------------------------------ hata türleri */

/** Token yok/ölü: yeniden giriş gerekir. */
class SessionLost extends Error {}
/** Kimlik geçerli ama admin değil. */
class AdminDenied extends Error {}
/** Ağ/sunucu erişilemedi: oturum hakkında HİÇBİR ŞEY söylemez, kapatma. */
class NetworkTrouble extends Error {}

/* ------------------------------------------------------------------ saklama */

function readStorage(key: string): string {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* özel mod / dolu kota: oturum bu sekmeyle sınırlı kalır */
  }
}

function dropStorage(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* yoksay */
  }
}

function readRefreshToken(): string {
  return readStorage(REFRESH_KEY)
}

function saveRefreshToken(token: string) {
  writeStorage(REFRESH_KEY, token)
}

/** Kayan pencere açık mı: son kullanımın üstünden 30 günden az geçti mi. */
function sessionWindowOpen(): boolean {
  const seen = Number(readStorage(LAST_SEEN_KEY))
  if (!Number.isFinite(seen) || seen <= 0) return false
  // İleri tarihli damga (saat oynatılmış): pencereyi kapatma, yeniden damgala.
  if (seen > Date.now()) return true
  return Date.now() - seen < SESSION_WINDOW_MS
}

/**
 * Kayan pencerenin damgası. YALNIZ gerçek kullanım tazeler: gezinme, tuş,
 * tıklama, giriş. Otomatik token yenilemesi BİLEREK tazelemez — yoksa açık
 * unutulmuş bir sekme kendi kendini yenileyip pencereyi sonsuza uzatırdı.
 */
function touchSession(force = false) {
  const now = Date.now()
  if (!force && now - lastTouchedAt < TOUCH_INTERVAL_MS) return
  lastTouchedAt = now
  writeStorage(LAST_SEEN_KEY, String(now))
}

/** Eski sürümün sessionStorage oturumunu devral, sonra kalıntıyı sil. */
function adoptLegacySession() {
  try {
    const legacy = sessionStorage.getItem(LEGACY_REFRESH_KEY)
    if (legacy && !readRefreshToken()) {
      saveRefreshToken(legacy)
      touchSession(true)
    }
    sessionStorage.removeItem(LEGACY_ACCESS_KEY)
    sessionStorage.removeItem(LEGACY_REFRESH_KEY)
  } catch {
    /* yoksay */
  }
}

/* ------------------------------------------------------------------ token */

/** JWT'nin `exp` alanını ms olarak okur; okunamazsa 0 (yenilemeye zorlar). */
function expiryOf(token: string): number {
  const segment = token.split('.')[1]
  if (!segment) return 0
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as { exp?: unknown }
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0
  } catch {
    return 0
  }
}

function setAccessToken(token: string) {
  accessToken = token
  accessExpiresAt = expiryOf(token)
  scheduleRefresh()
}

function clearMemory() {
  accessToken = ''
  accessExpiresAt = 0
  lastVerifiedAt = 0
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = null
}

function scheduleRefresh(delayMs?: number) {
  if (refreshTimer) clearTimeout(refreshTimer)
  const untilRefresh = accessExpiresAt ? accessExpiresAt - Date.now() - REFRESH_LEEWAY_MS : MAX_TIMER_MS
  const wait = Math.min(Math.max(delayMs ?? untilRefresh, 5 * 1000), MAX_TIMER_MS)
  refreshTimer = setTimeout(() => void keepAlive(), wait)
}

/** Zamanlayıcının ve sekme odağının ortak işi: token tazeyse dokunma, değilse yenile. */
async function keepAlive() {
  if (auth.status !== 'authenticated' || devBypass) return
  try {
    await ensureAccessToken()
    scheduleRefresh()
  } catch (error) {
    if (error instanceof NetworkTrouble) {
      // Ağ ya da sağlayıcı arızası: oturumu düşürme, seyrelterek yeniden dene.
      scheduleRefresh(NETWORK_RETRY_MS)
      return
    }
    endSession('suresi-doldu')
  }
}

function stackHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-Stack-Access-Type': 'client',
    'X-Stack-Project-Id': config.stackProjectId,
  }
}

async function requestRefresh(): Promise<string> {
  const refreshToken = readRefreshToken()
  if (!refreshToken) throw new SessionLost('Oturum bulunamadı.')

  let response: Response
  try {
    response = await fetch(`${config.stackBaseUrl}/api/v1/auth/sessions/current/refresh`, {
      method: 'POST',
      headers: { ...stackHeaders(), 'X-Stack-Refresh-Token': refreshToken },
    })
  } catch {
    throw new NetworkTrouble('Sunucuya ulaşılamadı.')
  }
  // 5xx sağlayıcı arızasıdır, oturumun bittiği anlamına gelmez.
  if (response.status >= 500) throw new NetworkTrouble('Sunucu yanıt vermiyor.')
  if (!response.ok) throw new SessionLost(await readMessage(response))

  const body = (await response.json()) as { access_token?: string; refresh_token?: string }
  if (!body.access_token) throw new SessionLost('Oturum yenilenemedi.')
  // Sağlayıcı rotasyon uygularsa yeni refresh token'ı sakla.
  if (body.refresh_token && body.refresh_token !== refreshToken) saveRefreshToken(body.refresh_token)
  setAccessToken(body.access_token)
  return body.access_token
}

/** Tek uçuşlu yenileme: eşzamanlı çağrılar aynı isteği paylaşır. */
function refreshAccess(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = requestRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

/** İstek atmadan önce elde geçerli bir access token olduğunu garantiler. */
async function ensureAccessToken(): Promise<string> {
  if (!readRefreshToken()) throw new SessionLost('Oturum bulunamadı.')
  if (!sessionWindowOpen()) throw new SessionLost('Oturum penceresi doldu.')
  if (accessToken && Date.now() < accessExpiresAt - REFRESH_LEEWAY_MS) return accessToken
  return refreshAccess()
}

/* ------------------------------------------------------------------ oturumu bitirmek */

function endSession(reason: SessionEndReason, broadcast = true, redirect = true) {
  clearMemory()
  dropStorage(REFRESH_KEY)
  dropStorage(LAST_SEEN_KEY)
  auth.user = null
  auth.status = 'anonymous'
  auth.endReason = reason
  // Damga her seferinde farklı olmalı: aynı değeri yazmak storage olayını
  // tetiklemez ve diğer sekmeler haberi almaz.
  if (broadcast) writeStorage(SESSION_END_KEY, JSON.stringify({ reason, at: Date.now() }))
  if (redirect) onSessionEnd?.(reason)
}

/** Kullanıcının kendi eliyle çıkışı. Sağlayıcıdaki oturumu da iptal etmeye çalışır. */
export function signOut() {
  const token = accessToken
  const refreshToken = readRefreshToken()
  endSession('cikis')
  if (!token || !refreshToken) return
  // Çalınmış bir refresh token çıkıştan sonra da yaşamasın. Sonucu beklemiyoruz:
  // yerel temizlik zaten yapıldı, iptal edilemezse de oturum bu tarayıcıda bitti.
  void fetch(`${config.stackBaseUrl}/api/v1/auth/sessions/current`, {
    method: 'DELETE',
    headers: { ...stackHeaders(), 'X-Stack-Access-Token': token, 'X-Stack-Refresh-Token': refreshToken },
  }).catch(() => {})
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

/* ------------------------------------------------------------------ kimlikli istek */

export async function authorizedFetchBase(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  retry = true,
): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')

  if (!devBypass) {
    let token: string
    try {
      token = await ensureAccessToken()
    } catch (error) {
      if (error instanceof NetworkTrouble) throw error
      endSession('suresi-doldu')
      throw new Error('Oturumun süresi doldu.')
    }
    headers.set('Authorization', `Bearer ${token}`)
  }

  let response = await fetch(`${baseUrl}${path}`, { ...init, headers })

  if (response.status === 401 && retry && !devBypass) {
    try {
      const fresh = await refreshAccess()
      headers.set('Authorization', `Bearer ${fresh}`)
      response = await fetch(`${baseUrl}${path}`, { ...init, headers })
    } catch (error) {
      if (!(error instanceof NetworkTrouble)) endSession('suresi-doldu')
      return response
    }
    // Taze token'la da reddediliyorsa mesele token değil, oturumun kendisidir.
    if (response.status === 401) {
      endSession('suresi-doldu')
      return response
    }
  }

  // 403 tek başına "oturum bitti" demek DEĞİLDİR: bazı uçlar iş kuralı için de
  // 403 döner. Kararı, admin yetkisini kaynağına sorarak veriyoruz.
  if (response.status === 403 && !devBypass && auth.status === 'authenticated') {
    if (!(await confirmAdmin())) endSession('yetki-yok')
    return response
  }

  return response
}

export function authorizedFetch(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  return authorizedFetchBase(config.apiUrl, path, init, retry)
}

/* ------------------------------------------------------------------ doğrulama */

/** Kimlikli ham GET: merkezî 401/403 mantığını tetiklemeden yanıtı verir. */
async function probe(path: string): Promise<Response> {
  const token = await ensureAccessToken()
  try {
    return await fetch(`${config.apiUrl}${path}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    })
  } catch {
    throw new NetworkTrouble('Sunucuya ulaşılamadı.')
  }
}

/** Yetki hâlâ duruyor mu. Emin olamıyorsak (ağ, 5xx) "duruyor" deriz. */
function confirmAdmin(): Promise<boolean> {
  if (!adminCheckInFlight) {
    adminCheckInFlight = (async () => {
      try {
        const response = await probe('/v1/admin/summary')
        if (response.status === 403) return false
        if (response.ok) lastVerifiedAt = Date.now()
        return true
      } catch {
        return true
      } finally {
        adminCheckInFlight = null
      }
    })()
  }
  return adminCheckInFlight
}

/** Kimliği ve admin yetkisini kaynaktan doğrular; başarısızsa tür ayrımıyla atar. */
async function verifySession() {
  const me = await probe('/v1/me')
  if (me.status === 401) throw new SessionLost('Oturum geçersiz.')
  if (me.status >= 500) throw new NetworkTrouble('Sunucu yanıt vermiyor.')
  if (!me.ok) throw new SessionLost(await readMessage(me))
  const user = (await me.json()) as AuthUser

  const adminCheck = await probe('/v1/admin/summary')
  if (adminCheck.status === 403) throw new AdminDenied('Bu hesapta admin yetkisi bulunmuyor.')
  if (adminCheck.status === 401) throw new SessionLost('Oturum geçersiz.')
  if (adminCheck.status >= 500) throw new NetworkTrouble('Sunucu yanıt vermiyor.')
  if (!adminCheck.ok) throw new SessionLost(await readMessage(adminCheck))

  auth.user = user
  auth.status = 'authenticated'
  lastVerifiedAt = Date.now()
  touchSession(true)
}

/* ------------------------------------------------------------------ sekme olayları */

function installListeners() {
  if (listenersInstalled) return
  listenersInstalled = true

  window.addEventListener('storage', (event) => {
    if (event.storageArea !== localStorage) return
    // Başka sekmede oturum bitti: bu sekme de aynı anda düşsün.
    if (event.key === SESSION_END_KEY && event.newValue) {
      if (auth.status === 'anonymous') return
      let reason: SessionEndReason = 'cikis'
      try {
        const parsed = JSON.parse(event.newValue) as { reason?: SessionEndReason }
        if (parsed.reason) reason = parsed.reason
      } catch {
        /* bozuk duyuru: sebebi bilinmiyor, yine de düş */
      }
      endSession(reason, false)
      return
    }
    // Token başka sekmede silindiyse (eski sürüm, elle temizlik) burada da düş.
    if (event.key === REFRESH_KEY && !event.newValue && auth.status === 'authenticated') {
      endSession('cikis', false)
    }
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void keepAlive()
  })
  window.addEventListener('online', () => void keepAlive())

  // Gerçek kullanım pencereyi tazeler. Ağ isteği değil, insan sayılır:
  // tek sayfada saatlerce çalışan kişi de "uğramış" olur.
  const kullanimda = () => {
    if (auth.status === 'authenticated') touchSession()
  }
  window.addEventListener('pointerdown', kullanimda, { passive: true })
  window.addEventListener('keydown', kullanimda, { passive: true })
}

/* ------------------------------------------------------------------ giriş / açılış */

const onLocalhost = () => ['localhost', '127.0.0.1', '::1'].includes(location.hostname)

/** Açılış tek uçuşludur: guard, storage olayı ve giriş formu aynı sonucu bekler. */
export function initializeAuth(): Promise<void> {
  if (!initPromise) initPromise = runInitialize()
  return initPromise
}

async function runInitialize(): Promise<void> {
  // YALNIZ yerel geliştirme: web SEO API'sine dev token'la bağlanılıyorsa Stack
  // girişi olmadan panel açılır (SEO ekranı dev token'la çalışır; backend'e
  // giden diğer ekranlar oturumsuz kalır). Prod build'de bu dal ölüdür
  // (import.meta.env.DEV derlemede false'a katlanır) ve yerelde de yalnız
  // localhost'ta açılır: dev sunucusu LAN'a açıldığında bypass yayılmasın.
  if (import.meta.env.DEV && config.webAdminDevToken && onLocalhost()) {
    devBypass = true
    auth.user = { user_id: 'dev', email: 'dev@localhost', roles: ['admin'] }
    auth.status = 'authenticated'
    return
  }

  adoptLegacySession()

  installListeners()

  if (!readRefreshToken()) {
    auth.status = 'anonymous'
    return
  }
  if (!sessionWindowOpen()) {
    // 30 gün uğranmamış: token'ı burada temizle, giriş ekranı sebebini söylesin.
    // Yönlendirmeyi router guard yapar, açılışta iki navigasyon yarıştırmayalım.
    endSession('suresi-doldu', true, false)
    return
  }

  try {
    await verifySession()
  } catch (error) {
    if (error instanceof NetworkTrouble) {
      // Oturum hakkında bir şey öğrenemedik. Token'ı SİLME, bir sonraki
      // denemede (yeniden yükleme / sekme öne gelince) tekrar dene.
      initPromise = null
      auth.status = 'anonymous'
      auth.endReason = null
      return
    }
    endSession(error instanceof AdminDenied ? 'yetki-yok' : 'suresi-doldu', true, false)
  }
}

/**
 * Her gezinmede çalışan kapı: pencere açık mı, token taze mi, yetki hâlâ
 * duruyor mu. Açılıştaki tek seferlik doğrulama yetmiyordu — oturum süresi
 * dolmuş bir sekme, sayfa değiştirdikçe "girişli" görünmeye devam ediyordu.
 */
export async function ensureSession(): Promise<void> {
  if (!initPromise) {
    await initializeAuth()
    return
  }
  await initPromise
  if (devBypass || auth.status !== 'authenticated') return

  // Guard'ın içindeyiz: yönlendirmeyi guard'ın kendi dönüşü yapar.
  if (!readRefreshToken() || !sessionWindowOpen()) {
    endSession('suresi-doldu', true, false)
    return
  }
  touchSession()

  try {
    await ensureAccessToken()
  } catch (error) {
    if (!(error instanceof NetworkTrouble)) endSession('suresi-doldu', true, false)
    return
  }

  if (Date.now() - lastVerifiedAt < REVALIDATE_INTERVAL_MS) return
  try {
    await verifySession()
  } catch (error) {
    if (error instanceof NetworkTrouble) return
    endSession(error instanceof AdminDenied ? 'yetki-yok' : 'suresi-doldu', true, false)
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

  dropStorage(SESSION_END_KEY)
  saveRefreshToken(body.refresh_token)
  touchSession(true)
  setAccessToken(body.access_token)
  initPromise = Promise.resolve()
  installListeners()

  try {
    await verifySession()
    auth.endReason = null
  } catch (error) {
    // Giriş ekranındayız: sessizce temizle, yönlendirme yapma, hatayı forma bırak.
    endSession('cikis', false, false)
    auth.endReason = null
    throw error
  }
}
