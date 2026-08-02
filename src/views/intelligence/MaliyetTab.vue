<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import { afiApi, type AICostRow, type AICostStats } from '../../services/afi'

/**
 * Model çağrılarının maliyeti ve sağlığı.
 *
 * Bu tablo var olmadan önce iki soru cevapsızdı: bu ay ne harcadık ve hangi
 * ajan bozuk. İkincisi daha sinsiydi; bir ajan sessizce hata döndürmeye
 * başlasa kimse fark etmezdi, çünkü kullanıcıya giden şey yalnız "şu an
 * yanıt veremiyorum" oluyor.
 *
 * Simülasyon çağrıları `sim:` önekiyle ayrı satırlarda: prova ile gerçek
 * trafiği aynı toplamda göstermek, ikisini de yanlış okutur.
 */

const RANGES = [
  { label: '7 gün', value: 7 },
  { label: '30 gün', value: 30 },
  { label: '90 gün', value: 90 },
]

const days = ref(30)
const data = ref<AICostStats | null>(null)
const error = ref('')
const loading = ref(false)

const rows = computed(() =>
  (data.value?.rows ?? []).map((r) => ({ ...r, rowKey: `${r.agentKey}|${r.flow}` })),
)
const totals = computed(() => data.value?.totals ?? null)

/** Hata oranı yüzde olarak; sıfır çağrıda bölme yok. */
function errorRate(row: AICostRow) {
  return row.calls === 0 ? 0 : Math.round((row.errors / row.calls) * 100)
}

/** Bir ajanın sağlığı: renk değil, eşik. Tek hata gürültü, süregelen değil. */
function health(row: AICostRow): { label: string; severity: 'success' | 'warn' | 'danger' } {
  const rate = errorRate(row)
  if (rate >= 20) return { label: `%${rate} hata`, severity: 'danger' }
  if (rate > 0) return { label: `%${rate} hata`, severity: 'warn' }
  return { label: 'sorunsuz', severity: 'success' }
}

const nf = new Intl.NumberFormat('tr-TR')
const fmt = (n: number) => nf.format(n)

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await afiApi.aiStats(days.value)
  } catch {
    error.value = 'Maliyet verisi okunamadı. Birazdan tekrar dene.'
  } finally {
    loading.value = false
  }
}

watch(days, load)
onMounted(load)
</script>

<template>
  <div class="cost">
    <div class="cost__head">
      <SelectButton v-model="days" :options="RANGES" option-label="label" option-value="value" />
      <p v-if="totals" class="cost__summary">
        <strong>{{ fmt(totals.calls) }}</strong> çağrı ·
        <strong>{{ fmt(totals.promptTokens + totals.outputTokens) }}</strong> token ·
        <strong>{{ fmt(totals.errors) }}</strong> hata
      </p>
    </div>

    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

    <Message v-else-if="!loading && rows.length === 0" severity="secondary" :closable="false">
      Bu aralıkta hiç model çağrısı yok.
    </Message>

    <DataTable v-else :value="rows" :loading="loading" data-key="rowKey" size="small" striped-rows>
      <Column field="agentKey" header="Ajan" />
      <Column field="flow" header="Akış" />
      <Column header="Çağrı">
        <template #body="{ data: row }">{{ fmt(row.calls) }}</template>
      </Column>
      <Column header="Durum">
        <template #body="{ data: row }">
          <Tag :severity="health(row).severity" :value="health(row).label" />
        </template>
      </Column>
      <Column header="Giren token">
        <template #body="{ data: row }">{{ fmt(row.promptTokens) }}</template>
      </Column>
      <Column header="Çıkan token">
        <template #body="{ data: row }">{{ fmt(row.outputTokens) }}</template>
      </Column>
      <Column header="Ortanca süre">
        <template #body="{ data: row }">{{ fmt(Math.round(row.medianMs)) }} ms</template>
      </Column>
    </DataTable>

    <p class="cost__note">
      Token bildirilmeyen çağrılar sıfır olarak değil, hiç sayılmaz: sağlayıcının
      söylemediği ile sıfır dediği aynı şey değil. <code>sim:</code> önekli satırlar
      yönetim panelindeki simülasyon çağrılarıdır, gerçek kullanıcı trafiği değil.
    </p>
  </div>
</template>

<style scoped>
.cost { display: flex; flex-direction: column; gap: 1rem; }
.cost__head { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; justify-content: space-between; }
.cost__summary { margin: 0; color: var(--p-text-muted-color); font-variant-numeric: tabular-nums; }
.cost__note { margin: 0; font-size: .85rem; line-height: 1.55; color: var(--p-text-muted-color); }
</style>
