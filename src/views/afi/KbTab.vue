<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import EmptyState from '../../components/EmptyState.vue'
import {
  afiApi, collectedSources, kbSourceLabels, kbStatusLabels,
  type KbDoc, type KbRevision, type KbStatus,
} from '../../services/afi'

// Bilgi tabanı, Afi'nin cevaplarının KAYNAĞIDIR. Buradaki bir belge yayına
// alındığında bir sonraki tazeleme koşusunda Azure index'ine yazılır ve
// ziyaretçiye cevap olarak dönebilir. Yazmak index'i anında güncellemez.

const toast = useToast()
const confirm = useConfirm()

const PAGE_SIZE = 20
const rows = ref<KbDoc[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const query = ref('')
const statusFilter = ref<string>('')

const statusOptions = [
  { value: '', label: 'Hepsi' },
  { value: 'published', label: 'Yayında' },
  { value: 'draft', label: 'Taslak' },
  { value: 'archived', label: 'Arşiv' },
]
const editStatusOptions = (Object.keys(kbStatusLabels) as KbStatus[]).map((value) => ({
  value,
  label: kbStatusLabels[value],
}))

const dialogOpen = ref(false)
const saving = ref(false)
const editing = ref<KbDoc | null>(null)
const submitted = ref(false)
const form = reactive({
  slug: '',
  title: '',
  body: '',
  summary: '',
  url: '',
  status: 'draft' as KbStatus,
})

const revisions = ref<KbRevision[]>([])
const revisionsOpen = ref(false)

const slugValid = computed(() => /^[a-z0-9_-]{1,120}$/.test(form.slug))
const titleValid = computed(() => form.title.trim().length >= 3 && form.title.trim().length <= 200)
const bodyValid = computed(() => form.body.trim().length >= 10 && form.body.trim().length <= 20000)
// Alıntı site içi bağlantı olarak gösteriliyor. "//baska-site" protokolsüz bir
// dış URL, "/\baska-site" de tarayıcıda aynısına normalize oluyor: ikisi de
// ziyaretçiyi site dışına gönderir. Sunucu da aynı kuralı uyguluyor.
const urlValid = computed(() => {
  const u = form.url.trim()
  return u === '' || (u.startsWith('/') && !u.startsWith('//') && !u.startsWith('/\\'))
})
const formValid = computed(() => slugValid.value && titleValid.value && bodyValid.value && urlValid.value)

// Toplayıcının sahibi olduğu belgeler elle düzenlenmemeli: bir sonraki
// tazeleme koşusu kaynağından yeniden yazar ve değişiklik sessizce kaybolur.
const collected = (doc: KbDoc) => collectedSources.has(doc.source)

async function load() {
  loading.value = true
  try {
    const data = await afiApi.kbDocs({
      query: query.value.trim() || undefined,
      status: statusFilter.value || undefined,
      page: page.value,
      pageSize: PAGE_SIZE,
    })
    rows.value = data.items ?? []
    total.value = data.total
  } catch (err) {
    toast.add({
      severity: 'error', summary: 'Liste alınamadı',
      detail: err instanceof Error ? err.message : '', life: 4000,
    })
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = null
  submitted.value = false
  Object.assign(form, { slug: '', title: '', body: '', summary: '', url: '', status: 'draft' })
  dialogOpen.value = true
}

function openEdit(doc: KbDoc) {
  editing.value = doc
  submitted.value = false
  Object.assign(form, {
    slug: doc.slug, title: doc.title, body: doc.body,
    summary: doc.summary, url: doc.url, status: doc.status,
  })
  dialogOpen.value = true
}

async function save() {
  submitted.value = true
  if (!formValid.value) return
  saving.value = true
  try {
    const input = {
      slug: form.slug.trim(),
      title: form.title.trim(),
      body: form.body.trim(),
      summary: form.summary.trim(),
      url: form.url.trim(),
      // Etiketler ve kilit bu ekrandan yönetilmiyor; mevcut değerleri korunur.
      tags: editing.value?.tags ?? [],
      status: form.status,
      locked: editing.value?.locked ?? false,
    }
    if (editing.value) await afiApi.updateKbDoc(editing.value.id, input)
    else await afiApi.createKbDoc(input)
    dialogOpen.value = false
    toast.add({
      severity: 'success', summary: editing.value ? 'Belge güncellendi' : 'Belge eklendi',
      detail: 'Index’e yazılması için tazeleme koşusu gerekiyor.', life: 4000,
    })
    load()
  } catch (err) {
    toast.add({
      severity: 'error', summary: 'Kaydedilemedi',
      detail: err instanceof Error ? err.message : '', life: 5000,
    })
  } finally {
    saving.value = false
  }
}

function remove(doc: KbDoc) {
  confirm.require({
    message: `“${doc.title}” silinsin mi? Parçaları bir sonraki tazeleme koşusunda index’ten çıkarılır.`,
    header: 'Belgeyi sil',
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Sil',
    rejectLabel: 'Vazgeç',
    acceptProps: { severity: 'danger' },
    accept: async () => {
      try {
        await afiApi.deleteKbDoc(doc.id)
        toast.add({ severity: 'success', summary: 'Belge silindi', life: 3000 })
        load()
      } catch (err) {
        toast.add({
          severity: 'error', summary: 'Silinemedi',
          detail: err instanceof Error ? err.message : '', life: 5000,
        })
      }
    },
  })
}

async function openRevisions(doc: KbDoc) {
  revisionsOpen.value = true
  revisions.value = []
  try {
    const data = await afiApi.kbRevisions(doc.id)
    revisions.value = data.items ?? []
  } catch { /* boş liste gösterilir */ }
}

function onPage(event: DataTablePageEvent) {
  page.value = event.page + 1
  load()
}

function search() {
  page.value = 1
  load()
}

const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

onMounted(load)
</script>

<template>
  <section class="afi-tab">
    <div class="afi-toolbar">
      <span class="p-input-icon-left kb-search">
        <InputText v-model="query" placeholder="Başlık veya slug ara" @keyup.enter="search" />
      </span>
      <Select v-model="statusFilter" :options="statusOptions" option-label="label" option-value="value" @change="search" />
      <div class="kb-toolbar-actions">
        <Button label="Ara" icon="pi pi-search" outlined @click="search" />
        <Button label="Yeni belge" icon="pi pi-plus" @click="openCreate" />
      </div>
    </div>

    <p class="afi-hint">
      Bu belgeler Afi’nin cevaplarının kaynağıdır. Yayına aldığın bir belge, bir sonraki tazeleme
      koşusunda Azure index’ine yazılır; kaydetmek index’i anında güncellemez. SSS, blog ve yasal
      belgeler toplayıcı tarafından yönetilir, elle düzenlenirse sonraki koşuda üzerine yazılır.
    </p>

    <DataTable
      :value="rows"
      :loading="loading"
      lazy
      paginator
      :rows="PAGE_SIZE"
      :total-records="total"
      :first="(page - 1) * PAGE_SIZE"
      data-key="id"
      @page="onPage"
    >
      <template #empty>
        <EmptyState
          v-if="!loading"
          icon="pi pi-book"
          title="Belge yok"
          description="Bilgi tabanı boş. Tazeleme koşusu SSS ve blog yazılarını otomatik toplar; buraya elle de belge ekleyebilirsin."
        />
      </template>
      <Column field="title" header="Başlık">
        <template #body="{ data }">
          <div class="kb-title">
            <strong>{{ data.title }}</strong>
            <small>{{ data.slug }}</small>
          </div>
        </template>
      </Column>
      <Column header="Kaynak" style="width: 110px">
        <template #body="{ data }">{{ kbSourceLabels[data.source] ?? data.source }}</template>
      </Column>
      <Column header="Durum" style="width: 110px">
        <template #body="{ data }">
          <Tag
            :value="kbStatusLabels[data.status as KbStatus]"
            :severity="data.status === 'published' ? 'success' : data.status === 'draft' ? 'warn' : 'secondary'"
          />
        </template>
      </Column>
      <Column header="Index" style="width: 150px">
        <template #body="{ data }">
          <span v-if="data.stale" class="kb-stale"><i class="pi pi-clock" /> bekliyor</span>
          <span v-else class="kb-fresh">{{ data.chunkCount }} parça</span>
        </template>
      </Column>
      <Column header="Güncelleme" style="width: 150px">
        <template #body="{ data }">{{ shortDate(data.updatedAt) }}</template>
      </Column>
      <Column style="width: 150px">
        <template #body="{ data }">
          <div class="kb-row-actions">
            <Button icon="pi pi-pencil" text size="small" aria-label="Düzenle" @click="openEdit(data)" />
            <Button icon="pi pi-history" text size="small" aria-label="Geçmiş" @click="openRevisions(data)" />
            <Button icon="pi pi-trash" text size="small" severity="danger" aria-label="Sil" @click="remove(data)" />
          </div>
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="dialogOpen" modal :header="editing ? 'Belgeyi düzenle' : 'Yeni belge'" :style="{ width: '680px', maxWidth: '94vw' }">
      <div v-if="editing && collected(editing)" class="kb-warning">
        <i class="pi pi-info-circle" />
        <span>Bu belgeyi tazeleme koşusu yönetiyor. Elle yaptığın değişiklik bir sonraki koşuda kaynağından yeniden yazılır.</span>
      </div>

      <div class="kb-form">
        <label>
          <span>Slug</span>
          <InputText v-model="form.slug" :disabled="!!editing" :invalid="submitted && !slugValid" placeholder="afiyet-ritmi" />
          <small v-if="submitted && !slugValid" class="err">Yalnız küçük harf, rakam, tire ve alt çizgi.</small>
          <small v-else class="hint">Kalıcı kimlik; sonradan değiştirilmez.</small>
        </label>

        <label>
          <span>Başlık</span>
          <InputText v-model="form.title" :invalid="submitted && !titleValid" />
          <small v-if="submitted && !titleValid" class="err">3 ile 200 karakter arası olmalı.</small>
        </label>

        <label>
          <span>Özet</span>
          <InputText v-model="form.summary" placeholder="İsteğe bağlı" />
        </label>

        <label>
          <span>Gövde</span>
          <Textarea v-model="form.body" rows="10" auto-resize :invalid="submitted && !bodyValid" />
          <small v-if="submitted && !bodyValid" class="err">10 ile 20000 karakter arası olmalı.</small>
          <small v-else class="hint">{{ form.body.trim().length }} karakter. Afi bu metne dayanarak cevap verir.</small>
        </label>

        <div class="kb-form-row">
          <label>
            <span>Bağlantı</span>
            <InputText v-model="form.url" placeholder="/blog/yazi-adi" :invalid="submitted && !urlValid" />
            <small v-if="submitted && !urlValid" class="err">Site içi bir yol olmalı (“/” ile başlamalı).</small>
          </label>
          <label>
            <span>Durum</span>
            <Select v-model="form.status" :options="editStatusOptions" option-label="label" option-value="value" />
            <small class="hint">Yalnız yayındaki belgeler index’e girer.</small>
          </label>
        </div>
      </div>

      <template #footer>
        <Button label="Vazgeç" text @click="dialogOpen = false" />
        <Button label="Kaydet" icon="pi pi-check" :loading="saving" @click="save" />
      </template>
    </Dialog>

    <Dialog v-model:visible="revisionsOpen" modal header="Sürüm geçmişi" :style="{ width: '640px', maxWidth: '94vw' }">
      <EmptyState v-if="!revisions.length" icon="pi pi-history" title="Geçmiş yok" description="Bu belge hiç düzenlenmemiş." />
      <ol v-else class="kb-revisions">
        <li v-for="rev in revisions" :key="rev.id">
          <div class="kb-rev-head">
            <strong>{{ rev.title }}</strong>
            <small>{{ rev.author }} · {{ shortDate(rev.createdAt) }}</small>
          </div>
          <p>{{ rev.body.slice(0, 400) }}{{ rev.body.length > 400 ? '…' : '' }}</p>
        </li>
      </ol>
    </Dialog>
  </section>
</template>

<style scoped>
.afi-tab { display: grid; gap: 16px; }
.afi-toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.kb-search :deep(input) { min-width: 240px; }
.kb-toolbar-actions { display: flex; gap: 8px; margin-left: auto; }
.afi-hint { margin: 0; font-size: 13px; line-height: 1.5; opacity: .72; max-width: 74ch; }

.kb-title strong { display: block; }
.kb-title small { display: block; margin-top: 2px; font-size: 11px; opacity: .6; }
.kb-stale { display: inline-flex; gap: 5px; align-items: center; color: #b4541f; font-size: 12px; font-weight: 700; }
.kb-fresh { font-size: 12px; opacity: .75; font-variant-numeric: tabular-nums; }
.kb-row-actions { display: flex; gap: 2px; }

.kb-warning { display: flex; gap: 9px; align-items: flex-start; margin-bottom: 14px; padding: 11px 13px; border-radius: 11px; background: #fdf3e3; color: #7a4a12; font-size: 13px; line-height: 1.45; }
.kb-form { display: grid; gap: 14px; }
.kb-form label { display: grid; gap: 5px; }
.kb-form label > span { font-size: 12px; font-weight: 800; }
.kb-form .hint { font-size: 11px; opacity: .6; }
.kb-form .err { font-size: 11px; color: #b4541f; font-weight: 700; }
.kb-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
@media (max-width: 560px) { .kb-form-row { grid-template-columns: 1fr; } }

.kb-revisions { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
.kb-revisions li { padding: 11px 13px; border-radius: 11px; background: var(--surface-100, #f4f4f4); }
.kb-rev-head { display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; align-items: baseline; }
.kb-rev-head small { font-size: 11px; opacity: .6; }
.kb-revisions p { margin: 6px 0 0; font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
</style>
