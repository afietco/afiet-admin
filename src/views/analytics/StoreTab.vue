<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
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
import AdminPlaceholder from '../../components/AdminPlaceholder.vue'
import { analyticsApi, type StoreData, type StoreEntryInput, type StorePlatform } from '../../services/analytics'
import { parseDelimited } from '../content/metricsImport'
import { SERIES_COLORS, fmt, shortDate, useAnalyticsStore } from './shared'

const PLATFORM_LABEL: Record<string, string> = { ios: 'App Store', android: 'Google Play' }

const { state } = useAnalyticsStore()
const data = ref<StoreData | null>(null)
const loading = ref(false)
const saving = ref(false)
const errorMsg = ref('')

async function load() {
  loading.value = true
  try {
    data.value = await analyticsApi.store(state.range)
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
    { label: 'iOS indirme', value: fmt(t.ios), tone: 'green', icon: 'pi pi-apple', note: 'şimdilik TestFlight kurulumları' },
    { label: 'Android indirme', value: fmt(t.android), tone: 'blue', icon: 'pi pi-android', note: 'Play yayını bekleniyor' },
    { label: 'Mağaza sayfası', value: fmt(t.pageViews), tone: 'amber', icon: 'pi pi-eye', note: 'sayfa görüntüleme (elle)' },
    { label: 'Dönüşüm', value: `%${t.conversionPct}`, tone: 'coral', icon: 'pi pi-percentage', note: 'görüntüleyen → indiren' },
  ]
})

const chartLabels = computed(() => (data.value?.series ?? []).map((p) => shortDate(p.date)))
const chartSeries = computed(() => [
  { label: 'iOS', color: SERIES_COLORS.views, values: (data.value?.series ?? []).map((p) => p.ios) },
  { label: 'Android', color: SERIES_COLORS.visitors, values: (data.value?.series ?? []).map((p) => p.android) },
])

