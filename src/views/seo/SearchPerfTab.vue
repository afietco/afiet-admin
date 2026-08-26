<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import SelectButton from 'primevue/selectbutton'
import LineChart from '../../components/LineChart.vue'
import EmptyState from '../../components/EmptyState.vue'
import AdminPlaceholder from '../../components/AdminPlaceholder.vue'
import DiscoverPanel from './DiscoverPanel.vue'
import { analyticsApi, RANGES, type GscData, type Range } from '../../services/analytics'
import { SERIES_COLORS, fmt, shortDate } from '../analytics/shared'

/**
 * Google Search Console performansı. Veri afiet-web'in yerel GSC kopyasından
 * gelir (gsc_daily/gsc_rows; günlük cron doldurur). `connected:false` =
 * servis hesabı yapılandırılmamış, kurulum yönergesi gösterilir.
 */

// Kendi aralık kontrolü: SEO & GEO sekmesinde sayfa üstündeki aralık seçici gizli
const range = ref<Range>('30d')
const rangeOptions = RANGES.map((r) => ({ value: r.value, label: r.label }))

const data = ref<GscData | null>(null)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    data.value = await analyticsApi.search(range.value)
  } catch {
    data.value = null
  } finally {
    loading.value = false
  }
}
onMounted(load)

function setRange(v: Range) {
  if (v === range.value) return
  range.value = v
  load()
}

const cards = computed(() => {
  const t = data.value?.totals
  if (!t) return []
  return [
    { label: 'Tıklama', value: fmt(t.clicks), tone: 'green', icon: 'pi pi-external-link', note: 'Google aramadan gelen' },
    { label: 'Gösterim', value: fmt(t.impressions), tone: 'blue', icon: 'pi pi-eye', note: 'arama sonuçlarında görünme' },
    { label: 'CTR', value: `%${t.ctrPct.toLocaleString('tr-TR')}`, tone: 'amber', icon: 'pi pi-percentage', note: 'tıklama / gösterim' },
    { label: 'Ort. pozisyon', value: t.position > 0 ? t.position.toLocaleString('tr-TR') : '·', tone: 'coral', icon: 'pi pi-sort-numeric-down', note: 'küçük olan iyidir' },
  ]
})

const chartLabels = computed(() => (data.value?.series ?? []).map((p) => shortDate(p.date)))
// Tıklama ile gösterim ölçek olarak apayrı: TEK eksende üst üste bindirilmez,
// yan yana iki küçük grafik (small multiples) çizilir.
const clicksSeries = computed(() => [{ label: 'Tıklama', color: SERIES_COLORS.views, values: (data.value?.series ?? []).map((p) => p.clicks) }])
const impressionsSeries = computed(() => [{ label: 'Gösterim', color: SERIES_COLORS.visitors, values: (data.value?.series ?? []).map((p) => p.impressions) }])
</script>

