<script setup lang="ts">
import { computed } from 'vue'
import { CANDIDATE_STATUS_LABELS, type CustomFoodCandidate } from '../../services/foodCuration'
import { decimal, measureLabel, number } from '../../services/foodLabels'

const props = defineProps<{ candidate: CustomFoodCandidate }>()
defineEmits<{ (e: 'open'): void }>()

/**
 * Kullanıcıların girdiği enerji ne kadar dağınık. Dar aralık "herkes aynı şeyi
 * kastediyor" der; geniş aralık adın birden çok yemeği topladığını gösterir ve
 * o ad kataloğa TEK kayıt olarak alınamaz.
 */
const spread = computed(() => {
  const macros = props.candidate.macros
  if (!macros || !macros.kcal.median) return null
  const range = macros.kcal.max - macros.kcal.min
  return { ratio: Math.min(range / macros.kcal.median, 1), range }
})

const match = computed(() => {
  const exact = props.candidate.matches.find((item) => item.kind === 'ad')
  if (exact) return { text: 'Katalogda aynı ad var', tone: 'hard' as const, name: exact.name }
  const alias = props.candidate.matches.find((item) => item.kind === 'takma_ad')
  if (alias) return { text: 'Takma ad çakışması', tone: 'hard' as const, name: alias.name }
  const near = props.candidate.matches[0]
  if (near) return { text: 'Benzer kayıt', tone: 'soft' as const, name: near.name }
  return null
})

const status = computed(() => props.candidate.decision?.status ?? 'bekliyor')
</script>

<template>
  <button type="button" class="candidate-card" :class="status" @click="$emit('open')">
    <header>
      <div class="candidate-ident">
        <strong>{{ candidate.name }}</strong>
        <small>
          <template v-if="candidate.measure">
            {{ measureLabel(candidate.measure) }} ölçüsü
            <template v-if="candidate.measureAgreement < 1">
              (%{{ Math.round(candidate.measureAgreement * 100) }} uzlaşma)
            </template>
          </template>
          <template v-else>ölçü yok</template>
          <template v-if="candidate.variants.length > 1"> · {{ candidate.variants.length }} yazım</template>
        </small>
      </div>
      <span v-if="status !== 'bekliyor'" class="candidate-status" :class="status">
        {{ CANDIDATE_STATUS_LABELS[status] }}
      </span>
    </header>

    <div class="candidate-metrics">
      <div>
        <strong>{{ number(candidate.userCount) }}</strong>
        <small>kullanıcı</small>
      </div>
      <div>
        <strong>{{ number(candidate.entryCount) }}</strong>
        <small>öğün kaydı</small>
      </div>
      <div>
        <strong v-if="candidate.macros">{{ decimal(candidate.macros.kcal.median) }}</strong>
        <strong v-else class="none">-</strong>
        <small>kcal ortanca</small>
      </div>
    </div>

    <p v-if="spread" class="candidate-spread">
      <span class="spread-track">
        <span class="spread-fill" :class="{ wide: spread.ratio > 0.5 }" :style="{ inlineSize: `${Math.max(spread.ratio * 100, 3)}%` }" />
      </span>
      <span class="spread-text">
        <template v-if="spread.ratio > 0.5">değerler dağınık, aralık {{ decimal(spread.range) }} kcal</template>
        <template v-else>değerler tutarlı</template>
      </span>
    </p>
    <p v-else class="candidate-spread muted">Makro girilmemiş</p>

    <footer>
      <span v-if="match" class="candidate-match" :class="match.tone">
        <i class="pi pi-link" aria-hidden="true" />
        {{ match.text }}: {{ match.name }}
      </span>
      <span v-else class="candidate-match new">
        <i class="pi pi-sparkles" aria-hidden="true" />
        Katalogda karşılığı yok
      </span>
    </footer>
  </button>
</template>

<style scoped>
.candidate-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 15px 16px 14px;
  border: 1px solid var(--line);
  border-radius: 17px;
  background: var(--paper);
  box-shadow: 0 4px 16px rgba(50, 50, 40, .03);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform .16s cubic-bezier(.22, 1, .36, 1), box-shadow .16s, border-color .16s;
}
.candidate-card:hover { transform: translateY(-2px); border-color: #cfe4d8; box-shadow: 0 14px 30px rgba(40, 60, 50, .09); }
.candidate-card:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }
.candidate-card.kabul { border-color: #cbe8d9; background: #f6fbf8; }
.candidate-card.red { opacity: .72; }
.candidate-card.birlesik { border-color: #d8e4ea; background: #f8fafb; }

.candidate-card > header { display: flex; gap: 10px; align-items: flex-start; }
.candidate-ident { min-width: 0; flex: 1; }
.candidate-ident strong {
  display: block; overflow: hidden;
  color: #2c332e; font-size: 13px; font-weight: 850; letter-spacing: -.015em;
  text-overflow: ellipsis; white-space: nowrap;
}
.candidate-ident small { display: block; margin-top: 2px; color: #8d9087; font-size: 9px; font-weight: 750; }
.candidate-status {
  flex: 0 0 auto; padding: 3px 7px; border-radius: 6px;
  font-size: 8px; font-weight: 900; letter-spacing: .03em;
}
.candidate-status.kabul { color: #14664d; background: #d9f0e4; }
.candidate-status.red { color: #8d2f24; background: #f6e0dc; }
.candidate-status.birlesik { color: #3f6472; background: #e2edf1; }

.candidate-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.candidate-metrics strong {
  display: block; color: #2c332e; font-size: 18px; font-weight: 850;
  letter-spacing: -.04em; line-height: 1; font-variant-numeric: tabular-nums;
}
.candidate-metrics strong.none { color: #b4b6ad; }
.candidate-metrics small { display: block; margin-top: 3px; color: #9a9c93; font-size: 9px; font-weight: 750; }

.candidate-spread { display: grid; gap: 5px; margin: 0; }
.candidate-spread.muted { color: #a3a59c; font-size: 9px; font-style: italic; }
.spread-track { height: 5px; border-radius: 3px; background: #ece6d8; overflow: hidden; }
.spread-fill { display: block; height: 100%; border-radius: 3px; background: #8dc9ae; }
.spread-fill.wide { background: var(--amber); }
.spread-text { color: #7d8078; font-size: 9px; font-weight: 750; }

.candidate-card > footer { margin-top: auto; }
.candidate-match {
  display: inline-flex; gap: 5px; align-items: center;
  padding: 3px 8px; border-radius: 7px;
  font-size: 9px; font-weight: 800;
}
.candidate-match i { font-size: 9px; }
.candidate-match.hard { color: #8a6512; background: #f8ebd0; }
.candidate-match.soft { color: #3f6472; background: #e4eef1; }
.candidate-match.new { color: #1c6a4e; background: #e7f4ed; }
</style>
