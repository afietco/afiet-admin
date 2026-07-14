<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import SerpPreview from './SerpPreview.vue'
import SectionFooter from './SectionFooter.vue'
import { clone, formatWhen, stableStringify } from './shared'
import { webApi, type AdminSeoPayload, type PageSeo, type ResolvedPageMeta } from '../../services/webApi'

const props = defineProps<{ payload: AdminSeoPayload }>()
const emit = defineEmits<{ saved: [AdminSeoPayload] }>()
const toast = useToast()
const confirm = useConfirm()

const robotsPresets = ['noindex, nofollow', 'noindex', 'nofollow', 'index, follow']
const changefreqOptions = [
  { value: '', label: 'Belirtme' }, { value: 'always', label: 'Her zaman' }, { value: 'hourly', label: 'Saatlik' },
  { value: 'daily', label: 'Günlük' }, { value: 'weekly', label: 'Haftalık' }, { value: 'monthly', label: 'Aylık' },
  { value: 'yearly', label: 'Yıllık' }, { value: 'never', label: 'Asla' },
]

const emptyPage = (): PageSeo => ({ title: '', description: '', ogTitle: '', ogDescription: '', ogImage: '', canonical: '', robots: '', jsonld: [], sitemap: { include: true, changefreq: '', priority: null } })
const effectivePage = (path: string): PageSeo => props.payload.effective.pages[path] ?? emptyPage()

const pathList = computed(() => {
  const set = new Set<string>([...props.payload.defaults.knownPaths, ...Object.keys(props.payload.effective.pages)])
  return [...set].sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b, 'tr')))
})

const selectedPath = ref(pathList.value[0] ?? '/')
const form = reactive<PageSeo>(clone(effectivePage(selectedPath.value)))
let baseline = stableStringify(form)
const saving = ref(false)
const serverMeta = ref<ResolvedPageMeta | null>(null)
const loadingMeta = ref(false)

const dirty = computed(() => stableStringify(form) !== baseline)
const hasOverride = (path: string) => path in props.payload.overrides.pages
const pageUpdatedAt = (path: string) => props.payload.updatedAt[`page:${path}`] ?? ''

const general = computed(() => props.payload.effective.settings.general)
const previewTitle = computed(() => form.title || general.value.defaultTitle)
const previewDesc = computed(() => form.description || general.value.defaultDescription)
const previewUrl = computed(() => form.canonical || general.value.baseUrl.replace(/\/$/, '') + (selectedPath.value === '/' ? '/' : selectedPath.value))

function loadForm(path: string) {
  Object.assign(form, clone(effectivePage(path)))
  baseline = stableStringify(form)
  serverMeta.value = null
}

function selectPage(path: string) {
  if (path === selectedPath.value) return
  if (!dirty.value) { selectedPath.value = path; return }
  confirm.require({
    header: 'Kaydedilmemiş değişiklik',
    message: `${selectedPath.value} sayfasında kaydedilmemiş değişiklikler var. Yine de ${path} sayfasına geçilsin mi? Değişiklikler kaybolur.`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Vazgeç',
    acceptLabel: 'Geç, at',
    acceptClass: 'p-button-danger',
    accept: () => { selectedPath.value = path },
  })
}

watch(selectedPath, (p) => loadForm(p))
watch(() => props.payload, () => { if (!dirty.value) loadForm(selectedPath.value) })

async function save() {
  saving.value = true
  try {
    const p = await webApi.putPage(selectedPath.value, clone(form))
    Object.assign(form, clone(p.effective.pages[selectedPath.value] ?? form))
    baseline = stableStringify(form)
    emit('saved', p)
    toast.add({ severity: 'success', summary: 'Kaydedildi', detail: 'Site en geç 1 dakika içinde güncellenir.', life: 3000 })
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Kaydedilemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
  } finally {
    saving.value = false
  }
}

