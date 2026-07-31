/**
 * Zeka merkezi simülasyonlarının MOCK motoru.
 *
 * Tipler uygulamanın gerçek sözleşmeleriyle birebirdir (internal/afi/afi.go,
 * internal/afi/vision.go, internal/afi/ask.go). Gerçek uca bağlanınca bu
 * dosyadaki üreteçler yerini fetch'e bırakır, bileşenler değişmez.
 *
 * Mock kasten "fazla iyi" değil: gecikme taklit edilir, kota tükenir, sohbet
 * ilk turda sonuca atlamaz. Kusursuz cevap veren bir simülasyon, ekranın
 * gerçekte nasıl davrandığı hakkında yanlış fikir verirdi.
 */

import type { AgentId } from './intelligence'

export type Macros = { kcal: number; protein: number; carb: number; fat: number }

export type FoodSuggestion = {
  groups: string[]
  measure: string
  macros: Macros
  description: string
}

export type PhotoFood = FoodSuggestion & { name: string; inPool: boolean }

export type PhotoReply = {
  kind: 'question' | 'result' | 'not_food'
  text: string
  quickReplies: string[]
  needsPhoto: boolean
  food?: PhotoFood
  extraFoods: PhotoFood[]
}

export type AskSource = { title: string; url: string }

/** Bir simülasyon turunun ölçülen tarafı; panel bunu ham kutuda gösterir. */
export type SimTrace = {
  agent: string
  version: string
  endpoint: string
  request: unknown
  response: unknown
  latencyMs: number
  /** Bilgi tabanı bağlıysa çekilen parça kimlikleri. */
  retrieved?: string[]
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 600-1400 ms arası, gerçek ajan turlarının kabaca aralığı. */
function latency(seed: string) {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) % 800
  return 600 + h
}

// ── Menüm doldurma (afi-nutiriton-detector) ────────────────────────────────

type SeedFood = { match: string[]; s: FoodSuggestion }

const foodSeeds: SeedFood[] = [
  {
    match: ['mercimek', 'çorba', 'corba'],
    s: {
      groups: ['bakliyat', 'sebze'],
      measure: 'kase',
      macros: { kcal: 180, protein: 9, carb: 26, fat: 4 },
      description: 'Yaklaşık bir kase için. Yanına ekmek gelirse tahıl da eklenir.',
    },
  },
  {
    match: ['menemen', 'yumurta'],
    s: {
      groups: ['protein', 'sebze', 'yag'],
      measure: 'porsiyon',
      macros: { kcal: 240, protein: 14, carb: 8, fat: 17 },
      description: 'İki yumurtalı, yaklaşık bir tava payı.',
    },
  },
  {
    match: ['pilav', 'bulgur'],
    s: {
      groups: ['tahil'],
      measure: 'kase',
      macros: { kcal: 210, protein: 5, carb: 42, fat: 3 },
      description: 'Yaklaşık bir kase, tereyağlı pişirimde biraz daha yağlı olur.',
    },
  },
  {
    match: ['lahmacun', 'pide'],
    s: {
      groups: ['hamurisi', 'protein'],
      measure: 'adet',
      macros: { kcal: 300, protein: 13, carb: 38, fat: 10 },
      description: 'Bir adet, orta boy. Limon ve yeşillik yanında sebze sayılır.',
    },
  },
  {
    match: ['yoğurt', 'yogurt', 'ayran'],
    s: {
      groups: ['sut'],
      measure: 'kase',
      macros: { kcal: 120, protein: 9, carb: 11, fat: 4 },
      description: 'Yaklaşık bir kase, tam yağlı.',
    },
  },
  {
    match: ['salata', 'çoban', 'coban'],
    s: {
      groups: ['sebze', 'yag'],
      measure: 'kase',
      macros: { kcal: 90, protein: 2, carb: 9, fat: 6 },
      description: 'Zeytinyağlı, yaklaşık bir kase.',
    },
  },
  {
    match: ['baklava', 'tatlı', 'tatli'],
    s: {
      groups: ['tatli', 'kuruyemis'],
      measure: 'dilim',
      macros: { kcal: 330, protein: 5, carb: 40, fat: 17 },
      description: 'Bir dilim, fıstıklı. Şerbetli tatlılarda porsiyon küçük tutulur.',
    },
  },
]

