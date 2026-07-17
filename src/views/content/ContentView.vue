<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import PageHeader from '../../components/PageHeader.vue'
import AdminPlaceholder from '../../components/AdminPlaceholder.vue'
import AnalyticsTab from './AnalyticsTab.vue'
import PlanTab from './PlanTab.vue'
import { useContentStore } from './shared'

// Gerçek veri /api/admin/content'ten gelir. Uç erişilemezse (oturumsuz/404/ağ)
// mock ÜRETİLMEZ; payload boş kalır (live:false) ve sayfa placeholder gösterir.
const { state, payload, load } = useContentStore()
const activeTab = ref('plan')
onMounted(load)
</script>

<template>
  <div class="page-wrap">
    <PageHeader eyebrow="YAYIN" title="İçerik" description="Blog, Instagram ve X içeriklerini planla, brief'leri prompt'a çevir, yayın sonrası basit metriklerle izle.">
      <Button label="Yenile" icon="pi pi-refresh" outlined :loading="state.loading" @click="load" />
    </PageHeader>

    <div v-if="state.loading && !payload.live" class="seo-loading"><i class="pi pi-spin pi-spinner" /> İçerik planı yükleniyor…</div>

    <AdminPlaceholder
      v-else-if="!payload.live"
      icon="pi pi-megaphone"
      title="İçerik planı getirilemedi"
      description="İçerik verisi şu an alınamadı. Oturumunun açık ve bağlantının aktif olduğundan emin olup yeniden dene."
      retryable
      :loading="state.loading"
      @retry="load"
    />

    <template v-else>
      <div v-if="!payload.dbConnected" class="db-banner">
        <i class="pi pi-database" />
        <span>Veritabanı bağlı değil; içerik planı salt-okunur. Kaydetme kapalı.</span>
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
    </template>
  </div>
</template>

<script lang="ts">
export default { name: 'ContentView' }
</script>
