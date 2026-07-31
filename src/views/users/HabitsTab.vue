<script setup lang="ts">
import { computed } from 'vue'
import SourceChip from './SourceChip.vue'
import type { Provenance, UserDetail } from '../../services/users'
import { date, num, pct } from './shared'

const props = defineProps<{ detail: UserDetail; sources: Record<keyof UserDetail, Provenance> }>()

const habits = computed(() => props.detail.habits)
const usage = computed(() => props.detail.usage)

const WEEKDAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']

/**
 * Isı haritası: sütun bir hafta, satır bir gün. Pazartesi üstte durur çünkü
 * ritim hedefi ("haftada 5 gün") hafta pazartesi başlayarak sayılıyor.
 * Gelen dizinin başı pazartesiye denk gelmeyebilir; baştaki boşluk null
 * hücrelerle doldurulur ki satırlar kaymasın.
 */
const heatmap = computed(() => {
  const cells = habits.value.days
  if (!cells.length) return []
  const first = new Date(cells[0].date)
  const pad = (first.getDay() + 6) % 7
  const padded: (typeof cells[number] | null)[] = [...Array<null>(pad).fill(null), ...cells]
  const weeks: (typeof cells[number] | null)[][] = []
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7))
  return weeks
})

const level = (meals: number) => (meals === 0 ? 0 : meals === 1 ? 1 : meals === 2 ? 2 : meals <= 4 ? 3 : 4)

const streakCards = computed(() => [
  { label: 'Afiyet günü', value: num(usage.value.afiyetDays), foot: 'son 12 haftada' },
  { label: 'Güncel seri', value: num(usage.value.currentStreak), foot: 'kesintisiz gün' },
  { label: 'En uzun seri', value: num(usage.value.longestStreak), foot: 'kesintisiz gün' },
  { label: 'Afiyet haftası', value: num(usage.value.afiyetWeeks), foot: 'hedefi tutturduğu hafta' },
])

const hourMax = computed(() => Math.max(1, ...habits.value.mealsByHour.map((row) => row.count)))
const mealTypeTotal = computed(() => habits.value.mealsByType.reduce((sum, row) => sum + row.count, 0))
const groupTotal = computed(() => habits.value.groupCoverage.reduce((sum, row) => sum + row.count, 0))
const foodMax = computed(() => Math.max(1, ...habits.value.topFoods.map((row) => row.count)))
const waterMax = computed(() => Math.max(1, ...habits.value.water.map((row) => row.glasses)))
const rhythmMax = computed(() => 7)