const fallbackFood: FoodSuggestion = {
  groups: ['protein', 'tahil'],
  measure: 'porsiyon',
  macros: { kcal: 260, protein: 12, carb: 30, fat: 9 },
  description: 'Yaklaşık bir porsiyon. Bu bir tahmin, istersen değerleri değiştir.',
}

export async function simFoodSuggest(name: string, hint: string): Promise<{ suggestion: FoodSuggestion; trace: SimTrace }> {
  const ms = latency(name)
  await wait(ms)
  const key = name.toLocaleLowerCase('tr')
  const seed = foodSeeds.find((f) => f.match.some((m) => key.includes(m)))
  const suggestion = seed ? { ...seed.s, macros: { ...seed.s.macros } } : { ...fallbackFood }
  if (hint.trim()) {
    suggestion.description = `${suggestion.description} Notunu dikkate aldım: "${hint.trim()}".`
  }
  return {
    suggestion,
    trace: {
      agent: 'afi-nutiriton-detector',
      version: 'v3',
      endpoint: 'POST /v1/afi/food-suggest',
      request: { name, description: hint || undefined },
      response: suggestion,
      latencyMs: ms,
    },
  }
}

// ── Fotoğraftan tanıma (afi-food-vision) ───────────────────────────────────

/**
 * Sohbet süreç odaklıdır: ajan ilk turda çoğu zaman soru sorar, sonuca ikinci
 * turda varır. Simülasyon bu ritmi korur, yoksa ekranın soru durumu hiç
 * görülmezdi.
 */
export async function simPhotoTurn(input: {
  turnIndex: number
  text: string
  hasImage: boolean
  hint: string
}): Promise<{ reply: PhotoReply; trace: SimTrace }> {
  const ms = latency(`${input.turnIndex}${input.text}`)
  await wait(ms)

  let reply: PhotoReply
  if (!input.hasImage && input.turnIndex === 0) {
    reply = {
      kind: 'question',
      text: 'Bir fotoğraf göndersen tanımaya çalışayım.',
      quickReplies: [],
      needsPhoto: true,
      extraFoods: [],
    }
  } else if (input.turnIndex === 0) {
    reply = {
      kind: 'question',
      text: input.hint.trim()
        ? `"${input.hint.trim()}" gibi duruyor. Porsiyonu tarif eder misin?`
        : 'Tabakta ızgara tavuk ve bulgur pilavı görüyorum. Porsiyon ne kadardı?',
      quickReplies: ['Küçük bir tabak', 'Normal porsiyon', 'Büyük porsiyon'],
      needsPhoto: false,
      extraFoods: [],
    }
  } else {
    reply = {
      kind: 'result',
      text: 'Tamamdır, yaklaşık değerler şöyle. İstediğin alanı değiştirebilirsin.',
      quickReplies: [],
      needsPhoto: false,
      food: {
        name: 'Izgara tavuk',
        groups: ['protein'],
        measure: 'porsiyon',
        macros: { kcal: 220, protein: 34, carb: 0, fat: 9 },
        description: 'Yaklaşık bir avuç içi büyüklüğünde, derisiz.',
        inPool: true,
      },
      extraFoods: [
        {
          name: 'Bulgur pilavı',
          groups: ['tahil'],
          measure: 'kase',
          macros: { kcal: 190, protein: 5, carb: 38, fat: 3 },
          description: 'Karede tavuğun yanında görünüyor.',
          inPool: true,
        },
        {
          name: 'Çoban salata',
          groups: ['sebze', 'yag'],
          measure: 'kase',
          macros: { kcal: 90, protein: 2, carb: 9, fat: 6 },
          description: 'Küçük bir kase kadar.',
          inPool: false,
        },
      ],
    }
  }

  return {
    reply,
    trace: {
      agent: 'afi-food-vision',
      version: 'v1',
      endpoint: 'POST /v1/afi/photo-chat',
      request: {
        conversationId: input.turnIndex === 0 ? null : 'conv_mock_8f31',
        text: input.text || undefined,
        // Gerçek istekte burada file_id var: fotoğraf Files API'ye yüklenir,
        // tur dönünce silinir. Data-URL yolu 65.520 karakterde patlıyordu.
        fileId: input.hasImage ? 'assistant-file_mock_a71c' : undefined,
        hint: input.turnIndex === 0 && input.hint ? input.hint : undefined,
      },
      response: reply,
      latencyMs: ms,
    },
  }
}

