<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import EmptyState from '../../components/EmptyState.vue'
import CandidateCard from './CandidateCard.vue'
import CandidateDialog from './CandidateDialog.vue'
import FoodDialog from './FoodDialog.vue'
import {
  CANDIDATE_SORT_LABELS, CANDIDATE_STATUS_LABELS, CURATION_LIST_PATH, curationApi,
  customFoodPool, emptyCurationFilters, MissingEndpointError,
  type CandidateStatus, type CurationFilters, type CurationSummary,
  type CustomFoodCandidate, type CustomFoodPool, type DecisionInput,
} from '../../services/foodCuration'
import { foodsApi, invalidateFoodCache, type FoodFacets, type FoodInput } from '../../services/foods'
import { number } from '../../services/foodLabels'

defineProps<{ facets: FoodFacets | null }>()
const emit = defineEmits<{ (e: 'catalog-changed'): void }>()

const PAGE_SIZE = 36
const SEARCH_DEBOUNCE = 250

const toast = useToast()

const filters = reactive<CurationFilters>(emptyCurationFilters())
const searchText = ref('')

const rows = ref<CustomFoodCandidate[]>([])
const total = ref(0)
const summary = ref<CurationSummary | null>(null)
const loading = ref(true)
const failed = ref('')
/** Liste ucu 404 döndü: veri yok DEĞİL, uç yok. İkisi ayrı ekran gösterir. */
const endpointMissing = ref(false)

const pool = ref<CustomFoodPool | null>(null)
const poolFailed = ref('')

const selected = ref<CustomFoodCandidate | null>(null)
const reviewOpen = ref(false)
const deciding = ref(false)

const promoteSeed = ref<FoodInput | null>(null)
const promoteFor = ref<CustomFoodCandidate | null>(null)
const promoteOpen = ref(false)
const saving = ref(false)

const statusOptions = [
  { value: '', text: 'Tümü' },
  ...(Object.keys(CANDIDATE_STATUS_LABELS) as CandidateStatus[])
    .map((key) => ({ value: key, text: CANDIDATE_STATUS_LABELS[key] })),
]
const sortOptions = (Object.keys(CANDIDATE_SORT_LABELS) as CurationFilters['sort'][])
  .map((key) => ({ value: key, text: CANDIDATE_SORT_LABELS[key] }))

const poolTiles = computed(() => {
  const value = pool.value
  if (!value) return []
  const average = value.contributors ? value.customFoods / value.contributors : 0
  return [
    { key: 'foods', value: number(value.customFoods), label: 'kullanıcı besni', note: value.truncated ? 'en az' : 'toplam' },
    { key: 'people', value: number(value.contributors), label: 'kullanıcı ekledi', note: `${number(value.scanned)} kişi tarandı` },
    { key: 'avg', value: average ? average.toFixed(1).replace('.', ',') : '0', label: 'kişi başına besin', note: 'ortalama' },
  ]
})

let inFlight: AbortController | null = null
let searchTimer: ReturnType<typeof setTimeout> | null = null

async function load() {
  inFlight?.abort()
  const controller = new AbortController()
  inFlight = controller
  loading.value = true
  failed.value = ''
  try {
    const page = await curationApi.list(filters, 1, PAGE_SIZE, controller.signal)
    if (controller.signal.aborted) return
    rows.value = page.items
    total.value = page.total
    summary.value = page.summary
    endpointMissing.value = false
  } catch (err) {
    if (controller.signal.aborted) return
    rows.value = []
    total.value = 0
    summary.value = null
    if (err instanceof MissingEndpointError) {
      endpointMissing.value = true
    } else {
      failed.value = err instanceof Error ? err.message : 'Adaylar alınamadı.'
    }
  } finally {
    if (inFlight === controller) inFlight = null
    loading.value = false
  }
}

async function loadPool() {
  poolFailed.value = ''
  try {
    pool.value = await customFoodPool()
  } catch (err) {
    poolFailed.value = err instanceof Error ? err.message : 'Kullanıcı listesi okunamadı.'
  }
}

watch(searchText, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { filters.query = value.trim() }, SEARCH_DEBOUNCE)
})

watch(() => ({ ...filters }), () => { if (!endpointMissing.value) load() }, { deep: true })

function openCandidate(candidate: CustomFoodCandidate) {
  selected.value = candidate
  reviewOpen.value = true
}

