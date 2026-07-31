<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import PageHeader from '../../components/PageHeader.vue'
import EmptyState from '../../components/EmptyState.vue'
import AdminPlaceholder from '../../components/AdminPlaceholder.vue'
import BetaDetail from './BetaDetail.vue'
import { betaApi, label, type BetaAdminPayload, type BetaApplication, type Tally } from '../../services/beta'

const toast = useToast()
const data = ref<BetaAdminPayload | null>(null)
const loading = ref(false)
const error = ref('')

const query = ref('')
const platform = ref('')
const goal = ref('')
const selected = ref<BetaApplication | null>(null)
const detailOpen = ref(false)

const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' })
const date = (value: string) => dateFmt.format(new Date(value))
const time = (value: string) => timeFmt.format(new Date(value))
const num = (value: number) => value.toLocaleString('tr-TR')
const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0)
const sum = (rows: Tally[]) => rows.reduce((total, row) => total + row.count, 0)

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await betaApi.get()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Beta başvuruları alınamadı.'
  } finally {
    loading.value = false
  }
}

const platformCount = (key: string) => data.value?.summary.platform.find((row) => row.key === key)?.count ?? 0

const cards = computed(() => {
  const payload = data.value
  if (!payload) return []
  return [
    { label: 'Toplam başvuru', value: num(payload.total), foot: 'landing formundan', tone: 'green', icon: 'pi pi-inbox' },
    { label: 'Son 7 gün', value: num(payload.summary.last7d), foot: 'yeni başvuru', tone: 'blue', icon: 'pi pi-calendar' },
    {
      label: 'Platform', value: `${num(platformCount('ios'))} / ${num(platformCount('android'))}`,
      foot: 'iPhone / Android', tone: 'amber', icon: 'pi pi-mobile',
    },
    {
      label: 'İletişim izni', value: `%${pct(payload.summary.consented, payload.total)}`,
      foot: `${num(payload.summary.consented)} kişi izin verdi`, tone: 'coral', icon: 'pi pi-verified',
    },
  ]
})

/**
 * Kırılımlar iki gruba ayrıldı: "kim bunlar" (hedef, kalori geçmişi, kaynak,
 * iletişim) ve "neyle geliyorlar" (kullandıkları uygulamalar). Önceki düzende
 * altı özdeş kart alt alta duruyordu ve hangisinin neyi anlattığı ancak
 * başlığı okuyunca ayırt ediliyordu.
 */
type Block = { caption: string; title: string; icon: string; tone: string; rows: Tally[]; fn: (key: string) => string }

const audienceBlocks = computed<Block[]>(() => {
  const payload = data.value
  if (!payload) return []
  return [
    { caption: 'HEDEF', title: 'Ne daha çok istiyorlar?', icon: 'pi pi-compass', tone: 'green', rows: payload.summary.goals, fn: label.goal },
    { caption: 'KALORİ GEÇMİŞİ', title: 'Kalori uygulaması hissi', icon: 'pi pi-heart', tone: 'coral', rows: payload.summary.counting, fn: label.counting },
    { caption: 'KAYNAK', title: 'Nereden duydular?', icon: 'pi pi-megaphone', tone: 'blue', rows: payload.summary.heard, fn: label.heard },
  ]
})

const appColumns = computed(() => {
  const payload = data.value
  if (!payload) return []
  return [
    { title: 'Kalori / beslenme', rows: payload.summary.apps.nutrition },
    { title: 'Spor / adım', rows: payload.summary.apps.activity },
    { title: 'Vücut / cihaz', rows: payload.summary.apps.body },
  ]
})

const platformOptions = [
  { value: '', label: 'Tüm platformlar' },
  { value: 'ios', label: 'iPhone' },
  { value: 'android', label: 'Android' },
  { value: 'unknown', label: 'Belirtmedi' },
]

const goalOptions = computed(() => [
  { value: '', label: 'Tüm hedefler' },
  ...(data.value?.summary.goals ?? []).map((row) => ({ value: row.key, label: label.goal(row.key) })),
])

const rows = computed(() => {
  const items = data.value?.items ?? []
  const search = query.value.trim().toLocaleLowerCase('tr')
  return items.filter((row) => {
    if (search && !row.email.toLocaleLowerCase('tr').includes(search)) return false
    if (platform.value && (row.platform || 'unknown') !== platform.value) return false
    if (goal.value && !row.goals.includes(goal.value)) return false
    return true
  })
})

const filtered = computed(() => Boolean(query.value.trim() || platform.value || goal.value))

function reset() {
  query.value = ''
  platform.value = ''
  goal.value = ''
}

function open(application: BetaApplication) {
  selected.value = application
  detailOpen.value = true
}

/** Tabloda seçilen uygulamaları etiketlerle göster; "hiçbiri" gürültüsünü ayıkla. */
function usedApps(row: BetaApplication): string[] {
  const codes = [...row.appsNutrition, ...row.appsActivity, ...row.appsBody].filter((code) => code && code !== 'hicbiri')
  const out = codes.map(label.app)
  if (row.appsOther) out.push(row.appsOther)
  return out
}

