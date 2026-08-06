<script setup lang="ts">
import MultiSelect from 'primevue/multiselect'
import { CHANNELS } from './shared'
import type { Channel } from '../../services/content'

/**
 * Platform filtresi. Eskiden yan yana duran düğme sırasıydı; müdahil olduğumuz
 * platform sayısı arttıkça araç çubuğunu taşırıyordu. Artık tek bir kompakt
 * açılır liste ve çoklu seçim: "Instagram + TikTok"u birlikte görmek mümkün.
 *
 * BOŞ SEÇİM "hepsi" demektir. Ayrı bir 'hepsi' anahtarı tutmuyoruz; tek bir
 * kural (`!channels.length || channels.includes(...)`) iki sekmede de aynı.
 */
const channels = defineModel<Channel[]>({ required: true })
</script>

<template>
  <MultiSelect
    v-model="channels"
    :options="CHANNELS"
    option-label="label"
    option-value="value"
    placeholder="Tüm platformlar"
    :max-selected-labels="2"
    selected-items-label="{0} platform"
    :show-toggle-all="false"
    class="channel-filter"
  >
    <template #option="{ option }">
      <span class="channel-option"><i :class="option.icon" /> {{ option.label }}</span>
    </template>
  </MultiSelect>
</template>

<style scoped>
.channel-filter { min-width: 13rem; }
.channel-option { display: flex; gap: 9px; align-items: center; }
.channel-option i { color: var(--muted); font-size: 13px; }
</style>
