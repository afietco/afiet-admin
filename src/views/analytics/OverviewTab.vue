<script setup lang="ts">
import { computed } from 'vue'
import type { AnalyticsData } from '../../services/analytics'
import { CHANNEL_TONE, duration, fmt, pct, shortDate } from './shared'

const props = defineProps<{ data: AnalyticsData }>()

const maxViews = computed(() => Math.max(...props.data.series.map((p) => p.views), 1))
const pagesTotal = computed(() => props.data.topPages.reduce((s, p) => s + p.views, 0))
const channelTotal = computed(() => props.data.channels.reduce((s, c) => s + c.visits, 0))
// Uzun serilerde her etiketi göstermek kalabalık yapar: ~8 etikete indir.
const labelEvery = computed(() => Math.ceil(props.data.series.length / 8))

const cards = computed(() => {
  const t = props.data.totals
  return [
    { label: 'Görüntülenme', value: t.views, tone: 'green', icon: 'pi pi-eye', note: 'toplam sayfa görüntüleme', delta: t.deltaViews },
    { label: 'Tekil ziyaretçi', value: t.visitors, tone: 'blue', icon: 'pi pi-users', note: 'birinci-taraf çerezle', delta: t.deltaVisitors },
    { label: 'Sayfa / ziyaret', value: t.viewsPerVisit, tone: 'amber', icon: 'pi pi-clone', note: `ort. ${duration(t.avgDuration)} kalış`, delta: null },
    { label: 'Waitlist dönüşümü', value: t.conversions, tone: 'coral', icon: 'pi pi-sparkles', note: `%${t.conversionRate} ziyaretçi`, delta: null },
  ]
})
</script>

<template>
  <div class="tab-body">
    <section class="metric-grid" aria-label="Özet metrikler">
      <article v-for="c in cards" :key="c.label" class="metric-card" :class="c.tone">
        <div class="metric-top"><span>{{ c.label }}</span><i :class="c.icon" /></div>
        <strong>{{ fmt(c.value) }}</strong>
        <div class="metric-foot">
          <small>{{ c.note }}</small>
          <span v-if="c.delta !== null" class="delta" :class="c.delta >= 0 ? 'up' : 'down'"><i :class="c.delta >= 0 ? 'pi pi-arrow-up-right' : 'pi pi-arrow-down-right'" />%{{ Math.abs(c.delta) }}</span>
        </div>
      </article>
    </section>

    <article class="panel-card pad chart-card">
      <div class="panel-title sm"><div><p>ZAMAN SERİSİ</p><h2>Görüntülenme & ziyaretçi</h2></div><span class="legend"><span class="lg views" /> görüntülenme <span class="lg visitors" /> ziyaretçi</span></div>
      <div class="bar-chart tall">
        <div v-for="(p, i) in data.series" :key="p.date" class="bar-col">
          <div class="bar-track">
            <div class="bar-stack">
              <div class="bar-fill" :style="{ height: `${Math.max(3, pct(p.views, maxViews))}%` }" />
              <div class="bar-fill visitors" :style="{ height: `${Math.max(2, pct(p.visitors, maxViews))}%` }" />
            </div>
          </div>
          <span class="bar-label" :class="{ hide: i % labelEvery !== 0 }">{{ shortDate(p.date) }}</span>
        </div>
      </div>
    </article>

    <div class="split-grid">
      <article class="panel-card pad">
        <div class="panel-title sm"><div><p>EN ÇOK GÖRÜNTÜLENEN</p><h2>Sayfalar</h2></div></div>
        <ul class="src-list tight">
          <li v-for="p in data.topPages.slice(0, 6)" :key="p.path">
            <div class="src-row"><span class="src-name mono">{{ p.path }}</span><span class="src-val">{{ fmt(p.views) }}</span></div>
            <div class="mini-track"><div class="mini-fill green" :style="{ width: `${pct(p.views, pagesTotal)}%` }" /></div>
          </li>
        </ul>
      </article>

      <article class="panel-card pad">
        <div class="panel-title sm"><div><p>NEREDEN GELDİLER</p><h2>Kanallar</h2></div></div>
        <ul class="src-list tight">
          <li v-for="c in data.channels" :key="c.key">
            <div class="src-row"><span class="src-name">{{ c.label }}</span><span class="src-val">{{ fmt(c.visits) }} · {{ pct(c.visits, channelTotal) }}%</span></div>
            <div class="mini-track"><div class="mini-fill" :class="CHANNEL_TONE[c.key]" :style="{ width: `${pct(c.visits, channelTotal)}%` }" /></div>
          </li>
        </ul>
      </article>
    </div>
  </div>
</template>
