<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Textarea from 'primevue/textarea'
import {
  FORMATS_BY_CHANNEL, slugify,
  type Channel, type ContentFormat, type ContentItemInput, type ContentStatus,
} from '../../services/content'
import AttachmentsPanel from './AttachmentsPanel.vue'
import { buildPlanningPrompt, buildProductionPrompt, parsePlanImport, suggestedPromptKind } from './prompt'
import { hhmm, instantFor, instantToKey, keyFromLocalDate, localDateFromKey, minutesOf } from './calendar'
import {
  CHANNELS, FORMATS, HASHTAG_SOFT_LIMIT, STATUSES, copyText, formatMeta, useContentStore, useEditor,
} from './shared'

/**
 * Etkinlik düzenleyici - tek diyalog, dört sekme:
 *   Özet (platform/biçim/zaman/durum/seri) · Metin (caption, hashtag, ilk
 *   yorum, kanca, alt metin) · Ekler (imzalı yükleme) · Brief & prompt (blog
 *   odaklı alanlar + Claude promptu).
 * Kanala göre ilgisiz sekme gizlenir (blogda Metin, sosyalde Brief kısalır).
 */

const editor = useEditor()
const visible = computed({
  get: () => editor.open,
  set: (value: boolean) => { editor.open = value },
})

const toast = useToast()
const confirm = useConfirm()
const { payload, upsertItem, removeItem } = useContentStore()

const saving = ref(false)
const submitted = ref(false)
const activeTab = ref('ozet')
const promptKind = ref<'plan' | 'uretim'>('plan')
const importOpen = ref(false)
const importText = ref('')

