<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ url: string; title: string; description: string }>()

// Google kırıntı yolu: https:// düşer, yol " › " ile ayrılır.
const crumb = computed(() => {
  const clean = props.url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const [host, ...rest] = clean.split('/')
  return [host, ...rest].filter(Boolean).join(' › ')
})
</script>

<template>
  <div class="serp-card">
    <div class="serp-head">
      <span class="serp-favicon">a</span>
      <div class="serp-site"><strong>afiet</strong><span class="serp-url">{{ crumb }}</span></div>
    </div>
    <div class="serp-title">{{ title || '(başlık boş)' }}</div>
    <p class="serp-desc">{{ description || '(açıklama boş)' }}</p>
  </div>
</template>
