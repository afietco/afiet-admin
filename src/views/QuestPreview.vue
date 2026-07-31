<script setup lang="ts">
import { computed } from 'vue'
import type { QuestInput } from '../services/admin'
import { effectiveAction, questTargetHint } from '../services/questActions'

/**
 * Görev detayının mobildeki karşılığının kaba önizlemesi.
 *
 * Bire bir taklit değil, karar önizlemesi: anlatım metninin uzunluğu, düğme
 * etiketinin sığıp sığmadığı ve hedefin ne olduğu tek bakışta görünsün diye
 * duruyor. Gerçek sahne afiet-mobile/src/features/progress/QuestDetailSheet.tsx.
 */
const props = defineProps<{ form: QuestInput }>()

const action = computed(() => effectiveAction(props.form))
const narration = computed(() => props.form.narration.trim() || props.form.detail.trim() || 'Anlatım yazılmadı; uygulamada açıklama gösterilir.')
</script>

<template>
  <div class="quest-preview">
    <div class="preview-phone">
      <div class="preview-grip" />
      <div class="preview-afi">{{ form.emoji || '🌱' }}</div>
      <strong class="preview-title">{{ form.title || 'Görev başlığı' }}</strong>
      <p class="preview-narration">{{ narration }}</p>
      <div class="preview-counter">
        <span>0 / {{ form.target }}</span>
        <div class="preview-track"><div class="preview-fill" /></div>
      </div>
      <button v-if="action" type="button" class="preview-action" disabled>{{ action.label }}</button>
      <p v-else class="preview-noaction">Bu metrik için eylem düğmesi yok.</p>
    </div>
    <p v-if="action" class="preview-hint">
      <i class="pi" :class="action.custom ? 'pi-pencil' : 'pi-sparkles'" />
      {{ action.custom ? 'Panelden yazıldı' : 'Metrik ailesinin varsayılanı' }} · {{ questTargetHint(action.target) }}
    </p>
  </div>
</template>