const form = reactive({
  title: '',
  channel: 'instagram' as Channel,
  format: 'reel' as ContentFormat,
  status: 'fikir' as ContentStatus,
  slug: '',
  day: null as Date | null,
  time: null as Date | null,
  allDay: false,
  publishedUrl: '',
  platformPostId: '',
  // metin
  caption: '',
  hashtagsText: '',
  firstComment: '',
  hook: '',
  series: '',
  seriesCode: '',
  altText: '',
  captionsReady: false,
  musicTitle: '',
  musicArtist: '',
  musicLicense: '',
  musicUrl: '',
  // brief
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

/** Saat seçicisi için: yalnız saat/dakika taşıyan yardımcı Date. */
function timeDate(minutes: number): Date {
  const d = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60)
  return d
}

function initForm() {
  const it = editor.item
  const defaults = editor.defaults
  const channel = it?.channel ?? defaults.channel ?? 'instagram'
  form.channel = channel
  form.format = it?.format ?? FORMATS_BY_CHANNEL[channel][0]!
  form.title = it?.title ?? ''
  form.status = it?.status ?? 'fikir'
  form.slug = it?.slug ?? ''
  form.allDay = it ? it.allDay : (defaults.allDay ?? false)

  const iso = it?.plannedAt ?? defaults.plannedAt ?? null
  form.day = iso ? localDateFromKey(instantToKey(iso)) : null
  form.time = iso && !(it ? it.allDay : defaults.allDay) ? timeDate(minutesOf(iso)) : timeDate(12 * 60 + 30)

  form.publishedUrl = it?.publishedUrl ?? ''
  form.platformPostId = it?.platformPostId ?? ''
  form.caption = it?.caption ?? ''
  form.hashtagsText = it?.hashtags.join(' ') ?? ''
  form.firstComment = it?.firstComment ?? ''
  form.hook = it?.hook ?? ''
  form.series = it?.series ?? ''
  form.seriesCode = it?.seriesCode ?? ''
  form.altText = it?.altText ?? ''
  form.captionsReady = it?.captionsReady ?? false
  form.musicTitle = it?.music.title ?? ''
  form.musicArtist = it?.music.artist ?? ''
  form.musicLicense = it?.music.license ?? ''
  form.musicUrl = it?.music.url ?? ''

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
  activeTab.value = 'ozet'
  promptKind.value = suggestedPromptKind(form.status)
}
watch(visible, (open) => { if (open) initForm() })

/** Platform değişince biçim listesi daralır; geçersiz kalan biçim ilkine düşer. */
watch(() => form.channel, (channel) => {
  const allowed = FORMATS_BY_CHANNEL[channel]
  if (!allowed.includes(form.format)) form.format = allowed[0]!
  if (channel !== 'blog') form.slug = ''
})

const formatOptions = computed(() =>
  FORMATS.filter((f) => FORMATS_BY_CHANNEL[form.channel].includes(f.value)),
)
const isBlog = computed(() => form.channel === 'blog')
const isVideo = computed(() => ['reel', 'shorts', 'video'].includes(form.format))

const hashtagList = computed(() =>
  form.hashtagsText.split(/[\s,]+/).map((t) => t.replace(/^#+/, '')).filter(Boolean).map((t) => `#${t}`),
)
const captionLength = computed(() => form.caption.length)
const attachments = computed(() =>
  editor.item ? payload.value.attachments.filter((a) => a.itemId === editor.item!.id) : [],
)

const splitList = (text: string, sep: RegExp) => text.split(sep).map((s) => s.trim()).filter(Boolean)

function plannedIso(): string | null {
  if (!form.day) return null
  const key = keyFromLocalDate(form.day)
  if (form.allDay) return instantFor(key, 0)
  const t = form.time
  const minutes = t ? t.getHours() * 60 + t.getMinutes() : 0
  return instantFor(key, minutes)
}

function toInput(): ContentItemInput {
  return {
    id: editor.item?.id,
    channel: form.channel,
    format: form.format,
    title: form.title.trim(),
    status: form.status,
    slug: isBlog.value && form.slug.trim() ? slugify(form.slug) : null,
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
    plannedAt: plannedIso(),
    allDay: form.allDay,
    publishedUrl: form.publishedUrl.trim() || null,
    caption: form.caption.trim(),
    hashtags: hashtagList.value,
    firstComment: form.firstComment.trim(),
    hook: form.hook.trim(),
    series: form.series.trim(),
    seriesCode: form.seriesCode.trim(),
    altText: form.altText.trim(),
    captionsReady: form.captionsReady,
    music: {
      title: form.musicTitle.trim(),
      artist: form.musicArtist.trim(),
      license: form.musicLicense.trim(),
      url: form.musicUrl.trim(),
    },
    platformPostId: form.platformPostId.trim() || null,
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
    : isBlog.value
      ? 'afiet-web reposunda Claude Code\'a yapıştır - yazıyı yazar ve yayınlar.'
      : 'Claude\'a yapıştır - yayına hazır metni üretir; paylaşımı sen yaparsın.',
)

async function copyPrompt() {
  if (!form.title.trim()) {
    submitted.value = true
    activeTab.value = 'ozet'
    toast.add({ severity: 'warn', summary: 'Önce başlık gerekli', detail: 'Prompt, başlıktaki fikirden üretilir.', life: 3000 })
    return
  }
  const ok = await copyText(promptText.value)
  if (ok) toast.add({ severity: 'success', summary: 'Prompt kopyalandı', detail: promptHint.value, life: 3500 })
  else toast.add({ severity: 'error', summary: 'Kopyalanamadı', detail: 'Metni önizlemeden seçip kopyala.', life: 4000 })
}

async function copyCaption() {
  const parts = [form.caption.trim(), hashtagList.value.join(' ')].filter(Boolean)
  if (!parts.length) {
    toast.add({ severity: 'warn', summary: 'Kopyalanacak metin yok', life: 2500 })
    return
  }
  const ok = await copyText(parts.join('\n\n'))
  toast.add(
    ok
      ? { severity: 'success', summary: 'Caption + etiketler kopyalandı', life: 2500 }
      : { severity: 'error', summary: 'Kopyalanamadı', life: 3000 },
  )
}

function applyImport() {
  try {
    const plan = parsePlanImport(importText.value)
    if (plan.title) form.title = plan.title
    if (plan.slug && isBlog.value) form.slug = slugify(plan.slug)
    if (plan.plannedDate) form.day = localDateFromKey(plan.plannedDate)
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
  if (!form.title.trim()) {
    activeTab.value = 'ozet'
    return
  }
  saving.value = true
  try {
    const saved = await upsertItem(toInput())
    // Yeni kayıtta ekler ancak id oluştuktan sonra yüklenebilir: diyalog açık
    // kalır ve düzenleme moduna geçer.
    const wasNew = !editor.item
    editor.item = saved
    toast.add({
      severity: 'success',
      summary: wasNew ? 'Etkinlik eklendi' : 'Etkinlik güncellendi',
      detail: wasNew ? 'Artık ek yükleyebilirsin.' : undefined,
      life: 2500,
    })
    if (!wasNew) visible.value = false
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Kaydedilemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
  } finally {
    saving.value = false
  }
}

function remove() {
  const it = editor.item
  if (!it) return
  confirm.require({
    header: 'Etkinliği sil',
    message: `"${it.title}" takvimden kalıcı olarak silinsin mi? Ölçümleri ve ekleri (dosyalar dahil) de silinir.`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Vazgeç',
    acceptLabel: 'Sil',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await removeItem(it.id)
        toast.add({ severity: 'success', summary: 'Etkinlik silindi', life: 2500 })
        visible.value = false
      } catch (err) {
        toast.add({ severity: 'error', summary: 'Silinemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
      }
    },
  })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="editor.item ? 'Etkinliği düzenle' : 'Yeni etkinlik'"
    class="content-dialog"
    :style="{ width: '62rem' }"
  >
    <Tabs v-model:value="activeTab" class="seo-tabs dialog-tabs">
      <TabList>
        <Tab value="ozet">Özet</Tab>
        <Tab value="metin">Metin</Tab>
        <Tab value="ekler">Ekler<span v-if="attachments.length" class="board-count">{{ attachments.length }}</span></Tab>
        <Tab value="brief">Brief &amp; prompt</Tab>
      </TabList>

      <TabPanels>
        <!-- ── ÖZET ──────────────────────────────────────────────────── -->
        <TabPanel value="ozet">
          <div class="form-grid">
            <div class="form-field span-4">
              <label for="ev-title">Başlık *</label>
              <InputText id="ev-title" v-model="form.title" fluid :invalid="submitted && !form.title.trim()" placeholder="ör. Mit Kırıcı M7 - her gün mükemmel beslenmelisin" />
              <small v-if="submitted && !form.title.trim()" class="field-error">Başlık gerekli.</small>
            </div>

            <div class="form-field">
              <label>Platform</label>
              <Select v-model="form.channel" :options="CHANNELS" option-label="label" option-value="value" fluid>
                <template #option="{ option }"><i :class="option.icon" /> {{ option.label }}</template>
              </Select>
            </div>
            <div class="form-field">
              <label>Biçim</label>
              <Select v-model="form.format" :options="formatOptions" option-label="label" option-value="value" fluid>
                <template #option="{ option }"><i :class="option.icon" /> {{ option.label }}</template>
              </Select>
            </div>

            <div class="form-field">
              <label>Tarih <small class="label-hint">boş = Plan kutusunda bekler</small></label>
              <DatePicker v-model="form.day" date-format="dd.mm.yy" show-icon icon-display="input" show-button-bar fluid />
            </div>
            <div class="form-field">
              <label>Saat <small class="label-hint">İstanbul</small></label>
              <DatePicker v-model="form.time" time-only fluid :disabled="form.allDay" />
              <div class="field-check">
                <Checkbox v-model="form.allDay" input-id="ev-allday" binary />
                <label for="ev-allday">Tüm gün (saat belirsiz)</label>
              </div>
            </div>

            <div class="form-field">
              <label>Durum</label>
              <Select v-model="form.status" :options="STATUSES" option-label="label" option-value="value" fluid />
            </div>
            <div class="form-field">
              <label>Seri <small class="label-hint">ör. Mit Kırıcı</small></label>
              <InputText v-model="form.series" fluid />
            </div>
            <div class="form-field">
              <label>Bölüm kodu <small class="label-hint">ör. M7, S3</small></label>
              <InputText v-model="form.seriesCode" fluid class="mono" />
            </div>
            <div v-if="isBlog" class="form-field">
              <label for="ev-slug">Slug</label>
              <InputText id="ev-slug" v-model="form.slug" fluid class="mono" :placeholder="slugify(form.title) || 'otomatik'" />
            </div>

            <div v-if="form.status === 'yayinda' || form.publishedUrl" class="form-field span-2">
              <label for="ev-url">Yayın URL'i</label>
              <InputText id="ev-url" v-model="form.publishedUrl" fluid placeholder="https://…" />
            </div>
            <div v-if="form.status === 'yayinda'" class="form-field span-2">
              <label>Platform gönderi kimliği <small class="label-hint">otomatik ölçüm eşleşmesi için (Faz 2)</small></label>
              <InputText v-model="form.platformPostId" fluid class="mono" placeholder="ör. 17912345678901234" />
            </div>
          </div>
        </TabPanel>

        <!-- ── METİN ─────────────────────────────────────────────────── -->
        <TabPanel value="metin">
          <div class="form-grid">
            <div class="form-field span-2">
              <label for="ev-hook">Kanca <small class="label-hint">ilk 3 saniye / ilk satır</small></label>
              <InputText id="ev-hook" v-model="form.hook" fluid placeholder="ör. Dört el, iki tabak" />
            </div>
            <div class="form-field span-4">
              <label for="ev-caption">
                Caption
                <small class="label-hint">{{ captionLength }}/2200</small>
              </label>
              <Textarea id="ev-caption" v-model="form.caption" rows="6" fluid auto-resize />
            </div>
            <div class="form-field span-4">
              <label for="ev-tags">Hashtag'ler <small class="label-hint">boşlukla ayır, '#' şart değil</small></label>
              <InputText id="ev-tags" v-model="form.hashtagsText" fluid placeholder="afiet saymadengele dengelibeslenme" />
              <small v-if="hashtagList.length" class="tag-preview">
                {{ hashtagList.join(' ') }}
              </small>
              <small v-if="hashtagList.length > HASHTAG_SOFT_LIMIT" class="field-warn">
                Marka kuralı en fazla {{ HASHTAG_SOFT_LIMIT }} etiket; şu an {{ hashtagList.length }} tane var.
              </small>
            </div>
            <div class="form-field span-4">
              <label for="ev-first">İlk yorum <small class="label-hint">yayından sonra ilk yorum olarak eklenir</small></label>
              <Textarea id="ev-first" v-model="form.firstComment" rows="2" fluid auto-resize />
            </div>
            <div class="form-field span-2">
              <label for="ev-alt">Alt metin <small class="label-hint">erişilebilirlik</small></label>
              <Textarea id="ev-alt" v-model="form.altText" rows="2" fluid auto-resize />
              <div class="field-check">
                <Checkbox v-model="form.captionsReady" input-id="ev-cap" binary />
                <label for="ev-cap">Altyazı hazır</label>
              </div>
            </div>

            <template v-if="isVideo">
              <p class="brief-caption span-4">SES / MÜZİK <span>- yayın öncesi lisans kontrolü</span></p>
              <div class="form-field"><label>Parça</label><InputText v-model="form.musicTitle" fluid placeholder="ör. honey" /></div>
              <div class="form-field"><label>Sanatçı</label><InputText v-model="form.musicArtist" fluid placeholder="ör. massobeats" /></div>
              <div class="form-field"><label>Lisans notu</label><InputText v-model="form.musicLicense" fluid placeholder="ör. serbest, künye şart" /></div>
              <div class="form-field"><label>Kaynak bağlantısı</label><InputText v-model="form.musicUrl" fluid class="mono" placeholder="https://…" /></div>
            </template>

            <div class="span-4 metin-actions">
              <Button label="Caption + etiketleri kopyala" icon="pi pi-copy" size="small" severity="secondary" outlined @click="copyCaption" />
            </div>
          </div>
        </TabPanel>

        <!-- ── EKLER ─────────────────────────────────────────────────── -->
        <TabPanel value="ekler">
          <AttachmentsPanel :item="editor.item" :attachments="attachments" />
        </TabPanel>

        <!-- ── BRIEF & PROMPT ────────────────────────────────────────── -->
        <TabPanel value="brief">
          <div class="form-grid">
            <p class="brief-caption span-4">BRIEF <span>- prompt bu alanlardan üretilir; boş kalanları Claude önerir</span></p>
            <div class="form-field"><label>Hedef kitle</label><Textarea v-model="form.audience" rows="2" fluid auto-resize /></div>
            <div class="form-field"><label>Açı / tez</label><Textarea v-model="form.angle" rows="2" fluid auto-resize /></div>
            <div class="form-field"><label>Ton notu</label><InputText v-model="form.tone" fluid placeholder="ör. sıcak, yargısız, sohbet gibi" /></div>
            <div class="form-field"><label>Anahtar kelimeler <small class="label-hint">virgülle ayır</small></label><InputText v-model="form.keywordsText" fluid /></div>
            <div class="form-field span-4"><label>Outline <small class="label-hint">her satır bir madde</small></label><Textarea v-model="form.outlineText" rows="4" fluid auto-resize /></div>
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
              <Textarea v-model="importText" rows="5" fluid class="mono" placeholder="Claude çıktısındaki json bloğunu buraya yapıştır…" />
              <div class="import-actions">
                <Button label="Uygula" icon="pi pi-check" size="small" @click="applyImport" />
                <small>json'daki başlık, slug, tarih ve brief alanları forma yazılır.</small>
              </div>
            </div>
            <p class="prompt-hint"><i class="pi pi-info-circle" /> {{ promptHint }}</p>
            <pre class="code-preview prompt-pre">{{ promptText }}</pre>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <template #footer>
      <Button v-if="editor.item" label="Sil" icon="pi pi-trash" severity="danger" text class="footer-left" @click="remove" />
      <span v-if="form.day" class="footer-when">
        <i class="pi pi-calendar" />
        {{ form.day.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' }) }}
        <template v-if="!form.allDay && form.time"> · {{ hhmm(form.time.getHours() * 60 + form.time.getMinutes()) }}</template>
        <template v-else> · tüm gün</template>
        · {{ formatMeta(form.format).label }}
      </span>
      <Button label="Kapat" severity="secondary" text @click="visible = false" />
      <Button :label="editor.item ? 'Değişiklikleri kaydet' : 'Takvime ekle'" icon="pi pi-check" :loading="saving" @click="save" />
    </template>
  </Dialog>
</template>
