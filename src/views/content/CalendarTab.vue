<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import type { Channel, ContentItem } from '../../services/content'
import {
  addDays, addMonths, dayNumber, dayShort, dayTitle, hhmm, instantFor, instantToKey, layoutDay,
  minutesOf, monthGrid, monthTitle, nowMinutes, sameMonth, todayKey, weekDays, weekdayShort, weekTitle,
  WEEKDAY_SHORT, type DayKey,
} from './calendar'
import { CHANNELS, attachmentsFor, channelMeta, formatMeta, openEditor, statusLabel, useContentStore } from './shared'

/**
 * Gün / hafta / ay takvimi - kütüphane yok, CSS grid.
 *
 * Kurallar:
 *  - Saat dilimi İstanbul'a sabit (calendar.ts); tarayıcının yereli kullanılmaz.
 *  - Hafta pazartesi başlar.
 *  - Sürükle-bırak yalnız zamanı taşır ve ANINDA kaydeder (move ucu).
 *  - Tarihi olmayan içerikler burada görünmez; onlar Plan sekmesinin kutusunda.
 */

const HOUR_HEIGHT = 44 // px, 1 saat
const SLOT_MINUTES = 30 // sürüklerken yakalanan en küçük adım
const MONTH_CELL_LIMIT = 3

const toast = useToast()
const { payload, moveItem } = useContentStore()

type View = 'gun' | 'hafta' | 'ay'
const view = ref<View>('hafta')
const cursor = ref<DayKey>(todayKey())
const channelFilter = ref<Channel | 'hepsi'>('hepsi')
const gridRef = ref<HTMLElement | null>(null)

const viewOptions = [
  { value: 'gun', label: 'Gün' },
  { value: 'hafta', label: 'Hafta' },
  { value: 'ay', label: 'Ay' },
]
const filterOptions = [{ value: 'hepsi', label: 'Tümü' }, ...CHANNELS.map((c) => ({ value: c.value, label: c.label }))]

const title = computed(() =>
  view.value === 'ay' ? monthTitle(cursor.value) : view.value === 'hafta' ? weekTitle(cursor.value) : dayTitle(cursor.value),
)

/** Tarihi olan ve filtreden geçen içerikler. */
const dated = computed(() =>
  payload.value.items.filter(
    (i) => i.plannedAt && (channelFilter.value === 'hepsi' || i.channel === channelFilter.value),
  ),
)

/** Gün anahtarına göre gruplanmış etkinlikler. */
const byDay = computed(() => {
  const map = new Map<DayKey, ContentItem[]>()
  for (const item of dated.value) {
    const key = instantToKey(item.plannedAt!)
    const list = map.get(key)
    if (list) list.push(item)
    else map.set(key, [item])
  }
  for (const list of map.values()) {
    list.sort((a, b) => (a.allDay === b.allDay ? minutesOf(a.plannedAt!) - minutesOf(b.plannedAt!) : a.allDay ? -1 : 1))
  }
  return map
})

const eventsOf = (key: DayKey) => byDay.value.get(key) ?? []
const allDayOf = (key: DayKey) => eventsOf(key).filter((i) => i.allDay)
const timedOf = (key: DayKey) => eventsOf(key).filter((i) => !i.allDay)
/** Hafta/gün ızgarasında çakışanları yan yana diz. */
const positionedOf = (key: DayKey) =>
  layoutDay(timedOf(key).map((item) => ({ item, minutes: minutesOf(item.plannedAt!) })))

const weeks = computed(() => monthGrid(cursor.value))
const days = computed(() => (view.value === 'hafta' ? weekDays(cursor.value) : [cursor.value]))
const hours = Array.from({ length: 24 }, (_, h) => h)
const today = computed(() => todayKey())
const nowTop = computed(() => (nowMinutes() / 60) * HOUR_HEIGHT)

// ── Gezinme ──────────────────────────────────────────────────────────────────
function step(direction: -1 | 1) {
  if (view.value === 'ay') cursor.value = addMonths(cursor.value, direction)
  else cursor.value = addDays(cursor.value, direction * (view.value === 'hafta' ? 7 : 1))
}
function goToday() {
  cursor.value = todayKey()
}
function openDay(key: DayKey) {
  cursor.value = key
  view.value = 'gun'
}

