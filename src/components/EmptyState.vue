<script setup lang="ts">
defineProps<{ icon: string; title: string; description: string }>()
</script>

<template>
  <div class="empty-state">
    <div class="empty-icon"><i :class="icon" /></div>
    <strong>{{ title }}</strong>
    <p>{{ description }}</p>
  </div>
</template>
