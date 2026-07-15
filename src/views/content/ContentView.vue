<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import PageHeader from '../../components/PageHeader.vue'
import AnalyticsTab from './AnalyticsTab.vue'
import PlanTab from './PlanTab.vue'
import { useContentStore } from './shared'

// Gerçek veri Faz B'de /api/admin/content'ten gelir. Uç henüz yokken (404)
// ya da oturumsuzken mock'a düşer — "mock veri" rozeti onu belli eder.
const { state, payload, load } = useContentStore()
const activeTab = ref('plan')
onMounted(load)
</script>

<template>
  <div class="page-wrap">
    <PageHeader eyebrow="YAYIN" title="İçerik" description="Blog, Instagram ve X içeriklerini planla, brief'leri prompt'a çevir, yayın sonrası basit metriklerle izle.">
      <span v-if="!payload.live" class="mock-badge"><i class="pi pi-flask" /> mock veri</span>
      <Button label="Yenile" icon="pi pi-refresh" outlined :loading="state.loading" @click="load" />
    </PageHeader>

    <div v-if="payload.live && !payload.dbConnected" class="db-banner">
      <i class="pi pi-database" />
      <span>Veritabanı bağlı değil — içerik planı salt-okunur. Kaydetme kapalı.</span>
    </div>

    <Tabs v-model:value="activeTab" class="seo-tabs">
      <TabList>
        <Tab value="plan">Plan</Tab>
        <Tab value="analitik">Analitik</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="plan"><PlanTab /></TabPanel>
        <TabPanel value="analitik"><AnalyticsTab /></TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<script lang="ts">
export default { name: 'ContentView' }
</script>