// ── Afi'ye sor (afi-bilgi-sofrasi) ─────────────────────────────────────────

type AskSeed = { match: string[]; answer: string; sources: AskSource[] }

const askSeeds: AskSeed[] = [
  {
    match: ['kalori', 'sayma', 'saymak'],
    answer:
      'afiet kalori saydırmaz. Tabağını beş grup üzerinden dengelemeni ister: sebze, meyve, protein, tahıl ve süt.\n\nKalori merak edersen yaklaşık değeri gösterir ama bir hedef ya da limit kurmaz. Ölçü dili el ölçüsüdür: bir avuç, bir kase, bir dilim.',
    sources: [
      { title: 'afiet nasıl çalışır', url: '/#nasil-calisir' },
      { title: 'Porsiyon ölçüleri: el ölçüsü', url: '/blog/porsiyon-olculeri-el-olcusu' },
    ],
  },
  {
    match: ['ücret', 'ucret', 'fiyat', 'para', 'abone'],
    answer:
      'Şu an beta dönemindeyiz ve katılım ücretsiz. Fiyatlandırma netleştiğinde beta katılımcılarına önce haber vereceğiz.',
    sources: [{ title: 'Beta', url: '/beta' }],
  },
  {
    match: ['veri', 'gizlilik', 'kvkk', 'sil'],
    answer:
      'Verilerini istediğin an silebilirsin: uygulamada Hesabım altından hesap silme tek adımdır ve kayıtların da birlikte gider.\n\nÖlçümlerin ve öğün kayıtların üçüncü taraflara satılmaz.',
    sources: [
      { title: 'Gizlilik', url: '/gizlilik' },
      { title: 'Hesap silme', url: '/hesap-sil' },
    ],
  },
  {
    match: ['android', 'ios', 'iphone', 'indir', 'uygulama'],
    answer:
      'iOS tarafında TestFlight üzerinden beta davetleri gidiyor. Android tarafı için mağaza hazırlığı sürüyor; beta formunu doldurursan sıraya girersin.',
    sources: [{ title: 'Beta', url: '/beta' }],
  },
]

/**
 * Cevabı parça parça yayınlar (gerçek uç SSE akışı). emit her parçada çağrılır;
 * false dönerse akış kesilir (ziyaretçi vazgeçti).
 */
export async function simAskStream(
  question: string,
  emit: (chunk: string) => boolean,
): Promise<{ sources: AskSource[]; trace: SimTrace }> {
  const key = question.toLocaleLowerCase('tr')
  const seed = askSeeds.find((s) => s.match.some((m) => key.includes(m)))
  const answer =
    seed?.answer ??
    'Bunu bilgi tabanımda bulamadım. Sorunu biraz daha açarsan ya da beta formundan yazarsan ekip doğrudan cevaplar.'
  const sources = seed?.sources ?? []

  const started = performance.now()
  await wait(320)
  // Kelime kelime akıt: panelin akış davranışı gerçeğe benzesin.
  const words = answer.split(/(\s+)/)
  for (const w of words) {
    if (!emit(w)) break
    await wait(w.trim() ? 22 : 8)
  }

  return {
    sources,
    trace: {
      agent: 'afi-bilgi-sofrasi',
      version: 'v2',
      endpoint: 'POST /public/afi/ask',
      request: { question, history: '[sunucunun kendi kaydından]' },
      response: { answer, sources },
      latencyMs: Math.round(performance.now() - started),
      retrieved: ['sss-12', 'nasil-calisir-03', 'blog-porsiyon-05'],
    },
  }
}

// ── Sohbet ajanları (afi, afi-diyetisyen, afi-psikolog) ────────────────────

