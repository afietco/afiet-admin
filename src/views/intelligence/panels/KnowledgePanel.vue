<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import EmptyState from '../../../components/EmptyState.vue'
import KbTab from '../KbTab.vue'
import { afiApi, type KbIndexStatus } from '../../../services/afi'
import { indexById, searchService, type Agent } from '../../../services/intelligence'

const props = defineProps<{ agent: Agent }>()

const idx = computed(() => (props.agent.index ? indexById(props.agent.index.indexId) : null))

const live = ref<KbIndexStatus | null>(null)
const liveError = ref('')

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`

onMounted(async () => {
  if (!idx.value?.liveCounts) return
  try {
    live.value = await afiApi.kbStatus()
  } catch (err) {
    liveError.value = err instanceof Error ? err.message : 'Durum alınamadı.'
  }
})
</script>

<template>
  <section class="panel-stack">
    <EmptyState
      v-if="!agent.index || !idx"
      icon="pi pi-database"
      title="Bağlı bilgi tabanı yok"
      description="Bu ajanın azure_ai_search aracı tanımlı değil; yalnız kendi talimatına dayanarak cevap veriyor. Arama hizmetinde dizin kotası 3/3 dolu, yeni dizin açmak yeni servis gerektirir."
    />

    <template v-else>
      <div class="bind-card">
        <div class="bind-head">
          <code>{{ idx.id }}</code>
          <span class="bind-tool">azure_ai_search · {{ agent.index.queryType }} · top_k {{ agent.index.topK }}</span>
        </div>
        <div class="bind-nums">
          <div>
            <strong v-if="!idx.liveCounts">{{ idx.documents }}</strong>
            <strong v-else-if="live">{{ live.published }}</strong>
            <strong v-else class="unknown">—</strong>
            <small>belge</small>
          </div>
          <div>
            <strong v-if="!idx.liveCounts">{{ idx.chunks }}</strong>
            <strong v-else-if="live">{{ live.chunks }}</strong>
            <strong v-else class="unknown">—</strong>
            <small>parça</small>
          </div>
          <div>
            <strong class="small">{{ searchService.dimensions }}</strong>
            <small>boyut</small>
          </div>
          <div>
            <strong class="small">{{ searchService.analyzer }}</strong>
            <small>analyzer</small>
          </div>
        </div>
        <p class="bind-source">{{ idx.source }}</p>
        <p class="bind-sync"><i class="pi pi-sync" />{{ idx.sync }}</p>
      </div>

      <p v-if="liveError" class="detail-error">{{ liveError }}</p>

      <!-- bilgi-sofrasi'nin belgeleri gerçek uçta ve düzenlenebilir; uzman
           dizinleri repodaki md dosyalarından türer, panelden düzenlenmez. -->
      <KbTab v-if="idx.liveCounts" />

      <template v-else>
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
.panel-stack { display: grid; gap: 16px; }

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
