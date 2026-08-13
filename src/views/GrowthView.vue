<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import PageHeader from '../components/PageHeader.vue'
import AdminPlaceholder from '../components/AdminPlaceholder.vue'
import LineChart from '../components/LineChart.vue'
import { buildSofraBoard, type GrowthData } from '../services/growth'
import { adminApi } from '../services/admin'
import { SERIES_COLORS, duration } from './analytics/shared'
import { screenLabel, sheetLabel, tapLabel } from '../services/telemetry-labels'
import UsageDrawer, { type DrawerRow } from './growth/UsageDrawer.vue'

// Gerçek veri /v1/admin/growth'tan gelir. Uç erişilemezse (oturumsuz/404/ağ)
// mock ÜRETİLMEZ; veri null kalır ve sayfa placeholder gösterir.
const data = ref<GrowthData | null>(null)
const loading = ref(true)
const d = computed(() => data.value)

async function load() {
  loading.value = true
  try {
    data.value = await adminApi.growth()
  } catch {
    data.value = null
  }
  loading.value = false
}
onMounted(load)

const pct = (n: number, base: number) => (base > 0 ? Math.round((n / base) * 100) : 0)
const fmt = (n: number) => n.toLocaleString('tr-TR')

// Funnel: her adımın önceki adıma ve ilk adıma göre oranı
const registered = computed(() => d.value?.funnel[0]?.value ?? 0)
const funnelRows = computed(() =>
  (d.value?.funnel ?? []).map((step, i) => ({
    ...step,
    ofRegistered: pct(step.value, registered.value),
    ofPrev: i === 0 ? null : pct(step.value, d.value?.funnel[i - 1]?.value ?? 0),
  })),
)
const activationRate = computed(() => pct(d.value?.funnel[1]?.value ?? 0, registered.value))
const groupCount = computed(() => d.value?.funnel.find((s) => s.key === 'group')?.value ?? 0)

const trendLabels = computed(() => (d.value?.growth.weeklyTrend ?? []).map((p) => p.label))
const trendSeries = computed(() => [
  { label: 'Yeni kullanıcı', color: SERIES_COLORS.views, values: (d.value?.growth.weeklyTrend ?? []).map((p) => p.value) },
])

// Oturum telemetrisi mobil 0.9 ile yayılıyor; hiç oturum yoksa şerit not düşer.
const sess = computed(() => d.value?.habit.sessions)
const sessionsLive = computed(() => (sess.value?.wau ?? 0) > 0)
const distTotal = computed(() => (d.value?.habit.activeDayDistribution ?? []).reduce((s, r) => s + r.users, 0))
const mealTotal = computed(() => (d.value?.habit.mealTypes ?? []).reduce((s, r) => s + r.count, 0))

const retentionColor = (rate: number) => (rate >= 40 ? 'good' : rate >= 20 ? 'mid' : 'low')

/**
 * Retention satırları. Eski ekran yalnız iki yüzde gösteriyordu ve okunmuyordu:
 * 7. günün 1. günden yüksek çıkması kohortların FARKLI olmasından geliyor
 * (1. gün 18 kişi, 7. gün 9 kişi), ama ekran bunu hiç söylemiyordu. Artık her
 * satır önce kohortu tanıtıyor, sonra yüzdeyi kişi sayısıyla birlikte veriyor.
 *
 * Kişi sayısı yüzdeden türetiliyor (uç yalnız oran + kohort döndürüyor), bu
 * yüzden yuvarlama payı olabilir; sayı iddiası "yaklaşık kaç kişi" düzeyinde
 * kalsın diye kohort her zaman yanında yazıyor.
 */
const retentionRows = computed(() =>
  (d.value?.retention ?? []).map((r) => ({
    ...r,
    heading: `${r.days}. GÜN`,
    empty: r.cohort === 0,
    openCount: Math.round((r.openRate / 100) * r.cohort),
    actCount: Math.round((r.rate / 100) * r.cohort),
  })),
)

// ── Sayfada kısa dur, gerisini panelde göster ──────────────────────────────
const PREVIEW_ROWS = 6

type UsageKind = 'screens' | 'sheets' | 'taps'
const drawer = ref<UsageKind | null>(null)

