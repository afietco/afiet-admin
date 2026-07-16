<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import { slugify, type Channel, type ContentItem, type ContentItemInput, type ContentStatus } from '../../services/content'
import { buildPlanningPrompt, buildProductionPrompt, parsePlanImport, suggestedPromptKind } from './prompt'
import { CHANNELS, STATUSES, copyText, toDate, toIsoDate, useContentStore } from './shared'

const props = defineProps<{ item: ContentItem | null; defaultChannel?: Channel }>()
const visible = defineModel<boolean>('visible', { required: true })

const toast = useToast()
const confirm = useConfirm()
const { upsertItem, removeItem } = useContentStore()

const saving = ref(false)
const submitted = ref(false)
const promptKind = ref<'plan' | 'uretim'>('plan')
const importOpen = ref(false)
const importText = ref('')

const form = reactive({
  title: '',
  channel: 'blog' as Channel,
  status: 'fikir' as ContentStatus,
  slug: '',
  plannedDate: null as Date | null,
  publishedUrl: '',
  audience: '',
  angle: '',
  tone: '',
  cta: '',
  notes: '',
  keywordsText: '',
  outlineText: '',
  internalLinksText: '',
  sourcesText: '',
})

function initForm() {
  const it = props.item
  form.title = it?.title ?? ''
  form.channel = it?.channel ?? props.defaultChannel ?? 'blog'
  form.status = it?.status ?? 'fikir'
  form.slug = it?.slug ?? ''
  form.plannedDate = toDate(it?.plannedDate ?? null)
  form.publishedUrl = it?.publishedUrl ?? ''
  form.audience = it?.brief.audience ?? ''
  form.angle = it?.brief.angle ?? ''
  form.tone = it?.brief.tone ?? ''
  form.cta = it?.brief.cta ?? ''
  form.notes = it?.brief.notes ?? ''
  form.keywordsText = it?.brief.keywords.join(', ') ?? ''
  form.outlineText = it?.brief.outline.join('\n') ?? ''
  form.internalLinksText = it?.brief.internalLinks.join('\n') ?? ''
  form.sourcesText = it?.brief.sources.join('\n') ?? ''
  submitted.value = false
  importOpen.value = false
  importText.value = ''
  promptKind.value = suggestedPromptKind(form.status)
}
watch(visible, (open) => { if (open) initForm() })

const splitList = (text: string, sep: RegExp) => text.split(sep).map((s) => s.trim()).filter(Boolean)

function toInput(): ContentItemInput & { id?: number } {
  return {
    id: props.item?.id,
    channel: form.channel,
    title: form.title.trim(),
    status: form.status,
    slug: form.channel === 'blog' && form.slug.trim() ? slugify(form.slug) : null,
    brief: {
      keywords: splitList(form.keywordsText, /[,\n]/),
      audience: form.audience.trim(),
      angle: form.angle.trim(),
      tone: form.tone.trim(),
      outline: splitList(form.outlineText, /\n/),
      internalLinks: splitList(form.internalLinksText, /[,\n]/),
      cta: form.cta.trim(),
      sources: splitList(form.sourcesText, /\n/),
      notes: form.notes.trim(),
    },
    plannedDate: toIsoDate(form.plannedDate),
    publishedUrl: form.publishedUrl.trim() || null,
  }
}

const promptText = computed(() =>
  promptKind.value === 'plan' ? buildPlanningPrompt(toInput()) : buildProductionPrompt(toInput()),
)
const promptOptions = [
  { value: 'plan', label: 'Planlama' },
  { value: 'uretim', label: 'Üretim' },
]
const promptHint = computed(() =>
  promptKind.value === 'plan'
    ? 'Claude sohbetine yapıştır → dönen json bloğunu "İçe aktar" ile geri al.'
    : form.channel === 'blog'
      ? 'afiet-web reposunda Claude Code\'a yapıştır — yazıyı yazar ve yayınlar.'
      : 'Claude\'a yapıştır — yayına hazır metni üretir; paylaşımı sen yaparsın.',
)