<template>
  <div class="tab-body">
    <template v-if="data">
      <div class="seo-lead">
        <p class="analytics-note">
          <i class="pi pi-google" /> Google Search Console performansı: afiet.co aramada ne kadar görünüyor, kaç tıklama alıyor.
          <template v-if="data.lastSyncAt"> Son senkron: {{ shortDate(data.lastSyncAt, true) }}.</template>
        </p>
        <SelectButton :model-value="range" :options="rangeOptions" option-label="label" option-value="value" :allow-empty="false" aria-label="Zaman aralığı" @update:model-value="setRange" />
      </div>

      <div v-if="!data.connected" class="db-banner">
        <i class="pi pi-link" />
        <span>GSC bağlantısı henüz kurulmadı. Kurulum: 1) GCP'de servis hesabı açılır, 2) e-postası Search Console'da <strong>sc-domain:afiet.co</strong> mülküne okuma yetkili kullanıcı eklenir, 3) günlük cron veriyi çeker.</span>
      </div>

      <section class="metric-grid" aria-label="Arama performansı özet metrikleri">
        <article v-for="c in cards" :key="c.label" class="metric-card" :class="c.tone">
          <div class="metric-top"><span>{{ c.label }}</span><i :class="c.icon" /></div>
          <strong>{{ c.value }}</strong>
          <div class="metric-foot"><small>{{ c.note }}</small></div>
        </article>
      </section>

      <div class="split-grid">
        <article class="panel-card pad chart-card">
          <div class="panel-title sm"><div><p>ZAMAN SERİSİ</p><h2>Tıklama</h2></div></div>
          <LineChart :labels="chartLabels" :series="clicksSeries" :height="170" />
        </article>
        <article class="panel-card pad chart-card">
          <div class="panel-title sm"><div><p>ZAMAN SERİSİ</p><h2>Gösterim</h2></div></div>
          <LineChart :labels="chartLabels" :series="impressionsSeries" :height="170" />
        </article>
      </div>

      <div class="split-grid gsc-split">
        <section class="table-card">
          <div class="table-toolbar flush" style="padding: 15px 18px"><span class="result-count" style="margin-left: 0">EN ÇOK TIKLANAN SORGULAR</span></div>
          <DataTable :value="data.queries" striped-rows removable-sort :default-sort-order="-1" sort-field="clicks">
            <template #empty><EmptyState icon="pi pi-google" title="Henüz sorgu verisi yok" description="Senkron veri getirdikçe Google'da tıklanan sorgular burada listelenir." /></template>
            <Column header="Sorgu" style="min-width: 9rem" sortable field="key"><template #body="{ data: row }"><span class="path">{{ row.key }}</span></template></Column>
            <Column header="Tıklama" sortable field="clicks"><template #body="{ data: row }"><strong class="num-cell">{{ fmt(row.clicks) }}</strong></template></Column>
            <Column header="Gösterim" sortable field="impressions"><template #body="{ data: row }"><span class="num-cell">{{ fmt(row.impressions) }}</span></template></Column>
            <Column header="CTR" sortable field="ctr"><template #body="{ data: row }"><span class="num-cell">%{{ row.ctr.toLocaleString('tr-TR') }}</span></template></Column>
            <Column header="Poz." sortable field="position"><template #body="{ data: row }"><span class="num-cell">{{ row.position.toLocaleString('tr-TR') }}</span></template></Column>
          </DataTable>
        </section>

        <section class="table-card">
          <div class="table-toolbar flush" style="padding: 15px 18px"><span class="result-count" style="margin-left: 0">EN ÇOK TIKLANAN SAYFALAR</span></div>
          <DataTable :value="data.pages" striped-rows removable-sort :default-sort-order="-1" sort-field="clicks">
            <template #empty><EmptyState icon="pi pi-google" title="Henüz sayfa verisi yok" description="Senkron veri getirdikçe aramadan tıklanan sayfalar burada listelenir." /></template>
            <Column header="Sayfa" style="min-width: 9rem" sortable field="key"><template #body="{ data: row }"><span class="path mono">{{ row.key }}</span></template></Column>
            <Column header="Tıklama" sortable field="clicks"><template #body="{ data: row }"><strong class="num-cell">{{ fmt(row.clicks) }}</strong></template></Column>
            <Column header="Gösterim" sortable field="impressions"><template #body="{ data: row }"><span class="num-cell">{{ fmt(row.impressions) }}</span></template></Column>
            <Column header="CTR" sortable field="ctr"><template #body="{ data: row }"><span class="num-cell">%{{ row.ctr.toLocaleString('tr-TR') }}</span></template></Column>
            <Column header="Poz." sortable field="position"><template #body="{ data: row }"><span class="num-cell">{{ row.position.toLocaleString('tr-TR') }}</span></template></Column>
          </DataTable>
        </section>
      </div>

      <!-- Discover aynı mülkten gelir ama arama DEĞİLDİR: aynı sekmede, kendi
           başlığı ve kendi metrik kümesiyle durur. Ayrı sekme açılmadı; ekran
           24 Ağu 2026'da bilinçle iki sekmeye indirilmişti. Aralık seçici
           yukarıdakiyle ortaktır, remount en ucuz tazeleme yolu (SeoTab deseni). -->
      <DiscoverPanel :key="`discover-${range}`" :range="range" />
    </template>

    <div v-else-if="loading" class="seo-loading"><i class="pi pi-spin pi-spinner" /> Arama performansı yükleniyor…</div>
    <AdminPlaceholder v-else icon="pi pi-google" title="Arama verisi getirilemedi" description="Veri şu an alınamadı. Bağlantını kontrol edip yeniden dene." retryable :loading="loading" @retry="load" />
  </div>
</template>
