<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import EmptyState from '../../components/EmptyState.vue'
import {
  afiApi, type AskMessage, type AskQuestionGroup, type AskRange, type AskSession, type AskStats,
} from '../../services/afi'

// Bu ekranın asıl işi "cevapsızlar" listesi: bilgi tabanına ne yazılacağının
// listesi odur. En çok sorulanlar aynı sorgunun filtresiz hali.

const rangeOptions: { value: AskRange; label: string }[] = [
  { value: '24h', label: '24 saat' },
  { value: '7d', label: '7 gün' },
  { value: '30d', label: '30 gün' },
  { value: '90d', label: '90 gün' },
]
const modeOptions = [
  { value: 'unanswered', label: 'Cevaplanamayanlar' },
  { value: 'all', label: 'En çok sorulanlar' },
]

const range = ref<AskRange>('7d')
const mode = ref<'unanswered' | 'all'>('unanswered')

const stats = ref<AskStats | null>(null)
const groups = ref<AskQuestionGroup[]>([])
const groupTotal = ref(0)
const groupPage = ref(1)
const loading = ref(false)
const error = ref('')

const sessions = ref<AskSession[]>([])
const sessionTotal = ref(0)
const sessionPage = ref(1)
const sessionsLoading = ref(false)

const transcript = ref<AskMessage[]>([])
const transcriptOpen = ref(false)
const transcriptLoading = ref(false)

const PAGE_SIZE = 20

async function loadStats() {
  loading.value = true
  error.value = ''
  try {
    const [s, q] = await Promise.all([
      afiApi.stats(range.value),
      afiApi.questions({
        range: range.value,
        mode: mode.value === 'unanswered' ? 'unanswered' : undefined,
        page: groupPage.value,
        pageSize: PAGE_SIZE,
      }),
    ])
    stats.value = s
    groups.value = q.items ?? []
    groupTotal.value = q.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Sorular getirilemedi.'
  } finally {
    loading.value = false
  }
}

async function loadSessions() {
  sessionsLoading.value = true
  try {
    const page = await afiApi.sessions({ page: sessionPage.value, pageSize: 10 })
    sessions.value = page.items ?? []
    sessionTotal.value = page.total
  } catch {
    sessions.value = []
  } finally {
    sessionsLoading.value = false
  }
}

async function openTranscript(id: string) {
  transcriptOpen.value = true
  transcriptLoading.value = true
  transcript.value = []
  try {
    const data = await afiApi.transcript(id)
    transcript.value = data.messages ?? []
  } finally {
    transcriptLoading.value = false
  }
}

function onGroupPage(event: DataTablePageEvent) {
  groupPage.value = event.page + 1
  loadStats()
}

function onSessionPage(event: DataTablePageEvent) {
  sessionPage.value = event.page + 1
  loadSessions()
}

// Aralık ya da mod değişince ilk sayfaya dön: dördüncü sayfada durup filtreyi
// değiştirmek boş bir tablo gösterirdi.
watch([range, mode], () => {
  groupPage.value = 1
  loadStats()
})