/** Adayı katalog formuna taşır. Kayıt formda kaydedilene kadar OLUŞMAZ. */
function promote(candidate: CustomFoodCandidate) {
  const macros = candidate.macros
  promoteFor.value = candidate
  promoteSeed.value = {
    name: candidate.name,
    groups: [...candidate.groups],
    category: '',
    measure: candidate.measure ?? '',
    macros: macros
      ? {
        kcal: macros.kcal.median,
        protein: macros.protein.median,
        carb: macros.carb.median,
        fat: macros.fat.median,
      }
      : { kcal: 0, protein: 0, carb: 0, fat: 0 },
    description: '',
    active: true,
    gramPerMeasure: candidate.measure === 'gram' ? 1 : 100,
    fiberG: 0,
    suitableMeals: [],
    dietTags: [],
    emoji: '',
    defaultQuantity: 1,
    aliases: candidate.variants.map((variant) => variant.name).filter((name) => name !== candidate.name),
    liquidMl: null,
    lighterAlternative: null,
  }
  reviewOpen.value = false
  promoteOpen.value = true
}

async function savePromotion(input: FoodInput) {
  const candidate = promoteFor.value
  if (!candidate) return
  saving.value = true
  try {
    const food = await foodsApi.add(input)
    invalidateFoodCache()
    emit('catalog-changed')
    promoteOpen.value = false
    try {
      await curationApi.decide(candidate.key, { action: 'kataloga_al', foodId: food.id })
      toast.add({ severity: 'success', summary: 'Kataloğa alındı', detail: `${food.name} eklendi ve aday kapandı.`, life: 3000 })
      await load()
    } catch (err) {
      // Besin GERÇEKTEN eklendi; yalnız karar yazılamadı. Sessiz geçilirse
      // aday listede kalır ve ikinci kez eklenir.
      const detail = err instanceof MissingEndpointError
        ? 'Besin kataloğa eklendi ama karar kaydedilemedi: karar ucu backend tarafında yok.'
        : err instanceof Error ? err.message : ''
      toast.add({ severity: 'warn', summary: 'Besin eklendi, karar yazılamadı', detail, life: 6000 })
    }
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Kaydedilemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
  } finally {
    saving.value = false
  }
}

async function decide(input: DecisionInput) {
  const candidate = selected.value
  if (!candidate) return
  deciding.value = true
  try {
    await curationApi.decide(candidate.key, input)
    reviewOpen.value = false
    toast.add({
      severity: 'success',
      summary: input.action === 'reddet' ? 'Aday reddedildi' : 'Mevcut kayda bağlandı',
      detail: 'Karar geri alınabilir.',
      life: 3000,
    })
    await load()
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Karar yazılamadı', detail: err instanceof Error ? err.message : '', life: 4000 })
  } finally {
    deciding.value = false
  }
}

async function undo() {
  const candidate = selected.value
  if (!candidate) return
  deciding.value = true
  try {
    await curationApi.undo(candidate.key)
    reviewOpen.value = false
    toast.add({
      severity: 'success',
      summary: 'Karar geri alındı',
      detail: 'Kataloğa alınan besin silinmedi; gerekiyorsa katalog sekmesinden pasife çek.',
      life: 5000,
    })
    await load()
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Geri alınamadı', detail: err instanceof Error ? err.message : '', life: 4000 })
  } finally {
    deciding.value = false
  }
}

onMounted(() => {
  load()
  loadPool()
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
  inFlight?.abort()
})
</script>

