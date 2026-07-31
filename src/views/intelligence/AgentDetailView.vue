<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Tag from 'primevue/tag'
import EmptyState from '../../components/EmptyState.vue'
import OverviewPanel from './panels/OverviewPanel.vue'
import PromptPanel from './panels/PromptPanel.vue'
import KnowledgePanel from './panels/KnowledgePanel.vue'
import SimulationPanel from './panels/SimulationPanel.vue'
import SorularTab from './SorularTab.vue'
import { agentById, wiringMeta } from '../../services/intelligence'

const route = useRoute()

const agent = computed(() => agentById(String(route.params.agentId)))
const activeTab = ref('genel')

// Ajan değişince sekme başa dönmeli: "Sorular" yalnız bir ajanda var, orada
// açık bırakılıp başka ajana geçilirse boş bir panelde kalınırdı.
watch(() => route.params.agentId, () => { activeTab.value = 'genel' })

const severity = computed(() => {
  if (!agent.value) return 'info'
  const s = wiringMeta[agent.value.wiring].severity
  return s === 'success' ? 'success' : s === 'warn' ? 'warn' : 'info'
})
</script>

<template>
  <div class="page-wrap">
    <RouterLink class="back-link" :to="{ name: 'intelligence' }">
      <i class="pi pi-arrow-left" /> Zeka merkezi
    </RouterLink>

    <EmptyState
      v-if="!agent"
      icon="pi pi-question-circle"
      title="Ajan bulunamadı"
      description="Bu kimlikte bir ajan kayıtlı değil. Zeka merkezinden listeye dönebilirsin."
    />

    <template v-else>
      <header class="agent-hero">
        <div class="hero-glyph"><i class="pi pi-sparkles" /></div>
        <div class="hero-copy">
          <div class="hero-title">
            <h1>{{ agent.label }}</h1>
            <Tag :value="wiringMeta[agent.wiring].label" :severity="severity" />
          </div>
          <code class="hero-name">{{ agent.name }}</code>
          <p class="hero-purpose">{{ agent.purpose }}</p>
        </div>
      </header>

      <p class="hero-note" :class="agent.wiring">
        <i :class="agent.wiring === 'live' ? 'pi pi-check-circle' : 'pi pi-info-circle'" />
        {{ agent.wiringNote }}
      </p>

      <Tabs v-model:value="activeTab" class="seo-tabs">
        <TabList>
          <Tab value="genel">Genel bakış</Tab>
          <Tab value="prompt">Sistem promptu</Tab>
          <Tab value="bilgi">Bilgi tabanı</Tab>
          <Tab value="sim">Simülasyon</Tab>
          <Tab v-if="agent.id === 'afi-bilgi-sofrasi'" value="sorular">Sorular</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="genel"><OverviewPanel v-if="activeTab === 'genel'" :agent="agent" /></TabPanel>
          <TabPanel value="prompt"><PromptPanel v-if="activeTab === 'prompt'" :agent="agent" /></TabPanel>
          <TabPanel value="bilgi"><KnowledgePanel v-if="activeTab === 'bilgi'" :agent="agent" /></TabPanel>
          <TabPanel value="sim"><SimulationPanel v-if="activeTab === 'sim'" :agent="agent" /></TabPanel>
          <TabPanel v-if="agent.id === 'afi-bilgi-sofrasi'" value="sorular">
            <SorularTab v-if="activeTab === 'sorular'" />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </template>
  </div>
</template>

<style scoped>
.agent-hero { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 16px; margin: 18px 0 14px; }
.hero-glyph {
  width: 56px; height: 56px; display: grid; place-items: center;
  border-radius: 18px 18px 18px 6px; background: #dff0e7; color: var(--green-dark); font-size: 24px;
}
.hero-copy { min-width: 0; }
.hero-title { display: flex; flex-wrap: wrap; gap: 11px; align-items: center; }
.hero-title h1 { margin: 0; font-size: 27px; letter-spacing: -.03em; }
.hero-name { display: block; margin-top: 5px; color: var(--muted); font-size: 12px; }
.hero-purpose { margin: 9px 0 0; max-width: 78ch; color: #5b6159; font-size: 13.5px; line-height: 1.55; }

.hero-note {
  display: flex; gap: 9px; align-items: flex-start;
  margin: 0 0 22px; padding: 11px 14px; border-radius: 12px;
  font-size: 12.5px; line-height: 1.55;
}
.hero-note i { margin-top: 2px; font-size: 12px; }
.hero-note.live { background: #eef8f2; color: #2c5a48; }
.hero-note.live i { color: var(--green); }
.hero-note.partial { background: #fdf7e8; color: #6b5a34; }
.hero-note.partial i { color: var(--amber); }
.hero-note.unwired { background: #f2f0ea; color: #63665e; }
.hero-note.unwired i { color: var(--muted); }
</style>
