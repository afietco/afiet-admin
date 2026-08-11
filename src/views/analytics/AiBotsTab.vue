<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import LineChart from '../../components/LineChart.vue'
import EmptyState from '../../components/EmptyState.vue'
import AdminPlaceholder from '../../components/AdminPlaceholder.vue'
import { analyticsApi, type AiBotData } from '../../services/analytics'
import { SERIES_COLORS, fmt, shortDate, useAnalyticsStore } from './shared'

/**
 * AI tarayıcı erişimi (afiet-web `ai_bot_hits`).
 *
 * GRAFİK BİLEREK TEK SERİLİ: bot başına ayrı çizgi çizmek 16 olası tarayıcı
 * için kategorik renk üretmeyi gerektirirdi, evin paleti ise iki renklidir ve
 * kategorik renk döndürülmez. Kimlik sorusu ("hangi bot") tabloya, değişim
 * sorusu ("ne kadar geliyor") tek çizgiye ait. Tek seri olduğu için lejant da
 * yok, başlık serinin adını söylüyor.
 *
 * Grafik ancak EN AZ İKİ GÜN veri varken çizilir: tek noktalı bir zaman serisi
 * trend gibi görünür ama hiçbir şey söylemez. Seri, kaydın başladığı günden
 * bugüne kadar sıfırlarla doldurulur; ondan ÖNCESİ sıfır değil "veri yok"tur
 * ve uydurulmaz.
 */
const AMAC_LABEL: Record<string, string> = {
  arama: 'Arama',
  egitim: 'Eğitim',
  kullanici: 'Kullanıcı getirme',
}

