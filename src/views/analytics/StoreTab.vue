<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import LineChart from '../../components/LineChart.vue'
import EmptyState from '../../components/EmptyState.vue'
import { storeMock, type StoreEntry } from './mock'
import { SERIES_COLORS, fmt, shortDate, useAnalyticsStore } from './shared'

const PLATFORM_LABEL: Record<string, string> = { ios: 'App Store', android: 'Google Play' }

const { state } = useAnalyticsStore()
const data = computed(() => storeMock(state.range))

// Elle girilen satırlar (önizleme: yerelde tutulur, backend bağlanınca kalıcı olur)
const localEntries = ref<StoreEntry[]>([])
const entries = computed(() => [...localEntries.value, ...data.value.entries])

const cards = computed(() => [
  { label: 'iOS indirme', value: data.value.totals.ios, tone: 'green', icon: 'pi pi-apple', note: 'şimdilik TestFlight kurulumları' },
  { label: 'Android indirme', value: data.value.totals.android, tone: 'blue', icon: 'pi pi-android', note: 'Play yayını bekleniyor' },
  { label: 'Mağaza sayfası', value: data.value.totals.pageViews, tone: 'amber', icon: 'pi pi-eye', note: 'sayfa görüntüleme (elle)' },
  { label: 'Dönüşüm', value: data.value.totals.conversionPct, tone: 'coral', icon: 'pi pi-percentage', note: 'görüntüleyen → indiren', suffix: '%' },
])

const chartLabels = computed(() => data.value.series.map((p) => shortDate(p.date)))
const chartSeries = computed(() => [
  { label: 'iOS', color: SERIES_COLORS.views, values: data.value.series.map((p) => p.ios) },
  { label: 'Android', color: SERIES_COLORS.visitors, values: data.value.series.map((p) => p.android) },
])

// ── Elle ölçüm ekleme ────────────────────────────────────────────────────────
const dialogOpen = ref(false)
const platformOptions = [
  { value: 'ios', label: 'App Store' },
  { value: 'android', label: 'Google Play' },
]
const form = reactive<{ date: Date | null; platform: 'ios' | 'android'; downloads: number | null; pageViews: number | null; note: string }>({
  date: null,
  platform: 'ios',
  downloads: null,
  pageViews: null,
  note: '',
})

const formValid = computed(() => !!form.date && form.downloads !== null && form.downloads >= 0)

function openDialog() {
  form.date = new Date()
  form.platform = 'ios'
  form.downloads = null
  form.pageViews = null
  form.note = ''
  dialogOpen.value = true
}

function saveEntry() {
  if (!formValid.value || !form.date) return
  localEntries.value.unshift({
    date: form.date.toISOString().slice(0, 10),
    platform: form.platform,
    downloads: form.downloads ?? 0,
    pageViews: form.pageViews,
    note: form.note.trim() || null,
    source: 'elle',
  })
  dialogOpen.value = false
}
</script>

<template>
  <div class="tab-body">
    <p class="analytics-note">
      <i class="pi pi-shopping-bag" /> App Store &amp; Google Play. Şimdilik <strong>elle/CSV</strong> girilir; mağaza yayınından sonra Connect ve Play API'leri otomatik bağlanacak.
      <span class="preview-badge">önizleme verisi</span>
    </p>

    <section class="metric-grid" aria-label="Mağaza özet metrikleri">
      <article v-for="c in cards" :key="c.label" class="metric-card" :class="c.tone">
        <div class="metric-top"><span>{{ c.label }}</span><i :class="c.icon" /></div>
        <strong>{{ fmt(c.value) }}{{ c.suffix ?? '' }}</strong>
        <div class="metric-foot"><small>{{ c.note }}</small></div>
      </article>
    </section>

    <article class="panel-card pad chart-card">
      <div class="panel-title sm"><div><p>ZAMAN SERİSİ</p><h2>Günlük indirme</h2></div><span class="legend"><span class="lg views" /> iOS <span class="lg visitors" /> Android</span></div>
      <LineChart :labels="chartLabels" :series="chartSeries" :height="210" />
    </article>

    <section class="table-card">
      <div class="table-toolbar">
        <span class="result-count" style="margin-left: 0">ELLE GİRİLEN ÖLÇÜMLER</span>
        <span style="margin-left: auto; display: inline-flex; gap: 10px">
          <Button label="CSV içe aktar" icon="pi pi-upload" outlined disabled v-tooltip.bottom="'Backend bağlanınca açılır'" />
          <Button label="Ölçüm ekle" icon="pi pi-plus" @click="openDialog" />
        </span>
      </div>
      <DataTable :value="entries" striped-rows removable-sort :default-sort-order="-1" sort-field="date">
        <template #empty><EmptyState icon="pi pi-shopping-bag" title="Henüz ölçüm yok" description="App Store Connect / Play Console'dan okuduğun günlük sayıları buraya işle." /></template>
        <Column header="Tarih" sortable field="date"><template #body="{ data: row }"><span class="date-cell">{{ shortDate(row.date, true) }}</span></template></Column>
        <Column header="Mağaza" sortable field="platform"><template #body="{ data: row }"><span>{{ PLATFORM_LABEL[row.platform] }}</span></template></Column>
        <Column header="İndirme" sortable field="downloads"><template #body="{ data: row }"><strong class="num-cell">{{ fmt(row.downloads) }}</strong></template></Column>
        <Column header="Sayfa görüntüleme" sortable field="pageViews"><template #body="{ data: row }"><span class="num-cell">{{ row.pageViews === null ? '·' : fmt(row.pageViews) }}</span></template></Column>
        <Column header="Not"><template #body="{ data: row }"><span class="date-cell">{{ row.note ?? '' }}</span></template></Column>
      </DataTable>
    </section>

    <Dialog v-model:visible="dialogOpen" modal header="Mağaza ölçümü ekle" :style="{ width: '32rem' }" class="food-dialog">
      <div class="form-grid">
        <div class="form-field span-2"><label>Ölçüm tarihi</label><DatePicker v-model="form.date" date-format="dd.mm.yy" :max-date="new Date()" show-icon icon-display="input" fluid /></div>
        <div class="form-field span-2"><label>Mağaza</label><SelectButton v-model="form.platform" :options="platformOptions" option-label="label" option-value="value" :allow-empty="false" /></div>
        <div class="form-field span-2"><label>İndirme</label><InputNumber v-model="form.downloads" :min="0" fluid /></div>
        <div class="form-field span-2"><label>Sayfa görüntüleme</label><InputNumber v-model="form.pageViews" :min="0" fluid /></div>
        <div class="form-field span-4"><label>Not</label><InputText v-model="form.note" fluid placeholder="ör. beta daveti gönderildi" /></div>
      </div>
      <template #footer>
        <Button label="Vazgeç" text @click="dialogOpen = false" />
        <Button label="Kaydet" icon="pi pi-check" :disabled="!formValid" @click="saveEntry" />
      </template>
    </Dialog>
  </div>
</template>
