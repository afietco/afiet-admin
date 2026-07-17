<script setup lang="ts">
import { computed } from 'vue'
import type { AnalyticsData, BreakdownRow } from '../../services/analytics'
import { fmt, pct } from './shared'

const props = defineProps<{ data: AnalyticsData }>()

const blocks = computed(() => [
  { caption: 'CİHAZ', title: 'Cihaz tipi', rows: props.data.devices, tone: 'green', icon: 'pi pi-mobile' },
  { caption: 'TARAYICI', title: 'Tarayıcı', rows: props.data.browsers, tone: 'blue', icon: 'pi pi-window-maximize' },
  { caption: 'ÜLKE', title: 'Ülke (geo)', rows: props.data.countries, tone: 'coral', icon: 'pi pi-globe' },
])
const total = (rows: BreakdownRow[]) => rows.reduce((s, r) => s + r.visits, 0)
</script>

<template>
  <div class="tab-body">
    <p class="analytics-note"><i class="pi pi-users" /> Ziyaretçi bağlamı: cihaz ve tarayıcı user-agent'tan, ülke ise sunucudaki Vercel geo başlığından toplu olarak çıkarılır. IP saklanmaz.</p>
    <div class="triple-grid">
      <article v-for="b in blocks" :key="b.caption" class="panel-card pad">
        <div class="panel-title sm"><div><p>{{ b.caption }}</p><h2>{{ b.title }}</h2></div><i :class="b.icon" class="panel-glyph" /></div>
        <ul class="src-list tight">
          <li v-for="row in b.rows" :key="row.key">
            <div class="src-row"><span class="src-name">{{ row.label }}</span><span class="src-val">{{ fmt(row.visits) }} · {{ pct(row.visits, total(b.rows)) }}%</span></div>
            <div class="mini-track"><div class="mini-fill" :class="b.tone" :style="{ width: `${pct(row.visits, total(b.rows))}%` }" /></div>
          </li>
        </ul>
      </article>
    </div>
  </div>
</template>
