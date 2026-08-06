<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import SourceChip from './SourceChip.vue'
import { adminApi } from '../../services/admin'
import {
  PUSH_BODY_MAX, PUSH_TITLE_MAX, pushTargetGroups, pushTargetLabel,
  type PushScreenTarget,
} from '../../services/push'
import { deliveryStatusLabel, versionInfo, type Provenance, type UserDetail } from '../../services/users'
import { dateTime, num } from './shared'

const props = defineProps<{ detail: UserDetail; sources: Record<keyof UserDetail, Provenance> }>()

const toast = useToast()
const confirm = useConfirm()

const notifications = computed(() => props.detail.notifications)
const email = computed(() => props.detail.profile.email)

/**
 * Cihaz satırındaki sürüm KAYITLI sürümdür ve bayat olabilir: `push_devices`
 * satırı yalnız push parmak izi (token, izin, platform) değişince yeniden
 * yazılıyor, sürüm yükseltmesi tek başına ona dokunmuyor. Aynı sebeple
 * "son görülme" de aslında "cihaz kaydının son yazıldığı an".
 *
 * Gerçekten çalışan sürüm oturum telemetrisinde: son `session_start`
 * olayının app_version'ı. İkisi çeliştiğinde ekran bunu söylüyor.
 */
const version = computed(() => versionInfo(props.detail))

/** Duyuru kitlesi e-posta ya da kullanıcı adıyla çözülüyor; e-posta her
    profilde dolu olduğu için tek kullanıcı gönderiminde onu kullanıyoruz. */
const form = reactive({ title: '', body: '', target: 'bugun' as PushScreenTarget })
const submitted = ref(false)
const sending = ref(false)
const reach = ref<{ recipientCount: number; deviceCount: number } | null>(null)
const reachError = ref('')

const targetOptions = pushTargetGroups.flatMap((group) =>
  group.items.map((item) => ({ value: item.value, label: `${group.label} · ${item.label}` })))

const invalid = computed(() => ({
  title: !form.title.trim() || form.title.length > PUSH_TITLE_MAX,
  body: !form.body.trim() || form.body.length > PUSH_BODY_MAX,
}))

const prefRows = computed(() => {
  const prefs = notifications.value.preferences
  if (!prefs) return []
  return [
    // Saat yoksa kullanıcı kendi saatini seçmemiş: genel ayar geçerli.
    { label: 'Öğün hatırlatması', value: prefs.mealReminderEnabled ? `açık · ${prefs.mealReminderTime ?? 'genel ayar'}` : 'kapalı', on: prefs.mealReminderEnabled },
    { label: 'Hafta kapanışı', value: prefs.weekClosureEnabled ? 'açık' : 'kapalı', on: prefs.weekClosureEnabled },
    { label: 'Sosyal bildirimler', value: prefs.socialEnabled ? 'açık' : 'kapalı', on: prefs.socialEnabled },
    { label: 'Sessiz saatler', value: prefs.quietStart && prefs.quietEnd ? `${prefs.quietStart} - ${prefs.quietEnd}` : 'genel ayar', on: true },
    { label: 'Saat dilimi', value: prefs.timezone, on: true },
  ]
})

async function loadReach() {
  reachError.value = ''
  try {
    reach.value = await adminApi.pushAudience({ kind: 'user', identifier: email.value })
  } catch (err) {
    reach.value = null
    reachError.value = err instanceof Error ? err.message : 'Kitle okunamadı.'
  }
}

function send() {
  submitted.value = true
  if (invalid.value.title || invalid.value.body) return
  confirm.require({
    header: 'Bildirimi gönder',
    message: `"${form.title}" bildirimi yalnız ${email.value} adresine gidecek. Gönderilsin mi?`,
    icon: 'pi pi-bell',
    rejectLabel: 'Vazgeç',
    acceptLabel: 'Gönder',
    accept: async () => {
      sending.value = true
      try {
        await adminApi.sendPushBroadcast({
          title: form.title.trim(),
          body: form.body.trim(),
          target: form.target,
          audience: { kind: 'user', identifier: email.value },
          scheduledAt: null,
          ignoreQuietHours: false,
        })
        toast.add({ severity: 'success', summary: 'Bildirim sıraya alındı', life: 2500 })
        form.title = ''
        form.body = ''
        submitted.value = false
      } catch (err) {
        toast.add({
          severity: 'error', summary: 'Gönderilemedi',
          detail: err instanceof Error ? err.message : '', life: 4500,
        })
      } finally {
        sending.value = false
      }
    },
  })
}

onMounted(loadReach)
</script>

