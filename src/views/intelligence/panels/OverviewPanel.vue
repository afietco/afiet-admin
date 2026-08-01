<script setup lang="ts">
import { computed } from 'vue'
import { effortLabel, indexById, searchTool, type AgentView } from '../../../services/intelligence'

const props = defineProps<{ agent: AgentView; loading: boolean }>()

/**
 * Effort ve sürüm sabitliği burada yan yana duruyor çünkü ikisi de "aynı soru
 * yarın başka cevap verir mi" sorusunun parçası.
 *
 * Canlı alanlar okunamadıysa BOŞ kalır. Panel o durumda "okunmadı" der;
 * beklenen bir değeri gerçekmiş gibi göstermek, ajanın davranışını yanlış
 * açıklardı.
 */
const tool = computed(() => searchTool(props.agent.live))

/** Tanım gerçekten okunabildi mi: "dizin yok" ile "okunamadı" ayrı şeyler. */
const liveRead = computed(() =>
  Boolean(props.agent.live && props.agent.live.configured && !props.agent.live.error))

const facts = computed(() => {
  const a = props.agent
  const live = a.live
  const pinned = live?.pinnedVersion
  return [
    { label: 'Foundry adı', value: live?.name ?? null, mono: true, note: live?.name ? null : 'okunmadı' },
    {
      label: 'Sürüm',
      value: live?.version ? `v${live.version}` : null,
      note: live?.version ? (pinned ? `${pinned} sürümüne sabitli` : 'sabitli değil') : 'okunmadı',
    },
    { label: 'Model', value: live?.model ?? null, mono: true, note: live?.model ? null : 'okunmadı' },
    {
      label: 'Reasoning effort',
      value: live?.effort ? effortLabel(live.effort) : null,
      note: live?.effort ? null : 'okunmadı',
    },
    {
      label: 'Uç',
      value: live?.endpoint || null,
      mono: true,
      note: live?.endpoint ? null : 'ürün ucuna bağlı değil',
    },
    { label: 'Kota', value: a.quota, note: a.quota ? null : 'yok' },
    {
      label: 'Bilgi tabanı',
      value: tool.value?.index ?? null,
      mono: true,
      note: tool.value
        ? `${tool.value.queryType || 'sorgu tipi okunmadı'} · top_k ${tool.value.topK || '?'}`
        : liveRead.value
          ? 'bağlı dizin yok'
          : 'okunmadı',
    },
    { label: 'Uygulamadaki yüzü', value: a.surface, wide: true },
  ]
})

const boundIndex = computed(() => (tool.value?.index ? indexById(tool.value.index) : null))

/** Beklenen dizinle canlı bağ ayrışmışsa bunu söylemek gerek. */
const drift = computed(() => {
  if (!liveRead.value) return ''
  const expected = props.agent.expectedIndex
  const actual = tool.value?.index ?? null
  if (expected === actual) return ''
  if (expected && !actual) return `Bu ajanda ${expected} dizini bekleniyordu ama bağlı araç yok.`
  if (!expected && actual) return `Bu ajanda dizin beklenmiyordu ama ${actual} bağlı.`
  return `Beklenen dizin ${expected}, bağlı olan ${actual}.`
})
</script>

<template>
  <section class="panel-stack">
    <div class="fact-card">
      <dl class="fact-grid">
        <div v-for="f in facts" :key="f.label" :class="{ wide: f.wide }">
          <dt>{{ f.label }}</dt>
          <dd v-if="loading && !f.value && f.note === 'okunmadı'" class="loading">yükleniyor…</dd>
          <dd v-else-if="f.value" :class="{ mono: f.mono }">
            {{ f.value }}
            <small v-if="f.note">{{ f.note }}</small>
          </dd>
          <dd v-else class="unknown">{{ f.note ?? '—' }}</dd>
        </div>
      </dl>
    </div>

    <p v-if="drift" class="drift">
      <i class="pi pi-exclamation-triangle" />
      {{ drift }} Paneldeki beklenti ile Foundry'deki tanım ayrışmış.
    </p>

    <div v-if="boundIndex" class="side-card">
      <h3><i class="pi pi-database" /> {{ boundIndex.id }}</h3>
      <p>{{ boundIndex.source }}</p>
      <p class="sync">{{ boundIndex.sync }}</p>
    </div>

    <div v-if="agent.traps.length" class="trap-card">
      <h3><i class="pi pi-exclamation-triangle" /> Bilinmesi pahalı olanlar</h3>
      <ul>
        <li v-for="trap in agent.traps" :key="trap">{{ trap }}</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.panel-stack { display: grid; gap: 16px; }

.fact-card { padding: 20px 22px; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); }
.fact-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 18px 26px; margin: 0; }
.fact-grid > .wide { grid-column: 1 / -1; }
.fact-grid dt { color: var(--muted); font-size: 10px; font-weight: 850; letter-spacing: .07em; text-transform: uppercase; }
.fact-grid dd { margin: 5px 0 0; color: var(--ink); font-size: 13.5px; font-weight: 700; line-height: 1.45; overflow-wrap: anywhere; }
.fact-grid dd.mono { font-size: 12.5px; }
.fact-grid dd.unknown { color: #a3a59c; font-weight: 600; font-style: italic; }
.fact-grid dd.loading { color: #c2c4bb; font-weight: 600; }
.fact-grid dd small { display: block; margin-top: 3px; color: var(--muted); font-size: 11px; font-weight: 650; font-style: normal; }

.drift {
  display: flex; gap: 9px; align-items: flex-start; margin: 0;
  padding: 12px 14px; border: 1px solid #e8d9b4; border-radius: 12px; background: #fdf7e8;
  color: #6b5a34; font-size: 12.5px; line-height: 1.55;
}
.drift i { margin-top: 2px; color: var(--amber); font-size: 12px; }

.side-card { padding: 17px 19px; border: 1px solid var(--line); border-radius: 15px; background: #f4faf6; }
.side-card h3 { display: flex; gap: 8px; align-items: center; margin: 0; font-size: 13.5px; }
.side-card h3 i { color: var(--green); font-size: 12px; }
.side-card p { margin: 9px 0 0; color: #4f5a53; font-size: 12.5px; line-height: 1.55; }
.side-card .sync { color: var(--muted); }

.trap-card { padding: 17px 19px; border: 1px solid #f0dcd7; border-radius: 15px; background: #fdf5f3; }
.trap-card h3 { display: flex; gap: 8px; align-items: center; margin: 0; color: #7a4437; font-size: 13.5px; }
.trap-card h3 i { color: var(--coral); font-size: 12px; }
.trap-card ul { margin: 11px 0 0; padding-left: 18px; display: grid; gap: 8px; }
.trap-card li { max-width: 92ch; color: #6b4a40; font-size: 12.5px; line-height: 1.6; }
</style>