function exportCsv() {
  const items = rows.value
  if (!items.length) return
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
  const header = ['id', 'email', 'platform', 'hedefler', 'kalori_hissi', 'beslenme_app', 'aktivite_app', 'vucut_app', 'diger_app', 'iletisim', 'nereden', 'onay', 'tarih']
  const body = items.map((row) =>
    [
      row.id,
      row.email,
      label.platform(row.platform || 'unknown'),
      row.goals.map(label.goal).join('; '),
      row.countingFeeling ? label.counting(row.countingFeeling) : '',
      row.appsNutrition.map(label.app).join('; '),
      row.appsActivity.map(label.app).join('; '),
      row.appsBody.map(label.app).join('; '),
      row.appsOther,
      row.contactChannel ? label.contact(row.contactChannel) : '',
      row.heardFrom ? label.heard(row.heardFrom) : '',
      row.consent ? 'evet' : 'hayır',
      row.createdAt,
    ].map(escape).join(','),
  )
  const csv = [header.join(','), ...body].join('\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
  link.download = `afiet-beta-basvurulari-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
  if ((data.value?.total ?? 0) > (data.value?.items.length ?? 0)) {
    toast.add({
      severity: 'warn',
      summary: `${num(items.length)} kayıt indirildi`,
      detail: 'Sunucu en yeni kayıtları veriyor; tamamı için sayfalı export ucu gerekir.',
      life: 4500,
    })
  }
}

onMounted(load)
</script>

<template>
  <div class="page-wrap">
    <PageHeader
      eyebrow="WEB BAŞVURUSU"
      title="Beta başvuruları"
      description="Landing formundan gelen başvurular: kim, ne istiyor, bugün neyle takip ediyor."
    >
      <Button label="CSV indir" icon="pi pi-download" outlined :disabled="!rows.length" @click="exportCsv" />
      <Button label="Yenile" icon="pi pi-refresh" outlined :loading="loading" @click="load" />
    </PageHeader>

    <div v-if="error" class="error-banner">
      <i class="pi pi-exclamation-circle" /><span>{{ error }}</span>
      <button @click="load">Tekrar dene</button>
    </div>

    <div v-if="loading && !data" class="seo-loading"><i class="pi pi-spin pi-spinner" /> Başvurular yükleniyor…</div>

    <AdminPlaceholder
      v-else-if="data && !data.dbConnected"
      icon="pi pi-database"
      title="Veritabanı bağlı değil"
      description="Beta başvuruları afiet-web'in Neon veritabanında saklanır. Bağlantı kurulunca başvurular burada görünecek."
      retryable
      :loading="loading"
      @retry="load"
    />

    <template v-else-if="data">
      <section class="metric-grid" aria-label="Başvuru özeti">
        <article v-for="card in cards" :key="card.label" class="metric-card" :class="card.tone">
          <div class="metric-top"><span>{{ card.label }}</span><i :class="card.icon" /></div>
          <strong>{{ card.value }}</strong>
          <small>{{ card.foot }}</small>
        </article>
      </section>

      <p class="block-caption">BAŞVURANLAR</p>
      <div class="triple-grid beta-blocks">
        <article v-for="block in audienceBlocks" :key="block.caption" class="panel-card pad">
          <div class="panel-title sm">
            <div><p>{{ block.caption }}</p><h2>{{ block.title }}</h2></div>
            <i :class="block.icon" class="panel-glyph" />
          </div>
          <ul v-if="block.rows.length" class="src-list tight">
            <li v-for="row in block.rows" :key="row.key">
              <div class="src-row">
                <span class="src-name">{{ block.fn(row.key) }}</span>
                <span class="src-val">{{ num(row.count) }} · %{{ pct(row.count, sum(block.rows)) }}</span>
              </div>
              <div class="mini-track">
                <div class="mini-fill" :class="block.tone" :style="{ width: `${String(pct(row.count, sum(block.rows)))}%` }" />
              </div>
            </li>
          </ul>
          <p v-else class="muted-status">Henüz veri yok.</p>
        </article>
      </div>

      <p class="block-caption">BUGÜN NE KULLANIYORLAR</p>
      <section class="panel-card pad app-panel beta-blocks">
        <div class="app-columns">
          <div v-for="column in appColumns" :key="column.title" class="app-column">
            <p class="mini-cap">{{ column.title.toLocaleUpperCase('tr') }}</p>
            <ul v-if="column.rows.length" class="src-list tight">
              <li v-for="row in column.rows.slice(0, 6)" :key="row.key">
                <div class="src-row">
                  <span class="src-name">{{ label.app(row.key) }}</span>
                  <span class="src-val">{{ num(row.count) }}</span>
                </div>
                <div class="mini-track">
                  <div class="mini-fill green" :style="{ width: `${String(pct(row.count, sum(column.rows)))}%` }" />
                </div>
              </li>
            </ul>
            <p v-else class="muted-status">Henüz veri yok.</p>
          </div>
        </div>
        <p class="note-line">
          <i class="pi pi-info-circle" />
          Bir kişi birden çok uygulama seçebilir, yüzdeler toplamı 100'ü aşar. "Hiçbiri" cevabı da bir cevaptır ve listede durur.
        </p>
      </section>

      <section class="table-card" style="margin-top: 22px">
        <div class="table-toolbar">
          <span class="search-box">
            <i class="pi pi-search" />
            <InputText v-model="query" placeholder="E-posta ara…" />
          </span>
          <Select
            v-model="platform"
            :options="platformOptions"
            option-label="label"
            option-value="value"
            placeholder="Tüm platformlar"
          />
          <Select
            v-model="goal"
            :options="goalOptions"
            option-label="label"
            option-value="value"
            placeholder="Tüm hedefler"
          />
          <Button v-if="filtered" label="Temizle" icon="pi pi-times" text severity="secondary" @click="reset" />
          <span class="result-count">
            {{ num(rows.length) }} / {{ num(data.items.length) }} başvuru
            <template v-if="data.sampled < data.total"> · en yeni {{ num(data.sampled) }} kayıt</template>
          </span>
        </div>

        <DataTable
          :value="rows"
          :loading="loading"
          data-key="id"
          paginator
          :rows="20"
          :rows-per-page-options="[10, 20, 50]"
          removable-sort
          row-hover
          class="clickable-rows"
          @row-click="open(($event.data as BetaApplication))"
        >
          <template #empty>
            <EmptyState
              icon="pi pi-inbox"
              :title="filtered ? 'Bu filtreyle başvuru yok' : 'Başvuru yok'"
              :description="filtered ? 'Filtreleri temizleyip tekrar dene.' : 'Landing\'deki beta formundan gelen ilk başvuru burada görünecek.'"
            />
          </template>

          <Column header="Başvuran" sortable field="email" style="min-width: 17rem">
            <template #body="{ data: row }">
              <div class="email-cell">
                <span>{{ row.email[0].toLocaleUpperCase('tr') }}</span>
                <div>
                  <strong>{{ row.email }}</strong>
                  <small>#{{ row.id }} · {{ row.consent ? 'izin verdi' : 'izin yok' }}</small>
                </div>
              </div>
            </template>
          </Column>

          <Column header="Platform" sortable field="platform" style="width: 7.5rem">
            <template #body="{ data: row }">
              <Tag
                :value="label.platform(row.platform || 'unknown')"
                :severity="row.platform === 'ios' ? 'info' : row.platform === 'android' ? 'success' : 'secondary'"
              />
            </template>
          </Column>

          <Column header="Hedefler" style="min-width: 14rem">
            <template #body="{ data: row }">
              <div v-if="row.goals.length" class="tag-wrap">
                <Tag v-for="key in row.goals.slice(0, 2)" :key="key" :value="label.goal(key)" severity="secondary" />
                <span v-if="row.goals.length > 2" class="more-count">+{{ row.goals.length - 2 }}</span>
              </div>
              <span v-else class="drawer-none">—</span>
            </template>
          </Column>

          <Column header="Kalori geçmişi" style="min-width: 11rem">
            <template #body="{ data: row }">
              <span class="wrap-cell">{{ row.countingFeeling ? label.counting(row.countingFeeling) : '—' }}</span>
            </template>
          </Column>

          <Column header="Uygulama" style="width: 7rem">
            <template #body="{ data: row }">
              <span class="measure-pill">{{ usedApps(row).length }}</span>
            </template>
          </Column>

          <Column header="Tarih" sortable field="createdAt" style="min-width: 10rem">
            <template #body="{ data: row }">
              <span class="date-cell">{{ date(row.createdAt) }}<em class="cell-time">{{ time(row.createdAt) }}</em></span>
            </template>
          </Column>

          <Column header="" frozen align-frozen="right" style="width: 4rem">
            <template #body="{ data: row }">
              <div class="row-actions">
                <Button icon="pi pi-arrow-right" text rounded aria-label="Başvuru detayı" @click.stop="open(row)" />
              </div>
            </template>
          </Column>
        </DataTable>
      </section>

      <p class="scope-note">
        <i class="pi pi-lock" />
        Başvuru verileri yalnızca yetkili admin oturumuyla afiet-web API'sinden okunur. Kilo ve kalori sorulmaz, toplanmaz.
      </p>

      <BetaDetail v-model:visible="detailOpen" :application="selected" />
    </template>
  </div>
</template>

<style scoped>
.tag-wrap { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
.wrap-cell { display: inline-block; line-height: 1.4; }
.more-count { color: #9a9c94; font-size: 10px; font-weight: 800; }
.cell-time { display: block; margin-top: 2px; color: #a5a79d; font-size: 9px; font-style: normal; }
</style>

<script lang="ts">
export default { name: 'BetaView' }
</script>
