import { webRequest } from './webApi'
import type { Channel } from './content'

/**
 * Bağlı sosyal hesaplar + otomatik ölçüm sözleşmesi.
 *
 * afiet-web'in `server/utils/socialTypes.ts` dosyasının BİREBİR aynasıdır.
 * Faz 2 kapsamı Instagram; diğer platformlar aynı tablolara oturacak.
 */

export type AccountStatus = 'bagli' | 'suresi_doluyor' | 'kopuk'

export type SocialAccount = {
  id: number
  platform: Channel
  handle: string
  externalId: string
  status: AccountStatus
  expiresAt: string | null
  lastSyncAt: string | null
  lastResult: string
  createdAt: string
}

export type SocialPost = {
  id: number
  platform: Channel
  externalId: string
  permalink: string
  publishedAt: string | null
  mediaType: string
  caption: string
  thumbnailUrl: string | null
  itemId: number | null
  createdAt: string
}

export type AdminSocialPayload = {
  dbConnected: boolean
  live: boolean
  /** Meta uygulama kimlikleri tanımlı mı; değilse bağlama akışı kapalı. */
  instagramReady: boolean
  /** Meta'ya kayıtlı redirect_uri - bağlama yalnız o adreste çalışır. */
  connectHost: string
  accounts: SocialAccount[]
  unmatched: SocialPost[]
}

export const emptySocialPayload = (): AdminSocialPayload => ({
  dbConnected: false, live: false, instagramReady: false, connectHost: '', accounts: [], unmatched: [],
})

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, { label: string; severity: 'success' | 'warn' | 'danger' }> = {
  bagli: { label: 'Bağlı', severity: 'success' },
  suresi_doluyor: { label: 'Süresi doluyor', severity: 'warn' },
  kopuk: { label: 'Kopuk', severity: 'danger' },
}

export const socialApi = {
  get: () => webRequest<AdminSocialPayload>('/api/admin/social'),
  /** Instagram izin ekranının adresi (panel yeni sekmede açar). */
  instagramStart: () => webRequest<{ url: string; redirectUri: string }>('/api/admin/social/instagram-start'),
  link: (postId: number, itemId: number | null) =>
    webRequest<AdminSocialPayload>('/api/admin/social/link', {
      method: 'PUT',
      body: JSON.stringify({ postId, itemId }),
    }),
  disconnect: (id: number) =>
    webRequest<AdminSocialPayload>(`/api/admin/social/disconnect?id=${id}`, { method: 'DELETE' }),
}
