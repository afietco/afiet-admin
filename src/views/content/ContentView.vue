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
import CalendarTab from './CalendarTab.vue'
import EventDialog from './EventDialog.vue'
import PlanTab from './PlanTab.vue'
import { useContentStore } from './shared'

// Gerçek veri /api/admin/content'ten gelir. Uç erişilemezse (oturumsuz/404/ağ)
// mock ÜRETİLMEZ; payload boş kalır (live:false) ve sayfa placeholder gösterir.
const { state, payload, load } = useContentStore()
const activeTab = ref('takvim')
onMounted(load)
</script>

<template>
  <div class="page-wrap">
    <PageHeader
      eyebrow="YAYIN"
      title="İçerik"
      description="Sosyal medya ve blog takvimi: etkinliği platformu, metni ve indirilebilir ekleriyle planla, yayın sonrası metriklerle izle."
    >
      <Button label="Yenile" icon="pi pi-refresh" outlined :loading="state.loading" @click="load" />
    </PageHeader>

    <div v-if="state.loading && !payload.live" class="seo-loading"><i class="pi pi-spin pi-spinner" /> İçerik takvimi yükleniyor…</div>

    <AdminPlaceholder
      v-else-if="!payload.live"
      icon="pi pi-megaphone"
      title="İçerik takvimi getirilemedi"
      description="İçerik verisi şu an alınamadı. Oturumunun açık ve bağlantının aktif olduğundan emin olup yeniden dene."
      retryable
      :loading="state.loading"
      @retry="load"
    />

    <template v-else>
      <div v-if="!payload.dbConnected" class="db-banner">
        <i class="pi pi-database" />
        <span>Veritabanı bağlı değil; içerik takvimi salt-okunur. Kaydetme kapalı.</span>
      </div>

      <Tabs v-model:value="activeTab" class="seo-tabs">
        <TabList>
          <Tab value="takvim">Takvim</Tab>
          <Tab value="plan">Plan</Tab>
          <Tab value="analitik">Analitik</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="takvim"><CalendarTab /></TabPanel>
          <TabPanel value="plan"><PlanTab /></TabPanel>
          <TabPanel value="analitik"><AnalyticsTab /></TabPanel>
        </TabPanels>
      </Tabs>

      <!-- Düzenleyici tek yerde: Takvim ve Plan aynı diyaloğu açar (shared.ts > openEditor). -->
      <EventDialog />
    </template>
  </div>
</template>

<script lang="ts">
export default { name: 'ContentView' }
</script>