<template>
  <div class="detail-body">
    <div class="split-grid">
      <article class="panel-card pad">
        <div class="panel-title sm">
          <div><p>CİHAZLAR</p><h2>Nereden giriyor</h2></div>
          <SourceChip :source="sources.notifications" />
        </div>
        <ul v-if="notifications.devices.length" class="device-list">
          <li v-for="(device, index) in notifications.devices" :key="index">
            <i :class="device.platform === 'ios' ? 'pi pi-apple' : 'pi pi-android'" />
            <div>
              <strong>{{ device.platform === 'ios' ? 'iPhone' : 'Android' }}</strong>
              <!-- İki alan da kayıt anını anlatır, kullanım anını değil:
                   satır yalnız push parmak izi değişince yeniden yazılıyor. -->
              <small>
                kayıtlı sürüm {{ device.appVersion || 'bilinmiyor' }}
                · kayıt {{ dateTime(device.lastSeenAt) }}
              </small>
            </div>
            <Tag
              :value="device.enabled ? 'kayıt açık' : 'kapatıldı'"
              :severity="device.enabled ? 'success' : 'secondary'"
            />
          </li>
        </ul>
        <p v-else class="muted-status">Kayıtlı cihaz yok; bu kullanıcıya bildirim ulaşmaz.</p>

        <p v-if="version.stale" class="version-warn">
          <i class="pi pi-exclamation-triangle" />
          <span>
            Kayıtlı sürüm geride: uygulama en son <strong>{{ version.running }}</strong> ile açılmış,
            cihaz kaydı hâlâ <strong>{{ version.registered }}</strong> diyor. Çalışan sürüm için
            oturum telemetrisine bak.
          </span>
        </p>
        <p v-else-if="version.running" class="muted-status version-ok">
          Çalışan sürüm {{ version.running }}; cihaz kaydıyla uyuşuyor.
        </p>
      </article>

      <article class="panel-card pad">
        <div class="panel-title sm"><div><p>TERCİHLER</p><h2>Neye izin vermiş</h2></div></div>
        <dl v-if="prefRows.length" class="fact-list">
          <div v-for="row in prefRows" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd :class="{ off: !row.on }">{{ row.value }}</dd>
          </div>
        </dl>
        <p v-else class="muted-status">Tercih satırı yok; varsayılanlar geçerli.</p>
      </article>
    </div>

    <section class="panel-card pad">
      <div class="panel-title sm">
        <div><p>GÖNDERİM</p><h2>Bu kullanıcıya bildirim</h2></div>
        <span class="live-badge"><i class="pi pi-circle-fill" /> canlı uç</span>
      </div>
      <!-- "ulaşır" değil "kuyruğa girer": deviceCount kayıtlı cihaz sayısı,
           teslimatın gerçekleşeceğinin güvencesi değil. -->
      <p class="reach-line">
        <template v-if="reach">
          Şu an <strong>{{ num(reach.deviceCount) }}</strong> kayıtlı cihaz için kuyruğa girer.
        </template>
        <template v-else-if="reachError">{{ reachError }}</template>
        <template v-else>Kitle hesaplanıyor…</template>
      </p>

      <div class="form-grid">
        <div class="form-field span-2">
          <label for="notify-title">Başlık *</label>
          <InputText
            id="notify-title"
            v-model="form.title"
            fluid
            :maxlength="PUSH_TITLE_MAX"
            :invalid="submitted && invalid.title"
            placeholder="Kısa ve doğrudan"
          />
          <small>{{ form.title.length }} / {{ PUSH_TITLE_MAX }}</small>
        </div>
        <div class="form-field span-2">
          <label>Dokununca açılacak ekran</label>
          <Select v-model="form.target" :options="targetOptions" option-label="label" option-value="value" fluid />
          <small>Bildirime dokununca {{ pushTargetLabel(form.target) }} açılır.</small>
        </div>
        <div class="form-field span-4">
          <label for="notify-body">Metin *</label>
          <Textarea
            id="notify-body"
            v-model="form.body"
            rows="3"
            fluid
            auto-resize
            :maxlength="PUSH_BODY_MAX"
            :invalid="submitted && invalid.body"
          />
          <small>{{ form.body.length }} / {{ PUSH_BODY_MAX }}</small>
        </div>
      </div>
      <div class="card-foot">
        <span class="muted-status">Sessiz saatler geçerli; gece yarısı kuyruğa girse bile sabah gider.</span>
        <Button label="Gönder" icon="pi pi-send" :loading="sending" @click="send" />
      </div>
    </section>

    <section class="panel-card pad">
      <div class="panel-title sm">
        <div><p>GEÇMİŞ</p><h2>Son gönderimler</h2></div>
        <!-- sent30d = status IN ('ticketed','delivered'), yani Expo'nun kabul
             ettiği teslimatlar. "Gönderim" değil "yola çıkan"; failed30d ile
             toplamı kuyruğa giren toplamını vermez. -->
        <span class="result-count">
          30 günde {{ num(notifications.sent30d) }} yola çıktı · {{ num(notifications.failed30d) }} başarısız
        </span>
      </div>
      <ul v-if="notifications.recent.length" class="delivery-list">
        <li v-for="(row, index) in notifications.recent" :key="index">
          <span class="delivery-dot" :class="row.status" />
          <div>
            <strong>{{ row.title }}</strong>
            <small>{{ row.kind }} · {{ dateTime(row.sentAt) }}</small>
          </div>
          <Tag
            :value="deliveryStatusLabel(row.status).label"
            :severity="deliveryStatusLabel(row.status).severity"
          />
        </li>
      </ul>
      <p v-else class="muted-status">Bu kullanıcıya henüz bildirim gitmemiş.</p>
    </section>
  </div>
</template>

<style scoped>
/* İki sürüm kaynağı çeliştiğinde uyarı; çelişmediğinde tek satır teyit.
   Uyarı kartın içinde kalır, listeyle aynı köşe yarıçapını paylaşır. */
.version-warn {
  display: flex;
  gap: 9px;
  align-items: flex-start;
  margin: 10px 0 0;
  padding: 10px 12px;
  border: 1px solid #ecd3a3;
  border-radius: 12px;
  color: #8a6512;
  background: #fdf5e3;
  font-size: 11px;
  line-height: 1.5;
}
.version-warn i { margin-top: 2px; font-size: 12px; }
.version-ok { margin: 10px 0 0; font-size: 11px; }
</style>