const chatSeeds: Record<string, { match: string[]; answer: string }[]> = {
  afi: [
    {
      match: ['akşam', 'aksam', 'ne pişir', 'ne pisir', 'ne yesem'],
      answer:
        'Bugün tabağında sebze az kalmış. Akşama fırında sebze ve yanına bir avuç kadar protein iyi gider. Canın hamur işi çekiyorsa onu da ekle, gün toplamda dengelenir.',
    },
    {
      match: ['nasıl', 'nasil', 'kullan', 'başla', 'basla'],
      answer:
        'Bugün ekranından öğünlerini işaretliyorsun. Beş grubu doldurduğun gün "afiyet günü" oluyor. Sayı tutmuyoruz, sadece tabağın dengesine bakıyoruz.',
    },
  ],
  'afi-diyetisyen': [
    {
      match: ['protein', 'ne kadar'],
      answer:
        'Ana öğünlerde avuç içi kadar bir protein iyi bir başlangıç. Etin, tavuğun, balığın ya da bakliyatın olması fark etmez.\n\nGün içinde iki üç öğüne yayıldığında doygunluk daha dengeli oluyor.',
    },
    {
      match: ['karbonhidrat', 'ekmek', 'pilav', 'kilo'],
      answer:
        'Karbonhidrat kesilmesi gereken bir şey değil. Yumruk kadar bir tahıl porsiyonu çoğu öğün için yeterli oluyor.\n\nYanına lif ve protein geldiğinde kan şekeri daha yumuşak seyrediyor, acıkma da geç geliyor.',
    },
  ],
  'afi-psikolog': [
    {
      match: ['stres', 'üzgün', 'uzgun', 'canım sıkkın', 'canim sikkin', 'duygusal'],
      answer:
        'Zor bir gün geçirmişsin gibi duruyor. Canı sıkkınken yemeğe yönelmek çok yaygın bir şey ve bunda utanılacak bir taraf yok.\n\nŞu an bedeninde ne hissettiğini fark edebilir misin? Bazen sadece adını koymak bile şiddetini azaltıyor.',
    },
    {
      match: ['suçlu', 'suclu', 'pişman', 'pisman', 'kaçamak', 'kacamak'],
      answer:
        'Bir öğün günün tamamını belirlemiyor. Suçluluk genelde bir sonraki öğünü de zorlaştırıyor, o yüzden onu bir kenara bırakmayı deneyelim.\n\nBugün kendine iyi gelen küçük bir şey oldu mu?',
    },
  ],
}

const chatFallback: Record<string, string> = {
  afi: 'Bunu tam çözemedim ama yardımcı olmak isterim. Biraz daha anlatır mısın?',
  'afi-diyetisyen':
    'Bunu bilgi tabanımda net bulamadım. Kişiye özel bir plan gerekiyorsa bir diyetisyenle konuşmak en doğrusu olur.',
  'afi-psikolog':
    'Seni dinliyorum. Biraz daha anlatmak ister misin? Zorlandığın bir konuysa bir uzmanla konuşmak da iyi gelebilir.',
}

export async function simChat(
  agentId: AgentId,
  message: string,
): Promise<{ answer: string; trace: SimTrace }> {
  const ms = latency(message)
  await wait(ms)
  const key = message.toLocaleLowerCase('tr')
  const seeds = chatSeeds[agentId] ?? []
  const hit = seeds.find((s) => s.match.some((m) => key.includes(m)))
  const answer = hit?.answer ?? chatFallback[agentId] ?? 'Bunu şu an cevaplayamıyorum.'
  return {
    answer,
    trace: {
      agent: agentId,
      version: agentId === 'afi' ? 'v1' : 'v2',
      // Bu ajanların bir ucu yok; gerçek çağrı Foundry Responses API'ye
      // agent_reference ile gider, arada bizim uç bulunmaz.
      endpoint: 'POST {FOUNDRY_PROJECT_URL}/openai/v1/responses',
      request: { agent_reference: agentId, input: message },
      response: { output_text: answer },
      latencyMs: ms,
    },
  }
}

/** Kriz protokolü, psikolog ajanının en kritik yolu; ayrı tetiklenebilmeli. */
export const crisisProbe = 'Kendime zarar vermeyi düşünüyorum'

export const crisisAnswer =
  'Bunu paylaştığın için teşekkür ederim, yalnız değilsin.\n\nŞu an güvende olman en önemlisi. Türkiye\'de 112 Acil Çağrı Merkezi\'ni arayabilirsin, günün her saati ulaşılabilir.\n\nYanında olabilecek birine, bir yakınına ya da bir sağlık çalışanına haber vermek de iyi gelir. Ben buradayım ama bu konuda sana bir uzmanın yardımı gerekiyor.'
