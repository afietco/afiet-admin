<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import QualityFindings from './QualityFindings.vue'
import { AbortedError, type Food, type FoodFacets, type FoodInput } from '../../services/foods'
import { catalogNeighbors } from '../../services/foodCuration'
import { runFoodChecks, type CatalogNeighbor } from '../../services/foodQuality'
import { decimal, label } from '../../services/foodLabels'

const props = defineProps<{
  facets: FoodFacets | null
  food: Food | null
  saving: boolean
  /**
   * Yeni kayıt için ön dolgu. Kürasyon ekranı bir kullanıcı besnini kataloğa
   * alırken formu bununla açar; `food` dolu olduğunda yok sayılır.
   */
  seed?: FoodInput | null
  /** Formun başında görünen bağlam notu (kürasyondan gelindiğini söyler). */
  notice?: string
}>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ (e: 'save', input: FoodInput): void }>()

const confirm = useConfirm()
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
  if (!open) {
    neighborRequest?.abort()
    return
  }
  submitted.value = false
  Object.assign(form, emptyForm())
  if (!props.food && props.seed) Object.assign(form, { ...props.seed, macros: { ...props.seed.macros } })
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

/**
 * Katalogdaki komşu kayıtlar; ad ve takma ad çakışması buradan çıkar. Arama
 * gerçek katalog ucuna gider, elde tutulan bir kopyaya değil. Düzenlenen kayıt
 * kendi kendisiyle çakışmasın diye listeden düşürülür.
 */
const neighbors = ref<CatalogNeighbor[]>([])
const neighborsLoaded = ref(false)
let neighborRequest: AbortController | null = null
let neighborTimer: ReturnType<typeof setTimeout> | null = null

watch([visible, () => form.name], ([open, name]) => {
  if (neighborTimer) clearTimeout(neighborTimer)
  if (!open || typeof name !== 'string' || name.trim().length < 2) {
    neighbors.value = []
    neighborsLoaded.value = false
    return
  }
  neighborTimer = setTimeout(async () => {
    neighborRequest?.abort()
    const controller = new AbortController()
    neighborRequest = controller
    try {
      const found = await catalogNeighbors(name, controller.signal)
      if (controller.signal.aborted) return
      neighbors.value = found.filter((item) => item.id !== props.food?.id)
      neighborsLoaded.value = true
    } catch (err) {
      if (err instanceof AbortedError) return
      // Komşu araması kaydetmeyi engellemez; ilgili kurallar beklemede kalır.
      neighborsLoaded.value = false
    }
  }, 350)
})

/**
 * Katalog denetiminin satır kuralları, kaydetmeden ÖNCE. Kirli veriyi elle
 * kataloğa taşımanın önündeki tek engel bu: kullanıcı besinlerinden gelen
 * kayıtlar da, elle yazılanlar da aynı kapıdan geçer.
 */
const report = computed(() => runFoodChecks({
  name: form.name,
  description: form.description,
  emoji: form.emoji,
  category: form.category,
  measure: form.measure,
  groups: form.groups,
  dietTags: form.dietTags,
  suitableMeals: form.suitableMeals,
  aliases: form.aliases,
  macros: form.macros,
  gramPerMeasure: form.gramPerMeasure,
  defaultQuantity: form.defaultQuantity,
  fiberG: form.fiberG,
  liquidMl: form.liquidMl,
}, { neighbors: neighbors.value, neighborsLoaded: neighborsLoaded.value }))

const energyOff = computed(() => report.value.findings.some((finding) => finding.code.startsWith('ENR')))

const nameInvalid = computed(() => submitted.value && !form.name.trim())
const valid = () => Boolean(form.name.trim() && form.category && form.measure && form.gramPerMeasure > 0 && form.defaultQuantity > 0)

// AutoComplete serbest metin modunda kullanılıyor; öneri listesi yok, sadece
// chip girişi. Boş dizi döndürmek arama açılırını kapalı tutar.
const aliasSuggestions = ref<string[]>([])

function submit() {
  submitted.value = true
  if (!valid()) return
  const critical = report.value.findings.filter((finding) => finding.severity === 'kritik')
  if (!critical.length) {
    emit('save', { ...form, macros: { ...form.macros } })
    return
  }
  // Kritik bulgu kaydetmeyi kilitlemiyor ama sessiz de geçmiyor: kararın
  // bilinçli olduğunu görmek istiyoruz.
  confirm.require({
    header: 'Kritik bulgu var',
    message: `${critical.length} kritik bulgu açık: ${critical.map((finding) => finding.title).join(', ')}. `
      + 'Katalog uygulamanın ortak besin dili; yanlış kayıt her kullanıcının hesabına karışır.',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Geri dön, düzelteyim',
    acceptLabel: 'Bulguya rağmen kaydet',
    acceptClass: 'p-button-danger',
    accept: () => emit('save', { ...form, macros: { ...form.macros } }),
  })
}

onBeforeUnmount(() => {
  if (neighborTimer) clearTimeout(neighborTimer)
  neighborRequest?.abort()
})
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="title" class="food-dialog" :style="{ width: '52rem' }">
    <p v-if="notice && !food" class="dialog-notice">
      <i class="pi pi-user-edit" aria-hidden="true" />
      <span>{{ notice }}</span>
    </p>

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
        <p class="macro-check span-4" :class="{ drift: energyOff }">
          <i :class="energyOff ? 'pi pi-exclamation-triangle' : 'pi pi-check-circle'" aria-hidden="true" />
          Makrolardan çıkan enerji <strong>{{ decimal(derivedKcal) }} kcal</strong>
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

      <!-- Ad yazılmadan kontrol gösterilmez: boş formda "uygun öğün atanmamış"
           demek kullanıcıyı hatasıyla değil, henüz yapmadığı işle azarlamaktır. -->
      <div v-if="form.name.trim()" class="span-4">
        <QualityFindings :report="report" />
      </div>
    </div>

    <template #footer>
      <Button label="Vazgeç" severity="secondary" text @click="visible = false" />
      <Button :label="food ? 'Değişiklikleri kaydet' : 'Besini ekle'" icon="pi pi-check" :loading="saving" @click="submit" />
    </template>
  </Dialog>
</template>

<style scoped>
.dialog-notice {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  margin: 0 0 16px;
  padding: 11px 14px;
  border: 1px solid #d8e4ea;
  border-radius: 12px;
  color: #3f6472;
  background: #f2f8fa;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.6;
}
.dialog-notice i { margin-top: 1px; font-size: 11px; }
</style>
