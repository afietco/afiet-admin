<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import type { Food, FoodFacets, FoodInput } from '../../services/foods'
import { decimal, label } from '../../services/foodLabels'

const props = defineProps<{ facets: FoodFacets | null; food: Food | null; saving: boolean }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ (e: 'save', input: FoodInput): void }>()

const submitted = ref(false)

const emptyForm = (): FoodInput => ({
  name: '', groups: [], category: '', measure: '', macros: { kcal: 0, protein: 0, carb: 0, fat: 0 },
  description: '', active: true, gramPerMeasure: 100, fiberG: 0, suitableMeals: [], dietTags: [],
  emoji: '', defaultQuantity: 1, aliases: [], liquidMl: null, lighterAlternative: null,
})
const form = reactive<FoodInput>(emptyForm())

/**
 * Seçenek listeleri facets ucundan gelir; panel enum listesini elle
 * aynalamıyor. Sayısı sıfır olan değerler de seçilebilir kalır — yeni bir
 * kategori ilk besnini ancak böyle alabilir.
 */
const options = (key: string) =>
  props.facets?.dimensions.find((d) => d.key === key)?.values.map((v) => ({ value: v.value, text: label(v.value) })) ?? []

const categories = computed(() => options('category'))
const groups = computed(() => options('group'))
const measures = computed(() => options('measure'))
const dietTags = computed(() => options('dietTag'))
const meals = computed(() => options('meal'))

const title = computed(() => (props.food ? 'Besini düzenle' : 'Yeni besin'))

/** Gram ölçüsünde makrolar 1 gram içindir; ölçü ağırlığı 1'e kilitlenir. */
const gramLocked = computed(() => form.measure === 'gram')
watch(gramLocked, (locked) => {
  if (locked) form.gramPerMeasure = 1
})

watch(visible, (open) => {
  if (!open) return
  submitted.value = false
  Object.assign(form, emptyForm())
  if (props.food) {
    const food = props.food
    Object.assign(form, {
      name: food.name, groups: [...food.groups], category: food.category, measure: food.measure,
      macros: { ...food.macros }, description: food.description, active: food.active,
      gramPerMeasure: food.gramPerMeasure, fiberG: food.fiberG, suitableMeals: [...food.suitableMeals],
      dietTags: [...food.dietTags], emoji: food.emoji, defaultQuantity: food.defaultQuantity,
      aliases: [...food.aliases], liquidMl: food.liquidMl, lighterAlternative: food.lighterAlternative,
    })
  }
})

/** Makrolardan çıkan enerji; formda canlı gösterilir ki tutarsızlık kaydedilmesin. */
// Yuvarlanmaz: gram ölçüsünde değerler 1 gram içindir ve 1'in altında kalır,
// Math.round hepsini 0'a düşürüp sapma uyarısını yanlış tetiklerdi.
const derivedKcal = computed(() => form.macros.protein * 4 + form.macros.carb * 4 + form.macros.fat * 9)
const kcalDrift = computed(() => {
  if (!form.macros.kcal && !derivedKcal.value) return false
  const base = form.macros.kcal || derivedKcal.value
  return Math.abs(derivedKcal.value - form.macros.kcal) / base > 0.2
})

const nameInvalid = computed(() => submitted.value && !form.name.trim())
const valid = () => Boolean(form.name.trim() && form.category && form.measure && form.gramPerMeasure > 0 && form.defaultQuantity > 0)

// AutoComplete serbest metin modunda kullanılıyor; öneri listesi yok, sadece
// chip girişi. Boş dizi döndürmek arama açılırını kapalı tutar.
const aliasSuggestions = ref<string[]>([])

