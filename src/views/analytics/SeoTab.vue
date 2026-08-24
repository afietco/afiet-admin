<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import SearchPerfTab from '../seo/SearchPerfTab.vue'
import WeeklyReportTab from '../seo/WeeklyReportTab.vue'

/**
 * SEO & GEO: ÖLÇME ve TAKİP ekranı.
 *
 * Ayar sekmeleri (genel meta, sayfa meta'ları, şema/SSS, robots, llms.txt,
 * yönlendirmeler) 24 Ağustos 2026'da BİLİNÇLİ olarak kaldırıldı: bu değerler
 * kod varsayılanı + DB override modeliyle yaşıyor, panelden neredeyse hiç
 * dokunulmuyordu ve yedi sekmelik bir ekran haftalık raporu görünmez
 * kılıyordu. Değişiklikler artık afiet-web'de kodla yapılır; DB'deki mevcut
 * override'lar yerinde durur (kaldırılan panel onları silmez).
 */

const activeTab = ref('arama')
// Yenile: aktif sekme kendi verisini onMounted'da çeker, remount en ucuz
// yenileme yolu ve iki sekmeye de ayrı buton koymayı gerektirmez.
const nonce = ref(0)
</script>

<template>
  <div class="tab-body">
    <div class="seo-lead">
      <p class="analytics-note">
        <i class="pi pi-globe" /> afiet.co'nun arama motoru ve yapay zeka görünürlüğü: Google'dan gelen ölçüm, nöbetçinin haftalık raporu ve yapılacaklar.
      </p>
      <Button label="Yenile" icon="pi pi-refresh" outlined @click="nonce++" />
    </div>

    <Tabs v-model:value="activeTab" class="seo-tabs">
      <TabList>
        <Tab value="arama">Arama performansı</Tab>
        <Tab value="rapor">Haftalık rapor</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="arama"><SearchPerfTab :key="`arama-${nonce}`" /></TabPanel>
        <TabPanel value="rapor"><WeeklyReportTab :key="`rapor-${nonce}`" /></TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>
