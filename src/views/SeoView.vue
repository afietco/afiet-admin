<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import PageHeader from '../components/PageHeader.vue'
import GeneralTab from './seo/GeneralTab.vue'
import PagesTab from './seo/PagesTab.vue'
import SchemaFaqTab from './seo/SchemaFaqTab.vue'
import RobotsTab from './seo/RobotsTab.vue'
import LlmsTab from './seo/LlmsTab.vue'
import RedirectsTab from './seo/RedirectsTab.vue'
import { webApi, type AdminSeoPayload } from '../services/webApi'

const payload = ref<AdminSeoPayload | null>(null)
const loading = ref(true)
const error = ref('')
const activeTab = ref('genel')

async function load() {
  loading.value = true
  error.value = ''
  try {
    payload.value = await webApi.get()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'SEO ayarları alınamadı.'
  } finally {
    loading.value = false
  }
}

function onSaved(p: AdminSeoPayload) {
  payload.value = p
}

const overriddenSettings = computed(() => new Set(payload.value ? Object.keys(payload.value.overrides.settings) : []))
const pagesOverridden = computed(() => !!payload.value && Object.keys(payload.value.overrides.pages).length > 0)
const redirectsOverridden = computed(() => !!payload.value && payload.value.overrides.redirects.length > 0)

onMounted(load)
</script>

<template>
  <div class="page-wrap">
    <PageHeader eyebrow="GÖRÜNÜRLÜK" title="SEO & GEO" description="afiet.co'nun arama motoru ve yapay zeka görünürlüğünü buradan yönet. Değişiklikler siteye en geç 1 dakikada yansır.">
      <Button label="Yenile" icon="pi pi-refresh" outlined :loading="loading" @click="load" />
    </PageHeader>

    <div v-if="error" class="error-banner"><i class="pi pi-exclamation-circle" /><span>{{ error }}</span><button @click="load">Tekrar dene</button></div>

    <div v-if="loading && !payload" class="seo-loading"><i class="pi pi-spin pi-spinner" /> Ayarlar yükleniyor…</div>

    <template v-if="payload">
      <div v-if="!payload.dbConnected" class="db-banner">
        <i class="pi pi-database" />
        <span>Veritabanı bağlı değil — ayarlar salt-okunur (kod varsayılanları gösteriliyor). Kaydetme kapalı.</span>
      </div>

      <Tabs v-model:value="activeTab" class="seo-tabs">
        <TabList>
          <Tab value="genel">Genel <span v-if="overriddenSettings.has('general')" class="seo-dot" /></Tab>
          <Tab value="sayfalar">Sayfalar <span v-if="pagesOverridden" class="seo-dot" /></Tab>
          <Tab value="yapisal">Yapısal veri &amp; SSS <span v-if="overriddenSettings.has('schema') || overriddenSettings.has('faq')" class="seo-dot" /></Tab>
          <Tab value="robots">Robots &amp; AI <span v-if="overriddenSettings.has('robots')" class="seo-dot" /></Tab>
          <Tab value="llms">llms.txt <span v-if="overriddenSettings.has('llms')" class="seo-dot" /></Tab>
          <Tab value="yonlendirme">Yönlendirmeler <span v-if="redirectsOverridden" class="seo-dot" /></Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="genel"><GeneralTab :payload="payload" @saved="onSaved" /></TabPanel>
          <TabPanel value="sayfalar"><PagesTab :payload="payload" @saved="onSaved" /></TabPanel>
          <TabPanel value="yapisal"><SchemaFaqTab :payload="payload" @saved="onSaved" /></TabPanel>
          <TabPanel value="robots"><RobotsTab :payload="payload" @saved="onSaved" /></TabPanel>
          <TabPanel value="llms"><LlmsTab :payload="payload" @saved="onSaved" /></TabPanel>
          <TabPanel value="yonlendirme"><RedirectsTab :payload="payload" @saved="onSaved" /></TabPanel>
        </TabPanels>
      </Tabs>
    </template>
  </div>
</template>
