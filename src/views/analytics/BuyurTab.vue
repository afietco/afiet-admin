<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Tag from 'primevue/tag'
import LineChart from '../../components/LineChart.vue'
import EmptyState from '../../components/EmptyState.vue'
import AdminPlaceholder from '../../components/AdminPlaceholder.vue'
import { analyticsApi, type BuyurData, type BuyurGrup } from '../../services/analytics'
import { SERIES_COLORS, fmt, pct, shortDate, useAnalyticsStore } from './shared'

/**
 * buyur.afiet.co - funnel sayfasının kendi istatistiği.
 *
 * TEKİL ZİYARETÇİ YOK ve olmayacak: o sayfanın ölçümü çerezsizdir, ziyaretçi
 * kimliği hiç üretilmez. Buradaki "tıklama oranı" da bu yüzden kişi başına
 * değil, görüntüleme başınadır (tık / görüntüleme). Kart notlarında bu
 * açıkça yazar, yoksa sayı afiet.co'nun ziyaretçi bazlı oranlarıyla yan yana
 * yanlış okunur.
 *
 * Sekme kendi verisini çeker (InstagramTab/AiBotsTab deseni): afiet.co'nun
 * `analytics_events` verisiyle ortak hiçbir alanı yok, ortak store'a
 * takılması yalnız kafa karıştırırdı. Aralık seçimi ortaktır.
 */
const GRUP_TONE: Record<BuyurGrup, string> = {
  magaza: 'success',
  icerik: 'info',
  sosyal: 'warn',
  diger: 'secondary',
}
/** Etiketler uçtan da geliyor (`gruplar[].label`) ama satır başına orada
 *  arama yapmak tabloyu okunmaz hâle getiriyordu; iki yer de aynı dört
 *  kelimeyi söylüyor ve kelimeler değişmiyor. */
const GRUP_LABEL: Record<BuyurGrup, string> = {
  magaza: 'Mağaza',
  icerik: 'İçerik',
  sosyal: 'Sosyal',
  diger: 'Diğer',
}

const { state } = useAnalyticsStore()
const data = ref<BuyurData | null>(null)
const loading = ref(false)
const hata = ref(false)