async function copyPrompt() {
  if (!form.title.trim()) {
    submitted.value = true
    toast.add({ severity: 'warn', summary: 'Önce başlık gerekli', detail: 'Prompt, başlıktaki fikirden üretilir.', life: 3000 })
    return
  }
  const ok = await copyText(promptText.value)
  if (ok) toast.add({ severity: 'success', summary: 'Prompt kopyalandı', detail: promptHint.value, life: 3500 })
  else toast.add({ severity: 'error', summary: 'Kopyalanamadı', detail: 'Panoya erişilemedi — metni önizlemeden seçip kopyala.', life: 4000 })
}

function applyImport() {
  try {
    const plan = parsePlanImport(importText.value)
    if (plan.title) form.title = plan.title
    if (plan.slug && form.channel === 'blog') form.slug = slugify(plan.slug)
    if (plan.plannedDate) form.plannedDate = toDate(plan.plannedDate)
    const b = plan.brief ?? {}
    if (b.keywords) form.keywordsText = b.keywords.join(', ')
    if (b.audience !== undefined) form.audience = b.audience
    if (b.angle !== undefined) form.angle = b.angle
    if (b.tone !== undefined) form.tone = b.tone
    if (b.outline) form.outlineText = b.outline.join('\n')
    if (b.internalLinks) form.internalLinksText = b.internalLinks.join('\n')
    if (b.cta !== undefined) form.cta = b.cta
    if (b.sources) form.sourcesText = b.sources.join('\n')
    if (b.notes !== undefined) form.notes = b.notes
    if (form.status === 'fikir') form.status = 'planlandi'
    importOpen.value = false
    importText.value = ''
    promptKind.value = 'uretim'
    toast.add({ severity: 'success', summary: 'Brief içe aktarıldı', detail: 'Alanları kontrol edip kaydet.', life: 3000 })
  } catch (err) {
    toast.add({ severity: 'error', summary: 'İçe aktarılamadı', detail: err instanceof Error ? err.message : '', life: 4500 })
  }
}

async function save() {
  submitted.value = true
  if (!form.title.trim()) return
  saving.value = true
  try {
    await upsertItem(toInput())
    toast.add({ severity: 'success', summary: props.item ? 'İçerik güncellendi' : 'İçerik eklendi', life: 2500 })
    visible.value = false
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Kaydedilemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
  } finally {
    saving.value = false
  }
}

function remove() {
  const it = props.item
  if (!it) return
  confirm.require({
    header: 'İçeriği sil',
    message: `"${it.title}" plandan kalıcı olarak silinsin mi? Metrikleri de silinir.`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Vazgeç',
    acceptLabel: 'Sil',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await removeItem(it.id)
        toast.add({ severity: 'success', summary: 'İçerik silindi', life: 2500 })
        visible.value = false
      } catch (err) {
        toast.add({ severity: 'error', summary: 'Silinemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
      }
    },
  })
}
</script>