/** Hafta/gün görünümü açılınca sabaha kaydır (gece saatleri boşuna yer tutmasın). */
function scrollToMorning() {
  nextTick(() => {
    if (gridRef.value) gridRef.value.scrollTop = 8 * HOUR_HEIGHT - 8
  })
}
onMounted(scrollToMorning)
watch(view, (v) => {
  if (v !== 'ay') scrollToMorning()
})

// ── Yeni etkinlik ────────────────────────────────────────────────────────────
function newAt(key: DayKey, minutes: number | null) {
  openEditor(null, {
    channel: channelFilter.value === 'hepsi' ? undefined : channelFilter.value,
    plannedAt: minutes === null ? instantFor(key, 0) : instantFor(key, minutes),
    allDay: minutes === null,
  })
}

/** Slot içinde tıklanan yer 30 dakikaya yuvarlanır. */
function minutesFromEvent(e: MouseEvent | DragEvent, hour: number): number {
  const target = e.currentTarget as HTMLElement
  const offset = 'offsetY' in e && typeof e.offsetY === 'number' ? e.offsetY : 0
  const half = offset > target.clientHeight / 2 ? SLOT_MINUTES : 0
  return hour * 60 + half
}

// ── Sürükle-bırak ────────────────────────────────────────────────────────────
const dragId = ref<number | null>(null)
const dropTarget = ref<string | null>(null)

function onDragStart(e: DragEvent, item: ContentItem) {
  dragId.value = item.id
  e.dataTransfer?.setData('text/plain', String(item.id))
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}
function onDragEnd() {
  dragId.value = null
  dropTarget.value = null
}
function onDragOver(e: DragEvent, key: string) {
  if (dragId.value === null) return
  e.preventDefault()
  dropTarget.value = key
}

async function drop(id: number, plannedAt: string, allDay: boolean, label: string) {
  const item = payload.value.items.find((i) => i.id === id)
  if (!item) return
  if (item.plannedAt === plannedAt && item.allDay === allDay) return
  try {
    await moveItem(id, plannedAt, allDay)
    toast.add({ severity: 'success', summary: `${label} taşındı`, life: 1800 })
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Taşınamadı', detail: err instanceof Error ? err.message : '', life: 4000 })
  }
}

/** Ay hücresine bırakma: saat KORUNUR, yalnız gün değişir. */
async function onDropDay(e: DragEvent, key: DayKey) {
  e.preventDefault()
  const id = dragId.value
  onDragEnd()
  if (id === null) return
  const item = payload.value.items.find((i) => i.id === id)
  if (!item) return
  const minutes = item.allDay ? 0 : minutesOf(item.plannedAt!)
  await drop(id, instantFor(key, minutes), item.allDay, `${dayShort(key)}${item.allDay ? '' : ` ${hhmm(minutes)}`}`)
}

/** Saat ızgarasına bırakma: gün + saat değişir, tüm-gün işareti kalkar. */
async function onDropSlot(e: DragEvent, key: DayKey, hour: number) {
  e.preventDefault()
  const id = dragId.value
  const minutes = minutesFromEvent(e, hour)
  onDragEnd()
  if (id === null) return
  await drop(id, instantFor(key, minutes), false, `${dayShort(key)} ${hhmm(minutes)}`)
}

/** Tüm-gün şeridine bırakma: saat bilgisi anlamsızlaşır. */
async function onDropAllDay(e: DragEvent, key: DayKey) {
  e.preventDefault()
  const id = dragId.value
  onDragEnd()
  if (id === null) return
  await drop(id, instantFor(key, 0), true, `${dayShort(key)} tüm gün`)
}

// ── Kart yardımcıları ────────────────────────────────────────────────────────
const attachCount = (item: ContentItem) =>
  attachmentsFor(payload.value.attachments, item.id).filter((a) => a.status === 'hazir').length

