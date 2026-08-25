<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import LineChart from '../../components/LineChart.vue'
import EmptyState from '../../components/EmptyState.vue'
import { analyticsApi, type GscDiscoverData, type Range } from '../../services/analytics'
import { SERIES_COLORS, fmt, shortDate } from '../analytics/shared'

/**
 * Google Discover performansı. Arama performansının ALTINDA, kendi başlığıyla
 * durur: aynı Search Console mülkünden gelir ama arama değildir ve metrik
 * kümesi de farklıdır (ORTALAMA POZİSYON YOK, sorgu boyutu yok).
 *
 * EKRANDAKİ TEK KURAL: `measured:false` iken burada SIFIR YAZMAZ, "ölçüm yok"
 * yazar. Search Console arayüzü Discover raporunu eşik altında hiç
 * göstermezken API sıfır dolu satırlar döndürüyor; o satırları "0 gösterim"
 * diye çizmek, ölçülmemiş bir yüzey için ölçülmüş gibi duran bir grafik
 * üretirdi. Ayrım uçtan `measured` ile gelir, burada uydurulmaz.
 */

const props = defineProps<{ range: Range }>()

const data = ref<GscDiscoverData | null>(null)
const loading = ref(false)
const failed = ref(false)

async function load() {
  loading.value = true
  failed.value = false
  try {
    data.value = await analyticsApi.discover(props.range)
  } catch {
    data.value = null
    failed.value = true
  } finally {
    loading.value = false
  }
}
onMounted(load)
defineExpose({ load })

const chartLabels = computed(() => (data.value?.series ?? []).map((p) => shortDate(p.date)))
const clicksSeries = computed(() => [
  { label: 'Tıklama', color: SERIES_COLORS.views, values: (data.value?.series ?? []).map((p) => p.clicks) },
])
const impressionsSeries = computed(() => [
  { label: 'Gösterim', color: SERIES_COLORS.visitors, values: (data.value?.series ?? []).map((p) => p.impressions) },
])

const cards = computed(() => {
  const t = data.value?.totals
  if (!t) return []
  return [
    { label: 'Tıklama', value: fmt(t.clicks), tone: 'green', icon: 'pi pi-external-link', note: "Discover akışından gelen" },
    { label: 'Gösterim', value: fmt(t.impressions), tone: 'blue', icon: 'pi pi-eye', note: 'akışta görünme' },
    { label: 'CTR', value: `%${t.ctrPct.toLocaleString('tr-TR')}`, tone: 'amber', icon: 'pi pi-percentage', note: 'tıklama / gösterim' },
  ]
})
</script>

