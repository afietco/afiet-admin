<script setup lang="ts">
import { onUnmounted, reactive, ref, watch } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import ProgressBar from 'primevue/progressbar'
import EmptyState from '../../components/EmptyState.vue'
import {
  ACCEPT_ATTR, ATTACHMENT_MAX_BYTES, ATTACHMENT_MAX_PER_ITEM,
  type ContentAttachment, type ContentItem,
} from '../../services/content'
import { ATTACHMENT_ICON, humanSize, useContentStore } from './shared'

/**
 * Ekler sekmesi: dosya sunucudan GEÇMEZ, imzalı URL ile doğrudan kovaya gider
 * (gs://afiet-icerik, gizli). İndirme de 15 dakikalık imzalı URL'dir, yani
 * panelde görünen bağlantılar kalıcı değildir - bu bilinçli.
 */
const props = defineProps<{ item: ContentItem | null; attachments: ContentAttachment[] }>()

const toast = useToast()
const confirm = useConfirm()
const { payload, uploadAttachment, removeAttachment, openAttachment, previewUrl } = useContentStore()

const fileInput = ref<HTMLInputElement | null>(null)
const dragActive = ref(false)
/** Yükleme ilerlemesi: dosya adı → yüzde. */
const progress = reactive<Record<string, number>>({})
/** Görsel önizlemeleri: ek id → imzalı URL (diyalog kapanınca düşer). */
const previews = reactive<Record<number, string>>({})

const full = () => props.attachments.length >= ATTACHMENT_MAX_PER_ITEM

/** Görseller için önizleme URL'i çek (yalnız hazır olanlar, bir kez). */
async function ensurePreviews() {
  for (const a of props.attachments) {
    if (a.kind !== 'gorsel' || a.status !== 'hazir' || previews[a.id]) continue
    try {
      previews[a.id] = await previewUrl(a.id)
    } catch {
      /* önizleme kritik değil, sessizce geç */
    }
  }
}
watch(() => props.attachments.map((a) => `${a.id}:${a.status}`).join(','), ensurePreviews, { immediate: true })
onUnmounted(() => Object.keys(previews).forEach((k) => delete previews[Number(k)]))

async function handleFiles(files: FileList | null) {
  const item = props.item
  if (!item || !files?.length) return
  for (const file of Array.from(files)) {
    if (full()) {
      toast.add({ severity: 'warn', summary: 'Ek sınırı doldu', detail: `Etkinlik başına en fazla ${ATTACHMENT_MAX_PER_ITEM} ek.`, life: 4000 })
      break
    }
    if (file.size > ATTACHMENT_MAX_BYTES) {
      toast.add({ severity: 'warn', summary: `"${file.name}" çok büyük`, detail: `Sınır ${humanSize(ATTACHMENT_MAX_BYTES)}.`, life: 4500 })
      continue
    }
    progress[file.name] = 0
    try {
      await uploadAttachment(item.id, file, (p) => { progress[file.name] = p })
      toast.add({ severity: 'success', summary: `${file.name} yüklendi`, life: 2500 })
    } catch (err) {
      toast.add({ severity: 'error', summary: 'Yüklenemedi', detail: err instanceof Error ? err.message : '', life: 5000 })
    } finally {
      delete progress[file.name]
    }
  }
  if (fileInput.value) fileInput.value.value = ''
}

function onDrop(e: DragEvent) {
  dragActive.value = false
  handleFiles(e.dataTransfer?.files ?? null)
}

async function download(a: ContentAttachment) {
  try {
    await openAttachment(a.id, 'indir')
  } catch (err) {
    toast.add({ severity: 'error', summary: 'İndirilemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
  }
}

async function open(a: ContentAttachment) {
  try {
    await openAttachment(a.id, 'onizleme')
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Açılamadı', detail: err instanceof Error ? err.message : '', life: 4000 })
  }
}

function remove(a: ContentAttachment) {
  confirm.require({
    header: 'Eki sil',
    message: `"${a.fileName}" hem panelden hem kovadan silinsin mi?`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Vazgeç',
    acceptLabel: 'Sil',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await removeAttachment(a.id)
        toast.add({ severity: 'success', summary: 'Ek silindi', life: 2000 })
      } catch (err) {
        toast.add({ severity: 'error', summary: 'Silinemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
      }
    },
  })
}
</script>

<template>
  <div class="attach-panel">
    <p v-if="!props.item" class="attach-note">
      <i class="pi pi-info-circle" /> Ek eklemek için etkinliği önce kaydet - dosyalar kayda bağlanır.
    </p>
    <p v-else-if="!payload.storageReady" class="attach-note is-warn">
      <i class="pi pi-exclamation-triangle" /> Ek deposu bağlı değil: web tarafında GCS anahtarı (NUXT_GCS_SA_KEY) tanımlı değil.
      Takvimin geri kalanı çalışır, yalnız yükleme kapalı.
    </p>

    <div
      v-else
      class="drop-zone"
      :class="{ 'is-active': dragActive, 'is-full': full() }"
      @dragover.prevent="dragActive = true"
      @dragleave.prevent="dragActive = false"
      @drop.prevent="onDrop"
    >
      <i class="pi pi-cloud-upload" />
      <p>
        Dosyaları buraya bırak ya da
        <button type="button" class="link-btn" :disabled="full()" @click="fileInput?.click()">bilgisayardan seç</button>
      </p>
      <small>mp4, mov, png, jpg, webp, gif, pdf · dosya başına en fazla {{ humanSize(ATTACHMENT_MAX_BYTES) }} · {{ props.attachments.length }}/{{ ATTACHMENT_MAX_PER_ITEM }} ek</small>
      <input ref="fileInput" type="file" multiple :accept="ACCEPT_ATTR" hidden @change="handleFiles(($event.target as HTMLInputElement).files)" />
    </div>

    <div v-for="(percent, name) in progress" :key="name" class="upload-row">
      <span class="upload-name">{{ name }}</span>
      <ProgressBar :value="percent" :show-value="false" class="upload-bar" />
      <span class="upload-pct">{{ percent }}%</span>
    </div>

    <ul v-if="props.attachments.length" class="attach-list">
      <li v-for="a in props.attachments" :key="a.id" class="attach-item">
        <img v-if="previews[a.id]" :src="previews[a.id]" :alt="a.fileName" class="attach-thumb" />
        <span v-else class="attach-glyph"><i :class="ATTACHMENT_ICON[a.kind]" /></span>
        <div class="attach-meta">
          <strong>{{ a.fileName }}</strong>
          <small>
            {{ humanSize(a.sizeBytes) }} · {{ a.mime }}
            <template v-if="a.status === 'bekliyor'"> · <em>yükleme tamamlanmadı</em></template>
          </small>
        </div>
        <div class="attach-actions">
          <Button icon="pi pi-external-link" text rounded size="small" aria-label="Aç" :disabled="a.status !== 'hazir'" @click="open(a)" />
          <Button icon="pi pi-download" text rounded size="small" aria-label="İndir" :disabled="a.status !== 'hazir'" @click="download(a)" />
          <Button icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Sil" @click="remove(a)" />
        </div>
      </li>
    </ul>
    <EmptyState
      v-else-if="props.item && payload.storageReady"
      icon="pi pi-paperclip"
      title="Henüz ek yok"
      description="Reel mp4'ü, carousel görselleri ya da brief PDF'i buraya yüklenir; yayın günü buradan indirirsin."
    />
  </div>
</template>
