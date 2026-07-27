<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import Tag from 'primevue/tag'
import type { Food } from '../../services/foods'
import { decimal, label, measureLabel, number } from '../../services/foodLabels'

const props = defineProps<{ food: Food | null }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ (e: 'edit', food: Food): void; (e: 'remove', food: Food): void; (e: 'jump', name: string): void }>()

const macros = computed(() => {
  if (!props.food) return []
  const { protein, carb, fat } = props.food.macros
  return [
    { key: 'protein', text: 'Protein', grams: protein, kcal: protein * 4 },
    { key: 'carb', text: 'Karbonhidrat', grams: carb, kcal: carb * 4 },
    { key: 'fat', text: 'Yağ', grams: fat, kcal: fat * 9 },
  ]
})

/**
 * Atwater denetimi: makrolardan hesaplanan enerji ile kayıtlı kcal arasındaki
 * fark. Katalog denetim aracının ilk kontrolü budur; panelde de görünsün ki
 * elle girilen bir besin tutarsız kaydedildiğinde fark edilsin.
 */
const atwater = computed(() => {
  if (!props.food) return null
  const { kcal, protein, carb, fat } = props.food.macros
  const derived = protein * 4 + carb * 4 + fat * 9
  if (!kcal && !derived) return null
  const drift = derived - kcal
  const ratio = kcal ? Math.abs(drift) / kcal : 1
  return { derived, drift, off: ratio > 0.2 }
})
</script>

<template>
  <Drawer v-model:visible="visible" position="right" class="food-drawer" :style="{ width: '30rem' }">
    <template #header>
      <div v-if="food" class="drawer-head">
        <span class="food-emoji lg" aria-hidden="true">{{ food.emoji || '🍽️' }}</span>
        <div>
          <strong>{{ food.name }}</strong>
          <small>{{ label(food.category) }} · {{ decimal(food.gramPerMeasure) }} g / {{ measureLabel(food.measure) }}</small>
        </div>
      </div>
    </template>

    <div v-if="food" class="drawer-body">
      <p v-if="food.description" class="drawer-desc">{{ food.description }}</p>

      <section class="drawer-section">
        <h4>1 {{ measureLabel(food.measure) }} için</h4>
        <div class="macro-table">
          <div class="macro-total">
            <strong>{{ number(food.macros.kcal) }}</strong><small>kcal</small>
          </div>
          <ul class="macro-legend">
            <li v-for="row in macros" :key="row.key">
              <span :class="`legend-swatch macro-${row.key}`" aria-hidden="true" />
              <span class="legend-name">{{ row.text }}</span>
              <span class="legend-value">{{ decimal(row.grams) }} g</span>
              <span class="legend-kcal">{{ decimal(row.kcal) }} kcal</span>
            </li>
          </ul>
        </div>
        <p v-if="atwater?.off" class="drawer-warn">
          <i class="pi pi-exclamation-triangle" aria-hidden="true" />
          Makrolardan çıkan enerji {{ decimal(atwater.derived) }} kcal; kayıtlı değerden
          {{ decimal(Math.abs(atwater.drift)) }} kcal sapıyor.
        </p>
      </section>

      <section class="drawer-section">
        <h4>Ölçü ve porsiyon</h4>
        <dl class="drawer-grid">
          <div><dt>Doğal ölçü</dt><dd>{{ label(food.measure) }}</dd></div>
          <div><dt>1 ölçü ağırlığı</dt><dd>{{ decimal(food.gramPerMeasure) }} g</dd></div>
          <div><dt>Varsayılan miktar</dt><dd>{{ decimal(food.defaultQuantity) }}</dd></div>
          <div><dt>Lif</dt><dd>{{ decimal(food.fiberG) }} g</dd></div>
          <div v-if="food.liquidMl !== null"><dt>Sıvı katkısı</dt><dd>{{ decimal(food.liquidMl) }} ml</dd></div>
        </dl>
      </section>

      <section class="drawer-section">
        <h4>Sınıflandırma</h4>
        <div class="drawer-tags">
          <Tag v-for="group in food.groups" :key="group" :value="label(group)" severity="secondary" />
        </div>
        <div class="drawer-tags">
          <Tag v-for="tag in food.dietTags" :key="tag" :value="label(tag)" severity="success" />
          <span v-if="!food.dietTags.length" class="drawer-none">Diyet etiketi yok</span>
        </div>
        <div class="drawer-tags">
          <Tag v-for="meal in food.suitableMeals" :key="meal" :value="label(meal)" severity="info" />
          <span v-if="!food.suitableMeals.length" class="drawer-none">Öğün yakıştırması yok</span>
        </div>
      </section>

      <section class="drawer-section">
        <h4>Aramada bulunduğu adlar</h4>
        <div class="alias-list">
          <span v-for="alias in food.aliases" :key="alias" class="chip">{{ alias }}</span>
          <span v-if="!food.aliases.length" class="drawer-none">Takma ad yok; yalnız tam adıyla bulunur.</span>
        </div>
      </section>

      <section v-if="food.lighterAlternative" class="drawer-section">
        <h4>Denge bağı</h4>
        <button type="button" class="lighter-link" @click="emit('jump', food.lighterAlternative!)">
          <i class="pi pi-arrow-down-right" aria-hidden="true" />
          <span>{{ food.lighterAlternative }}</span>
          <small>daha hafif alternatif — aramada aç</small>
        </button>
      </section>

      <section class="drawer-section">
        <h4>Kayıt</h4>
        <dl class="drawer-grid">
          <div><dt>Durum</dt><dd>{{ food.active ? 'Katalogda aktif' : 'Pasif' }}</dd></div>
          <div><dt>Eklendi</dt><dd>{{ new Date(food.createdAt).toLocaleDateString('tr-TR') }}</dd></div>
          <div><dt>Güncellendi</dt><dd>{{ new Date(food.updatedAt).toLocaleDateString('tr-TR') }}</dd></div>
        </dl>
      </section>
    </div>

    <template #footer>
      <div v-if="food" class="drawer-actions">
        <Button label="Sil" icon="pi pi-trash" severity="danger" text @click="emit('remove', food)" />
        <Button label="Düzenle" icon="pi pi-pencil" @click="emit('edit', food)" />
      </div>
    </template>
  </Drawer>
</template>
