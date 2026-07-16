import type { Channel, ContentBrief, ContentItemInput, ContentStatus } from '../../services/content'
import { slugify } from '../../services/content'

/**
 * Prompt şablonları — panelin "prompt-ready" çekirdeği.
 *
 * İki tür prompt üretilir:
 *  - PLANLAMA: Claude sohbetine yapıştırılır; fikir, panele geri içe
 *    aktarılabilecek TEK bir json bloğuna (brief) dönüşür.
 *  - ÜRETİM: blog için Claude Code'a (afiet-web reposu) yapıştırılır; yazıyı
 *    yazar ve `scripts/publish-post.mjs` ile yayınlar (Faz C'de gelir).
 *    Instagram/X için içerik metnini sohbette üretir.
 *
 * Şablon değişikliklerinde sürümü artır — üretilen içerikte iz bırakır.
 */
export const PROMPT_VERSION = 1

/** "Claude çıktısını içe aktar" kutusunun beklediği json şekli. */
export type PlanImport = {
  title?: string
  slug?: string
  plannedDate?: string | null
  brief?: Partial<ContentBrief>
}

type PromptItem = ContentItemInput & { id?: number }

const CHANNEL_NAMES: Record<Channel, string> = { blog: 'blog', instagram: 'Instagram', x: 'X (Twitter)' }

const BRAND_BLOCK = `## afiet hakkında
- afiet: kalori saymak yerine besin gruplarıyla ve doğal ölçülerle (dilim, kase, avuç…) denge kuran, sıcak ve yargısız bir beslenme uygulaması. Tagline: "Sayma, dengele."
- Marka adı HER YERDE küçük harf yazılır: "afiet" (cümle başında bile).
- Ton: sofrada seni seven biri — sen dili, nazik, cesaretlendirici. Suçluluk, diyet baskısı, kalori takıntısı, "yasak yiyecek" dili KULLANILMAZ.
- Web: https://afiet.co · Uygulama TestFlight betasında.`

const line = (label: string, value: string) => (value.trim() ? `- ${label}: ${value.trim()}` : `- ${label}: (boş — sen öner)`)
const list = (label: string, values: string[]) =>
  values.length ? `- ${label}:\n${values.map((v) => `  - ${v}`).join('\n')}` : `- ${label}: (boş — sen öner)`

function briefBlock(item: PromptItem): string {
  const b = item.brief
  return [
    `- Kanal: ${CHANNEL_NAMES[item.channel]}`,
    line('Başlık (taslak)', item.title),
    ...(item.channel === 'blog' ? [line('Slug', item.slug ?? '')] : []),
    line('Hedef kitle', b.audience),
    line('Açı', b.angle),
    line('Ton notu', b.tone),
    list('Anahtar kelimeler', b.keywords),
    list('Outline', b.outline),
    list('İç bağlantılar (afiet.co yolları)', b.internalLinks),
    line('CTA', b.cta),
    list('Kaynaklar', b.sources),
    line('Notlar', b.notes),
  ].join('\n')
}

// ── PLANLAMA ─────────────────────────────────────────────────────────────────
export function buildPlanningPrompt(item: PromptItem): string {
  const suggestedSlug = item.slug || slugify(item.title) || 'ornek-slug'
  return `<!-- afiet içerik promptu v${PROMPT_VERSION} · planlama · ${item.channel} -->
afiet için bir ${CHANNEL_NAMES[item.channel]} içeriği planlıyoruz. Görevin: aşağıdaki fikri, yönetim paneline içe aktarılacak detaylı bir içerik brief'ine dönüştürmek.

${BRAND_BLOCK}

## Fikir (mevcut hali)
${briefBlock(item)}

## Senden istenen
1. Fikri kısaca değerlendir: açı önerin, hedef kitle netleştirmesi, varsa riskler (2–5 cümle).
2. Ardından TEK bir \`\`\`json kod bloğu ver — panele "Claude çıktısını içe aktar" ile yapıştırılacak. Şema:

\`\`\`json
{
  "title": "nihai başlık önerisi",
  "slug": "${suggestedSlug}",
  "plannedDate": null,
  "brief": {
    "keywords": ["3-8 anahtar kelime, arama niyetine göre"],
    "audience": "hedef kitle, tek cümle",
    "angle": "içeriğin açısı/tezi, 1-2 cümle",
    "tone": "ton notu",
    "outline": ["${item.channel === 'blog' ? 'H2/H3 taslağı, 5-9 madde — son madde: Sık sorulanlar' : 'bölüm bölüm akış (hook → gövde → kapanış)'}"],
    "internalLinks": ["/", "/blog gibi afiet.co yolları"],
    "cta": "tek, nazik bir çağrı",
    "sources": ["iddiaları destekleyecek güvenilir kaynak URL'leri"],
    "notes": "üretimde dikkat edilecekler"
  }
}
\`\`\`

Kurallar: her şey Türkçe; SEO'da anahtar kelime doldurma yok, arama niyetine odaklan; ${item.channel === 'blog' ? 'slug küçük harf-ve-tire, Türkçe karaktersiz' : '"slug" alanını boş string yap (bu kanalda kullanılmıyor)'}; json dışında ikinci bir kod bloğu verme.`
}

// ── ÜRETİM ───────────────────────────────────────────────────────────────────
export function buildProductionPrompt(item: PromptItem): string {
  if (item.channel === 'blog') return blogProductionPrompt(item)
  return socialProductionPrompt(item)
}

