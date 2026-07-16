<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import type { Channel, ContentItem } from '../../services/content'
import ItemDialog from './ItemDialog.vue'
import { BOARD_STATUSES, CHANNELS, NEXT_STATUS, channelMeta, formatDate, statusLabel, useContentStore } from './shared'

const toast = useToast()
const { payload, upsertItem } = useContentStore()

const channelFilter = ref<Channel | 'hepsi'>('hepsi')
const filterOptions = [{ value: 'hepsi', label: 'Tümü' }, ...CHANNELS.map((c) => ({ value: c.value, label: c.label }))]

const dialogOpen = ref(false)
const editing = ref<ContentItem | null>(null)
const archiveOpen = ref(false)

const filtered = computed(() =>
  payload.value.items.filter((i) => channelFilter.value === 'hepsi' || i.channel === channelFilter.value),
)
const columns = computed(() =>
  BOARD_STATUSES.map((s) => ({
    ...s,
    items: filtered.value
      .filter((i) => i.status === s.value)
      .sort((a, b) => (a.plannedDate ?? '9999') < (b.plannedDate ?? '9999') ? -1 : 1),
  })),
)
const archived = computed(() => filtered.value.filter((i) => i.status === 'arsiv'))

function openNew() {
  editing.value = null
  dialogOpen.value = true
}
function openItem(item: ContentItem) {
  editing.value = item
  dialogOpen.value = true
}

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
      <SelectButton v-model="channelFilter" :options="filterOptions" option-label="label" option-value="value" :allow-empty="false" />
      <Button label="Yeni fikir" icon="pi pi-plus" @click="openNew" />
    </div>

    <div class="board">
      <section v-for="col in columns" :key="col.value" class="board-col" :class="`col-${col.value}`">
        <header class="board-col-head">
          <span>{{ col.label }}</span>
          <span class="board-count">{{ col.items.length }}</span>
        </header>
        <p v-if="!col.items.length" class="board-empty">Henüz yok</p>
        <article v-for="item in col.items" :key="item.id" class="board-card" role="button" tabindex="0" @click="openItem(item)" @keydown.enter="openItem(item)">
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
            <span v-if="item.plannedDate"><i class="pi pi-calendar" /> {{ formatDate(item.plannedDate) }}</span>
            <span v-if="item.slug" class="board-slug">/blog/{{ item.slug }}</span>
            <a v-if="item.publishedUrl" :href="item.publishedUrl" target="_blank" rel="noopener" class="board-link" @click.stop><i class="pi pi-external-link" /> yayında</a>
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
          <button type="button" class="archive-title" @click="openItem(item)">{{ item.title }}</button>
          <span class="archive-date">{{ formatDate(item.updatedAt, true) }}</span>
        </li>
      </ul>
      <p v-if="archiveOpen && !archived.length" class="board-empty">Arşiv boş.</p>
    </div>

    <ItemDialog v-model:visible="dialogOpen" :item="editing" :default-channel="channelFilter === 'hepsi' ? undefined : channelFilter" />
  </div>
</template>
