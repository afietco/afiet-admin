<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import EmptyState from '../../components/EmptyState.vue'
import { config } from '../../config'
import type { ContentItem } from '../../services/content'
import { CHANNELS, channelMeta, formatDate, latestMetric, toIsoDate, useContentStore } from './shared'

const toast = useToast()
const { payload, upsertMetric } = useContentStore()

const fmt = (n: number) => n.toLocaleString('tr-TR')
const pct = (n: number, base: number) => (base > 0 ? Math.round((n / base) * 100) : 0)

/** Tüm ölçümleri içerik bilgisiyle CSV indir (Waitlist deseni). */
function exportCsv() {
  const metrics = [...payload.value.metrics].sort((a, b) => (a.metricDate < b.metricDate ? 1 : -1))
  if (!metrics.length) {
    toast.add({ severity: 'warn', summary: 'Dışa aktarılacak ölçüm yok', detail: 'Önce "Ölçüm gir" ile en az bir kayıt ekle.', life: 3500 })
    return
  }
  const itemById = new Map(payload.value.items.map((i) => [i.id, i]))
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
  const csv = [
    'tarih,icerik_id,baslik,kanal,goruntulenme,begeni,yorum,paylasim,kaydetme,tiklama,not',
    ...metrics.map((m) => {
      const item = itemById.get(m.itemId)
      return [
        m.metricDate, m.itemId, item?.title ?? '', item ? channelMeta(item.channel).label : '',
        m.views, m.likes, m.comments, m.shares, m.saves, m.clicks, m.notes,
      ].map(escape).join(',')
    }),
  ].join('\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }))
  link.download = `afiet-icerik-metrikleri-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
  toast.add({ severity: 'success', summary: `${metrics.length} ölçüm indirildi`, life: 2500 })
}

/** Ölçüm girilebilir içerikler: yayında/arşivde olanlar + zaten metriği olanlar. */
const rows = computed(() => {
  const withMetric = new Set(payload.value.metrics.map((m) => m.itemId))
  return payload.value.items
    .filter((i) => i.status === 'yayinda' || i.status === 'arsiv' || withMetric.has(i.id))
    .map((i) => {
      const last = latestMetric(payload.value.metrics, i.id)
      return {
        item: i,
        last,
        engagement: last ? last.likes + last.comments + last.shares + last.saves : 0,
      }
    })
    .sort((a, b) => (b.last?.metricDate ?? '') < (a.last?.metricDate ?? '') ? -1 : 1)
})

/** Kanal toplamları — her içeriğin SON ölçümü üzerinden. */
const channelCards = computed(() =>
  CHANNELS.map((c) => {
    const chRows = rows.value.filter((r) => r.item.channel === c.value)
    return {
      ...c,
      published: payload.value.items.filter((i) => i.channel === c.value && i.status === 'yayinda').length,
      views: chRows.reduce((s, r) => s + (r.last?.views ?? 0), 0),
      engagement: chRows.reduce((s, r) => s + r.engagement, 0),
    }
  }),
)
const totalViews = computed(() => channelCards.value.reduce((s, c) => s + c.views, 0))
const cardTone = (i: number) => ['green', 'amber', 'blue'][i % 3]

// ── Metrik girme ─────────────────────────────────────────────────────────────
const metricOpen = ref(false)
const metricItem = ref<ContentItem | null>(null)
const savingMetric = ref(false)
const metricForm = reactive({
  date: new Date() as Date | null,
  views: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0,
  notes: '',
})

function openMetric(item: ContentItem) {
  metricItem.value = item
  const last = latestMetric(payload.value.metrics, item.id)
  Object.assign(metricForm, {
    date: new Date(),
    views: last?.views ?? 0, likes: last?.likes ?? 0, comments: last?.comments ?? 0,
    shares: last?.shares ?? 0, saves: last?.saves ?? 0, clicks: last?.clicks ?? 0,
    notes: '',
  })
  metricOpen.value = true
}

async function saveMetric() {
  const item = metricItem.value
  const metricDate = toIsoDate(metricForm.date)
  if (!item || !metricDate) return
  savingMetric.value = true
  try {
    await upsertMetric({
      itemId: item.id, metricDate,
      views: metricForm.views ?? 0, likes: metricForm.likes ?? 0, comments: metricForm.comments ?? 0,
      shares: metricForm.shares ?? 0, saves: metricForm.saves ?? 0, clicks: metricForm.clicks ?? 0,
      notes: metricForm.notes.trim(),
    })
    toast.add({ severity: 'success', summary: 'Ölçüm kaydedildi', detail: 'Aynı tarihe yeniden girersen üzerine yazar.', life: 3000 })
    metricOpen.value = false
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Kaydedilemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
  } finally {
    savingMetric.value = false
  }
}

const postUrl = (slug: string) => `${config.webApiUrl}/blog/${slug}`
</script>

<template>
  <div class="tab-body">
    <div class="content-toolbar">
      <p class="analytics-note"><i class="pi pi-pencil" /> Metrikler elle girilir (haftalık fotoğraf önerilir) — her içeriğin <strong>son ölçümü</strong> esas alınır. Aynı tarihe girilen değer üzerine yazar.</p>
      <Button label="CSV indir" icon="pi pi-download" severity="secondary" outlined @click="exportCsv" /></div>

    <div class="metric-grid three">
      <article v-for="(c, i) in channelCards" :key="c.value" class="metric-card" :class="cardTone(i)">
        <div class="metric-top"><span>{{ c.label }}</span><i :class="c.icon" /></div>
        <strong>{{ fmt(c.views) }}</strong>
        <small>görüntülenme · {{ fmt(c.engagement) }} etkileşim · {{ c.published }} yayında</small>
        <div class="mini-track card-track"><div class="mini-fill green" :style="{ width: `${pct(c.views, totalViews)}%` }" /></div>
      </article>
    </div>

    <section class="table-card">
      <DataTable :value="rows" data-key="item.id" striped-rows>
        <template #empty><EmptyState icon="pi pi-chart-bar" title="Henüz ölçüm yok" description="Bir içerik yayına girince satırı burada belirir; 'Ölçüm gir' ile ilk metriği ekle." /></template>
        <Column header="İçerik" style="min-width: 20rem">
          <template #body="{ data }">
            <div class="food-cell">
              <span class="food-glyph">{{ data.item.title.slice(0, 1) }}</span>
              <div><strong>{{ data.item.title }}</strong><small>{{ channelMeta(data.item.channel).label }}<template v-if="data.item.plannedDate"> · {{ formatDate(data.item.plannedDate) }}</template></small></div>
            </div>
          </template>
        </Column>
        <Column header="Kanal"><template #body="{ data }"><Tag :value="channelMeta(data.item.channel).label" :severity="channelMeta(data.item.channel).severity" /></template></Column>
        <Column header="Yayın">
          <template #body="{ data }">
            <a v-if="data.item.publishedUrl" :href="data.item.publishedUrl" target="_blank" rel="noopener" class="file-link"><i class="pi pi-external-link" /> aç</a>
            <span v-else class="date-cell">—</span>
          </template>
        </Column>
        <Column header="Son ölçüm"><template #body="{ data }"><span class="date-cell">{{ data.last ? formatDate(data.last.metricDate, true) : '—' }}</span></template></Column>
        <Column header="Görüntülenme"><template #body="{ data }"><strong class="num-cell">{{ data.last ? fmt(data.last.views) : '—' }}</strong></template></Column>
        <Column header="Etkileşim"><template #body="{ data }"><span class="num-cell">{{ data.last ? fmt(data.engagement) : '—' }}</span></template></Column>
        <Column header="Tıklama"><template #body="{ data }"><span class="num-cell">{{ data.last ? fmt(data.last.clicks) : '—' }}</span></template></Column>
        <Column header="" style="width: 9rem">
          <template #body="{ data }"><Button label="Ölçüm gir" icon="pi pi-plus" size="small" severity="secondary" outlined @click="openMetric(data.item)" /></template>
        </Column>
      </DataTable>
    </section>

    <section v-if="payload.posts.length" class="panel-card pad">
      <div class="panel-title sm"><div><p>AFİET.CO/BLOG</p><h2>Blog yazıları</h2></div></div>
      <ul class="posts-strip">
        <li v-for="p in payload.posts" :key="p.slug">
          <Tag :value="p.status === 'yayinda' ? 'Yayında' : 'Taslak'" :severity="p.status === 'yayinda' ? 'success' : 'secondary'" />
          <div class="post-copy">
            <strong>{{ p.title }}</strong>
            <small class="mono">/blog/{{ p.slug }}<template v-if="p.readingMinutes"> · {{ p.readingMinutes }} dk okuma</template><template v-if="p.publishedAt"> · {{ formatDate(p.publishedAt, true) }}</template></small>
          </div>
          <a :href="postUrl(p.slug)" target="_blank" rel="noopener" class="file-link"><i class="pi pi-external-link" /> gör</a>
        </li>
      </ul>
    </section>

    <Dialog v-model:visible="metricOpen" modal :header="`Ölçüm gir — ${metricItem?.title ?? ''}`" :style="{ width: '34rem' }">
      <div class="form-grid">
        <div class="form-field span-2"><label>Ölçüm tarihi</label><DatePicker v-model="metricForm.date" date-format="dd.mm.yy" show-icon icon-display="input" fluid /></div>
        <div class="form-field"><label>Görüntülenme</label><InputNumber v-model="metricForm.views" :min="0" fluid /></div>
        <div class="form-field"><label>Beğeni</label><InputNumber v-model="metricForm.likes" :min="0" fluid /></div>
        <div class="form-field"><label>Yorum</label><InputNumber v-model="metricForm.comments" :min="0" fluid /></div>
        <div class="form-field"><label>Paylaşım</label><InputNumber v-model="metricForm.shares" :min="0" fluid /></div>
        <div class="form-field"><label>Kaydetme</label><InputNumber v-model="metricForm.saves" :min="0" fluid /></div>
        <div class="form-field"><label>Tıklama</label><InputNumber v-model="metricForm.clicks" :min="0" fluid /></div>
        <div class="form-field span-2"><label>Not</label><InputText v-model="metricForm.notes" fluid placeholder="ör. keşfete düştü" /></div>
      </div>
      <template #footer>
        <Button label="Vazgeç" severity="secondary" text @click="metricOpen = false" />
        <Button label="Kaydet" icon="pi pi-check" :loading="savingMetric" @click="saveMetric" />
      </template>
    </Dialog>
  </div>
</template>
