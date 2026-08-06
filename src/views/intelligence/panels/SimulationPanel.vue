<script setup lang="ts">
import { computed } from 'vue'
import SimFoodSuggest from '../sims/SimFoodSuggest.vue'
import SimPhotoChat from '../sims/SimPhotoChat.vue'
import SimAsk from '../sims/SimAsk.vue'
import SimChat from '../sims/SimChat.vue'
import type { AgentView } from '../../../services/intelligence'

const props = defineProps<{ agent: AgentView }>()

/**
 * Simülasyon ürünün KENDİ yolunu koşar: sunucu tarafında aynı Suggester /
 * VisionAssistant / Asker örnekleri çağrılıyor, ayrı bir "panel sürümü" yok.
 * Tek fark kullanıcı kotasına yazmaması.
 *
 * Hangi simülasyonun koşacağı sunucudan gelir (simKind); panel kendi
 * tahminini kullanmaz ki envanter değişince ekran sessizce yanlış akışı
 * göstermesin.
 */
const kind = computed(() => props.agent.live?.simKind ?? null)
const agentName = computed(() => props.agent.live?.name ?? props.agent.id)
const version = computed(() => props.agent.live?.version ?? '')
</script>

<template>
  <section class="sim-panel">
    <div class="sim-banner">
      <span class="live-pill">CANLI</span>
      <p>
        Bu simülasyon <strong>gerçek ajanı çağırır</strong> ve ürünün kendi kod yolundan geçer.
        Kullanıcı kotasına yazmaz ama sağlayıcı maliyeti gerçektir; yönetici başına günde 200 tur
        sınırı var.
      </p>
    </div>

    <SimFoodSuggest v-if="kind === 'food-suggest'" :agent-name="agentName" :version="version" />
    <SimPhotoChat v-else-if="kind === 'photo-chat'" :agent-name="agentName" :version="version" />
    <SimAsk v-else-if="kind === 'ask'" :agent-name="agentName" :version="version" />
    <SimChat v-else-if="kind === 'chat'" :agent="agent" :agent-name="agentName" :version="version" />
    <p v-else class="sim-unknown">
      Simülasyon türü sunucudan okunamadı. Ajan tanımı alınamamışsa bu alan boş kalır.
    </p>
  </section>
</template>

<style scoped>
.sim-panel { display: grid; gap: 18px; padding: 24px; }
.sim-banner {
  display: flex; gap: 12px; align-items: flex-start;
  padding: 12px 15px; border: 1px solid #cfe4d7; border-radius: 13px; background: #eef8f2;
}
.live-pill {
  flex: none; padding: 3px 9px; border-radius: 6px; background: var(--green);
  color: #fff; font-size: 10px; font-weight: 900; letter-spacing: .08em;
}
.sim-banner p { margin: 0; max-width: 92ch; color: #2c5a48; font-size: 12.5px; line-height: 1.55; }
.sim-unknown { margin: 0; color: #a3a59c; font-size: 12.5px; font-style: italic; }
</style>
