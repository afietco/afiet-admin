// Hedef listesi mobildeki src/features/push/push-target.ts ile aynı kümeyi taşır.
// Yeni ekran eklenince İKİ dosya birlikte güncellenir; mobilde karşılığı olmayan
// bir hedef gönderilirse bildirime dokunmak hiçbir şey yapmaz.

export type PushTarget =
  | 'bugun' | 'beslenme' | 'vucudum' | 'grubum'
  | 'arkadaslarim' | 'besinler' | 'menum' | 'ekle'
  | 'profil' | 'hesap' | 'bilgilerim' | 'gorunum' | 'veri'

export type PushTargetOption = { value: PushTarget; label: string }
export type PushTargetGroup = { label: string; items: PushTargetOption[] }

export const pushTargetGroups: PushTargetGroup[] = [
  {
    label: 'Sekmeler',
    items: [
      { value: 'bugun', label: 'Bugün' },
      { value: 'beslenme', label: 'Beslenme' },
      { value: 'vucudum', label: 'Vücudum' },
      { value: 'grubum', label: 'Grubum' },
    ],
  },
  {
    label: 'Diğer ekranlar',
    items: [
      { value: 'ekle', label: 'Öğün ekle' },
      { value: 'menum', label: 'Menüm' },
      { value: 'besinler', label: 'Besinler' },
      { value: 'arkadaslarim', label: 'Arkadaşlarım' },
      { value: 'profil', label: 'Profil' },
      { value: 'hesap', label: 'Hesap ayarları' },
      { value: 'bilgilerim', label: 'Bilgilerim' },
      { value: 'gorunum', label: 'Görünüm' },
      { value: 'veri', label: 'Veri' },
    ],
  },
]

const targetLabels = new Map(pushTargetGroups.flatMap((group) => group.items).map((item) => [item.value, item.label]))
export const pushTargetLabel = (value: string) => targetLabels.get(value as PushTarget) ?? value

export type PushAudience = { kind: 'all' } | { kind: 'user'; identifier: string }

export type PushBroadcastInput = {
  title: string
  body: string
  target: PushTarget
  audience: PushAudience
  /** ISO 8601; null ise hemen sıraya girer. */
  scheduledAt: string | null
  ignoreQuietHours: boolean
}

export type PushBroadcastStatus = 'scheduled' | 'sending' | 'sent' | 'cancelled'

export type PushBroadcast = {
  id: string
  title: string
  body: string
  target: PushTarget
  audience: PushAudience
  scheduledAt: string | null
  createdAt: string
  status: PushBroadcastStatus
  recipientCount: number
  deliveredCount: number
  ignoreQuietHours: boolean
}

/** Gönder'e basmadan önce kaç cihaza gideceğini gösterir. */
export type PushAudiencePreview = { recipientCount: number; deviceCount: number }

export const pushStatusLabels: Record<PushBroadcastStatus, { label: string; severity: string }> = {
  scheduled: { label: 'Zamanlandı', severity: 'info' },
  sending: { label: 'Gönderiliyor', severity: 'warn' },
  sent: { label: 'Gönderildi', severity: 'success' },
  cancelled: { label: 'İptal edildi', severity: 'secondary' },
}

export const PUSH_TITLE_MAX = 60
export const PUSH_BODY_MAX = 160
