<script setup lang="ts">
import { computed } from 'vue'
import { SEVERITY_LABELS, SEVERITY_ORDER, type QualityReport } from '../../services/foodQuality'

const props = defineProps<{
  report: QualityReport
  /** Bulgu yokken kutuyu hiç çizme (formda yer kaplamasın). */
  quiet?: boolean
}>()

const sorted = computed(() =>
  [...props.report.findings].sort((a, b) =>
    SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)))

const counts = computed(() => [
  { key: 'kritik', value: props.report.critical },
  { key: 'uyari', value: props.report.warning },
  { key: 'bilgi', value: props.report.info },
].filter((row) => row.value > 0))

const clean = computed(() => !props.report.findings.length)
</script>

<template>
  <section v-if="!(quiet && clean && !report.pending.length)" class="quality-box" :class="{ clean }">
    <header class="quality-head">
      <span class="quality-title">
        <i :class="clean ? 'pi pi-verified' : 'pi pi-flag'" aria-hidden="true" />
        Veri kalitesi kontrolleri
      </span>
      <span v-if="counts.length" class="quality-counts">
        <span v-for="row in counts" :key="row.key" class="quality-pill" :class="row.key">
          {{ row.value }} {{ SEVERITY_LABELS[row.key as keyof typeof SEVERITY_LABELS].toLocaleLowerCase('tr-TR') }}
        </span>
      </span>
      <span v-else class="quality-ok">Bulgu yok</span>
    </header>

    <ul v-if="sorted.length" class="quality-list">
      <li v-for="finding in sorted" :key="finding.code + finding.detail" :class="finding.severity">
        <span class="quality-dot" aria-hidden="true" />
        <div>
          <strong>{{ finding.title }}</strong>
          <span class="quality-code">{{ finding.code }}</span>
          <p>{{ finding.detail }}</p>
        </div>
      </li>
    </ul>

    <details v-if="report.pending.length" class="quality-pending">
      <summary>{{ report.pending.length }} kontrol değerlendirilemedi</summary>
      <ul>
        <li v-for="item in report.pending" :key="item.code">
          <strong>{{ item.code }}</strong> {{ item.title }}: {{ item.reason }}
        </li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
.quality-box {
  display: grid;
  gap: 10px;
  padding: 13px 15px;
  border: 1px solid #ecd3a3;
  border-radius: 14px;
  background: #fdf9ef;
}
.quality-box.clean { border-color: #cbe8d9; background: #f1f9f4; }

.quality-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.quality-title {
  display: flex; gap: 7px; align-items: center;
  color: #6d5a2c; font-size: 10px; font-weight: 900; letter-spacing: .04em;
}
.quality-box.clean .quality-title { color: #1c6a4e; }
.quality-counts { display: flex; gap: 5px; margin-left: auto; }
.quality-pill {
  padding: 2px 8px; border-radius: 7px;
  font-size: 9px; font-weight: 900; letter-spacing: .02em;
}
.quality-pill.kritik { color: #8d2f24; background: #fbe3df; }
.quality-pill.uyari { color: #8a6512; background: #f8ebd0; }
.quality-pill.bilgi { color: #3f6472; background: #e4eef1; }
.quality-ok { margin-left: auto; color: #1c6a4e; font-size: 9px; font-weight: 850; }

.quality-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.quality-list li { display: grid; grid-template-columns: 8px minmax(0, 1fr); gap: 9px; align-items: start; }
.quality-dot { width: 7px; height: 7px; margin-top: 5px; border-radius: 50%; background: #a9ac9f; }
.quality-list li.kritik .quality-dot { background: #c0483a; }
.quality-list li.uyari .quality-dot { background: var(--amber); }
.quality-list li.bilgi .quality-dot { background: var(--blue); }
.quality-list strong { color: #38403a; font-size: 11px; font-weight: 850; }
.quality-code {
  margin-left: 6px; padding: 1px 5px; border-radius: 5px;
  color: #8a8d84; background: #efeade; font-size: 8px; font-weight: 800; letter-spacing: .03em;
}
.quality-list p { margin: 3px 0 0; color: #63675e; font-size: 10px; line-height: 1.55; }

.quality-pending { color: #8a8d84; font-size: 9px; }
.quality-pending summary { cursor: pointer; font-weight: 800; }
.quality-pending ul { display: grid; gap: 4px; margin: 7px 0 0; padding-left: 14px; line-height: 1.5; }
.quality-pending strong { color: #6f7269; font-weight: 900; }
</style>
