<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { useToast } from 'primevue/usetoast'
import SourceChip from './SourceChip.vue'
import {
  label, platformLabel, STATUS_META, versionInfo,
  type Provenance, type UserDetail, type UserStatus,
} from '../../services/users'
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

/**
 * Sürüm iki kaynaktan okunur ve ikisi de gösterilir; hangisine inanılacağını
 * ekran söyler. Ayrımın gerekçesi services/users.ts içindeki VersionInfo
 * notunda: cihaz kaydı yalnız push parmak izi değişince yeniden yazılıyor.
 */
const version = computed(() => versionInfo(props.detail))
const league = computed(() => props.detail.gamification.league)

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
        <div><p>SÜRÜM VE LİG</p><h2>Neyle geziyor, nerede oturuyor</h2></div>
        <SourceChip :source="sources.sessions" />
      </div>
      <div class="vl-grid">
        <div class="vl-cell">
          <small>ÇALIŞAN SÜRÜM</small>
          <strong>{{ version.running || '—' }}</strong>
          <em v-if="version.running">
            {{ platformLabel(version.runningPlatform) }} · son oturum {{ dateTime(version.runningAt) }}
          </em>
          <em v-else>oturum telemetrisi bu kişiden akmıyor</em>
        </div>
        <div class="vl-cell" :class="{ stale: version.stale }">
          <small>KAYITLI SÜRÜM</small>
          <strong>{{ version.registered || '—' }}</strong>
          <em v-if="version.registered">
            {{ platformLabel(version.registeredPlatform) }} · push cihazı {{ dateTime(version.registeredAt) }}
          </em>
          <em v-else>push cihaz kaydı yok</em>
        </div>
        <div class="vl-cell">
          <small>LİG</small>
          <strong>{{ league ? label.tier(league.tier) : '—' }}</strong>
          <em v-if="league">
            {{ league.rank }}. / {{ num(league.members) }} kişi · {{ num(league.points) }} puan ·
            {{ league.seat }}. masa
          </em>
          <em v-else>bu mevsim hiçbir masaya oturmamış</em>
        </div>
      </div>
      <p v-if="version.stale" class="vl-warn">
        <i class="pi pi-exclamation-triangle" />
        Cihaz kaydı geride kalmış: <strong>{{ version.registered }}</strong> yazıyor ama uygulama
        <strong>{{ version.running }}</strong> ile açılmış. Sürüm satırı yalnız push parmak izi değişince
        yeniden yazıldığı için doğru cevap çalışan sürümdür.
      </p>
      <!--
        İkram kesesi: veri uçtan gelmiyor, uydurulmuyor. Gerekli alanın tam
        şekli ve backend'de nereye eklendiği services/users.ts içindeki kese
        notunda yazılı.
      -->
      <div class="vl-empty">
        <i class="pi pi-inbox" />
        <div>
          <strong>İkram kesesi verisi henüz uçtan gelmiyor.</strong>
          <small>
            Kese haftalık Afi sohbeti hakkı; boyutunu lig kademesi belirler. Backend bugün keseyi yalnız
            kişinin kendi ucunda hesaplıyor, admin kullanıcı detayında karşılığı yok. Gelmesi hâlinde
            haftalık hak, harcanan ve kalan bu kartta durur.
          </small>
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

<style scoped>
.vl-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.vl-cell { display: grid; gap: 4px; padding: 13px 15px; border: 1px solid #e5e9e2; border-radius: 14px; background: #f7f9f5; }
.vl-cell small { color: #8b8e84; font-size: 9px; font-weight: 900; letter-spacing: .12em; }
.vl-cell strong { color: #2c332e; font-size: 20px; font-weight: 900; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
.vl-cell em { color: #8d9087; font-size: 10.5px; font-style: normal; font-weight: 700; line-height: 1.45; }
.vl-cell.stale { border-color: #ecd3a3; background: #fdf7ea; }
.vl-cell.stale strong { color: #8a6512; }

.vl-warn {
  display: flex; gap: 8px; align-items: flex-start; margin: 12px 0 0;
  padding: 10px 12px; border: 1px solid #ecd3a3; border-radius: 11px;
  color: #8a6512; background: #fdf5e3; font-size: 11px; font-weight: 700; line-height: 1.5;
}
.vl-warn i { margin-top: 1px; font-size: 11px; }
.vl-warn strong { font-weight: 900; font-variant-numeric: tabular-nums; }

.vl-empty {
  display: flex; gap: 12px; align-items: flex-start; margin-top: 12px;
  padding: 14px 15px; border: 1px dashed #ddd8ca; border-radius: 14px; background: #fbf9f3;
}
.vl-empty i { margin-top: 2px; color: #b3b6ab; font-size: 15px; }
.vl-empty strong { display: block; color: #5c6058; font-size: 12.5px; font-weight: 800; }
.vl-empty small { display: block; margin-top: 4px; color: #9a9c93; font-size: 10.5px; font-weight: 700; line-height: 1.55; }

@media (max-width: 900px) {
  .vl-grid { grid-template-columns: 1fr; }
}
</style>
