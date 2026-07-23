import { webRequest } from './webApi'

/**
 * Beta başvuruları veri sözleşmesi. Veri afiet-web'in (Nuxt/Nitro + Neon)
 * `GET /api/admin/beta` ucundan canlı gelir; toplama landing'deki çok adımlı
 * form (`POST /api/beta/apply`) ile yapılır. Tipler web tarafındaki
 * `server/utils/betaStore.ts` ile BİREBİR aynıdır — alan eklerken iki ucu birlikte
 * güncelle. Etiket haritaları web `app/data/content.ts > betaForm` ile senkron.
 */

export type Tally = { key: string; count: number }

export type BetaApplication = {
  id: number
  email: string
  platform: string
  goals: string[]
  countingFeeling: string
  appsNutrition: string[]
  appsActivity: string[]
  appsBody: string[]
  appsOther: string
  contactChannel: string
  heardFrom: string
  consent: boolean
  consentAt: string | null
  createdAt: string
  updatedAt: string
}

export type BetaAdminPayload = {
  dbConnected: boolean
  total: number
  sampled: number
  summary: {
    platform: Tally[]
    consented: number
    last7d: number
    goals: Tally[]
    counting: Tally[]
    apps: { nutrition: Tally[]; activity: Tally[]; body: Tally[] }
    contact: Tally[]
    heard: Tally[]
  }
  items: BetaApplication[]
}

export const betaApi = {
  get: () => webRequest<BetaAdminPayload>('/api/admin/beta'),
}

// --- Kod → Türkçe etiket (form seçenekleriyle senkron) ---
const PLATFORM: Record<string, string> = { ios: 'iPhone', android: 'Android', unknown: 'Belirtmedi' }
const GOALS: Record<string, string> = {
  enerji: 'Daha çok enerji',
  huzur: 'Yemekle huzurlu ilişki',
  cesitlilik: 'Daha çeşitli beslenme',
  ritim: 'Düzenli bir ritim',
  sofra: 'Sevdikleriyle sofra',
  'oz-bakim': 'Kendine iyi bakmak',
}
const COUNTING: Record<string, string> = {
  yoruyor: 'Kullanıyor ama yoruyor',
  biraktim: 'Bıraktı, bunaltıcıydı',
  'iyi-geldi': 'İşe yaradı',
  hic: 'Hiç kullanmadı',
}
const APPS: Record<string, string> = {
  fatsecret: 'FatSecret',
  yazio: 'Yazio',
  myfitnesspal: 'MyFitnessPal',
  diyetkolik: 'Diyetkolik',
  lifesum: 'Lifesum',
  diyetisyen: 'Diyetisyen uygulaması',
  'samsung-health': 'Samsung Health',
  'google-fit': 'Google Fit',
  'apple-fitness': 'Apple Fitness / Sağlık',
  strava: 'Strava',
  'huawei-health': 'Huawei Health',
  'nike-run': 'Nike Run Club',
  'adidas-running': 'adidas Running',
  adimsayar: 'Adımsayar',
  'apple-health': 'Apple Health',
  'xiaomi-scale': 'Xiaomi akıllı tartı',
  'apple-watch': 'Apple Watch',
  'xiaomi-band': 'Xiaomi / Amazfit bileklik',
  'huawei-wear': 'Huawei saat / bileklik',
  'galaxy-watch': 'Samsung Galaxy Watch',
  garmin: 'Garmin',
  fitbit: 'Fitbit',
  hicbiri: 'Hiçbiri',
}
const CONTACT: Record<string, string> = { eposta: 'E-posta', bildirim: 'Uygulama bildirimi' }
const HEARD: Record<string, string> = {
  instagram: 'Instagram',
  arkadas: 'Bir arkadaşı',
  x: 'X (Twitter)',
  google: 'Google araması',
  tiktok: 'TikTok',
  baska: 'Başka',
}

const from = (map: Record<string, string>) => (key: string) => map[key] ?? (key || '—')
export const label = {
  platform: from(PLATFORM),
  goal: from(GOALS),
  counting: from(COUNTING),
  app: from(APPS),
  contact: from(CONTACT),
  heard: from(HEARD),
}
