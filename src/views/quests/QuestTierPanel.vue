<script setup lang="ts">
import { computed } from 'vue'
import Tag from 'primevue/tag'
import { effectiveAction, questTargetLabel } from '../../services/questActions'
import type { Quest } from '../../services/admin'
import {
  TIER_META, countLabel, daysLabel, percent, pouchLabel,
} from './questTiers'

/**
 * Görev satırı açıldığında görünen kademe paneli.
 *
 * Üç kademe yan yana durur: aynı metrik, artan eşik, artan ödül. Altında o
 * kademeye kaç kişinin geldiği ve tamamlama oranı yazar. Sayılar 13 Ağu
 * 2026'dan beri GERÇEK (`quest.reach`); mock üreticisi silindi.
 *
 * `reach` null gelirse sayılar çizilmez ama merdivenin kendisi çizilir:
 * eşikler ve ödüller görevin tanımı, huni ise onun ölçümü. Biri okunamadığında
 * diğerini de gizlemek gereksiz.
 */
const props = defineProps<{
  quest: Quest
  metricLabel: string
}>()

const reach = computed(() => props.quest.reach)
/** Huni yoksa merdiven yine çizilir, istatistiksiz. */
const rows = computed(() =>
  reach.value
    ? reach.value.tiers
    : props.quest.tiers.map((tier) => ({ ...tier, stats: null })),
)
const action = computed(() => effectiveAction(props.quest))
/** Huni çubuğu: her kademenin genişliği havuza oranıdır, kademeler daralır. */
const barWidth = (ratio: number) => `${Math.max(2, Math.round(ratio * 100))}%`
</script>

<template>
  <div class="tier-panel">
    <header class="tier-panel-head">
      <div>
        <p class="preview-label">KADEME MERDİVENİ</p>
        <p class="tier-panel-note">
          Üç kademe de aynı sayacı okur; değişen yalnız porsiyon. Bu yüzden eylem düğmesi
          üçünde de aynıdır:
          <template v-if="action">
            <strong>{{ action.label }}</strong> · {{ questTargetLabel(action.target) }}
          </template>
          <template v-else><em>bu metrik için düğme yok.</em></template>
        </p>
      </div>
      <span v-if="!reach" class="miss-flag"><i class="pi pi-eye-slash" /> huni okunamadı</span>
    </header>

    <div class="tier-grid">
      <article v-for="(tier, index) in rows" :key="tier.key" class="tier-card">
        <header class="tier-card-head">
          <span class="tier-glyph">{{ TIER_META[tier.key].glyph }}</span>
          <div class="tier-name">
            <strong>{{ TIER_META[tier.key].label }}</strong>
            <small>{{ TIER_META[tier.key].blurb }}</small>
          </div>
          <span class="tier-step">{{ index + 1 }}/3</span>
        </header>

        <div class="tier-goal">
          <strong>{{ tier.target }}</strong>
          <span>{{ metricLabel }}</span>
        </div>

        <div class="tier-rewards">
          <span class="measure-pill xp">+{{ tier.xpReward }} XP</span>
          <span class="measure-pill pouch">
            <i class="pi pi-comments" />{{ pouchLabel(tier.pouchReward) }}
          </span>
        </div>

        <template v-if="tier.stats">
          <div class="tier-funnel">
            <div class="tier-track">
              <div class="tier-fill reached" :style="{ width: barWidth(tier.stats.reachedShare) }" />
              <div
                class="tier-fill done"
                :style="{ width: barWidth(tier.stats.reachedShare * tier.stats.completionRate) }"
              />
            </div>
            <small>açık: erişen · koyu: tamamlayan</small>
          </div>

          <dl class="tier-stats">
            <div>
              <dt>Erişen</dt>
              <dd>{{ countLabel(tier.stats.reachedUsers) }} <em>{{ percent(tier.stats.reachedShare) }}</em></dd>
            </div>
            <div>
              <dt>Tamamlama</dt>
              <dd>{{ percent(tier.stats.completionRate) }} <em>{{ countLabel(tier.stats.completedUsers) }} kişi</em></dd>
            </div>
            <div>
              <dt>Ortanca süre</dt>
              <dd>{{ daysLabel(tier.stats.medianDaysToComplete) }}</dd>
            </div>
          </dl>
        </template>
      </article>
    </div>

    <footer v-if="reach" class="tier-panel-foot">
      <Tag value="HUNİ" severity="secondary" />
      <p>
        Bir kademeye <strong>erişen</strong>, bir altındakini tamamlamış kişidir; ilk
        kademeye görevi görebilen herkes erişmiş sayılır. Bu yüzden erişim yapı gereği
        azalır ve her oran kendi paydasına okunur. Payda
        {{ countLabel(reach.audience) }} kişi.
        <br />
        Merdivenin açıldığı gün çoktan geçilmiş kademeler <strong>ortanca süreye
        girmez</strong> (hepsi aynı anı taşıdığı için bütün süreleri tabana çekerdi),
        ama sayılarda durur: o kademelere gerçekten eriştiler.
      </p>
    </footer>
    <footer v-else class="tier-panel-foot">
      <Tag value="ÖLÇÜM YOK" severity="warn" />
      <p>
        Huni bu sefer hesaplanamadı. Yukarıdaki eşikler ve ödüller görevin tanımı ve
        doğru; eksik olan yalnız kaç kişinin nereye geldiği.
      </p>
    </footer>
  </div>
