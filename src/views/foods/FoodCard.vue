<script setup lang="ts">
import { computed } from 'vue'
import type { Food } from '../../services/foods'
import { decimal, label, measureLabel, number } from '../../services/foodLabels'

const props = defineProps<{ food: Food }>()
defineEmits<{ (e: 'open'): void }>()

/**
 * Makro çubuğu enerji PAYINI gösterir, gram payını değil: 1 g yağ 9 kcal,
 * 1 g protein ve karbonhidrat 4 kcal taşır. Gram oranı çizilseydi yağlı
 * besinlerin enerjisi olduğundan hafif görünürdü.
 */
const macroBar = computed(() => {
  const { protein, carb, fat } = props.food.macros
  const parts = [
    { key: 'protein', kcal: protein * 4 },
    { key: 'carb', kcal: carb * 4 },
    { key: 'fat', kcal: fat * 9 },
  ]
  const sum = parts.reduce((total, part) => total + part.kcal, 0)
  if (sum <= 0) return []
  return parts.map((part) => ({ ...part, ratio: part.kcal / sum }))
})

/**
 * Kartta yazan makrolar TEK ölçü içindir; ölçü satırı da bu yüzden hep 1'den
 * söz eder. Varsayılan miktarı (kayıtta önerilen porsiyon) buraya koymak
 * "2 dilim" yazıp altında 1 dilimin kalorisini göstermek olurdu; o değer
 * detay çekmecesinde duruyor.
 *
 * Gram ölçüsünde makrolar 1 gram içindir (migration 000025), gram_per_measure
 * hep 1'dir; "1 g · 1 g" yazmamak için ağırlık tekrarlanmaz.
 */
const measureText = computed(() => {
  const food = props.food
  if (food.measure === 'gram') return '1 gram için'
  return `1 ${measureLabel(food.measure)} · ${decimal(food.gramPerMeasure)} g`
})
</script>

<template>
  <button type="button" class="food-card" @click="$emit('open')">
    <header>
      <span class="food-emoji" aria-hidden="true">{{ food.emoji || '🍽️' }}</span>
      <div class="food-ident">
        <strong>{{ food.name }}</strong>
        <small>{{ label(food.category) }}</small>
      </div>
      <span v-if="!food.active" class="food-flag">Pasif</span>
    </header>

    <p class="food-measure">{{ measureText }}</p>

    <div class="food-energy">
      <strong>{{ number(food.macros.kcal) }}</strong><small>kcal</small>
      <span v-if="food.fiberG > 0" class="food-fiber">{{ decimal(food.fiberG) }} g lif</span>
    </div>

    <div v-if="macroBar.length" class="macro-bar" role="img"
      :aria-label="`Protein ${decimal(food.macros.protein)} gram, karbonhidrat ${decimal(food.macros.carb)} gram, yağ ${decimal(food.macros.fat)} gram`">
      <span v-for="part in macroBar" :key="part.key" :class="`macro-seg macro-${part.key}`" :style="{ inlineSize: `${part.ratio * 100}%` }" />
    </div>
    <div v-else class="macro-bar macro-bar-empty" aria-hidden="true" />

    <footer>
      <span v-for="group in food.groups" :key="group" class="chip">{{ label(group) }}</span>
      <span v-for="tag in food.dietTags" :key="tag" class="chip chip-diet">{{ label(tag) }}</span>
    </footer>

    <p v-if="food.lighterAlternative" class="food-lighter">
      <i class="pi pi-arrow-down-right" aria-hidden="true" /> {{ food.lighterAlternative }}
    </p>
  </button>
</template>
