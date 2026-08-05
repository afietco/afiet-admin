<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import Tag from 'primevue/tag'
import type { User } from '../../services/admin'
import {
  label, platformLabel, statusOf, STATUS_META, usersApi, versionInfo,
  type UserDetail, type UserStatus,
} from '../../services/users'
import { ago, date, dateTime, initial, num } from './shared'

/**
 * Listeden bir kullanıcıya ilk tıklandığında açılan hızlı bakış.
 *
 * İki kaynağı üst üste bindiriyor: satırın kendisi (liste ucundan zaten elde,
 * anında çizilir) ve detay ucu (tek istek, birkaç saniye sürebiliyor). Bu yüzden
 * kimlik ve öğün/son hareket beklemeden görünür, seviye-lig-sürüm gibi yalnız
 * detayda olan alanlar yüklenirken "…" ile durur. Amaç, tam sayfaya gitmeden
 * "bu kim, ne durumda" sorusunu cevaplamak; sayfanın kendisi düğmeyle bir tık
 * ötede.
 */

const props = defineProps<{ user: User | null }>()
const visible = defineModel<boolean>('visible', { required: true })

const router = useRouter()
const detail = ref<UserDetail | null>(null)
const loading = ref(false)
const error = ref('')

/** Yüklenmekte olan kullanıcı; geç dönen yanıt yeni satırın üstüne yazmasın. */
let inFlight = ''

const status = computed<UserStatus | null>(() => (props.user ? statusOf(props.user) : null))
const version = computed(() => (detail.value ? versionInfo(detail.value) : null))
const league = computed(() => detail.value?.gamification.league ?? null)

/** Detay gelmeden önce boşluk "—" değil "…": eksik veri ile bekleyen veri ayrı şeyler. */
const pending = computed(() => (loading.value ? '…' : '—'))

const identity = computed(() => {
  const profile = detail.value?.profile ?? null
  return [
    { label: 'Arkadaş kodu', value: profile ? profile.friendCode || '—' : pending.value },
    { label: 'E-posta', value: props.user?.email ?? '—' },
    { label: 'Katılım', value: date(props.user?.createdAt) },
    {
      label: 'Tanışma akışı',
      value: profile ? (profile.onboardedAt ? `bitti · ${date(profile.onboardedAt)}` : 'bitmemiş') : pending.value,
    },
  ]
})

const tiles = computed(() => {
  const usage = detail.value?.usage ?? null
  const progress = detail.value?.gamification.progress ?? null
  return [
    {
      label: 'SEVİYE',
      value: progress ? `Lv ${String(progress.level)}` : pending.value,
      foot: progress ? progress.title : 'detay yükleniyor',
    },
    {
      label: 'AFİYET GÜNÜ',
      value: usage ? num(usage.afiyetDays) : pending.value,
      foot: usage ? `güncel seri ${String(usage.currentStreak)} gün` : 'detay yükleniyor',
    },
    {
      label: 'ÖĞÜN KAYDI',
      value: num(props.user?.mealCount ?? 0),
      foot: usage ? `${String(usage.activeDays30)} aktif gün / 30` : `${num(props.user?.customFoodCount ?? 0)} menüm kaydı`,
    },
    {
      label: 'SON HAREKET',
      value: ago(props.user?.lastActivityAt),
      foot: `ölçüm ${num(props.user?.measurementCount ?? 0)}`,
    },
  ]
})

async function load(userId: string) {
  loading.value = true
  error.value = ''
  detail.value = null
  inFlight = userId
  try {
    const result = await usersApi.detail(userId)
    if (inFlight !== userId) return
    detail.value = result.detail
  } catch (err) {
    if (inFlight !== userId) return
    error.value = err instanceof Error ? err.message : 'Kullanıcı detayı alınamadı.'
  } finally {
    if (inFlight === userId) loading.value = false
  }
}

/**
 * Panel açıkken ve bir satır seçiliyken detayı çeker. Aynı kişi ikinci kez
 * açılırsa elde olan detay tekrar istenmez; hata ile kapanmışsa istenir.
 */
watch(
  () => [visible.value, props.user?.userId] as const,
  ([open, userId]) => {
    if (!open || !userId) return
    if (detail.value?.profile.userId === userId && !error.value) return
    void load(userId)
  },
  { immediate: true },
)

