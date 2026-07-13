<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import PageHeader from '../components/PageHeader.vue'
import EmptyState from '../components/EmptyState.vue'
import { adminApi, type Food, type FoodInput } from '../services/admin'

const toast = useToast()
const confirm = useConfirm()
const rows = ref<Food[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const query = ref('')
const category = ref('')
const status = ref('')
const loading = ref(false)
const dialogOpen = ref(false)
const saving = ref(false)
const editingId = ref<string | null>(null)
const submitted = ref(false)

const categories = [
  { value: 'kahvaltilik', label: 'Kahvaltılık' }, { value: 'corba', label: 'Çorba' },
  { value: 'ana_yemek', label: 'Ana yemek' }, { value: 'yan', label: 'Pilav & garnitür' },
  { value: 'salata_yogurt', label: 'Salata & yoğurt' }, { value: 'meyve_kuruyemis', label: 'Meyve & kuruyemiş' },
  { value: 'atistirmalik', label: 'Atıştırmalık' }, { value: 'tatli', label: 'Tatlı' }, { value: 'icecek', label: 'İçecek' },
]
const groups = [
  { value: 'sebze', label: 'Sebze' }, { value: 'meyve', label: 'Meyve' }, { value: 'protein', label: 'Protein' },
  { value: 'tahil', label: 'Tahıl' }, { value: 'sut', label: 'Süt' }, { value: 'yag', label: 'Yağ' },
  { value: 'tatli', label: 'Tatlı' }, { value: 'fastfood', label: 'Fast food' },
]
const measures = ['adet', 'dilim', 'kase', 'kasik', 'bardak', 'fincan', 'avuc', 'porsiyon'].map((value) => ({ value, label: value[0]!.toUpperCase() + value.slice(1) }))
const statuses = [{ value: '', label: 'Tüm durumlar' }, { value: 'active', label: 'Aktif' }, { value: 'inactive', label: 'Pasif' }]

const emptyForm = (): FoodInput => ({ name: '', groups: [], category: '', measure: '', macros: { kcal: 0, protein: 0, carb: 0, fat: 0 }, description: '', active: true })
const form = reactive<FoodInput>(emptyForm())
const title = computed(() => editingId.value ? 'Besini düzenle' : 'Yeni besin')
const categoryLabel = (value: string) => categories.find((item) => item.value === value)?.label ?? value

async function load() {
  loading.value = true
  try {
    const result = await adminApi.foods({ page: page.value, pageSize: pageSize.value, query: query.value, category: category.value, status: status.value })
    rows.value = result.items
    total.value = result.total
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Besinler alınamadı', detail: err instanceof Error ? err.message : '', life: 4000 })
  } finally { loading.value = false }
}

function search() { page.value = 1; load() }
function onPage(event: DataTablePageEvent) { page.value = event.page + 1; pageSize.value = event.rows; load() }
function resetForm() { Object.assign(form, emptyForm()); editingId.value = null; submitted.value = false }
function createFood() { resetForm(); dialogOpen.value = true }
function editFood(food: Food) {
  editingId.value = food.id
  Object.assign(form, { name: food.name, groups: [...food.groups], category: food.category, measure: food.measure, macros: { ...food.macros }, description: food.description, active: food.active })
  submitted.value = false
  dialogOpen.value = true
}
function valid() { return Boolean(form.name.trim() && form.category && form.measure) }
async function save() {
  submitted.value = true
  if (!valid()) return
  saving.value = true
  try {
    if (editingId.value) await adminApi.updateFood(editingId.value, form)
    else await adminApi.addFood(form)
    toast.add({ severity: 'success', summary: editingId.value ? 'Besin güncellendi' : 'Besin eklendi', life: 2500 })
    dialogOpen.value = false
    await load()
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Kaydedilemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
  } finally { saving.value = false }
}
function remove(food: Food) {
  confirm.require({
    header: 'Besini sil', message: `${food.name} katalogdan kalıcı olarak silinsin mi?`, icon: 'pi pi-exclamation-triangle', rejectLabel: 'Vazgeç', acceptLabel: 'Sil', acceptClass: 'p-button-danger',
    accept: async () => {
      try { await adminApi.deleteFood(food.id); toast.add({ severity: 'success', summary: 'Besin silindi', life: 2500 }); await load() }
      catch (err) { toast.add({ severity: 'error', summary: 'Silinemedi', detail: err instanceof Error ? err.message : '', life: 4000 }) }
    },
  })
}
onMounted(load)
</script>

<template>
  <div class="page-wrap">
    <PageHeader eyebrow="İÇERİK" title="Besin kataloğu" description="Uygulamadaki ortak besin dilini, ölçüleri ve yaklaşık makroları yönet.">
      <Button label="Yeni besin" icon="pi pi-plus" @click="createFood" />
    </PageHeader>
    <section class="table-card">
      <div class="table-toolbar">
        <span class="search-box"><i class="pi pi-search" /><InputText v-model="query" placeholder="Besin ara…" @keyup.enter="search" /></span>
        <Select v-model="category" :options="[{ value: '', label: 'Tüm kategoriler' }, ...categories]" option-label="label" option-value="value" @change="search" />
        <Select v-model="status" :options="statuses" option-label="label" option-value="value" @change="search" />
        <Button icon="pi pi-search" label="Ara" severity="secondary" outlined @click="search" />
        <span class="result-count">{{ total.toLocaleString('tr-TR') }} kayıt</span>
      </div>
      <DataTable :value="rows" :loading="loading" lazy paginator scrollable :rows="pageSize" :total-records="total" :first="(page - 1) * pageSize" :rows-per-page-options="[10, 20, 50]" data-key="id" striped-rows @page="onPage">
        <template #empty><EmptyState icon="pi pi-book" title="Besin bulunamadı" description="Filtreleri temizle veya kataloğa yeni bir besin ekle." /></template>
        <Column header="Besin" style="min-width: 17rem"><template #body="{ data }"><div class="food-cell"><span class="food-glyph">{{ data.name.slice(0, 1) }}</span><div><strong>{{ data.name }}</strong><small>{{ categoryLabel(data.category) }}</small></div></div></template></Column>
        <Column header="Gruplar" style="min-width: 13rem"><template #body="{ data }"><div class="tag-stack"><Tag v-for="group in data.groups" :key="group" :value="groups.find(g => g.value === group)?.label || group" severity="secondary" /></div></template></Column>
        <Column field="measure" header="Ölçü"><template #body="{ data }"><span class="measure-pill">1 {{ data.measure }}</span></template></Column>
        <Column header="Enerji"><template #body="{ data }"><strong class="kcal-value">{{ data.macros.kcal }}</strong><small class="unit"> kcal</small></template></Column>
        <Column header="P · K · Y" style="min-width: 8rem"><template #body="{ data }"><span class="macro-line">{{ data.macros.protein }} · {{ data.macros.carb }} · {{ data.macros.fat }} g</span></template></Column>
        <Column header="Durum"><template #body="{ data }"><Tag :value="data.active ? 'Aktif' : 'Pasif'" :severity="data.active ? 'success' : 'secondary'" /></template></Column>
        <Column header="" frozen align-frozen="right" style="width: 6rem"><template #body="{ data }"><div class="row-actions"><Button icon="pi pi-pencil" text rounded aria-label="Düzenle" @click="editFood(data)" /><Button icon="pi pi-trash" text rounded severity="danger" aria-label="Sil" @click="remove(data)" /></div></template></Column>
      </DataTable>
    </section>

    <Dialog v-model:visible="dialogOpen" modal :header="title" class="food-dialog" :style="{ width: '46rem' }">
      <div class="form-grid">
        <div class="form-field span-2"><label for="food-name">Besin adı *</label><InputText id="food-name" v-model="form.name" fluid :invalid="submitted && !form.name.trim()" /><small v-if="submitted && !form.name.trim()" class="field-error">Besin adı gerekli.</small></div>
        <div class="form-field"><label>Kategori *</label><Select v-model="form.category" :options="categories" option-label="label" option-value="value" fluid :invalid="submitted && !form.category" /></div>
        <div class="form-field"><label>Doğal ölçü *</label><Select v-model="form.measure" :options="measures" option-label="label" option-value="value" fluid :invalid="submitted && !form.measure" /></div>
        <div class="form-field span-2"><label>Besin grupları</label><MultiSelect v-model="form.groups" :options="groups" option-label="label" option-value="value" display="chip" fluid placeholder="Grup seç" /></div>
        <div class="macro-fields span-2">
          <div class="form-field"><label>Enerji</label><InputNumber v-model="form.macros.kcal" :min="0" suffix=" kcal" fluid /></div>
          <div class="form-field"><label>Protein</label><InputNumber v-model="form.macros.protein" :min="0" :max-fraction-digits="1" suffix=" g" fluid /></div>
          <div class="form-field"><label>Karbonhidrat</label><InputNumber v-model="form.macros.carb" :min="0" :max-fraction-digits="1" suffix=" g" fluid /></div>
          <div class="form-field"><label>Yağ</label><InputNumber v-model="form.macros.fat" :min="0" :max-fraction-digits="1" suffix=" g" fluid /></div>
        </div>
        <div class="form-field span-2"><label for="description">Kısa açıklama</label><Textarea id="description" v-model="form.description" rows="4" fluid auto-resize /></div>
        <label class="switch-row span-2"><div><strong>Katalogda aktif</strong><small>Pasif besinler uygulama aramalarında gösterilmez.</small></div><ToggleSwitch v-model="form.active" /></label>
      </div>
      <template #footer><Button label="Vazgeç" severity="secondary" text @click="dialogOpen = false" /><Button :label="editingId ? 'Değişiklikleri kaydet' : 'Besini ekle'" icon="pi pi-check" :loading="saving" @click="save" /></template>
    </Dialog>
  </div>
</template>
