<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import { usersApi, type PageRevision, type PageSection, type UserPage } from '../../services/users'
import { ago, dateTime } from './shared'

/**
 * Kişi sayfası: damıtıcının bu kişi hakkında yazdıkları.
 *
 * Sayfa üç günde bir yeniden yazılıyor ve o güne kadar öğrenilen her şey
 * asistanlara delta katmanı olarak zaten gidiyor. Yani buradaki asıl soru
 * "sayfa ne diyor" değil, "sayfa güncel mi": iyi okunan ama üç hafta önce
 * yazılmış, arkasında kırk not birikmiş bir sayfa, sayfanın metnine bakarak
 * görülemeyen tek arıza. Durum şeridi bu yüzden metinden ÖNCE geliyor.
 *
 * Bölümlerin hiçbiri buradan düzenlenmiyor, ekip notu hariç. Damıtıcının
 * yazdığını elle düzeltebilseydik "sistem bu kişi hakkında ne anladı"
 * sorusu cevaplanamaz hale gelirdi: hangi cümleye sistemin vardığını,
 * hangisini birinin yazdığını bir daha ayıramazdık.
 */

const props = defineProps<{ userId: string }>()

const TITLES: Record<string, string> = {
  kimlik_hedef: 'Kimlik ve hedef',
  sofra: 'Sofra',
  ritim: 'Ritim',
  vucut: 'Vücut',
  dunya: 'Dünyası',
  acik_konular: 'Açık konular',
  ekip_notu: 'Ekip notu',
}

const EDITORS: Record<string, { label: string; severity: 'info' | 'success' | 'secondary' }> = {
  agent: { label: 'damıtıcı', severity: 'info' },
  staff: { label: 'ekip', severity: 'success' },
  system: { label: 'tohumlama', severity: 'secondary' },
}

const TEAM_NOTE_MAX = 700

const page = ref<UserPage | null>(null)
const loading = ref(true)
const error = ref('')

/** Bölümler sunucunun okuma sırasında; arşiv olanlar en sonda, ayrı. */
const sections = computed(() => {
  const data = page.value
  if (!data) return []
  const byKey = new Map(data.sections.map((s) => [s.sectionKey, s]))
  return data.order.map((key) => byKey.get(key)).filter((s): s is PageSection => Boolean(s))
})

const archived = computed(() =>
  (page.value?.sections ?? []).filter((s) => s.sectionKey.startsWith('archive.')),
)

const status = computed(() => page.value?.status ?? null)
const hasPage = computed(() => sections.value.length > 0)

const teamNoteSection = computed(() =>
  sections.value.find((s) => s.sectionKey === 'ekip_notu'),
)
const teamNote = computed(() => teamNoteSection.value?.contentMd ?? '')

const title = (key: string) =>
  TITLES[key.replace('archive.', '')] ?? key

const editor = (type: string) => EDITORS[type] ?? { label: type, severity: 'secondary' as const }

async function load() {
  loading.value = true
  error.value = ''
  try {
    page.value = await usersApi.page(props.userId)
  } catch {
    error.value = 'Kişi sayfası okunamadı.'
  } finally {
    loading.value = false
  }
}

// ── Ekip notu ────────────────────────────────────────────────────────────────

const noteOpen = ref(false)
const noteDraft = ref('')
const noteSaving = ref(false)
const noteError = ref('')

const noteRemaining = computed(() => TEAM_NOTE_MAX - [...noteDraft.value.trim()].length)

function openNote() {
  noteDraft.value = teamNote.value
  noteError.value = ''
  noteOpen.value = true
}

async function saveNote() {
  noteSaving.value = true
  noteError.value = ''
  try {
    const result = await usersApi.writeTeamNote(props.userId, noteDraft.value)
    if (page.value) page.value.sections = result.sections
    noteOpen.value = false
  } catch {
    noteError.value = 'Not kaydedilemedi.'
  } finally {
    noteSaving.value = false
  }
}

// ── Geçmiş ───────────────────────────────────────────────────────────────────