function submit() {
  submitted.value = true
  if (!valid()) return
  emit('save', { ...form, macros: { ...form.macros } })
}
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="title" class="food-dialog" :style="{ width: '52rem' }">
    <div class="form-grid">
      <div class="form-field span-3">
        <label for="food-name">Besin adı *</label>
        <InputText id="food-name" v-model="form.name" fluid :invalid="nameInvalid" />
        <small v-if="nameInvalid" class="field-error">Besin adı gerekli.</small>
      </div>
      <div class="form-field">
        <label for="food-emoji">Emoji</label>
        <InputText id="food-emoji" v-model="form.emoji" fluid maxlength="8" placeholder="🍲" />
      </div>

      <div class="form-field">
        <label>Kategori *</label>
        <Select v-model="form.category" :options="categories" option-label="text" option-value="value" fluid
          :invalid="submitted && !form.category" placeholder="Seç" />
      </div>
      <div class="form-field">
        <label>Doğal ölçü *</label>
        <Select v-model="form.measure" :options="measures" option-label="text" option-value="value" fluid
          :invalid="submitted && !form.measure" placeholder="Seç" />
      </div>
      <div class="form-field">
        <label>1 ölçü ağırlığı *</label>
        <InputNumber v-model="form.gramPerMeasure" :min="0" :max-fraction-digits="2" suffix=" g" fluid :disabled="gramLocked" />
        <small v-if="gramLocked" class="field-hint">Gram ölçüsünde makrolar 1 gram içindir.</small>
      </div>
      <div class="form-field">
        <label>Varsayılan miktar *</label>
        <InputNumber v-model="form.defaultQuantity" :min="0" :max-fraction-digits="1" fluid />
      </div>

      <div class="macro-fields span-4">
        <div class="form-field"><label>Enerji</label><InputNumber v-model="form.macros.kcal" :min="0" :max-fraction-digits="3" suffix=" kcal" fluid /></div>
        <div class="form-field"><label>Protein</label><InputNumber v-model="form.macros.protein" :min="0" :max-fraction-digits="3" suffix=" g" fluid /></div>
        <div class="form-field"><label>Karbonhidrat</label><InputNumber v-model="form.macros.carb" :min="0" :max-fraction-digits="3" suffix=" g" fluid /></div>
        <div class="form-field"><label>Yağ</label><InputNumber v-model="form.macros.fat" :min="0" :max-fraction-digits="3" suffix=" g" fluid /></div>
        <p class="macro-check span-4" :class="{ drift: kcalDrift }">
          <i :class="kcalDrift ? 'pi pi-exclamation-triangle' : 'pi pi-check-circle'" aria-hidden="true" />
          Makrolardan çıkan enerji <strong>{{ decimal(derivedKcal) }} kcal</strong>
          <template v-if="kcalDrift"> — kayıtlı değerden belirgin sapıyor.</template>
        </p>
      </div>

      <div class="form-field span-2">
        <label>Besin grupları</label>
        <MultiSelect v-model="form.groups" :options="groups" option-label="text" option-value="value" display="chip" fluid placeholder="Grup seç" />
      </div>
      <div class="form-field span-2">
        <label>Diyet uyumu</label>
        <MultiSelect v-model="form.dietTags" :options="dietTags" option-label="text" option-value="value" display="chip" fluid placeholder="Etiket seç" />
      </div>

      <div class="form-field span-2">
        <label>Uygun öğünler</label>
        <MultiSelect v-model="form.suitableMeals" :options="meals" option-label="text" option-value="value" display="chip" fluid placeholder="Öğün seç" />
      </div>
      <div class="form-field">
        <label>Lif</label>
        <InputNumber v-model="form.fiberG" :min="0" :max-fraction-digits="3" suffix=" g" fluid />
      </div>
      <div class="form-field">
        <label>Sıvı katkısı</label>
        <InputNumber v-model="form.liquidMl" :min="0" :max-fraction-digits="0" suffix=" ml" fluid placeholder="Katı besinde boş" />
      </div>

      <div class="form-field span-2">
        <label for="food-aliases">Takma adlar</label>
        <AutoComplete id="food-aliases" v-model="form.aliases" multiple fluid :typeahead="false"
          :suggestions="aliasSuggestions" placeholder="Yaz ve Enter'a bas" />
        <small class="field-hint">Aramada bu adlarla da bulunur.</small>
      </div>
      <div class="form-field span-2">
        <label for="food-lighter">Denge bağı</label>
        <InputText id="food-lighter" v-model="form.lighterAlternative" fluid placeholder="Daha hafif alternatifin adı" />
        <small class="field-hint">Katalogdaki bir besnin tam adı olmalı; bağ ada göre kurulur.</small>
      </div>

      <div class="form-field span-4">
        <label for="food-description">Kısa açıklama</label>
        <Textarea id="food-description" v-model="form.description" rows="3" fluid auto-resize />
      </div>

      <label class="switch-row span-4">
        <div><strong>Katalogda aktif</strong><small>Pasif besinler uygulama aramalarında gösterilmez.</small></div>
        <ToggleSwitch v-model="form.active" />
      </label>
    </div>

    <template #footer>
      <Button label="Vazgeç" severity="secondary" text @click="visible = false" />
      <Button :label="food ? 'Değişiklikleri kaydet' : 'Besini ekle'" icon="pi pi-check" :loading="saving" @click="submit" />
    </template>
  </Dialog>
</template>
