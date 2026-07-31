<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import LineChart from '../../components/LineChart.vue'
import EmptyState from '../../components/EmptyState.vue'
import AdminPlaceholder from '../../components/AdminPlaceholder.vue'
import { analyticsApi, type InstagramData } from '../../services/analytics'
import { SERIES_COLORS, fmt, shortDate, useAnalyticsStore } from './shared'

const FORMAT_LABEL: Record<string, string> = { reel: 'Reel', carousel: 'Carousel', story: 'Story', post: 'Gönderi' }

const { state } = useAnalyticsStore()
const data = ref<InstagramData | null>(null)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    data.value = await analyticsApi.instagram(state.range)
  } catch {
    data.value = null
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(() => state.range, load)

const cards = computed(() => {
  const t = data.value?.totals
  if (!t) return []
  return [
    { label: 'Görüntülenme', value: t.views, tone: 'green', icon: 'pi pi-eye', note: 'aralıktaki artış' },
    { label: 'Erişim', value: t.reach, tone: 'blue', icon: 'pi pi-wifi', note: 'aralıktaki artış' },
    { label: 'Etkileşim', value: t.interactions, tone: 'amber', icon: 'pi pi-heart', note: 'beğeni + yorum + kaydetme + paylaşım' },
    { label: 'Gönderi', value: t.posts, tone: 'coral', icon: 'pi pi-images', note: 'aralıkta yayınlanan' },
  ]
})

const chartLabels = computed(() => (data.value?.series ?? []).map((p) => shortDate(p.date)))
const chartSeries = computed(() => [
  { label: 'Görüntülenme', color: SERIES_COLORS.views, values: (data.value?.series ?? []).map((p) => p.views) },
  { label: 'Erişim', color: SERIES_COLORS.visitors, values: (data.value?.series ?? []).map((p) => p.reach) },
])
</script>

<template>
  <div class="tab-body">
    <template v-if="data">
      <p class="analytics-note">
        <i class="pi pi-instagram" /> Kaynak: İçerik ölçümleri (elle/CSV girişi + günlük Instagram senkronu). Seri, ardışık ölçümler arasındaki artıştan türetilir; gönderi tablosu son ölçümün ömür toplamıdır.
      </p>

      <section class="metric-grid" aria-label="Instagram özet metrikleri">
        <article v-for="c in cards" :key="c.label" class="metric-card" :class="c.tone">
          <div class="metric-top"><span>{{ c.label }}</span><i :class="c.icon" /></div>
          <strong>{{ fmt(c.value) }}</strong>
          <div class="metric-foot"><small>{{ c.note }}</small></div>
        </article>
      </section>

      <article class="panel-card pad chart-card">
        <div class="panel-title sm"><div><p>ZAMAN SERİSİ</p><h2>Görüntülenme & erişim</h2></div><span class="legend"><span class="lg views" /> görüntülenme <span class="lg visitors" /> erişim</span></div>
        <LineChart :labels="chartLabels" :series="chartSeries" :height="210" />
      </article>

      <section class="table-card">
        <DataTable :value="data.posts" data-key="itemId" striped-rows removable-sort :default-sort-order="-1" sort-field="views">
          <template #empty><EmptyState icon="pi pi-instagram" title="Henüz gönderi ölçümü yok" description="İçerik takvimindeki Instagram gönderileri ölçüm aldıkça burada listelenir. Elle giriş: İçerik → etkinlik → Ölçümler." /></template>
          <Column header="Gönderi" style="min-width: 20rem" sortable field="title">
            <template #body="{ data: row }"><div class="page-cell"><span class="path">{{ row.title }}</span><small>{{ FORMAT_LABEL[row.format] ?? row.format }}<template v-if="row.publishedAt"> · {{ shortDate(row.publishedAt, true) }}</template> · ölçüm {{ shortDate(row.measuredAt) }}</small></div></template>
          </Column>
          <Column header="Görüntülenme" sortable field="views"><template #body="{ data: row }"><strong class="num-cell">{{ fmt(row.views) }}</strong></template></Column>
          <Column header="Erişim" sortable field="reach"><template #body="{ data: row }"><span class="num-cell">{{ fmt(row.reach) }}</span></template></Column>
          <Column header="Beğeni" sortable field="likes"><template #body="{ data: row }"><span class="num-cell">{{ fmt(row.likes) }}</span></template></Column>
          <Column header="Yorum" sortable field="comments"><template #body="{ data: row }"><span class="num-cell">{{ fmt(row.comments) }}</span></template></Column>
          <Column header="Kaydetme" sortable field="saved"><template #body="{ data: row }"><span class="num-cell">{{ fmt(row.saved) }}</span></template></Column>
          <Column header="Paylaşım" sortable field="shares"><template #body="{ data: row }"><span class="num-cell">{{ fmt(row.shares) }}</span></template></Column>
        </DataTable>
      </section>
    </template>

    <div v-else-if="loading" class="seo-loading"><i class="pi pi-spin pi-spinner" /> Instagram verisi yükleniyor…</div>
    <AdminPlaceholder v-else icon="pi pi-instagram" title="Instagram verisi getirilemedi" description="Veri şu an alınamadı. Bağlantını kontrol edip yeniden dene." retryable :loading="loading" @retry="load" />
  </div>
</template>
