<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import {
  ACCOUNT_STATUS_LABEL, emptySocialPayload, socialApi,
  type AdminSocialPayload, type SocialPost,
} from '../../services/social'
import { channelMeta, formatDate, useContentStore } from './shared'

/**
 * Bağlı hesaplar + eşleşmemiş gönderiler.
 *
 * Otomatik ölçüm günlük cron ile gelir (webhook yok, hiçbir platform metrik
 * webhook'u vermiyor). Cron gönderiyi takvim etkinliğine platform kimliği ya
 * da yayın URL'i ile eşler; eşleşmeyenler burada durur ve tek tıkla bağlanır.
 * Caption benzerliğine bakılmaz: yanlış eşleşme eşleşmemekten kötüdür.
 */
const toast = useToast()
const confirm = useConfirm()
const { payload: contentPayload } = useContentStore()

const state = reactive<{ payload: AdminSocialPayload; loading: boolean }>({
  payload: emptySocialPayload(),
  loading: false,
})
const linking = ref<Record<number, number | null>>({})

async function load() {
  state.loading = true
  try {
    state.payload = await socialApi.get()
  } catch {
    state.payload = emptySocialPayload()
  } finally {
    state.loading = false
  }
}
onMounted(load)

/** Bağlanabilecek etkinlikler: yayında/arşivde olan sosyal içerikler. */
const itemOptions = computed(() =>
  contentPayload.value.items
    .filter((i) => i.channel !== 'blog')
    .map((i) => ({
      value: i.id,
      label: `${i.title}${i.plannedAt ? ` · ${formatDate(i.plannedAt)}` : ''}`,
    })),
)

async function connectInstagram() {
  try {
    const { url } = await socialApi.instagramStart()
    window.open(url, '_blank', 'noopener')
    toast.add({
      severity: 'info',
      summary: 'Instagram izin ekranı açıldı',
      detail: 'İzni verdikten sonra buraya dön ve "Yenile"ye bas.',
      life: 6000,
    })
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Bağlama başlatılamadı', detail: err instanceof Error ? err.message : '', life: 5000 })
  }
}

async function link(post: SocialPost) {
  const itemId = linking.value[post.id] ?? null
  if (!itemId) return
  try {
    state.payload = await socialApi.link(post.id, itemId)
    toast.add({ severity: 'success', summary: 'Gönderi etkinliğe bağlandı', detail: 'Ölçümler bir sonraki senkronda gelir.', life: 3500 })
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Bağlanamadı', detail: err instanceof Error ? err.message : '', life: 4000 })
  }
}

function disconnect(id: number, handle: string) {
  confirm.require({
    header: 'Bağlantıyı kopar',
    message: `@${handle} bağlantısı kopsun mu? Token silinir; çekilmiş gönderiler ve ölçümler kalır.`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Vazgeç',
    acceptLabel: 'Kopar',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        state.payload = await socialApi.disconnect(id)
        toast.add({ severity: 'success', summary: 'Bağlantı koparıldı', life: 2500 })
      } catch (err) {
        toast.add({ severity: 'error', summary: 'Koparılamadı', detail: err instanceof Error ? err.message : '', life: 4000 })
      }
    },
  })
}
</script>

<template>
  <section class="accounts-block">
    <header class="accounts-head">
      <div>
        <p class="preview-label">BAĞLI HESAPLAR</p>
        <small>Ölçümler her sabah otomatik çekilir; platformlar metrik webhook'u vermiyor, o yüzden günlük senkron.</small>
      </div>
      <div class="accounts-actions">
        <Button label="Yenile" icon="pi pi-refresh" size="small" severity="secondary" outlined :loading="state.loading" @click="load" />
        <Button
          v-if="state.payload.instagramReady"
          label="Instagram'ı bağla"
          icon="pi pi-camera"
          size="small"
          @click="connectInstagram"
        />
      </div>
    </header>

    <p v-if="!state.payload.instagramReady" class="attach-note is-warn">
      <i class="pi pi-exclamation-triangle" />
      Instagram bağlantısı için Meta uygulaması gerekiyor (app kimliği + redirect adresi tanımlı değil).
      Kurulum bitince bu bölümde "Instagram'ı bağla" düğmesi çıkar. Kurulana kadar ölçümler elle girilir.
    </p>

    <ul v-if="state.payload.accounts.length" class="account-list">
      <li v-for="a in state.payload.accounts" :key="a.id" class="account-item">
        <span class="account-glyph"><i :class="channelMeta(a.platform).icon" /></span>
        <div class="account-meta">
          <strong>@{{ a.handle || a.externalId }}</strong>
          <small>
            {{ channelMeta(a.platform).label }}
            <template v-if="a.lastSyncAt"> · son senkron {{ formatDate(a.lastSyncAt, true) }}</template>
            <template v-if="a.expiresAt"> · token {{ formatDate(a.expiresAt, true) }}'e kadar</template>
          </small>
          <small v-if="a.lastResult" class="account-result">{{ a.lastResult }}</small>
        </div>
        <Tag :value="ACCOUNT_STATUS_LABEL[a.status].label" :severity="ACCOUNT_STATUS_LABEL[a.status].severity" />
        <Button icon="pi pi-times" text rounded size="small" severity="danger" aria-label="Bağlantıyı kopar" @click="disconnect(a.id, a.handle)" />
      </li>
    </ul>
    <p v-else-if="state.payload.instagramReady" class="board-empty">Henüz bağlı hesap yok.</p>

    <template v-if="state.payload.unmatched.length">
      <p class="preview-label mt">EŞLEŞMEMİŞ GÖNDERİLER <span class="board-count">{{ state.payload.unmatched.length }}</span></p>
      <small class="accounts-hint">
        Bu gönderiler platformda var ama takvimde karşılığı bulunamadı (yayın URL'i girilmemiş olabilir).
        Bağladığın an ölçümleri ilgili etkinliğe akmaya başlar.
      </small>
      <ul class="account-list">
        <li v-for="p in state.payload.unmatched" :key="p.id" class="account-item">
          <img v-if="p.thumbnailUrl" :src="p.thumbnailUrl" :alt="p.mediaType" class="attach-thumb" />
          <span v-else class="account-glyph"><i :class="channelMeta(p.platform).icon" /></span>
          <div class="account-meta">
            <strong>{{ p.caption ? p.caption.slice(0, 70) : p.externalId }}</strong>
            <small>
              {{ p.mediaType || channelMeta(p.platform).label }}
              <template v-if="p.publishedAt"> · {{ formatDate(p.publishedAt, true) }}</template>
              <a v-if="p.permalink" :href="p.permalink" target="_blank" rel="noopener" class="file-link"> · <i class="pi pi-external-link" /> gönderi</a>
            </small>
          </div>
          <Select
            v-model="linking[p.id]"
            :options="itemOptions"
            option-label="label"
            option-value="value"
            placeholder="Etkinlik seç"
            filter
            class="link-select"
          />
          <Button label="Bağla" icon="pi pi-link" size="small" :disabled="!linking[p.id]" @click="link(p)" />
        </li>
      </ul>
    </template>
  </section>
</template>
