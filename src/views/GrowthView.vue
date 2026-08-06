<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import PageHeader from '../components/PageHeader.vue'
import AdminPlaceholder from '../components/AdminPlaceholder.vue'
import LineChart from '../components/LineChart.vue'
import { buildSofraBoard, type GrowthData } from '../services/growth'
import { adminApi } from '../services/admin'
import { betaApi, label, type BetaAdminPayload } from '../services/beta'
import { SERIES_COLORS, duration } from './analytics/shared'

// Gerçek veri /v1/admin/growth'tan gelir. Uç erişilemezse (oturumsuz/404/ağ)
// mock ÜRETİLMEZ; veri null kalır ve sayfa placeholder gösterir.
const data = ref<GrowthData | null>(null)
// Edinim kırılımı afiet-web'den ayrı gelir: beta başvuruları landing'in
// Neon'unda yaşıyor. Bu uç düşerse sayfanın kalanı yine çalışsın diye
// büyüme verisinden bağımsız tutuldu.
const beta = ref<BetaAdminPayload | null>(null)
const loading = ref(true)
const d = computed(() => data.value)

async function load() {
  loading.value = true
  const [growth, betaRes] = await Promise.allSettled([adminApi.growth(), betaApi.get()])
  data.value = growth.status === 'fulfilled' ? growth.value : null
  beta.value = betaRes.status === 'fulfilled' ? betaRes.value : null
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
// "Nereden duydun?" yanıtlarının toplamı. Başvuru sayısına eşit değil:
// alan isteğe bağlı, boş bırakanlar bu toplama girmez.
const heardRows = computed(() => (beta.value?.summary.heard ?? []).filter((r) => r.key))
const heardTotal = computed(() => heardRows.value.reduce((s, r) => s + r.count, 0))
const distTotal = computed(() => (d.value?.habit.activeDayDistribution ?? []).reduce((s, r) => s + r.users, 0))
const mealTotal = computed(() => (d.value?.habit.mealTypes ?? []).reduce((s, r) => s + r.count, 0))

const retentionColor = (rate: number) => (rate >= 40 ? 'good' : rate >= 20 ? 'mid' : 'low')

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
          </article>

          <article class="panel-card pad">
            <div class="panel-title sm"><div><p>BETA BAŞVURU KAYNAĞI</p><h2>{{ fmt(beta?.total ?? 0) }} başvuru</h2></div></div>
            <ul class="src-list" v-if="heardRows.length">
              <li v-for="s in heardRows" :key="s.key">
                <div class="src-row"><span class="src-name">{{ label.heard(s.key) }}</span><span class="src-val">{{ fmt(s.count) }} · {{ pct(s.count, heardTotal) }}%</span></div>
                <div class="mini-track"><div class="mini-fill violet" :style="{ width: `${pct(s.count, heardTotal)}%` }" /></div>
              </li>
            </ul>
            <p class="note-line" v-else><i class="pi pi-info-circle" /> Henüz "nereden duydun" yanıtı yok; alan başvuruda isteğe bağlı.</p>
            <p class="note-line" v-if="!d.growth.acquisitionTracked"><i class="pi pi-info-circle" /> UTM / ülke / dil kırılımı için kayıt anında alan eklenmeli, henüz toplanmıyor.</p>
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
        <div class="triple-grid">
          <article class="panel-card pad">
            <div class="panel-title sm"><div><p>KOHORT</p><h2>Retention</h2></div></div>
            <div class="ret-legend"><span><i class="k-open" /> uygulamayı açtı</span><span><i class="k-act" /> eylem yaptı</span></div>
            <div class="ret-list">
              <div v-for="r in d.retention" :key="r.key" class="ret-row dual">
                <span class="ret-label">{{ r.label }}</span>
                <div class="ret-pair">
                  <div class="ret-track"><div class="ret-fill open" :style="{ width: `${r.openRate}%` }" /></div>
                  <div class="ret-track"><div class="ret-fill" :class="retentionColor(r.rate)" :style="{ width: `${r.rate}%` }" /></div>
                </div>
                <span class="ret-vals"><span class="open">%{{ r.openRate }}</span><span class="act">%{{ r.rate }}</span></span>
              </div>
            </div>
            <p class="note-line subtle">Kohort: {{ d.retention.map((r) => `${r.label} ${fmt(r.cohort)}`).join(' · ') }} kişi. Açtı = session_start; eylem = öğün·ölçüm·su. Oturum telemetrisi 1 Ağu'da çıktı; eski kohortların "açtı" oranı yapısal olarak düşük.</p>
          </article>

          <article class="panel-card pad">
            <div class="panel-title sm"><div><p>AKTİVİTE</p><h2>Alışkanlık</h2></div></div>
            <div class="dua-row">
              <div class="dua-cell"><strong>{{ fmt(d.habit.dau) }}</strong><small>DAU (öğün)</small></div>
              <div class="dua-cell"><strong>{{ fmt(d.habit.wau) }}</strong><small>WAU (öğün)</small></div>
              <div class="dua-cell"><strong>{{ d.habit.avgRhythmDays }}</strong><small>ort. ritim günü</small></div>
            </div>
            <div class="session-row">
              <div class="session-cell"><strong>{{ fmt(sess?.dau ?? 0) }}</strong><small>OTURUM DAU</small></div>
              <div class="session-cell"><strong>{{ fmt(sess?.wau ?? 0) }}</strong><small>OTURUM WAU</small></div>
              <div class="session-cell"><strong>{{ duration(sess?.avgSessionSec ?? 0) }}</strong><small>ORT. OTURUM</small></div>
              <div class="session-cell"><strong>{{ (sess?.sessionsPerActive ?? 0).toLocaleString('tr-TR') }}</strong><small>OTURUM / KİŞİ (7G)</small></div>
              <div class="session-cell"><strong>%{{ sess?.fromNotificationPct ?? 0 }}</strong><small>BİLDİRİMDEN AÇILIŞ</small></div>
            </div>
            <p v-if="!sessionsLive" class="note-line subtle" style="margin-top: 8px"><i class="pi pi-info-circle" /> Oturum telemetrisi mobil 0.9 sürümüyle yayılıyor; kullanıcılar güncelledikçe dolar.</p>
            <p class="mini-cap">AKTİF GÜN DAĞILIMI (30g)</p>
            <ul class="src-list tight">
              <li v-for="b in d.habit.activeDayDistribution" :key="b.bucket">
                <div class="src-row"><span class="src-name">{{ b.bucket }}</span><span class="src-val">{{ fmt(b.users) }}</span></div>
                <div class="mini-track"><div class="mini-fill green" :style="{ width: `${pct(b.users, distTotal)}%` }" /></div>
              </li>
            </ul>
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
            <div class="event-grid">
              <div v-for="c in g.cards" :key="c.key" class="event-cell">
                <div class="event-top">
                  <span class="event-dot on" />
                  <span class="event-label">{{ c.label }}</span>
                  <span v-if="c.origin === 'derived'" class="card-flag" title="Uçta ayrı bir sayaç yok; bu değer yanıtın içindeki listelerden türetildi.">türetilmiş</span>
                </div>
                <strong v-if="cardValue(c) !== null"><span v-if="c.atLeast" class="event-approx">≥</span>{{ cardValue(c) }}<span class="event-unit">{{ c.unit }}</span></strong>
                <strong v-else class="event-empty">—</strong>
                <small class="event-src mono">{{ c.key }}</small>
                <small class="event-src">{{ c.note }}<template v-if="c.atLeast"> · ilk 8 ile sınırlı, alt sınır</template></small>
              </div>
            </div>
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
            <summary><i class="pi pi-chevron-right" /> Panelde sayısı olmayan event'ler <span>{{ board.countedButHidden + board.neverFired + board.dark.length }}</span></summary>
            <div class="gap-body">
              <div v-if="board.dark.length" class="event-grid">
                <div v-for="c in board.dark" :key="c.key" class="event-cell dim">
                  <div class="event-top"><span class="event-dot" /><span class="event-label">{{ c.label }}</span></div>
                  <strong class="event-empty">—</strong>
                  <small class="event-src mono">{{ c.key }}</small>
                  <small class="event-src">enstrümante değil</small>
                </div>
              </div>
              <ul class="gap-list">
                <li v-if="board.countedButHidden > 0">
                  <strong>{{ board.countedButHidden }} event bağlı ama panelde adı bile geçmiyor.</strong>
                  Uç (<span class="mono">GET /v1/admin/growth</span>) yalnız elle seçilmiş {{ d.sofra.stats.length }} başlığın sayısını döndürüyor; geri kalanların adı da sayısı da yanıtta yok, o yüzden burada uydurulmuyor.
                  Çözüm backend tarafında: <span class="mono">sofra.stats</span> sabit başlık listesi yerine event sözlüğünün tamamını dönsün.
                </li>
                <li v-if="board.neverFired > 0">
                  <strong>{{ board.neverFired }} event sözlükte tanımlı ama hiç atılmamış.</strong>
                  Bunlar enstrümantasyon bekliyor; ölçüm bağlanmadan özellik açılmadığı için sözlükte duruyorlar.
                </li>
                <li>
                  Kayıt / denge / sosyal / bildirim gruplarının boş görünmesi "bu event'ler yok" demek değil; uç bu grupların sayılarını henüz döndürmüyor demek.
                </li>
              </ul>
            </div>
          </details>
        </article>

        <div class="triple-grid" style="margin-top: 15px">
          <article class="panel-card pad">
            <div class="panel-title sm"><div><p>OTURUM · 7 GÜN</p><h2>En çok görülen ekranlar</h2></div></div>
            <ul v-if="d.sofra.topScreens.length" class="src-list tight">
              <li v-for="s in d.sofra.topScreens" :key="s.key">
                <div class="src-row"><span class="src-name mono">{{ s.key }}</span><span class="src-val">{{ fmt(s.count) }}<template v-if="s.avgSec != null"> · {{ duration(s.avgSec) }}</template></span></div>
                <div class="mini-track"><div class="mini-fill green" :style="{ width: `${pct(s.count, d.sofra.topScreens[0]?.count ?? 1)}%` }" /></div>
              </li>
            </ul>
            <p v-if="d.sofra.topScreens.length && board?.topScreenShare !== null" class="note-line subtle"><i class="pi pi-info-circle" /> Bu ilk 8 ekran, tüm ekran görüntülemelerinin %{{ board?.topScreenShare }}'ini kapsıyor; kalanı uçta ilk 8 sınırının dışında kaldı.</p>
            <p v-if="!d.sofra.topScreens.length" class="note-line subtle"><i class="pi pi-info-circle" /> Henüz screen_view verisi yok; mobil 0.9 yayıldıkça dolar.</p>
          </article>

          <article class="panel-card pad">
            <div class="panel-title sm"><div><p>OTURUM · 7 GÜN</p><h2>En çok açılan alt sayfalar</h2></div></div>
            <ul v-if="d.sofra.topSheets.length" class="src-list tight">
              <li v-for="s in d.sofra.topSheets" :key="s.key">
                <div class="src-row"><span class="src-name mono">{{ s.key }}</span><span class="src-val">{{ fmt(s.count) }}<template v-if="s.avgSec != null"> · {{ duration(s.avgSec) }}</template></span></div>
                <div class="mini-track"><div class="mini-fill blue" :style="{ width: `${pct(s.count, d.sofra.topSheets[0]?.count ?? 1)}%` }" /></div>
              </li>
            </ul>
            <p v-else class="note-line subtle"><i class="pi pi-info-circle" /> Henüz sheet_view verisi yok.</p>
          </article>

          <article class="panel-card pad">
            <div class="panel-title sm"><div><p>OTURUM · 7 GÜN</p><h2>En sık dokunuşlar</h2></div></div>
            <ul v-if="d.sofra.topTaps.length" class="src-list tight">
              <li v-for="s in d.sofra.topTaps" :key="s.key">
                <div class="src-row"><span class="src-name mono">{{ s.key }}</span><span class="src-val">{{ fmt(s.count) }}</span></div>
                <div class="mini-track"><div class="mini-fill amber" :style="{ width: `${pct(s.count, d.sofra.topTaps[0]?.count ?? 1)}%` }" /></div>
              </li>
            </ul>
            <p v-else class="note-line subtle"><i class="pi pi-info-circle" /> Henüz ui_tap verisi yok.</p>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>

<script lang="ts">
export default { name: 'GrowthView' }
</script>

<style scoped>
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