const historyKey = ref('')
const historyItems = ref<PageRevision[]>([])
const historyLoading = ref(false)

async function openHistory(sectionKey: string) {
  historyKey.value = sectionKey
  historyItems.value = []
  historyLoading.value = true
  try {
    const result = await usersApi.pageRevisions(props.userId, sectionKey)
    historyItems.value = result.items ?? []
  } catch {
    historyItems.value = []
  } finally {
    historyLoading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page-tab">
    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

    <template v-else-if="!loading">
      <!-- Durum metinden önce: sayfanın güncel olup olmadığı, ne dediğinden
           önce gelen soru. -->
      <section v-if="status" class="status">
        <div class="status__item">
          <small>Sıradaki damıtma</small>
          <strong>{{ status.dueAt ? dateTime(status.dueAt) : 'kuyrukta değil' }}</strong>
        </div>
        <div class="status__item">
          <small>Son koşu</small>
          <strong>{{ ago(status.lastRunAt) }}</strong>
        </div>
        <div class="status__item" :class="{ 'status__item--warn': status.pendingCandidates > 0 }">
          <small>Sayfaya işlenmemiş not</small>
          <strong>{{ status.pendingCandidates }}</strong>
        </div>
        <div class="status__item" :class="{ 'status__item--warn': status.attempts > 0 }">
          <small>Başarısız deneme</small>
          <strong>{{ status.attempts }}</strong>
        </div>
      </section>

      <Message v-if="status && status.attempts > 0" severity="warn" :closable="false">
        Damıtıcı bu kişide {{ status.attempts }} kez düştü ve geri çekiliyor. Sayfa, en son
        başarılı koşunun bıraktığı hâlde.
      </Message>

      <Message v-if="!hasPage" severity="secondary" :closable="false">
        Bu kişi hiç damıtılmamış: sayfa henüz boş. Bekleyen notlar asistanlara yine de
        gidiyor, sayfa ilk koşuda yazılacak.
      </Message>

      <article v-for="section in sections" :key="section.sectionKey" class="sec">
        <header>
          <h3>{{ title(section.sectionKey) }}</h3>
          <div class="sec__meta">
            <Tag :severity="editor(section.updatedBy).severity" :value="editor(section.updatedBy).label" />
            <span>r{{ section.revision }} · {{ ago(section.updatedAt) }}</span>
            <Button
              label="geçmiş"
              text
              size="small"
              @click="openHistory(section.sectionKey)"
            />
            <Button
              v-if="section.sectionKey === 'ekip_notu'"
              label="düzenle"
              text
              size="small"
              @click="openNote"
            />
          </div>
        </header>
        <p class="sec__body">{{ section.contentMd }}</p>
      </article>

      <!-- Bölüm hiç yazılmamışsa yukarıdaki döngüde yok. Yazmanın yolu her
           hâlükârda erişilebilir kalmalı: kilitleyen bir durumu temizleyecek
           eylemin hep ulaşılabilir olması kuralının bu ekrandaki karşılığı. -->
      <div v-if="!teamNoteSection" class="sec sec--empty">
        <div>
          <h3>Ekip notu</h3>
          <p>Sayfanın insan yazabildiği tek bölümü. Henüz boş.</p>
        </div>
        <Button label="Not yaz" outlined size="small" @click="openNote" />
      </div>

      <details v-if="archived.length" class="archive">
        <summary>Arşiv ({{ archived.length }} bölüm)</summary>
        <p class="archive__note">
          Bir bölüm bütçesini aştığında eskisi buraya taşınıyor. Arşiv hiçbir asistanın
          bağlamına girmez; silinmediğinin görülebildiği tek yer burası.
        </p>
        <article v-for="section in archived" :key="section.sectionKey" class="sec sec--archive">
          <header>
            <h3>{{ title(section.sectionKey) }}</h3>
            <div class="sec__meta"><span>r{{ section.revision }} · {{ ago(section.updatedAt) }}</span></div>
          </header>
          <p class="sec__body">{{ section.contentMd }}</p>
        </article>
      </details>
    </template>

    <Dialog v-model:visible="noteOpen" modal header="Ekip notu" :style="{ width: '34rem' }">
      <p class="dialog-hint">
        Bu not, kişinin sayfasında asistanların okuduğu bir bölüm olarak duruyor.
        Damıtıcı buraya yazamaz, buradan da diğer bölümlere yazılamaz.
      </p>
      <Textarea v-model="noteDraft" rows="7" auto-resize class="w-full" />
      <p class="dialog-count" :class="{ 'dialog-count--over': noteRemaining < 0 }">
        {{ noteRemaining }} karakter kaldı
      </p>
      <Message v-if="noteError" severity="error" :closable="false">{{ noteError }}</Message>
      <template #footer>
        <Button label="Vazgeç" text @click="noteOpen = false" />
        <Button
          label="Kaydet"
          :loading="noteSaving"
          :disabled="noteRemaining < 0"
          @click="saveNote"
        />
      </template>
    </Dialog>

    <Dialog
      :visible="historyKey !== ''"
      modal
      :header="`${title(historyKey)} geçmişi`"
      :style="{ width: '40rem' }"
      @update:visible="historyKey = ''"
    >
      <p v-if="historyLoading" class="dialog-hint">Yükleniyor…</p>
      <p v-else-if="historyItems.length === 0" class="dialog-hint">Bu bölümün geçmişi yok.</p>
      <ol v-else class="history">
        <li v-for="item in historyItems" :key="item.revision">
          <div class="history__meta">
            <Tag :severity="editor(item.editorType).severity" :value="editor(item.editorType).label" />
            <span>r{{ item.revision }} · {{ dateTime(item.createdAt) }}</span>
            <code v-if="item.editorRef">{{ item.editorRef }}</code>
          </div>
          <p>{{ item.contentMd }}</p>
        </li>
      </ol>
    </Dialog>
  </div>
</template>

<style scoped>
.page-tab { display: flex; flex-direction: column; gap: 1rem; }

.status {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: .75rem;
}
.status__item {
  display: flex; flex-direction: column; gap: .2rem;
  padding: .7rem .9rem;
  border: 1px solid var(--p-content-border-color);
  border-radius: .6rem;
}
.status__item small { color: var(--p-text-muted-color); font-size: .78rem; }
.status__item strong { font-size: 1.05rem; font-variant-numeric: tabular-nums; }
.status__item--warn { border-color: var(--p-orange-400); }

.sec {
  border: 1px solid var(--p-content-border-color);
  border-radius: .6rem;
  padding: .9rem 1rem;
}
.sec header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .5rem; }
.sec h3 { margin: 0; font-size: 1rem; }
.sec__meta { display: flex; align-items: center; gap: .5rem; color: var(--p-text-muted-color); font-size: .82rem; }
.sec__body { margin: .6rem 0 0; line-height: 1.65; white-space: pre-wrap; }
.sec--empty { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.sec--empty p { margin: .3rem 0 0; color: var(--p-text-muted-color); font-size: .85rem; }
.sec--archive { border-style: dashed; }

.archive { border-top: 1px solid var(--p-content-border-color); padding-top: .8rem; }
.archive summary { cursor: pointer; font-weight: 600; }
.archive__note { color: var(--p-text-muted-color); font-size: .85rem; line-height: 1.55; }

.dialog-hint { margin: 0 0 .75rem; color: var(--p-text-muted-color); font-size: .85rem; line-height: 1.55; }
.dialog-count { margin: .4rem 0 0; text-align: right; font-size: .8rem; color: var(--p-text-muted-color); }
.dialog-count--over { color: var(--p-red-400); }
.w-full { width: 100%; }

.history { margin: 0; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 1rem; }
.history__meta { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; color: var(--p-text-muted-color); font-size: .8rem; }
.history code { font-size: .75rem; }
.history p { margin: .35rem 0 0; line-height: 1.6; white-space: pre-wrap; }
</style>
