<script setup lang="ts">
import { ref } from 'vue'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import PageHeader from '../../components/PageHeader.vue'
import SorularTab from './SorularTab.vue'
import KbTab from './KbTab.vue'
import TazelemeTab from './TazelemeTab.vue'

// Sekme içerikleri v-if ile bağlanıyor: açılmayan sekme hiç mount olmuyor,
// dolayısıyla isteğini de atmıyor. Üç sekmenin üçü birden yüklenirse sayfa
// açılışında yedi ağ çağrısı olurdu.
const activeTab = ref('sorular')
</script>

<template>
  <div class="page-wrap">
    <PageHeader
      eyebrow="ASİSTAN"
      title="Afi’ye sor"
      description="Ziyaretçiler landing sayfasında ne soruyor, neyi cevaplayamadık, ve Afi’nin dayandığı bilgi tabanında ne var."
    />

    <Tabs v-model:value="activeTab" class="seo-tabs">
      <TabList>
        <Tab value="sorular">Sorular</Tab>
        <Tab value="bilgi">Bilgi tabanı</Tab>
        <Tab value="tazeleme">Tazeleme</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="sorular"><SorularTab v-if="activeTab === 'sorular'" /></TabPanel>
        <TabPanel value="bilgi"><KbTab v-if="activeTab === 'bilgi'" /></TabPanel>
        <TabPanel value="tazeleme"><TazelemeTab v-if="activeTab === 'tazeleme'" /></TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>
