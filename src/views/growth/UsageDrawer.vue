<script setup lang="ts">
import Drawer from 'primevue/drawer'

/**
 * Büyüme sayfasının "devamını gör" paneli. Sayfada yalnız ilk birkaç satır
 * durur; tam liste buraya açılır. Tek bir bileşen üç listeye de (ekran, alt
 * sayfa, dokunuş) ve event detayına hizmet eder, çünkü hepsi aynı şekli
 * taşıyor: ad, sayı, isteğe bağlı yan bilgi ve bir doluluk çubuğu.
 */
export type DrawerRow = { key: string; label: string; value: string; side?: string; ratio: number }

defineProps<{
  title: string
  eyebrow: string
  rows: DrawerRow[]
  tone: 'green' | 'blue' | 'amber'
  note?: string
}>()

const visible = defineModel<boolean>('visible', { required: true })
</script>

<template>
  <Drawer v-model:visible="visible" position="right" class="food-drawer" :style="{ width: '34rem' }">
    <template #header>
      <div class="drawer-head">
        <div>
          <p class="dw-eyebrow">{{ eyebrow }}</p>
          <strong>{{ title }}</strong>
          <small>{{ rows.length }} satır</small>
        </div>
      </div>
    </template>

    <ul class="src-list tight telemetry">
      <li v-for="row in rows" :key="row.key">
        <div class="src-row">
          <span class="src-name" :title="row.key">{{ row.label }}</span>
          <span class="src-val">{{ row.value }}<template v-if="row.side"> · {{ row.side }}</template></span>
        </div>
        <div class="mini-track"><div class="mini-fill" :class="tone" :style="{ width: `${row.ratio}%` }" /></div>
      </li>
    </ul>

    <p v-if="note" class="note-line subtle"><i class="pi pi-info-circle" /> {{ note }}</p>
  </Drawer>
</template>

<style scoped>
.dw-eyebrow { margin: 0 0 2px; color: var(--green); font-size: 9px; font-weight: 950; letter-spacing: .14em; }
.drawer-head strong { display: block; font-size: 15px; }
.drawer-head small { display: block; margin-top: 2px; color: var(--muted); font-size: 11.5px; }
</style>