function openFullPage() {
  const userId = props.user?.userId
  if (!userId) return
  visible.value = false
  void router.push({ name: 'user-detail', params: { userId } })
}
</script>

<template>
  <Drawer v-model:visible="visible" position="right" class="food-drawer" :style="{ width: '31rem' }">
    <template #header>
      <div v-if="user" class="drawer-head">
        <span class="email-avatar">{{ initial(user) }}</span>
        <div>
          <strong>{{ user.displayName || 'İsimsiz profil' }}</strong>
          <small>{{ user.email }}</small>
        </div>
        <Tag
          v-if="status"
          :value="STATUS_META[status].label"
          :severity="STATUS_META[status].severity"
          v-tooltip.bottom="STATUS_META[status].hint"
        />
      </div>
    </template>

    <div v-if="user" class="drawer-body">
      <Button
        label="Kişisel sayfaya git"
        icon="pi pi-arrow-up-right"
        icon-pos="right"
        class="qp-go"
        @click="openFullPage"
      />

      <div v-if="error" class="qp-error">
        <i class="pi pi-exclamation-circle" />
        <span>{{ error }}</span>
        <button type="button" @click="load(user.userId)">Tekrar dene</button>
      </div>

      <section class="drawer-section">
        <h4>Özet</h4>
        <div class="qp-tiles">
          <div v-for="tile in tiles" :key="tile.label" class="qp-tile">
            <small>{{ tile.label }}</small>
            <strong>{{ tile.value }}</strong>
            <em>{{ tile.foot }}</em>
          </div>
        </div>
      </section>

      <section class="drawer-section">
        <h4>Kimlik</h4>
        <dl class="drawer-grid">
          <div v-for="row in identity" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div>
        </dl>
      </section>

      <section class="drawer-section">
        <h4>Sürüm</h4>
        <div v-if="loading" class="qp-wait"><i class="pi pi-spin pi-spinner" /> oturum ve cihaz kaydı okunuyor…</div>
        <template v-else-if="version">
          <div class="qp-versions">
            <div class="qp-version">
              <small>ÇALIŞAN</small>
              <strong>{{ version.running || '—' }}</strong>
              <em v-if="version.running">
                {{ platformLabel(version.runningPlatform) }} · son oturum {{ dateTime(version.runningAt) }}
              </em>
              <em v-else>oturum telemetrisi bu kişiden akmıyor</em>
            </div>
            <div class="qp-version" :class="{ stale: version.stale }">
              <small>KAYITLI</small>
              <strong>{{ version.registered || '—' }}</strong>
              <em v-if="version.registered">
                {{ platformLabel(version.registeredPlatform) }} · push cihazı {{ dateTime(version.registeredAt) }}
              </em>
              <em v-else>push cihaz kaydı yok</em>
            </div>
          </div>
          <p v-if="version.stale" class="qp-warn">
            <i class="pi pi-exclamation-triangle" />
            Cihaz kaydı geride: sürüm satırı yalnız push parmak izi değişince yeniden yazılıyor.
            Doğru cevap çalışan sürüm.
          </p>
          <p v-else-if="!version.running && version.registered" class="qp-note">
            Yalnız cihaz kaydı var ve bayat olabilir; oturum telemetrisi gelene kadar bu sayı bir tahmindir.
          </p>
        </template>
        <p v-else class="drawer-none">Sürüm okunamadı.</p>
      </section>

      <section class="drawer-section">
        <h4>Lig</h4>
        <div v-if="loading" class="qp-wait"><i class="pi pi-spin pi-spinner" /> masa okunuyor…</div>
        <template v-else-if="league">
          <div class="qp-league">
            <span class="qp-tier">{{ label.tier(league.tier) }}</span>
            <div>
              <strong>{{ league.rank }}. / {{ num(league.members) }} kişi</strong>
              <small>{{ league.seat }}. masa · {{ num(league.points) }} puan · mevsim {{ date(league.seasonStart) }}</small>
            </div>
          </div>
        </template>
        <p v-else class="drawer-none">Bu mevsim hiçbir masaya oturmamış.</p>
      </section>

      <section class="drawer-section">
        <h4>İkram kesesi</h4>
        <!--
          Boş durum bilerek: kese yalnız kişinin kendi ucundan (GET /v1/kese)
          hesaplanıyor, admin detayında karşılığı yok. Gerekli alanın şekli
          services/users.ts içindeki kese notunda yazılı. Kademe ve seviye
          elimizde ama o haftanın karşılıklı selamları yok, o yüzden tahmini
          bir kese boyutu HESAPLANMIYOR.
        -->
        <div class="qp-empty">
          <i class="pi pi-inbox" />
          <div>
            <strong>Kese verisi henüz uçtan gelmiyor.</strong>
            <small>
              Kese haftalık Afi sohbeti hakkı; boyutunu lig kademesi belirler. Backend bunu bugün yalnız
              kişinin kendi ucunda hesaplıyor, admin detayına eklenmesi gerekiyor.
            </small>
          </div>
        </div>
      </section>
    </div>
  </Drawer>
