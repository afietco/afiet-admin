<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import PageHeader from '../../components/PageHeader.vue'
import EmptyState from '../../components/EmptyState.vue'
import BetaDrawer from './BetaDrawer.vue'
import UserQuickPanel from './UserQuickPanel.vue'
import { betaApi } from '../../services/beta'
import { adminApi, type Summary, type User } from '../../services/admin'
import type { GrowthData } from '../../services/growth'
import {
  label, loadLeagueSeats, STATUS_META, statusOf, usersApi,
  type LeagueMap, type UserStatus,
} from '../../services/users'
import { ago, date, initial, num, pct } from './shared'

/**
 * Liste tek seferde çekilir (uç 500'e kadar veriyor) ve filtreleme, sıralama,
 * sayfalama istemcide yapılır. Sunucu tarafında yalnız arama var; durum
 * filtresini sunucuya taşımak "aktif" tanımını iki yere yazmak demek olurdu.
 * Toplam 500'ü aşarsa toolbar bunu açıkça söyler.
 */
const PAGE_LIMIT = 500

const router = useRouter()
const rows = ref<User[]>([])
const total = ref(0)
const summary = ref<Summary | null>(null)
const growth = ref<GrowthData | null>(null)
const query = ref('')
const status = ref<UserStatus | ''>('')
const loading = ref(false)
const error = ref('')
// Beta başvuruları menüden kalktı; sayaç burada, liste yan panelde.
const betaTotal = ref<number | null>(null)
const betaLast7d = ref(0)
const betaOpen = ref(false)
// Satıra tıklayınca sayfa değişmiyor, hızlı bakış paneli açılıyor.
const selected = ref<User | null>(null)
const quickOpen = ref(false)
const league = ref<LeagueMap | null>(null)

const statusOptions = [
  { value: '', label: 'Tüm durumlar' },
  ...(Object.keys(STATUS_META) as UserStatus[]).map((key) => ({ value: key, label: STATUS_META[key].label })),
]

const decorated = computed(() =>
  rows.value.map((user) => ({
    user,
    status: statusOf(user),
    league: league.value?.seats.get(user.userId) ?? null,
  })))
const visible = computed(() =>
  decorated.value.filter((row) => !status.value || row.status === status.value))

const statusCounts = computed(() => {
  const counts = new Map<UserStatus, number>()
  decorated.value.forEach((row) => counts.set(row.status, (counts.get(row.status) ?? 0) + 1))
  return (Object.keys(STATUS_META) as UserStatus[])
    .map((key) => ({ key, count: counts.get(key) ?? 0 }))
    .filter((row) => row.count > 0)
})

const cards = computed(() => [
  {
    label: 'Toplam kullanıcı', tone: 'green', icon: 'pi pi-users',
    value: num(summary.value?.userCount ?? total.value), foot: 'profil satırı açılmış hesap',
  },
  {
    label: 'Son 7 günde katılan', tone: 'blue', icon: 'pi pi-user-plus',
    value: growth.value ? num(growth.value.growth.new7d) : '—',
    foot: growth.value ? `bugün ${num(growth.value.growth.newToday)}` : 'büyüme ucu okunamadı',
  },
  {
    label: 'Günlük aktif', tone: 'amber', icon: 'pi pi-bolt',
    value: growth.value ? num(growth.value.habit.dau) : '—',
    foot: growth.value ? `haftalık ${num(growth.value.habit.wau)}` : 'büyüme ucu okunamadı',
  },
  {
    label: 'Haftalık ritim', tone: 'coral', icon: 'pi pi-calendar',
    value: growth.value ? growth.value.habit.avgRhythmDays.toLocaleString('tr-TR') : '—',
    foot: 'kişi başına afiyet günü',
  },
])

async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await usersApi.list({ page: 1, pageSize: PAGE_LIMIT, query: query.value.trim() })
    rows.value = result.items
    total.value = result.total
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Kullanıcılar alınamadı.'
  } finally {
    loading.value = false
  }
}

/** Şerit ayrı yükleniyor: biri düşse de tablo çalışmaya devam etsin. */
async function loadStrip() {
  try {
    summary.value = await adminApi.summary()
  } catch { /* şerit kartı '—' gösterir */ }
  try {
    growth.value = await adminApi.growth()
  } catch { /* şerit kartı '—' gösterir */ }
  try {
    const beta = await betaApi.get()
    betaTotal.value = beta.total
    betaLast7d.value = beta.summary.last7d
  } catch { /* beta ucu afiet-web'de; düşerse kart '—' gösterir */ }
  try {
    league.value = await loadLeagueSeats()
  } catch { /* lig sütunu '—' gösterir */ }
}