function resetPage() {
  confirm.require({
    header: 'Varsayılana dön',
    message: `${selectedPath.value} sayfasının tüm özelleştirmeleri silinir ve koddaki varsayılana dönülür. Emin misin?`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Vazgeç',
    acceptLabel: 'Varsayılana dön',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        const p = await webApi.deletePage(selectedPath.value)
        Object.assign(form, clone(p.effective.pages[selectedPath.value] ?? emptyPage()))
        baseline = stableStringify(form)
        emit('saved', p)
        toast.add({ severity: 'success', summary: 'Varsayılana döndürüldü', detail: 'Site en geç 1 dakika içinde güncellenir.', life: 3000 })
      } catch (err) {
        toast.add({ severity: 'error', summary: 'İşlem başarısız', detail: err instanceof Error ? err.message : '', life: 4000 })
      }
    },
  })
}

async function fetchServerMeta() {
  loadingMeta.value = true
  try {
    serverMeta.value = await webApi.meta(selectedPath.value)
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Önizleme alınamadı', detail: err instanceof Error ? err.message : '', life: 4000 })
  } finally {
    loadingMeta.value = false
  }
}
</script>

<template>
  <div class="pages-layout">
    <aside class="page-picker">
      <p class="preview-label">Sayfalar</p>
      <button v-for="path in pathList" :key="path" class="page-pick" :class="{ active: path === selectedPath }" @click="selectPage(path)">
        <span class="page-path">{{ path }}</span>
        <span v-if="hasOverride(path)" class="seo-dot" title="Özelleştirildi" />
      </button>
    </aside>

    <div class="tab-body page-editor">
      <section class="preview-strip single">
        <div class="preview-col">
          <div class="preview-head">
            <p class="preview-label">Google araması</p>
            <Button label="Sunucudan getir" icon="pi pi-cloud-download" size="small" text :loading="loadingMeta" @click="fetchServerMeta" />
          </div>
          <SerpPreview :url="previewUrl" :title="previewTitle" :description="previewDesc" />
          <div v-if="serverMeta" class="server-meta">
            <p class="preview-label">Sunucunun çözdüğü hali</p>
            <SerpPreview :url="serverMeta.canonical" :title="serverMeta.title" :description="serverMeta.description" />
            <small class="seo-hint">robots: {{ serverMeta.robots || 'varsayılan' }}</small>
          </div>
        </div>
      </section>

      <div class="form-grid">
        <div class="form-field span-2"><label>Başlık</label><InputText v-model="form.title" fluid placeholder="(boş — genel başlığı kullanır)" /></div>
        <div class="form-field span-2"><label>Açıklama</label><Textarea v-model="form.description" rows="2" fluid auto-resize placeholder="(boş — genel açıklamayı kullanır)" /></div>
        <div class="form-field"><label>OG başlık</label><InputText v-model="form.ogTitle" fluid placeholder="(boş — başlığı kullanır)" /></div>
        <div class="form-field"><label>OG görsel</label><InputText v-model="form.ogImage" fluid placeholder="(boş — genel OG görselini kullanır)" /></div>
        <div class="form-field span-2"><label>OG açıklama</label><Textarea v-model="form.ogDescription" rows="2" fluid auto-resize placeholder="(boş — açıklamayı kullanır)" /></div>
        <div class="form-field span-2"><label>Canonical URL</label><InputText v-model="form.canonical" fluid placeholder="(boş — otomatik)" /></div>
        <div class="form-field span-2"><label>robots etiketi</label><Select v-model="form.robots" :options="robotsPresets" editable fluid placeholder="(boş — varsayılan)" /></div>
        <label class="switch-row span-2">
          <div><strong>Site haritasına dahil et</strong><small>Kapalıysa bu sayfa sitemap.xml'e yazılmaz.</small></div>
          <ToggleSwitch v-model="form.sitemap.include" />
        </label>
        <div class="form-field"><label>Değişim sıklığı</label><Select v-model="form.sitemap.changefreq" :options="changefreqOptions" option-label="label" option-value="value" fluid /></div>
        <div class="form-field"><label>Öncelik (0–1, boş = belirtme)</label><InputNumber v-model="form.sitemap.priority" :min="0" :max="1" :max-fraction-digits="1" :step="0.1" show-buttons fluid /></div>
      </div>

      <SectionFooter :dirty="dirty" :saving="saving" :has-override="hasOverride(selectedPath)" :updated-at="pageUpdatedAt(selectedPath)" :db-connected="props.payload.dbConnected" @save="save" @reset="resetPage" />
    </div>
  </div>
</template>
