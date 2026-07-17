<script setup lang="ts">
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import EmptyState from '../../components/EmptyState.vue'
import type { AnalyticsData } from '../../services/analytics'
import { duration, fmt } from './shared'

defineProps<{ data: AnalyticsData }>()
</script>

<template>
  <div class="tab-body">
    <p class="analytics-note"><i class="pi pi-compass" /> Sitedeki tüm yolların görüntülenmesi. Blog yazıları için daha zengin kırılım <strong>Blog</strong> sekmesinde.</p>
    <section class="table-card">
      <DataTable :value="data.topPages" data-key="path" striped-rows removable-sort :default-sort-order="-1" sort-field="views">
        <template #empty><EmptyState icon="pi pi-compass" title="Henüz görüntülenme yok" description="Ziyaretçiler geldikçe en çok görüntülenen yollar burada listelenir." /></template>
        <Column header="Yol" style="min-width: 22rem" sortable field="path">
          <template #body="{ data: row }"><div class="page-cell"><span class="path mono">{{ row.path }}</span><small>{{ row.title }}</small></div></template>
        </Column>
        <Column header="Görüntülenme" sortable field="views"><template #body="{ data: row }"><strong class="num-cell">{{ fmt(row.views) }}</strong></template></Column>
        <Column header="Ziyaretçi" sortable field="visitors"><template #body="{ data: row }"><span class="num-cell">{{ fmt(row.visitors) }}</span></template></Column>
        <Column header="Ort. süre" sortable field="avgSeconds"><template #body="{ data: row }"><span class="date-cell">{{ duration(row.avgSeconds) }}</span></template></Column>
      </DataTable>
    </section>
  </div>
</template>
