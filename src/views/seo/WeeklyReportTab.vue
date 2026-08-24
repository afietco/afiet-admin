<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import AdminPlaceholder from '../../components/AdminPlaceholder.vue'
import EmptyState from '../../components/EmptyState.vue'
import { fmt, shortDate } from '../analytics/shared'
import { indexStateLabel, seoWatchApi, type SeoAction, type SeoReportDetail, type SeoWatchOverview } from '../../services/seoWatch'

/**
 * SEO nöbetçisinin haftalık raporu ve yürüyen yapılacaklar listesi.
 *
 * İki ayrı zaman ölçeği tek ekranda: RAPOR bir haftanın fotoğrafıdır ve hafta
 * seçicisiyle geriye gidilir; YAPILACAKLAR ise haftalar üstü tek bir listedir,
 * seçili haftaya göre değişmez. Karışmasınlar diye listenin başlığı bunu
 * söylüyor: aynı ekranda iki farklı "şimdi" var.
 */

const overview = ref<SeoWatchOverview | null>(null)
const report = ref<SeoReportDetail | null>(null)
const selectedId = ref<number | null>(null)
const loading = ref(true)
const reportLoading = ref(false)
const running = ref(false)
const failed = ref(false)
const newTitle = ref('')
const adding = ref(false)
const showDone = ref(false)

const toast = useToast()
const confirm = useConfirm()

async function load() {
  loading.value = true
  failed.value = false
  try {
    const data = await seoWatchApi.overview()
    overview.value = data
    report.value = data.latest
    selectedId.value = data.latest?.id ?? null
  } catch {
    overview.value = null
    failed.value = true
  } finally {
    loading.value = false
  }
}
onMounted(load)

const weekOptions = computed(() =>
  (overview.value?.reports ?? []).map((r) => ({ value: r.id, label: `${shortDate(r.weekStart, true)} haftası` })),
)

async function selectWeek(id: number) {
  if (id === selectedId.value) return
  selectedId.value = id
  reportLoading.value = true
  try {
    report.value = await seoWatchApi.report(id)
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Rapor açılamadı', detail: err instanceof Error ? err.message : '', life: 4000 })
  } finally {
    reportLoading.value = false
  }
}

/**
 * Elle tetikleme. Sunucu işi ayrık koşturur (ölçüm + ajan + iki mail birkaç
 * dakika sürer), o yüzden burada "bitti" DENMEZ: iş bittiğinde rapor bu
 * listeye düşer, kullanıcı yenileyerek görür.
 */
async function runNow() {
  running.value = true
  try {
    await seoWatchApi.run()
    toast.add({
      severity: 'success',
      summary: 'Rapor üretimi başladı',
      detail: 'Ölçüm, ajan yorumu ve mailler birkaç dakika sürer. Bittiğinde bu listede görünür.',
      life: 6000,
    })
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Başlatılamadı', detail: err instanceof Error ? err.message : '', life: 4000 })
  } finally {
    running.value = false
  }
}

// ── yapılacaklar ────────────────────────────────────────────────────────────