const usageMeta: Record<UsageKind, { title: string; tone: 'green' | 'blue' | 'amber'; label: (k: string) => string; note?: string }> = {
  screens: { title: 'En çok görülen ekranlar', tone: 'green', label: screenLabel, note: 'sağdaki süre ortancadır' },
  sheets: { title: 'En çok açılan alt sayfalar', tone: 'blue', label: sheetLabel, note: 'sağdaki süre ortancadır' },
  taps: { title: 'En sık dokunuşlar', tone: 'amber', label: tapLabel },
}

const usageRows = (kind: UsageKind) => {
  const src = kind === 'screens' ? d.value?.sofra.topScreens : kind === 'sheets' ? d.value?.sofra.topSheets : d.value?.sofra.topTaps
  const rows = src ?? []
  const top = rows[0]?.count ?? 1
  const label = usageMeta[kind].label
  return rows.map<DrawerRow>((r) => ({
    key: r.key,
    label: label(r.key),
    value: fmt(r.count),
    side: r.medianSec != null ? duration(r.medianSec) : undefined,
    ratio: pct(r.count, top),
  }))
}

const drawerRows = computed<DrawerRow[]>(() => (drawer.value ? usageRows(drawer.value) : []))
const drawerMeta = computed(() => (drawer.value ? usageMeta[drawer.value] : usageMeta.screens))

// Sofra paneli: kart tahtası tamamen `/v1/admin/growth` yanıtından türetilir
// (bkz. services/growth.ts → buildSofraBoard). Uydurma metrik yok; uçtan
// gelmeyen event'in adı bile geçmez, yalnız kaç tane olduğu söylenir.
const board = computed(() => (d.value ? buildSofraBoard(d.value) : null))
const coveragePct = computed(() => pct(board.value?.instrumented ?? 0, board.value?.dictionaryTotal ?? 0))
/** Kart değerinin ekrandaki hâli; süre olanlar "16d 42sn" biçimine döner. */
const cardValue = (c: { value: number | null; format: 'count' | 'duration' }) =>
  c.value === null ? null : c.format === 'duration' ? duration(c.value) : fmt(c.value)
</script>