<template>
  <div class="curation">
    <!-- Havuz paneli GERÇEK veriyle çalışır: /v1/admin/users her satırda
         customFoodCount taşıyor. Aday listesi ucu açılmadan önce bile
         kürasyonun ne kadar iş olduğu buradan okunur. -->
    <section class="pool-card">
      <div class="pool-tiles">
        <div v-for="tile in poolTiles" :key="tile.key" class="pool-tile">
          <strong>{{ tile.value }}</strong>
          <span>{{ tile.label }}</span>
          <small>{{ tile.note }}</small>
        </div>
        <div v-if="!pool && !poolFailed" class="pool-tile"><span class="pool-loading">Havuz okunuyor…</span></div>
        <div v-if="poolFailed" class="pool-tile"><span class="pool-loading">{{ poolFailed }}</span></div>
      </div>
      <div class="pool-side">
        <p class="pool-title">EN ÇOK EKLEYENLER</p>
        <ul v-if="pool?.top.length">
          <li v-for="person in pool.top" :key="person.userId">
            <RouterLink :to="{ name: 'user-detail', params: { userId: person.userId } }">
              {{ person.displayName || person.email }}
            </RouterLink>
            <span>{{ number(person.count) }}</span>
          </li>
        </ul>
        <p v-else class="pool-empty">Henüz kimse kendi besnini eklememiş.</p>
        <small v-if="pool?.truncated" class="pool-foot">
          Kullanıcı listesi kırpıldı; sayılar taranan {{ number(pool.scanned) }} kişiyi kapsar.
        </small>
      </div>
    </section>

    <div class="curation-toolbar">
      <span class="search-box">
        <i class="pi pi-search" aria-hidden="true" />
        <InputText v-model="searchText" placeholder="Aday adı ara…" :disabled="endpointMissing" />
      </span>
      <Select v-model="filters.status" :options="statusOptions" option-label="text" option-value="value"
        :disabled="endpointMissing" />
      <span class="min-users">
        <label for="min-users">En az</label>
        <InputNumber id="min-users" v-model="filters.minUsers" :min="1" :max="99" show-buttons
          button-layout="horizontal" :disabled="endpointMissing" />
        <span>kullanıcı</span>
      </span>
      <Select v-model="filters.sort" :options="sortOptions" option-label="text" option-value="value"
        :disabled="endpointMissing" />
      <Button
        :icon="filters.order === 'desc' ? 'pi pi-sort-amount-down' : 'pi pi-sort-amount-up'"
        severity="secondary" outlined :disabled="endpointMissing"
        :aria-label="filters.order === 'desc' ? 'Azalan sıralama' : 'Artan sıralama'"
        @click="filters.order = filters.order === 'desc' ? 'asc' : 'desc'"
      />
      <span v-if="summary" class="result-count">
        {{ number(total) }} aday · {{ number(summary.pending) }} bekliyor
      </span>
    </div>

    <div v-if="loading" class="candidate-grid" aria-hidden="true">
      <div v-for="n in 6" :key="n" class="candidate-skeleton" />
    </div>

    <!-- Uç yok: veri UYDURULMAZ. Ekran ne beklediğini yazar, boş kalır. -->
    <section v-else-if="endpointMissing" class="contract-card">
      <header>
        <i class="pi pi-server" aria-hidden="true" />
        <div>
          <strong>Kürasyon ucu backend'de henüz yok</strong>
          <p>
            Kullanıcı besinleri custom_foods tablosunda duruyor ve yalnız kullanıcının kendi
            menüsü olarak okunabiliyor. Admin tarafı için aşağıdaki üç uç açılınca bu ekran
            gerçek adaylarla dolar. O güne kadar burada sahte aday gösterilmez.
          </p>
        </div>
      </header>

      <dl class="contract-list">
        <div>
          <dt><code>GET {{ CURATION_LIST_PATH }}</code></dt>
          <dd>
            Sorgu: <code>query</code>, <code>status</code>, <code>minUsers</code>,
            <code>sort</code>, <code>order</code>, <code>page</code>, <code>pageSize</code>.
            Yanıt <code>{ items, total, page, pageSize, summary }</code>.
            Satırlar custom_foods.name'in normalize hâline göre gruplanır; anahtar
            <code>key</code>. Her satır kaç farklı kullanıcının eklediğini
            (<code>userCount</code>), meal_entries'te kaç kez geçtiğini
            (<code>entryCount</code>), makro ortanca ve aralığını, yazım varyantlarını ve
            katalogla çakışmayı (<code>matches</code>) taşır.
          </dd>
        </div>
        <div>
          <dt><code>POST {{ CURATION_LIST_PATH }}/{key}/decision</code></dt>
          <dd>
            Gövde <code>{ action, foodId?, note? }</code>; action
            <code>kataloga_al</code> | <code>birlestir</code> | <code>reddet</code>.
            Uç yalnız kararı yazar, besin yaratmaz: kataloğa alma panelden
            <code>POST /v1/admin/foods</code> ile yapılır ve oluşan id buraya yollanır.
          </dd>
        </div>
        <div>
          <dt><code>DELETE {{ CURATION_LIST_PATH }}/{key}/decision</code></dt>
          <dd>
            Kararı geri alır, aday yeniden bekleyene döner. Katalog kaydını silmez.
          </dd>
        </div>
      </dl>

      <p class="contract-foot">
        Tam sözleşme ve karar tablosunun şeması <code>src/services/foodCuration.ts</code>
        başındaki yorumda. Alan adları TypeScript tipleriyle birebir aynı olmalı.
      </p>
    </section>

    <div v-else-if="failed" class="error-banner">
      <i class="pi pi-exclamation-circle" aria-hidden="true" />
      <span>{{ failed }}</span>
      <button type="button" @click="load()">Yeniden dene</button>
    </div>

    <EmptyState
      v-else-if="!rows.length"
      icon="pi pi-inbox"
      title="Bekleyen aday yok"
      description="Bu filtrede kullanıcı besni bulunamadı. Eşiği düşürmeyi ya da durum filtresini genişletmeyi dene."
    />

    <div v-else class="candidate-grid">
      <CandidateCard v-for="candidate in rows" :key="candidate.key" :candidate="candidate"
        @open="openCandidate(candidate)" />
    </div>

    <CandidateDialog
      v-model:visible="reviewOpen"
      :candidate="selected"
      :busy="deciding"
      @promote="promote"
      @decide="decide"
      @undo="undo"
    />

    <FoodDialog
      v-model:visible="promoteOpen"
      :facets="facets"
      :food="null"
      :seed="promoteSeed"
      :saving="saving"
      notice="Bu besin kullanıcı menüsünden geliyor. Eksik alanları doldurmadan kataloğa alma; kullanıcı kaydında gramaj, lif, diyet etiketi ve öğün bilgisi yoktur."
      @save="savePromotion"
    />
  </div>
