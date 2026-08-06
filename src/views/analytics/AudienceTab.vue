<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { AnalyticsData, BreakdownRow } from '../../services/analytics'
import { adminApi, type User } from '../../services/admin'
import { fmt, pct } from './shared'

/**
 * Kitle sekmesi iki ayrı kitleyi yan yana gösterir:
 *
 *   1. ZİYARETÇİ (afiet.co) — web analitiğinden: cihaz, tarayıcı, ülke.
 *   2. KULLANICI (uygulama) — /v1/admin/users listesinden türetilen kırılımlar.
 *
 * İkisi aynı kişi kümesi DEĞİL; siteyi gezen çoğu kişi kayıtlı değil. Bu yüzden
 * yüzdeler birbirine oranlanmaz, bloklar ayrı başlıklar altında durur.
 */

const props = defineProps<{ data: AnalyticsData }>()

// ── 1. Ziyaretçi (web analitiği) ────────────────────────────────────────────
const blocks = computed(() => [
  { caption: 'CİHAZ', title: 'Cihaz tipi', rows: props.data.devices, tone: 'green', icon: 'pi pi-mobile' },
  { caption: 'TARAYICI', title: 'Tarayıcı', rows: props.data.browsers, tone: 'blue', icon: 'pi pi-window-maximize' },
  { caption: 'ÜLKE', title: 'Ülke (geo)', rows: props.data.countries, tone: 'coral', icon: 'pi pi-globe' },
])
const total = (rows: BreakdownRow[]) => rows.reduce((s, r) => s + r.visits, 0)

// ── 2. Uygulama kullanıcıları ───────────────────────────────────────────────
//
// DOĞRULAMA (5 Ağu 2026, dev uca gerçek istek): `GET /v1/admin/users` satır
// başına YALNIZ şu alanları döndürüyor —
//   userId, email, displayName, emoji, createdAt, updatedAt,
//   mealCount, customFoodCount, measurementCount, lastActivityAt
// (backend: internal/store/admin.go → AdminUsers).
//
// Yani `user_profiles` tablosunda duran sex / birth_date / height_cm /
// activity_level / sports alanları bu uçtan GELMİYOR. Yaş, cinsiyet, boy,
// aktivite düzeyi ve spor kırılımı bu yüzden aşağıda YOK; uydurulmuyor.
// Tek kullanıcı ucu (`/v1/admin/users/{id}`) bu alanları taşır ama kırılım için
// 43 kişide 43, ileride 500 kişide 500 istek demek olurdu; kohort metriği için
// doğru yol o değil.
//
// BACKEND İŞİ (bu blok için gereken uç):
//   `GET /v1/admin/users/facets` (ya da /v1/admin/growth içinde `audience`)
//   → user_profiles üzerinden AGGREGATE kırılım, kişi-bazlı satır olmadan:
//       sexes:          [{ key: 'kadin'|'erkek'|'belirtmedi', users }]
//       ageBuckets:     [{ bucket: '18-24'|'25-34'|…, users }]   (birth_date'ten)
//       heightBuckets:  [{ bucket: '<160'|'160-169'|…, users }]  (height_cm'den)
//       activityLevels: [{ key, users }]
//       topSports:      [{ key, users }]
//   Her kova için minimum eşik (ör. <5 kişi olan kova "diğer"e katlanır) ki
//   kırılım tek kişiyi tanımlanabilir hâle getirmesin.
//
// KİLO bilerek bu listede yok. Marka kuralı: afiet kiloyu öne çıkarmaz, hedef
// kilo ve süre vaadi vermez. Ürün kararı için gerekirse kilo YALNIZ kohort
// düzeyinde ve yargısız dille (ör. "ölçüm giren kişi sayısı") sorulmalı; kişi
// başına kilo dağılımı panele girmez.

/** Uçtan çekilen kullanıcı listesinin üst sınırı; total bunu aşarsa panel söyler. */
const USER_FETCH_CAP = 500

const users = ref<User[] | null>(null)
const userTotal = ref(0)
const usersLoading = ref(true)
const usersFailed = ref(false)

onMounted(async () => {
  try {
    const page = await adminApi.users({ page: 1, pageSize: USER_FETCH_CAP })
    users.value = page.items
    userTotal.value = page.total
  } catch {
    usersFailed.value = true // uç yok / oturumsuz → mock ÜRETİLMEZ, dürüst boş durum
  } finally {
    usersLoading.value = false
  }
})

