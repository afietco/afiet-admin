<script setup lang="ts">
import { computed } from 'vue'
import { effortLabels, indexById, type Agent } from '../../../services/intelligence'

const props = defineProps<{ agent: Agent }>()

/**
 * Effort ve sürüm sabitliği burada yan yana duruyor çünkü ikisi de "aynı soru
 * yarın başka cevap verir mi" sorusunun parçası. Effort okunmadıysa boş
 * bırakılır: uydurulmuş bir "medium", davranışı yanlış açıklardı.
 */
const facts = computed(() => {
  const a = props.agent
  return [
    { label: 'Foundry adı', value: a.name, mono: true },
    { label: 'Sürüm', value: a.version, note: a.versionPin === 'pinned' ? 'sabitli' : 'sabitli değil' },
    { label: 'Model', value: a.model, mono: true },
    {
      label: 'Reasoning effort',
      value: a.effort ? effortLabels[a.effort] : null,
      note: a.effort ? null : 'Foundry\'den okunacak',
    },
    { label: 'Uç', value: a.endpoint, mono: true, note: a.endpoint ? null : 'bağlı değil' },
    { label: 'Kota', value: a.quota, note: a.quota ? null : 'yok' },
    {
      label: 'Bilgi tabanı',
      value: a.index ? a.index.indexId : null,
      mono: true,
      note: a.index ? `${a.index.queryType} · top_k ${a.index.topK}` : 'bağlı dizin yok',
    },
    { label: 'Uygulamadaki yüzü', value: a.surface, wide: true },
  ]
})

const boundIndex = computed(() => (props.agent.index ? indexById(props.agent.index.indexId) : null))
</script>

<template>
  <section class="panel-stack">
    <div class="fact-card">
      <dl class="fact-grid">
        <div v-for="f in facts" :key="f.label" :class="{ wide: f.wide }">
          <dt>{{ f.label }}</dt>
          <dd v-if="f.value" :class="{ mono: f.mono }">
            {{ f.value }}
            <small v-if="f.note">{{ f.note }}</small>
          </dd>
          <dd v-else class="unknown">{{ f.note ?? '—' }}</dd>
        </div>
      </dl>
    </div>

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
.fact-grid dd small { display: block; margin-top: 3px; color: var(--muted); font-size: 11px; font-weight: 650; font-style: normal; }

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
