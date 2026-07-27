<script setup lang="ts">
import { computed } from 'vue'
import type { FoodFacets } from '../../services/foods'
import { number, percent } from '../../services/foodLabels'

const props = defineProps<{ facets: FoodFacets | null }>()

const dimension = (key: string) => props.facets?.dimensions.find((d) => d.key === key)
/** Bir boyutta katalogda gerçekten kullanılan (sayısı > 0) değer adedi. */
const used = (key: string) => dimension(key)?.values.filter((v) => v.count > 0).length ?? 0
const declared = (key: string) => dimension(key)?.values.length ?? 0

const tiles = computed(() => {
  const facets = props.facets
  if (!facets) return []
  return [
    { key: 'total', value: number(facets.total), label: 'besin', note: facets.inactive ? `${number(facets.inactive)} pasif` : 'tamamı aktif' },
    { key: 'category', value: `${used('category')}/${declared('category')}`, label: 'kategori', note: 'servis bağlamı' },
    { key: 'group', value: `${used('group')}/${declared('group')}`, label: 'besin grubu', note: 'denge pusulası' },
    { key: 'emoji', value: number(facets.coverage.distinctEmoji), label: 'farklı emoji', note: 'görsel kimlik' },
    { key: 'alias', value: number(facets.coverage.aliasTotal), label: 'takma ad', note: 'arama genişliği' },
    { key: 'lighter', value: number(facets.coverage.lighterAlternative), label: 'denge bağı', note: `${number(facets.coverage.lighterTargets)} farklı hedef` },
  ]
})

/**
 * Doluluk ölçerleri. "Eksik" değil "kapsam" okunmalı: liquid_ml yalnız sıvı
 * besinlerde, denge bağı yalnız daha hafif bir karşılığı olan besinlerde
 * doludur — düşük oran tasarım gereğidir, veri kalitesi kusuru değil.
 */
const meters = computed(() => {
  const facets = props.facets
  if (!facets) return []
  const total = facets.total || 1
  const rows = [
    { key: 'emoji', label: 'Emoji', part: facets.coverage.emoji },
    { key: 'aliases', label: 'Takma ad', part: facets.coverage.aliases },
    { key: 'suitableMeals', label: 'Uygun öğün', part: facets.coverage.suitableMeals },
    { key: 'dietTags', label: 'Diyet etiketi', part: facets.coverage.dietTags },
    { key: 'fiber', label: 'Lif (> 0)', part: facets.coverage.fiber },
    { key: 'lighterAlternative', label: 'Denge bağı', part: facets.coverage.lighterAlternative },
    { key: 'liquidMl', label: 'Sıvı katkısı', part: facets.coverage.liquidMl },
  ]
  return rows.map((row) => ({ ...row, ratio: row.part / total, text: percent(row.part, facets.total) }))
})
</script>

<template>
  <section v-if="facets" class="pulse-card">
    <div class="pulse-tiles">
      <div v-for="tile in tiles" :key="tile.key" class="pulse-tile">
        <strong>{{ tile.value }}</strong>
        <span>{{ tile.label }}</span>
        <small>{{ tile.note }}</small>
      </div>
    </div>
    <div class="pulse-meters">
      <p class="pulse-meters-title">Alan doluluğu</p>
      <ul>
        <li v-for="meter in meters" :key="meter.key">
          <span class="meter-label">{{ meter.label }}</span>
          <span class="meter-track"><span class="meter-fill" :style="{ inlineSize: `${Math.max(meter.ratio * 100, 1)}%` }" /></span>
          <span class="meter-value">{{ meter.text }}</span>
        </li>
      </ul>
      <small class="pulse-foot">
        Sıvı katkısı ve denge bağı yalnız yakıştığı besinlerde doldurulur; düşük oran eksik veri değildir.
      </small>
    </div>
  </section>
  <section v-else class="pulse-card pulse-skeleton" aria-hidden="true">
    <div class="pulse-tiles">
      <div v-for="n in 6" :key="n" class="pulse-tile"><span class="skeleton-block" /></div>
    </div>
    <div class="pulse-meters"><span v-for="n in 4" :key="n" class="skeleton-line" /></div>
  </section>
</template>
