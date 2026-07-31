<script setup lang="ts">
/**
 * Simülasyonların çerçevesi. Amaç ekranı "panelde bir kart" gibi değil,
 * kullanıcının gördüğü yüzey gibi göstermek: mobil ajanlarda telefon sheet'i,
 * web ajanında site kartı.
 */
defineProps<{ surface: 'mobile' | 'web'; title: string; caption: string }>()
</script>

<template>
  <figure class="frame" :class="surface">
    <figcaption class="frame-cap">
      <i :class="surface === 'mobile' ? 'pi pi-mobile' : 'pi pi-desktop'" />
      <strong>{{ title }}</strong>
      <span>{{ caption }}</span>
    </figcaption>
    <div class="frame-body">
      <div v-if="surface === 'mobile'" class="grip" />
      <slot />
    </div>
  </figure>
</template>

<style scoped>
.frame { margin: 0; }
.frame-cap { display: flex; gap: 8px; align-items: baseline; margin-bottom: 9px; }
.frame-cap i { color: var(--green); font-size: 11px; }
.frame-cap strong { color: var(--ink); font-size: 12px; }
.frame-cap span { color: var(--muted); font-size: 11.5px; }

.frame-body { padding: 18px; border: 1px solid var(--line); background: var(--paper); }
/* Mobil sheet alttan gelir: üst köşeler yuvarlak, alt köşeler değil. */
.mobile .frame-body { border-radius: 22px 22px 14px 14px; box-shadow: 0 12px 30px rgba(50, 50, 40, .07); }
.web .frame-body { border-radius: 22px; box-shadow: 0 12px 30px rgba(50, 50, 40, .07); }
.grip { width: 42px; height: 4px; margin: 0 auto 16px; border-radius: 999px; background: #e2ddd0; }
</style>
