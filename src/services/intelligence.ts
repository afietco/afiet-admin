/**
 * Zeka merkezi: ajanlar, bilgi tabanları ve tazeleme tek çatı altında.
 *
 * İKİ KAYNAK, BİLİNÇLİ AYRIM:
 *
 *  - Bu dosyadaki kayıt ARAYÜZ KOPYASIDIR: etiket, ne işe yaradığı,
 *    uygulamadaki yüzü, kota cümlesi, bilinmesi pahalı tuzaklar. Bunlar ürün
 *    bilgisi; panelde yaşamaları doğru, API'nin işi değil.
 *  - Ad, sürüm, model, effort, araç bağları ve sistem promptu Azure AI
 *    Foundry'de yaşar ve `/v1/admin/zeka/agents` ucundan CANLI okunur.
 *    Sunucu okuyamazsa alan boş kalır ve panel "okunmadı" der.
 *
 * Canlı alanlar buraya elle YAZILMAZ. Bir ajanın sürümü portalda değiştiğinde
 * panelin eski değeri güvenle göstermesi, hiç göstermemesinden daha kötü.
 */

import { authorizedFetch, signOut } from './auth'

export type AgentId =
  | 'afi-nutiriton-detector'
  | 'afi-food-vision'
  | 'afi-bilgi-sofrasi'
  | 'afi'
  | 'afi-diyetisyen'
  | 'afi-psikolog'

/** Ajanın ürüne bağlanma durumu. */
export type AgentWiring =
  /** Uygulamada canlı kullanılıyor. */
  | 'live'
  /** Bağlı ama bir ortamda doğrulanmamış / kısmi. */
  | 'partial'
  /** Foundry'de duruyor, hiçbir uca bağlı değil. */
  | 'unwired'

export type SimKind = 'food-suggest' | 'photo-chat' | 'ask' | 'chat'

export type IndexId = 'bilgi-sofrasi' | 'diyetisyen-bilgi' | 'psikolog-bilgi'

/** Panelde yaşayan ürün kopyası. Canlı hiçbir alan burada yok. */
export type AgentCopy = {
  id: AgentId
  label: string
  purpose: string
  wiring: AgentWiring
  /** Durumun tek cümlelik dürüst hâli; belirsizlik varsa burada yazar. */
  wiringNote: string
  /** Uygulamadaki yüzü: kullanıcı bu ajanı nerede görür. */
  surface: string
  /** Kota cümlesi; yoksa null. */
  quota: string | null
  /**
   * Beklenen bilgi tabanı. Canlı araç listesi okunabiliyorsa O geçerlidir;
   * bu alan yalnız okunamadığında ve beklenenle canlının ayrıştığını
   * göstermek için kullanılır.
   */
  expectedIndex: IndexId | null
  /**
   * Koddan ve karar kaydından teyitli davranış sınırları. Promptun yerine
   * geçmez; sunucunun bir kısmını çıktı üzerinde ayrıca zorladığı kurallar.
   */
  promptConstraints: string[]
  /** Ajana özgü, bilinmesi pahalı tuzaklar. */
  traps: string[]
}

/** Foundry'de tanımlı bir araç, sunucunun okuduğu hâliyle. */
export type AgentTool = {
  type: string
  index?: string
  queryType?: string
  topK?: number
}

/** `/v1/admin/zeka/agents` satırı. Boş alan "sağlayıcı vermedi" demek. */
export type AgentLive = {
  id: string
  name: string
  pinnedVersion: string
  endpoint: string
  simKind: SimKind
  configured: boolean
  error?: string
  version?: string
  model?: string
  effort?: string
  tools?: AgentTool[]
  /** Yalnız tek ajan ucunda döner. */
  instructions?: string
  raw?: unknown
}

/** Kopya + canlı verinin birleşimi; bileşenlerin gördüğü tip. */
export type AgentView = AgentCopy & {
  /** Canlı veri henüz yüklenmediyse ya da uç düştüyse null. */
  live: AgentLive | null
}

export type KbIndex = {
  id: IndexId
  /** İçeriğin geldiği yer, tek cümle. */
  source: string
  /** Kaynağın türü: senkron nasıl işliyor. */
  sync: string
  /** Bu dizine bağlı ajanlar. */
  agents: AgentId[]
  documents: number
  chunks: number
  /** Kaynağı repoda olan dizinler için dosya dökümü. */
  files: { slug: string; title: string; chunks: number; bytes: number }[] | null
  /** Dizin canlı uçtan okunuyor mu (bilgi-sofrasi) yoksa elle mi tutuluyor. */
  liveCounts: boolean
}

/**
 * Azure AI Search hizmetinin kendi sınırları (afiet-arama, free tier).
 * Bunları veren bir uç yok: Azure yönetim API'si ayrı bir kimlik ister ve
 * backend'in bugün oraya erişimi yok. Elle tutuluyor, katman değişirse
 * güncellenmeli.
 */
