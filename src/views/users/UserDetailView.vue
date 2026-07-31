<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import AdminPlaceholder from '../../components/AdminPlaceholder.vue'
import ProfileTab from './ProfileTab.vue'
import HabitsTab from './HabitsTab.vue'
import SessionsTab from './SessionsTab.vue'
import ProgressTab from './ProgressTab.vue'
import NotifyTab from './NotifyTab.vue'
import ManageTab from './ManageTab.vue'
import ProfileDialog from './ProfileDialog.vue'
import { auth } from '../../services/auth'
import type { User } from '../../services/admin'
import {
  statusOf, STATUS_META, usersApi,
  type AuditEntry, type UserDetail, type UserDetailResult, type UserProfilePatch, type UserStatus,
} from '../../services/users'
import { ago, date, initial, num } from './shared'

/**
 * Kullanıcı detayı.
 *
 * Faz 1: ekran tasarımı. Yalnız liste sayaçları ve tecrübe defteri canlı;
 * ötekiler sözleşmeye uygun demo veriyle çiziliyor ve her bölüm kaynağını
 * rozetle söylüyor. Yazma uçları açılınca WRITABLE true olur.
 */
const WRITABLE = false

const route = useRoute()
const router = useRouter()
const toast = useToast()

const user = ref<User | null>(null)
const result = ref<UserDetailResult | null>(null)
const loading = ref(true)
const error = ref('')
const activeTab = ref('profil')
const editing = ref(false)
const saving = ref(false)

const detail = computed<UserDetail | null>(() => result.value?.detail ?? null)
const status = computed<UserStatus>(() => (user.value ? statusOf(user.value) : 'hic'))
const actor = computed(() => auth.user?.email ?? 'admin')

const hero = computed(() => {
  if (!detail.value) return []
  return [
    { label: 'Seviye', value: `Lv ${String(detail.value.gamification.progress.level)}`, foot: detail.value.gamification.progress.title },
    { label: 'Afiyet günü', value: num(detail.value.usage.afiyetDays), foot: `güncel seri ${String(detail.value.usage.currentStreak)} gün` },
    { label: 'Öğün kaydı', value: num(detail.value.usage.mealCount), foot: `${String(detail.value.usage.activeDays30)} aktif gün / 30` },
    { label: 'Son hareket', value: ago(detail.value.usage.lastActivityAt), foot: `katılım ${date(detail.value.profile.createdAt)}` },
  ]
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const found = await usersApi.byId(String(route.params.userId))
    if (!found) {
      error.value = 'Bu kimlikle bir kullanıcı bulunamadı.'
      return
    }
    user.value = found
    result.value = await usersApi.detail(found)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Kullanıcı alınamadı.'
  } finally {
    loading.value = false
  }
}

function saveProfile(patch: UserProfilePatch) {
  saving.value = true
  // Faz 2'de burada PATCH /v1/admin/users/{id} çağrılacak. Şimdilik yalnız
  // ekrandaki kopya güncelleniyor ki formun sonucu görülebilsin.
  window.setTimeout(() => {
    if (detail.value) Object.assign(detail.value.profile, patch)
    saving.value = false
    editing.value = false
    addAudit({
      at: new Date().toISOString(),
      actor: actor.value,
      action: WRITABLE ? 'Profil güncellendi' : 'Profil güncellendi (prova)',
      detail: Object.keys(patch).join(', '),
    })
    toast.add({
      severity: WRITABLE ? 'success' : 'info',
      summary: WRITABLE ? 'Profil güncellendi' : 'Profil güncellendi (prova)',
      detail: WRITABLE ? '' : 'Yazma ucu açılmadığı için sunucuya gitmedi.',
      life: 3000,
    })
  }, 250)
}

function addAudit(entry: AuditEntry) {
  detail.value?.audit.unshift(entry)
}

onMounted(load)
</script>

<template>
  <div class="page-wrap">
    <button type="button" class="back-link" @click="router.push({ name: 'users' })">
      <i class="pi pi-arrow-left" /> Kullanıcılar
    </button>

    <div v-if="loading" class="seo-loading"><i class="pi pi-spin pi-spinner" /> Kullanıcı yükleniyor…</div>

    <AdminPlaceholder
      v-else-if="error || !detail || !user"
      icon="pi pi-user"
      :title="error || 'Kullanıcı bulunamadı'"
      description="Liste sayfasından bir kullanıcı seçerek tekrar deneyebilirsin."
      retryable
      @retry="load"
    />

    <template v-else>
      <header class="user-hero">
        <div class="user-hero-id">
          <span class="user-hero-avatar">{{ initial(detail.profile) }}</span>
          <div>
            <div class="user-hero-name">
              <h1>{{ detail.profile.displayName || 'İsimsiz profil' }}</h1>
              <Tag :value="STATUS_META[status].label" :severity="STATUS_META[status].severity" />
            </div>
            <p>
              {{ detail.profile.email }}
              <template v-if="detail.profile.username"> · @{{ detail.profile.username }}</template>
            </p>
          </div>
        </div>
        <div class="page-actions">
          <Button label="Bildirim gönder" icon="pi pi-bell" outlined @click="activeTab = 'bildirim'" />
          <Button label="Profili düzenle" icon="pi pi-pencil" @click="editing = true" />
        </div>
      </header>

      <section class="hero-strip" aria-label="Özet">
        <div v-for="card in hero" :key="card.label" class="hero-cell">
          <small>{{ card.label }}</small>
          <strong>{{ card.value }}</strong>
          <em>{{ card.foot }}</em>
        </div>
      </section>

      <Tabs v-model:value="activeTab" class="seo-tabs detail-tabs">
        <TabList>
          <Tab value="profil">Profil</Tab>
          <Tab value="aliskanlik">Alışkanlıklar</Tab>
          <Tab value="oturum">Oturumlar</Tab>
          <Tab value="oyun">Oyunlaştırma</Tab>
          <Tab value="bildirim">Bildirimler</Tab>
          <Tab value="yonetim">Yönetim</Tab>
        </TabList>
        <TabPanels>
          <TabPanel value="profil">
            <ProfileTab
              v-if="activeTab === 'profil'"
              :detail="detail"
              :sources="result!.sources"
              :status="status"
              @edit="editing = true"
            />
          </TabPanel>
          <TabPanel value="aliskanlik">
            <HabitsTab v-if="activeTab === 'aliskanlik'" :detail="detail" :sources="result!.sources" />
          </TabPanel>
          <TabPanel value="oturum">
            <SessionsTab v-if="activeTab === 'oturum'" :detail="detail" :sources="result!.sources" />
          </TabPanel>
          <TabPanel value="oyun">
            <ProgressTab v-if="activeTab === 'oyun'" :detail="detail" :sources="result!.sources" />
          </TabPanel>
          <TabPanel value="bildirim">
            <NotifyTab v-if="activeTab === 'bildirim'" :detail="detail" :sources="result!.sources" />
          </TabPanel>
          <TabPanel value="yonetim">
            <ManageTab
              v-if="activeTab === 'yonetim'"
              :detail="detail"
              :writable="WRITABLE"
              :actor="actor"
              @edit="editing = true"
              @audit="addAudit"
            />
          </TabPanel>
        </TabPanels>
      </Tabs>

      <ProfileDialog
        v-model:visible="editing"
        :profile="detail.profile"
        :saving="saving"
        :writable="WRITABLE"
        @save="saveProfile"
      />
    </template>
  </div>
</template>
