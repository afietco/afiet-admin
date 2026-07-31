/**
 * Zeka merkezi: ajanlar, bilgi tabanları ve tazeleme tek çatı altında.
 *
 * BU DOSYA ŞU AN MOCK'TUR. Ajan üstverisi (model, sürüm, effort, araç bağları,
 * sistem promptu) Azure AI Foundry'de yaşar; panele taşıyacak bir uç henüz yok.
 * Buradaki kayıt elle tutuluyor ve DOĞRULANMIŞ olanla BİLİNMEYEN'i ayırıyor:
 * koddan/dokümandan teyit edilen alanlar yazılı, teyit edilemeyen alanlar
 * `null` ve panelde "Foundry'den okunacak" diye görünür. Uydurulmuş bir effort
 * değeri, boş bırakılmış bir alandan daha zararlıdır.
 *
 * Backend fazında değişecek tek şey bu dosyanın gövdesidir: tipler bir
 * `/v1/admin/zeka/*` yanıtının şekli olacak biçimde yazıldı, bileşenler
 * dokunulmadan gerçek uca bağlanır.
 */

/** Panel her yerde mock olduğunu söylesin; tek bayrak, tek yerden kalkar. */
export const MOCK = true

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

/** Sürüm ne kadar sabitlenmiş: kayan sürüm sessiz davranış değişimi demek. */
export type VersionPin = 'pinned' | 'floating'

export type SimKind = 'food-suggest' | 'photo-chat' | 'ask' | 'chat'

export type IndexId = 'bilgi-sofrasi' | 'diyetisyen-bilgi' | 'psikolog-bilgi'

export type AgentIndexBinding = {
  indexId: IndexId
  /** Foundry'deki azure_ai_search aracının sorgu tipi. */
  queryType: string
  topK: number
}