/**
 * Satıra tıklamak artık sayfa değiştirmiyor, sağdan hızlı bakışı açıyor
 * (beta listesindeki davranışın aynısı). Tam sayfa bir tık ötede: satır
 * sonundaki ok düğmesi ve panelin içindeki "Kişisel sayfaya git".
 *
 * NEDEN LİG SÜTUNU VAR AMA SÜRÜM SÜTUNU YOK
 *
 * Liste ucu (GET /v1/admin/users) on alan dönüyor: userId, email, displayName,
 * emoji, createdAt, updatedAt, mealCount, customFoodCount, measurementCount,
 * lastActivityAt. Ne sürüm ne lig içinde.
 *
 * Lig yine de gösterilebiliyor, çünkü toplu okunabiliyor: açık mevsimin
 * masaları ve masa üyeleri kademe sayısı kadar istekle geliyor
 * (services/users.ts, loadLeagueSeats). Kullanıcı sayısıyla büyümüyor.
 *
 * Sürüm için böyle bir toplu uç YOK. Doğru sürüm son session_start olayının
 * app_version'ı ve o yalnız kullanıcı detayında hesaplanıyor; 500 satır için
 * 500 detay isteği demek olurdu, üstelik detay ucu tek kullanıcı için saniyeler
 * sürüyor. Sütun açılabilmesi için liste sorgusuna (afiet-backend
 * internal/store/admin.go, AdminUsers) tek bir alan gerekiyor:
 *   appVersion → o kullanıcının en son session_start olayındaki app_version
 *                (push_devices.app_version DEĞİL, o bayat olabiliyor; gerekçe
 *                services/users.ts içindeki VersionInfo notunda)
 * O gelene kadar sürüm yalnız hızlı panelde ve kullanıcı detayında.
 */
function open(user: User) {
  selected.value = user
  quickOpen.value = true
}

function openFullPage(user: User) {
  router.push({ name: 'user-detail', params: { userId: user.userId } })
}

onMounted(() => {
  load()
  loadStrip()
})
</script>