<template>
  <div class="page-wrap">
    <PageHeader eyebrow="OPERASYON · BÜYÜME" title="Büyüme paneli" description="Kendi verimizle: kaç kişi geliyor, kalıyor, alışkanlık kuruyor. Kohort/trend düzeyinde — kişi-bazlı gözetleme yok.">
      <Button label="Yenile" icon="pi pi-refresh" outlined :loading="loading" @click="load" />
    </PageHeader>

    <div v-if="loading && !d" class="seo-loading"><i class="pi pi-spin pi-spinner" /> Büyüme verisi yükleniyor…</div>

    <AdminPlaceholder
      v-else-if="!d"
      icon="pi pi-chart-line"
      title="Büyüme verisi getirilemedi"
      description="Panel verisi şu an alınamadı. Oturumunun açık ve bağlantının aktif olduğundan emin olup yeniden dene."
      retryable
      :loading="loading"
      @retry="load"
    />

    <template v-else-if="d">
      <!-- ── A. Büyüme ── -->
      <section class="growth-block">
        <p class="block-caption">KAZANIM & BÜYÜME</p>
        <div class="metric-grid">
          <article class="metric-card green"><div class="metric-top"><span>Toplam kullanıcı</span><i class="pi pi-users" /></div><strong>{{ fmt(d.growth.totalUsers) }}</strong><small>kayıtlı profil</small></article>
          <article class="metric-card amber"><div class="metric-top"><span>Yeni (bugün)</span><i class="pi pi-user-plus" /></div><strong>{{ fmt(d.growth.newToday) }}</strong><small>son 24 saat</small></article>
          <article class="metric-card amber"><div class="metric-top"><span>Yeni (7 gün)</span><i class="pi pi-calendar" /></div><strong>{{ fmt(d.growth.new7d) }}</strong><small>bu hafta</small></article>
          <article class="metric-card blue"><div class="metric-top"><span>Yeni (30 gün)</span><i class="pi pi-chart-line" /></div><strong>{{ fmt(d.growth.new30d) }}</strong><small>bu ay</small></article>
        </div>

        <div class="split-grid">
          <article class="panel-card pad">
            <div class="panel-title sm"><div><p>HAFTALIK KAYIT TRENDİ</p><h2>Yeni kullanıcı</h2></div></div>
            <LineChart :labels="trendLabels" :series="trendSeries" :height="180" />
            <p class="note-line" v-if="!d.growth.acquisitionTracked"><i class="pi pi-info-circle" /> UTM / ülke / dil kırılımı için kayıt anında alan eklenmeli, henüz toplanmıyor.</p>
          </article>

          <article class="panel-card pad">
            <div class="panel-title sm"><div><p>OTURUM NABZI</p><h2>Uygulama kullanımı</h2></div></div>
            <div class="session-row pulse">
              <div class="session-cell"><strong>{{ fmt(sess?.dau ?? 0) }}</strong><small>OTURUM DAU</small></div>
              <div class="session-cell"><strong>{{ fmt(sess?.wau ?? 0) }}</strong><small>OTURUM WAU</small></div>
              <div class="session-cell"><strong>{{ duration(sess?.medianSessionSec ?? 0) }}</strong><small>ORTANCA OTURUM</small></div>
              <div class="session-cell"><strong>{{ (sess?.sessionsPerActive ?? 0).toLocaleString('tr-TR') }}</strong><small>OTURUM / KİŞİ (7G)</small></div>
              <div class="session-cell"><strong>%{{ sess?.fromNotificationPct ?? 0 }}</strong><small>BİLDİRİMDEN AÇILIŞ</small></div>
            </div>
            <p v-if="!sessionsLive" class="note-line subtle"><i class="pi pi-info-circle" /> Oturum telemetrisi mobil 0.9 sürümüyle yayılıyor; kullanıcılar güncelledikçe dolar.</p>
          </article>
        </div>
      </section>

      <!-- ── B. Funnel ── -->
      <section class="growth-block">
        <p class="block-caption">AKTİVASYON FUNNEL <span class="cap-note">— kayıttan alışkanlığa yolculuk</span></p>
        <div class="split-grid wide-left">
          <article class="panel-card">
            <div class="funnel">
              <div v-for="(step, i) in funnelRows" :key="step.key" class="funnel-step">
                <span class="funnel-idx">{{ i + 1 }}</span>
                <div class="funnel-body">
                  <div class="funnel-head">
                    <span class="funnel-label">{{ step.label }} <em>{{ step.hint }}</em></span>
                    <span class="funnel-nums">
                      <span v-if="step.ofPrev !== null" class="funnel-prev">{{ step.ofPrev }}% önceki</span>
                      <strong>{{ fmt(step.value) }}</strong>
                    </span>
                  </div>
                  <div class="funnel-track"><div class="funnel-fill" :class="step.key" :style="{ width: `${Math.max(4, step.ofRegistered)}%` }" /></div>
                </div>
              </div>
            </div>
          </article>
          <article class="panel-card pad center-card">
            <p class="big-label">AKTİVASYON</p>
            <div class="big-stat green">%{{ activationRate }}</div>
            <p class="big-sub">kayıt → ilk ölçüm</p>
            <div class="big-divider" />
            <p class="big-mini">{{ fmt(groupCount) }} kişi <span>gruba katıldı (Soframız)</span></p>
          </article>
        </div>
      </section>

      <!-- ── C. Retention + D. Alışkanlık ── -->
      <section class="growth-block">
        <p class="block-caption">RETENTION & ALIŞKANLIK</p>
        <div class="split-grid wide-left">
          <article class="panel-card pad">
            <div class="panel-title sm"><div><p>KOHORT</p><h2>Kayıttan sonra geri dönen</h2></div></div>

            <div class="coh-list">
              <section v-for="r in retentionRows" :key="r.key" class="coh">
                <header class="coh-head">
                  <strong>{{ r.heading }}</strong>
                  <span v-if="!r.empty">kayıt olan {{ fmt(r.cohort) }} kişi</span>
                  <span v-else class="coh-empty">henüz {{ r.days }} günü dolduran kimse yok</span>
                </header>

                <template v-if="!r.empty">
                  <div class="coh-bar">
                    <span class="coh-what">uygulamayı açtı</span>
                    <div class="coh-track"><div class="coh-fill open" :style="{ width: `${r.openRate}%` }" /></div>
                    <span class="coh-num"><strong>{{ fmt(r.openCount) }}</strong> kişi <em>%{{ r.openRate }}</em></span>
                  </div>
                  <div class="coh-bar">
                    <span class="coh-what">bir şey kaydetti</span>
                    <div class="coh-track"><div class="coh-fill" :class="retentionColor(r.rate)" :style="{ width: `${r.rate}%` }" /></div>
                    <span class="coh-num"><strong>{{ fmt(r.actCount) }}</strong> kişi <em>%{{ r.rate }}</em></span>
                  </div>
                </template>
              </section>
            </div>

            <p class="note-line subtle">
              Her satır AYRI bir kohort: yüzdeler birbiriyle kıyaslanmaz, çünkü paydaları farklı.
              "Bir şey kaydetti" = öğün, ölçüm ya da su. Oturum telemetrisi 1 Ağu'da çıktı, o yüzden
              eski kohortlarda "açtı" oranı yapısal olarak düşük görünür.
            </p>
          </article>

          <article class="panel-card pad">
            <div class="panel-title sm"><div><p>NE YENİYOR</p><h2>Öğün tipi</h2></div></div>
            <ul class="src-list tight">
              <li v-for="m in d.habit.mealTypes" :key="m.meal">
                <div class="src-row"><span class="src-name">{{ m.label }}</span><span class="src-val">{{ pct(m.count, mealTotal) }}%</span></div>
                <div class="mini-track"><div class="mini-fill coral" :style="{ width: `${pct(m.count, mealTotal)}%` }" /></div>
              </li>
            </ul>
          </article>
        </div>

        <article class="panel-card pad" style="margin-top: 15px">
          <div class="panel-title sm"><div><p>AKTİVİTE</p><h2>Alışkanlık</h2></div></div>
          <div class="habit-wide">
            <div class="dua-row">
              <div class="dua-cell"><strong>{{ fmt(d.habit.dau) }}</strong><small>DAU (öğün)</small></div>
              <div class="dua-cell"><strong>{{ fmt(d.habit.wau) }}</strong><small>WAU (öğün)</small></div>
              <div class="dua-cell"><strong>{{ d.habit.avgRhythmDays }}</strong><small>ort. ritim günü</small></div>
            </div>
            <div>
              <p class="mini-cap">AKTİF GÜN DAĞILIMI (30g)</p>
              <ul class="src-list tight">
                <li v-for="b in d.habit.activeDayDistribution" :key="b.bucket">
                  <div class="src-row"><span class="src-name">{{ b.bucket }}</span><span class="src-val">{{ fmt(b.users) }}</span></div>
                  <div class="mini-track"><div class="mini-fill green" :style="{ width: `${pct(b.users, distTotal)}%` }" /></div>
                </li>
              </ul>
            </div>
          </div>
        </article>
      </section>

      <!-- ── E. Sofra paneli (event-derived) ── -->
      <section class="growth-block">
        <p class="block-caption">SOFRA PANELİ <span class="cap-note">— davranış telemetrisi (events), enstrümantasyon geldikçe dolar</span></p>
        <article v-if="board" class="panel-card pad">
          <div class="sofra-head">
            <div class="cover-strip">
              <div class="cover-head">
                <span class="cover-title"><i class="pi pi-bolt" /> {{ board.instrumented }}/{{ board.dictionaryTotal }} event bağlı</span>
                <span class="cover-sub">"ölçemeyeceğimiz özelliği açmayız."</span>
              </div>
              <div class="cover-bar"><div class="cover-fill" :style="{ width: `${coveragePct}%` }" /></div>
              <div class="cover-legend">
                <span class="cl on"><i /> {{ board.visible }} event panelde görünüyor</span>
                <span class="cl mid"><i /> {{ board.countedButHidden }} bağlı ama sayısı uçtan dönmüyor</span>
                <span class="cl off"><i /> {{ board.neverFired }} sözlükte var, hiç atılmamış</span>
              </div>
            </div>
          </div>

          <div v-for="g in board.groups" :key="g.key" class="evt-group">
            <p class="evt-group-head">{{ g.label }} <span>{{ g.cards.length }}</span></p>
            <ul class="evt-rows">
              <li v-for="c in g.cards" :key="c.key">
                <span class="evt-dot" />
                <span class="evt-name">
                  {{ c.label }}
                  <em class="mono">{{ c.key }}</em>
                </span>
                <span v-if="c.origin === 'derived'" class="card-flag" :title="c.note">türetilmiş</span>
                <span class="evt-val">
                  <template v-if="cardValue(c) !== null">
                    <span v-if="c.atLeast" class="event-approx">≥</span>{{ cardValue(c) }}<span class="event-unit">{{ c.unit }}</span>
                  </template>
                  <span v-else class="event-empty">—</span>
                </span>
              </li>
            </ul>
          </div>

          <template v-if="board.ratios.length">
            <p class="mini-cap">OTURUM BAŞINA (son 7 gün)</p>
            <div class="ratio-row">
              <div v-for="r in board.ratios" :key="r.key" class="ratio-cell">
                <strong><span v-if="r.atLeast" class="event-approx">≥</span>{{ r.value.toLocaleString('tr-TR') }}</strong>
                <small>{{ r.label }}</small>
                <small class="mono">{{ r.hint }}</small>
              </div>
            </div>
          </template>

          <details class="gap-details">
            <summary><i class="pi pi-chevron-right" /> Panelde sayısı olmayan event'ler <span>{{ board.countedButHidden + board.dark.length }}</span></summary>
            <div class="gap-body">
              <ul v-if="board.dark.length" class="evt-rows dim">
                <li v-for="c in board.dark" :key="c.key">
                  <span class="evt-dot" />
                  <span class="evt-name">{{ c.label }} <em class="mono">{{ c.key }}</em></span>
                  <span class="evt-val"><span class="event-empty">hiç atılmamış</span></span>
                </li>
              </ul>
              <ul class="gap-list">
                <li v-if="board.countedButHidden > 0">
                  <strong>{{ board.countedButHidden }} event bağlı ama panelde adı bile geçmiyor.</strong>
                  Uç sözlüğün tamamını döndürdüğü için bu sayının normalde SIFIR olması gerekir.
                  Sıfır değilse mobil tarafta gönderilen bir event, backend'deki sözlüğe
                  (<span class="mono">internal/store/growth.go</span>) eklenmemiş demektir: iki liste birlikte değişmeliydi.
                </li>
                <li v-if="board.neverFired > 0">
                  <strong>{{ board.neverFired }} event sözlükte tanımlı ama hiç atılmamış.</strong>
                  Bunlar enstrümantasyon bekliyor; ölçüm bağlanmadan özellik açılmadığı için sözlükte duruyorlar.
                </li>
                <li>
                  Bir grubun boş görünmesi "uç o grubu döndürmüyor" demek değil: uç
                  (<span class="mono">GET /v1/admin/growth</span>) event sözlüğünün TAMAMINI döndürüyor,
                  atılmamış olanları <span class="mono">value: null</span> ile işaretleyerek. Yani boş bir grup
                  gerçekten "bu event'ler hiç atılmamış" demektir ve cevabı enstrümantasyondadır.
                </li>
              </ul>
            </div>
          </details>
        </article>

        <div class="triple-grid equal" style="margin-top: 15px">
          <article v-for="kind in (['screens', 'sheets', 'taps'] as const)" :key="kind" class="panel-card pad usage-card">
            <div class="panel-title sm">
              <div>
                <p>OTURUM · 7 GÜN</p>
                <h2>{{ usageMeta[kind].title }}</h2>
                <p v-if="usageMeta[kind].note" class="usage-note">{{ usageMeta[kind].note }}</p>
              </div>
            </div>

            <ul v-if="usageRows(kind).length" class="src-list tight telemetry">
              <li v-for="row in usageRows(kind).slice(0, PREVIEW_ROWS)" :key="row.key">
                <div class="src-row">
                  <span class="src-name" :title="row.key">{{ row.label }}</span>
                  <span class="src-val">{{ row.value }}<template v-if="row.side"> · {{ row.side }}</template></span>
                </div>
                <div class="mini-track"><div class="mini-fill" :class="usageMeta[kind].tone" :style="{ width: `${row.ratio}%` }" /></div>
              </li>
            </ul>
            <p v-else class="note-line subtle"><i class="pi pi-info-circle" /> Henüz veri yok; mobil sürüm yayıldıkça dolar.</p>

            <button
              v-if="usageRows(kind).length > PREVIEW_ROWS"
              type="button"
              class="more-link"
              @click="drawer = kind"
            >
              Devamını gör
              <span>{{ usageRows(kind).length - PREVIEW_ROWS }} satır daha</span>
              <i class="pi pi-arrow-right" />
            </button>
          </article>
        </div>
      </section>
    </template>

    <UsageDrawer
      :visible="drawer !== null"
      :title="drawerMeta.title"
      eyebrow="OTURUM · 7 GÜN"
      :rows="drawerRows"
      :tone="drawerMeta.tone"
      note="Liste uçta ilk 20 satırla sınırlı; uzun kuyruk buraya da girmez."
      @update:visible="(v: boolean) => { if (!v) drawer = null }"
    />
  </div>
