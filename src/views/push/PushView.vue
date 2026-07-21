<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import PageHeader from '../../components/PageHeader.vue'
import AdminPlaceholder from '../../components/AdminPlaceholder.vue'
import { adminApi } from '../../services/admin'
import {
  PUSH_BODY_MAX, PUSH_TITLE_MAX, pushStatusLabels, pushTargetGroups, pushTargetLabel,
  type PushAudience, type PushBroadcast, type PushTarget,
} from '../../services/push'

const toast = useToast()
const confirm = useConfirm()

const audienceOptions = [{ value: 'all', label: 'Herkes' }, { value: 'user', label: 'Tek kullanıcı' }]
const timingOptions = [{ value: 'now', label: 'Şimdi' }, { value: 'later', label: 'Zamanla' }]

const form = reactive({
  title: '',
  body: '',
  target: 'bugun' as PushTarget,
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

const rows = ref<PushBroadcast[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const listLoading = ref(false)
const listLive = ref(true)

const titleLeft = computed(() => PUSH_TITLE_MAX - form.title.length)
const bodyLeft = computed(() => PUSH_BODY_MAX - form.body.length)
const targetLabel = computed(() => pushTargetLabel(form.target))

const audience = computed<PushAudience>(() =>
  form.audience === 'user' ? { kind: 'user', identifier: form.identifier.trim() } : { kind: 'all' })

const effectiveDate = computed(() => form.timing === 'later' ? form.scheduledAt : new Date())

/** Sessiz saatler kullanıcının yerel saatine göre işler; bu yalnızca senin saatine göre bir uyarı. */
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
const formatDate = (value: string) => dateFormat.format(new Date(value))
const audienceLabel = (value: PushAudience) => value.kind === 'all' ? 'Herkes' : value.identifier

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

async function load() {
  listLoading.value = true
  try {
    const result = await adminApi.pushBroadcasts({ page: page.value, pageSize: pageSize.value })
    rows.value = result.items
    total.value = result.total
    listLive.value = true
  } catch {
    rows.value = []
    total.value = 0
    listLive.value = false
  } finally { listLoading.value = false }
}

function onPage(event: DataTablePageEvent) { page.value = event.page + 1; pageSize.value = event.rows; load() }

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
    ? (recipients.value === null ? 'tüm kayıtlı cihazlara' : `${recipients.value.toLocaleString('tr-TR')} cihaza`)
    : `${form.identifier.trim()} kullanıcısına`
  const when = form.timing === 'now' ? 'hemen' : dateFormat.format(form.scheduledAt!)
  const quiet = hitsQuietHours.value ? ' Sessiz saatlere denk gelenler ertesi sabah 09:00’da iletilir.' : ''
  confirm.require({
    header: 'Bildirimi gönder',
    message: `“${form.title.trim()}” bildirimi ${who} ${when} gönderilecek ve ${targetLabel.value} ekranına yönlendirecek.${quiet} Onaylıyor musun?`,
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
    await load()
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Bildirim gönderilemedi', detail: err instanceof Error ? err.message : '', life: 4500 })
  } finally { sending.value = false }
}

function cancelBroadcast(item: PushBroadcast) {
  confirm.require({
    header: 'Gönderimi iptal et',
    message: `“${item.title}” bildirimi iptal edilsin mi? Henüz iletilmemiş cihazlara gönderilmez.`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Vazgeç',
    acceptLabel: 'İptal et',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await adminApi.cancelPushBroadcast(item.id)
        toast.add({ severity: 'success', summary: 'Gönderim iptal edildi', life: 2500 })
        await load()
      } catch (err) {
        toast.add({ severity: 'error', summary: 'İptal edilemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
      }
    },
  })
}

onMounted(() => { load(); loadRecipients() })
</script>

<template>
  <div class="page-wrap">
    <PageHeader
      eyebrow="İLETİŞİM"
      title="Bildirimler"
      description="Uygulamaya bildirim gönder; kime gideceğini, ne zaman iletileceğini ve hangi ekrana yönlendireceğini seç."
    />

    <div class="push-layout">
      <section class="panel-card push-compose">
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
              <small>Kapalıyken 22:00–09:00 arasına denk gelen bildirimler ertesi sabah 09:00’da iletilir.</small>
            </div>
            <ToggleSwitch v-model="form.ignoreQuietHours" />
          </label>

          <p v-if="hitsQuietHours" class="push-note span-2">
            <i class="pi pi-moon" />
            Seçtiğin zaman sessiz saatlere denk geliyor. Bildirim, kullanıcının yerel saatiyle ertesi sabah 09:00’da iletilecek.
          </p>
        </div>

        <div class="section-footer">
          <span class="section-status">
            <template v-if="form.audience === 'user'">Tek kullanıcıya gidecek.</template>
            <template v-else-if="recipientsLoading">Alıcı sayısı hesaplanıyor…</template>
            <template v-else-if="recipients !== null">{{ recipients.toLocaleString('tr-TR') }} cihaza gidecek.</template>
            <template v-else>Alıcı sayısı bildirim altyapısı bağlanınca görünecek.</template>
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

    <section class="table-card">
      <div class="table-toolbar">
        <strong class="block-caption">Gönderim geçmişi</strong>
        <span v-if="listLive" class="result-count">{{ total.toLocaleString('tr-TR') }} kayıt</span>
      </div>
      <AdminPlaceholder
        v-if="!listLive"
        icon="pi pi-bell"
        title="Gönderim geçmişi henüz yok"
        description="Bildirim altyapısı bu ortama bağlandığında gönderilen ve zamanlanan bildirimler burada listelenir."
        retryable
        :loading="listLoading"
        @retry="load"
      />
      <DataTable
        v-else :value="rows" :loading="listLoading" lazy paginator scrollable
        :rows="pageSize" :total-records="total" :first="(page - 1) * pageSize"
        :rows-per-page-options="[10, 20, 50]" data-key="id" striped-rows @page="onPage"
      >
        <Column header="Bildirim" style="min-width: 18rem">
          <template #body="{ data }">
            <div><strong>{{ data.title }}</strong><small class="push-row-body">{{ data.body }}</small></div>
          </template>
        </Column>
        <Column header="Hedef">
          <template #body="{ data }"><Tag :value="pushTargetLabel(data.target)" severity="secondary" /></template>
        </Column>
        <Column header="Kitle">
          <template #body="{ data }">{{ audienceLabel(data.audience) }}</template>
        </Column>
        <Column header="Zaman" style="min-width: 11rem">
          <template #body="{ data }">{{ formatDate(data.scheduledAt ?? data.createdAt) }}</template>
        </Column>
        <Column header="Durum">
          <template #body="{ data }">
            <Tag :value="pushStatusLabels[data.status as keyof typeof pushStatusLabels].label"
                 :severity="pushStatusLabels[data.status as keyof typeof pushStatusLabels].severity" />
          </template>
        </Column>
        <Column header="Ulaşan">
          <template #body="{ data }">
            <strong>{{ data.deliveredCount.toLocaleString('tr-TR') }}</strong>
            <small class="unit"> / {{ data.recipientCount.toLocaleString('tr-TR') }}</small>
          </template>
        </Column>
        <Column header="" frozen align-frozen="right" style="width: 5rem">
          <template #body="{ data }">
            <Button
              v-if="data.status === 'scheduled' || data.status === 'sending'"
              icon="pi pi-times" text rounded severity="danger" aria-label="İptal et"
              @click="cancelBroadcast(data)"
            />
          </template>
        </Column>
      </DataTable>
    </section>
  </div>
</template>