export const searchService = {
  name: 'afiet-arama',
  tier: 'Free',
  indexQuota: 3,
  indexUsed: 3,
  storageUsedMb: 1.3,
  storageQuotaMb: 50,
  /** Vektör boyutu; üç dizin de bilgi-sofrasi şablonundan kopyalandı. */
  dimensions: 1536,
  embedModel: 'text-embedding-3-large',
  analyzer: 'tr.microsoft',
}

const brandRules = [
  '"afiet" hep küçük harf, sen dili, yargısız ton',
  'Uzun tire (U+2014) yasak, kayıp draması yasak',
  'Hedef kilo ve süre vaadi yasak',
  'Ürün adları yayınlanmaz: ajan kendini "afiet\'in beslenme yardımcısı" diye tanıtır',
]

export const agentCopy: AgentCopy[] = [
  {
    id: 'afi-nutiriton-detector',
    label: 'Menüm doldurma',
    purpose: 'Yemeğin adından grup, ölçü ve yaklaşık makro önerir.',
    wiring: 'live',
    wiringNote: 'Üç ortamda da canlı, gerçek ajanla çalışıyor.',
    surface: 'Mobil · Besin Ekle → "Afi doldursun"',
    quota: 'Kullanıcı başına günde 30 çağrı (afi_food_suggest sayacı)',
    expectedIndex: null,
    promptConstraints: [
      'Çıktı 12 besin grubu anahtarından en fazla 3 tanesi',
      'Ölçü 8 anahtardan biri; tanınmayan ölçü sunucuda "porsiyon"a düşer',
      'Öneri her zaman DÜZENLENEBİLİR taslak; kullanıcı onaylamadan kaydedilmez',
      ...brandRules,
    ],
    traps: [
      'Ajan adındaki yazım hatası (nutiriton) KALICI: Foundry ajanı birebir adla çözer, düzeltmek yeni ajan demek.',
      'Sunucu çıktıyı süzer (sanitize): geçersiz grup atılır, makro 0-3000 kcal aralığına kırpılır.',
    ],
  },
  {
    id: 'afi-food-vision',
    label: 'Fotoğraftan tanıma',
    purpose: 'Fotoğraftaki yiyeceği çok turlu sohbetle tanır ve makro tahmini verir.',
    wiring: 'live',
    wiringNote:
      'Prod\'da canlı. Data-URL sınırı düzeltmesi 1 Ağu prod deploy\'uyla çıktı (Files API yolu).',
    surface: 'Mobil · Besin Ekle → kamera düğmesi → AfiPhotoSheet',
    quota: 'Kullanıcı başına günde 20 tur',
    expectedIndex: null,
    promptConstraints: [
      'Yanıt üç türden biri: question | result | not_food',
      'result için ad zorunlu; adsız sonuç sunucuda soruya düşürülür',
      'En fazla 4 hızlı cevap çipi, en fazla 3 ek besin',
      'İlk turdaki hint (yazılmış ad) referanstır; fotoğrafla çelişirse fotoğrafa güvenilir',
      ...brandRules,
    ],
    traps: [
      'Fotoğraf SAKLANMAZ: Files API\'ye purpose=assistants ile yüklenir, tur dönünce silinir.',
      'Data-URL yolu Azure\'un 65.520 karakter sınırında 400 verir; gerçek boyutlu her fotoğrafta patlar.',
      'Çok turlu bağlam Foundry conversation\'ında yaşar, bizim veritabanımızda değil.',
    ],
  },
  {
    id: 'afi-bilgi-sofrasi',
    label: 'Afi\'ye sor',
    purpose: 'Landing sayfasındaki ziyaretçi sorularını bilgi tabanından yanıtlar.',
    wiring: 'live',
    wiringNote: 'Prod\'da canlı, afiet.co SSS bölümünün altında.',
    surface: 'Web · afiet.co ana sayfa, SSS altındaki "Afi\'ye sor" kartı',
    quota: 'Oturum ve IP başına pencere sınırı + Turnstile',
    expectedIndex: 'bilgi-sofrasi',
    promptConstraints: [
      'Yalnız bilgi tabanındaki belgelere dayanır; bilmediğini söyler',
      'Cevap DÜZ METİN basılır: panelde markdown/HTML render edilmez (XSS yüzeyi)',
      'Alıntılar yalnız site içi yollar; model bir host uydurursa düşürülür',
      ...brandRules,
    ],
    traps: [
      'Sohbet geçmişi İSTEMCİDEN alınmaz, sunucunun kendi kaydından gelir. İstemci geçmiş verebilseydi sahte asistan turu uydurup promptu ezebilirdi.',
      'Ham Foundry akışı ajanın tam sistem promptunu taşıyan kareler içerir; hiçbir şey olduğu gibi iletilmez.',
    ],
  },
  {
    id: 'afi',
    label: 'Ana yardımcı',
    purpose: 'Uygulama içi serbest sohbet: yaklaşık kalori, denge ve uygulama rehberliği.',
    wiring: 'live',
    wiringNote: '0.10.0 ile prod\'da: POST /v1/afi/sohbet üzerinden SSE akışı (mobil sohbet ekranının varsayılan kişisi).',
    surface: 'Mobil · Bugün panosu ve menü → Afi (/sohbet)',
    quota: 'Kullanıcı başına günde 60 mesaj (üç sohbet ortak, CHAT_DAILY_LIMIT)',
    expectedIndex: null,
    promptConstraints: [
      'Sağlık teşhisi ve diyet reçetesi vermez',
      'Kalori söyler ama hedef/limit çerçevesi kurmaz ("yaklaşık 320 kcal")',
      'Konuşmanın başındaki UYGULAMA BAĞLAMI bloğunu (günün özeti) dayanak alır, teknik dille anmaz',
      ...brandRules,
    ],
    traps: [
      'Bilerek dizinsiz bırakıldı: derin literatür ihtiyacı en az bu ajanda, arama kotası 3/3 dolu.',
      'Sohbet SAKLANMAZ: geçmiş cihazdan gelir (bilinçli sapma; kimlikli kullanıcı yalnız kendi oturumunu etkiler), sunucuda transcript yok.',
      'Bağlam önde giden user mesajı olarak gider: agent_reference yanında system/developer rolü 400 verir.',
    ],
  },
  {
    id: 'afi-diyetisyen',
    label: 'Beslenme uzmanı',
    purpose: 'El ölçüsü dilinde beslenme sorularını kendi bilgi tabanından yanıtlar.',
    wiring: 'live',
    wiringNote: '0.10.0 ile prod\'da: mobil "beslenme sohbeti" kişisi, /v1/afi/sohbet üzerinden.',
    surface: 'Mobil · Beslenme → "Haftanı birlikte değerlendirelim" kartı',
    quota: 'Kullanıcı başına günde 60 mesaj (üç sohbet ortak, CHAT_DAILY_LIMIT)',
    expectedIndex: 'diyetisyen-bilgi',
    promptConstraints: [
      'Teşhis, ilaç, takviye ve kişiye özel klinik plan YOK',
      'Birincil dil el ölçüsü; gram ikincil',
      'UYGULAMA BAĞLAMI bloğu son 7 günün grup görünümünü taşır ("bakliyat 0 gün" önerinin ipucudur)',
      ...brandRules,
    ],
    traps: [
      'Talimat değişikliği yeni sürüm olarak eklenir, mevcut sürüm değiştirilmez; sürüm ortam başına CHAT_AGENT_DIYETISYEN_VERSION ile sabitlenebilir.',
      'Bilgi tabanı araması turda bir kez koşar ve medium effort ile ilk token gecikir; mobil bu yüzden akış + "bakıyor" durumu gösterir.',
    ],
  },
  {
    id: 'afi-psikolog',
    label: 'Destek sohbeti',
    purpose: 'Yemekle ilişki ve duygusal yeme üzerine yargısız destek sohbeti.',
    wiring: 'live',
    wiringNote: '0.10.0 ile prod\'da: mobil "destek sohbeti" kişisi; ilk açılışta güvenlik kapısı (terapi değildir + 112).',
    surface: 'Mobil · menü → Destek sohbeti; Beslenme\'de sessiz satır',
    quota: 'Kullanıcı başına günde 60 mesaj (üç sohbet ortak, CHAT_DAILY_LIMIT)',
    expectedIndex: 'psikolog-bilgi',
    promptConstraints: [
      'Tanı dili YOK; teşhis ve tedavi vermez',
      '5 adımlı kriz protokolü: yönlendirme 112 üzerinden',
      'Kayıp draması ve suçluluk dili yasak',
      ...brandRules,
    ],
    traps: [
      'Kriz protokolü ajanın en kritik davranışı; sürüm değiştirirken önce bu yol denenmeli.',
      'Sunucu bu sohbete HİÇBİR yemek verisi eklemez ve transcript saklamaz; kod bunu store erişiminden önce erken dönüşle garanti eder.',
    ],
  },
]