</template>

<style scoped>
.tier-panel { display: grid; gap: 14px; padding: 6px 4px 10px; }
.tier-panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.tier-panel-note { max-width: 62ch; margin: 6px 0 0; color: #6d7169; font-size: 10.5px; line-height: 1.6; }
.tier-panel-note strong { color: #333831; }
.tier-panel-note em { font-style: normal; color: #9a9c94; }

.miss-flag {
  display: inline-flex; align-items: center; gap: 6px; flex: 0 0 auto;
  padding: 4px 10px; border-radius: 999px;
  color: #96612a; background: #fdf3e2;
  font-size: 9px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase;
}
.miss-flag i { font-size: 10px; }

.tier-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.tier-card {
  display: grid; gap: 11px; align-content: start;
  padding: 15px 16px 14px;
  border: 1px solid var(--line); border-radius: 16px;
  background: var(--paper);
}
/* Merdiven hissi: üst kademe biraz daha koyu bir kenarla ayrışır. */
.tier-card:nth-child(2) { border-color: #d6dfd3; }
.tier-card:nth-child(3) { border-color: #c3d6c8; background: linear-gradient(180deg, #fbfdf9, var(--paper)); }

.tier-card-head { display: flex; align-items: center; gap: 10px; }
.tier-glyph {
  width: 32px; height: 32px; flex: 0 0 auto;
  display: grid; place-items: center;
  border-radius: 11px 11px 11px 3px; background: #dff0e7; font-size: 16px; line-height: 1;
}
.tier-name { min-width: 0; }
.tier-name strong { display: block; color: #2f342e; font-size: 12.5px; letter-spacing: -.01em; }
.tier-name small { display: block; margin-top: 3px; color: #8d9087; font-size: 9px; line-height: 1.45; }
.tier-step { margin-left: auto; align-self: flex-start; color: #b3b5ac; font-size: 9px; font-weight: 900; }

.tier-goal { display: flex; align-items: baseline; gap: 7px; }
.tier-goal strong { color: var(--green-dark); font-size: 26px; line-height: 1; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
.tier-goal span { color: #83867d; font-size: 10px; font-weight: 800; }

.tier-rewards { display: flex; flex-wrap: wrap; gap: 6px; }
.tier-rewards .measure-pill { display: inline-flex; align-items: center; gap: 5px; }
.measure-pill.xp { color: #2f6b4f; border-color: #cfe6da; background: #f1f9f4; }
.measure-pill.pouch { color: #7a5a1f; border-color: #ecdcbb; background: #fdf6e8; }
.measure-pill.pouch i { font-size: 10px; }

.tier-funnel { display: grid; gap: 5px; }
.tier-track { position: relative; height: 8px; border-radius: 999px; background: #eef2ec; overflow: hidden; }
.tier-fill { position: absolute; left: 0; top: 0; height: 100%; border-radius: 999px; }
.tier-fill.reached { background: #a7dcc2; }
.tier-fill.done { background: linear-gradient(90deg, #34d399, #059669); }
.tier-funnel small { color: #a3a59c; font-size: 8.5px; font-weight: 700; }

.tier-stats { display: grid; gap: 6px; margin: 0; }
.tier-stats > div { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.tier-stats dt { color: #8d9087; font-size: 9.5px; font-weight: 800; }
.tier-stats dd { margin: 0; color: #333831; font-size: 11.5px; font-weight: 850; font-variant-numeric: tabular-nums; }
.tier-stats dd em { margin-left: 5px; color: #9a9c94; font-size: 9px; font-style: normal; font-weight: 700; }

.tier-panel-foot { display: flex; align-items: flex-start; gap: 10px; padding-top: 2px; }
.tier-panel-foot p { max-width: 88ch; margin: 0; color: #8a8d84; font-size: 10px; line-height: 1.65; }

@media (max-width: 1180px) {
  .tier-grid { grid-template-columns: 1fr; }
}
</style>