// En uzun süredir açık olan üstte: bekleyen iş, yeni işin önüne geçer.
const openActions = computed(() => (overview.value?.actions ?? []).filter((a) => !a.done).sort((a, b) => b.weeks - a.weeks || a.id - b.id))
const doneActions = computed(() =>
  (overview.value?.actions ?? []).filter((a) => a.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')),
)
const doneCount = computed(() => doneActions.value.length)
const totalCount = computed(() => overview.value?.actions.length ?? 0)

/**
 * İşaretleme ÖNCE ekranda olur, sonra sunucuya gider: bir kutuyu işaretlemek
 * ağ turu kadar beklemeye değmez. Sunucu reddederse madde eski hâline döner
 * ve sebep toast'ta söylenir.
 */
async function toggle(action: SeoAction, done: boolean) {
  const before = action.done
  action.done = done
  action.doneAt = done ? new Date().toISOString() : null
  try {
    await seoWatchApi.setActionDone(action.id, done)
  } catch (err) {
    action.done = before
    toast.add({ severity: 'error', summary: 'İşaretlenemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
  }
}

async function addAction() {
  const title = newTitle.value.trim()
  if (!title || adding.value) return
  adding.value = true
  try {
    const created = await seoWatchApi.addAction({ title, why: '', where: '' })
    overview.value?.actions.push(created)
    newTitle.value = ''
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Eklenemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
  } finally {
    adding.value = false
  }
}

function removeAction(action: SeoAction) {
  confirm.require({
    header: 'Maddeyi sil',
    message: `"${action.title}" listeden tamamen kaldırılsın mı?`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Vazgeç',
    acceptLabel: 'Sil',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await seoWatchApi.deleteAction(action.id)
        if (overview.value) overview.value.actions = overview.value.actions.filter((a) => a.id !== action.id)
      } catch (err) {
        toast.add({ severity: 'error', summary: 'Silinemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
      }
    },
  })
}

/** "3 haftadır açık" rozeti; ilk haftasında olan madde rozet almaz. */
function ageLabel(action: SeoAction): string {
  return action.weeks > 1 ? `${action.weeks} haftadır açık` : ''
}

// ── raporun ölçümleri ───────────────────────────────────────────────────────

const cards = computed(() => {
  const s = report.value?.snapshot.search
  if (!s) return []
  const idx = report.value?.snapshot.index
  const indexed = idx?.now.indexed ?? 0
  const indexedBefore = idx?.before.indexed ?? 0
  return [
    { label: 'Tıklama', value: fmt(s.current.clicks), delta: s.current.clicks - s.previous.clicks, tone: 'green', icon: 'pi pi-external-link' },
    { label: 'Gösterim', value: fmt(s.current.impressions), delta: s.current.impressions - s.previous.impressions, tone: 'blue', icon: 'pi pi-eye' },
    { label: 'Marka dışı sorgu', value: fmt(s.current.nonBrand), delta: s.current.nonBrand - s.previous.nonBrand, tone: 'violet', icon: 'pi pi-search' },
    { label: 'İndeksteki sayfa', value: fmt(indexed), delta: indexed - indexedBefore, tone: 'amber', icon: 'pi pi-file' },
    // Pozisyonda küçük olan iyi: fark ters işaretle verilir ki yeşil hep
    // "iyileşti" demeye devam etsin.
    { label: 'Ort. pozisyon', value: s.current.position.toLocaleString('tr-TR'), delta: round1(s.previous.position - s.current.position), tone: 'coral', icon: 'pi pi-sort-numeric-down' },
  ]
})

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function deltaText(delta: number): string {
  if (!delta) return 'değişmedi'
  const sign = delta > 0 ? '+' : '-'
  return `${sign}${Math.abs(delta).toLocaleString('tr-TR')}`
}

const window = computed(() => {
  const c = report.value?.snapshot.search.current
  return c ? `${shortDate(c.start)} - ${shortDate(c.end)}` : ''
})

const indexRows = computed(() => report.value?.snapshot.index.sections ?? [])
const changedRows = computed(() => report.value?.snapshot.index.changed ?? [])
const botRows = computed(() => report.value?.snapshot.bots.rows ?? [])
const queryRows = computed(() => report.value?.snapshot.search.topQueries ?? [])
</script>

<template>
  <div class="tab-body">
    <template v-if="overview">
      <div class="seo-lead">
        <p class="analytics-note">
          <i class="pi pi-flag" /> SEO nöbetçisi her pazartesi 08:00'de ölçümü alır, ajana yorumlatır ve maille gönderir. Aynı rapor burada.
        </p>
        <Select
          v-if="weekOptions.length"
          :model-value="selectedId"
          :options="weekOptions"
          option-label="label"
          option-value="value"
          aria-label="Hafta"
          @update:model-value="selectWeek"
        />
        <Button label="Rapor üret" icon="pi pi-play" outlined :loading="running" @click="runNow" />
      </div>

      <!-- Yapılacaklar önce: rapor haftalık okunur, liste her gün kullanılır. -->
      <section class="panel-card pad todo-card">
        <div class="panel-title sm todo-head">
          <div>
            <p>YAPILACAKLAR</p>
            <h2>Yürüyen liste</h2>
          </div>
          <span class="todo-count">{{ doneCount }}/{{ totalCount }} tamam</span>
        </div>
        <p class="todo-note">
          Hafta seçiminden bağımsız. Ajan her hafta listesini yeniler; tamamlanmayan madde taşınır, tamamlanan aşağı düşer.
        </p>

        <ul v-if="openActions.length" class="todo-list">
          <li v-for="a in openActions" :key="a.id" class="todo-item">
            <Checkbox :model-value="a.done" binary :input-id="`todo-${a.id}`" @update:model-value="toggle(a, $event)" />
            <div class="todo-body">
              <label :for="`todo-${a.id}`">{{ a.title }}</label>
              <p v-if="a.why" class="todo-why">{{ a.why }}</p>
              <div class="todo-meta">
                <span class="chip" :class="a.source === 'elle' ? 'chip-manual' : ''">{{ a.source === 'elle' ? 'elle eklendi' : 'ajan' }}</span>
                <span v-if="a.where" class="todo-where"><i class="pi pi-map-marker" /> {{ a.where }}</span>
                <span v-if="ageLabel(a)" class="todo-age">{{ ageLabel(a) }}</span>
              </div>
            </div>
            <Button
              v-if="a.source === 'elle'"
              icon="pi pi-trash"
              text
              rounded
              severity="danger"
              aria-label="Maddeyi sil"
              @click="removeAction(a)"
            />
          </li>
        </ul>
        <!-- İki farklı boşluk, iki farklı cümle: hiç madde olmaması "hepsi
             bitti" DEĞİLDİR. Liste ilk kez, raporun teslim edildiği anda
             dolar; o zamana kadar "hepsi kapandı" demek yalan olurdu. -->
        <EmptyState
          v-else-if="totalCount"
          icon="pi pi-check-circle"
          title="Açık iş yok"
          description="Listedeki maddelerin hepsi kapandı. Pazartesi yeni liste gelir."
        />
        <EmptyState
          v-else
          icon="pi pi-list"
          title="Liste henüz oluşmadı"
          description="Yapılacaklar ilk raporla birlikte düşer. Beklemek istemiyorsan 'Rapor üret' bu haftanın maddelerini listeye işler; rapor maili zaten gittiyse tekrar gönderilmez."
        />

        <form class="todo-add" @submit.prevent="addAction">
          <InputText v-model="newTitle" placeholder="Kendi maddeni yaz…" aria-label="Yeni yapılacak" />
          <Button type="submit" label="Ekle" icon="pi pi-plus" outlined :disabled="!newTitle.trim()" :loading="adding" />
        </form>

        <div v-if="doneCount" class="todo-done-block">
          <button type="button" class="todo-toggle" @click="showDone = !showDone">
            <i :class="showDone ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
            Tamamlananlar ({{ doneCount }})
          </button>
          <ul v-if="showDone" class="todo-list done">
            <li v-for="a in doneActions" :key="a.id" class="todo-item">
              <Checkbox :model-value="a.done" binary :input-id="`todo-${a.id}`" @update:model-value="toggle(a, $event)" />
              <div class="todo-body">
                <label :for="`todo-${a.id}`">{{ a.title }}</label>
                <div class="todo-meta">
                  <span class="chip" :class="a.source === 'elle' ? 'chip-manual' : ''">{{ a.source === 'elle' ? 'elle eklendi' : 'ajan' }}</span>
                  <span v-if="a.doneAt" class="todo-age">{{ shortDate(a.doneAt) }} tamamlandı</span>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <!-- Haftanın raporu -->
      <template v-if="report">
        <section class="panel-card pad verdict-card">
          <div class="verdict-head">
            <div>
              <p>{{ shortDate(report.weekStart, true) }} HAFTASI</p>
              <h2>Nöbetçinin hükmü</h2>
            </div>
            <span v-if="!report.mailed" class="chip">mail gitmedi</span>
          </div>
          <blockquote v-if="report.verdict">{{ report.verdict }}</blockquote>
          <p v-else class="todo-note">Ajan yorum üretemedi; raporun sayıları yine de doğru.</p>
          <small>Ölçüm penceresi: {{ window }} · Google verisi {{ shortDate(report.snapshot.search.dataThrough) }} gününe kadar tam.</small>
        </section>

        <section class="metric-grid five" aria-label="Haftanın ölçümleri">
          <article v-for="c in cards" :key="c.label" class="metric-card" :class="c.tone">
            <div class="metric-top"><span>{{ c.label }}</span><i :class="c.icon" /></div>
            <strong>{{ c.value }}</strong>
            <div class="metric-foot">
              <small>önceki hafta</small>
              <span class="delta" :class="c.delta > 0 ? 'up' : c.delta < 0 ? 'down' : ''">{{ deltaText(c.delta) }}</span>
            </div>
          </article>
        </section>

        <div class="split-grid">
          <section class="table-card">
            <div class="table-toolbar flush" style="padding: 15px 18px"><span class="result-count" style="margin-left: 0">İNDEKS KAPSAMI</span></div>
            <DataTable :value="indexRows" striped-rows>
              <template #empty><EmptyState icon="pi pi-sitemap" title="Ölçüm yok" description="İndeks taraması bu hafta veri yazmadı." /></template>
              <Column header="Bölüm" field="section" />
              <Column header="İndekste">
                <template #body="{ data: row }"><strong class="num-cell">{{ row.indexed }}</strong> <span class="num-cell">/ {{ row.total }}</span></template>
              </Column>
            </DataTable>
          </section>

          <section class="table-card">
            <div class="table-toolbar flush" style="padding: 15px 18px"><span class="result-count" style="margin-left: 0">BU HAFTA DURUMU DEĞİŞEN SAYFALAR</span></div>
            <DataTable :value="changedRows" striped-rows>
              <template #empty><EmptyState icon="pi pi-sync" title="Değişen yok" description="Hiçbir sayfanın indeks durumu bu hafta değişmedi." /></template>
              <Column header="Sayfa" style="min-width: 8rem"><template #body="{ data: row }"><span class="path mono">{{ row.url }}</span></template></Column>
              <Column header="Değişim"><template #body="{ data: row }"><span class="num-cell">{{ indexStateLabel(row.from) }} → {{ indexStateLabel(row.to) }}</span></template></Column>
            </DataTable>
          </section>
        </div>

        <div class="split-grid">
          <section class="table-card">
            <div class="table-toolbar flush" style="padding: 15px 18px"><span class="result-count" style="margin-left: 0">AI TARAYICILARI</span></div>
            <DataTable :value="botRows" striped-rows>
              <template #empty><EmptyState icon="pi pi-android" title="Ziyaret yok" description="Bu hafta hiçbir AI tarayıcısı gelmedi." /></template>
              <Column header="Bot" field="bot" />
              <Column header="İstek"><template #body="{ data: row }"><strong class="num-cell">{{ fmt(row.requests) }}</strong></template></Column>
              <Column header="Hata"><template #body="{ data: row }"><span class="num-cell">{{ row.errors }}</span></template></Column>
            </DataTable>
          </section>

          <section class="table-card">
            <div class="table-toolbar flush" style="padding: 15px 18px"><span class="result-count" style="margin-left: 0">EN ÇOK GÖSTERİM ALAN SORGULAR</span></div>
            <DataTable :value="queryRows" striped-rows>
              <template #empty><EmptyState icon="pi pi-search" title="Sorgu yok" description="Bu hafta arama sonuçlarında görünmedik." /></template>
              <Column header="Sorgu" style="min-width: 8rem"><template #body="{ data: row }"><span class="path">{{ row.key }}</span></template></Column>
              <Column header="Gösterim"><template #body="{ data: row }"><strong class="num-cell">{{ fmt(row.impressions) }}</strong></template></Column>
              <Column header="Poz."><template #body="{ data: row }"><span class="num-cell">{{ row.position.toLocaleString('tr-TR') }}</span></template></Column>
            </DataTable>
          </section>
        </div>
      </template>

      <div v-else-if="reportLoading" class="seo-loading"><i class="pi pi-spin pi-spinner" /> Rapor açılıyor…</div>
      <EmptyState
        v-else
        icon="pi pi-inbox"
        title="Henüz rapor yok"
        description="İlk rapor pazartesi 08:00'de üretilir. Beklemek istemiyorsan 'Rapor üret' ile şimdi çalıştır."
      />
    </template>

    <div v-else-if="loading" class="seo-loading"><i class="pi pi-spin pi-spinner" /> Rapor yükleniyor…</div>
    <AdminPlaceholder
      v-else-if="failed"
      icon="pi pi-flag"
      title="Rapor getirilemedi"
      description="Veri şu an alınamadı. Bağlantını kontrol edip yeniden dene."
      retryable
      :loading="loading"
      @retry="load"
    />
  </div>
</template>
