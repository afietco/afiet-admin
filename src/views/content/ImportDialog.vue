<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import { buildImport, toMetrics, type ImportResult } from './metricsImport'
import { channelMeta, toIsoDate, useContentStore } from './shared'

/**
 * Ölçüm dosyası içe aktarma (Meta Business Suite > Insights > Content >
 * Export Data → CSV).
 *
 * Akış: dosya seç → panelde ayrıştır ve takvimle eşleştir → ÖNİZLEME →
 * kullanıcı onaylayınca tek istekte yaz. Onaysız hiçbir şey yazılmaz;
 * eşleşmeyen satırlar atlanır ve listelenir (genelde yayın URL'i girilmemiştir).
 */
const visible = defineModel<boolean>('visible', { required: true })

const toast = useToast()
const { payload, importMetrics } = useContentStore()

const fileName = ref('')
const result = ref<ImportResult | null>(null)
const snapshot = ref<Date | null>(new Date())
const saving = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

watch(visible, (open) => {
  if (!open) return
  fileName.value = ''
  result.value = null
  snapshot.value = new Date()
})

async function pick(files: FileList | null) {
  const file = files?.[0]
  if (!file) return
  fileName.value = file.name
  try {
    const text = await file.text()
    result.value = buildImport(text, payload.value.items)
  } catch (err) {
    result.value = null
    toast.add({ severity: 'error', summary: 'Dosya okunamadı', detail: err instanceof Error ? err.message : '', life: 5000 })
  }
  if (fileInput.value) fileInput.value.value = ''
}

const canSave = computed(() => Boolean(result.value?.matched.length) && Boolean(snapshot.value))

async function save() {
  const rows = result.value?.matched ?? []
  const date = toIsoDate(snapshot.value)
  if (!rows.length || !date) return
  saving.value = true
  try {
    const written = await importMetrics(toMetrics(rows, date))
    toast.add({
      severity: 'success',
      summary: `${written} ölçüm yazıldı`,
      detail: 'Aynı tarihe yeniden aktarırsan üzerine yazar.',
      life: 4000,
    })
    visible.value = false
  } catch (err) {
    toast.add({ severity: 'error', summary: 'İçe aktarılamadı', detail: err instanceof Error ? err.message : '', life: 5000 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:visible="visible" modal header="Ölçüm dosyası içe aktar" class="content-dialog" :style="{ width: '52rem' }">
    <div class="import-body">
      <p class="attach-note">
        <i class="pi pi-info-circle" />
        Meta Business Suite → Insights → Content → <strong>Export Data</strong> ile indirdiğin CSV'yi buraya ver.
        Satırlar <strong>gönderi bağlantısıyla</strong> takvimdeki etkinliklere eşlenir; eşleşmeyen satır yazılmaz.
      </p>

      <div class="drop-zone" @dragover.prevent @drop.prevent="pick($event.dataTransfer?.files ?? null)">
        <i class="pi pi-file-import" />
        <p>
          Dosyayı buraya bırak ya da
          <button type="button" class="link-btn" @click="fileInput?.click()">bilgisayardan seç</button>
        </p>
        <small>{{ fileName || 'csv (Business Suite dışa aktarımı)' }}</small>
        <input ref="fileInput" type="file" accept=".csv,text/csv,text/plain" hidden @change="pick(($event.target as HTMLInputElement).files)" />
      </div>

      <template v-if="result">
        <p v-if="result.error" class="attach-note is-warn">
          <i class="pi pi-exclamation-triangle" /> {{ result.error }}
          <template v-if="result.headers.length">
            <br /><small>Dosyadaki başlıklar: {{ result.headers.join(' · ') }}</small>
          </template>
        </p>

        <template v-else>
          <div class="import-summary">
            <Tag :value="`${result.matched.length} eşleşti`" severity="success" />
            <Tag v-if="result.unmatched.length" :value="`${result.unmatched.length} eşleşmedi`" severity="warn" />
            <span class="import-date">
              Anlık görüntü tarihi
              <DatePicker v-model="snapshot" date-format="dd.mm.yy" show-icon icon-display="input" />
            </span>
          </div>

          <ul v-if="result.matched.length" class="account-list import-list">
            <li v-for="row in result.matched" :key="row.line" class="account-item">
              <span class="account-glyph"><i :class="channelMeta(row.item!.channel).icon" /></span>
              <div class="account-meta">
                <strong>{{ row.item!.title }}</strong>
                <small>{{ row.views.toLocaleString('tr-TR') }} görüntülenme · {{ row.reach.toLocaleString('tr-TR') }} erişim · {{ row.likes }} beğeni · {{ row.comments }} yorum · {{ row.saves }} kaydetme</small>
              </div>
            </li>
          </ul>

          <template v-if="result.unmatched.length">
            <p class="preview-label mt">EŞLEŞMEYEN SATIRLAR</p>
            <small class="accounts-hint">
              Bu gönderilerin bağlantısı takvimdeki hiçbir etkinliğin "Yayın URL'i" alanıyla tutmadı.
              İlgili etkinliği açıp yayın URL'ini girersen sonraki aktarımda eşleşir.
            </small>
            <ul class="account-list import-list">
              <li v-for="row in result.unmatched" :key="row.line" class="account-item is-muted">
                <span class="account-glyph"><i class="pi pi-question" /></span>
                <div class="account-meta">
                  <strong>{{ row.caption ? row.caption.slice(0, 60) : row.permalink || row.postId }}</strong>
                  <small>satır {{ row.line }} · {{ row.views.toLocaleString('tr-TR') }} görüntülenme</small>
                </div>
                <a v-if="row.permalink" :href="row.permalink" target="_blank" rel="noopener" class="file-link"><i class="pi pi-external-link" /> aç</a>
              </li>
            </ul>
          </template>
        </template>
      </template>
    </div>

    <template #footer>
      <Button label="Vazgeç" severity="secondary" text @click="visible = false" />
      <Button
        :label="result?.matched.length ? `${result.matched.length} ölçümü yaz` : 'Ölçümleri yaz'"
        icon="pi pi-check"
        :disabled="!canSave"
        :loading="saving"
        @click="save"
      />
    </template>
  </Dialog>
</template>