function blogProductionPrompt(item: PromptItem): string {
  const slug = item.slug || slugify(item.title) || '<slug>'
  return `<!-- afiet içerik promptu v${PROMPT_VERSION} · üretim · blog -->
afiet-web reposunda (Nuxt 4 — afiet.co) çalışıyorsun. Aşağıdaki brief'e göre afiet blogu için bir yazı yazacak ve yayınlayacaksın.

${BRAND_BLOCK}

## Brief
${briefBlock(item)}

## SEO & GEO kuralları
- Meta title ≤ 60 karakter; meta description 140–160 karakter.
- Gövdede H1 KULLANMA (sayfa başlığı ayrıca basılır); H2/H3 hiyerarşisi kur.
- 900–1500 kelime; kısa paragraflar, taranabilir yapı, gerektiğinde listeler.
- Sona "## Sık sorulanlar" bölümü ekle: 3–5 soru-cevap (GEO — AI aramaları bu bölümü sever).
- İç bağlantıları gövdeye doğal biçimde yerleştir; sağlık iddialarını kaynağa bağla.
- afiet'i doğal biçimde konumla; satış dili yok, en fazla bir nazik CTA.

## Çıktı formatı
\`content/posts/${slug}.md\` dosyasını şu frontmatter ile oluştur:

\`\`\`
---
slug: ${slug}
title: <meta title>
description: <meta description>
tags: [<2-4 kısa Türkçe etiket>]
item_id: ${item.id ?? '<panel içerik id>'}
cover_url:
published_at:
---

<markdown gövde>
\`\`\`

## Yayın adımları
1. Yazıyı yaz, dosyayı oluştur ve bana özetle — ONAYIMI BEKLE, onaysız yayınlama.
2. Onaydan sonra: \`node scripts/publish-post.mjs content/posts/${slug}.md\` çalıştır (script Neon host'unu gösterip onay ister — host'u doğrula).
3. ~2 dakika içinde https://afiet.co/blog/${slug} canlı olur; sayfayı ve meta'ları kontrol et (sitemap/RSS ≤ 5 dk).
4. md dosyasını \`feat: blog — <başlık>\` commit'iyle feature dalına alıp development'a PR aç (dosya yedek; veritabanı runtime kaynağıdır).
5. Yönetim panelinde içerik otomatik "yayında"ya geçer — geçmediyse söyle.`
}

function socialProductionPrompt(item: PromptItem): string {
  const format =
    item.channel === 'instagram'
      ? `## Çıktı formatı (sohbette, yayına hazır)
1. **Hook** — kapak/ilk saniye cümlesi.
2. **İçerik** — carousel ise slayt slayt metin, reels ise sahne sahne senaryo (görsel yönergeleriyle).
3. **Caption** — 2-4 cümle + satır arası boşluklu.
4. **Hashtag** — 5 adet, Türkçe odaklı, spam yok.`
      : `## Çıktı formatı (sohbette, yayına hazır)
1. **Thread** — 5–8 tweet; ilk tweet güçlü bir hook, her tweet ≤ 280 karakter, numaralı (1/n).
2. Gerekirse görsel/ekran görüntüsü önerilerini tweet altına not düş.`

  return `<!-- afiet içerik promptu v${PROMPT_VERSION} · üretim · ${item.channel} -->
afiet'in ${CHANNEL_NAMES[item.channel]} hesabı için aşağıdaki brief'e göre yayına hazır içerik metni üreteceksin.

${BRAND_BLOCK}

## Brief
${briefBlock(item)}

${format}

## Kurallar
- Her şey Türkçe; marka sesi yukarıdaki gibi (nazik, yargısız, "afiet" hep küçük harf).
- Tıbbi/kesin sağlık iddiası yapma; genel denge dilinde kal.
- En fazla bir CTA; zorlama satış dili yok.

## Yayın sonrası
Metni ben paylaşacağım. Paylaşınca yönetim panelinde bu içeriğin durumunu "yayında" yapıp yayın URL'ini gireceğim — bana hatırlat.`
}

/**
 * "Claude çıktısını içe aktar" ayrıştırıcısı: metindeki ilk \`\`\`json bloğunu
 * (yoksa metnin tamamını) parse eder, beklenen alanları güvenle süzer.
 */
export function parsePlanImport(text: string): PlanImport {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const raw = (match ? match[1]! : text).trim()
  if (!raw) throw new Error('Yapıştırılan metin boş.')
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('json bloğu çözümlenemedi — Claude çıktısındaki ```json bloğunu olduğu gibi yapıştır.')
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('json bir nesne olmalı.')
  const obj = data as Record<string, unknown>
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined)
  const strArr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : undefined

  const briefSrc = (obj.brief && typeof obj.brief === 'object' && !Array.isArray(obj.brief) ? obj.brief : {}) as Record<string, unknown>
  const brief: Partial<ContentBrief> = {
    keywords: strArr(briefSrc.keywords),
    audience: str(briefSrc.audience),
    angle: str(briefSrc.angle),
    tone: str(briefSrc.tone),
    outline: strArr(briefSrc.outline),
    internalLinks: strArr(briefSrc.internalLinks),
    cta: str(briefSrc.cta),
    sources: strArr(briefSrc.sources),
    notes: str(briefSrc.notes),
  }
  Object.keys(brief).forEach((k) => brief[k as keyof ContentBrief] === undefined && delete brief[k as keyof ContentBrief])

  const plannedRaw = str(obj.plannedDate)
  return {
    title: str(obj.title),
    slug: str(obj.slug),
    plannedDate: plannedRaw && /^\d{4}-\d{2}-\d{2}$/.test(plannedRaw) ? plannedRaw : undefined,
    brief,
  }
}

/** Üretim promptu hangi durumda önerilir — kart/diyalog ipuçları için. */
export function suggestedPromptKind(status: ContentStatus): 'plan' | 'uretim' {
  return status === 'fikir' ? 'plan' : 'uretim'
}