<template>
  <div class="page-wrap">
    <PageHeader
      eyebrow="TOPLULUK"
      title="Kullanıcılar"
      description="Kimin sofrası nasıl gidiyor: profiller, kayıt sinyalleri ve kullanıcı başına detay."
    >
      <Button label="Yenile" icon="pi pi-refresh" outlined :loading="loading" @click="load(); loadStrip()" />
    </PageHeader>

    <div v-if="error" class="error-banner">
      <i class="pi pi-exclamation-circle" /><span>{{ error }}</span>
      <button @click="load">Tekrar dene</button>
    </div>

    <section class="metric-grid five" aria-label="Topluluk özeti">
      <article v-for="card in cards" :key="card.label" class="metric-card" :class="card.tone">
        <div class="metric-top"><span>{{ card.label }}</span><i :class="card.icon" /></div>
        <strong>{{ card.value }}</strong>
        <small>{{ card.foot }}</small>
      </article>
      <button type="button" class="metric-card violet metric-action" @click="betaOpen = true">
        <div class="metric-top"><span>Beta başvurusu</span><i class="pi pi-send" /></div>
        <strong>{{ betaTotal === null ? '—' : num(betaTotal) }}</strong>
        <small>son 7 günde {{ betaLast7d }} · listeyi aç <i class="pi pi-chevron-right" /></small>
      </button>
    </section>

    <BetaDrawer v-model:visible="betaOpen" />

    <section class="table-card" style="margin-top: 18px">
      <div class="table-toolbar">
        <span class="search-box">
          <i class="pi pi-search" />
          <InputText v-model="query" placeholder="E-posta veya ad ara…" @keyup.enter="load" />
        </span>
        <Button label="Ara" icon="pi pi-search" severity="secondary" outlined @click="load" />
        <Select
          v-model="status"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          placeholder="Tüm durumlar"
        />
        <span class="result-count">
          {{ num(visible.length) }} / {{ num(rows.length) }} kullanıcı
          <template v-if="total > rows.length"> · ilk {{ num(rows.length) }} kayıt yüklendi</template>
        </span>
      </div>

      <div v-if="statusCounts.length" class="status-strip">
        <button
          v-for="row in statusCounts"
          :key="row.key"
          type="button"
          class="status-pill"
          :class="[row.key, { on: status === row.key }]"
          :title="STATUS_META[row.key].hint"
          @click="status = status === row.key ? '' : row.key"
        >
          <span class="status-dot" />
          {{ STATUS_META[row.key].label }}
          <strong>{{ num(row.count) }}</strong>
          <em>%{{ pct(row.count, decorated.length) }}</em>
        </button>
      </div>

      <DataTable
        :value="visible"
        :loading="loading"
        data-key="user.userId"
        paginator
        :rows="25"
        :rows-per-page-options="[10, 25, 50, 100]"
        removable-sort
        row-hover
        class="clickable-rows"
        @row-click="open(($event.data as { user: User }).user)"
      >
        <template #empty>
          <EmptyState
            icon="pi pi-users"
            title="Kullanıcı bulunamadı"
            description="Arama terimini değiştir ya da durum filtresini kaldır."
          />
        </template>

        <Column header="Kullanıcı" sortable sort-field="user.email" style="min-width: 19rem">
          <template #body="{ data }">
            <div class="user-cell">
              <span>{{ initial(data.user) }}</span>
              <div>
                <strong>{{ data.user.displayName || 'İsimsiz profil' }}</strong>
                <small>{{ data.user.email }}</small>
              </div>
            </div>
          </template>
        </Column>

        <Column header="Durum" sortable sort-field="status" style="width: 9rem">
          <template #body="{ data }">
            <Tag
              :value="STATUS_META[data.status as UserStatus].label"
              :severity="STATUS_META[data.status as UserStatus].severity"
              v-tooltip.top="STATUS_META[data.status as UserStatus].hint"
            />
          </template>
        </Column>

        <Column header="Lig" sortable sort-field="league.score" style="width: 9rem">
          <template #body="{ data }">
            <span
              v-if="data.league"
              class="league-cell"
              v-tooltip.top="`${num(data.league.score)} puan · ${num(data.league.members)} kişilik masa`"
            >
              <em>{{ label.tier(data.league.tier) }}</em>
              <small>{{ data.league.rank }}. / {{ num(data.league.members) }}</small>
            </span>
            <span v-else class="date-cell">—</span>
          </template>
        </Column>

        <Column header="Öğün" sortable sort-field="user.mealCount" style="width: 6.5rem">
          <template #body="{ data }"><strong class="tabular">{{ num(data.user.mealCount) }}</strong></template>
        </Column>
        <Column header="Menüm" sortable sort-field="user.customFoodCount" style="width: 6.5rem">
          <template #body="{ data }"><span class="tabular">{{ num(data.user.customFoodCount) }}</span></template>
        </Column>
        <Column header="Ölçüm" sortable sort-field="user.measurementCount" style="width: 6.5rem">
          <template #body="{ data }"><span class="tabular">{{ num(data.user.measurementCount) }}</span></template>
        </Column>

        <Column header="Son hareket" sortable sort-field="user.lastActivityAt" style="min-width: 9rem">
          <template #body="{ data }">
            <span class="date-cell" :title="date(data.user.lastActivityAt)">{{ ago(data.user.lastActivityAt) }}</span>
          </template>
        </Column>
        <Column header="Katılım" sortable sort-field="user.createdAt" style="min-width: 9rem">
          <template #body="{ data }"><span class="date-cell">{{ date(data.user.createdAt) }}</span></template>
        </Column>

        <Column header="" frozen align-frozen="right" style="width: 4rem">
          <template #body="{ data }">
            <div class="row-actions">
              <Button
                icon="pi pi-arrow-right"
                text
                rounded
                aria-label="Kişisel sayfaya git"
                v-tooltip.left="'Kişisel sayfaya git'"
                @click.stop="openFullPage(data.user)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </section>

    <UserQuickPanel v-model:visible="quickOpen" :user="selected" />

    <p class="scope-note">
      <i class="pi pi-info-circle" />
      Bu liste Stack Auth'taki tüm hesapları değil, backend'e en az bir kez erişip profil satırı oluşan
      kullanıcıları gösterir. Durum etiketi son hareket tarihinden türetilir. Bir satıra tıklamak sağdan
      hızlı bakışı açar; sürüm, lig ve kese oradadır. Tam sayfa için satır sonundaki ok.
      Lig sütunu açık mevsimin masalarından okunur; masaya oturmamış kişide boş kalır.
    </p>
  </div>
</template>

<style scoped>
.league-cell { display: grid; gap: 1px; }
.league-cell em { color: #14664d; font-size: 12px; font-style: normal; font-weight: 850; }
.league-cell small { color: #8d9087; font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; }
</style>