export type Agent = {
  id: AgentId
  /** Foundry'deki birebir ad. Yanlış yazılırsa ajan bulunamaz. */
  name: string
  /** Panelde okunan insan adı. */
  label: string
  /** Ne işe yarar, tek cümle. */
  purpose: string
  version: string
  versionPin: VersionPin
  model: string
  /** Foundry reasoning effort. null = teyit edilmedi, Foundry'den okunacak. */
  effort: 'low' | 'medium' | 'high' | null
  wiring: AgentWiring
  /** Durumun tek cümlelik dürüst hâli; belirsizlik varsa burada yazar. */
  wiringNote: string
  /** Uygulamadaki yüzü: kullanıcı bu ajanı nerede görür. */
  surface: string
  /** Ajanı çağıran uç; bağlı değilse null. */
  endpoint: string | null
  /** Kota cümlesi; yoksa null. */
  quota: string | null
  /** Bağlı bilgi tabanı; yoksa null. */
  index: AgentIndexBinding | null
  /** Sistem promptunun tam metni. null = repoda kopya yok, Foundry'de. */
  promptText: string | null
  /**
   * Prompt hakkında koddan/karar kaydından teyitli kısıtlar. Tam metnin
   * yerine geçmez; ajanın neye zorlandığını gösterir.
   */
  promptConstraints: string[]
  simKind: SimKind
  /** Ajana özgü, bilinmesi pahalı tuzaklar. */
  traps: string[]
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

/** Azure AI Search hizmetinin kendi sınırları (afiet-arama, free tier). */
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

export const agents: Agent[] = [
  {
    id: 'afi-nutiriton-detector',
    name: 'afi-nutiriton-detector',
    label: 'Menüm doldurma',
    purpose: 'Yemeğin adından grup, ölçü ve yaklaşık makro önerir.',
    version: 'v3',
    versionPin: 'floating',
    model: 'gpt-5.4-mini',
    effort: null,
    wiring: 'live',
    wiringNote: 'Üç ortamda da canlı, gerçek ajanla çalışıyor.',
    surface: 'Mobil · Besin Ekle → "Afi doldursun"',
    endpoint: 'POST /v1/afi/food-suggest',
    quota: 'Kullanıcı başına günde 30 çağrı (afi_food_suggest sayacı)',
    index: null,
    promptText: null,
    promptConstraints: [
      'Çıktı 12 besin grubu anahtarından en fazla 3 tanesi',
      'Ölçü 8 anahtardan biri; tanınmayan ölçü sunucuda "porsiyon"a düşer',
      'Öneri her zaman DÜZENLENEBİLİR taslak; kullanıcı onaylamadan kaydedilmez',
      ...brandRules,
    ],
    simKind: 'food-suggest',
    traps: [
      'Ajan adındaki yazım hatası (nutiriton) KALICI: Foundry ajanı birebir adla çözer, düzeltmek yeni ajan demek.',
      'Sürüm sabitlenmemiş; portalda yeni sürüm yayınlanınca üç ortam birden onu kullanır.',
      'Sunucu çıktıyı süzer (sanitize): geçersiz grup atılır, makro 0-3000 kcal aralığına kırpılır.',
    ],
  },
  {
    id: 'afi-food-vision',
    name: 'afi-food-vision',
    label: 'Fotoğraftan tanıma',
    purpose: 'Fotoğraftaki yiyeceği çok turlu sohbetle tanır ve makro tahmini verir.',
    version: 'v1',
    versionPin: 'floating',
    model: 'gpt-5.4-mini',
    effort: null,
    wiring: 'partial',
    wiringNote:
      'dev ve staging\'de canlı. Data-URL sınırı düzeltmesinin prod\'a çıktığı bu panelden doğrulanmadı.',
    surface: 'Mobil · Besin Ekle → kamera düğmesi → AfiPhotoSheet',
    endpoint: 'POST /v1/afi/photo-chat',
    quota: 'Kullanıcı başına günde 20 tur',
    index: null,
    promptText: null,
    promptConstraints: [
      'Yanıt üç türden biri: question | result | not_food',
      'result için ad zorunlu; adsız sonuç sunucuda soruya düşürülür',
      'En fazla 4 hızlı cevap çipi, en fazla 3 ek besin',
      'İlk turdaki hint (yazılmış ad) referanstır; fotoğrafla çelişirse fotoğrafa güvenilir',
      ...brandRules,
    ],
    simKind: 'photo-chat',
    traps: [
      'Fotoğraf SAKLANMAZ: Files API\'ye purpose=assistants ile yüklenir, tur dönünce silinir.',
      'Data-URL yolu Azure\'un 65.520 karakter sınırında 400 verir; gerçek boyutlu her fotoğrafta patlar.',
      'Çok turlu bağlam Foundry conversation\'ında yaşar, bizim veritabanımızda değil.',
    ],
  },
  {
    id: 'afi-bilgi-sofrasi',
    name: 'afi-bilgi-sofrasi',
    label: 'Afi\'ye sor',
    purpose: 'Landing sayfasındaki ziyaretçi sorularını bilgi tabanından yanıtlar.',
    version: 'v2',
    versionPin: 'pinned',
    model: 'gpt-5.4-mini',
    effort: null,
    wiring: 'live',
    wiringNote: 'Prod\'da canlı, afiet.co SSS bölümünün altında.',
    surface: 'Web · afiet.co ana sayfa, SSS altındaki "Afi\'ye sor" kartı',
    endpoint: 'POST /public/afi/ask (SSE akışı)',
    quota: 'Oturum ve IP başına pencere sınırı + Turnstile',
    index: { indexId: 'bilgi-sofrasi', queryType: 'vector_simple_hybrid', topK: 8 },
    promptText: null,
    promptConstraints: [
      'Yalnız bilgi tabanındaki belgelere dayanır; bilmediğini söyler',
      'Cevap DÜZ METİN basılır: panelde markdown/HTML render edilmez (XSS yüzeyi)',
      'Alıntılar yalnız site içi yollar; model bir host uydurursa düşürülür',
      ...brandRules,
    ],
    simKind: 'ask',
    traps: [
      'ASK_AGENT_VERSION=2 ile sabitli: üç ortam TEK Foundry projesini paylaşıyor, sabitlenmezse yeni sürüm hepsini birden etkiler.',
      'Sohbet geçmişi İSTEMCİDEN alınmaz, sunucunun kendi kaydından gelir. İstemci geçmiş verebilseydi sahte asistan turu uydurup promptu ezebilirdi.',
      'Ham Foundry akışı ajanın tam sistem promptunu taşıyan kareler içerir; hiçbir şey olduğu gibi iletilmez.',
    ],
  },
  {
    id: 'afi',
    name: 'afi',
    label: 'Ana yardımcı',
    purpose: 'Foto tanıma, yaklaşık kalori, denge ve uygulama rehberliği için genel yardımcı.',
    version: 'v1',
    versionPin: 'floating',
    model: 'gpt-5.4-mini',
    effort: 'low',
    wiring: 'unwired',
    wiringNote: 'Foundry\'de duruyor, hiçbir uca bağlı değil.',
    surface: 'Henüz yok; planlanan uygulama içi genel yardımcı',
    endpoint: null,
    quota: null,
    index: null,
    promptText: null,
    promptConstraints: [
      'Sağlık teşhisi ve diyet reçetesi vermez',
      'Kalori söyler ama hedef/limit çerçevesi kurmaz ("yaklaşık 320 kcal")',
      ...brandRules,
    ],
    simKind: 'chat',
    traps: [
      'Bilerek dizinsiz bırakıldı: derin literatür ihtiyacı en az bu ajanda, arama kotası 3/3 dolu.',
    ],
  },
  {
    id: 'afi-diyetisyen',
    name: 'afi-diyetisyen',
    label: 'Beslenme uzmanı',
    purpose: 'El ölçüsü dilinde beslenme sorularını kendi bilgi tabanından yanıtlar.',
    version: 'v2',
    versionPin: 'floating',
    model: 'gpt-5.4-mini',
    effort: 'medium',
    wiring: 'unwired',
    wiringNote: 'Foundry\'de canlı ve bilgi tabanı bağlı, ama uygulamada bir yüzü yok.',
    surface: 'Henüz yok',
    endpoint: null,
    quota: null,
    index: { indexId: 'diyetisyen-bilgi', queryType: 'vector_simple_hybrid', topK: 8 },
    promptText: null,
    promptConstraints: [
      'Teşhis, ilaç, takviye ve kişiye özel klinik plan YOK',
      'Birincil dil el ölçüsü; gram ikincil',
      'Hedef kilo ve süre vaadi yasak',
      ...brandRules,
    ],
    simKind: 'chat',
    traps: [
      'v1\'e dokunulmadı: talimat değişikliği yeni sürüm olarak eklenir, mevcut sürüm değiştirilmez.',
    ],
  },
  {
    id: 'afi-psikolog',
    name: 'afi-psikolog',
    label: 'Destek sohbeti',
    purpose: 'Yemekle ilişki ve duygusal yeme üzerine yargısız destek sohbeti.',
    version: 'v2',
    versionPin: 'floating',
    model: 'gpt-5.4-mini',
    effort: 'medium',
    wiring: 'unwired',
    wiringNote: 'Foundry\'de canlı ve bilgi tabanı bağlı, ama uygulamada bir yüzü yok.',
    surface: 'Henüz yok',
    endpoint: null,
    quota: null,
    index: { indexId: 'psikolog-bilgi', queryType: 'vector_simple_hybrid', topK: 8 },
    promptText: null,
    promptConstraints: [
      'Tanı dili YOK; teşhis ve tedavi vermez',
      '5 adımlı kriz protokolü: yönlendirme 112 üzerinden',
      'Kayıp draması ve suçluluk dili yasak',
      ...brandRules,
    ],
    simKind: 'chat',
    traps: [
      'Kriz protokolü ajanın en kritik davranışı; sürüm değiştirirken önce bu yol denenmeli.',
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

export function agentById(id: string): Agent | undefined {
  return agents.find((a) => a.id === id)
}

export function indexById(id: IndexId): KbIndex | undefined {
  return indexes.find((i) => i.id === id)
}

export const wiringMeta: Record<AgentWiring, { label: string; severity: 'success' | 'warn' | 'idle' }> = {
  live: { label: 'Canlı', severity: 'success' },
  partial: { label: 'Kısmi', severity: 'warn' },
  unwired: { label: 'Bağlı değil', severity: 'idle' },
}

export const effortLabels: Record<'low' | 'medium' | 'high', string> = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
}

/**
 * Vektör aramanın bu sorgu için döndürdüğü parçalar. Gerçek uçta Foundry'nin
 * azure_ai_search aracı döner; burada dizinin kendi dosyalarından, sorgudaki
 * kelimelere göre kaba bir eşleşme üretiliyor ki panel boş kutu göstermesin.
 */
export type RetrievedChunk = { id: string; title: string; score: number }

export function mockRetrieval(indexId: IndexId, query: string, topK: number): RetrievedChunk[] {
  const idx = indexById(indexId)
  if (!idx?.files) return []
  const words = query.toLocaleLowerCase('tr').split(/\s+/).filter((w) => w.length > 3)

  // Arama BELGE değil PARÇA döndürür; her md dosyası birden çok parçaya
  // bölünmüştür. Dosya başına tek satır üretmek top_k 8'i altı dosyalık bir
  // dizinde hiç doldurmaz ve panelde "top_k 8" yazıp 6 satır göstermek,
  // aramanın nasıl çalıştığı hakkında yanlış fikir verirdi.
  const chunks: RetrievedChunk[] = []
  idx.files.forEach((f, fileIndex) => {
    const hay = `${f.title} ${f.slug}`.toLocaleLowerCase('tr')
    const hits = words.filter((w) => hay.includes(w.slice(0, 5))).length
    for (let c = 1; c <= f.chunks; c += 1) {
      chunks.push({
        id: `${f.slug}-${String(c).padStart(2, '0')}`,
        title: f.title,
        // Aynı dosyanın parçaları birbirine yakın skorlanır, sonrakiler biraz
        // düşer: hibrit aramanın tipik dağılımı.
        score: 0.44 + hits * 0.16 - fileIndex * 0.02 - (c - 1) * 0.012,
      })
    }
  })
  return chunks.sort((a, b) => b.score - a.score).slice(0, topK)
}
