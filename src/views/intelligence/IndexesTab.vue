<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Tag from 'primevue/tag'
import KbTab from './KbTab.vue'
import { afiApi, type KbIndexStatus } from '../../services/afi'
import { copyById, indexes, searchService, type IndexId } from '../../services/intelligence'

/**
 * Üç Azure AI Search dizini. İkisinin kaynağı repodaki md dosyaları ve elle
 * senkronlanıyor, biri (bilgi-sofrasi) Neon'daki korpustan tazeleme koşusuyla
 * besleniyor; o yüzden yalnız onun sayıları canlı uçtan okunuyor.
 */

const selected = ref<IndexId>('bilgi-sofrasi')
const live = ref<KbIndexStatus | null>(null)
const liveError = ref('')

const current = computed(() => indexes.find((i) => i.id === selected.value)!)

const quotaFull = searchService.indexUsed >= searchService.indexQuota
const storagePct = Math.max(
  1.5,
  Math.round((searchService.storageUsedMb / searchService.storageQuotaMb) * 100),
)

function docsOf(id: IndexId) {
  const idx = indexes.find((i) => i.id === id)!
  if (idx.liveCounts) return live.value ? live.value.published : null
  return idx.documents
}
function chunksOf(id: IndexId) {
  const idx = indexes.find((i) => i.id === id)!
  if (idx.liveCounts) return live.value ? live.value.chunks : null
  return idx.chunks
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`

onMounted(async () => {
  try {
    live.value = await afiApi.kbStatus()
  } catch (err) {
    // Bu tek dizinin sayıları alınamazsa sayfanın kalanı yine çalışmalı;
    // "0 belge" göstermek, bilinmediğini göstermekten daha yanıltıcı olur.
    liveError.value = err instanceof Error ? err.message : 'Durum alınamadı.'
  }
})
</script>

<template>
  <section class="zeka-tab">
    <div class="quota-card">
      <div class="quota-head">
        <div>
          <strong>{{ searchService.name }}</strong>
          <small>Azure AI Search · {{ searchService.tier }} katman</small>
        </div>
        <Tag
          :value="`${searchService.indexUsed}/${searchService.indexQuota} dizin`"
          :severity="quotaFull ? 'warn' : 'success'"
        />
      </div>
      <div class="quota-track"><div class="quota-fill" :style="{ width: `${storagePct}%` }" /></div>
      <div class="quota-foot">
        <span>{{ searchService.storageUsedMb }} MB / {{ searchService.storageQuotaMb }} MB depo</span>
        <span>{{ searchService.dimensions }} boyut · {{ searchService.embedModel }} · {{ searchService.analyzer }}</span>
      </div>
      <p v-if="quotaFull" class="quota-warn">
        <i class="pi pi-exclamation-triangle" />
        Dizin kotası dolu. Free katmandan Basic'e <strong>yerinde yükseltme yok</strong>; yeni bir
        dizin gerekirse yeni servis kurup senkronu baştan koşturmak gerekir.
      </p>
    </div>

    <div class="index-grid">
      <button
        v-for="idx in indexes"
        :key="idx.id"
        type="button"
        class="index-card"
        :class="{ active: selected === idx.id }"
        @click="selected = idx.id"
      >
        <div class="index-top">
          <code>{{ idx.id }}</code>
          <span v-if="idx.liveCounts" class="live-chip"><span class="live-dot-sm" />canlı</span>
        </div>
        <div class="index-nums">
          <div>
            <strong v-if="docsOf(idx.id) !== null">{{ docsOf(idx.id) }}</strong>
            <strong v-else class="unknown">—</strong>
            <small>belge</small>
          </div>
          <div>
            <strong v-if="chunksOf(idx.id) !== null">{{ chunksOf(idx.id) }}</strong>
            <strong v-else class="unknown">—</strong>
            <small>parça</small>
          </div>
        </div>
        <span class="index-agents">
          <template v-for="(a, i) in idx.agents" :key="a">
            <span v-if="i > 0">, </span>{{ copyById(a)?.label }}
          </template>
        </span>
      </button>
    </div>

    <div class="index-detail">
      <div class="detail-meta">
        <div><dt>Kaynak</dt><dd>{{ current.source }}</dd></div>
        <div><dt>Senkron</dt><dd>{{ current.sync }}</dd></div>
      </div>

      <p class="rotate-warn">
        <i class="pi pi-key" />
        Anahtar rotasyonunda <strong>üç dizinin vectorizer'ı birden</strong> güncellenmeli. Biri
        atlanırsa o ajanın aramaları sessizce ölür, hata da vermez.
      </p>

      <!-- bilgi-sofrasi'nin belgeleri gerçek uçta ve düzenlenebilir; uzman
           dizinleri repodaki md dosyalarından türer, panelden düzenlenmez. -->
      <template v-if="current.liveCounts">
        <p v-if="liveError" class="detail-error">{{ liveError }}</p>
        <KbTab />
      </template>

      <template v-else>
        <p class="detail-hint">
          Bu dizinin kaynağı repodadır ve panelden düzenlenmez. İçerik değişince
          <code>python3 sync.py {{ current.id.replace('-bilgi', '') }}</code> koşturulur; senkron
          idempotenttir ve adı değişen dosyaların bayat parçalarını siler.
        </p>
        <table class="file-table">
          <thead>
            <tr><th>Belge</th><th>Dosya</th><th class="num">Parça</th><th class="num">Boyut</th></tr>
          </thead>
          <tbody>
            <tr v-for="f in current.files" :key="f.slug">
              <td>{{ f.title }}</td>
              <td><code>{{ f.slug }}.md</code></td>
              <td class="num">{{ f.chunks }}</td>
              <td class="num muted">{{ kb(f.bytes) }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2">{{ current.documents }} belge</td>
              <td class="num">{{ current.chunks }}</td>
              <td class="num muted">—</td>
            </tr>
          </tfoot>
        </table>
      </template>
    </div>
  </section>
</template>

<style scoped>
.zeka-tab { display: grid; gap: 18px; }

.quota-card { padding: 17px 19px; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); }
.quota-head { display: flex; gap: 14px; align-items: center; justify-content: space-between; }
.quota-head strong { display: block; font-size: 15px; }
.quota-head small { display: block; margin-top: 2px; color: var(--muted); font-size: 11.5px; }
.quota-track { height: 8px; margin-top: 14px; border-radius: 999px; background: #eef2ec; overflow: hidden; }
.quota-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #34d399, #059669); }
.quota-foot {
  display: flex; flex-wrap: wrap; gap: 6px 18px; justify-content: space-between;
  margin-top: 9px; color: var(--muted); font-size: 11.5px; font-variant-numeric: tabular-nums;
}
.quota-warn {
  display: flex; gap: 9px; align-items: flex-start;
  margin: 14px 0 0; padding: 11px 13px; border-radius: 11px; background: #fdf7e8;
  color: #6b5a34; font-size: 12px; line-height: 1.55;
}
.quota-warn i { margin-top: 2px; color: var(--amber); font-size: 12px; }

.index-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.index-card {
  display: grid; gap: 11px; padding: 15px 17px; border: 1px solid var(--line); border-radius: 15px;
  background: var(--paper); text-align: left; cursor: pointer; transition: border-color .18s ease;
}
.index-card:hover { border-color: #c3d8cb; }
.index-card.active { border-color: var(--green); box-shadow: 0 0 0 1px var(--green); }
.index-card:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }
.index-top { display: flex; gap: 8px; align-items: center; justify-content: space-between; }
.index-top code { color: var(--ink); font-size: 12.5px; font-weight: 800; }
.live-chip { display: flex; gap: 5px; align-items: center; color: var(--green); font-size: 10px; font-weight: 850; }
.live-dot-sm { width: 6px; height: 6px; border-radius: 50%; background: var(--green); }
.index-nums { display: flex; gap: 22px; }
.index-nums strong { font-size: 21px; font-variant-numeric: tabular-nums; }
.index-nums strong.unknown { color: #c2c4bb; }
.index-nums small { display: block; color: var(--muted); font-size: 10.5px; font-weight: 750; }
.index-agents { color: var(--muted); font-size: 11.5px; }

.index-detail { display: grid; gap: 15px; padding: 19px; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); }
.detail-meta { display: grid; gap: 11px; }
.detail-meta dt { color: var(--muted); font-size: 10px; font-weight: 850; letter-spacing: .07em; text-transform: uppercase; }
.detail-meta dd { margin: 3px 0 0; font-size: 12.5px; line-height: 1.5; }

.rotate-warn {
  display: flex; gap: 9px; align-items: flex-start; margin: 0;
  padding: 11px 13px; border-radius: 11px; background: #fbf0ee;
  color: #7a4437; font-size: 12px; line-height: 1.55;
}
.rotate-warn i { margin-top: 2px; color: var(--coral); font-size: 12px; }

.detail-hint { margin: 0; max-width: 84ch; color: var(--muted); font-size: 12.5px; line-height: 1.6; }
.detail-hint code { padding: 1px 5px; border-radius: 5px; background: #f0ece0; font-size: 11.5px; }
.detail-error { margin: 0; color: #b4541f; font-size: 12.5px; }

.file-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.file-table th {
  padding: 8px 10px; border-bottom: 1px solid var(--line);
  color: var(--muted); font-size: 10px; font-weight: 850; letter-spacing: .06em;
  text-align: left; text-transform: uppercase;
}
.file-table td { padding: 9px 10px; border-bottom: 1px solid #f0ece0; }
.file-table tfoot td { border-bottom: 0; color: var(--muted); font-weight: 800; }
.file-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.file-table .muted { color: var(--muted); }
.file-table code { color: var(--muted); font-size: 11.5px; }
</style>