<template>
  <section class="discover-block">
    <div class="panel-title sm discover-head">
      <div>
        <p>GOOGLE DISCOVER</p>
        <h2>Akış performansı</h2>
      </div>
    </div>

    <div v-if="loading && !data" class="seo-loading"><i class="pi pi-spin pi-spinner" /> Discover verisi yükleniyor…</div>

    <EmptyState
      v-else-if="failed"
      icon="pi pi-compass"
      title="Discover verisi getirilemedi"
      description="Veri şu an alınamadı. Sekmenin üstündeki Yenile ile tekrar dene."
    />

    <template v-else-if="data">
      <!-- Ölçüm yok: sayı basılmaz. Hangi ölçümsüzlük olduğu ayrı cümledir,
           çünkü biri kurulum eksiği, biri arıza, biri de normal beklemedir. -->
      <EmptyState
        v-if="!data.measured"
        icon="pi pi-compass"
        :title="!data.connected ? 'GSC bağlantısı kurulmadı' : data.lastSyncAt ? 'Discover ölçümü yok' : 'Senkron henüz çalışmadı'"
        :description="
          !data.connected
            ? 'Servis hesabı yapılandırılmadan Discover verisi çekilemez.'
            : data.lastSyncAt
              ? `Senkron çalışıyor (son: ${shortDate(data.lastSyncAt, true)}) ama Google bu mülk için sıfırdan büyük bir Discover ölçümü döndürmedi. Bu sıfır demek değil, henüz ölçüm yok demektir: Discover raporu bir gösterim eşiğinin altında oluşmaz.`
              : 'Günlük senkron bu mülkte henüz hiç çalışmadı.'
        "
      />

      <template v-else>
        <p class="analytics-note discover-note">
          <i class="pi pi-compass" /> Google Discover akışı: yazılar aramada değil, ilgi akışında ne kadar görünüyor.
          Discover'da <strong>ortalama pozisyon ve arama sorgusu yoktur</strong>, o yüzden bu bölümde o iki sütun bulunmaz.
          <template v-if="data.lastSyncAt"> Son senkron: {{ shortDate(data.lastSyncAt, true) }}.</template>
        </p>

        <section class="metric-grid" aria-label="Discover özet metrikleri">
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
            <div class="table-toolbar flush" style="padding: 15px 18px"><span class="result-count" style="margin-left: 0">DISCOVER'DA EN ÇOK GÖRÜNEN SAYFALAR</span></div>
            <DataTable :value="data.pages" striped-rows removable-sort :default-sort-order="-1" sort-field="impressions">
              <template #empty><EmptyState icon="pi pi-compass" title="Henüz sayfa verisi yok" description="Discover akışında gösterim aldıkça sayfalar burada listelenir." /></template>
              <Column header="Sayfa" style="min-width: 9rem" sortable field="key"><template #body="{ data: row }"><span class="path mono">{{ row.key }}</span></template></Column>
              <Column header="Gösterim" sortable field="impressions"><template #body="{ data: row }"><strong class="num-cell">{{ fmt(row.impressions) }}</strong></template></Column>
              <Column header="Tıklama" sortable field="clicks"><template #body="{ data: row }"><span class="num-cell">{{ fmt(row.clicks) }}</span></template></Column>
              <Column header="CTR" sortable field="ctr"><template #body="{ data: row }"><span class="num-cell">%{{ row.ctr.toLocaleString('tr-TR') }}</span></template></Column>
            </DataTable>
          </section>

          <section class="table-card">
            <div class="table-toolbar flush" style="padding: 15px 18px"><span class="result-count" style="margin-left: 0">ÜLKELERE GÖRE</span></div>
            <DataTable :value="data.countries" striped-rows removable-sort :default-sort-order="-1" sort-field="impressions">
              <template #empty><EmptyState icon="pi pi-compass" title="Henüz ülke verisi yok" description="Discover akışında gösterim aldıkça ülke kırılımı burada listelenir." /></template>
              <!-- GSC ülkeyi ISO alpha-3 küçük harf verir ("tur"). Türkçe ada
                   çevrilmiyor: panelin mevcut COUNTRY_LABEL tablosu alpha-2
                   anahtarlı, yani ikinci bir eşleme tablosu gerekirdi ve
                   Discover bu mülkte henüz hiç ölçüm vermedi. Ülke adı gerçek
                   veri geldiğinde eklenir; o güne kadar kod OLDUĞU GİBİ, yalnız
                   büyük harfle gösterilir (kırık bir kelime gibi durmasın). -->
              <Column header="Ülke" style="min-width: 9rem" sortable field="key"><template #body="{ data: row }"><span class="path mono">{{ row.key.toUpperCase() }}</span></template></Column>
              <Column header="Gösterim" sortable field="impressions"><template #body="{ data: row }"><strong class="num-cell">{{ fmt(row.impressions) }}</strong></template></Column>
              <Column header="Tıklama" sortable field="clicks"><template #body="{ data: row }"><span class="num-cell">{{ fmt(row.clicks) }}</span></template></Column>
              <Column header="CTR" sortable field="ctr"><template #body="{ data: row }"><span class="num-cell">%{{ row.ctr.toLocaleString('tr-TR') }}</span></template></Column>
            </DataTable>
          </section>
        </div>
      </template>
    </template>
  </section>
</template>

<style scoped>
.discover-block { margin-top: 26px; display: grid; gap: 14px; }
/* Arama bölümünden görsel olarak ayrılır: aynı sekmede ama başka bir yüzey. */
.discover-head { border-top: 1px solid #e6ece7; padding-top: 20px; }
.discover-note { margin: 0; }
</style>
