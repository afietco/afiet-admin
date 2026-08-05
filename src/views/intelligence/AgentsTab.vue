<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Tag from 'primevue/tag'
import {
  agentCopy, effortLabel, mergeAgents, searchService, searchTool, wiringMeta, zekaApi,
  type AgentView,
} from '../../services/intelligence'

// Ajanlar bağlı olanlar önce gelecek şekilde sıralanıyor: panelin ilk ekranı
// "şu an üründe ne çalışıyor" sorusunu cevaplamalı, Foundry envanterini değil.
// Tablo removable-sort ile geldiği için kullanıcı sıralamayı kaldırdığında bu
// varsayılan düzen geri gelir.
const order = { live: 0, partial: 1, unwired: 2 }

/** Paginator bu eşiğin üstünde açılır: 10-20 satır tek ekranda okunur kalsın. */
const PAGE_SIZE = 15

const router = useRouter()
const rows = ref<AgentView[]>(mergeAgents([]))
const loading = ref(true)
const configured = ref(true)
const error = ref('')

const sorted = computed(() => [...rows.value].sort((a, b) => order[a.wiring] - order[b.wiring]))

const counts = computed(() => ({
  live: agentCopy.filter((a) => a.wiring === 'live').length,
  unwired: agentCopy.filter((a) => a.wiring === 'unwired').length,
}))

const severity = (w: keyof typeof order) =>
  wiringMeta[w].severity === 'success' ? 'success' : wiringMeta[w].severity === 'warn' ? 'warn' : 'info'

/** Bağlı dizin: canlı araçtan; okunamadıysa beklenen dizin ayrı dille. */
function indexCell(agent: AgentView) {
  const tool = searchTool(agent.live)
  if (tool?.index) return { text: tool.index, unknown: false }
  if (agent.live && !agent.live.error && agent.live.configured) {
    // Tanım okundu ve araç yok: gerçekten dizinsiz.
    return { text: 'yok', unknown: true }
  }
  if (agent.expectedIndex) return { text: `${agent.expectedIndex} (beklenen)`, unknown: true }
  return { text: 'okunmadı', unknown: true }
}

/**
 * Tablo satırı: sıralama sütun başlığından yapıldığı için canlı alanlar burada
 * düzleştiriliyor. Okunamayan alan boş string kalır; böylece sıralamada
 * "okunmadı" satırları bir uçta toplanır, sahte bir değer uydurulmaz.
 */
type AgentRow = {
  id: string
  agent: AgentView
  label: string
  code: string
  purpose: string
  statusLabel: string
  statusOrder: number
  statusSeverity: 'success' | 'warn' | 'info'
  model: string
  version: string
  pinned: boolean
  effort: string
  indexText: string
  indexUnknown: boolean
  surface: string
  surfaceIcon: string
}

const tableRows = computed<AgentRow[]>(() => sorted.value.map((agent) => {
  const index = indexCell(agent)
  return {
    id: agent.id,
    agent,
    label: agent.label,
    code: agent.live?.name || agent.id,
    purpose: agent.purpose,
    statusLabel: wiringMeta[agent.wiring].label,
    statusOrder: order[agent.wiring],
    statusSeverity: severity(agent.wiring),
    model: agent.live?.model ?? '',
    version: agent.live?.version ?? '',
    pinned: Boolean(agent.live?.pinnedVersion),
    effort: effortLabel(agent.live?.effort),
    indexText: index.text,
    indexUnknown: index.unknown,
    surface: agent.surface,
    surfaceIcon: agent.surface.startsWith('Web') ? 'pi pi-globe' : 'pi pi-mobile',
  }
}))

/** Bağlı olmayan ajan bozuk değil, sadece henüz bir yüzü yok: soluk değil ayrı. */
function rowClass(data: AgentRow) {
  return data.agent.wiring === 'unwired' ? 'row-unwired' : ''
}

