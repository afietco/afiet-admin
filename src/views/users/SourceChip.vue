<script setup lang="ts">
import type { Provenance } from '../../services/users'

/**
 * Bölümün verisi nereden geldi.
 *
 * Faz 1'de kullanıcı detayının çoğu bölümü demo üreticiden besleniyor. Rozet
 * her bölümün başında durur ki ekranda görünen bir sayı yanlışlıkla gerçek
 * sanılmasın; uç açılınca rozet kendiliğinden "canlı"ya döner.
 */
defineProps<{ source: Provenance }>()
</script>

<template>
  <span class="source-chip" :class="source">
    <i :class="source === 'live' ? 'pi pi-circle-fill' : 'pi pi-eye'" />
    {{ source === 'live' ? 'canlı veri' : 'demo veri' }}
  </span>
</template>
