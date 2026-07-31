<script setup lang="ts">
import SimFoodSuggest from '../sims/SimFoodSuggest.vue'
import SimPhotoChat from '../sims/SimPhotoChat.vue'
import SimAsk from '../sims/SimAsk.vue'
import SimChat from '../sims/SimChat.vue'
import { MOCK, type Agent } from '../../../services/intelligence'

const props = defineProps<{ agent: Agent }>()

/**
 * Simülasyon, ajanın uygulamadaki kullanımının kopyasıdır: aynı giriş alanları,
 * aynı akış sırası, aynı çıktı yerleşimi. Yanıtlar şu an MOCK; gerçek ajana
 * bağlanınca değişen tek şey servis katmanı olacak.
 */
const kind = props.agent.simKind
</script>

<template>
  <section class="sim-panel">
    <div v-if="MOCK" class="sim-banner">
      <span class="mock-pill">MOCK</span>
      <p>
        Yanıtlar sabit örneklerden geliyor, gerçek ajana istek atılmıyor. Akış, alan adları ve
        yerleşim uygulamadakiyle birebir; değişecek olan yalnız cevabın kaynağı.
      </p>
    </div>

    <SimFoodSuggest v-if="kind === 'food-suggest'" />
    <SimPhotoChat v-else-if="kind === 'photo-chat'" />
    <SimAsk v-else-if="kind === 'ask'" />
    <SimChat v-else :agent="agent" />
  </section>
</template>

<style scoped>
.sim-panel { display: grid; gap: 18px; }
.sim-banner {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 12px 15px; border: 1px solid #e8d9b4; border-radius: 13px; background: #fdf7e8;
}
.mock-pill {
  flex: none; padding: 3px 9px; border-radius: 6px; background: var(--amber);
  color: #fff; font-size: 10px; font-weight: 900; letter-spacing: .08em;
}
.sim-banner p { margin: 0; max-width: 92ch; color: #6b5a34; font-size: 12.5px; line-height: 1.55; }
</style>
