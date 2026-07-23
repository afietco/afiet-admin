<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import PageHeader from '../../components/PageHeader.vue'
import EmptyState from '../../components/EmptyState.vue'
import AdminPlaceholder from '../../components/AdminPlaceholder.vue'
import { betaApi, label, type BetaAdminPayload, type BetaApplication, type Tally } from '../../services/beta'

const toast = useToast()
const data = ref<BetaAdminPayload | null>(null)
const loading = ref(false)
const error = ref('')

const date = (value: string) =>
  new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0)
const sum = (rows: Tally[]) => rows.reduce((s, r) => s + r.count, 0)

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

const platformCount = (key: string) => data.value?.summary.platform.find((t) => t.key === key)?.count ?? 0

const cards = computed(() => {
  const d = data.value
  if (!d) return []
  return [
    { label: 'Toplam başvuru', value: d.total, tone: 'green', icon: 'pi pi-inbox' },
    { label: 'Son 7 gün', value: d.summary.last7d, tone: 'blue', icon: 'pi pi-calendar' },
    { label: 'iPhone', value: platformCount('ios'), tone: 'amber', icon: 'pi pi-apple' },
    { label: 'Android', value: platformCount('android'), tone: 'coral', icon: 'pi pi-android' },
  ]
})

type Block = { caption: string; title: string; icon: string; tone: string; rows: Tally[]; fn: (k: string) => string }
const insightBlocks = computed<Block[]>(() => {
  const d = data.value
  if (!d) return []
  return [
    { caption: 'HEDEF', title: 'Ne daha çok istiyorlar?', icon: 'pi pi-compass', tone: 'green', rows: d.summary.goals, fn: label.goal },
    { caption: 'KALORİ GEÇMİŞİ', title: 'Kalori uygulaması hissi', icon: 'pi pi-heart', tone: 'coral', rows: d.summary.counting, fn: label.counting },
    { caption: 'KAYNAK', title: 'Nereden duydular?', icon: 'pi pi-megaphone', tone: 'blue', rows: d.summary.heard, fn: label.heard },
  ]
})
const appBlocks = computed<Block[]>(() => {
  const d = data.value
  if (!d) return []
  return [
    { caption: 'KALORİ / BESLENME', title: 'Beslenme uygulamaları', icon: 'pi pi-calculator', tone: 'green', rows: d.summary.apps.nutrition, fn: label.app },
    { caption: 'SPOR / ADIM', title: 'Aktivite uygulamaları', icon: 'pi pi-bolt', tone: 'blue', rows: d.summary.apps.activity, fn: label.app },
    { caption: 'VÜCUT / CİHAZ', title: 'Cihaz & tartı', icon: 'pi pi-tablet', tone: 'coral', rows: d.summary.apps.body, fn: label.app },
  ]
})

// Tabloda: seçili uygulamaları etiketlerle, "hiçbiri" gürültüsünü ayıkla, serbest yazıyı ekle.
function usedApps(row: BetaApplication): string[] {
  const codes = [...row.appsNutrition, ...row.appsActivity, ...row.appsBody].filter((c) => c && c !== 'hicbiri')
  const out = codes.map(label.app)
  if (row.appsOther) out.push(row.appsOther)
  return out
}

