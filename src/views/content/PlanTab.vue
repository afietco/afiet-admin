<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import ChannelFilter from './ChannelFilter.vue'
import Tag from 'primevue/tag'
import type { Channel, ContentItem } from '../../services/content'
import { formatDate } from './shared'
import { BOARD_STATUSES, CHANNELS, NEXT_STATUS, channelMeta, formatMeta, openEditor, statusLabel, useContentStore } from './shared'

/**
 * Plan sekmesi = "kutu": tarihi HENÜZ verilmemiş fikirler durum kolonlarında
 * bekler. Tarih verilen an kart buradan çıkar ve Takvim sekmesinde görünür,
 * yani aynı iş iki yerde birden durmaz.
 */
const toast = useToast()
const { payload, upsertItem } = useContentStore()

// Boş dizi = tüm platformlar (bkz. ChannelFilter).
const channelFilter = ref<Channel[]>([])
const archiveOpen = ref(false)

const filtered = computed(() =>
  payload.value.items.filter((i) => !channelFilter.value.length || channelFilter.value.includes(i.channel)),
)
/** Kutu: tarihsizler. Arşiv ayrı blokta (tarihi olsa da olmasa da). */
const undated = computed(() => filtered.value.filter((i) => !i.plannedAt))
const columns = computed(() =>
  BOARD_STATUSES.map((s) => ({
    ...s,
    items: undated.value
      .filter((i) => i.status === s.value)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
  })),
)
const archived = computed(() => filtered.value.filter((i) => i.status === 'arsiv'))
const datedCount = computed(() => filtered.value.filter((i) => i.plannedAt && i.status !== 'arsiv').length)

async function advance(item: ContentItem) {
  const next = NEXT_STATUS[item.status]
  if (!next) return
  try {
    await upsertItem({ ...item, status: next })
    toast.add({ severity: 'success', summary: `"${statusLabel(next)}" aşamasına taşındı`, life: 2000 })
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Taşınamadı', detail: err instanceof Error ? err.message : '', life: 4000 })
  }
}
</script>

<template>
  <div class="tab-body">
    <div class="content-toolbar">
      <ChannelFilter v-model="channelFilter" />
      <Button label="Yeni fikir" icon="pi pi-plus" @click="openEditor(null, { channel: channelFilter.length === 1 ? channelFilter[0] : undefined, plannedAt: null })" />
    </div>

    <p class="analytics-note">
      <i class="pi pi-inbox" /> Burada <strong>tarihi olmayan</strong> fikirler bekler. Tarih verdiğin an kart takvime geçer
      (şu an takvimde {{ datedCount }} planlı etkinlik var).
    </p>

    <div class="board">
      <section v-for="col in columns" :key="col.value" class="board-col" :class="`col-${col.value}`">
        <header class="board-col-head">
          <span>{{ col.label }}</span>
          <span class="board-count">{{ col.items.length }}</span>
        </header>
        <p v-if="!col.items.length" class="board-empty">Henüz yok</p>
        <article
          v-for="item in col.items"
          :key="item.id"
          class="board-card"
          role="button"
          tabindex="0"
          @click="openEditor(item)"
          @keydown.enter="openEditor(item)"
        >
          <div class="board-card-top">
            <Tag :value="channelMeta(item.channel).label" :severity="channelMeta(item.channel).severity" :icon="channelMeta(item.channel).icon" />
            <Button
              v-if="NEXT_STATUS[item.status]"
              icon="pi pi-arrow-right"
              text
              rounded
              size="small"
              severity="secondary"
              :aria-label="`${statusLabel(NEXT_STATUS[item.status]!)} aşamasına taşı`"
              @click.stop="advance(item)"
            />
          </div>
          <h3 class="board-card-title">{{ item.title }}</h3>
          <div class="board-card-meta">
            <span><i :class="formatMeta(item.format).icon" /> {{ formatMeta(item.format).label }}</span>
            <span v-if="item.series" class="board-series">{{ item.seriesCode ? `${item.series} ${item.seriesCode}` : item.series }}</span>
            <span v-if="item.slug" class="board-slug">/blog/{{ item.slug }}</span>
          </div>
        </article>
      </section>
    </div>

    <div class="archive-block">
      <button class="archive-toggle" type="button" @click="archiveOpen = !archiveOpen">
        <i :class="archiveOpen ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
        Arşiv <span class="board-count">{{ archived.length }}</span>
      </button>
      <ul v-if="archiveOpen && archived.length" class="archive-list">
        <li v-for="item in archived" :key="item.id">
          <Tag :value="channelMeta(item.channel).label" :severity="channelMeta(item.channel).severity" />
          <button type="button" class="archive-title" @click="openEditor(item)">{{ item.title }}</button>
          <span class="archive-date">{{ formatDate(item.updatedAt, true) }}</span>
        </li>
      </ul>
      <p v-if="archiveOpen && !archived.length" class="board-empty">Arşiv boş.</p>
    </div>
  </div>
</template>
