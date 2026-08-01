<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Tag from 'primevue/tag'
import {
  agentCopy, effortLabel, mergeAgents, searchService, searchTool, wiringMeta, zekaApi,
  type AgentView,
} from '../../services/intelligence'

// Ajanlar bağlı olanlar önce gelecek şekilde sıralanıyor: panelin ilk ekranı
// "şu an üründe ne çalışıyor" sorusunu cevaplamalı, Foundry envanterini değil.
const order = { live: 0, partial: 1, unwired: 2 }

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

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await zekaApi.agents()
    rows.value = mergeAgents(data.items ?? [])
    configured.value = data.configured
  } catch (err) {
    // Canlı veri gelmese de kartlar durmalı: ürün kopyası panelde yaşıyor.
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
        bilgileri okunamıyor; aşağıdaki kartlar yalnız ürün tarafındaki bilgiyi gösteriyor.
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

    <div class="agent-grid">
      <RouterLink
        v-for="agent in sorted"
        :key="agent.id"
        class="agent-card"
        :class="agent.wiring"
        :to="{ name: 'agent-detail', params: { agentId: agent.id } }"
      >
        <div class="agent-top">
          <div class="agent-glyph"><i class="pi pi-sparkles" /></div>
          <div class="agent-ident">
            <strong>{{ agent.label }}</strong>
            <code>{{ agent.live?.name || agent.id }}</code>
          </div>
          <Tag :value="wiringMeta[agent.wiring].label" :severity="severity(agent.wiring)" />
        </div>

        <p class="agent-purpose">{{ agent.purpose }}</p>

        <dl class="agent-facts">
          <div>
            <dt>Sürüm</dt>
            <dd v-if="loading" class="loading">···</dd>
            <dd v-else-if="agent.live?.version">
              v{{ agent.live.version }}
              <span v-if="agent.live.pinnedVersion" class="pin" title="Sürüm sabitli">
                <i class="pi pi-lock" />
              </span>
            </dd>
            <dd v-else class="unknown">okunmadı</dd>
          </div>
          <div>
            <dt>Model</dt>
            <dd v-if="loading" class="loading">···</dd>
            <dd v-else-if="agent.live?.model">{{ agent.live.model }}</dd>
            <dd v-else class="unknown">okunmadı</dd>
          </div>
          <div>
            <dt>Effort</dt>
            <dd v-if="loading" class="loading">···</dd>
            <dd v-else-if="agent.live?.effort">{{ effortLabel(agent.live.effort) }}</dd>
            <dd v-else class="unknown">okunmadı</dd>
          </div>
          <div>
            <dt>Bilgi tabanı</dt>
            <dd v-if="loading" class="loading">···</dd>
            <dd v-else :class="{ unknown: indexCell(agent).unknown }">{{ indexCell(agent).text }}</dd>
          </div>
        </dl>

        <div class="agent-foot">
          <span class="agent-surface"><i class="pi pi-mobile" />{{ agent.surface }}</span>
          <i class="pi pi-angle-right agent-arrow" />
        </div>
      </RouterLink>
    </div>
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

.agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 15px; }

.agent-card {
  display: flex; flex-direction: column; gap: 13px;
  padding: 18px; border: 1px solid var(--line); border-radius: 18px;
  background: var(--paper); box-shadow: 0 5px 24px rgba(50, 50, 40, .035);
  text-decoration: none; transition: transform .18s ease, box-shadow .18s ease;
}
.agent-card:hover { transform: translateY(-2px); box-shadow: 0 12px 30px rgba(50, 50, 40, .09); }
.agent-card:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }
/* Bağlı olmayan ajan soluk değil ayrı: solukluk "bozuk" okunur, oysa bunlar
   sağlam ajanlar, sadece henüz bir yüzleri yok. */
.agent-card.unwired { background: repeating-linear-gradient(135deg, var(--paper) 0 14px, #faf7ee 14px 28px); }

.agent-top { display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; gap: 11px; align-items: center; }
.agent-glyph {
  width: 38px; height: 38px; display: grid; place-items: center;
  border-radius: 12px 12px 12px 4px; background: #dff0e7; color: var(--green-dark); font-size: 16px;
}
.agent-ident { min-width: 0; }
.agent-ident strong { display: block; color: var(--ink); font-size: 15px; letter-spacing: -.01em; }
.agent-ident code {
  display: block; margin-top: 2px; overflow: hidden;
  color: var(--muted); font-size: 10.5px; text-overflow: ellipsis; white-space: nowrap;
}

.agent-purpose { margin: 0; color: #5b6159; font-size: 12.5px; line-height: 1.55; }

.agent-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px 14px; margin: 0; }
.agent-facts dt { color: var(--muted); font-size: 10px; font-weight: 850; letter-spacing: .06em; text-transform: uppercase; }
.agent-facts dd {
  margin: 2px 0 0; display: flex; gap: 5px; align-items: center;
  color: var(--ink); font-size: 12.5px; font-weight: 750; overflow-wrap: anywhere;
}
.agent-facts dd.unknown { color: #a3a59c; font-weight: 650; font-style: italic; }
.agent-facts dd.loading { color: #c2c4bb; letter-spacing: .1em; }
.pin i { color: var(--green); font-size: 9px; }

.agent-foot {
  display: flex; gap: 10px; align-items: center; justify-content: space-between;
  margin-top: auto; padding-top: 11px; border-top: 1px solid var(--line);
}
.agent-surface {
  display: flex; gap: 6px; align-items: center; min-width: 0;
  overflow: hidden; color: var(--muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap;
}
.agent-surface i { flex: none; font-size: 10px; }
.agent-arrow { flex: none; color: var(--green); font-size: 12px; }

@media (prefers-reduced-motion: reduce) {
  .agent-card { transition: none; }
  .agent-card:hover { transform: none; }
}
</style>
