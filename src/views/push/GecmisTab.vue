<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import Tag from 'primevue/tag'
import AdminPlaceholder from '../../components/AdminPlaceholder.vue'
import { adminApi } from '../../services/admin'
import {
  pushStatusLabels, pushTargetLabel,
  type PushAudience, type PushBroadcast,
} from '../../services/push'

const toast = useToast()
const confirm = useConfirm()

const rows = ref<PushBroadcast[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const listLoading = ref(false)
const listLive = ref(true)

const dateFormat = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })
const formatDate = (value: string) => dateFormat.format(new Date(value))
const audienceLabel = (value: PushAudience) => value.kind === 'all' ? 'Herkes' : value.identifier

/**
 * Kuyruğu boşalmış ama tek teslimatı bile Expo'ya geçmemiş duyuru.
 *
 * Sunucu durumu yalnız bekleyen `push_events` kalıp kalmadığına bakarak
 * türetiyor, teslimatların başarılı olup olmadığına bakmıyor; hepsi düşen bir
 * duyuru da "bitti" sayılıyor. Panelin bunu sessizce onaylamaması için satır
 * kendini işaretliyor.
 *
 * BACKEND İŞİ: doğrusu sunucuda ayrı bir `failed` durumu türetmek.
 */
const stalled = (row: PushBroadcast) =>
  row.status === 'sent' && row.recipientCount > 0 && row.deliveredCount === 0

async function load() {
  listLoading.value = true
  try {
    const result = await adminApi.pushBroadcasts({ page: page.value, pageSize: pageSize.value })
    rows.value = result.items
    total.value = result.total
    listLive.value = true
  } catch {
    rows.value = []
    total.value = 0
    listLive.value = false
  } finally { listLoading.value = false }
}

function onPage(event: DataTablePageEvent) { page.value = event.page + 1; pageSize.value = event.rows; load() }

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
        await load()
      } catch (err) {
        toast.add({ severity: 'error', summary: 'İptal edilemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
      }
    },
  })
}

onMounted(load)
defineExpose({ load })
</script>

<template>
  <div class="tab-body">
    <div class="table-toolbar flush">
      <strong class="block-caption">Gönderim geçmişi</strong>
      <span v-if="listLive" class="result-count">{{ total.toLocaleString('tr-TR') }} kayıt</span>
    </div>
    <AdminPlaceholder
      v-if="!listLive"
      icon="pi pi-bell"
      title="Gönderim geçmişi henüz yok"
      description="Bildirim altyapısı bu ortama bağlandığında gönderilen ve zamanlanan bildirimler burada listelenir."
      retryable
      :loading="listLoading"
      @retry="load"
    />
    <DataTable
      v-else :value="rows" :loading="listLoading" lazy paginator scrollable
      :rows="pageSize" :total-records="total" :first="(page - 1) * pageSize"
      :rows-per-page-options="[10, 20, 50]" data-key="id" striped-rows @page="onPage"
    >
      <Column header="Bildirim" style="min-width: 18rem">
        <template #body="{ data }">
          <div><strong>{{ data.title }}</strong><small class="push-row-body">{{ data.body }}</small></div>
        </template>
      </Column>
      <Column header="Hedef">
        <template #body="{ data }"><Tag :value="pushTargetLabel(data.target)" severity="secondary" /></template>
      </Column>
      <Column header="Kitle">
        <template #body="{ data }">{{ audienceLabel(data.audience) }}</template>
      </Column>
      <Column header="Zaman" style="min-width: 11rem">
        <template #body="{ data }">{{ formatDate(data.scheduledAt ?? data.createdAt) }}</template>
      </Column>
      <Column header="Durum">
        <template #body="{ data }">
          <!-- Kuyruğu boşalmış ama hiçbiri yola çıkmamışsa rozet yeşil kalmaz:
               "bitti" doğru, "başarılı" değil. -->
          <Tag :value="pushStatusLabels[data.status as keyof typeof pushStatusLabels].label"
               :severity="stalled(data) ? 'warn' : pushStatusLabels[data.status as keyof typeof pushStatusLabels].severity" />
        </template>
      </Column>
      <!-- İki sayı BÖLÜNMÜYOR: deliveredCount cihaz, recipientCount kişi.
           İki cihazlı tek kullanıcıda eski "2 / 1" oranı çıkıyordu. Artık
           ikisi de kendi birimiyle, alt alta yazılıyor. -->
      <Column header="Yola çıkan" style="min-width: 9rem">
        <template #body="{ data }">
          <div class="reach-cell">
            <strong>{{ data.deliveredCount.toLocaleString('tr-TR') }} cihaz</strong>
            <small>{{ data.recipientCount.toLocaleString('tr-TR') }} kişiye kuruldu</small>
            <small v-if="stalled(data)" class="reach-warn">
              <i class="pi pi-exclamation-triangle" /> hiçbiri yola çıkmadı
            </small>
          </div>
        </template>
      </Column>
      <Column header="" frozen align-frozen="right" style="width: 5rem">
        <template #body="{ data }">
          <Button
            v-if="data.status === 'scheduled' || data.status === 'sending'"
            icon="pi pi-times" text rounded severity="danger" aria-label="İptal et"
            @click="cancelBroadcast(data)"
          />
        </template>
      </Column>
    </DataTable>
  </div>
</template>

<style scoped>
.reach-cell { display: grid; gap: 2px; }
.reach-cell strong { color: #333831; font-size: 12.5px; font-variant-numeric: tabular-nums; }
.reach-cell small { color: #8d9087; font-size: 10px; font-weight: 700; }
.reach-cell .reach-warn { display: flex; align-items: center; gap: 4px; color: #a5442f; }
.reach-cell .reach-warn i { font-size: 9px; }
</style>
