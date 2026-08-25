<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import { analyticsApi, type AnalyticsData } from '../../services/analytics'
import { CHANNEL_TONE, fmt, pct } from './shared'
import { useAnalyticsStore } from './shared'

const props = defineProps<{ data: AnalyticsData }>()
const { state } = useAnalyticsStore()

const channelTotal = computed(() => props.data.channels.reduce((s, c) => s + c.visits, 0))
const refTotal = computed(() => props.data.referrers.reduce((s, r) => s + r.visits, 0))
const utmBlocks = computed(() => [
  { caption: 'KAYNAK (utm_source)', rows: props.data.utm.source },
  { caption: 'ORTAM (utm_medium)', rows: props.data.utm.medium },
  { caption: 'KAMPANYA (utm_campaign)', rows: props.data.utm.campaign },
  { caption: 'TERİM (utm_term)', rows: props.data.utm.term ?? [] },
])
const utmMax = (rows: { visits: number }[]) => Math.max(...rows.map((r) => r.visits), 1)

/* Kreatif kırılımı: hangi utm_content ziyaret getirdi, kaçı mağazaya tıkladı /
   bültene yazıldı. Reklam kanalının kendi tıklama sayısını bizim tarafımızdan
   doğrulamanın tek yolu. */
const contentRows = computed(() => props.data.utm.content ?? [])
const contentMax = computed(() => Math.max(...contentRows.value.map((r) => r.visits), 1))

/* Yapay zeka trafiği. Web ucu bu alanı göndermiyorsa (panel deploy'u web'in
   önüne geçtiyse) sıfırlara düşer, kart yine çizilir. */
const ai = computed(() => props.data.aiTraffic ?? { referred: 0, sources: [], likely: 0, directEntries: 0, likelyOfDirect: 0 })

const conv = computed(() => props.data.webConversions ?? { magazaPlay: 0, magazaAppstore: 0, bulten: 0, withClickId: 0 })
const convTotal = computed(() => conv.value.magazaPlay + conv.value.magazaAppstore + conv.value.bulten)

/* Google Ads offline conversion CSV'si: sitede Google etiketi yok, dönüşümler
   tıklama kimliğiyle eşlenip elle yüklenir (Google Ads → Hedefler → Dönüşümler
   → Yüklemeler). Dosya adı aralığı ve günü taşır. */
