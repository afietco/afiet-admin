<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import AdminPlaceholder from '../../components/AdminPlaceholder.vue'
import { adminApi } from '../../services/admin'
import {
  dropReasonLabel, pushFeedScopes, pushKindLabel, pushOutcomeMeta,
  type PushBroadcast, type PushFeed, type PushFeedRow, type PushFeedScope,
} from '../../services/push'
import { ago, dateTime, initial } from '../users/shared'

/**
 * Kime ne gitti.
 *
 * Bu sekme eskiden yalnız `push_broadcasts` okuyordu, yani ELLE yazılan
 * duyuruları. Otomatik giden on sekiz tür (öğün hatırlatması, kutlamalar,
 * hoş geldin serisi, selam, davet, geri dönüş) hiçbir listede görünmüyordu ve
 * "bu kişiye ne gitti" sorusunun panelde cevabı yoktu.
 *
 * Artık kaynak `/v1/admin/push/akis`: satır başına BİR KİŞİYE giden BİR
 * bildirim. Duyurular da tek tek satır olur — "herkese gitti" cümlesi kimin
 * aldığını söylemiyordu.
 *
 * Gitmeyenler de aynı akışta: kapı sessizce reddedebiliyor ve reddin görünmez
 * olması, kuralların tahminle gevşetilmesiyle biter.
 */
const toast = useToast()
const confirm = useConfirm()

const feed = ref<PushFeed | null>(null)
const scheduled = ref<PushBroadcast[]>([])
const page = ref(1)
const pageSize = ref(20)
const scope = ref<PushFeedScope>('giden')
const kind = ref<string>('tumu')
const search = ref('')
const loading = ref(false)
const live = ref(true)

/**
 * Tür filtresi. "Tümü" boş dize DEĞİL açık bir jetondur: PrimeVue Select boş
 * dizeyi "hiç seçilmemiş" sayıp etiketi çizmiyor ve kutu bomboş görünüyordu.
 */
const ALL_KINDS = 'tumu'
const kindOptions = computed(() => [
  { value: ALL_KINDS, label: 'Tüm türler' },
  ...(feed.value?.kinds ?? []).map((k) => ({ value: k, label: pushKindLabel(k) })),
])

async function load() {
  loading.value = true
  try {
    feed.value = await adminApi.pushFeed({
      page: page.value, pageSize: pageSize.value, scope: scope.value,
      kind: kind.value === ALL_KINDS ? undefined : kind.value,
      q: search.value.trim() || undefined,
    })
    live.value = true
  } catch {
    feed.value = null
    live.value = false
  } finally { loading.value = false }
}

/**
 * Zamanlanmış duyurular akıştan DEĞİL, duyuru listesinden okunur: iptal
 * düğmesi duyuru kimliğine basıyor, akış satırı ise kişi başına bir olay.
 * Zamanlanmış bir duyurunun kişi satırları "kuyrukta" olarak yalnız Hepsi
 * görünümünde çıkar, yoksa otuz beş satır akışın tepesini kaplardı.
 */
async function loadScheduled() {
  try {
    const result = await adminApi.pushBroadcasts({ page: 1, pageSize: 50 })
    scheduled.value = result.items.filter((b) => b.status === 'scheduled' || b.status === 'sending')
  } catch { scheduled.value = [] }
}

function reload() { page.value = 1; void load() }
watch([scope, kind], reload)

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(reload, 350)
})

function onPage(event: DataTablePageEvent) {
  page.value = event.page + 1
  pageSize.value = event.rows
  void load()
}

const audienceLabel = (item: PushBroadcast) =>
  item.audience.kind === 'all' ? 'Herkes' : item.audience.identifier

function cancelBroadcast(item: PushBroadcast) {
  confirm.require({
    header: 'Gönderimi iptal et',
    message: `“${item.title}” bildirimi iptal edilsin mi? Henüz iletilmemiş cihazlara gönderilmez.`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Vazgeç',
    acceptLabel: 'İptal et',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await adminApi.cancelPushBroadcast(item.id)
        toast.add({ severity: 'success', summary: 'Gönderim iptal edildi', life: 2500 })
        await Promise.all([loadScheduled(), load()])
      } catch (err) {
        toast.add({ severity: 'error', summary: 'İptal edilemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
      }
    },
  })
}

/**
 * Satırın sağındaki tek cümle. Cihaz sayısı YALNIZ anlattığı bir şey varsa
 * yazılır: tek cihazlı bir kişide "1 cihaz" bilgi değil gürültüdür.
 */
function detail(row: PushFeedRow): string {
  if (row.outcome === 'gitmedi') return dropReasonLabel(row.reason)
  if (row.outcome === 'ulasmadi' && row.devices.failed > 0) {
    return `${row.devices.failed} cihazda başarısız`
  }
  if (row.devices.total > 1) return `${row.devices.total} cihaz`
  return ''
}

const name = (row: PushFeedRow) => row.displayName || row.email

onMounted(() => { void Promise.all([load(), loadScheduled()]) })
defineExpose({ load: () => Promise.all([load(), loadScheduled()]) })
</script>