export const indexes: KbIndex[] = [
  {
    id: 'bilgi-sofrasi',
    source: 'Neon kb_documents tablosu (SSS, blog, yasal metinler, site içeriği)',
    sync: 'Tazeleme koşusu: haftalık pazartesi 04:00 UTC, panelden de elle tetiklenir',
    agents: ['afi-bilgi-sofrasi'],
    documents: 0,
    chunks: 0,
    files: null,
    liveCounts: true,
  },
  {
    id: 'diyetisyen-bilgi',
    source: 'afiet-backend/tools/uzman-bilgi/icerik/diyetisyen/*.md',
    sync: 'Elle: python3 sync.py diyetisyen (idempotent, bayat parçaları siler)',
    agents: ['afi-diyetisyen'],
    documents: 6,
    chunks: 34,
    files: [
      { slug: 'besin-gruplari', title: 'Besin grupları rehberi', chunks: 8, bytes: 4349 },
      { slug: 'mitler-ve-sinirlar', title: 'Mitler ve sınırlar', chunks: 6, bytes: 3333 },
      { slug: 'akilli-secimler', title: 'Akıllı seçimler', chunks: 5, bytes: 2867 },
      { slug: 'ogun-duzeni-doygunluk', title: 'Öğün düzeni ve doygunluk', chunks: 5, bytes: 2797 },
      { slug: 'turk-sofrasi-pratik', title: 'Türk sofrası pratiği', chunks: 5, bytes: 2741 },
      { slug: 'olcu-dili-ve-denge', title: 'Ölçü dili ve denge', chunks: 5, bytes: 2740 },
    ],
    liveCounts: false,
  },
  {
    id: 'psikolog-bilgi',
    source: 'afiet-backend/tools/uzman-bilgi/icerik/psikolog/*.md',
    sync: 'Elle: python3 sync.py psikolog (idempotent, bayat parçaları siler)',
    agents: ['afi-psikolog'],
    documents: 6,
    chunks: 30,
    files: [
      { slug: 'kucuk-beceriler', title: 'Küçük beceriler', chunks: 6, bytes: 3457 },
      { slug: 'destek-ve-guvenlik', title: 'Profesyonel destek ve güvenlik', chunks: 5, bytes: 3540 },
      { slug: 'beden-algisi-ve-sosyal', title: 'Beden algısı ve sosyal çevre', chunks: 5, bytes: 3014 },
      { slug: 'duygusal-yeme', title: 'Duygusal yeme', chunks: 5, bytes: 2983 },
      { slug: 'dusunce-oruntuleri', title: 'Düşünce örüntüleri', chunks: 5, bytes: 2934 },
      { slug: 'yemekle-iliski', title: 'Yemekle ilişki', chunks: 4, bytes: 2211 },
    ],
    liveCounts: false,
  },
]