</template>

<script lang="ts">
export default { name: 'GrowthView' }
</script>

<style scoped>
/* Yan yana duran kartlar eşit yükseklikte olsun: global kural
   (.split-grid > .panel-card { align-self: start }) her kartı kendi içeriğine
   göre kısaltıyor ve satır tırtıklı görünüyordu. */
.split-grid > .panel-card,
.triple-grid.equal > .panel-card { align-self: stretch; }
.usage-card { display: flex; flex-direction: column; }
.usage-card .src-list { flex: 1; align-content: start; }

/* Satırın sağındaki süre bir ortancadır ve bunu okuyanın bilmesi gerekiyor:
   ortalama sanılan bir ortanca, aykırı değer arayan gözü yanlış yere bakmaya
   gönderir. Başlığın altında durur, satırların içinde tekrar etmez. */
.usage-note { margin-top: 3px; font-size: 11.5px; color: var(--muted); }

/* "Devamını gör": listeyi kısa tutup gerisini sağdaki panele bırakır. */
.more-link {
  display: flex; align-items: center; gap: 8px; width: 100%;
  margin-top: 12px; padding: 9px 11px;
  border: 1px solid var(--line); border-radius: 11px;
  background: #fbfaf5; color: var(--green-dark);
  font-size: 12px; font-weight: 800; cursor: pointer;
  transition: border-color .15s, background .15s;
}
.more-link:hover { border-color: var(--green); background: #f4faf6; }
.more-link span { flex: 1; color: var(--muted); font-weight: 700; text-align: right; }
.more-link i { font-size: 10px; }

/* ── Kohort blokları (retention) ──────────────────────────────────────────
   Eski tasarım iki yüzdeyi yan yana koyuyordu ve 7. günün 1. günden yüksek
   çıkması okunmuyordu. Artık her kohort kendi başlığıyla geliyor, yüzde
   hiçbir yerde kişi sayısından ayrı durmuyor. */
.coh-list { display: grid; gap: 18px; margin-top: 4px; }
.coh-head { display: flex; align-items: baseline; gap: 9px; margin-bottom: 9px; flex-wrap: wrap; }
.coh-head strong { color: var(--ink); font-size: 12px; font-weight: 950; letter-spacing: .08em; }
.coh-head span { color: var(--muted); font-size: 11.5px; font-weight: 700; }
.coh-empty { font-style: italic; }
.coh-bar { display: grid; grid-template-columns: 108px minmax(0, 1fr) 118px; gap: 11px; align-items: center; }
.coh-bar + .coh-bar { margin-top: 7px; }
.coh-what { color: #6c7a71; font-size: 11.5px; font-weight: 700; }
.coh-track { height: 9px; border-radius: 999px; background: #eef1ec; overflow: hidden; }
.coh-fill { height: 100%; border-radius: 999px; background: #34d399; transition: width .3s; }
.coh-fill.open { background: #7aa9f0; }
.coh-fill.good { background: #34d399; }
.coh-fill.mid { background: #e0a33c; }
.coh-fill.low { background: #dc725c; }
.coh-num { color: var(--muted); font-size: 11.5px; text-align: right; }
.coh-num strong { color: var(--ink); font-size: 13px; }
.coh-num em { margin-left: 5px; font-style: normal; font-weight: 800; }

/* ── Sofra event satırları ────────────────────────────────────────────────
   37 event kart olarak çizilince sayfa okunmaz uzunluğa çıkıyordu; aynı
   bilgi sıkı satırlarda duruyor. */
.evt-rows { display: grid; gap: 1px; margin: 0; padding: 0; list-style: none; }
.evt-rows li {
  display: grid; grid-template-columns: 7px minmax(0, 1fr) auto auto;
  gap: 10px; align-items: center; padding: 7px 10px; border-radius: 9px;
}
.evt-rows li:nth-child(odd) { background: #fbfaf6; }
.evt-dot { width: 7px; height: 7px; border-radius: 50%; background: #34d399; }
.evt-rows.dim .evt-dot { background: #cfd4cc; }
.evt-name { overflow: hidden; color: #33413b; font-size: 12.5px; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
.evt-name em { margin-left: 8px; color: #9aa89f; font-size: 10.5px; font-style: normal; font-weight: 600; }
.evt-val { color: var(--ink); font-size: 14px; font-weight: 850; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.evt-rows.dim .evt-val { color: #9aa89f; font-size: 11px; font-weight: 700; letter-spacing: 0; }

/* Sofra paneli kapsama şeridi ve kategori grupları. Global .event-* sınıfları
   main.css'te yaşar; burada yalnız bu bölüme ait yeni parçalar var. */
.cover-strip { display: grid; gap: 9px; }
.cover-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.cover-title { display: inline-flex; align-items: center; gap: 7px; color: #3f5147; font-size: 13px; font-weight: 900; }
.cover-title i { color: var(--green); font-size: 12px; }
.cover-sub { color: #9aa89f; font-size: 11px; }
.cover-bar { height: 7px; border-radius: 999px; background: #eceee7; overflow: hidden; }
.cover-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #34d399, #059669); }
.cover-legend { display: flex; gap: 16px; flex-wrap: wrap; color: #8a9a8f; font-size: 10px; font-weight: 700; }
.cover-legend .cl { display: inline-flex; align-items: center; gap: 6px; }
.cover-legend .cl i { width: 7px; height: 7px; border-radius: 50%; background: #cdd6cf; }
.cover-legend .cl.on i { background: #34d399; }
.cover-legend .cl.mid i { background: #ecb45a; }
.cover-legend .cl.off i { background: #d6d3c9; }

.evt-group { margin-top: 18px; }
.evt-group-head { display: flex; align-items: center; gap: 8px; margin: 0 0 9px; color: #6b7d72; font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; }
.evt-group-head span { padding: 1px 7px; border-radius: 999px; color: #6f8579; background: #eef3ee; font-size: 9px; letter-spacing: 0; }

.card-flag { margin-left: auto; padding: 1px 6px; border: 1px solid #dfe7e0; border-radius: 999px; color: #7f9187; background: #f6f9f5; font-size: 8px; font-weight: 900; letter-spacing: .04em; white-space: nowrap; }
.event-approx { margin-right: 2px; color: #9aa89f; font-size: 17px; font-weight: 800; }
.event-src { color: #a6b2a8; font-size: 9px; font-weight: 600; line-height: 1.4; }
.event-src.mono { color: #8f9d93; font-weight: 700; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

.ratio-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 10px; }
.ratio-cell { padding: 13px 15px; border: 1px solid var(--line); border-radius: 14px; background: #fbfaf5; }
.ratio-cell strong { display: block; color: #22302a; font-size: 22px; font-weight: 900; font-variant-numeric: tabular-nums; }
.ratio-cell small { display: block; margin-top: 3px; color: #7f8f85; font-size: 10px; font-weight: 750; }
.ratio-cell small.mono { margin-top: 2px; color: #a6b2a8; font-size: 9px; font-weight: 600; }

.gap-details { margin-top: 20px; padding-top: 15px; border-top: 1px dashed var(--line); }
.gap-details > summary { display: flex; align-items: center; gap: 8px; color: #6b7d72; font-size: 11px; font-weight: 850; cursor: pointer; list-style: none; }
.gap-details > summary::-webkit-details-marker { display: none; }
.gap-details > summary > i { font-size: 10px; color: #9aa89f; transition: transform .18s; }
.gap-details[open] > summary > i { transform: rotate(90deg); }
.gap-details > summary span { padding: 1px 7px; border-radius: 999px; color: #96805c; background: #f7f0e2; font-size: 9px; font-weight: 900; }
.gap-body { margin-top: 13px; display: grid; gap: 13px; }
.gap-list { margin: 0; padding-left: 17px; display: grid; gap: 9px; color: #8a9a8f; font-size: 11px; line-height: 1.55; }
.gap-list strong { color: #566a5e; font-weight: 850; }

@media (max-width: 1100px) {
  .ratio-row { grid-template-columns: 1fr; }
}
</style>
