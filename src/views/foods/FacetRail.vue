<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import type { FoodFacets, FoodFilters } from '../../services/foods'
import { activeFilterCount } from '../../services/foods'
import { DIMENSION_TITLES, label, number } from '../../services/foodLabels'

const props = defineProps<{ facets: FoodFacets | null; filters: FoodFilters }>()
const emit = defineEmits<{ (e: 'pick', key: keyof FoodFilters, value: string): void; (e: 'reset'): void }>()

/**
 * Her satırın çubuğu, o boyuttaki EN BÜYÜK değere göre ölçeklenir; toplama
 * göre değil. Gruplar çoklu atandığı için toplam katalog sayısını aşar,
 * toplama bölmek çubukları okunmaz derecede kısaltırdı.
 */
const rails = computed(() => {
  if (!props.facets) return []
  return props.facets.dimensions.map((dim) => {
    const peak = Math.max(1, ...dim.values.map((v) => v.count))
    return {
      key: dim.key as keyof FoodFilters,
      title: DIMENSION_TITLES[dim.key] ?? dim.key,
      values: dim.values.map((v) => ({ ...v, ratio: v.count / peak })),
    }
  })
})

const activeCount = computed(() => activeFilterCount(props.filters))

/** Aynı değere tekrar tıklamak filtreyi kaldırır. */
function pick(key: keyof FoodFilters, value: string) {
  emit('pick', key, props.filters[key] === value ? '' : value)
}
</script>

<template>
  <aside class="facet-rail">
    <div class="facet-rail-head">
      <p>FİLTRE</p>
      <Button v-if="activeCount" label="Temizle" icon="pi pi-times" text size="small" @click="emit('reset')" />
    </div>

    <section class="facet-group">
      <h3>Durum</h3>
      <ul class="facet-list">
        <li v-for="option in [{ value: 'active', text: 'Aktif' }, { value: 'inactive', text: 'Pasif' }]" :key="option.value">
          <button type="button" class="facet-row" :class="{ on: filters.status === option.value }" @click="pick('status', option.value)">
            <span class="facet-name">{{ option.text }}</span>
            <span class="facet-count">{{ facets ? number(option.value === 'active' ? facets.active : facets.inactive) : '' }}</span>
          </button>
        </li>
      </ul>
    </section>

    <section v-for="rail in rails" :key="rail.key" class="facet-group">
      <h3>{{ rail.title }}</h3>
      <ul class="facet-list">
        <li v-for="item in rail.values" :key="item.value">
          <button
            type="button"
            class="facet-row"
            :class="{ on: filters[rail.key] === item.value, none: item.count === 0 }"
            :disabled="item.count === 0"
            @click="pick(rail.key, item.value)"
          >
            <span class="facet-name">{{ label(item.value) }}</span>
            <span class="facet-bar"><span class="facet-bar-fill" :style="{ inlineSize: `${item.ratio * 100}%` }" /></span>
            <span class="facet-count">{{ number(item.count) }}</span>
          </button>
        </li>
      </ul>
    </section>

    <section class="facet-group">
      <h3>Denge bağı</h3>
      <ul class="facet-list">
        <li v-for="option in [{ value: 'yes', text: 'Hafif alternatifi var' }, { value: 'no', text: 'Bağı yok' }]" :key="option.value">
          <button type="button" class="facet-row" :class="{ on: filters.hasLighter === option.value }" @click="pick('hasLighter', option.value)">
            <span class="facet-name">{{ option.text }}</span>
            <span class="facet-count">
              {{ facets ? number(option.value === 'yes' ? facets.coverage.lighterAlternative : facets.total - facets.coverage.lighterAlternative) : '' }}
            </span>
          </button>
        </li>
      </ul>
    </section>
  </aside>
</template>
