<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { adminApi } from '../../services/admin'
import {
  PUSH_BODY_MAX, PUSH_TITLE_MAX, pushTargetGroups, pushTargetLabel,
  type PushAudience, type PushScreenTarget,
} from '../../services/push'

// Gönderim sonrası geçmiş sekmesi tazelensin diye üst kabuğa haber verilir.
const emit = defineEmits<{ sent: [] }>()

const toast = useToast()
const confirm = useConfirm()

const audienceOptions = [{ value: 'all', label: 'Herkes' }, { value: 'user', label: 'Tek kullanıcı' }]
const timingOptions = [{ value: 'now', label: 'Şimdi' }, { value: 'later', label: 'Zamanla' }]

const form = reactive({
  title: '',
  body: '',
  target: 'bugun' as PushScreenTarget,
  audience: 'all' as PushAudience['kind'],
  identifier: '',
  timing: 'now' as 'now' | 'later',
  scheduledAt: null as Date | null,
  ignoreQuietHours: false,
})

const submitted = ref(false)
const sending = ref(false)
const recipients = ref<number | null>(null)
const recipientsLoading = ref(false)

const titleLeft = computed(() => PUSH_TITLE_MAX - form.title.length)
const bodyLeft = computed(() => PUSH_BODY_MAX - form.body.length)
const targetLabel = computed(() => pushTargetLabel(form.target))

const audience = computed<PushAudience>(() =>
  form.audience === 'user' ? { kind: 'user', identifier: form.identifier.trim() } : { kind: 'all' })

const effectiveDate = computed(() => form.timing === 'later' ? form.scheduledAt : new Date())

/**
 * Sessiz saatler kullanıcının yerel saatine göre işler; bu yalnızca senin
 * saatine göre bir uyarı. Aralık artık Aktif bildirimler sekmesinden
 * değiştirilebiliyor, buradaki 22/09 eşiği ise hâlâ sabit: uyarı bir tahmin,
 * gerçek erteleme kararını sunucu veriyor. Bu sekme detaylandırılırken
 * overview'dan okunup gerçek aralıkla değiştirilmeli.
 */
const hitsQuietHours = computed(() => {
  const date = effectiveDate.value
  if (!date || form.ignoreQuietHours) return false
  const hour = date.getHours()
  return hour >= 22 || hour < 9
})

const errors = computed(() => ({
  title: !form.title.trim() || form.title.length > PUSH_TITLE_MAX,
  body: !form.body.trim() || form.body.length > PUSH_BODY_MAX,
  identifier: form.audience === 'user' && !form.identifier.trim(),
  scheduledAt: form.timing === 'later' && (!form.scheduledAt || form.scheduledAt.getTime() <= Date.now()),
}))
const valid = computed(() => !Object.values(errors.value).some(Boolean))

const dateFormat = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })

async function loadRecipients() {
  if (form.audience === 'user' && !form.identifier.trim()) { recipients.value = null; return }
  recipientsLoading.value = true
  try {
    const preview = await adminApi.pushAudience(audience.value)
    recipients.value = preview.deviceCount
  } catch {
    recipients.value = null // uydurma sayı gösterme
  } finally { recipientsLoading.value = false }
}

function resetForm() {
  Object.assign(form, {
    title: '', body: '', target: 'bugun', audience: 'all', identifier: '',
    timing: 'now', scheduledAt: null, ignoreQuietHours: false,
  })
  submitted.value = false
  recipients.value = null
}

function askToSend() {
  submitted.value = true
  if (!valid.value) return
  const who = form.audience === 'all'
    ? (recipients.value === null ? 'tüm kayıtlı cihazlar için' : `${recipients.value.toLocaleString('tr-TR')} kayıtlı cihaz için`)
    : `${form.identifier.trim()} kullanıcısı için`
  const when = form.timing === 'now' ? 'hemen' : dateFormat.format(form.scheduledAt!)
  const quiet = hitsQuietHours.value ? ' Sessiz saatlere denk gelenler aralığın bitişinde iletilir.' : ''
  confirm.require({
    header: 'Bildirimi gönder',
    message: `“${form.title.trim()}” bildirimi ${who} ${when} kuyruğa girecek ve dokunanı ${targetLabel.value} ekranına yönlendirecek.${quiet} Onaylıyor musun?`,
    icon: 'pi pi-send',
    rejectLabel: 'Vazgeç',
    acceptLabel: form.timing === 'now' ? 'Gönder' : 'Zamanla',
    accept: send,
  })
}

async function send() {
  sending.value = true
  try {
    await adminApi.sendPushBroadcast({
      title: form.title.trim(),
      body: form.body.trim(),
      target: form.target,
      audience: audience.value,
      scheduledAt: form.timing === 'later' ? form.scheduledAt!.toISOString() : null,
      ignoreQuietHours: form.ignoreQuietHours,
    })
    toast.add({ severity: 'success', summary: form.timing === 'now' ? 'Bildirim sıraya alındı' : 'Bildirim zamanlandı', life: 3000 })
    resetForm()
    emit('sent')
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Bildirim gönderilemedi', detail: err instanceof Error ? err.message : '', life: 4500 })
  } finally { sending.value = false }
}

onMounted(loadRecipients)
</script>