<template>
  <Dialog v-model:visible="visible" modal :header="props.item ? 'İçeriği düzenle' : 'Yeni içerik fikri'" class="content-dialog" :style="{ width: '62rem' }">
    <div class="form-grid">
      <div class="form-field span-2">
        <label for="ci-title">Başlık / fikir *</label>
        <InputText id="ci-title" v-model="form.title" fluid :invalid="submitted && !form.title.trim()" placeholder="ör. Kalori saymadan dengeli beslenme rehberi" />
        <small v-if="submitted && !form.title.trim()" class="field-error">Başlık gerekli.</small>
      </div>
      <div class="form-field"><label>Kanal</label><Select v-model="form.channel" :options="CHANNELS" option-label="label" option-value="value" fluid /></div>
      <div class="form-field"><label>Durum</label><Select v-model="form.status" :options="STATUSES" option-label="label" option-value="value" fluid /></div>
      <div class="form-field"><label>Planlanan tarih</label><DatePicker v-model="form.plannedDate" date-format="dd.mm.yy" show-icon icon-display="input" fluid /></div>
      <div v-if="form.channel === 'blog'" class="form-field">
        <label for="ci-slug">Slug</label>
        <InputText id="ci-slug" v-model="form.slug" fluid class="mono" :placeholder="slugify(form.title) || 'otomatik'" />
      </div>
      <div v-if="form.status === 'yayinda' || form.publishedUrl" class="form-field span-2">
        <label for="ci-url">Yayın URL'i</label>
        <InputText id="ci-url" v-model="form.publishedUrl" fluid placeholder="https://…" />
      </div>

      <p class="brief-caption span-2">BRIEF <span>— prompt bu alanlardan üretilir; boş kalanları Claude önerir</span></p>
      <div class="form-field"><label>Hedef kitle</label><Textarea v-model="form.audience" rows="2" fluid auto-resize /></div>
      <div class="form-field"><label>Açı / tez</label><Textarea v-model="form.angle" rows="2" fluid auto-resize /></div>
      <div class="form-field"><label>Ton notu</label><InputText v-model="form.tone" fluid placeholder="ör. sıcak, yargısız, sohbet gibi" /></div>
      <div class="form-field"><label>Anahtar kelimeler <small class="label-hint">virgülle ayır</small></label><InputText v-model="form.keywordsText" fluid /></div>
      <div class="form-field span-2"><label>Outline <small class="label-hint">her satır bir madde</small></label><Textarea v-model="form.outlineText" rows="4" fluid auto-resize /></div>
      <div class="form-field"><label>İç bağlantılar <small class="label-hint">afiet.co yolları, satır satır</small></label><Textarea v-model="form.internalLinksText" rows="2" fluid auto-resize class="mono" /></div>
      <div class="form-field"><label>Kaynaklar <small class="label-hint">URL, satır satır</small></label><Textarea v-model="form.sourcesText" rows="2" fluid auto-resize class="mono" /></div>
      <div class="form-field"><label>CTA</label><InputText v-model="form.cta" fluid /></div>
      <div class="form-field"><label>Notlar</label><Textarea v-model="form.notes" rows="2" fluid auto-resize /></div>
    </div>

    <div class="prompt-zone">
      <div class="prompt-zone-head">
        <p class="preview-label">PROMPT</p>
        <SelectButton v-model="promptKind" :options="promptOptions" option-label="label" option-value="value" :allow-empty="false" size="small" />
        <div class="prompt-zone-actions">
          <Button label="İçe aktar" icon="pi pi-file-import" size="small" severity="secondary" outlined @click="importOpen = !importOpen" />
          <Button :label="promptKind === 'plan' ? 'Planlama promptunu kopyala' : 'Üretim promptunu kopyala'" icon="pi pi-copy" size="small" @click="copyPrompt" />
        </div>
      </div>
      <div v-if="importOpen" class="import-zone">
        <Textarea v-model="importText" rows="5" fluid class="mono" placeholder='Claude çıktısındaki ```json bloğunu (ya da tamamını) buraya yapıştır…' />
        <div class="import-actions">
          <Button label="Uygula" icon="pi pi-check" size="small" @click="applyImport" />
          <small>json'daki başlık, slug, tarih ve brief alanları forma yazılır.</small>
        </div>
      </div>
      <p class="prompt-hint"><i class="pi pi-info-circle" /> {{ promptHint }}</p>
      <pre class="code-preview prompt-pre">{{ promptText }}</pre>
    </div>

    <template #footer>
      <Button v-if="props.item" label="Sil" icon="pi pi-trash" severity="danger" text class="footer-left" @click="remove" />
      <Button label="Vazgeç" severity="secondary" text @click="visible = false" />
      <Button :label="props.item ? 'Değişiklikleri kaydet' : 'Plana ekle'" icon="pi pi-check" :loading="saving" @click="save" />
    </template>
  </Dialog>
</template>
