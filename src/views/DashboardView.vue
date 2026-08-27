<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import PageHeader from '../components/PageHeader.vue'
import EmptyState from '../components/EmptyState.vue'
import LineChart from '../components/LineChart.vue'
import { adminApi, type User } from '../services/admin'
import type { GrowthData } from '../services/growth'
import { SERIES_COLORS } from './analytics/shared'
import { ago, initial, num } from './users/shared'

/**
 * Genel bakış = bugünün nabzı.
 *
 * Tek kaynak `GET /v1/admin/growth` (kohort/trend düzeyi) ve son katılanlar
 * için kullanıcı listesinin ilk sayfası; ikisi de zaten canlı, bu ekran için
 * yeni uç yok.
 *
 * BURADA OLMAYANLAR ve NEDENİ:
 * - Besin kataloğu sayısı ve "kataloğu canlı tut" bloğu: katalog 2.000'i geçtikten
 *   sonra günden güne değişmiyor, yani bir nabız değil bir envanter sayısı. İşin
 *   kendisi Besin kataloğu ekranında yaşıyor.
 * - Beta başvuruları: alım 25 Ağu 2026'da kapandı, `/beta` → `/indir` oldu.
 *   `beta_applications` arşiv olarak duruyor ama BİR DAHA DOLMAYACAK; "son 7 gün"
 *   kartı bu yüzden kalıcı sıfır gösteriyordu. Arşive erişim Kullanıcılar
 *   ekranındaki yan panelde.
 */
const data = ref<GrowthData | null>(null)
const recent = ref<User[]>([])
const loading = ref(true)
const error = ref('')

const todayLabel = computed(() => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }).format(new Date()).toLocaleUpperCase('tr-TR'))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [growth, users] = await Promise.all([
      adminApi.growth(),
      adminApi.users({ page: 1, pageSize: 5 }),
    ])
    data.value = growth
    // Uç created_at DESC sıralı döndürür; ilk sayfa "son katılanlar" demektir.
    recent.value = users.items
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Veriler alınamadı.'
  } finally {
    loading.value = false
  }
}

const cards = computed(() => {
  const d = data.value
  return [
    {
      label: 'Bugün kayıt tutan', icon: 'pi pi-check-circle', tone: 'green',
      value: d ? num(d.habit.dau) : '—', note: 'öğün yazan kişi',
    },
    {
      label: 'Bu hafta aktif', icon: 'pi pi-users', tone: 'amber',
      value: d ? num(d.habit.wau) : '—',
      note: d ? `kişi başına ${d.habit.avgRhythmDays.toLocaleString('tr-TR')} gün` : 'son 7 gün',
    },
    {
      label: 'Toplam kullanıcı', icon: 'pi pi-id-card', tone: 'blue',
      value: d ? num(d.growth.totalUsers) : '—', note: 'kayıtlı profil',
    },
    {
      label: 'Yeni (7 gün)', icon: 'pi pi-user-plus', tone: 'coral',
      value: d ? num(d.growth.new7d) : '—',
      note: d ? `bugün ${num(d.growth.newToday)} yeni` : 'yeni kayıt',
    },
  ]
})

// ── Günlük kayıt tutan kişi ─────────────────────────────────────────────────
//
// Uç son 90 günü sıfır dolgulu döndürür; genel bakış bunun son 30 gününü keser
// (pencere seçici Büyüme panelinde). Son nokta BUGÜNDÜR ve gün bitmediği için
// doğal olarak düşük; kartın altındaki not bunu söyler.
const DAILY_DAYS = 30
const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
/** "2026-08-22" → "22 Ağu". `new Date(iso)` UTC okur ve etiketi bir gün kaydırırdı. */
function dayLabel(iso: string): string {
  const [, month, day] = iso.split('-').map(Number)
  return `${String(day)} ${TR_MONTHS[(month || 1) - 1]}`
}