function exportCsv() {
  const rows = data.value?.items ?? []
  if (!rows.length) return
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
  const header = ['id', 'email', 'platform', 'hedefler', 'kalori_hissi', 'beslenme_app', 'aktivite_app', 'vucut_app', 'diger_app', 'iletisim', 'nereden', 'onay', 'tarih']
  const body = rows.map((r) =>
    [
      r.id,
      r.email,
      label.platform(r.platform || 'unknown'),
      r.goals.map(label.goal).join('; '),
      r.countingFeeling ? label.counting(r.countingFeeling) : '',
      r.appsNutrition.map(label.app).join('; '),
      r.appsActivity.map(label.app).join('; '),
      r.appsBody.map(label.app).join('; '),
      r.appsOther,
      r.contactChannel ? label.contact(r.contactChannel) : '',
      r.heardFrom ? label.heard(r.heardFrom) : '',
      r.consent ? 'evet' : 'hayır',
      r.createdAt,
    ]
      .map(escape)
      .join(','),
  )
  const csv = [header.join(','), ...body].join('\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }))
  link.download = `afiet-beta-basvurulari-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
  if ((data.value?.total ?? 0) > rows.length) {
    toast.add({ severity: 'warn', summary: `İlk ${rows.length} kayıt indirildi`, detail: 'Daha büyük dışa aktarım için sayfalı export ucu gerekir.', life: 4500 })
  }
}

onMounted(load)
</script>

<template>
  <div class="page-wrap">
    <PageHeader eyebrow="WEB BAŞVURUSU" title="Beta başvuruları" description="Landing formundan gelen beta başvurularını, hedeflerini ve kullandıkları takip uygulamalarını takip et.">
      <Button label="CSV indir" icon="pi pi-download" outlined :disabled="!data?.items.length" @click="exportCsv" />
      <Button label="Yenile" icon="pi pi-refresh" outlined :loading="loading" @click="load" />
    </PageHeader>

    <div v-if="error" class="error-banner"><i class="pi pi-exclamation-circle" /><span>{{ error }}</span><button @click="load">Tekrar dene</button></div>

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
      <!-- Özet metrikler -->
      <section class="metric-grid" aria-label="Özet metrikler">
        <article v-for="c in cards" :key="c.label" class="metric-card" :class="c.tone">
          <div class="metric-top"><span>{{ c.label }}</span><i :class="c.icon" /></div>
          <strong>{{ c.value.toLocaleString('tr-TR') }}</strong>
          <div class="metric-foot"><small>başvuru</small></div>
        </article>
      </section>

      <!-- Kırılımlar -->
      <div class="triple-grid">
        <article v-for="b in insightBlocks" :key="b.caption" class="panel-card pad">
          <div class="panel-title sm"><div><p>{{ b.caption }}</p><h2>{{ b.title }}</h2></div><i :class="b.icon" class="panel-glyph" /></div>
          <ul v-if="b.rows.length" class="src-list tight">
            <li v-for="row in b.rows" :key="row.key">
              <div class="src-row"><span class="src-name">{{ b.fn(row.key) }}</span><span class="src-val">{{ row.count }} · {{ pct(row.count, sum(b.rows)) }}%</span></div>
              <div class="mini-track"><div class="mini-fill" :class="b.tone" :style="{ width: `${pct(row.count, sum(b.rows))}%` }" /></div>
            </li>
          </ul>
          <p v-else class="muted-status">Henüz veri yok.</p>
        </article>
      </div>

      <!-- Kullandıkları uygulamalar -->
      <div class="triple-grid">
        <article v-for="b in appBlocks" :key="b.caption" class="panel-card pad">
          <div class="panel-title sm"><div><p>{{ b.caption }}</p><h2>{{ b.title }}</h2></div><i :class="b.icon" class="panel-glyph" /></div>
          <ul v-if="b.rows.length" class="src-list tight">
            <li v-for="row in b.rows" :key="row.key">
              <div class="src-row"><span class="src-name">{{ b.fn(row.key) }}</span><span class="src-val">{{ row.count }} · {{ pct(row.count, sum(b.rows)) }}%</span></div>
              <div class="mini-track"><div class="mini-fill" :class="b.tone" :style="{ width: `${pct(row.count, sum(b.rows))}%` }" /></div>
            </li>
          </ul>
          <p v-else class="muted-status">Henüz veri yok.</p>
        </article>
      </div>

      <!-- Başvuru listesi -->
      <section class="table-card">
        <div class="table-toolbar">
          <span class="result-count">{{ data.total.toLocaleString('tr-TR') }} başvuru</span>
          <span v-if="data.sampled < data.total" class="muted-status">En yeni {{ data.sampled }} tanesi gösteriliyor</span>
        </div>
        <DataTable :value="data.items" :loading="loading" paginator :rows="20" :rows-per-page-options="[10, 20, 50]" removable-sort>
          <template #empty><EmptyState icon="pi pi-inbox" title="Başvuru yok" description="Landing'deki beta formundan gelen ilk başvuru burada görünecek." /></template>
          <Column header="#" style="width: 4.5rem"><template #body="{ data: r }"><span class="id-cell">{{ r.id }}</span></template></Column>
          <Column field="email" header="E-posta" sortable style="min-width: 17rem"><template #body="{ data: r }"><div class="email-cell"><span>{{ r.email[0].toUpperCase() }}</span><strong>{{ r.email }}</strong></div></template></Column>
          <Column header="Platform" style="min-width: 7rem"><template #body="{ data: r }"><Tag :value="label.platform(r.platform || 'unknown')" :severity="r.platform === 'ios' ? 'info' : r.platform === 'android' ? 'success' : 'secondary'" /></template></Column>
          <Column header="Hedefler" style="min-width: 15rem"><template #body="{ data: r }"><span class="wrap-cell">{{ r.goals.map(label.goal).join(', ') || '—' }}</span></template></Column>
          <Column header="Kalori geçmişi" style="min-width: 12rem"><template #body="{ data: r }"><span class="wrap-cell">{{ r.countingFeeling ? label.counting(r.countingFeeling) : '—' }}</span></template></Column>
          <Column header="Kullandığı uygulamalar" style="min-width: 18rem">
            <template #body="{ data: r }">
              <div v-if="usedApps(r).length" class="tag-wrap"><Tag v-for="a in usedApps(r)" :key="a" :value="a" severity="secondary" /></div>
              <span v-else class="wrap-cell">—</span>
            </template>
          </Column>
          <Column header="İletişim" style="min-width: 9rem"><template #body="{ data: r }"><span class="wrap-cell">{{ r.contactChannel ? label.contact(r.contactChannel) : '—' }}</span></template></Column>
          <Column header="Tarih" sortable field="createdAt" style="min-width: 13rem"><template #body="{ data: r }"><span class="date-cell">{{ date(r.createdAt) }}</span></template></Column>
        </DataTable>
      </section>

      <p class="scope-note"><i class="pi pi-lock" /> Başvuru verileri yalnızca yetkili admin oturumuyla afiet-web API'sinden okunur. Kilo/kalori toplanmaz.</p>
    </template>
  </div>
</template>

<style scoped>
.tag-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.wrap-cell {
  display: inline-block;
  line-height: 1.4;
}
</style>

<script lang="ts">
export default { name: 'BetaView' }
</script>
