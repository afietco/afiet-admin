<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import PageHeader from '../../components/PageHeader.vue'
import EmptyState from '../../components/EmptyState.vue'
import CatalogPulse from './CatalogPulse.vue'
import FacetRail from './FacetRail.vue'
import FoodCard from './FoodCard.vue'
import FoodDetail from './FoodDetail.vue'
import FoodDialog from './FoodDialog.vue'
import {
  AbortedError, activeFilterCount, emptyFilters, foodsApi, invalidateFoodCache,
  type Food, type FoodFacets, type FoodFilters, type FoodInput,
} from '../../services/foods'
import { number, SORT_LABELS } from '../../services/foodLabels'

const PAGE_SIZE = 48
const SEARCH_DEBOUNCE = 250

const toast = useToast()
const confirm = useConfirm()

const facets = ref<FoodFacets | null>(null)
const filters = reactive<FoodFilters>(emptyFilters())
/** Arama kutusunun ham değeri; debounce sonunda filters.query'ye düşer. */
const searchText = ref('')

const rows = ref<Food[]>([])
const total = ref(0)
const page = ref(1)
/** Yalnız İLK yüklemede iskelet gösterilir; sonrasında önceki sonuç ekranda kalır. */
const firstLoad = ref(true)
const loading = ref(false)
const loadingMore = ref(false)
const failed = ref('')

const detailFood = ref<Food | null>(null)
const detailOpen = ref(false)
const dialogOpen = ref(false)
const dialogFood = ref<Food | null>(null)
const saving = ref(false)

const sortOptions = computed(() =>
  (facets.value?.sortKeys ?? ['name']).map((key) => ({ value: key, text: SORT_LABELS[key] ?? key })))

const hasMore = computed(() => rows.value.length < total.value)
const filterCount = computed(() => activeFilterCount(filters))

/**
 * Uçuştaki isteği iptal eden denetleyici. Facet raylarında hızlı tıklamada ve
 * yazarken her istek bir öncekini geçersiz kılar; iptal edilmeyen yanıtlar
 * sırasız dönüp ekrana eski sonucu yazabilir.
 */
let inFlight: AbortController | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null

async function load(append = false) {
  inFlight?.abort()
  const controller = new AbortController()
  inFlight = controller

  if (append) loadingMore.value = true
  else loading.value = true
  failed.value = ''

  try {
    const result = await foodsApi.list(filters, append ? page.value : 1, PAGE_SIZE, controller.signal)
    if (controller.signal.aborted) return
    if (append) rows.value = [...rows.value, ...result.items]
    else {
      rows.value = result.items
      page.value = 1
    }
    total.value = result.total
  } catch (err) {
    if (err instanceof AbortedError) return
    const message = err instanceof Error ? err.message : 'Besinler alınamadı.'
    failed.value = message
    toast.add({ severity: 'error', summary: 'Besinler alınamadı', detail: message, life: 4000 })
  } finally {
    if (inFlight === controller) inFlight = null
    loading.value = false
    loadingMore.value = false
    firstLoad.value = false
  }
}

function loadMore() {
  if (loadingMore.value || !hasMore.value) return
  page.value += 1
  load(true)
}

async function loadFacets() {
  try {
    facets.value = await foodsApi.facets()
  } catch (err) {
    if (err instanceof AbortedError) return
    toast.add({ severity: 'warn', summary: 'Katalog dağılımı alınamadı', detail: err instanceof Error ? err.message : '', life: 4000 })
  }
}

watch(searchText, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    filters.query = value.trim()
  }, SEARCH_DEBOUNCE)
})

// Her filtre değişimi listeyi baştan çeker. Sonuç önbelleklendiği için ileri
// geri gezinmek ağa çıkmaz.
watch(() => ({ ...filters }), () => load(), { deep: true })

function pick(key: keyof FoodFilters, value: string) {
  filters[key] = value
}

function reset() {
  Object.assign(filters, emptyFilters())
  searchText.value = ''
}

function openDetail(food: Food) {
  detailFood.value = food
  detailOpen.value = true
}

/** Denge bağı hedefini aramaya taşır; bağ ada göre kurulduğu için arama yeterli. */
function jumpTo(name: string) {
  detailOpen.value = false
  reset()
  searchText.value = name
  filters.query = name
}

function createFood() {
  dialogFood.value = null
  dialogOpen.value = true
}

function editFood(food: Food) {
  dialogFood.value = food
  detailOpen.value = false
  dialogOpen.value = true
}

async function save(input: FoodInput) {
  saving.value = true
  try {
    if (dialogFood.value) await foodsApi.update(dialogFood.value.id, input)
    else await foodsApi.add(input)
    toast.add({ severity: 'success', summary: dialogFood.value ? 'Besin güncellendi' : 'Besin eklendi', life: 2500 })
    dialogOpen.value = false
    await Promise.all([load(), loadFacets()])
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Kaydedilemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
  } finally {
    saving.value = false
  }
}

