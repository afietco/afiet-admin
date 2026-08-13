<script setup lang="ts">
import { computed } from 'vue'
import type { QuestInput } from '../services/admin'
import { effectiveAction, questTargetHint } from '../services/questActions'
import { TIER_META, pouchLabel, tierLadder } from './quests/questTiers'

/**
 * Görev detayının mobildeki karşılığının kaba önizlemesi.
 *
 * Bire bir taklit değil, karar önizlemesi: anlatım metninin uzunluğu, düğme
 * etiketinin sığıp sığmadığı ve hedefin ne olduğu tek bakışta görünsün diye
 * duruyor. Gerçek sahne afiet-mobile/src/features/progress/QuestDetailSheet.tsx.
 *
 * Kademe merdiveni MOCK: sunucu bugün tek eşik dönüyor, üç porsiyon panelde
 * türetiliyor (views/quests/questTiers.ts). Önizlemenin işi burada da aynı:
 * "Çırak'tan Usta'e giden bu üç satır telefonda sığıyor mu, ödül farkı
 * ilerleme hissi veriyor mu" sorusuna bakılsın diye duruyor.
 */
const props = defineProps<{ form: QuestInput }>()

const action = computed(() => effectiveAction(props.form))
const narration = computed(() => props.form.narration.trim() || props.form.detail.trim() || 'Anlatım yazılmadı; uygulamada açıklama gösterilir.')
const tiers = computed(() => tierLadder(props.form.target, props.form.xpReward))
</script>

<template>
  <div class="quest-preview">
    <div class="preview-phone">
      <div class="preview-grip" />
      <div class="preview-afi">{{ form.emoji || '🌱' }}</div>
      <strong class="preview-title">{{ form.title || 'Görev başlığı' }}</strong>
      <p class="preview-narration">{{ narration }}</p>
      <div class="preview-counter">
        <span>0 / {{ tiers[0].target }}</span>
        <div class="preview-track"><div class="preview-fill" /></div>
      </div>

      <ul class="tier-list">
        <li
          v-for="(tier, index) in tiers"
          :key="tier.key"
          class="tier-line"
          :class="{ current: index === 0 }"
        >
          <span class="tier-dot">{{ TIER_META[tier.key].glyph }}</span>
          <div class="tier-copy">
            <strong>{{ TIER_META[tier.key].label }}</strong>
            <small>{{ tier.target }} tamamlanınca</small>
          </div>
          <div class="tier-gain">
            <span>+{{ tier.xpReward }} XP</span>
            <small>{{ pouchLabel(tier.pouchReward) }}</small>
          </div>
        </li>
      </ul>

      <button v-if="action" type="button" class="preview-action" disabled>{{ action.label }}</button>
      <p v-else class="preview-noaction">Bu metrik için eylem düğmesi yok.</p>
    </div>
    <p v-if="action" class="preview-hint">
      <i class="pi" :class="action.custom ? 'pi-pencil' : 'pi-sparkles'" />
      {{ action.custom ? 'Panelden yazıldı' : 'Metrik ailesinin varsayılanı' }} · {{ questTargetHint(action.target) }}
    </p>
    <p class="preview-hint">
      <i class="pi pi-sort-amount-up" />
      Merdiven yukarıdaki tek eşikten türetiliyor ve kaydedilecek olan da bu.
      İkram kesesi ödülü haftalık Afi sohbeti hakkıdır.
    </p>
  </div>
</template>

<style scoped>
/* Telefon önizlemesindeki kademe merdiveni. Liste sayacın hemen altında
   durur: kullanıcı "şimdi neredeyim" sorusunun cevabını gördükten sonra
   "sırada ne var" sorusunu soruyor. */
.tier-list { display: grid; gap: 6px; margin: 14px 0 0; padding: 0; list-style: none; }
.tier-line {
  display: flex; align-items: center; gap: 9px;
  padding: 8px 10px;
  border: 1px solid #eee9dd; border-radius: 12px; background: #fbfaf5;
}
.tier-line.current { border-color: #bfe3ce; background: #f2faf5; }
.tier-dot {
  width: 24px; height: 24px; flex: 0 0 auto;
  display: grid; place-items: center;
  border-radius: 8px 8px 8px 2px; background: #dff0e7; font-size: 12px; line-height: 1;
}
.tier-copy { min-width: 0; flex: 1; }
.tier-copy strong { display: block; color: #2f342e; font-size: 11px; }
.tier-copy small { display: block; margin-top: 2px; color: #8d9087; font-size: 9px; font-weight: 700; }
.tier-gain { text-align: right; }
.tier-gain span { display: block; color: #2f6b4f; font-size: 10.5px; font-weight: 900; font-variant-numeric: tabular-nums; }
.tier-gain small { display: block; margin-top: 2px; color: #a08348; font-size: 8.5px; font-weight: 800; }
</style>
