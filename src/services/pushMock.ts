// GEÇİCİ: Aktif bildirimler sekmesinin UI aşaması için sahte veri.
//
// Backend'de /v1/admin/push/overview ve /v1/admin/push/triggers uçları HENÜZ
// YOK. Uçlar açıldığında AktifTab.vue'daki USE_MOCK false'a çekilir ve BU DOSYA
// SİLİNİR. Sayılar gerçekçi olsun diye uydurulmuştur, hiçbir yerden gelmez.

import type { PushBroadcast, PushGlobalPatch, PushOverview, PushTrigger, PushTriggerPatch } from './push'

const scheduled: PushBroadcast[] = [
  {
    id: 'mock-b1',
    title: 'Yeni besinler eklendi 🥗',
    body: 'Kataloğa 500 bölgesel yemek girdi. Menünde arayıp bulabilirsin.',
    target: 'besinler',
    audience: { kind: 'all' },
    scheduledAt: new Date(Date.now() + 36e5 * 20).toISOString(),
    createdAt: new Date(Date.now() - 36e5 * 3).toISOString(),
    status: 'scheduled',
    recipientCount: 1284,
    deliveredCount: 0,
    ignoreQuietHours: false,
  },
  {
    id: 'mock-b2',
    title: 'Hafta sonu sofran nasıl geçti?',
    body: 'Pazartesi ritmine başlamadan önce geçen haftayı bir gözden geçir.',
    target: 'bugun',
    audience: { kind: 'all' },
    scheduledAt: new Date(Date.now() + 36e5 * 74).toISOString(),
    createdAt: new Date(Date.now() - 36e5 * 26).toISOString(),
    status: 'scheduled',
    recipientCount: 1284,
    deliveredCount: 0,
    ignoreQuietHours: false,
  },
]

const triggers: PushTrigger[] = [
  {
    kind: 'meal_reminder',
    enabled: true,
    title: 'Bugün’den küçük bir not 🌿',
    body: 'Henüz bir öğün eklemedin. Hatırladığın tek bir şeyi yazman yeter.',
    target: 'meal',
    time: '19:30',
    weekday: null,
    preferenceKey: 'mealReminderEnabled',
    optedIn: 1102,
    sent7d: 2841,
    delivered7d: 2698,
    failed7d: 143,
    updatedAt: null,
    updatedBy: '',
  },
  {
    kind: 'week_closure',
    enabled: true,
    title: 'Bir afiyet haftası kazandın 🎉',
    body: 'Geçen hafta afiyet günlerini biriktirdin. Afi kutlamayı hazırladı.',
    target: 'week_closure',
    time: '09:00',
    weekday: 1,
    preferenceKey: 'weekClosureEnabled',
    optedIn: 1204,
    sent7d: 316,
    delivered7d: 309,
    failed7d: 7,
    updatedAt: null,
    updatedBy: '',
  },
  {
    kind: 'greeting',
    enabled: true,
    title: 'Sofrandan selam var 🧡',
    body: '',
    target: 'notifications',
    time: null,
    weekday: null,
    preferenceKey: 'socialEnabled',
    optedIn: 1188,
    sent7d: 487,
    delivered7d: 471,
    failed7d: 16,
    updatedAt: null,
    updatedBy: '',
  },
  {
    kind: 'friend_request',
    enabled: true,
    title: 'Yeni bir arkadaşlık isteği 🤝',
    body: '',
    target: 'friend_requests',
    time: null,
    weekday: null,
    preferenceKey: 'socialEnabled',
    optedIn: 1188,
    sent7d: 132,
    delivered7d: 128,
    failed7d: 4,
    updatedAt: null,
    updatedBy: '',
  },
  {
    kind: 'friend_accepted',
    enabled: true,
    title: 'Afiyet arkadaşlığınız başladı 🎉',
    body: '',
    target: 'friends',
    time: null,
    weekday: null,
    preferenceKey: 'socialEnabled',
    optedIn: 1188,
    sent7d: 96,
    delivered7d: 94,
    failed7d: 2,
    updatedAt: null,
    updatedBy: '',
  },
  {
    kind: 'admin_broadcast',
    enabled: true,
    title: 'Her gönderimde ayrı yazılır',
    body: '',
    target: 'bugun',
    time: null,
    weekday: null,
    preferenceKey: 'announcementsEnabled',
    optedIn: 1246,
    sent7d: 1284,
    delivered7d: 1219,
    failed7d: 65,
    updatedAt: null,
    updatedBy: '',
  },
]

const state: PushOverview = {
  masterEnabled: true,
  envEnabled: false,
  quietStart: '22:00',
  quietEnd: '09:00',
  users: { total: 2058, permitted: 1284 },
  devices: { ios: 890, android: 520, disabled7d: 34 },
  delivery7d: { sent: 5156, delivered: 4919, failed: 237 },
  triggers,
  scheduled,
}

const delay = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 260))

const clone = (): PushOverview => JSON.parse(JSON.stringify(state))

export const pushMock = {
  overview: () => delay(clone()),
  updateTrigger: (kind: string, patch: PushTriggerPatch) => {
    const trigger = state.triggers.find((item) => item.kind === kind)
    if (!trigger) throw new Error('tetikleyici bulunamadı')
    Object.assign(trigger, patch, {
      updatedAt: new Date().toISOString(),
      updatedBy: 'berk@afiet.co',
    })
    return delay(JSON.parse(JSON.stringify(trigger)) as PushTrigger)
  },
  updateGlobals: (patch: PushGlobalPatch) => {
    Object.assign(state, patch)
    return delay(clone())
  },
  cancelScheduled: (id: string) => {
    state.scheduled = state.scheduled.filter((item) => item.id !== id)
    return delay(undefined)
  },
}