function remove(food: Food) {
  confirm.require({
    header: 'Besini sil',
    message: `${food.name} katalogdan kalıcı olarak silinsin mi? Kayıt geri getirilemez; kataloğdan çıkarmak için "Pasif" yapmak yeterlidir.`,
    icon: 'pi pi-exclamation-triangle', rejectLabel: 'Vazgeç', acceptLabel: 'Kalıcı olarak sil', acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await foodsApi.remove(food.id)
        detailOpen.value = false
        toast.add({ severity: 'success', summary: 'Besin silindi', life: 2500 })
        await Promise.all([load(), loadFacets()])
      } catch (err) {
        toast.add({ severity: 'error', summary: 'Silinemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
      }
    },
  })
}

// Izgaranın dibindeki nöbetçi görününce sonraki sayfa çekilir; kullanıcı
// düğmeye basmadan gezinir, DOM yine de sayfa sayfa büyür.
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  invalidateFoodCache()
  loadFacets()
  load()
  observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) loadMore()
  }, { rootMargin: '600px' })
  watch(sentinel, (element, previous) => {
    if (previous) observer?.unobserve(previous)
    if (element) observer?.observe(element)
  }, { immediate: true })
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
  inFlight?.abort()
  observer?.disconnect()
})
</script>

<template>
  <div class="page-wrap catalog-page">
    <PageHeader
      eyebrow="İÇERİK"
      title="Besin kataloğu"
      description="Uygulamanın ortak besin dili: ölçüler, makrolar, diyet uyumu ve denge bağları."
    >
      <Button label="Yeni besin" icon="pi pi-plus" @click="createFood" />
    </PageHeader>

    <CatalogPulse :facets="facets" />

    <div class="catalog-body">
      <FacetRail :facets="facets" :filters="filters" @pick="pick" @reset="reset" />

      <section class="catalog-results">
        <div class="catalog-toolbar">
          <span class="search-box">
            <i class="pi pi-search" aria-hidden="true" />
            <InputText v-model="searchText" placeholder="Ad veya takma adla ara…" />
          </span>
          <Select v-model="filters.sort" :options="sortOptions" option-label="text" option-value="value" />
          <Button
            :icon="filters.order === 'desc' ? 'pi pi-sort-amount-down' : 'pi pi-sort-amount-up'"
            severity="secondary" outlined
            :aria-label="filters.order === 'desc' ? 'Azalan sıralama' : 'Artan sıralama'"
            @click="filters.order = filters.order === 'desc' ? 'asc' : 'desc'"
          />
          <span class="result-count">
            <template v-if="loading && !firstLoad"><i class="pi pi-spin pi-spinner" aria-hidden="true" /> </template>
            {{ number(total) }} besin
            <template v-if="filterCount"> · {{ filterCount }} filtre</template>
          </span>
        </div>

        <ul class="macro-key" aria-label="Makro çubuğu göstergesi">
          <li><span class="legend-swatch macro-protein" aria-hidden="true" /> Protein</li>
          <li><span class="legend-swatch macro-carb" aria-hidden="true" /> Karbonhidrat</li>
          <li><span class="legend-swatch macro-fat" aria-hidden="true" /> Yağ</li>
          <li class="macro-key-note">çubuk enerji payını gösterir</li>
        </ul>

        <div v-if="firstLoad" class="food-grid" aria-hidden="true">
          <div v-for="n in 12" :key="n" class="food-card skeleton-card" />
        </div>

        <EmptyState
          v-else-if="!rows.length && !failed"
          icon="pi pi-book"
          title="Besin bulunamadı"
          description="Filtreleri temizle ya da kataloğa yeni bir besin ekle."
        />

        <div v-else-if="failed && !rows.length" class="error-banner">
          <i class="pi pi-exclamation-circle" aria-hidden="true" />
          <span>{{ failed }}</span>
          <button type="button" @click="load()">Yeniden dene</button>
        </div>

        <div v-else class="food-grid" :class="{ dimmed: loading }">
          <FoodCard v-for="food in rows" :key="food.id" :food="food" @open="openDetail(food)" />
        </div>

        <div v-if="hasMore" ref="sentinel" class="grid-sentinel">
          <Button v-if="!loadingMore" label="Daha fazla göster" severity="secondary" outlined @click="loadMore" />
          <span v-else class="loading-more"><i class="pi pi-spin pi-spinner" aria-hidden="true" /> Yükleniyor…</span>
        </div>
        <p v-else-if="rows.length" class="grid-end">Tüm sonuçlar gösteriliyor.</p>
      </section>
    </div>

    <FoodDetail
      v-model:visible="detailOpen"
      :food="detailFood"
      @edit="editFood"
      @remove="remove"
      @jump="jumpTo"
    />

    <FoodDialog
      v-model:visible="dialogOpen"
      :facets="facets"
      :food="dialogFood"
      :saving="saving"
      @save="save"
    />
  </div>
</template>
