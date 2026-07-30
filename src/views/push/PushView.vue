<script setup lang="ts">
import { nextTick, ref } from 'vue'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import PageHeader from '../../components/PageHeader.vue'
import GonderTab from './GonderTab.vue'
import AktifTab from './AktifTab.vue'
import GecmisTab from './GecmisTab.vue'

// Sekme içerikleri v-if ile bağlanıyor: açılmayan sekme hiç mount olmuyor,
// dolayısıyla isteğini de atmıyor. Afi ve SEO panelleri de aynı deyimi
// kullanıyor.
const activeTab = ref('gonder')

const gecmis = ref<InstanceType<typeof GecmisTab> | null>(null)

/** Gönderim sonrası açık olan liste bayat kalmasın. */
async function onSent() {
  activeTab.value = 'gecmis'
  await nextTick()
  gecmis.value?.load()
}

function goCompose() {
  activeTab.value = 'gonder'
}
</script>

<template>
  <div class="page-wrap">
    <PageHeader
      eyebrow="İLETİŞİM"
      title="Bildirimler"
      description="Elle duyuru gönder, uygulamanın kendi ürettiği tetikleyicileri yönet, gönderilenlerin ne olduğunu gör."
    />

    <Tabs v-model:value="activeTab" class="seo-tabs">
      <TabList>
        <Tab value="gonder">Bildirim gönder</Tab>
        <Tab value="aktif">Aktif bildirimler</Tab>
        <Tab value="gecmis">Bildirim geçmişi</Tab>
      </TabList>
      <TabPanels>
        <TabPanel value="gonder">
          <GonderTab v-if="activeTab === 'gonder'" @sent="onSent" />
        </TabPanel>
        <TabPanel value="aktif">
          <AktifTab v-if="activeTab === 'aktif'" @compose="goCompose" />
        </TabPanel>
        <TabPanel value="gecmis">
          <GecmisTab v-if="activeTab === 'gecmis'" ref="gecmis" />
        </TabPanel>
      </TabPanels>
    </Tabs>
  </div>
</template>
