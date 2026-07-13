<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import PageHeader from '../components/PageHeader.vue'
import EmptyState from '../components/EmptyState.vue'
import { adminApi, type WaitlistEntry } from '../services/admin'

const toast = useToast()
const rows = ref<WaitlistEntry[]>([]), total = ref(0), page = ref(1), pageSize = ref(20), query = ref(''), loading = ref(false), exporting = ref(false), error = ref('')
const date = (value: string) => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
async function load() { loading.value = true; error.value = ''; try { const result = await adminApi.waitlist({ page: page.value, pageSize: pageSize.value, query: query.value }); rows.value = result.items; total.value = result.total } catch (err) { error.value = err instanceof Error ? err.message : 'Bekleme listesi alınamadı.' } finally { loading.value = false } }
function search() { page.value = 1; load() }
function onPage(event: DataTablePageEvent) { page.value = event.page + 1; pageSize.value = event.rows; load() }
async function exportCsv() {
  exporting.value = true
  try {
    const result = await adminApi.waitlist({ page: 1, pageSize: 500, query: query.value })
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
    const csv = ['id,email,source,created_at', ...result.items.map((item) => [item.id, item.email, item.source, item.createdAt].map(escape).join(','))].join('\n')
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })); link.download = `afiet-bekleme-listesi-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href)
    if (result.total > result.items.length) toast.add({ severity: 'warn', summary: 'İlk 500 kayıt indirildi', detail: 'Daha büyük dışa aktarımlar için API export ucu eklenmeli.', life: 4500 })
  } catch (err) { toast.add({ severity: 'error', summary: 'Dışa aktarılamadı', detail: err instanceof Error ? err.message : '', life: 4000 }) }
  finally { exporting.value = false }
}
onMounted(load)
</script>

<template>
  <div class="page-wrap">
    <PageHeader eyebrow="WEB TALEBİ" title="Bekleme listesi" description="Landing sayfasından haber bekleyen kişileri ve geliş kaynaklarını takip et.">
      <Button label="CSV indir" icon="pi pi-download" outlined :loading="exporting" @click="exportCsv" />
    </PageHeader>
    <div v-if="error" class="error-banner"><i class="pi pi-exclamation-circle" /><span>{{ error }}</span><button @click="load">Tekrar dene</button></div>
    <section class="table-card">
      <div class="table-toolbar"><span class="search-box"><i class="pi pi-search" /><InputText v-model="query" placeholder="E-posta veya kaynak ara…" @keyup.enter="search" /></span><Button label="Ara" icon="pi pi-search" severity="secondary" outlined @click="search" /><span class="result-count">{{ total.toLocaleString('tr-TR') }} kişi sırada</span></div>
      <DataTable :value="rows" :loading="loading" lazy paginator :rows="pageSize" :total-records="total" :first="(page - 1) * pageSize" :rows-per-page-options="[10, 20, 50]" @page="onPage">
        <template #empty><EmptyState icon="pi pi-inbox" title="Liste henüz boş" description="Web sitesindeki formdan gelen ilk kayıt burada görünecek." /></template>
        <Column header="#" style="width: 5rem"><template #body="{ data }"><span class="id-cell">{{ data.id }}</span></template></Column>
        <Column field="email" header="E-posta" style="min-width: 20rem"><template #body="{ data }"><div class="email-cell"><span>{{ data.email[0].toUpperCase() }}</span><strong>{{ data.email }}</strong></div></template></Column>
        <Column header="Kaynak"><template #body="{ data }"><Tag :value="data.source" severity="secondary" /></template></Column>
        <Column header="Katılım tarihi" style="min-width: 15rem"><template #body="{ data }"><span class="date-cell">{{ date(data.createdAt) }}</span></template></Column>
      </DataTable>
    </section>
    <p class="scope-note"><i class="pi pi-lock" /> E-posta verileri yalnızca yetkili admin oturumu üzerinden backend API’den okunur.</p>
  </div>
</template>