// ── Elle ölçüm ekleme ────────────────────────────────────────────────────────
const dialogOpen = ref(false)
const platformOptions = [
  { value: 'ios', label: 'App Store' },
  { value: 'android', label: 'Google Play' },
]
const form = reactive<{ date: Date | null; platform: StorePlatform; downloads: number | null; pageViews: number | null; note: string }>({
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
  errorMsg.value = ''
  dialogOpen.value = true
}

/** Yerel takvim gününü YYYY-MM-DD yap (toISOString UTC'ye kayar, kullanma). */
function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function saveEntry() {
  if (!formValid.value || !form.date) return
  saving.value = true
  errorMsg.value = ''
  try {
    data.value = await analyticsApi.storePut(
      {
        metricDate: localDay(form.date),
        platform: form.platform,
        downloads: form.downloads ?? 0,
        pageViews: form.pageViews,
        note: form.note.trim(),
        source: 'elle',
      },
      state.range,
    )
    dialogOpen.value = false
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : 'Kaydedilemedi.'
  } finally {
    saving.value = false
  }
}

async function removeEntry(id: number) {
  saving.value = true
  try {
    data.value = await analyticsApi.storeDelete(id, state.range)
  } catch {
    /* satır kalır, kullanıcı yeniden dener */
  } finally {
    saving.value = false
  }
}

// ── CSV içe aktarım ──────────────────────────────────────────────────────────
// Beklenen kolonlar (başlık satırı esnek): tarih, mağaza/platform, indirme,
// sayfa görüntüleme (ops.), not (ops.). Tarih YYYY-MM-DD ya da GG.AA.YYYY.
const importOpen = ref(false)
const importRows = ref<StoreEntryInput[]>([])
const importProblem = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/
const DATE_TR = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/

function parsePlatform(raw: string): StorePlatform | null {
  const v = raw.trim().toLowerCase()
  if (['ios', 'app store', 'appstore', 'apple'].includes(v)) return 'ios'
  if (['android', 'google play', 'play', 'google'].includes(v)) return 'android'
  return null
}

function parseDate(raw: string): string | null {
  const v = raw.trim()
  if (DATE_ISO.test(v)) return v
  const tr = DATE_TR.exec(v)
  if (tr) return `${tr[3]}-${tr[2]!.padStart(2, '0')}-${tr[1]!.padStart(2, '0')}`
  return null
}

function onFile(evt: Event) {
  importProblem.value = ''
  importRows.value = []
  const file = (evt.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const rows = parseDelimited(String(reader.result ?? ''))
      .map((cells) => cells.map((c) => c.trim()))
      .filter((cells) => cells.some(Boolean))
    const out: StoreEntryInput[] = []
    for (const [i, cells] of rows.entries()) {
      const date = parseDate(cells[0] ?? '')
      if (!date) {
        if (i === 0) continue // başlık satırı
        importProblem.value = `Satır ${i + 1}: tarih okunamadı ("${cells[0] ?? ''}").`
        return
      }
      const platform = parsePlatform(cells[1] ?? '')
      if (!platform) {
        importProblem.value = `Satır ${i + 1}: mağaza okunamadı ("${cells[1] ?? ''}"). ios/android ya da App Store/Google Play yaz.`
        return
      }
      const downloads = Number(cells[2] ?? '')
      if (!Number.isInteger(downloads) || downloads < 0) {
        importProblem.value = `Satır ${i + 1}: indirme sayısı okunamadı ("${cells[2] ?? ''}").`
        return
      }
      const pvRaw = (cells[3] ?? '').trim()
      const pageViews = pvRaw === '' || pvRaw === '-' ? null : Number(pvRaw)
      if (pageViews !== null && (!Number.isInteger(pageViews) || pageViews < 0)) {
        importProblem.value = `Satır ${i + 1}: sayfa görüntüleme okunamadı ("${pvRaw}").`
        return
      }
      out.push({ metricDate: date, platform, downloads, pageViews, note: cells[4] ?? '', source: 'csv' })
    }
    if (!out.length) importProblem.value = 'Dosyada okunabilir satır yok.'
    importRows.value = out
  }
  reader.readAsText(file)
}

async function runImport() {
  if (!importRows.value.length) return
  saving.value = true
  importProblem.value = ''
  try {
    const result = await analyticsApi.storeImport(importRows.value, state.range)
    data.value = result.payload
    importOpen.value = false
    importRows.value = []
    if (fileInput.value) fileInput.value.value = ''
  } catch (err) {
    importProblem.value = err instanceof Error ? err.message : 'İçe aktarım başarısız.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="tab-body">
    <template v-if="data">
      <p class="analytics-note">
        <i class="pi pi-shopping-bag" /> App Store &amp; Google Play. Şimdilik <strong>elle/CSV</strong> girilir; mağaza yayınından sonra Connect ve Play API'leri otomatik bağlanacak.
      </p>

      <section class="metric-grid" aria-label="Mağaza özet metrikleri">
        <article v-for="c in cards" :key="c.label" class="metric-card" :class="c.tone">
          <div class="metric-top"><span>{{ c.label }}</span><i :class="c.icon" /></div>
          <strong>{{ c.value }}</strong>
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
            <Button label="CSV içe aktar" icon="pi pi-upload" outlined :disabled="saving" @click="importOpen = true" />
            <Button label="Ölçüm ekle" icon="pi pi-plus" :disabled="saving" @click="openDialog" />
          </span>
        </div>
        <DataTable :value="data.entries" data-key="id" striped-rows removable-sort :default-sort-order="-1" sort-field="metricDate">
          <template #empty><EmptyState icon="pi pi-shopping-bag" title="Bu aralıkta ölçüm yok" description="App Store Connect / Play Console'dan okuduğun günlük sayıları buraya işle." /></template>
          <Column header="Tarih" sortable field="metricDate"><template #body="{ data: row }"><span class="date-cell">{{ shortDate(row.metricDate, true) }}</span></template></Column>
          <Column header="Mağaza" sortable field="platform"><template #body="{ data: row }"><span>{{ PLATFORM_LABEL[row.platform] }}</span></template></Column>
          <Column header="İndirme" sortable field="downloads"><template #body="{ data: row }"><strong class="num-cell">{{ fmt(row.downloads) }}</strong></template></Column>
          <Column header="Sayfa görüntüleme" sortable field="pageViews"><template #body="{ data: row }"><span class="num-cell">{{ row.pageViews === null ? '·' : fmt(row.pageViews) }}</span></template></Column>
          <Column header="Not"><template #body="{ data: row }"><span class="date-cell">{{ row.note }}</span></template></Column>
          <Column header="" style="width: 3rem"><template #body="{ data: row }"><Button icon="pi pi-trash" text severity="danger" size="small" :disabled="saving" aria-label="Sil" @click="removeEntry(row.id)" /></template></Column>
        </DataTable>
      </section>
    </template>

    <div v-else-if="loading" class="seo-loading"><i class="pi pi-spin pi-spinner" /> Mağaza verisi yükleniyor…</div>
    <AdminPlaceholder v-else icon="pi pi-shopping-bag" title="Mağaza verisi getirilemedi" description="Veri şu an alınamadı. Bağlantını kontrol edip yeniden dene." retryable :loading="loading" @retry="load" />

    <Dialog v-model:visible="dialogOpen" modal header="Mağaza ölçümü ekle" :style="{ width: '32rem' }" class="food-dialog">
      <div class="form-grid">
        <div class="form-field span-2"><label>Ölçüm tarihi</label><DatePicker v-model="form.date" date-format="dd.mm.yy" :max-date="new Date()" show-icon icon-display="input" fluid /></div>
        <div class="form-field span-2"><label>Mağaza</label><SelectButton v-model="form.platform" :options="platformOptions" option-label="label" option-value="value" :allow-empty="false" /></div>
        <div class="form-field span-2"><label>İndirme</label><InputNumber v-model="form.downloads" :min="0" fluid /></div>
        <div class="form-field span-2"><label>Sayfa görüntüleme</label><InputNumber v-model="form.pageViews" :min="0" fluid /></div>
        <div class="form-field span-4"><label>Not</label><InputText v-model="form.note" fluid placeholder="ör. beta daveti gönderildi" /></div>
      </div>
      <p v-if="errorMsg" class="field-error" style="margin: 10px 0 0">{{ errorMsg }}</p>
      <template #footer>
        <Button label="Vazgeç" text :disabled="saving" @click="dialogOpen = false" />
        <Button label="Kaydet" icon="pi pi-check" :disabled="!formValid" :loading="saving" @click="saveEntry" />
      </template>
    </Dialog>

    <Dialog v-model:visible="importOpen" modal header="CSV içe aktar" :style="{ width: '32rem' }" class="food-dialog">
      <div class="form-grid">
        <div class="form-field span-4">
          <label>Dosya</label>
          <input ref="fileInput" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" @change="onFile" />
          <small class="field-hint">Kolon sırası: tarih, mağaza (ios/android), indirme, sayfa görüntüleme (boş olabilir), not. Başlık satırı olabilir; ayraç virgül/noktalı virgül/sekme fark etmez.</small>
        </div>
      </div>
      <p v-if="importProblem" class="field-error" style="margin: 10px 0 0">{{ importProblem }}</p>
      <p v-else-if="importRows.length" class="field-hint" style="margin: 10px 0 0">{{ importRows.length }} satır okundu; aynı tarih+mağaza satırları üzerine yazılır.</p>
      <template #footer>
        <Button label="Vazgeç" text :disabled="saving" @click="importOpen = false" />
        <Button label="İçe aktar" icon="pi pi-upload" :disabled="!importRows.length" :loading="saving" @click="runImport" />
      </template>
    </Dialog>
  </div>
</template>