function open(row: AgentRow) {
  router.push({ name: 'agent-detail', params: { agentId: row.id } })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await zekaApi.agents()
    rows.value = mergeAgents(data.items ?? [])
    configured.value = data.configured
  } catch (err) {
    // Canlı veri gelmese de tablo durmalı: ürün kopyası panelde yaşıyor.
    rows.value = mergeAgents([])
    error.value = err instanceof Error ? err.message : 'Ajan listesi alınamadı.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="zeka-tab">
    <div v-if="!configured && !loading" class="notice warn">
      <i class="pi pi-info-circle" />
      <p>
        Bu ortamda Foundry anahtarı yapılandırılmamış. Ajanların model, sürüm, effort ve araç
        bilgileri okunamıyor; aşağıdaki tablo yalnız ürün tarafındaki bilgiyi gösteriyor.
      </p>
    </div>
    <div v-if="error" class="notice error">
      <i class="pi pi-exclamation-triangle" />
      <p>{{ error }}</p>
    </div>

    <div class="zeka-stats">
      <div class="zeka-stat"><small>Ajan</small><strong>{{ agentCopy.length }}</strong></div>
      <div class="zeka-stat"><small>Üründe canlı</small><strong>{{ counts.live }}</strong></div>
      <div class="zeka-stat">
        <small>Bağlı değil</small><strong :class="{ idle: counts.unwired > 0 }">{{ counts.unwired }}</strong>
      </div>
      <div class="zeka-stat">
        <small>Arama dizini</small>
        <strong :class="{ warn: searchService.indexUsed >= searchService.indexQuota }">
          {{ searchService.indexUsed }}/{{ searchService.indexQuota }}
        </strong>
      </div>
      <div class="zeka-stat">
        <small>Dizin deposu</small>
        <strong class="small">{{ searchService.storageUsedMb }} / {{ searchService.storageQuotaMb }} MB</strong>
      </div>
    </div>

    <section class="table-card agents-table">
      <DataTable
        :value="tableRows"
        :loading="loading"
        data-key="id"
        :paginator="tableRows.length > PAGE_SIZE"
        :rows="PAGE_SIZE"
        :rows-per-page-options="[15, 25, 50]"
        :row-class="rowClass"
        removable-sort
        row-hover
        class="clickable-rows"
        @row-click="open($event.data as AgentRow)"
      >
        <template #empty>
          <p class="table-empty">Gösterilecek ajan yok.</p>
        </template>

        <Column header="Ajan" sortable sort-field="label" style="min-width: 17rem">
          <template #body="{ data }">
            <div class="user-cell" v-tooltip.top="data.purpose">
              <span><i class="pi pi-sparkles" /></span>
              <div>
                <strong>{{ data.label }}</strong>
                <small>{{ data.code }}</small>
              </div>
            </div>
          </template>
        </Column>

        <Column header="Durum" sortable sort-field="statusOrder" style="width: 8rem">
          <template #body="{ data }">
            <Tag
              :value="data.statusLabel"
              :severity="data.statusSeverity"
              v-tooltip.top="data.agent.wiringNote"
            />
          </template>
        </Column>

        <Column header="Model" sortable sort-field="model" style="min-width: 10rem">
          <template #body="{ data }">
            <span v-if="loading" class="cell-loading">···</span>
            <span v-else-if="data.model" class="cell-value">{{ data.model }}</span>
            <span v-else class="cell-unknown">okunmadı</span>
          </template>
        </Column>

        <Column header="Sürüm" sortable sort-field="version" style="width: 7rem">
          <template #body="{ data }">
            <span v-if="loading" class="cell-loading">···</span>
            <span v-else-if="data.version" class="cell-value tabular">
              v{{ data.version }}
              <i v-if="data.pinned" class="pi pi-lock pin" v-tooltip.top="'Sürüm sabitli'" />
            </span>
            <span v-else class="cell-unknown">okunmadı</span>
          </template>
        </Column>

        <Column header="Effort" sortable sort-field="effort" style="width: 7rem">
          <template #body="{ data }">
            <span v-if="loading" class="cell-loading">···</span>
            <span v-else-if="data.effort" class="cell-value">{{ data.effort }}</span>
            <span v-else class="cell-unknown">okunmadı</span>
          </template>
        </Column>

        <Column header="Bilgi tabanı" sortable sort-field="indexText" style="min-width: 11rem">
          <template #body="{ data }">
            <span v-if="loading" class="cell-loading">···</span>
            <span v-else :class="data.indexUnknown ? 'cell-unknown' : 'cell-value'">{{ data.indexText }}</span>
          </template>
        </Column>

        <Column header="Uygulamadaki yüzü" sortable sort-field="surface" style="min-width: 15rem">
          <template #body="{ data }">
            <span class="date-cell surface-cell"><i :class="data.surfaceIcon" />{{ data.surface }}</span>
          </template>
        </Column>

        <Column header="" style="width: 4rem">
          <template #body="{ data }">
            <div class="row-actions">
              <Button
                icon="pi pi-arrow-right"
                text
                rounded
                aria-label="Ajan detayı"
                @click.stop="open(data as AgentRow)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </section>
  </section>
</template>

<style scoped>
.zeka-tab { display: grid; gap: 18px; }

.notice { display: flex; gap: 11px; align-items: flex-start; padding: 13px 15px; border-radius: 14px; }
.notice p { margin: 0; max-width: 88ch; font-size: 12.5px; line-height: 1.55; }
.notice i { margin-top: 2px; font-size: 14px; }
.notice.warn { border: 1px solid #e8d9b4; background: #fdf7e8; color: #6b5a34; }
.notice.warn i { color: var(--amber); }
.notice.error { border: 1px solid #f0dcd7; background: #fdf5f3; color: #7a4437; }
.notice.error i { color: var(--coral); }

.zeka-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
.zeka-stat { padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--paper); }
.zeka-stat small { display: block; color: var(--muted); font-size: 11px; font-weight: 800; letter-spacing: .06em; }
.zeka-stat strong { display: block; margin-top: 4px; font-size: 22px; font-variant-numeric: tabular-nums; }
.zeka-stat strong.small { font-size: 13px; font-weight: 800; }
.zeka-stat strong.warn { color: #b4541f; }
.zeka-stat strong.idle { color: var(--muted); }

/* Sekme içindeki tablo dar ekranda kırpılmasın: .table-card overflow: hidden. */
.agents-table { overflow-x: auto; }

/* 10-20 satırda tarama kolaylığı için satır yüksekliği biraz daha kompakt. */
.agents-table :deep(.p-datatable-tbody > tr > td) { padding-top: 9px; padding-bottom: 9px; }
.agents-table :deep(.user-cell > span) { width: 32px; height: 32px; font-size: 13px; }
.agents-table :deep(.user-cell) { gap: 10px; }
/* Bağlı olmayan ajan soluk değil ayrı: solukluk "bozuk" okunur, oysa bunlar
   sağlam ajanlar, sadece henüz bir yüzleri yok. */
.agents-table :deep(.row-unwired > td) { background: #faf7ee; }

.cell-value { display: inline-flex; gap: 5px; align-items: center; color: var(--ink); font-size: 12px; font-weight: 750; }
.cell-unknown { color: #a3a59c; font-size: 12px; font-weight: 650; font-style: italic; }
.cell-loading { color: #c2c4bb; font-size: 12px; letter-spacing: .1em; }
.pin { color: var(--green); font-size: 9px; }

.surface-cell { display: inline-flex; gap: 6px; align-items: center; }
.surface-cell i { flex: none; font-size: 10px; color: var(--muted); }

.table-empty { margin: 0; padding: 18px; color: var(--muted); font-size: 12px; }
</style>