const cardTip = (item: ContentItem) =>
  [
    channelMeta(item.channel).label,
    formatMeta(item.format).label,
    statusLabel(item.status),
    item.allDay ? 'tüm gün' : hhmm(minutesOf(item.plannedAt!)),
    item.series ? `${item.series}${item.seriesCode ? ` ${item.seriesCode}` : ''}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
</script>

<template>
  <div class="tab-body cal-wrap">
    <div class="cal-toolbar">
      <div class="cal-nav">
        <Button label="Bugün" size="small" severity="secondary" outlined @click="goToday" />
        <Button icon="pi pi-chevron-left" text rounded size="small" aria-label="Önceki" @click="step(-1)" />
        <Button icon="pi pi-chevron-right" text rounded size="small" aria-label="Sonraki" @click="step(1)" />
        <h2 class="cal-title">{{ title }}</h2>
      </div>
      <div class="cal-actions">
        <SelectButton v-model="channelFilter" :options="filterOptions" option-label="label" option-value="value" :allow-empty="false" size="small" />
        <SelectButton v-model="view" :options="viewOptions" option-label="label" option-value="value" :allow-empty="false" size="small" />
        <Button label="Yeni etkinlik" icon="pi pi-plus" size="small" @click="newAt(cursor, 12 * 60 + 30)" />
      </div>
    </div>

    <!-- ── AY ──────────────────────────────────────────────────────────── -->
    <section v-if="view === 'ay'" class="cal-month">
      <header class="cal-month-head">
        <span v-for="d in WEEKDAY_SHORT" :key="d">{{ d }}</span>
      </header>
      <div v-for="(week, wi) in weeks" :key="wi" class="cal-month-row">
        <div
          v-for="key in week"
          :key="key"
          class="cal-cell"
          :class="{ 'is-other': !sameMonth(key, cursor), 'is-today': key === today, 'is-drop': dropTarget === key }"
          @dragover="onDragOver($event, key)"
          @dragleave="dropTarget = null"
          @drop="onDropDay($event, key)"
          @dblclick="newAt(key, null)"
        >
          <header class="cal-cell-head">
            <button type="button" class="cal-daynum" @click="openDay(key)">{{ dayNumber(key) }}</button>
            <button type="button" class="cal-add" aria-label="Bu güne ekle" @click="newAt(key, 12 * 60 + 30)"><i class="pi pi-plus" /></button>
          </header>
          <article
            v-for="item in eventsOf(key).slice(0, MONTH_CELL_LIMIT)"
            :key="item.id"
            class="cal-chip"
            :class="[`pf-${channelMeta(item.channel).tone}`, `st-${item.status}`, { 'is-dragging': dragId === item.id }]"
            draggable="true"
            :title="cardTip(item)"
            @dragstart="onDragStart($event, item)"
            @dragend="onDragEnd"
            @click="openEditor(item)"
          >
            <span class="cal-chip-time">{{ item.allDay ? '' : hhmm(minutesOf(item.plannedAt!)) }}</span>
            <i :class="formatMeta(item.format).icon" />
            <span class="cal-chip-title">{{ item.title }}</span>
            <span v-if="attachCount(item)" class="cal-chip-clip"><i class="pi pi-paperclip" />{{ attachCount(item) }}</span>
          </article>
          <button
            v-if="eventsOf(key).length > MONTH_CELL_LIMIT"
            type="button"
            class="cal-more"
            @click="openDay(key)"
          >
            +{{ eventsOf(key).length - MONTH_CELL_LIMIT }} daha
          </button>
        </div>
      </div>
    </section>

    <!-- ── HAFTA / GÜN ─────────────────────────────────────────────────── -->
    <section v-else class="cal-time" :class="view === 'gun' ? 'is-day' : 'is-week'">
      <header class="cal-time-head">
        <span class="cal-gutter-head" />
        <button
          v-for="key in days"
          :key="key"
          type="button"
          class="cal-dayhead"
          :class="{ 'is-today': key === today }"
          @click="openDay(key)"
        >
          <small>{{ weekdayShort(key) }}</small>
          <strong>{{ dayNumber(key) }}</strong>
        </button>
      </header>

      <div class="cal-allday">
        <span class="cal-gutter-head">tüm gün</span>
        <div
          v-for="key in days"
          :key="key"
          class="cal-allday-cell"
          :class="{ 'is-drop': dropTarget === `ad-${key}` }"
          @dragover="onDragOver($event, `ad-${key}`)"
          @dragleave="dropTarget = null"
          @drop="onDropAllDay($event, key)"
          @dblclick="newAt(key, null)"
        >
          <article
            v-for="item in allDayOf(key)"
            :key="item.id"
            class="cal-chip"
            :class="[`pf-${channelMeta(item.channel).tone}`, `st-${item.status}`]"
            draggable="true"
            :title="cardTip(item)"
            @dragstart="onDragStart($event, item)"
            @dragend="onDragEnd"
            @click="openEditor(item)"
          >
            <i :class="formatMeta(item.format).icon" />
            <span class="cal-chip-title">{{ item.title }}</span>
          </article>
        </div>
      </div>

      <div ref="gridRef" class="cal-grid">
        <div class="cal-gutter">
          <span v-for="h in hours" :key="h" class="cal-hour-label" :style="{ height: `${HOUR_HEIGHT}px` }">
            {{ hhmm(h * 60) }}
          </span>
        </div>
        <div v-for="key in days" :key="key" class="cal-col" :class="{ 'is-today': key === today }">
          <div
            v-for="h in hours"
            :key="h"
            class="cal-slot"
            :class="{ 'is-drop': dropTarget === `${key}-${h}` }"
            :style="{ height: `${HOUR_HEIGHT}px` }"
            @dragover="onDragOver($event, `${key}-${h}`)"
            @dragleave="dropTarget = null"
            @drop="onDropSlot($event, key, h)"
            @dblclick="newAt(key, minutesFromEvent($event, h))"
          />
          <div v-if="key === today" class="cal-now" :style="{ top: `${nowTop}px` }"><span /></div>
          <article
            v-for="pos in positionedOf(key)"
            :key="pos.item.id"
            class="cal-event"
            :class="[`pf-${channelMeta(pos.item.channel).tone}`, `st-${pos.item.status}`, { 'is-dragging': dragId === pos.item.id }]"
            :style="{
              top: `${(pos.minutes / 60) * HOUR_HEIGHT}px`,
              left: `calc(${(pos.column / pos.columns) * 100}% + 2px)`,
              width: `calc(${100 / pos.columns}% - 4px)`,
            }"
            draggable="true"
            :title="cardTip(pos.item)"
            @dragstart="onDragStart($event, pos.item)"
            @dragend="onDragEnd"
            @click="openEditor(pos.item)"
          >
            <div class="cal-event-top">
              <span class="cal-event-time">{{ hhmm(pos.minutes) }}</span>
              <i :class="formatMeta(pos.item.format).icon" />
              <span v-if="pos.item.seriesCode" class="cal-event-code">{{ pos.item.seriesCode }}</span>
            </div>
            <strong class="cal-event-title">{{ pos.item.title }}</strong>
            <div v-if="view === 'gun'" class="cal-event-meta">
              <span>{{ channelMeta(pos.item.channel).label }} · {{ statusLabel(pos.item.status) }}</span>
              <span v-if="attachCount(pos.item)"><i class="pi pi-paperclip" /> {{ attachCount(pos.item) }} ek</span>
            </div>
            <span v-else-if="attachCount(pos.item)" class="cal-chip-clip"><i class="pi pi-paperclip" />{{ attachCount(pos.item) }}</span>
          </article>
        </div>
      </div>
    </section>

    <p class="cal-hint">
      <i class="pi pi-info-circle" />
      Kartı sürükleyerek gününü ve saatini değiştir; boş bir slota çift tıklayarak yeni etkinlik aç.
      Tarihi olmayan fikirler <strong>Plan</strong> sekmesindeki kutuda bekler. Saatler İstanbul saatidir.
    </p>
  </div>
</template>
