<script setup lang="ts">
import { computed } from 'vue'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Tag from 'primevue/tag'
import SourceChip from './SourceChip.vue'
import { label, type Provenance, type UserDetail } from '../../services/users'
import { date, dateTime, num, pct } from './shared'

const props = defineProps<{ detail: UserDetail; sources: Record<keyof UserDetail, Provenance> }>()

const game = computed(() => props.detail.gamification)
const xpTotal = computed(() => game.value.xpBySource.reduce((sum, row) => sum + row.count, 0))

const questRows = computed(() =>
  [...game.value.quests].sort((a, b) => {
    const rank = (quest: typeof a) => (quest.claimedAt ? 2 : quest.completedAt ? 0 : 1)
    return rank(a) - rank(b) || b.progress / b.target - a.progress / a.target
  }))

const questState = (quest: UserDetail['gamification']['quests'][number]) => {
  if (quest.claimedAt) return { label: 'Alındı', severity: 'success' }
  if (quest.completedAt) return { label: 'Tamamlandı, alınmadı', severity: 'warn' }
  return { label: 'Sürüyor', severity: 'secondary' }
}
</script>

<template>
  <div class="detail-body">
    <div class="split-grid wide-left">
      <article class="panel-card pad">
        <div class="panel-title sm">
          <div><p>TECRÜBE</p><h2>Seviye ve unvan</h2></div>
          <SourceChip :source="sources.gamification" />
        </div>
        <div class="level-row">
          <div class="level-badge">
            <small>SEVİYE</small>
            <strong>{{ game.progress.level }}</strong>
          </div>
          <div class="level-body">
            <strong class="level-title">{{ game.progress.title }}</strong>
            <div class="level-track">
              <div class="level-fill" :style="{ width: `${String(Math.round(game.progress.ratio * 100))}%` }" />
            </div>
            <small>
              {{ num(game.progress.xpIntoLevel) }} / {{ num(game.progress.xpForLevel) }} XP ·
              sonraki seviyeye {{ num(game.progress.xpToNext) }} XP
              <template v-if="game.progress.levelsToNextTitle > 0">
                · yeni unvana {{ num(game.progress.levelsToNextTitle) }} seviye
              </template>
            </small>
          </div>
          <div class="level-total">
            <strong>{{ num(game.progress.totalXp) }}</strong>
            <small>toplam XP</small>
          </div>
        </div>
        <div class="fact-divider" />
        <p class="mini-cap">TECRÜBE NEREDEN GELDİ</p>
        <ul class="src-list tight">
          <li v-for="row in game.xpBySource.filter((item) => item.count > 0)" :key="row.key">
            <div class="src-row">
              <span class="src-name">{{ row.label }}</span>
              <span class="src-val">{{ num(row.count) }} XP · %{{ pct(row.count, xpTotal) }}</span>
            </div>
            <div class="mini-track"><div class="mini-fill green" :style="{ width: `${String(pct(row.count, xpTotal))}%` }" /></div>
          </li>
        </ul>
      </article>

      <article class="panel-card pad">
        <div class="panel-title sm"><div><p>LİG</p><h2>Baharat yolu</h2></div></div>
        <template v-if="game.league">
          <div class="league-hero">
            <strong>{{ label.tier(game.league.tier) }}</strong>
            <small>{{ game.league.seat }}. masa · {{ num(game.league.members) }} kişi</small>
          </div>
          <dl class="fact-list">
            <div><dt>Sıra</dt><dd>{{ game.league.rank }}. / {{ game.league.members }}</dd></div>
            <div><dt>Puan</dt><dd>{{ num(game.league.points) }}</dd></div>
            <div><dt>Mevsim başı</dt><dd>{{ date(game.league.seasonStart) }}</dd></div>
          </dl>
        </template>
        <p v-else class="muted-status">Bu mevsim hiçbir masaya oturmamış (son 14 günde afiyet günü yok).</p>
      </article>
    </div>

    <section class="panel-card pad">
      <div class="panel-title sm"><div><p>GÖREVLER</p><h2>Nerede duruyor</h2></div></div>
      <ul class="quest-progress">
        <li v-for="quest in questRows" :key="quest.key">
          <span class="quest-glyph">{{ quest.emoji }}</span>
          <div class="quest-body">
            <div class="src-row">
              <span class="src-name">{{ quest.title }}</span>
              <span class="src-val">{{ num(quest.progress) }} / {{ num(quest.target) }}</span>
            </div>
            <div class="mini-track">
              <div
                class="mini-fill"
                :class="quest.completedAt ? 'green' : 'coral'"
                :style="{ width: `${String(Math.min(100, pct(quest.progress, quest.target)))}%` }"
              />
            </div>
          </div>
          <Tag :value="questState(quest).label" :severity="questState(quest).severity" />
        </li>
      </ul>
    </section>

    <section class="table-card">
      <div class="table-toolbar">
        <div class="panel-title sm"><div><p>DEFTER</p><h2>Son tecrübe kayıtları</h2></div></div>
        <span class="result-count">{{ num(game.recentXp.length) }} satır</span>
      </div>
      <DataTable :value="game.recentXp" :rows="10" paginator>
        <Column header="Kaynak" style="min-width: 12rem">
          <template #body="{ data }"><strong>{{ label.xpSource(data.source) }}</strong></template>
        </Column>
        <Column header="Kazanç" style="width: 7rem">
          <template #body="{ data }"><span class="measure-pill">+{{ data.amount }} XP</span></template>
        </Column>
        <Column header="Gün" style="min-width: 9rem">
          <template #body="{ data }"><span class="date-cell">{{ date(data.occurredOn) }}</span></template>
        </Column>
        <Column header="Yazıldığı an" style="min-width: 11rem">
          <template #body="{ data }"><span class="date-cell">{{ dateTime(data.createdAt) }}</span></template>
        </Column>
        <Column header="Tekilleştirme anahtarı" style="min-width: 14rem">
          <template #body="{ data }"><span class="mono-cell">{{ data.dedupeKey }}</span></template>
        </Column>
      </DataTable>
    </section>
  </div>
</template>