const csvBusy = ref(false)
const csvError = ref('')
async function downloadCsv() {
  csvBusy.value = true
  csvError.value = ''
  try {
    const text = await analyticsApi.adsConversionsCsv(state.range)
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `afiet-google-ads-donusumler-${state.range}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    csvError.value = e instanceof Error ? e.message : 'İndirilemedi.'
  } finally {
    csvBusy.value = false
  }
}
</script>

<template>
  <div class="tab-body">
    <p class="analytics-note"><i class="pi pi-directions" /> Ziyaretçi nereden geldi: referrer başlığı kanallara ayrılır; bağlantıdaki <span class="mono">?utm_*</span> parametreleri kampanya kırılımını verir. Reklam tıklama kimliği (<span class="mono">gclid</span>) girişte saklanır, mağaza tıklaması ve bülten kaydıyla eşlenir.</p>

    <article class="panel-card pad">
      <div class="panel-title sm"><div><p>EDİNİM</p><h2>Kanallar</h2></div></div>
      <ul class="src-list">
        <li v-for="c in data.channels" :key="c.key">
          <div class="src-row"><span class="src-name">{{ c.label }}</span><span class="src-val">{{ fmt(c.visits) }} · {{ pct(c.visits, channelTotal) }}%</span></div>
          <div class="mini-track"><div class="mini-fill" :class="CHANNEL_TONE[c.key]" :style="{ width: `${pct(c.visits, channelTotal)}%` }" /></div>
        </li>
      </ul>
    </article>

    <article class="panel-card pad">
      <div class="panel-title sm"><div><p>YAPAY ZEKA</p><h2>AI yüzeylerinden gelen</h2></div></div>
      <!-- Toplam bir BAŞLIK sayısıdır, karşılaştırma değil: çubuğu yok.
           Kendi kendinin %100'ü olan bir çubuk hiçbir şey söylemez ve
           altındaki gerçek karşılaştırmayı yanlış okutur. -->
      <div class="ai-toplam">
        <span class="src-name">Ölçülen yönlendirme</span>
        <strong>{{ fmt(ai.referred) }}</strong>
        <span class="src-val">tüm girişlerin {{ pct(ai.referred, channelTotal) }}%'i</span>
      </div>
      <p v-if="!ai.referred" class="analytics-note">Henüz hiçbir yapay zeka yüzeyinden yönlendirme gelmedi. Bu bir ölçüm sonucudur, eksik ölçüm değil: ChatGPT, Perplexity, Gemini, Claude ve Copilot yönlendirmeleri tanınıyor ve sayılıyor.</p>
      <ul v-else class="src-list tight ai-kaynak">
        <li v-for="r in ai.sources" :key="r.source">
          <div class="src-row"><span class="src-name mono">{{ r.source }}</span><span class="src-val">{{ fmt(r.visits) }} · {{ pct(r.visits, ai.referred) }}%</span></div>
          <div class="mini-track"><div class="mini-fill clay" :style="{ width: `${pct(r.visits, ai.referred)}%` }" /></div>
        </li>
      </ul>

      <div class="ai-sezgisel">
        <p class="mini-cap">MUHTEMEL AI (SEZGİSEL)</p>
        <div class="src-row"><span class="src-name">Referrer taşımayan derin iniş</span><span class="src-val">{{ fmt(ai.likely) }} · doğrudan girişlerin {{ ai.likelyOfDirect }}%'i</span></div>
        <p class="analytics-note">Yapay zeka kaynaklı oturumların büyük kısmı referrer taşımaz (yerel uygulamalar, gizlilik ayarları) ve "doğrudan" kovasına düşer. Bu sayı o kovadaki yeni ziyaretçilerin ana sayfa dışına inişini gösterir. <strong>Kesin değildir</strong>: yer imi, elle yazılan adres ve QR trafiği de buraya karışır. Kanal tablosuna bilerek eklenmedi, mutlak sayı değil trend olarak okunur.</p>
      </div>
    </article>

    <div class="split-grid">
      <article class="panel-card pad">
        <div class="panel-title sm"><div><p>YÖNLENDİREN SİTELER</p><h2>Referrer</h2></div></div>
        <ul class="src-list tight referrer">
          <li v-for="r in data.referrers" :key="r.source">
            <div class="src-row"><span class="src-name mono">{{ r.source }}</span><span class="src-val">{{ fmt(r.visits) }} · {{ pct(r.visits, refTotal) }}%</span></div>
            <div class="mini-track"><div class="mini-fill coral" :style="{ width: `${pct(r.visits, refTotal)}%` }" /></div>
          </li>
        </ul>
      </article>

      <article class="panel-card pad">
        <div class="panel-title sm"><div><p>KAMPANYA</p><h2>UTM kırılımı</h2></div></div>
        <div v-for="block in utmBlocks" :key="block.caption" class="utm-block">
          <p class="mini-cap">{{ block.caption }}</p>
          <ul v-if="block.rows.length" class="src-list tight">
            <li v-for="row in block.rows" :key="row.value">
              <div class="src-row"><span class="src-name mono">{{ row.value }}</span><span class="src-val">{{ fmt(row.visits) }}</span></div>
              <div class="mini-track"><div class="mini-fill amber" :style="{ width: `${pct(row.visits, utmMax(block.rows))}%` }" /></div>
            </li>
          </ul>
          <p v-else class="board-empty">Kayıt yok</p>
        </div>
      </article>
    </div>

    <div class="split-grid">
      <article class="panel-card pad">
        <div class="panel-title sm"><div><p>KREATİF (utm_content)</p><h2>Hangi reklam ne getirdi</h2></div></div>
        <p class="analytics-note">Ziyaret ve o kreatiften gelen ziyaretçilerin aralık içindeki mağaza tıklaması / bülten kaydı (son giriş sayılır). Meta ve Google'ın kendi tıklama sayısının bizim taraftaki karşılığı.</p>
        <ul v-if="contentRows.length" class="src-list tight">
          <li v-for="row in contentRows" :key="row.value">
            <div class="src-row">
              <span class="src-name mono">{{ row.value }}</span>
              <span class="src-val">{{ fmt(row.visits) }} ziyaret · {{ fmt(row.magaza) }} mağaza · {{ fmt(row.bulten) }} bülten</span>
            </div>
            <div class="mini-track"><div class="mini-fill amber" :style="{ width: `${pct(row.visits, contentMax)}%` }" /></div>
          </li>
        </ul>
        <p v-else class="board-empty">Kayıt yok</p>
      </article>

      <article class="panel-card pad">
        <div class="panel-title sm"><div><p>WEB DÖNÜŞÜMLERİ</p><h2>Mağaza tıklaması ve bülten</h2></div></div>
        <ul class="src-list tight">
          <li>
            <div class="src-row"><span class="src-name">Google Play tıklaması</span><span class="src-val">{{ fmt(conv.magazaPlay) }}</span></div>
            <div class="mini-track"><div class="mini-fill" :style="{ width: `${pct(conv.magazaPlay, convTotal)}%` }" /></div>
          </li>
          <li>
            <div class="src-row"><span class="src-name">App Store tıklaması</span><span class="src-val">{{ fmt(conv.magazaAppstore) }}</span></div>
            <div class="mini-track"><div class="mini-fill" :style="{ width: `${pct(conv.magazaAppstore, convTotal)}%` }" /></div>
          </li>
          <li>
            <div class="src-row"><span class="src-name">Bülten kaydı</span><span class="src-val">{{ fmt(conv.bulten) }}</span></div>
            <div class="mini-track"><div class="mini-fill coral" :style="{ width: `${pct(conv.bulten, convTotal)}%` }" /></div>
          </li>
          <li>
            <div class="src-row"><span class="src-name">Reklam tıklama kimliğiyle eşlenen</span><span class="src-val">{{ fmt(conv.withClickId) }} · {{ pct(conv.withClickId, convTotal) }}%</span></div>
            <div class="mini-track"><div class="mini-fill amber" :style="{ width: `${pct(conv.withClickId, convTotal)}%` }" /></div>
          </li>
        </ul>
        <p class="analytics-note">Google Ads'e "offline conversion" olarak elle yüklenir: dönüşüm adları <span class="mono">web_magaza_tik</span> ve <span class="mono">web_bulten_kayit</span>, saat dilimi Europe/Istanbul. Yalnız kimlikli satırlar dosyaya girer.</p>
        <div class="conv-actions">
          <Button label="Google Ads CSV indir" icon="pi pi-download" outlined size="small" :loading="csvBusy" :disabled="conv.withClickId === 0" @click="downloadCsv" />
          <span v-if="csvError" class="board-empty">{{ csvError }}</span>
        </div>
      </article>
    </div>
  </div>
</template>
