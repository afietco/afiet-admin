<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import SourceChip from './SourceChip.vue'
import { label, STATUS_META, type Provenance, type UserDetail, type UserStatus } from '../../services/users'
import { age, ago, date, dateTime, num } from './shared'

const props = defineProps<{
  detail: UserDetail
  sources: Record<keyof UserDetail, Provenance>
  status: UserStatus
}>()
defineEmits<{ edit: [] }>()

const toast = useToast()

const profile = computed(() => props.detail.profile)

/** Kimlik kartındaki satırlar; boş alan gizlenmez, "—" ile durur ki eksik
    olduğu görünsün. */
const identity = computed(() => [
  { label: 'Görünen ad', value: profile.value.displayName || '—' },
  { label: 'Arkadaş kodu', value: profile.value.friendCode || '—' },
  { label: 'E-posta', value: profile.value.email },
  { label: 'Emoji', value: profile.value.emoji || '—' },
])

const body = computed(() => {
  const years = age(profile.value.birthDate)
  return [
    { label: 'Cinsiyet', value: label.sex(profile.value.sex) },
    { label: 'Doğum', value: profile.value.birthDate ? `${date(profile.value.birthDate)}${years === null ? '' : ` (${String(years)})`}` : '—' },
    { label: 'Boy', value: profile.value.heightCm ? `${String(profile.value.heightCm)} cm` : '—' },
    { label: 'Hareket', value: label.activity(profile.value.activityLevel) },
  ]
})

const account = computed(() => [
  { label: 'Katılım', value: date(profile.value.createdAt) },
  { label: 'Tanışma akışı', value: profile.value.onboardedAt ? `bitti · ${date(profile.value.onboardedAt)}` : 'bitmemiş' },
  { label: 'Son hareket', value: ago(props.detail.usage.lastActivityAt) },
  { label: 'Profil güncellemesi', value: ago(profile.value.updatedAt) },
])

const counters = computed(() => [
  { label: 'Öğün kaydı', value: props.detail.usage.mealCount, icon: 'pi pi-book' },
  { label: 'Menüm', value: props.detail.usage.customFoodCount, icon: 'pi pi-bookmark' },
  { label: 'Ölçüm', value: props.detail.usage.measurementCount, icon: 'pi pi-chart-line' },
  { label: 'Su günü', value: props.detail.usage.waterDays, icon: 'pi pi-cloud' },
  { label: 'Selam (gönderilen)', value: props.detail.usage.greetingsSent, icon: 'pi pi-send' },
  { label: 'Selam (alınan)', value: props.detail.usage.greetingsReceived, icon: 'pi pi-inbox' },
])

async function copyId() {
  try {
    await navigator.clipboard.writeText(profile.value.userId)
    toast.add({ severity: 'success', summary: 'Kullanıcı kimliği kopyalandı', life: 2000 })
  } catch {
    toast.add({ severity: 'warn', summary: 'Kopyalanamadı', detail: profile.value.userId, life: 4000 })
  }
}
</script>

<template>
  <div class="detail-body">
    <div class="split-grid wide-left">
      <article class="panel-card pad">
        <div class="panel-title sm">
          <div><p>KİMLİK</p><h2>Profil bilgileri</h2></div>
          <SourceChip :source="sources.profile" />
        </div>
        <dl class="fact-list">
          <div v-for="row in identity" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div>
        </dl>
        <div class="fact-divider" />
        <dl class="fact-list">
          <div v-for="row in body" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div>
        </dl>
        <div v-if="profile.sports.length" class="sport-row">
          <Tag v-for="sport in profile.sports" :key="sport" :value="sport" severity="secondary" />
        </div>
        <div class="card-foot">
          <Button label="Profili düzenle" icon="pi pi-pencil" size="small" outlined @click="$emit('edit')" />
        </div>
      </article>

      <article class="panel-card pad">
        <div class="panel-title sm">
          <div><p>HESAP</p><h2>Durum</h2></div>
          <Tag :value="STATUS_META[status].label" :severity="STATUS_META[status].severity" />
        </div>
        <p class="status-hint">{{ STATUS_META[status].hint }}</p>
        <dl class="fact-list">
          <div v-for="row in account" :key="row.label"><dt>{{ row.label }}</dt><dd>{{ row.value }}</dd></div>
        </dl>
        <div class="fact-divider" />
        <button type="button" class="id-copy" @click="copyId">
          <span>{{ profile.userId }}</span>
          <i class="pi pi-copy" />
        </button>
      </article>
    </div>

    <section class="panel-card pad">
      <div class="panel-title sm">
        <div><p>KAYITLAR</p><h2>Ne kadar kullandı</h2></div>
        <SourceChip :source="sources.usage" />
      </div>
      <div class="counter-grid">
        <div v-for="row in counters" :key="row.label" class="counter-cell">
          <i :class="row.icon" />
          <strong>{{ num(row.value) }}</strong>
          <small>{{ row.label }}</small>
        </div>
      </div>
    </section>

    <section class="panel-card pad">
      <div class="panel-title sm">
        <div><p>SOFRA</p><h2>Gruplar ve arkadaşlar</h2></div>
        <SourceChip :source="sources.social" />
      </div>
      <ul v-if="detail.social.groups.length" class="group-list">
        <li v-for="group in detail.social.groups" :key="group.groupId">
          <span class="group-glyph"><i class="pi pi-users" /></span>
          <div>
            <strong>{{ group.name }}</strong>
            <small>{{ group.role === 'owner' ? 'kurucu' : 'üye' }} · {{ num(group.members) }} kişi · {{ date(group.joinedAt) }}</small>
          </div>
          <Tag
            :value="group.sofraVisible ? 'sofra açık' : 'sofra kapalı'"
            :severity="group.sofraVisible ? 'success' : 'secondary'"
          />
        </li>
      </ul>
      <p v-else class="muted-status">Hiçbir gruba katılmamış.</p>
      <p class="note-line">
        <i class="pi pi-user" />
        {{ num(detail.social.friends) }} arkadaş · bildirim merkezi son okuma {{ dateTime(profile.notificationsReadAt) }}
      </p>
    </section>
  </div>
</template>
