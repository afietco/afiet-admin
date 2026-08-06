<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import BetaDetail from '../beta/BetaDetail.vue'
import { betaApi, label, type BetaAdminPayload, type BetaApplication } from '../../services/beta'
import { date } from './shared'

/**
 * Beta başvuruları artık kendi menü girdisi değil, Kullanıcılar sayfasından
 * açılan bir yan panel: beta kapanınca burası tamamen kalkacak, o yüzden
 * sayfanın gövdesine yerleşmiyor. Veri afiet-web'in Neon'unda yaşadığı için
 * (landing formu oraya yazıyor) kullanıcı listesinden ayrı bir uçtan gelir.
 */
const visible = defineModel<boolean>('visible', { required: true })

const data = ref<BetaAdminPayload | null>(null)
const loading = ref(false)
const error = ref('')
const query = ref('')
const selected = ref<BetaApplication | null>(null)
const detailOpen = ref(false)

async function load() {
  if (data.value || loading.value) return
  loading.value = true
  error.value = ''
  try {
    data.value = await betaApi.get()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Beta başvuruları alınamadı.'
  } finally {
    loading.value = false
  }
}

// Panel ilk açılışta yükler; kapanınca veri elde kalır, ikinci açılış anlıktır.
watch(visible, (open) => { if (open) load() })

const rows = computed(() => {
  const term = query.value.trim().toLocaleLowerCase('tr')
  const items = data.value?.items ?? []
  if (!term) return items
  return items.filter((row) => row.email.toLocaleLowerCase('tr').includes(term))
})

function open(row: BetaApplication) {
  selected.value = row
  detailOpen.value = true
}
</script>

<template>
  <Drawer v-model:visible="visible" position="right" class="food-drawer" :style="{ width: '34rem' }">
    <template #header>
      <div class="drawer-head">
        <span class="email-avatar"><i class="pi pi-send" /></span>
        <div>
          <strong>Beta başvuruları</strong>
          <small>{{ (data?.total ?? 0).toLocaleString('tr-TR') }} başvuru · son 7 günde {{ data?.summary.last7d ?? 0 }}</small>
        </div>
      </div>
    </template>

    <p v-if="loading" class="note-line subtle"><i class="pi pi-spin pi-spinner" /> Başvurular yükleniyor…</p>
    <p v-else-if="error" class="note-line"><i class="pi pi-exclamation-triangle" /> {{ error }}</p>

    <template v-else-if="data">
      <span class="search-box beta-search">
        <i class="pi pi-search" />
        <InputText v-model="query" placeholder="E-posta ara" fluid />
      </span>

      <ul class="beta-rows">
        <li v-for="row in rows" :key="row.id">
          <button type="button" @click="open(row)">
            <span class="beta-mail">{{ row.email }}</span>
            <Tag :value="label.platform(row.platform)" severity="secondary" />
            <span class="beta-date">{{ date(row.createdAt) }}</span>
            <i class="pi pi-chevron-right" />
          </button>
        </li>
      </ul>
      <p v-if="!rows.length" class="note-line subtle"><i class="pi pi-inbox" /> Aramaya uyan başvuru yok.</p>

      <p class="note-line subtle">
        <i class="pi pi-clock" />
        Beta dönemine ait geçici bir liste: başvuru alımı kapandığında bu panel tamamen kalkacak.
      </p>
    </template>
  </Drawer>

  <BetaDetail v-model:visible="detailOpen" :application="selected" />
</template>

<style scoped>
.beta-search { display: flex; align-items: center; gap: 8px; width: 100%; margin-bottom: 14px; }

.beta-rows { display: grid; gap: 6px; margin: 0 0 16px; padding: 0; list-style: none; }
.beta-rows button {
  display: grid; grid-template-columns: minmax(0, 1fr) auto auto 14px;
  gap: 10px; align-items: center; width: 100%;
  padding: 11px 13px; border: 1px solid var(--line); border-radius: 12px;
  background: var(--paper); cursor: pointer; text-align: left;
  transition: border-color .15s, background .15s;
}
.beta-rows button:hover { border-color: var(--green); background: #f7fbf8; }
.beta-mail { overflow: hidden; font-size: 13px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.beta-date { color: var(--muted); font-size: 11.5px; font-weight: 700; }
.beta-rows i { color: var(--muted); font-size: 11px; }
</style>
