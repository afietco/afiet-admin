<script setup lang="ts">
import { computed } from 'vue'
import EmptyState from '../../components/EmptyState.vue'
import { config } from '../../config'
import type { AnalyticsData } from '../../services/analytics'
import { duration, fmt, pct, shortDate } from './shared'

const props = defineProps<{ data: AnalyticsData }>()

const sorted = computed(() => [...props.data.blog].sort((a, b) => b.views - a.views))
const maxViews = computed(() => Math.max(...props.data.blog.map((p) => p.views), 1))
const totalViews = computed(() => props.data.blog.reduce((s, p) => s + p.views, 0))
const url = (slug: string) => `${config.webApiUrl}/blog/${slug}`
</script>

<template>
  <div class="tab-body">
    <p class="analytics-note"><i class="pi pi-bolt" /> Blog görüntülenmeleri web analitiğinden <strong>otomatik</strong> gelir. İçerik sayfasında blog için elle giriş gerekmez (Instagram / X elle kalır).</p>

    <EmptyState v-if="!data.blog.length" icon="pi pi-file-edit" title="Henüz blog verisi yok" description="Bir yazı yayına girip ziyaret aldıkça istatistikleri burada belirir." />

    <div v-else class="blog-list">
      <article v-for="p in sorted" :key="p.slug" class="blog-row">
        <div class="blog-main">
          <a :href="url(p.slug)" target="_blank" rel="noopener" class="blog-title">{{ p.title }} <i class="pi pi-external-link" /></a>
          <small class="mono">/blog/{{ p.slug }}<template v-if="p.publishedAt"> · {{ shortDate(p.publishedAt, true) }}</template></small>
          <div class="mini-track blog-bar"><div class="mini-fill green" :style="{ width: `${pct(p.views, maxViews)}%` }" /></div>
        </div>
        <div class="blog-stats">
          <div class="bstat"><strong>{{ fmt(p.views) }}</strong><small>görüntülenme</small></div>
          <div class="bstat"><strong>{{ fmt(p.visitors) }}</strong><small>ziyaretçi</small></div>
          <div class="bstat"><strong>{{ duration(p.avgReadSeconds) }}</strong><small>ort. okuma</small></div>
          <div class="bstat"><strong>{{ pct(p.views, totalViews) }}%</strong><small>blog payı</small></div>
        </div>
      </article>
    </div>
  </div>
</template>