</template>

<style scoped>
.qp-go { width: 100%; }

.qp-error {
  display: flex; gap: 8px; align-items: center;
  padding: 9px 11px; border: 1px solid #edc9c2; border-radius: 11px;
  color: #97402f; background: #fdf1ee; font-size: 11px; font-weight: 750;
}
.qp-error button {
  margin-left: auto; padding: 0; border: 0; color: inherit; background: none;
  font: inherit; text-decoration: underline; cursor: pointer;
}

.qp-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; border: 1px solid #ece7db; border-radius: 14px; background: #ece7db; overflow: hidden; }
.qp-tile { display: grid; gap: 3px; padding: 12px 14px; background: #fff; }
.qp-tile small { color: #93a89e; font-size: 8.5px; font-weight: 950; letter-spacing: .13em; }
.qp-tile strong { color: #2c332e; font-size: 20px; font-weight: 900; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
.qp-tile em { color: #8d9087; font-size: 10px; font-style: normal; font-weight: 700; }

.qp-versions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.qp-version { display: grid; gap: 3px; padding: 11px 13px; border: 1px solid #e5e9e2; border-radius: 13px; background: #f7f9f5; }
.qp-version small { color: #8b8e84; font-size: 8.5px; font-weight: 900; letter-spacing: .12em; }
.qp-version strong { color: #2c332e; font-size: 17px; font-weight: 900; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.qp-version em { color: #8d9087; font-size: 9.5px; font-style: normal; font-weight: 700; line-height: 1.4; }
.qp-version.stale { border-color: #ecd3a3; background: #fdf7ea; }
.qp-version.stale strong { color: #8a6512; }

.qp-warn {
  display: flex; gap: 7px; align-items: flex-start; margin: 10px 0 0;
  padding: 9px 11px; border: 1px solid #ecd3a3; border-radius: 10px;
  color: #8a6512; background: #fdf5e3; font-size: 10px; font-weight: 700; line-height: 1.5;
}
.qp-note { margin: 9px 0 0; color: #8d9087; font-size: 10px; font-weight: 700; line-height: 1.5; }
.qp-wait { display: flex; gap: 8px; align-items: center; color: #8d9087; font-size: 11px; font-weight: 750; }

.qp-league { display: flex; gap: 12px; align-items: center; padding: 12px 14px; border-radius: 14px; background: #f8f4eb; }
.qp-tier {
  display: grid; place-items: center; min-width: 66px; padding: 7px 12px;
  border-radius: 999px; color: #14664d; background: #e3f1ea;
  font-size: 12px; font-weight: 900; letter-spacing: -.01em;
}
.qp-league strong { display: block; color: #2c332e; font-size: 14px; font-weight: 850; }
.qp-league small { display: block; margin-top: 3px; color: #8d9087; font-size: 10px; font-weight: 700; }

.qp-empty {
  display: flex; gap: 11px; align-items: flex-start;
  padding: 13px 14px; border: 1px dashed #ddd8ca; border-radius: 14px; background: #fbf9f3;
}
.qp-empty i { margin-top: 2px; color: #b3b6ab; font-size: 14px; }
.qp-empty strong { display: block; color: #5c6058; font-size: 12px; font-weight: 800; }
.qp-empty small { display: block; margin-top: 4px; color: #9a9c93; font-size: 10px; font-weight: 700; line-height: 1.55; }

@media (max-width: 520px) {
  .qp-tiles, .qp-versions { grid-template-columns: 1fr; }
}
</style>