async function load() {
  loading.value = true
  hata.value = false
  try {
    data.value = await analyticsApi.buyur(state.range)
  } catch {
    data.value = null
    hata.value = true
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(() => state.range, load)

const bosMu = computed(() => !!data.value && data.value.totals.goruntuleme === 0 && data.value.totals.tik === 0)

const enCokTiklanan = computed(() => data.value?.baglantilar[0] ?? null)

/** Android payı ayrı hesaplanır: Play'i ne zaman açacağımızın tek göstergesi. */
const androidPayi = computed(() => {
  const os = data.value?.isletimSistemleri ?? []
  const toplam = os.reduce((s, r) => s + r.sayi, 0)
  const android = os.find((r) => r.key === 'Android')?.sayi ?? 0
  return toplam > 0 ? Math.round((android / toplam) * 100) : 0
})

const cards = computed(() => {
  const d = data.value
  if (!d) return []
  return [
    {
      label: 'Görüntüleme',
      value: fmt(d.totals.goruntuleme),
      tone: 'green',
      icon: 'pi pi-eye',
      note: 'sayfa açılışı (tekil kişi değil)',
      delta: d.totals.deltaGoruntuleme,
    },
    {
      label: 'Tık',
      value: fmt(d.totals.tik),
      tone: 'blue',
      icon: 'pi pi-external-link',
      note: 'dışarı giden bağlantı',
      delta: d.totals.deltaTik,
    },
    {
      label: 'Tıklama oranı',
      value: `%${d.totals.tikOrani}`,
      tone: 'amber',
      icon: 'pi pi-percentage',
      note: 'görüntüleme başına tık',
      delta: null,
    },
    {
      label: 'Android payı',
      value: `%${androidPayi.value}`,
      tone: 'coral',
      icon: 'pi pi-android',
      note: 'görüntülemelerin Android olanı',
      delta: null,
    },
  ]
})

/**
 * Dört kırılım DÖRT AYRI kart. Önce cihaz ve işletim sistemi tek listede
 * alt alta duruyordu; aynı görüntülemeler iki kez sayılmış gibi okunuyordu
 * ("Mobil 5, Masaüstü 1, iOS 4, Android 1, macOS 1" tek liste hâlinde altı
 * satır, toplamı 12). Yüzdeler de her kartın kendi toplamına göre.
 */
const kirilimlar = computed(() => {
  const d = data.value
  if (!d) return []
  const kart = (ustBaslik: string, baslik: string, icon: string, tone: string, satirlar: { key: string; label: string; sayi: number }[]) => ({
    ustBaslik,
    baslik,
    icon,
    tone,
    satirlar,
    toplam: satirlar.reduce((s, r) => s + r.sayi, 0),
  })
  return [
    kart('KİM AÇTI', 'Cihaz', 'pi pi-mobile', 'green', d.cihazlar),
    kart('KİM AÇTI', 'İşletim sistemi', 'pi pi-desktop', 'violet', d.isletimSistemleri),
    kart('NEREDEN', 'Kaynak', 'pi pi-directions', 'coral', d.kaynaklar.map((r) => ({ key: r.host, label: r.label, sayi: r.sayi }))),
    kart('NEREDEN', 'Ülke', 'pi pi-globe', 'green', d.ulkeler),
  ]
})

const chartLabels = computed(() => (data.value?.seri ?? []).map((p) => shortDate(p.gun)))
const chartSeries = computed(() => [
  { label: 'Görüntüleme', color: SERIES_COLORS.views, values: (data.value?.seri ?? []).map((p) => p.goruntuleme) },
  { label: 'Tık', color: SERIES_COLORS.visitors, values: (data.value?.seri ?? []).map((p) => p.tik) },
])
</script>

<template>
  <div class="tab-body">
    <template v-if="data && !bosMu">
      <section class="metric-grid" aria-label="buyur sayfası özeti">
        <article v-for="c in cards" :key="c.label" class="metric-card" :class="c.tone">
          <div class="metric-top"><span>{{ c.label }}</span><i :class="c.icon" /></div>
          <strong>{{ c.value }}</strong>
          <div class="metric-foot">
            <small>{{ c.note }}</small>
            <span v-if="c.delta !== null" class="delta" :class="c.delta >= 0 ? 'up' : 'down'">
              <i :class="c.delta >= 0 ? 'pi pi-arrow-up-right' : 'pi pi-arrow-down-right'" />%{{ Math.abs(c.delta) }}
            </span>
          </div>
        </article>
      </section>

      <article class="panel-card pad chart-card">
        <div class="panel-title sm">
          <div><p>ZAMAN SERİSİ</p><h2>Görüntüleme &amp; tık</h2></div>
          <span class="legend"><span class="lg views" /> görüntüleme <span class="lg visitors" /> tık</span>
        </div>
        <LineChart :labels="chartLabels" :series="chartSeries" :height="210" />
      </article>

      <article class="panel-card pad">
        <div class="panel-title sm">
          <div>
            <p>NEREYE GİDİYORLAR</p>
            <h2>Bağlantılar</h2>
          </div>
          <span v-if="enCokTiklanan" class="date-cell">en çok: {{ enCokTiklanan.etiket }}</span>
        </div>
        <DataTable :value="data.baglantilar" data-key="anahtar" striped-rows removable-sort sort-field="tik" :default-sort-order="-1">
          <template #empty>
            <EmptyState
              icon="pi pi-external-link"
              title="Bu aralıkta tık yok"
              description="Sayfa görüntülendi ama hiçbir bağlantıya tıklanmadı."
            />
          </template>
          <Column header="Bağlantı" sortable field="etiket">
            <template #body="{ data: r }"><strong>{{ r.etiket }}</strong></template>
          </Column>
          <Column header="Grup" sortable field="grup">
            <template #body="{ data: r }">
              <Tag :value="GRUP_LABEL[r.grup as BuyurGrup] ?? r.grup" :severity="GRUP_TONE[r.grup as BuyurGrup]" />
            </template>
          </Column>
          <Column header="Tık" sortable field="tik">
            <template #body="{ data: r }"><strong class="num-cell">{{ fmt(r.tik) }}</strong></template>
          </Column>
          <Column header="Pay" sortable field="pay">
            <template #body="{ data: r }"><span class="num-cell">%{{ r.pay }}</span></template>
          </Column>
          <Column header="Anahtar">
            <template #body="{ data: r }"><span class="buyur-key mono">{{ r.anahtar }}</span></template>
          </Column>
        </DataTable>
      </article>

      <div class="split-grid">
        <article v-for="k in kirilimlar" :key="k.baslik" class="panel-card pad">
          <div class="panel-title sm">
            <div><p>{{ k.ustBaslik }}</p><h2>{{ k.baslik }}</h2></div>
            <i :class="k.icon" class="panel-glyph" />
          </div>
          <ul v-if="k.satirlar.length" class="src-list tight buyur">
            <li v-for="r in k.satirlar" :key="r.key">
              <div class="src-row">
                <span class="src-name">{{ r.label }}</span>
                <span class="src-val">{{ fmt(r.sayi) }} · %{{ pct(r.sayi, k.toplam) }}</span>
              </div>
              <div class="mini-track"><div class="mini-fill" :class="k.tone" :style="{ width: `${pct(r.sayi, k.toplam)}%` }" /></div>
            </li>
          </ul>
          <p v-else class="note-line subtle"><i class="pi pi-info-circle" /> Bu kırılım için kayıt yok.</p>
        </article>
      </div>
    </template>

    <!-- Veri geldi ama boş: sayfa yayında, henüz kimse açmamış. Bu bir hata
         DEĞİL, o yüzden "yeniden dene" düğmesi de gösterilmiyor. -->
    <EmptyState
      v-else-if="bosMu"
      icon="pi pi-link"
      title="buyur.afiet.co henüz ziyaret almamış"
      description="Seçili aralıkta sayfa açılışı kaydedilmedi. Bağlantıyı sosyal hesapların biyografisine koyduktan sonra burası dolmaya başlar."
    />

    <div v-else-if="loading" class="seo-loading"><i class="pi pi-spin pi-spinner" /> buyur verisi yükleniyor…</div>

    <AdminPlaceholder
      v-else
      icon="pi pi-link"
      title="buyur verisi getirilemedi"
      description="Veri şu an alınamadı. Bağlantını kontrol edip yeniden dene."
      retryable
      :loading="loading"
      @retry="load"
    />
  </div>
</template>

<script lang="ts">
export default { name: 'BuyurTab' }
</script>