/**
 * Backend zaman damgaları Postgres `::text` çıktısıdır:
 * "2026-08-01 05:39:28.708192+00". Boşluk ve eksik dakika ofseti bazı
 * tarayıcılarda Invalid Date verir, o yüzden ISO'ya normalize edilir.
 */
function parseTs(value: string | null): Date | null {
  if (!value) return null
  const iso = value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

const daysSince = (value: string | null): number | null => {
  const d = parseTs(value)
  return d ? (Date.now() - d.getTime()) / 86_400_000 : null
}

type Bucket = { key: string; label: string; users: number }

const list = computed(() => users.value ?? [])
const userCount = computed(() => list.value.length)

/**
 * Son hareket kovaları. DİKKAT: `lastActivityAt` uçta
 * GREATEST(son öğün, son özel besin, son ölçüm, profilin updated_at)
 * olarak hesaplanıyor — yani profil güncellemesi de "hareket" sayılıyor.
 * Bu yüzden başlık "son hareket", "son öğün kaydı" değil.
 */
const recencyBuckets = computed<Bucket[]>(() => {
  const b = { d1: 0, d7: 0, d30: 0, old: 0, none: 0 }
  for (const u of list.value) {
    const d = daysSince(u.lastActivityAt)
    if (d === null) b.none++
    else if (d <= 1) b.d1++
    else if (d <= 7) b.d7++
    else if (d <= 30) b.d30++
    else b.old++
  }
  return [
    { key: 'd1', label: 'Son 24 saat', users: b.d1 },
    { key: 'd7', label: '2-7 gün', users: b.d7 },
    { key: 'd30', label: '8-30 gün', users: b.d30 },
    { key: 'old', label: '30 günden eski', users: b.old },
    { key: 'none', label: 'Hiç hareket yok', users: b.none },
  ].filter((r) => r.users > 0)
})

/** Kayıt ayına göre kohort; createdAt'ten türetilir, eskiden yeniye sıralı. */
const cohortBuckets = computed<Bucket[]>(() => {
  const map = new Map<string, number>()
  for (const u of list.value) {
    const d = parseTs(u.createdAt)
    if (!d) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, users]) => {
      const [y, m] = key.split('-').map(Number)
      const label = new Intl.DateTimeFormat('tr-TR', { month: 'short', year: 'numeric' }).format(new Date(y, m - 1, 1))
      return { key, label, users }
    })
})

/** Kayıt yoğunluğu: toplam öğün kaydı (tüm zamanlar) kovaları. */
const intensityBuckets = computed<Bucket[]>(() => {
  const b = { zero: 0, low: 0, mid: 0, high: 0 }
  for (const u of list.value) {
    if (u.mealCount === 0) b.zero++
    else if (u.mealCount <= 4) b.low++
    else if (u.mealCount <= 19) b.mid++
    else b.high++
  }
  return [
    { key: 'zero', label: 'Hiç öğün kaydı yok', users: b.zero },
    { key: 'low', label: '1-4 öğün', users: b.low },
    { key: 'mid', label: '5-19 öğün', users: b.mid },
    { key: 'high', label: '20+ öğün', users: b.high },
  ]
})

/** Profil ve kurulum tamamlama oranları (liste ucunun döndürdüğü alanlardan). */
const completion = computed(() => [
  { key: 'name', label: 'Görünen ad seçmiş', users: list.value.filter((u) => !!u.displayName).length },
  { key: 'emoji', label: 'Emoji seçmiş', users: list.value.filter((u) => !!u.emoji).length },
  { key: 'measure', label: 'En az bir ölçüm girmiş', users: list.value.filter((u) => u.measurementCount > 0).length },
  { key: 'meal', label: 'En az bir öğün kaydetmiş', users: list.value.filter((u) => u.mealCount > 0).length },
  { key: 'food', label: 'Kendi besinini eklemiş', users: list.value.filter((u) => u.customFoodCount > 0).length },
])

const active7 = computed(() => list.value.filter((u) => {
  const d = daysSince(u.lastActivityAt)
  return d !== null && d <= 7
}).length)
const withMeasurement = computed(() => list.value.filter((u) => u.measurementCount > 0).length)
const withMeal = computed(() => list.value.filter((u) => u.mealCount > 0).length)
const capped = computed(() => userTotal.value > userCount.value)

