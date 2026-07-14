<script setup lang="ts">
import Button from 'primevue/button'
import { formatWhen } from './shared'

const props = defineProps<{
  dirty: boolean
  saving: boolean
  hasOverride: boolean
  updatedAt: string
  dbConnected: boolean
}>()
defineEmits<{ save: []; reset: [] }>()
</script>

<template>
  <div class="section-footer">
    <div class="section-status">
      <template v-if="props.hasOverride">
        <span class="seo-dot" />
        <span>Özelleştirildi<template v-if="formatWhen(props.updatedAt)"> · {{ formatWhen(props.updatedAt) }}</template></span>
      </template>
      <span v-else class="muted-status">Kod varsayılanı kullanılıyor</span>
      <span v-if="props.dirty" class="dirty-flag"><i class="pi pi-circle-fill" /> Kaydedilmemiş değişiklik</span>
    </div>
    <div class="section-buttons">
      <Button label="Varsayılana dön" icon="pi pi-history" severity="secondary" outlined :disabled="!props.hasOverride || !props.dbConnected" @click="$emit('reset')" />
      <Button label="Kaydet" icon="pi pi-check" :loading="props.saving" :disabled="!props.dbConnected" @click="$emit('save')" />
    </div>
  </div>
</template>
