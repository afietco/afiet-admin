<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import PageHeader from '../../components/PageHeader.vue'
import AdminPlaceholder from '../../components/AdminPlaceholder.vue'
import OverviewTab from './OverviewTab.vue'
import PagesTab from './PagesTab.vue'
import BlogTab from './BlogTab.vue'
import SourcesTab from './SourcesTab.vue'
import AudienceTab from './AudienceTab.vue'
import SeoTab from './SeoTab.vue'
import { RANGES, type Range } from '../../services/analytics'
import { useAnalyticsStore } from './shared'

const { state, data, load, setRange } = useAnalyticsStore()
const activeTab = ref('genel')
const rangeOptions = RANGES.map((r) => ({ value: r.value, label: r.label }))
const rangeModel = computed<Range>({ get: () => state.range, set: (v) => setRange(v) })
const onAnalyticsTab = computed(() => activeTab.value !== 'seo')

onMounted(load)
</script>

<template>
  <div class="page-wrap">
    <PageHeader eyebrow="GÖRÜNÜRLÜK · ANALİTİK" title="Analitik" description="afiet.co'nun kendi topladığı web analitiği: trafik, sayfalar, blog ve ziyaretçilerin nereden geldiği. Kişi-bazlı gözetleme yok.">
      <template v-if="onAnalyticsTab">
        <SelectButton v-model="rangeModel" :options="rangeOptions" option-label="label" option-value="value" :allow-empty="false" aria-label="Zaman aralığı" />
        <Button label="Yenile" icon="pi pi-refresh" outlined :loading="state.loading" @click="load" />
      </template>
    </PageHeader>

    <Tabs v-model:value="activeTab" class="seo-tabs analytics-tabs">
      <TabList>
        <Tab value="genel">Genel bakış</Tab>
        <Tab value="sayfalar">Sayfalar</Tab>
        <Tab value="blog">Blog</Tab>
        <Tab value="kaynaklar">Kaynaklar</Tab>
        <Tab value="kitle">Kitle</Tab>
        <Tab value="seo">SEO &amp; GEO</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="genel"><OverviewTab v-if="data" :data="data" /><template v-else><div v-if="state.loading" class="seo-loading"><i class="pi pi-spin pi-spinner" /> Analitik yükleniyor…</div><AdminPlaceholder v-else icon="pi pi-chart-bar" title="Analitik verisi getirilemedi" description="Veri şu an alınamadı. Bağlantını kontrol edip yeniden dene." retryable :loading="state.loading" @retry="load" /></template></TabPanel>
        <TabPanel value="sayfalar"><PagesTab v-if="data" :data="data" /><AdminPlaceholder v-else icon="pi pi-compass" title="Analitik verisi getirilemedi" description="Veri şu an alınamadı. Bağlantını kontrol edip yeniden dene." retryable :loading="state.loading" @retry="load" /></TabPanel>
        <TabPanel value="blog"><BlogTab v-if="data" :data="data" /><AdminPlaceholder v-else icon="pi pi-file-edit" title="Analitik verisi getirilemedi" description="Veri şu an alınamadı. Bağlantını kontrol edip yeniden dene." retryable :loading="state.loading" @retry="load" /></TabPanel>
        <TabPanel value="kaynaklar"><SourcesTab v-if="data" :data="data" /><AdminPlaceholder v-else icon="pi pi-directions" title="Analitik verisi getirilemedi" description="Veri şu an alınamadı. Bağlantını kontrol edip yeniden dene." retryable :loading="state.loading" @retry="load" /></TabPanel>
        <TabPanel value="kitle"><AudienceTab v-if="data" :data="data" /><AdminPlaceholder v-else icon="pi pi-users" title="Analitik verisi getirilemedi" description="Veri şu an alınamadı. Bağlantını kontrol edip yeniden dene." retryable :loading="state.loading" @retry="load" /></TabPanel>
        <TabPanel value="seo"><SeoTab /></TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>

<script lang="ts">
export default { name: 'AnalyticsView' }
</script>