<template>
  <div class="tab-body">
    <!-- Henüz çıkmamış duyurular: iptal edilebilecek tek şey bunlar. -->
    <section v-if="scheduled.length" class="scheduled-strip">
      <strong class="block-caption">Zamanlanmış duyurular</strong>
      <div v-for="item in scheduled" :key="item.id" class="scheduled-row">
        <div>
          <strong>{{ item.title }}</strong>
          <small>{{ audienceLabel(item) }} · {{ dateTime(item.scheduledAt ?? item.createdAt) }}</small>
        </div>
        <Button icon="pi pi-times" text rounded severity="danger" aria-label="İptal et" @click="cancelBroadcast(item)" />
      </div>
    </section>

    <!-- Son 7 gün. Açılma oranının paydası ULAŞANLAR: ulaşmamış bir bildirimin
         açılmamış olması kişi hakkında hiçbir şey söylemez. -->
    <section v-if="feed" class="feed-summary">
      <div><strong>{{ feed.summary.giden.toLocaleString('tr-TR') }}</strong><small>BİLDİRİM GİTTİ</small></div>
      <div><strong>{{ feed.summary.ulasan.toLocaleString('tr-TR') }}</strong><small>ULAŞTI</small></div>
      <div>
        <strong>{{ feed.summary.acilan.toLocaleString('tr-TR') }}</strong>
        <small>AÇILDI{{ feed.summary.openRate !== null ? ` · %${feed.summary.openRate}` : '' }}</small>
      </div>
      <div><strong>{{ feed.summary.gitmeyen.toLocaleString('tr-TR') }}</strong><small>GİTMEDİ</small></div>
      <span class="summary-note">son 7 gün</span>
    </section>

    <div class="table-toolbar">
      <SelectButton v-model="scope" :options="pushFeedScopes" option-label="label" option-value="value" :allow-empty="false" />
      <Select v-model="kind" :options="kindOptions" option-label="label" option-value="value" />
      <span class="search-box p-input-icon-left">
        <i class="pi pi-search" />
        <InputText v-model="search" placeholder="Kişi ara (e-posta veya ad)" />
      </span>
      <span v-if="feed" class="result-count">{{ feed.total.toLocaleString('tr-TR') }} kayıt</span>
    </div>

    <AdminPlaceholder
      v-if="!live"
      icon="pi pi-bell"
      title="Bildirim akışı getirilemedi"
      description="Kime ne gittiği şu an okunamadı. Oturumunun açık olduğundan emin olup yeniden dene."
      retryable
      :loading="loading"
      @retry="load"
    />
    <DataTable
      v-else :value="feed?.items ?? []" :loading="loading" lazy paginator scrollable
      :rows="pageSize" :total-records="feed?.total ?? 0" :first="(page - 1) * pageSize"
      :rows-per-page-options="[20, 50, 100]" data-key="id" striped-rows @page="onPage"
    >
      <template #empty>
        <p class="feed-empty">
          {{ scope === 'gitmeyen' ? 'Bu aralıkta kapının reddettiği bildirim yok.' : 'Bu aralıkta bildirim yok.' }}
        </p>
      </template>

      <Column header="Kime" style="min-width: 15rem">
        <template #body="{ data }">
          <RouterLink :to="`/kullanicilar/${data.userId}`" class="feed-person">
            <span class="mail-avatar">{{ initial(data) }}</span>
            <span>
              <strong>{{ name(data) }}</strong>
              <small v-if="data.displayName">{{ data.email }}</small>
            </span>
          </RouterLink>
        </template>
      </Column>
      <Column header="Bildirim" style="min-width: 20rem">
        <template #body="{ data }">
          <div class="feed-message">
            <span class="feed-kind">{{ pushKindLabel(data.kind) }}</span>
            <strong>{{ data.title }}</strong>
            <small>{{ data.body }}</small>
          </div>
        </template>
      </Column>
      <Column header="Ne oldu" style="min-width: 14rem">
        <template #body="{ data }">
          <div class="feed-outcome">
            <Tag :value="pushOutcomeMeta[data.outcome as keyof typeof pushOutcomeMeta].label"
                 :severity="pushOutcomeMeta[data.outcome as keyof typeof pushOutcomeMeta].severity" />
            <small v-if="detail(data)">{{ detail(data) }}</small>
          </div>
        </template>
      </Column>
      <Column header="Zaman" style="min-width: 9rem">
        <template #body="{ data }">
          <span class="date-cell" :title="dateTime(data.sentAt ?? data.createdAt)">
            {{ ago(data.sentAt ?? data.createdAt) }}
          </span>
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<style scoped>
.scheduled-strip { display: grid; gap: 8px; padding: 16px 18px; border: 1px solid #e6dcc4; border-radius: 16px; background: #fdf7e9; }
.scheduled-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.scheduled-row strong { display: block; font-size: 13px; }
.scheduled-row small { display: block; margin-top: 2px; color: #8d8062; font-size: 10px; font-weight: 700; }

.feed-summary { display: flex; flex-wrap: wrap; gap: 10px 34px; align-items: baseline; padding: 16px 20px; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); }
.feed-summary > div { display: grid; gap: 3px; }
.feed-summary strong { color: var(--ink); font-size: 24px; line-height: 1; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
.feed-summary small { color: #93958d; font-size: 9px; font-weight: 800; letter-spacing: .06em; }
.summary-note { margin-left: auto; color: #a1afa4; font-size: 10px; font-weight: 800; }

.feed-person { display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 9px; align-items: center; color: inherit; text-decoration: none; }
.feed-person .mail-avatar { width: 30px; height: 30px; font-size: 11px; }
.feed-person strong { display: block; font-size: 12px; overflow: hidden; text-overflow: ellipsis; }
.feed-person small { display: block; margin-top: 1px; color: #99998f; font-size: 9px; }
.feed-person:hover strong { color: var(--green); }

.feed-message { display: grid; gap: 2px; }
.feed-kind { color: var(--green); font-size: 9px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; }
.feed-message strong { font-size: 12.5px; }
.feed-message small { color: #8d9087; font-size: 10.5px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }

.feed-outcome { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.feed-outcome small { color: #8d9087; font-size: 10px; }
.feed-empty { margin: 0; padding: 26px 0; color: #8d9087; font-size: 12px; text-align: center; }
</style>