const { state } = useAnalyticsStore()
const data = ref<AiBotData | null>(null)
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    data.value = await analyticsApi.aiBots(state.range)
  } catch {
    data.value = null
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(() => state.range, load)

const toplam = computed(() => data.value?.toplam ?? 0)

const cards = computed(() => {
  const d = data.value
  if (!d) return []
  const ok = d.botlar.reduce((s, b) => s + b.ok, 0)
  const hata = d.botlar.reduce((s, b) => s + b.bulunamadi + b.kisitlandi + b.sunucuHatasi, 0)
  const arama = d.botlar.filter((b) => b.amac === 'arama').length
  return [
    { label: 'Bot isteği', value: fmt(d.toplam), tone: 'green', icon: 'pi pi-server', note: 'seçili aralıkta' },
    { label: 'Farklı bot', value: fmt(d.botlar.length), tone: 'blue', icon: 'pi pi-android', note: `${arama} tanesi arama botu` },
    { label: 'Başarılı (2xx)', value: fmt(ok), tone: 'amber', icon: 'pi pi-check-circle', note: d.toplam ? `%${Math.round((ok / d.toplam) * 100)} isteğin` : 'henüz istek yok' },
    { label: 'Hata (4xx/5xx)', value: fmt(hata), tone: 'coral', icon: 'pi pi-exclamation-triangle', note: hata ? 'aşağıda dökümü var' : 'temiz' },
  ]
})

/** gun+bot kırılımını güne indir, kayıt başladığı günden bugüne sıfırlarla doldur. */
const gunlukToplam = computed(() => {
  const g = data.value?.gunluk ?? []
  if (!g.length) return [] as { gun: string; istek: number }[]
  const say = new Map<string, number>()
  for (const r of g) say.set(r.gun, (say.get(r.gun) ?? 0) + r.istek)
  const gunler = [...say.keys()].sort()
  const out: { gun: string; istek: number }[] = []
  const imlec = new Date(`${gunler[0]}T00:00:00Z`)
  const bugun = new Date()
  while (imlec <= bugun) {
    const k = imlec.toISOString().slice(0, 10)
    out.push({ gun: k, istek: say.get(k) ?? 0 })
    imlec.setUTCDate(imlec.getUTCDate() + 1)
  }
  return out
})

const grafikVar = computed(() => gunlukToplam.value.length >= 2)
const chartLabels = computed(() => gunlukToplam.value.map((p) => shortDate(p.gun)))
const chartSeries = computed(() => [
  { label: 'Bot isteği', color: SERIES_COLORS.views, values: gunlukToplam.value.map((p) => p.istek) },
])

const tamKapsanan = computed(() => new Set(data.value?.kapsam.tamKapsananYollar ?? []))
</script>

<template>
  <div class="tab-body">
    <template v-if="data">
      <template v-if="toplam > 0">
        <section class="metric-grid" aria-label="AI tarayıcı özeti">
          <article v-for="c in cards" :key="c.label" class="metric-card" :class="c.tone">
            <div class="metric-top"><span>{{ c.label }}</span><i :class="c.icon" /></div>
            <strong>{{ c.value }}</strong>
            <div class="metric-foot"><small>{{ c.note }}</small></div>
          </article>
        </section>

        <article v-if="grafikVar" class="panel-card pad chart-card">
          <div class="panel-title sm"><div><p>ZAMAN SERİSİ</p><h2>Günlük bot isteği</h2></div></div>
          <LineChart :labels="chartLabels" :series="chartSeries" :height="210" />
        </article>

        <article class="panel-card pad">
          <div class="panel-title sm"><div><p>KİM GELDİ</p><h2>Tarayıcılar</h2></div></div>
          <DataTable :value="data.botlar" data-key="bot" striped-rows removable-sort :default-sort-order="-1" sort-field="istek">
            <template #empty><EmptyState icon="pi pi-android" title="Bu aralıkta bot yok" description="Seçili aralıkta tanınan bir AI tarayıcı isteği kaydedilmedi." /></template>
            <Column header="Bot" sortable field="bot"><template #body="{ data: r }"><strong>{{ r.bot }}</strong></template></Column>
            <Column header="Sahip" sortable field="sahip"><template #body="{ data: r }"><span>{{ r.sahip ?? '·' }}</span></template></Column>
            <Column header="Amaç" sortable field="amac"><template #body="{ data: r }"><span class="date-cell">{{ r.amac ? AMAC_LABEL[r.amac] : '·' }}</span></template></Column>
            <Column header="İstek" sortable field="istek"><template #body="{ data: r }"><strong class="num-cell">{{ fmt(r.istek) }}</strong></template></Column>
            <Column header="2xx" sortable field="ok"><template #body="{ data: r }"><span class="num-cell">{{ fmt(r.ok) }}</span></template></Column>
            <Column header="404" sortable field="bulunamadi"><template #body="{ data: r }"><span class="num-cell">{{ r.bulunamadi ? fmt(r.bulunamadi) : '·' }}</span></template></Column>
            <Column header="5xx" sortable field="sunucuHatasi"><template #body="{ data: r }"><span class="num-cell">{{ r.sunucuHatasi ? fmt(r.sunucuHatasi) : '·' }}</span></template></Column>
            <Column header="Son görülme" sortable field="son"><template #body="{ data: r }"><span class="date-cell">{{ shortDate(r.son, true) }}</span></template></Column>
          </DataTable>
        </article>

        <div class="split-grid">
          <article class="panel-card pad">
            <div class="panel-title sm"><div><p>TARAYICI NABZI</p><h2>Giriş dosyaları</h2></div></div>
            <ul class="src-list tight">
              <li v-for="p in data.nabiz" :key="p.path">
                <div class="src-row">
                  <span class="src-name mono">{{ p.path }}<em v-if="tamKapsanan.has(p.path)" class="tam-rozet" title="CDN cache'i yok; her istek kaydedilir">tam</em></span>
                  <span class="src-val">{{ fmt(p.istek) }}</span>
                </div>
              </li>
              <li v-if="!data.nabiz.length"><span class="date-cell">Henüz giriş dosyası isteği yok.</span></li>
            </ul>
          </article>

          <article class="panel-card pad">
            <div class="panel-title sm"><div><p>EN ÇOK İSTENEN</p><h2>Yollar</h2></div></div>
            <ul class="src-list tight">
              <li v-for="p in data.yollar.slice(0, 8)" :key="p.path">
                <div class="src-row"><span class="src-name mono">{{ p.path }}</span><span class="src-val">{{ fmt(p.istek) }}</span></div>
              </li>
            </ul>
          </article>
        </div>

        <article v-if="data.sonHatalar.length" class="panel-card pad">
          <div class="panel-title sm"><div><p>BOTUN GÖRDÜĞÜ</p><h2>Son hatalar</h2></div></div>
          <DataTable :value="data.sonHatalar" striped-rows>
            <Column header="Zaman"><template #body="{ data: r }"><span class="date-cell">{{ shortDate(r.ts, true) }}</span></template></Column>
            <Column header="Bot"><template #body="{ data: r }"><span>{{ r.bot }}</span></template></Column>
            <Column header="Yol"><template #body="{ data: r }"><span class="src-name mono">{{ r.path }}</span></template></Column>
            <Column header="Durum"><template #body="{ data: r }"><strong class="num-cell">{{ r.status }}</strong></template></Column>
          </DataTable>
        </article>
      </template>

      <EmptyState
        v-else
        icon="pi pi-android"
        title="Henüz bot isteği kaydedilmedi"
        description="Kayıt 11 Ağustos 2026'da başladı ve geriye dönük veri üretilemiyor. AI tarayıcılar bu ölçekte bir siteye seyrek uğrar; ilk satırların düşmesi gün alabilir."
      />

      <p class="kapsam-not"><i class="pi pi-info-circle" /> {{ data.kapsam.not }}</p>
    </template>

    <template v-else>
      <div v-if="loading" class="seo-loading"><i class="pi pi-spin pi-spinner" /> Bot kaydı yükleniyor…</div>
      <AdminPlaceholder
        v-else
        icon="pi pi-android"
        title="Bot kaydı getirilemedi"
        description="Veri şu an alınamadı. Bağlantını kontrol edip yeniden dene."
        retryable
        :loading="loading"
        @retry="load"
      />
    </template>
  </div>
</template>

<style scoped>
/* Global `.src-name` capitalize'ı kaynak adları için yazılmıştı ve burada
   yolları "/Robots.Txt", "/Hesapla/Bmi" diye gösteriyordu. Yol büyük-küçük
   harfe duyarlı bir veridir; yazıldığı gibi kalır. Aynı gerekçeyle
   .detail-body ve .src-list.telemetry için de override var (main.css). */
.src-name {
  text-transform: none;
}
.kapsam-not {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  margin: 0;
  padding: 0.75rem 0.9rem;
  border: 1px solid var(--p-surface-200);
  border-radius: 10px;
  background: var(--p-surface-50);
  color: var(--p-text-muted-color);
  font-size: 0.8rem;
  line-height: 1.5;
}
.kapsam-not i {
  margin-top: 0.15rem;
}
.tam-rozet {
  margin-left: 0.4rem;
  padding: 0.05rem 0.35rem;
  border-radius: 999px;
  background: var(--p-surface-200);
  color: var(--p-text-muted-color);
  font-size: 0.65rem;
  font-style: normal;
  letter-spacing: 0.02em;
}
</style>

<script lang="ts">
export default { name: 'AiBotsTab' }
</script>
