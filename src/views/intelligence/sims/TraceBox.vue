<script setup lang="ts">
import { ref } from 'vue'
import type { SimTrace } from '../../../services/intelligenceSim'

defineProps<{ trace: SimTrace }>()

// Varsayılan kapalı: simülasyonun asıl işi ekranın nasıl göründüğünü
// göstermek, ham gövde ikincil bir soru.
const open = ref(false)

const pretty = (v: unknown) => JSON.stringify(v, null, 2)
</script>

<template>
  <div class="trace">
    <button type="button" class="trace-head" :aria-expanded="open" @click="open = !open">
      <i class="pi" :class="open ? 'pi-chevron-down' : 'pi-chevron-right'" />
      <span class="trace-label">Tur ayrıntısı</span>
      <code>{{ trace.endpoint }}</code>
      <span class="trace-ms">{{ trace.latencyMs }} ms</span>
    </button>

    <div v-if="open" class="trace-body">
      <div class="trace-meta">
        <span><small>ajan</small>{{ trace.agent }}</span>
        <span><small>sürüm</small>{{ trace.version }}</span>
        <span v-if="trace.retrieved"><small>çekilen parça</small>{{ trace.retrieved.join(', ') }}</span>
      </div>
      <div class="trace-cols">
        <div>
          <h4>İstek</h4>
          <pre>{{ pretty(trace.request) }}</pre>
        </div>
        <div>
          <h4>Yanıt</h4>
          <pre>{{ pretty(trace.response) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.trace { border: 1px solid var(--line); border-radius: 13px; background: var(--paper); overflow: hidden; }
.trace-head {
  display: flex; gap: 10px; align-items: center; width: 100%;
  padding: 10px 13px; border: 0; background: none; text-align: left; cursor: pointer;
}
.trace-head:hover { background: #faf8f1; }
.trace-head:focus-visible { outline: 2px solid var(--green); outline-offset: -2px; }
.trace-head > i { color: var(--muted); font-size: 10px; }
.trace-label { color: var(--ink); font-size: 12px; font-weight: 800; }
.trace-head code {
  flex: 1; min-width: 0; overflow: hidden;
  color: var(--muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap;
}
.trace-ms { flex: none; color: var(--green); font-size: 11px; font-weight: 800; font-variant-numeric: tabular-nums; }

.trace-body { padding: 0 13px 13px; border-top: 1px solid var(--line); }
.trace-meta { display: flex; flex-wrap: wrap; gap: 8px 22px; padding: 11px 0; }
.trace-meta span { font-size: 11.5px; font-weight: 750; }
.trace-meta small {
  display: block; color: var(--muted); font-size: 9.5px; font-weight: 850;
  letter-spacing: .06em; text-transform: uppercase;
}
.trace-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
.trace-cols h4 { margin: 0 0 6px; color: var(--muted); font-size: 10px; font-weight: 850; letter-spacing: .07em; text-transform: uppercase; }
.trace-cols pre {
  margin: 0; padding: 11px 13px; max-height: 260px; overflow: auto;
  border-radius: 10px; background: #f5f2e9;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 1.6;
}
</style>
