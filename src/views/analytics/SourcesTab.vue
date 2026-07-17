<script setup lang="ts">
import { computed } from 'vue'
import type { AnalyticsData } from '../../services/analytics'
import { CHANNEL_TONE, fmt, pct } from './shared'

const props = defineProps<{ data: AnalyticsData }>()

const channelTotal = computed(() => props.data.channels.reduce((s, c) => s + c.visits, 0))
const refTotal = computed(() => props.data.referrers.reduce((s, r) => s + r.visits, 0))
const utmBlocks = computed(() => [
  { caption: 'KAYNAK (utm_source)', rows: props.data.utm.source },
  { caption: 'ORTAM (utm_medium)', rows: props.data.utm.medium },
  { caption: 'KAMPANYA (utm_campaign)', rows: props.data.utm.campaign },
])
const utmMax = (rows: { visits: number }[]) => Math.max(...rows.map((r) => r.visits), 1)
</script>

<template>
  <div class="tab-body">
    <p class="analytics-note"><i class="pi pi-directions" /> Ziyaretçi nereden geldi: referrer başlığı kanallara ayrılır; bağlantıdaki <span class="mono">?utm_*</span> parametreleri kampanya kırılımını verir.</p>

    <article class="panel-card pad">
      <div class="panel-title sm"><div><p>EDİNİM</p><h2>Kanallar</h2></div></div>
      <ul class="src-list">
        <li v-for="c in data.channels" :key="c.key">
          <div class="src-row"><span class="src-name">{{ c.label }}</span><span class="src-val">{{ fmt(c.visits) }} · {{ pct(c.visits, channelTotal) }}%</span></div>
          <div class="mini-track"><div class="mini-fill" :class="CHANNEL_TONE[c.key]" :style="{ width: `${pct(c.visits, channelTotal)}%` }" /></div>
        </li>
      </ul>
    </article>

    <div class="split-grid">
      <article class="panel-card pad">
        <div class="panel-title sm"><div><p>YÖNLENDİREN SİTELER</p><h2>Referrer</h2></div></div>
        <ul class="src-list tight">
          <li v-for="r in data.referrers" :key="r.source">
            <div class="src-row"><span class="src-name mono">{{ r.source }}</span><span class="src-val">{{ fmt(r.visits) }} · {{ pct(r.visits, refTotal) }}%</span></div>
            <div class="mini-track"><div class="mini-fill coral" :style="{ width: `${pct(r.visits, refTotal)}%` }" /></div>
          </li>
        </ul>
      </article>

      <article class="panel-card pad">
        <div class="panel-title sm"><div><p>KAMPANYA</p><h2>UTM kırılımı</h2></div></div>
        <div v-for="block in utmBlocks" :key="block.caption" class="utm-block">
          <p class="mini-cap">{{ block.caption }}</p>
          <ul v-if="block.rows.length" class="src-list tight">
            <li v-for="row in block.rows" :key="row.value">
              <div class="src-row"><span class="src-name mono">{{ row.value }}</span><span class="src-val">{{ fmt(row.visits) }}</span></div>
              <div class="mini-track"><div class="mini-fill amber" :style="{ width: `${pct(row.visits, utmMax(block.rows))}%` }" /></div>
            </li>
          </ul>
          <p v-else class="board-empty">Kayıt yok</p>
        </div>
      </article>
    </div>
  </div>
</template>
