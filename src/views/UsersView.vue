<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import PageHeader from '../components/PageHeader.vue'
import EmptyState from '../components/EmptyState.vue'
import { adminApi, type User } from '../services/admin'

const rows = ref<User[]>([]), total = ref(0), page = ref(1), pageSize = ref(20), query = ref(''), loading = ref(false), error = ref('')
const date = (value: string | null) => value ? new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : '—'
async function load() { loading.value = true; error.value = ''; try { const result = await adminApi.users({ page: page.value, pageSize: pageSize.value, query: query.value }); rows.value = result.items; total.value = result.total } catch (err) { error.value = err instanceof Error ? err.message : 'Kullanıcılar alınamadı.' } finally { loading.value = false } }
function search() { page.value = 1; load() }
function onPage(event: DataTablePageEvent) { page.value = event.page + 1; pageSize.value = event.rows; load() }
onMounted(load)
</script>

<template>
  <div class="page-wrap">
    <PageHeader eyebrow="TOPLULUK" title="Kullanıcılar" description="Backend’de profil oluşturmuş kullanıcıları ve temel kullanım sinyallerini gör." />
    <div v-if="error" class="error-banner"><i class="pi pi-exclamation-circle" /><span>{{ error }}</span><button @click="load">Tekrar dene</button></div>
    <section class="table-card">
      <div class="table-toolbar"><span class="search-box"><i class="pi pi-search" /><InputText v-model="query" placeholder="E-posta veya ad ara…" @keyup.enter="search" /></span><Button label="Ara" icon="pi pi-search" severity="secondary" outlined @click="search" /><span class="result-count">{{ total.toLocaleString('tr-TR') }} kullanıcı</span></div>
      <DataTable :value="rows" :loading="loading" lazy paginator :rows="pageSize" :total-records="total" :first="(page - 1) * pageSize" :rows-per-page-options="[10, 20, 50]" @page="onPage">
        <template #empty><EmptyState icon="pi pi-users" title="Kullanıcı bulunamadı" description="Arama terimini değiştirerek yeniden deneyebilirsin." /></template>
        <Column header="Kullanıcı" style="min-width: 18rem"><template #body="{ data }"><div class="user-cell"><span>{{ data.emoji || data.email[0].toUpperCase() }}</span><div><strong>{{ data.displayName || 'İsimsiz profil' }}</strong><small>{{ data.email }}</small></div></div></template></Column>
        <Column header="Öğün"><template #body="{ data }"><strong>{{ data.mealCount }}</strong></template></Column>
        <Column header="Menüm"><template #body="{ data }"><strong>{{ data.customFoodCount }}</strong></template></Column>
        <Column header="Ölçüm"><template #body="{ data }"><strong>{{ data.measurementCount }}</strong></template></Column>
        <Column header="Son hareket" style="min-width: 10rem"><template #body="{ data }"><span class="date-cell">{{ date(data.lastActivityAt) }}</span></template></Column>
        <Column header="Katılım" style="min-width: 10rem"><template #body="{ data }"><span class="date-cell">{{ date(data.createdAt) }}</span></template></Column>
      </DataTable>
    </section>
    <p class="scope-note"><i class="pi pi-info-circle" /> Bu liste Stack Auth’taki tüm hesapları değil, backend’e en az bir kez erişip profil satırı oluşan kullanıcıları gösterir.</p>
  </div>
</template>