const breakdowns = computed(() => [
  { caption: 'SON HAREKET', title: 'Ne zaman görüldü', rows: recencyBuckets.value, tone: 'green', icon: 'pi pi-clock' },
  { caption: 'KOHORT', title: 'Kayıt ayı', rows: cohortBuckets.value, tone: 'blue', icon: 'pi pi-calendar' },
  { caption: 'YOĞUNLUK', title: 'Öğün kaydı', rows: intensityBuckets.value, tone: 'coral', icon: 'pi pi-book' },
])
</script>

<template>
  <div class="tab-body">
    <!-- ── Ziyaretçi (web) ── -->
    <p class="block-caption">ZİYARETÇİ <span class="cap-note">— afiet.co'yu gezenler, çoğu kayıtlı değil</span></p>
    <p class="analytics-note"><i class="pi pi-users" /> Ziyaretçi bağlamı: cihaz ve tarayıcı user-agent'tan, ülke ise sunucudaki Vercel geo başlığından toplu olarak çıkarılır. IP saklanmaz.</p>
    <div class="triple-grid">
      <article v-for="b in blocks" :key="b.caption" class="panel-card pad">
        <div class="panel-title sm"><div><p>{{ b.caption }}</p><h2>{{ b.title }}</h2></div><i :class="b.icon" class="panel-glyph" /></div>
        <ul class="src-list tight">
          <li v-for="row in b.rows" :key="row.key">
            <div class="src-row"><span class="src-name">{{ row.label }}</span><span class="src-val">{{ fmt(row.visits) }} · {{ pct(row.visits, total(b.rows)) }}%</span></div>
            <div class="mini-track"><div class="mini-fill" :class="b.tone" :style="{ width: `${pct(row.visits, total(b.rows))}%` }" /></div>
          </li>
        </ul>
      </article>
    </div>

    <!-- ── Uygulama kullanıcıları ── -->
    <p class="block-caption aud-gap">KULLANICI <span class="cap-note">— uygulamaya kayıtlı kişiler, kohort düzeyinde</span></p>

    <div v-if="usersLoading" class="seo-loading"><i class="pi pi-spin pi-spinner" /> Kullanıcı kırılımı yükleniyor…</div>

    <p v-else-if="usersFailed" class="analytics-note warn">
      <i class="pi pi-exclamation-triangle" />
      Kullanıcı listesi şu an alınamadı, bu yüzden kullanıcı kırılımı boş. Tahmini sayı gösterilmiyor; oturum ve bağlantı düzelince sekmeyi yenile.
    </p>

    <template v-else>
      <div class="metric-grid">
        <article class="metric-card green"><div class="metric-top"><span>Kayıtlı kullanıcı</span><i class="pi pi-users" /></div><strong>{{ fmt(userTotal) }}</strong><small>user_profiles</small></article>
        <article class="metric-card amber"><div class="metric-top"><span>Son 7 günde hareket</span><i class="pi pi-bolt" /></div><strong>{{ fmt(active7) }}</strong><small>%{{ pct(active7, userCount) }} · listedeki {{ fmt(userCount) }} kişi içinde</small></article>
        <article class="metric-card blue"><div class="metric-top"><span>Ölçüm girmiş</span><i class="pi pi-chart-line" /></div><strong>{{ fmt(withMeasurement) }}</strong><small>%{{ pct(withMeasurement, userCount) }} · aktivasyon sinyali</small></article>
        <article class="metric-card coral"><div class="metric-top"><span>Öğün kaydetmiş</span><i class="pi pi-book" /></div><strong>{{ fmt(withMeal) }}</strong><small>%{{ pct(withMeal, userCount) }} · en az bir kayıt</small></article>
      </div>

      <p class="analytics-note">
        <i class="pi pi-info-circle" />
        Kırılımlar <span class="mono">GET /v1/admin/users</span> listesinden istemcide türetilir; kişi-bazlı satır gösterilmez.
        "Son hareket" uçta öğün, özel besin, ölçüm ve profil güncellemesinin en yenisidir, yalnız kayıt eylemi değil.
        <template v-if="capped"> Kayıt sayısı {{ fmt(userTotal) }}; kırılım ilk {{ fmt(userCount) }} kişi üzerinden hesaplandı.</template>
      </p>

      <div class="triple-grid">
        <article v-for="b in breakdowns" :key="b.caption" class="panel-card pad aud-card">
          <div class="panel-title sm"><div><p>{{ b.caption }}</p><h2>{{ b.title }}</h2></div><i :class="b.icon" class="panel-glyph" /></div>
          <ul v-if="b.rows.length" class="src-list tight">
            <li v-for="row in b.rows" :key="row.key">
              <div class="src-row"><span class="src-name">{{ row.label }}</span><span class="src-val">{{ fmt(row.users) }} · {{ pct(row.users, userCount) }}%</span></div>
              <div class="mini-track"><div class="mini-fill" :class="b.tone" :style="{ width: `${pct(row.users, userCount)}%` }" /></div>
            </li>
          </ul>
          <p v-else class="note-line subtle"><i class="pi pi-info-circle" /> Bu kırılım için kayıt yok.</p>
        </article>
      </div>

      <div class="split-grid aud-gap">
        <article class="panel-card pad aud-card">
          <div class="panel-title sm"><div><p>KURULUM</p><h2>Profil tamamlama</h2></div><i class="pi pi-check-circle panel-glyph" /></div>
          <ul class="src-list tight">
            <li v-for="row in completion" :key="row.key">
              <div class="src-row"><span class="src-name">{{ row.label }}</span><span class="src-val">{{ fmt(row.users) }} · {{ pct(row.users, userCount) }}%</span></div>
              <div class="mini-track"><div class="mini-fill violet" :style="{ width: `${pct(row.users, userCount)}%` }" /></div>
            </li>
          </ul>
        </article>

        <article class="panel-card pad pending-card">
          <div class="panel-title sm"><div><p>HENÜZ YOK</p><h2>Demografik kırılım</h2></div><i class="pi pi-lock panel-glyph" /></div>
          <p class="pending-lead">Yaş, cinsiyet, boy, aktivite düzeyi ve spor alanları <span class="mono">user_profiles</span> tablosunda var ama kullanıcı listesi ucu bunları döndürmüyor. Bu yüzden burada tahmin edilmiyor, boş bırakılıyor.</p>
          <ul class="pending-list">
            <li><span>Yaş dağılımı</span><em>birth_date · uçta yok</em></li>
            <li><span>Cinsiyet</span><em>sex · uçta yok</em></li>
            <li><span>Boy dağılımı</span><em>height_cm · uçta yok</em></li>
            <li><span>Aktivite düzeyi</span><em>activity_level · uçta yok</em></li>
            <li><span>Spor dalları</span><em>sports · uçta yok</em></li>
          </ul>
          <p class="note-line subtle">
            <i class="pi pi-server" />
            Gereken: kişi-bazlı satır dönmeyen bir aggregate uç, ör. <span class="mono">/v1/admin/users/facets</span>; kovalarda küçük grupları katlayan bir eşikle.
          </p>
          <p class="note-line subtle">
            <i class="pi pi-heart" />
            Kilo dağılımı bilerek listede yok: afiet kiloyu öne çıkarmaz. Gerekirse yalnız kohort düzeyinde ve yargısız dille sorulur.
          </p>
        </article>
      </div>
    </template>
  </div>
</template>

<style scoped>
.aud-gap { margin-top: 18px; }
/* Global .src-name capitalize'ı kova adlarını "Hiç Öğün Kaydı Yok"a çeviriyordu;
   burada etiketler cümle, tek kelimelik kaynak adı değil. */
.aud-card :deep(.src-name) { text-transform: none; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .95em; }
.analytics-note.warn { color: #a9713b; }

.pending-card { background: repeating-linear-gradient(135deg, #fffdf8, #fffdf8 10px, #faf8f1 10px, #faf8f1 20px); }
.pending-lead { margin: 15px 0 0; color: #7f8f85; font-size: 11px; line-height: 1.6; }
.pending-list { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 7px; }
.pending-list li { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding: 9px 12px; border: 1px dashed var(--line); border-radius: 11px; background: rgba(255, 253, 248, .6); }
.pending-list span { color: #7c8a81; font-size: 11px; font-weight: 800; }
.pending-list em { color: #a6b2a8; font-size: 9px; font-weight: 700; font-style: normal; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
</style>
