<script setup lang="ts">
import Button from 'primevue/button'

defineProps<{ icon: string; title: string; description: string; loading?: boolean; retryable?: boolean }>()
defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="admin-placeholder">
    <div class="ph-art" aria-hidden="true">
      <span class="ph-ring one" />
      <span class="ph-ring two" />
      <i :class="icon" />
    </div>
    <strong>{{ title }}</strong>
    <p>{{ description }}</p>
    <Button v-if="retryable" label="Tekrar dene" icon="pi pi-refresh" outlined :loading="loading" @click="$emit('retry')" />
    <slot />
  </div>
</template>
