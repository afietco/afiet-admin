<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ToggleSwitch from 'primevue/toggleswitch'
import AdminPlaceholder from '../../components/AdminPlaceholder.vue'
import TriggerDialog from './TriggerDialog.vue'
import TimeField from './TimeField.vue'
import { adminApi } from '../../services/admin'
import {
  isValidPushTime, pushTargetLabel, pushTriggerCondition, pushTriggerMeta,
  type PushBroadcast, type PushGlobalPatch, type PushOverview,
  type PushTrigger, type PushTriggerPatch,
} from '../../services/push'

const emit = defineEmits<{ compose: [] }>()

const toast = useToast()
const confirm = useConfirm()

const data = ref<PushOverview | null>(null)
const loading = ref(false)
const live = ref(true)
const savingKind = ref<string | null>(null)
const savingGlobals = ref(false)
const editing = ref<PushTrigger | null>(null)

/**
 * Anahtarların görünen durumu ayrı tutuluyor. ToggleSwitch tıklamada kendi
 * içini hemen çeviriyor ve yalnız modelValue DEĞİŞİRSE geri eşitliyor; onay
 * iptal edilince prop aynı kalsaydı anahtar yanlış konumda kalırdı.
 */
const switches = reactive<Record<string, boolean>>({})

const quietStart = ref<string | null>(null)
const quietEnd = ref<string | null>(null)
const quietSubmitted = ref(false)

const number = (value: number) => value.toLocaleString('tr-TR')
const percent = (part: number, whole: number) => whole > 0 ? `%${Math.round((part / whole) * 100)}` : 'yok'

const dateFormat = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })
const formatDate = (value: string) => dateFormat.format(new Date(value))

const deviceTotal = computed(() => data.value ? data.value.devices.ios + data.value.devices.android : 0)

/**
 * Ana anahtar açık olsa bile ortam değişkeni kapalıyken hiçbir şey gitmez.
 * Kartlardaki rozet bunu yutmasın diye durum üç değerli.
 */
const sending = computed(() => Boolean(data.value?.masterEnabled && data.value?.envEnabled))

function triggerState(trigger: PushTrigger): { label: string; severity: string } {
  if (!trigger.enabled) return { label: 'Kapalı', severity: 'secondary' }
  if (!sending.value) return { label: 'Duraklatıldı', severity: 'warn' }
  return { label: 'Açık', severity: 'success' }
}

const quietDirty = computed(() =>
  Boolean(data.value)
  && (quietStart.value !== data.value!.quietStart || quietEnd.value !== data.value!.quietEnd))

const quietValid = computed(() => isValidPushTime(quietStart.value) && isValidPushTime(quietEnd.value))

function apply(overview: PushOverview) {
  data.value = overview
  quietStart.value = overview.quietStart
  quietEnd.value = overview.quietEnd
  quietSubmitted.value = false
  switches.master = overview.masterEnabled
  overview.triggers.forEach((trigger) => { switches[trigger.kind] = trigger.enabled })
}

async function load() {
  loading.value = true
  try {
    apply(await adminApi.pushOverview())
    live.value = true
  } catch {
    data.value = null
    live.value = false
  } finally { loading.value = false }
}

async function saveGlobals(patch: PushGlobalPatch, summary: string, severity: 'success' | 'warn' = 'success') {
  savingGlobals.value = true
  try {
    apply(await adminApi.updatePushGlobals(patch))
    toast.add({ severity, summary, life: 3000 })
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Ayar kaydedilemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
    await load()
  } finally { savingGlobals.value = false }
}

function onMasterToggle(value: boolean) {
  switches.master = value
  if (value) {
    void saveGlobals({ masterEnabled: true }, 'Bildirim gönderimi açıldı')
    return
  }
  confirm.require({
    header: 'Bildirim gönderimini durdur',
    message: 'Tüm otomatik tetikleyiciler ve zamanlanmış duyurular beklemeye alınır. Anahtar tekrar açılınca bekleyenler sıradan devam eder. Onaylıyor musun?',
    icon: 'pi pi-pause-circle',
    rejectLabel: 'Vazgeç',
    acceptLabel: 'Durdur',
    acceptClass: 'p-button-danger',
    accept: () => void saveGlobals({ masterEnabled: false }, 'Bildirim gönderimi durduruldu', 'warn'),
    reject: () => { switches.master = true },
  })
}

function saveQuietHours() {
  quietSubmitted.value = true
  if (!quietValid.value) return
  void saveGlobals(
    { quietStart: quietStart.value!, quietEnd: quietEnd.value! },
    'Sessiz saatler güncellendi',
  )
}

async function patchTrigger(trigger: PushTrigger, patch: PushTriggerPatch, summary: string) {
  savingKind.value = trigger.kind
  try {
    const updated = await adminApi.updatePushTrigger(trigger.kind, patch)
    const index = data.value!.triggers.findIndex((item) => item.kind === trigger.kind)
    if (index >= 0) data.value!.triggers[index] = updated
    switches[trigger.kind] = updated.enabled
    toast.add({ severity: 'success', summary, life: 2500 })
    editing.value = null
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Kaydedilemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
    await load()
  } finally { savingKind.value = null }
}

