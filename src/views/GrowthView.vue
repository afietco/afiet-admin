<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import PageHeader from '../components/PageHeader.vue'
import { mockGrowth, type GrowthData } from '../services/growth'
import { adminApi } from '../services/admin'

// Gerçek veri /v1/admin/growth'tan gelir. Uç henüz dev'e deploy edilmediyse
// (404) ya da oturum yoksa mock'a düşer — "mock veri" rozeti onu belli eder.
const data = ref<GrowthData>(mockGrowth())
const loading = ref(true)
const d = computed(() => data.value)

async function load() {
  loading.value = true
  try {
    data.value = await adminApi.growth()
  } catch {
    data.value = mockGrowth() // uç yok / oturumsuz → mock (rozet gösterilir)
  } finally {
    loading.value = false
  }
}
onMounted(load)

const pct = (n: number, base: number) => (base > 0 ? Math.round((n / base) * 100) : 0)
const fmt = (n: number) => n.toLocaleString('tr-TR')

// Funnel: her adımın önceki adıma ve ilk adıma göre oranı
const registered = computed(() => d.value.funnel[0]?.value ?? 0)
const funnelRows = computed(() =>
  d.value.funnel.map((step, i) => ({
    ...step,
    ofRegistered: pct(step.value, registered.value),
    ofPrev: i === 0 ? null : pct(step.value, d.value.funnel[i - 1].value),
  })),
)
const activationRate = computed(() => pct(d.value.funnel[1]?.value ?? 0, registered.value))

const maxTrend = computed(() => Math.max(...d.value.growth.weeklyTrend.map((p) => p.value), 1))
const waitlistTotalSrc = computed(() => d.value.growth.waitlistSources.reduce((s, r) => s + r.count, 0))
const distTotal = computed(() => d.value.habit.activeDayDistribution.reduce((s, r) => s + r.users, 0))
const mealTotal = computed(() => d.value.habit.mealTypes.reduce((s, r) => s + r.count, 0))

const retentionColor = (rate: number) => (rate >= 40 ? 'good' : rate >= 20 ? 'mid' : 'low')
</script>

<template>
  <div class="page-wrap">
    <PageHeader eyebrow="OPERASYON · BÜYÜME" title="Büyüme paneli" description="Kendi verimizle: kaç kişi geliyor, kalıyor, alışkanlık kuruyor. Kohort/trend düzeyinde — kişi-bazlı gözetleme yok.">
      <span v-if="!d.live" class="mock-badge"><i class="pi pi-flask" /> mock veri</span>
      <Button label="Yenile" icon="pi pi-refresh" outlined :loading="loading" @click="load" />
    </PageHeader>

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
          <div class="bar-chart">
            <div v-for="p in d.growth.weeklyTrend" :key="p.label" class="bar-col">
              <span class="bar-value">{{ p.value }}</span>
              <div class="bar-track"><div class="bar-fill" :style="{ height: `${Math.max(6, pct(p.value, maxTrend))}%` }" /></div>
              <span class="bar-label">{{ p.label }}</span>
            </div>
          </div>
        </article>

        <article class="panel-card pad">
          <div class="panel-title sm"><div><p>WAITLIST KAYNAĞI</p><h2>{{ fmt(d.growth.waitlistTotal) }} kişi</h2></div></div>
          <ul class="src-list">
            <li v-for="s in d.growth.waitlistSources" :key="s.source">
              <div class="src-row"><span class="src-name">{{ s.source }}</span><span class="src-val">{{ fmt(s.count) }} · {{ pct(s.count, waitlistTotalSrc) }}%</span></div>
              <div class="mini-track"><div class="mini-fill violet" :style="{ width: `${pct(s.count, waitlistTotalSrc)}%` }" /></div>
            </li>
          </ul>
          <p class="note-line" v-if="!d.growth.acquisitionTracked"><i class="pi pi-info-circle" /> UTM / ülke / dil kırılımı için kayıt anında alan eklenmeli — henüz toplanmıyor.</p>
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
          <p class="big-sub">kayıt → ilk öğün</p>
          <div class="big-divider" />
          <p class="big-mini">{{ fmt(d.funnel[3]?.value ?? 0) }} kişi <span>gruba katıldı (Soframız)</span></p>
        </article>
      </div>
    </section>

    <!-- ── C. Retention + D. Alışkanlık ── -->
    <section class="growth-block">
      <p class="block-caption">RETENTION & ALIŞKANLIK</p>
      <div class="triple-grid">
        <article class="panel-card pad">
          <div class="panel-title sm"><div><p>KOHORT</p><h2>Retention</h2></div></div>
          <div class="ret-list">
            <div v-for="r in d.retention" :key="r.key" class="ret-row">
              <span class="ret-label">{{ r.label }}</span>
              <div class="ret-track"><div class="ret-fill" :class="retentionColor(r.rate)" :style="{ width: `${r.rate}%` }" /></div>
              <span class="ret-val">%{{ r.rate }}</span>
            </div>
          </div>
          <p class="note-line subtle">Kohort: {{ d.retention.map((r) => `${r.label} ${fmt(r.cohort)}`).join(' · ') }} kişi. Kayıttan sonra geri dönenler (öğün·ölçüm·su).</p>
        </article>

        <article class="panel-card pad">
          <div class="panel-title sm"><div><p>AKTİVİTE</p><h2>Alışkanlık</h2></div></div>
          <div class="dua-row">
            <div class="dua-cell"><strong>{{ fmt(d.habit.dau) }}</strong><small>DAU</small></div>
            <div class="dua-cell"><strong>{{ fmt(d.habit.wau) }}</strong><small>WAU</small></div>
            <div class="dua-cell"><strong>{{ d.habit.avgRhythmDays }}</strong><small>ort. ritim günü</small></div>
          </div>
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
      <article class="panel-card pad">
        <div class="sofra-head">
          <p class="note-line subtle" style="margin:0"><i class="pi pi-bolt" /> {{ d.sofra.instrumented }}/{{ d.sofra.dictionaryTotal }} event bağlı — "ölçemeyeceğimiz özelliği açmayız."</p>
        </div>
        <div class="event-grid">
          <div v-for="e in d.sofra.stats" :key="e.key" class="event-cell" :class="{ dim: !e.live }">
            <div class="event-top"><span class="event-dot" :class="{ on: e.live }" /><span class="event-label">{{ e.label }}</span></div>
            <strong v-if="e.value !== null">{{ fmt(e.value) }}<span class="event-unit">{{ e.unit }}</span></strong>
            <strong v-else class="event-empty">—</strong>
            <small>{{ e.live ? 'canlı' : 'enstrümante değil' }}</small>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>

<script lang="ts">
export default { name: 'GrowthView' }
</script>
