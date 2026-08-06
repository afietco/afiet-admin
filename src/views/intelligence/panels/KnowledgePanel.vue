<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EmptyState from '../../../components/EmptyState.vue'
import KbTab from '../KbTab.vue'
import { afiApi, type KbIndexStatus } from '../../../services/afi'
import { indexById, searchService, searchTool, type AgentView } from '../../../services/intelligence'

const props = defineProps<{ agent: AgentView; loading: boolean }>()

// Bağ CANLI araç listesinden okunuyor; panelin beklentisinden değil. Ayrışma
// varsa Genel bakış onu ayrıca söylüyor.
const tool = computed(() => searchTool(props.agent.live))
const idx = computed(() => (tool.value?.index ? indexById(tool.value.index) : null))
const liveRead = computed(() =>
  Boolean(props.agent.live && props.agent.live.configured && !props.agent.live.error))

const status = ref<KbIndexStatus | null>(null)
const statusError = ref('')

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`

onMounted(async () => {
  // bilgi-sofrasi'nın sayıları canlı uçtan; uzman dizinleri repo kaynaklı.
  if (!idx.value?.liveCounts) return
  try {
    status.value = await afiApi.kbStatus()
  } catch (err) {
    statusError.value = err instanceof Error ? err.message : 'Durum alınamadı.'
  }
})
</script>

<template>
  <section class="panel-stack">
    <p v-if="loading" class="detail-hint">Ajan tanımı okunuyor…</p>

    <EmptyState
      v-else-if="!tool && liveRead"
      icon="pi pi-database"
      title="Bağlı bilgi tabanı yok"
      description="Foundry'deki tanımda azure_ai_search aracı yok; ajan yalnız kendi talimatına dayanarak cevap veriyor. Arama hizmetinde dizin kotası 3/3 dolu, yeni dizin açmak yeni servis gerektirir."
    />

    <EmptyState
      v-else-if="!tool"
      icon="pi pi-question-circle"
      title="Araç listesi okunamadı"
      :description="agent.expectedIndex
        ? `Bu ajanda ${agent.expectedIndex} dizini bekleniyor ama Foundry tanımı okunamadığı için doğrulanamadı.`
        : 'Foundry tanımı okunamadı, bu yüzden bağlı dizin olup olmadığı bilinmiyor.'"
    />

    <template v-else>
      <div class="bind-card">
        <div class="bind-head">
          <code>{{ tool.index }}</code>
          <span class="bind-tool">
            {{ tool.type }}
            <template v-if="tool.queryType"> · {{ tool.queryType }}</template>
            <template v-if="tool.topK"> · top_k {{ tool.topK }}</template>
          </span>
        </div>
        <div class="bind-nums">
          <div>
            <strong v-if="idx && !idx.liveCounts">{{ idx.documents }}</strong>
            <strong v-else-if="status">{{ status.published }}</strong>
            <strong v-else class="unknown">—</strong>
            <small>belge</small>
          </div>
          <div>
            <strong v-if="idx && !idx.liveCounts">{{ idx.chunks }}</strong>
            <strong v-else-if="status">{{ status.chunks }}</strong>
            <strong v-else class="unknown">—</strong>
            <small>parça</small>
          </div>
          <div><strong class="small">{{ searchService.dimensions }}</strong><small>boyut</small></div>
          <div><strong class="small">{{ searchService.analyzer }}</strong><small>analyzer</small></div>
        </div>
        <template v-if="idx">
          <p class="bind-source">{{ idx.source }}</p>
          <p class="bind-sync"><i class="pi pi-sync" />{{ idx.sync }}</p>
        </template>
        <p v-else class="bind-source unknown">
          Bu dizin panelde tanımlı değil; Foundry'de bağlı ama kaynağı burada kayıtlı değil.
        </p>
      </div>

      <p v-if="statusError" class="detail-error">{{ statusError }}</p>

      <!-- bilgi-sofrasi'nın belgeleri gerçek uçta ve düzenlenebilir; uzman
           dizinleri repodaki md dosyalarından türer, panelden düzenlenmez. -->
      <KbTab v-if="idx?.liveCounts" />

      <template v-else-if="idx?.files">
        <p class="detail-hint">
          Kaynak repoda: <code>{{ idx.source }}</code>. Panelden düzenlenmez; içerik değişince
          senkron scripti koşturulur. Dizin her an silinip yeniden kurulabilir, kaynak md
          dosyalarıdır.
        </p>
        <table class="file-table">
          <thead>
            <tr><th>Belge</th><th>Dosya</th><th class="num">Parça</th><th class="num">Boyut</th></tr>
          </thead>
          <tbody>
            <tr v-for="f in idx.files" :key="f.slug">
              <td>{{ f.title }}</td>
              <td><code>{{ f.slug }}.md</code></td>
              <td class="num">{{ f.chunks }}</td>
              <td class="num muted">{{ kb(f.bytes) }}</td>
            </tr>
          </tbody>
        </table>
      </template>
    </template>
  </section>
</template>

<style scoped>
.panel-stack { display: grid; gap: 16px; padding: 24px; }

.bind-card { padding: 19px 21px; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); }
.bind-head { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: baseline; }
.bind-head code { color: var(--ink); font-size: 15px; font-weight: 850; }
.bind-tool { color: var(--muted); font-size: 11.5px; }
.bind-nums { display: flex; flex-wrap: wrap; gap: 28px; margin-top: 15px; }
.bind-nums strong { font-size: 23px; font-variant-numeric: tabular-nums; }
.bind-nums strong.small { font-size: 14px; font-weight: 800; }
.bind-nums strong.unknown { color: #c2c4bb; }
.bind-nums small { display: block; margin-top: 2px; color: var(--muted); font-size: 10.5px; font-weight: 750; }
.bind-source { margin: 16px 0 0; color: #5b6159; font-size: 12.5px; line-height: 1.55; }
.bind-source.unknown { color: #a3a59c; font-style: italic; }
.bind-sync { display: flex; gap: 8px; align-items: center; margin: 7px 0 0; color: var(--muted); font-size: 12px; }
.bind-sync i { font-size: 11px; }

.detail-hint { margin: 0; max-width: 88ch; color: var(--muted); font-size: 12.5px; line-height: 1.6; }
.detail-hint code { padding: 1px 5px; border-radius: 5px; background: #f0ece0; font-size: 11.5px; overflow-wrap: anywhere; }
.detail-error { margin: 0; color: #b4541f; font-size: 12.5px; }

.file-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.file-table th {
  padding: 8px 10px; border-bottom: 1px solid var(--line);
  color: var(--muted); font-size: 10px; font-weight: 850; letter-spacing: .06em;
  text-align: left; text-transform: uppercase;
}
.file-table td { padding: 9px 10px; border-bottom: 1px solid #f0ece0; }
.file-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.file-table .muted { color: var(--muted); }
.file-table code { color: var(--muted); font-size: 11.5px; }
</style>