</template>

<style scoped>
.curation { display: grid; gap: 18px; }

.pool-card {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(280px, .65fr);
  border: 1px solid var(--line);
  border-radius: 20px;
  background: var(--paper);
  box-shadow: var(--shadow);
  overflow: hidden;
}
.pool-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.pool-tile { padding: 20px 22px; border-right: 1px solid #f0ebdf; }
.pool-tile:last-child { border-right: 0; }
.pool-tile strong {
  display: block; color: var(--ink); font-size: 30px; font-weight: 850;
  letter-spacing: -.05em; line-height: 1; font-variant-numeric: tabular-nums;
}
.pool-tile span { display: block; margin-top: 7px; color: #55594f; font-size: 11px; font-weight: 800; }
.pool-tile small { display: block; margin-top: 3px; color: #9a9c93; font-size: 9px; font-weight: 700; }
.pool-loading { color: #a3a59c; font-size: 10px; font-style: italic; }

.pool-side { padding: 20px 24px; border-left: 1px solid var(--line); background: #fbf8f1; }
.pool-title { margin: 0 0 12px; color: var(--green); font-size: 9px; font-weight: 950; letter-spacing: .17em; }
.pool-side ul { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
.pool-side li { display: flex; gap: 10px; align-items: center; justify-content: space-between; }
.pool-side a {
  overflow: hidden; color: #3f5c4e; font-size: 11px; font-weight: 800;
  text-decoration: none; text-overflow: ellipsis; white-space: nowrap;
}
.pool-side a:hover { text-decoration: underline; }
.pool-side li span { color: #4d5148; font-size: 11px; font-weight: 850; font-variant-numeric: tabular-nums; }
.pool-empty { margin: 0; color: #a3a59c; font-size: 10px; font-style: italic; }
.pool-foot { display: block; margin-top: 12px; color: #9a9c93; font-size: 9px; line-height: 1.5; }

.curation-toolbar {
  display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
  padding: 12px 16px; border: 1px solid var(--line); border-radius: 16px;
  background: var(--paper); box-shadow: 0 4px 18px rgba(50, 50, 40, .035);
}
.curation-toolbar .search-box { flex: 1; min-width: 200px; }
.min-users { display: flex; gap: 7px; align-items: center; color: #62665c; font-size: 10px; font-weight: 800; }
.min-users :deep(.p-inputnumber-input) { width: 44px; text-align: center; }
.result-count { color: #8a8d84; font-size: 11px; font-weight: 750; }

.candidate-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(258px, 1fr)); gap: 13px; }
.candidate-skeleton {
  min-height: 178px; border: 1px dashed var(--line); border-radius: 17px; background: #faf7f0;
  animation: curation-pulse 1.4s ease-in-out infinite;
}
@keyframes curation-pulse { 50% { opacity: .45; } }

.contract-card {
  display: grid; gap: 16px; padding: 24px 26px;
  border: 1px solid #d8e4ea; border-radius: 20px; background: #f7fafb;
}
.contract-card > header { display: grid; grid-template-columns: 34px minmax(0, 1fr); gap: 14px; align-items: start; }
.contract-card > header i { color: #3f6472; font-size: 22px; }
.contract-card > header strong { display: block; color: #2c332e; font-size: 15px; font-weight: 850; letter-spacing: -.02em; }
.contract-card > header p { margin: 7px 0 0; color: #5c6058; font-size: 11px; line-height: 1.65; }

.contract-list { display: grid; gap: 14px; margin: 0; }
.contract-list dt { margin-bottom: 5px; }
.contract-list dd { margin: 0; color: #5c6058; font-size: 10px; line-height: 1.7; }
.contract-card code {
  padding: 1px 5px; border-radius: 5px;
  background: #e7eef1; color: #33505c; font-size: 10px; font-weight: 700;
}
.contract-list dt code { font-size: 11px; font-weight: 850; }
.contract-foot { margin: 0; color: #8a8d84; font-size: 10px; line-height: 1.6; }

@media (max-width: 1240px) {
  .pool-card { grid-template-columns: 1fr; }
  .pool-side { border-left: 0; border-top: 1px solid var(--line); }
}
@media (max-width: 580px) {
  .pool-tiles { grid-template-columns: 1fr 1fr; }
  .curation-toolbar { flex-wrap: wrap; }
  .curation-toolbar .search-box { min-width: 100%; }
}
</style>