<template>
  <div class="tab-body">
    <div class="push-layout">
      <section class="push-compose">
        <div class="form-grid">
          <div class="form-field span-2">
            <label for="push-title">Başlık *</label>
            <InputText
              id="push-title" v-model="form.title" fluid :maxlength="PUSH_TITLE_MAX"
              placeholder="Kısa ve net bir başlık" :invalid="submitted && errors.title"
            />
            <small class="label-hint">{{ titleLeft }} karakter kaldı</small>
            <small v-if="submitted && errors.title" class="field-error">Başlık gerekli.</small>
          </div>

          <div class="form-field span-2">
            <label for="push-body">Metin *</label>
            <Textarea
              id="push-body" v-model="form.body" rows="3" fluid auto-resize :maxlength="PUSH_BODY_MAX"
              placeholder="Bildirimde görünecek metin" :invalid="submitted && errors.body"
            />
            <small class="label-hint">{{ bodyLeft }} karakter kaldı</small>
            <small v-if="submitted && errors.body" class="field-error">Metin gerekli.</small>
          </div>

          <div class="form-field span-2">
            <label>Hedef ekran *</label>
            <Select
              v-model="form.target" :options="pushTargetGroups" option-label="label" option-value="value"
              option-group-label="label" option-group-children="items" fluid
            />
            <small class="label-hint">Bildirime dokunan kullanıcı bu ekrana gider.</small>
          </div>

          <div class="form-field" :class="{ 'span-2': form.audience === 'all' }">
            <label>Kitle</label>
            <SelectButton
              v-model="form.audience" :options="audienceOptions" option-label="label" option-value="value"
              :allow-empty="false" @change="loadRecipients"
            />
          </div>
          <div v-if="form.audience === 'user'" class="form-field">
            <label for="push-user">Kullanıcı *</label>
            <InputText
              id="push-user" v-model="form.identifier" fluid placeholder="e-posta ya da kullanıcı adı"
              :invalid="submitted && errors.identifier" @blur="loadRecipients"
            />
            <small v-if="submitted && errors.identifier" class="field-error">Kullanıcı gerekli.</small>
          </div>

          <div class="form-field" :class="{ 'span-2': form.timing === 'now' }">
            <label>Zamanlama</label>
            <SelectButton
              v-model="form.timing" :options="timingOptions" option-label="label" option-value="value"
              :allow-empty="false"
            />
          </div>
          <div v-if="form.timing === 'later'" class="form-field">
            <label for="push-when">Gönderim zamanı *</label>
            <DatePicker
              id="push-when" v-model="form.scheduledAt" show-time hour-format="24" fluid
              :min-date="new Date()" date-format="dd.mm.yy" placeholder="Tarih ve saat seç"
              :invalid="submitted && errors.scheduledAt"
            />
            <small v-if="submitted && errors.scheduledAt" class="field-error">İleri bir tarih seç.</small>
          </div>

          <label class="switch-row span-2">
            <div>
              <strong>Sessiz saatleri yoksay</strong>
              <small>
                Kapalıyken sessiz saatlere denk gelen bildirimler, aralığın bitiş saatinde iletilir.
                Aralığı Aktif bildirimler sekmesinden değiştirebilirsin.
              </small>
            </div>
            <ToggleSwitch v-model="form.ignoreQuietHours" />
          </label>

          <p v-if="hitsQuietHours" class="push-note span-2">
            <i class="pi pi-moon" />
            Seçtiğin zaman sessiz saatlere denk geliyor. Bildirim, kullanıcının yerel saatiyle sessiz aralığın bitişinde iletilecek.
          </p>
        </div>

        <div class="section-footer">
          <!-- "gidecek" değil "kuyruğa girecek": kayıtlı cihaz sayısı,
               bildirimin ulaşacağını değil sıraya alınacağını söyler. -->
          <span class="section-status">
            <template v-if="form.audience === 'user'">Tek kullanıcı için kuyruğa girecek.</template>
            <template v-else-if="recipientsLoading">Kayıtlı cihaz sayısı hesaplanıyor…</template>
            <template v-else-if="recipients !== null">{{ recipients.toLocaleString('tr-TR') }} kayıtlı cihaz için kuyruğa girecek.</template>
            <template v-else>Kayıtlı cihaz sayısı bildirim altyapısı bağlanınca görünecek.</template>
          </span>
          <div class="section-buttons">
            <Button label="Temizle" severity="secondary" text @click="resetForm" />
            <Button
              :label="form.timing === 'now' ? 'Gönder' : 'Zamanla'" icon="pi pi-send"
              :loading="sending" @click="askToSend"
            />
          </div>
        </div>
      </section>

      <aside class="push-preview">
        <p class="preview-label">Önizleme</p>
        <div class="push-phone">
          <div class="push-bubble">
            <img class="push-app-icon" src="/icon.svg" alt="" />
            <div class="push-bubble-copy">
              <div class="push-bubble-top">
                <strong>afiet</strong>
                <span>şimdi</span>
              </div>
              <strong class="push-bubble-title">{{ form.title.trim() || 'Başlık' }}</strong>
              <p class="push-bubble-body">{{ form.body.trim() || 'Bildirim metni burada görünür.' }}</p>
            </div>
          </div>
          <p class="push-route-hint">
            <i class="pi pi-arrow-right" />
            Dokununca <strong>{{ targetLabel }}</strong> ekranı açılır
          </p>
        </div>
      </aside>
    </div>
  </div>
</template>