const pct = (n: number) => `${Math.round(n * 100)}%`
const ms = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)} sn` : `${n} ms`)
const shortDate = (iso: string) =>
  new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

onMounted(() => {
  loadStats()
  loadSessions()
})
</script>

<template>
  <section class="afi-tab">
    <div class="afi-toolbar">
      <SelectButton v-model="range" :options="rangeOptions" option-label="label" option-value="value" :allow-empty="false" />
      <Button label="Yenile" icon="pi pi-refresh" outlined :loading="loading" @click="loadStats" />
    </div>

    <div v-if="stats" class="afi-stats">
      <div class="afi-stat"><small>Soru</small><strong>{{ stats.questions }}</strong></div>
      <div class="afi-stat"><small>Sohbet</small><strong>{{ stats.sessions }}</strong></div>
      <div class="afi-stat">
        <small>Cevaplanma</small>
        <strong :class="{ warn: stats.questions > 0 && stats.answerRate < 0.8 }">{{ pct(stats.answerRate) }}</strong>
      </div>
      <div class="afi-stat"><small>Cevapsız</small><strong :class="{ warn: stats.unanswered > 0 }">{{ stats.unanswered }}</strong></div>
      <div class="afi-stat"><small>Medyan süre</small><strong>{{ ms(stats.medianMs) }}</strong></div>
      <div class="afi-stat"><small>p95 süre</small><strong>{{ ms(stats.p95Ms) }}</strong></div>
    </div>

    <p v-if="error" class="afi-error"><i class="pi pi-exclamation-triangle" /> {{ error }}</p>

    <div class="afi-section-head">
      <h2>Sorular</h2>
      <SelectButton v-model="mode" :options="modeOptions" option-label="label" option-value="value" :allow-empty="false" />
    </div>
    <p class="afi-hint">
      Cevaplanamayan sorular bilgi tabanına ne yazılacağının listesidir. Bir soru burada tekrar
      ediyorsa, karşılığını “Bilgi tabanı” sekmesinde bir belge olarak eklemek doğru cevabı kalıcı kılar.
    </p>

    <DataTable
      :value="groups"
      :loading="loading"
      lazy
      paginator
      :rows="PAGE_SIZE"
      :total-records="groupTotal"
      :first="(groupPage - 1) * PAGE_SIZE"
      data-key="normalized"
      @page="onGroupPage"
    >
      <template #empty>
        <EmptyState
          v-if="!loading"
          icon="pi pi-comments"
          title="Kayıt yok"
          :description="mode === 'unanswered' ? 'Bu aralıkta cevaplanamayan soru yok.' : 'Bu aralıkta hiç soru sorulmamış.'"
        />
      </template>
      <Column field="sample" header="Soru">
        <template #body="{ data }"><span class="afi-question">{{ data.sample }}</span></template>
      </Column>
      <Column field="count" header="Adet" style="width: 90px" />
      <Column header="Cevaplanan" style="width: 130px">
        <template #body="{ data }">
          <Tag
            :value="`${data.answered}/${data.count}`"
            :severity="data.answered === data.count ? 'success' : data.answered === 0 ? 'danger' : 'warn'"
          />
        </template>
      </Column>
      <Column header="Son soruluş" style="width: 160px">
        <template #body="{ data }">{{ shortDate(data.lastAsked) }}</template>
      </Column>
    </DataTable>

    <div class="afi-section-head"><h2>Son sohbetler</h2></div>
    <DataTable
      :value="sessions"
      :loading="sessionsLoading"
      lazy
      paginator
      :rows="10"
      :total-records="sessionTotal"
      :first="(sessionPage - 1) * 10"
      data-key="id"
      @page="onSessionPage"
    >
      <template #empty>
        <EmptyState v-if="!sessionsLoading" icon="pi pi-inbox" title="Sohbet yok" description="Henüz kimse Afi’ye soru sormamış." />
      </template>
      <Column field="firstQuestion" header="İlk soru">
        <template #body="{ data }"><span class="afi-question">{{ data.firstQuestion || '—' }}</span></template>
      </Column>
      <Column field="turns" header="Tur" style="width: 80px" />
      <Column header="Son etkileşim" style="width: 160px">
        <template #body="{ data }">{{ shortDate(data.lastAt) }}</template>
      </Column>
      <Column style="width: 120px">
        <template #body="{ data }">
          <Button label="Döküm" icon="pi pi-eye" text size="small" @click="openTranscript(data.id)" />
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="transcriptOpen" modal header="Sohbet dökümü" :style="{ width: '640px', maxWidth: '94vw' }">
      <div v-if="transcriptLoading" class="afi-loading"><i class="pi pi-spin pi-spinner" /> Yükleniyor…</div>
      <ol v-else class="afi-transcript">
        <li v-for="line in transcript" :key="line.seq" :class="line.role">
          <span class="who">{{ line.role === 'user' ? 'Ziyaretçi' : 'Afi' }}</span>
          <p>{{ line.text }}</p>
          <small v-if="line.role === 'user' && line.answered === false" class="unanswered">cevaplanamadı</small>
        </li>
      </ol>
    </Dialog>
  </section>
</template>

<style scoped>
.afi-tab { display: grid; gap: 18px; padding: 24px; }
.afi-toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }

.afi-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
.afi-stat { padding: 12px 14px; border: 1px solid var(--surface-border, #e6e6e6); border-radius: 12px; background: var(--surface-card, #fff); }
.afi-stat small { display: block; font-size: 11px; font-weight: 800; letter-spacing: .06em; opacity: .65; }
.afi-stat strong { display: block; margin-top: 4px; font-size: 22px; font-variant-numeric: tabular-nums; }
.afi-stat strong.warn { color: #b4541f; }

.afi-section-head { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; margin-top: 6px; }
.afi-section-head h2 { margin: 0; font-size: 16px; }
.afi-hint { margin: 0; font-size: 13px; line-height: 1.5; opacity: .72; max-width: 68ch; }
.afi-error { display: flex; gap: 8px; align-items: center; color: #b4541f; font-size: 13px; }
.afi-loading { display: flex; gap: 8px; align-items: center; padding: 20px; }
.afi-question { display: block; max-width: 60ch; }

.afi-transcript { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.afi-transcript li { padding: 10px 12px; border-radius: 12px; background: var(--surface-100, #f4f4f4); }
.afi-transcript li.afi { background: #eaf6f0; }
.afi-transcript .who { font-size: 10px; font-weight: 900; letter-spacing: .08em; opacity: .6; }
.afi-transcript p { margin: 4px 0 0; white-space: pre-wrap; line-height: 1.5; }
.afi-transcript .unanswered { display: inline-block; margin-top: 6px; color: #b4541f; font-size: 11px; font-weight: 800; }
</style>