/** Kilo çizgisi: değerler kendi aralığına ölçeklenir, mutlak sıfıra değil. */
const weightLine = computed(() => {
  const points = habits.value.measurements
  if (points.length < 2) return null
  const values = points.map((point) => point.weightKg)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const coords = points.map((point, index) => {
    const x = (index / (points.length - 1)) * 100
    const y = 100 - ((point.weightKg - min) / span) * 100
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  return { path: coords.join(' '), min, max, first: values[0], last: values[values.length - 1] }
})

const emptyGroups = computed(() => habits.value.groupCoverage.filter((row) => row.count === 0))
</script>

<template>
  <div class="detail-body">
    <section class="panel-card pad">
      <div class="panel-title sm">
        <div><p>RİTİM</p><h2>Son 12 hafta</h2></div>
        <SourceChip :source="sources.habits" />
      </div>

      <div class="heat-wrap">
        <div class="heat-days">
          <span v-for="(day, index) in WEEKDAYS" :key="day">{{ index % 2 === 0 ? day : '' }}</span>
        </div>
        <div class="heat-grid">
          <div v-for="(week, index) in heatmap" :key="index" class="heat-col">
            <span
              v-for="(cell, row) in week"
              :key="row"
              class="heat-cell"
              :class="cell ? `l${String(level(cell.meals))}` : 'empty'"
              :title="cell ? `${date(cell.date)} · ${String(cell.meals)} öğün` : ''"
            />
          </div>
        </div>
      </div>
      <div class="heat-legend">
        <span>az</span>
        <span v-for="n in 5" :key="n" class="heat-cell" :class="`l${String(n - 1)}`" />
        <span>çok</span>
        <em>hücre = bir gün, renk = o gün kaydedilen öğün sayısı</em>
      </div>

      <div class="counter-grid four">
        <div v-for="card in streakCards" :key="card.label" class="counter-cell">
          <strong>{{ card.value }}</strong>
          <small>{{ card.label }}</small>
          <em>{{ card.foot }}</em>
        </div>
      </div>
    </section>

    <div class="split-grid">
      <article class="panel-card pad">
        <div class="panel-title sm">
          <div><p>SAAT</p><h2>Günün hangi saatinde yazıyor</h2></div>
        </div>
        <div class="hour-chart">
          <div v-for="row in habits.mealsByHour" :key="row.hour" class="hour-col" :title="`${String(row.hour)}:00 · ${String(row.count)} kayıt`">
            <div class="hour-fill" :style="{ height: `${String(Math.round((row.count / hourMax) * 100))}%` }" />
          </div>
        </div>
        <div class="hour-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
      </article>

      <article class="panel-card pad">
        <div class="panel-title sm">
          <div><p>ÖĞÜN</p><h2>Hangi öğünü kaydediyor</h2></div>
        </div>
        <ul class="src-list tight">
          <li v-for="row in habits.mealsByType" :key="row.key">
            <div class="src-row">
              <span class="src-name">{{ row.label }}</span>
              <span class="src-val">{{ num(row.count) }} · %{{ pct(row.count, mealTypeTotal) }}</span>
            </div>
            <div class="mini-track"><div class="mini-fill green" :style="{ width: `${String(pct(row.count, mealTypeTotal))}%` }" /></div>
          </li>
        </ul>
      </article>
    </div>

    <div class="split-grid">
      <article class="panel-card pad">
        <div class="panel-title sm">
          <div><p>ÇEŞİTLİLİK</p><h2>Besin grupları</h2></div>
        </div>
        <ul class="src-list tight">
          <li v-for="row in habits.groupCoverage.slice(0, 8)" :key="row.key">
            <div class="src-row">
              <span class="src-name">{{ row.label }}</span>
              <span class="src-val">{{ num(row.count) }}</span>
            </div>
            <div class="mini-track"><div class="mini-fill green" :style="{ width: `${String(pct(row.count, groupTotal))}%` }" /></div>
          </li>
        </ul>
        <p v-if="emptyGroups.length" class="note-line">
          <i class="pi pi-info-circle" />
          Hiç dokunmadığı gruplar: {{ emptyGroups.map((row) => row.label).join(', ') }}
        </p>
      </article>

      <article class="panel-card pad">
        <div class="panel-title sm">
          <div><p>TEKRAR</p><h2>En sık yazdığı besinler</h2></div>
        </div>
        <ul class="rank-list">
          <li v-for="(row, index) in habits.topFoods" :key="row.name">
            <span class="rank-idx">{{ index + 1 }}</span>
            <div class="rank-body">
              <div class="src-row">
                <span class="src-name">
                  {{ row.name }}
                  <em v-if="row.custom" class="rank-tag">Menüm</em>
                </span>
                <span class="src-val">{{ num(row.count) }}</span>
              </div>
              <div class="mini-track"><div class="mini-fill coral" :style="{ width: `${String(pct(row.count, foodMax))}%` }" /></div>
            </div>
          </li>
        </ul>
      </article>
    </div>

    <div class="split-grid">
      <article class="panel-card pad">
        <div class="panel-title sm">
          <div><p>HAFTALIK</p><h2>Ritim hedefi</h2></div>
        </div>
        <div class="bar-chart">
          <div v-for="week in habits.rhythm" :key="week.weekStart" class="bar-col">
            <span class="bar-value">{{ week.days }}</span>
            <div class="bar-track">
              <div
                class="bar-fill"
                :class="{ under: week.days < week.goal }"
                :style="{ height: `${String(Math.round((week.days / rhythmMax) * 100))}%` }"
              />
            </div>
            <span class="bar-label">{{ date(week.weekStart).slice(0, 6) }}</span>
          </div>
        </div>
        <p class="note-line"><i class="pi pi-flag" /> Hedef haftada {{ habits.rhythm[0]?.goal ?? 5 }} afiyet günü; hedefin altındaki haftalar soluk.</p>
      </article>

      <article class="panel-card pad">
        <div class="panel-title sm">
          <div><p>SU VE ÖLÇÜM</p><h2>Yan kayıtlar</h2></div>
        </div>
        <p class="mini-cap">SON 30 GÜN SU</p>
        <div class="water-row">
          <span
            v-for="day in habits.water"
            :key="day.date"
            class="water-bar"
            :style="{ height: `${String(Math.max(6, Math.round((day.glasses / waterMax) * 100)))}%`, opacity: day.glasses ? 1 : 0.25 }"
            :title="`${date(day.date)} · ${String(day.glasses)} bardak`"
          />
        </div>
        <p class="mini-cap">KİLO SEYRİ</p>
        <div v-if="weightLine" class="weight-chart">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline :points="weightLine.path" />
          </svg>
          <div class="weight-scale">
            <span>{{ weightLine.first.toLocaleString('tr-TR') }} kg</span>
            <span>{{ weightLine.last.toLocaleString('tr-TR') }} kg</span>
          </div>
        </div>
        <p v-else class="muted-status">Kilo seyri için en az iki ölçüm gerekiyor.</p>
        <p class="note-line subtle">
          <i class="pi pi-lock" />
          Kilo ve ölçüler yalnız burada görünür; grup ekranlarında kimseye gösterilmez.
        </p>
      </article>
    </div>
  </div>
</template>