export function copyById(id: string): AgentCopy | undefined {
  return agentCopy.find((a) => a.id === id)
}

export function indexById(id: string): KbIndex | undefined {
  return indexes.find((i) => i.id === id)
}

/** Kopya ile canlı satırları kimlik üzerinden birleştirir. */
export function mergeAgents(live: AgentLive[]): AgentView[] {
  return agentCopy.map((copy) => ({
    ...copy,
    live: live.find((l) => l.id === copy.id) ?? null,
  }))
}

/**
 * Ajanın azure_ai_search aracı. Canlı araç listesi okunabiliyorsa ONDAN gelir;
 * okunamadıysa null döner ve panel beklenen dizini ayrı bir dille gösterir.
 */
export function searchTool(live: AgentLive | null): AgentTool | null {
  return live?.tools?.find((t) => t.type === 'azure_ai_search') ?? null
}

export const wiringMeta: Record<AgentWiring, { label: string; severity: 'success' | 'warn' | 'idle' }> = {
  live: { label: 'Canlı', severity: 'success' },
  partial: { label: 'Kısmi', severity: 'warn' },
  unwired: { label: 'Bağlı değil', severity: 'idle' },
}

const EFFORT_LABELS: Record<string, string> = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
}

/** Sağlayıcı bilmediğimiz bir değer verirse ham hâli okunur, kaybolmaz. */
export function effortLabel(effort: string | undefined) {
  if (!effort) return ''
  return EFFORT_LABELS[effort.toLowerCase()] ?? effort
}

// ── API ────────────────────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await authorizedFetch(path, init)
  } catch {
    // Ham "Failed to fetch" baştan sona Türkçe bir panelde görünmemeli.
    throw new Error('Sunucuya ulaşılamadı. Bağlantını kontrol edip yeniden dene.')
  }
  if (response.status === 401) signOut()
  if (!response.ok) {
    let message = 'İşlem tamamlanamadı.'
    try {
      const body = await response.json()
      message = body?.error?.message || message
    } catch { /* boş gövde */ }
    throw new Error(message)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export const zekaApi = {
  agents: () => request<{ items: AgentLive[]; configured: boolean }>('/v1/admin/zeka/agents'),
  agent: (id: string) => request<AgentLive>(`/v1/admin/zeka/agents/${encodeURIComponent(id)}`),
}
