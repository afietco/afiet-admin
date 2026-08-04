<script setup lang="ts">
import { ref } from 'vue'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import PageHeader from '../../components/PageHeader.vue'
import AgentsTab from './AgentsTab.vue'
import IndexesTab from './IndexesTab.vue'
import MaliyetTab from './MaliyetTab.vue'
import TazelemeTab from './TazelemeTab.vue'

// Sekmeler v-if ile bağlı: açılmayan sekme mount olmuyor, isteğini de atmıyor.
// Aynı karar eski Afi sayfasında da verilmişti, üç sekme birden yüklenince
// sayfa açılışı yedi ağ çağrısına çıkıyordu.
const activeTab = ref('ajanlar')
</script>

<template>
  <div class="page-wrap">
    <PageHeader
      eyebrow="ZEKA MERKEZİ"
      title="Ajanlar ve bilgi tabanları"
      description="Kurduğumuz altı ajan, bağlı oldukları bilgi tabanları ve tazeleme koşuları tek yerde. Her ajanın kendi sayfasında promptu, ayarları ve uygulamadaki kullanımının simülasyonu var."
    />

    <Tabs v-model:value="activeTab" class="seo-tabs">
      <TabList>
        <Tab value="ajanlar">Ajanlar</Tab>
        <Tab value="bilgi">Bilgi tabanları</Tab>
        <Tab value="maliyet">Maliyet</Tab>
        <Tab value="tazeleme">Tazeleme</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="ajanlar"><AgentsTab v-if="activeTab === 'ajanlar'" /></TabPanel>
        <TabPanel value="bilgi"><IndexesTab v-if="activeTab === 'bilgi'" /></TabPanel>
        <TabPanel value="maliyet"><MaliyetTab v-if="activeTab === 'maliyet'" /></TabPanel>
        <TabPanel value="tazeleme"><TazelemeTab v-if="activeTab === 'tazeleme'" /></TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>
