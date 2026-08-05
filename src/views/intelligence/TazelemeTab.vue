<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import Tag from 'primevue/tag'
import EmptyState from '../../components/EmptyState.vue'
import { afiApi, type KbIndexStatus, type KbRun } from '../../services/afi'

// Tazeleme, Neon'daki korpusu Azure index'iyle uzlaştırır. Uç 202 döner ve iş
// ayrık koşar, o yüzden sonuç ancak koşu listesinden görülür.

const toast = useToast()
const PAGE_SIZE = 10

const status = ref<KbIndexStatus | null>(null)
const runs = ref<KbRun[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const starting = ref(false)

let poll: ReturnType<typeof setTimeout> | undefined

async function load() {
  loading.value = true
  try {
    const [st, list] = await Promise.all([
      afiApi.kbStatus(),
      afiApi.runs({ page: page.value, pageSize: PAGE_SIZE }),
    ])
    status.value = st
    runs.value = list.items ?? []
    total.value = list.total
  } catch (err) {
    toast.add({
      severity: 'error', summary: 'Durum alınamadı',
      detail: err instanceof Error ? err.message : '', life: 4000,
    })
  } finally {
    loading.value = false
  }
  schedulePoll()
}

// Süren bir koşu varsa kısa aralıkla tazele, yoksa hiç yoklama yapma. Sürekli
// yoklama bu ekranın bedava olmasını engellerdi.
function schedulePoll() {
  clearTimeout(poll)
  if (runs.value.some((r) => r.status === 'running')) {
    poll = setTimeout(load, 5000)
  }
}

async function start() {
  starting.value = true
  try {
    await afiApi.refresh()
    toast.add({
      severity: 'success', summary: 'Tazeleme başladı',
      detail: 'Koşu arka planda sürüyor, sonucu bu listede görünecek.', life: 4000,
    })
    page.value = 1
    await load()
  } catch (err) {
    toast.add({
      severity: 'error', summary: 'Tazeleme başlatılamadı',
      detail: err instanceof Error ? err.message : '', life: 5000,
    })
  } finally {
    starting.value = false
  }
}

function onPage(event: DataTablePageEvent) {
  page.value = event.page + 1
  load()
}

const mb = (bytes: number | null) => (bytes == null ? '—' : `${(bytes / 1048576).toFixed(2)} MB`)
const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const duration = (run: KbRun) => {
  if (!run.finishedAt) return '—'
  const secs = Math.round((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000)
  return secs >= 60 ? `${Math.floor(secs / 60)} dk ${secs % 60} sn` : `${secs} sn`
}

onMounted(load)
onBeforeUnmount(() => clearTimeout(poll))
</script>

<template>
  <section class="afi-tab">
    <div class="afi-toolbar">
      <Button label="Şimdi tazele" icon="pi pi-sync" :loading="starting" @click="start" />
      <Button label="Yenile" icon="pi pi-refresh" outlined :loading="loading" @click="load" />
    </div>

    <div v-if="status" class="afi-stats">
      <div class="afi-stat"><small>Belge</small><strong>{{ status.documents }}</strong></div>
      <div class="afi-stat"><small>Yayında</small><strong>{{ status.published }}</strong></div>
      <div class="afi-stat">
        <small>Index bekleyen</small>
        <strong :class="{ warn: status.stale > 0 }">{{ status.stale }}</strong>
      </div>
      <div class="afi-stat"><small>Parça</small><strong>{{ status.chunks }}</strong></div>
      <div class="afi-stat"><small>Boyut</small><strong>{{ mb(status.chunkBytes) }}</strong></div>
      <div class="afi-stat"><small>Son senkron</small><strong class="small">{{ shortDate(status.lastSynced) }}</strong></div>
    </div>

    <p class="afi-hint">
      Tazeleme, SSS ve blog yazılarını toplayıp bilgi tabanına yazar, sonra yayındaki belgeleri Azure
      index’ine gönderir. İçeriği değişmemiş belgeye dokunulmaz. Haftalık olarak pazartesi 04:00 UTC’de
      kendiliğinden koşar; buradan elle de tetiklenebilir. Aynı anda tek koşu çalışır.
    </p>

    <DataTable
      :value="runs"
      :loading="loading"
      lazy
      paginator
      :rows="PAGE_SIZE"
      :total-records="total"
      :first="(page - 1) * PAGE_SIZE"
      data-key="id"
      @page="onPage"
    >
      <template #empty>
        <EmptyState
          v-if="!loading"
          icon="pi pi-sync"
          title="Koşu yok"
          description="Henüz hiç tazeleme yapılmamış. “Şimdi tazele” ile ilk koşuyu başlatabilirsin."
        />
      </template>
      <Column header="Durum" style="width: 130px">
        <template #body="{ data }">
          <Tag
            :value="data.status === 'succeeded' ? 'Başarılı' : data.status === 'failed' ? 'Başarısız' : 'Sürüyor'"
            :severity="data.status === 'succeeded' ? 'success' : data.status === 'failed' ? 'danger' : 'info'"
          />
        </template>
      </Column>
      <Column header="Başlangıç" style="width: 150px">
        <template #body="{ data }">{{ shortDate(data.startedAt) }}</template>
      </Column>
      <Column header="Süre" style="width: 100px">
        <template #body="{ data }">{{ duration(data) }}</template>
      </Column>
      <Column header="Belge" style="width: 170px">
        <template #body="{ data }">
          <span class="run-counts">
            <span v-if="data.docsCreated">+{{ data.docsCreated }} yeni</span>
            <span v-if="data.docsUpdated">{{ data.docsUpdated }} güncel</span>
            <span v-if="data.docsArchived">-{{ data.docsArchived }} çıkan</span>
            <span v-if="!data.docsCreated && !data.docsUpdated && !data.docsArchived" class="muted">değişiklik yok</span>
          </span>
        </template>
      </Column>
      <Column header="Parça" style="width: 130px">
        <template #body="{ data }">
          <span class="run-counts">
            <span v-if="data.chunksUpserted">{{ data.chunksUpserted }} yazıldı</span>
            <span v-if="data.chunksDeleted">{{ data.chunksDeleted }} silindi</span>
            <span v-if="!data.chunksUpserted && !data.chunksDeleted" class="muted">—</span>
          </span>
        </template>
      </Column>
      <Column header="Index" style="width: 130px">
        <template #body="{ data }">
          <span v-if="data.indexDocuments != null" class="run-counts">
            <span>{{ data.indexDocuments }} parça</span>
            <span class="muted">{{ mb(data.indexBytes) }}</span>
          </span>
          <span v-else class="muted">—</span>
        </template>
      </Column>
      <Column header="Tetikleyen" style="width: 120px">
        <template #body="{ data }">{{ data.trigger === 'scheduler' ? 'Zamanlayıcı' : data.triggeredBy || 'Panel' }}</template>
      </Column>
      <Column header="Not">
        <template #body="{ data }">
          <span v-if="data.error" class="run-error">{{ data.error }}</span>
          <span v-else-if="data.note" class="muted">{{ data.note }}</span>
          <span v-else class="muted">—</span>
        </template>
      </Column>
    </DataTable>
  </section>
</template>

<style scoped>
.afi-tab { display: grid; gap: 16px; padding: 24px; }
.afi-toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.afi-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
.afi-stat { padding: 12px 14px; border: 1px solid var(--surface-border, #e6e6e6); border-radius: 12px; background: var(--surface-card, #fff); }
.afi-stat small { display: block; font-size: 11px; font-weight: 800; letter-spacing: .06em; opacity: .65; }
.afi-stat strong { display: block; margin-top: 4px; font-size: 22px; font-variant-numeric: tabular-nums; }
.afi-stat strong.small { font-size: 13px; font-weight: 700; }
.afi-stat strong.warn { color: #b4541f; }
.afi-hint { margin: 0; font-size: 13px; line-height: 1.5; opacity: .72; max-width: 74ch; }

.run-counts { display: grid; gap: 2px; font-size: 12px; font-variant-numeric: tabular-nums; }
.run-counts .muted { opacity: .55; }
.run-error { color: #b4541f; font-size: 12px; line-height: 1.4; display: block; max-width: 40ch; }
.muted { opacity: .55; }
</style>