function onTriggerToggle(trigger: PushTrigger, value: boolean) {
  switches[trigger.kind] = value
  const label = pushTriggerMeta[trigger.kind].label
  void patchTrigger(trigger, { enabled: value }, value ? `${label} açıldı` : `${label} kapatıldı`)
}

function cancelScheduled(item: PushBroadcast) {
  confirm.require({
    header: 'Gönderimi iptal et',
    message: `“${item.title}” duyurusu iptal edilsin mi? Zamanı geldiğinde gönderilmez.`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Vazgeç',
    acceptLabel: 'İptal et',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await adminApi.cancelPushBroadcast(item.id)
        if (data.value) data.value.scheduled = data.value.scheduled.filter((row) => row.id !== item.id)
        toast.add({ severity: 'success', summary: 'Gönderim iptal edildi', life: 2500 })
      } catch (err) {
        toast.add({ severity: 'error', summary: 'İptal edilemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
      }
    },
  })
}

onMounted(load)
defineExpose({ load })
</script>

<template>
  <div class="tab-body">
    <AdminPlaceholder
      v-if="!live"
      icon="pi pi-bell"
      title="Tetikleyici ayarları okunamadı"
      description="Bildirim altyapısı bu ortama bağlandığında otomatik tetikleyiciler ve izin sayıları burada görünür."
      retryable
      :loading="loading"
      @retry="load"
    />

    <template v-else-if="data">
      <!-- İzin ve teslimat özeti -->
      <div class="metric-grid">
        <article class="metric-card green">
          <div class="metric-top"><span>BİLDİRİM İZNİ</span><i class="pi pi-check-circle" /></div>
          <strong>{{ number(data.users.permitted) }}</strong>
          <div class="metric-foot">
            <small>{{ number(data.users.total) }} KULLANICININ {{ percent(data.users.permitted, data.users.total) }}’İ</small>
          </div>
        </article>
        <article class="metric-card blue">
          <div class="metric-top"><span>AKTİF CİHAZ</span><i class="pi pi-mobile" /></div>
          <strong>{{ number(deviceTotal) }}</strong>
          <div class="metric-foot">
            <small>iOS {{ number(data.devices.ios) }} · ANDROID {{ number(data.devices.android) }}</small>
          </div>
        </article>
        <article class="metric-card amber">
          <div class="metric-top"><span>7 GÜNDE ULAŞAN</span><i class="pi pi-send" /></div>
          <strong>{{ percent(data.delivery7d.delivered, data.delivery7d.sent) }}</strong>
          <div class="metric-foot">
            <small>{{ number(data.delivery7d.delivered) }} / {{ number(data.delivery7d.sent) }} GÖNDERİM</small>
          </div>
        </article>
        <article class="metric-card coral">
          <div class="metric-top"><span>DÜŞEN CİHAZ</span><i class="pi pi-times-circle" /></div>
          <strong>{{ number(data.devices.disabled7d) }}</strong>
          <div class="metric-foot">
            <small>SON 7 GÜNDE, UYGULAMAYI SİLEN YA DA İZNİ KAPATAN</small>
          </div>
        </article>
      </div>

      <!-- Ana anahtar ve sessiz saatler -->
      <section class="panel-card pad global-card">
        <label class="switch-row big" :class="{ danger: !switches.master }">
          <div>
            <strong>Bildirim gönderimi</strong>
            <small>
              Kapatınca hiçbir tetikleyici ve zamanlanmış duyuru gönderilmez, bekleyenler sırada kalır.
            </small>
          </div>
          <ToggleSwitch
            :model-value="switches.master" :disabled="savingGlobals"
            aria-label="Bildirim gönderimi ana anahtarı"
            @update:model-value="onMasterToggle"
          />
        </label>

        <p v-if="!data.envEnabled" class="push-note">
          <i class="pi pi-exclamation-triangle" />
          <span>
            Ortam değişkeni <strong>PUSH_ENABLED</strong> kapalı, bu ortamda hiçbir bildirim gerçekten gönderilmiyor.
            Buradaki anahtar açık olsa bile gönderim başlamaz, açmak için deploy gerekir.
          </span>
        </p>

        <div class="quiet-row">
          <div class="form-field">
            <label for="quiet-start">Sessiz saat başlangıcı</label>
            <TimeField id="quiet-start" v-model="quietStart" :show-error="quietSubmitted" />
          </div>
          <div class="form-field">
            <label for="quiet-end">Sessiz saat bitişi</label>
            <TimeField id="quiet-end" v-model="quietEnd" :show-error="quietSubmitted" />
          </div>
          <div class="quiet-copy">
            <p>
              Bu aralığa denk gelen sofra ve arkadaşlık bildirimleri, kullanıcının yerel saatiyle
              bitiş saatine ertelenir. Öğün hatırlatması ve hafta kutlaması zaten kendi saatinde gider.
            </p>
            <small v-if="quietSubmitted && !quietValid" class="field-error">
              Geçerli bir saat gir (00:00 ile 23:59 arası).
            </small>
            <Button
              label="Kaydet" icon="pi pi-check" size="small"
              :loading="savingGlobals" :disabled="!quietDirty" @click="saveQuietHours"
            />
          </div>
        </div>
      </section>

      <!-- Tetikleyiciler -->
      <div>
        <strong class="block-caption">
          OTOMATİK TETİKLEYİCİLER
          <span class="cap-note">uygulamanın kendi ürettiği bildirimler</span>
        </strong>
        <div class="trigger-grid">
          <article
            v-for="trigger in data.triggers" :key="trigger.kind"
            class="trigger-card" :class="[pushTriggerMeta[trigger.kind].tone, { off: !trigger.enabled }]"
          >
            <header class="trigger-head">
              <span class="trigger-glyph"><i :class="pushTriggerMeta[trigger.kind].icon" /></span>
              <div class="trigger-name">
                <strong>{{ pushTriggerMeta[trigger.kind].label }}</strong>
                <small>{{ pushTriggerCondition(trigger) }}</small>
              </div>
              <ToggleSwitch
                :model-value="switches[trigger.kind]" :disabled="savingKind === trigger.kind"
                :aria-label="`${pushTriggerMeta[trigger.kind].label} anahtarı`"
                @update:model-value="(value: boolean) => onTriggerToggle(trigger, value)"
              />
            </header>

            <div v-if="!pushTriggerMeta[trigger.kind].composeOnly" class="trigger-copy">
              <strong>{{ trigger.title }}</strong>
              <p v-if="trigger.body">{{ trigger.body }}</p>
              <p v-else class="trigger-copy-empty">Gövde metni yok, bildirim tek satır görünür.</p>
            </div>
            <div v-else class="trigger-copy compose">
              <p>Metin her gönderimde Gönder sekmesinde yazılır.</p>
            </div>

            <p v-if="!pushTriggerMeta[trigger.kind].composeOnly" class="trigger-target">
              <i class="pi pi-arrow-right" />
              Dokununca <strong>{{ pushTargetLabel(trigger.target) }}</strong> açılır
            </p>

            <dl class="trigger-stats">
              <div>
                <dt>Açık tutan</dt>
                <dd>{{ number(trigger.optedIn) }}</dd>
              </div>
              <div>
                <dt>7 günde</dt>
                <dd>{{ number(trigger.sent7d) }}</dd>
              </div>
              <div>
                <dt>Ulaşan</dt>
                <dd>{{ percent(trigger.delivered7d, trigger.sent7d) }}</dd>
              </div>
            </dl>

            <footer class="trigger-foot">
              <Tag :value="triggerState(trigger).label" :severity="triggerState(trigger).severity" />
              <Button
                v-if="pushTriggerMeta[trigger.kind].composeOnly"
                label="Gönder sekmesi" icon="pi pi-arrow-right" icon-pos="right"
                size="small" severity="secondary" text @click="emit('compose')"
              />
              <Button
                v-else label="Düzenle" icon="pi pi-pencil" size="small" severity="secondary" outlined
                @click="editing = trigger"
              />
            </footer>
          </article>
        </div>
      </div>

      <!-- Zamanlanmış duyurular -->
      <div>
        <strong class="block-caption">
          ZAMANLANMIŞ GÖNDERİMLER
          <span class="cap-note">henüz gönderilmemiş duyurular</span>
        </strong>
        <div v-if="data.scheduled.length" class="scheduled-list">
          <article v-for="item in data.scheduled" :key="item.id" class="scheduled-row">
            <span class="scheduled-when">
              <i class="pi pi-clock" />
              {{ formatDate(item.scheduledAt!) }}
            </span>
            <div class="scheduled-copy">
              <strong>{{ item.title }}</strong>
              <small>{{ item.body }}</small>
            </div>
            <Tag :value="pushTargetLabel(item.target)" severity="secondary" />
            <span class="scheduled-count">{{ number(item.recipientCount) }} cihaz</span>
            <Button
              icon="pi pi-times" text rounded severity="danger" aria-label="İptal et"
              @click="cancelScheduled(item)"
            />
          </article>
        </div>
        <p v-else class="scheduled-empty">
          Bekleyen zamanlanmış gönderim yok. Gönder sekmesinden bir bildirimi ileri bir tarihe kurabilirsin.
        </p>
      </div>
    </template>

    <TriggerDialog
      :trigger="editing" :saving="savingKind !== null"
      @close="editing = null"
      @save="(patch) => editing && patchTrigger(editing, patch, 'Tetikleyici güncellendi')"
    />
  </div>
</template>