const dailyWindow = computed(() => (data.value?.habit.dailyLoggers ?? []).slice(-DAILY_DAYS))
const dailyLabels = computed(() => dailyWindow.value.map((p) => dayLabel(p.date)))
const dailySeries = computed(() => [
  { label: 'Kayıt tutan kişi', color: SERIES_COLORS.views, values: dailyWindow.value.map((p) => p.users) },
])
/** Pencerenin zirvesi; eşitlikte EN SON gün kazanır (yakın olan daha anlamlı). */
const dailyPeak = computed(() => {
  let peak: { date: string; users: number } | null = null
  for (const row of dailyWindow.value) if (!peak || row.users >= peak.users) peak = row
  return peak && peak.users > 0 ? { label: dayLabel(peak.date), users: peak.users } : null
})
/**
 * Ortalama BUGÜNÜ DIŞLAR: yarım gün, penceredeki tam günlerle aynı kefeye
 * konunca ortalamayı sistematik olarak aşağı çeker.
 */
const dailyAverage = computed(() => {
  const full = dailyWindow.value.slice(0, -1)
  if (!full.length) return null
  return Math.round((full.reduce((sum, row) => sum + row.users, 0) / full.length) * 10) / 10
})

onMounted(load)
</script>

<template>
  <div class="page-wrap">
    <PageHeader :eyebrow="todayLabel" title="Mutfakta bugün" description="Bugün kaç kişi sofraya oturdu, kaç kişi kalıyor, kimler yeni katıldı.">
      <Button label="Yenile" icon="pi pi-refresh" outlined :loading="loading" @click="load" />
    </PageHeader>
    <div v-if="error" class="error-banner"><i class="pi pi-exclamation-circle" /><span>{{ error }}</span><button @click="load">Tekrar dene</button></div>

    <section class="metric-grid" aria-label="Bugünün nabzı">
      <article v-for="card in cards" :key="card.label" class="metric-card" :class="card.tone">
        <div class="metric-top"><span>{{ card.label }}</span><i :class="card.icon" /></div>
        <Skeleton v-if="loading" width="5rem" height="2.7rem" />
        <strong v-else>{{ card.value }}</strong>
        <small>{{ card.note }}</small>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="panel-card pad chart-card">
        <div class="panel-title sm">
          <div><p>SON 30 GÜN</p><h2>Günlük kayıt tutan kişi</h2></div>
          <RouterLink to="/buyume">Büyümeye git</RouterLink>
        </div>
        <Skeleton v-if="loading" height="230px" />
        <LineChart v-else :labels="dailyLabels" :series="dailySeries" :height="230" />
        <p v-if="dailyWindow.length" class="chart-foot">
          <span v-if="dailyAverage !== null"><strong>{{ dailyAverage.toLocaleString('tr-TR') }}</strong> kişi/gün ortalama</span>
          <span v-if="dailyPeak"><strong>{{ num(dailyPeak.users) }}</strong> kişiyle zirve · {{ dailyPeak.label }}</span>
          <span class="subtle">bugün henüz bitmedi</span>
        </p>
      </article>

      <article class="panel-card recent-card">
        <div class="panel-title"><div><p>SON KATILANLAR</p><h2>Yeni kullanıcılar</h2></div><RouterLink to="/kullanicilar">Tümü</RouterLink></div>
        <div v-if="loading" class="recent-list"><Skeleton v-for="i in 5" :key="i" height="3.4rem" /></div>
        <EmptyState v-else-if="!recent.length" icon="pi pi-user-plus" title="Henüz kimse katılmadı" description="Yeni açılan profiller burada görünecek." />
        <ul v-else class="recent-list">
          <li v-for="user in recent" :key="user.userId">
            <span class="mail-avatar">{{ initial(user) }}</span>
            <div>
              <strong>{{ user.displayName || user.email }}</strong>
              <small>{{ ago(user.createdAt) }} katıldı</small>
            </div>
            <Tag
              :value="user.mealCount > 0 ? `${num(user.mealCount)} öğün` : 'kayıt yok'"
              :severity="user.mealCount > 0 ? 'success' : 'secondary'"
            />
          </li>
        </ul>
      </article>
    </section>
  </div>
</template>
