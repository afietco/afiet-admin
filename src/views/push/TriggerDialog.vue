<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import TimeField from './TimeField.vue'
import {
  PUSH_BODY_MAX, PUSH_TITLE_MAX, isValidPushTime, pushTriggerCondition, pushTriggerMeta,
  pushTriggerTargetGroups, pushWeekdays,
  type PushTarget, type PushTrigger, type PushTriggerPatch,
} from '../../services/push'

const props = defineProps<{ trigger: PushTrigger | null; saving: boolean }>()
const emit = defineEmits<{ save: [PushTriggerPatch]; close: [] }>()

const visible = computed({
  get: () => props.trigger !== null,
  set: (value: boolean) => { if (!value) emit('close') },
})

const meta = computed(() => props.trigger ? pushTriggerMeta[props.trigger.kind] : null)

const form = reactive({
  title: '',
  body: '',
  target: 'bugun' as PushTarget,
  time: null as string | null,
  weekday: 1 as number,
})

const submitted = ref(false)

watch(() => props.trigger, (trigger) => {
  if (!trigger) return
  Object.assign(form, {
    title: trigger.title,
    body: trigger.body,
    target: trigger.target,
    time: trigger.time,
    weekday: trigger.weekday ?? 1,
  })
  submitted.value = false
}, { immediate: true })

const errors = computed(() => ({
  title: !form.title.trim() || form.title.length > PUSH_TITLE_MAX,
  body: form.body.length > PUSH_BODY_MAX,
  time: Boolean(meta.value?.fields.time) && !isValidPushTime(form.time),
}))

/** Değişen alan yoksa kaydet düğmesi boşa çalışmasın. */
const dirty = computed(() => {
  const trigger = props.trigger
  if (!trigger) return false
  return form.title !== trigger.title
    || form.body !== trigger.body
    || form.target !== trigger.target
    || (meta.value?.fields.time ? form.time !== trigger.time : false)
    || (meta.value?.fields.weekday ? form.weekday !== trigger.weekday : false)
})

/** Kaydedilmemiş haliyle koşul cümlesi: değişikliğin etkisi anında görünür. */
const conditionPreview = computed(() => {
  const trigger = props.trigger
  if (!trigger) return ''
  return pushTriggerCondition({
    ...trigger,
    time: isValidPushTime(form.time) ? form.time : trigger.time,
    weekday: meta.value?.fields.weekday ? form.weekday : trigger.weekday,
  })
})

function submit() {
  submitted.value = true
  if (Object.values(errors.value).some(Boolean)) return
  const patch: PushTriggerPatch = { title: form.title.trim(), body: form.body.trim(), target: form.target }
  if (meta.value?.fields.time) patch.time = form.time
  if (meta.value?.fields.weekday) patch.weekday = form.weekday
  emit('save', patch)
}
</script>

<template>
  <Dialog
    v-model:visible="visible" modal dismissable-mask class="food-dialog trigger-dialog"
    :header="meta ? `${meta.label} ayarları` : ''" :style="{ width: '46rem' }"
    :breakpoints="{ '960px': '92vw' }"
  >
    <div v-if="trigger && meta" class="trigger-dialog-body">
      <p class="push-note">
        <i class="pi pi-bolt" />
        <span>{{ conditionPreview }}</span>
      </p>

      <div class="form-grid">
        <div class="form-field span-4">
          <label for="trigger-title">Başlık *</label>
          <InputText
            id="trigger-title" v-model="form.title" fluid :maxlength="PUSH_TITLE_MAX"
            :invalid="submitted && errors.title"
          />
          <small class="label-hint">{{ PUSH_TITLE_MAX - form.title.length }} karakter kaldı</small>
          <small v-if="submitted && errors.title" class="field-error">Başlık gerekli.</small>
        </div>

        <div v-if="meta.fields.body" class="form-field span-4">
          <label for="trigger-body">Metin</label>
          <Textarea
            id="trigger-body" v-model="form.body" rows="2" fluid auto-resize :maxlength="PUSH_BODY_MAX"
            placeholder="Boş bırakılırsa bildirim yalnız başlıkla gider"
          />
          <small class="label-hint">{{ PUSH_BODY_MAX - form.body.length }} karakter kaldı</small>
        </div>

        <div v-if="meta.fields.weekday" class="form-field span-2">
          <label>Gönderim günü</label>
          <Select v-model="form.weekday" :options="pushWeekdays" option-label="label" option-value="value" fluid />
        </div>

        <div v-if="meta.fields.time" class="form-field span-2">
          <label for="trigger-time">
            {{ trigger.kind === 'meal_reminder' ? 'Varsayılan saat *' : 'Gönderim saati *' }}
          </label>
          <TimeField id="trigger-time" v-model="form.time" :show-error="submitted" />
          <small v-if="submitted && errors.time" class="field-error">Geçerli bir saat gir (00:00 to 23:59).</small>
        </div>

        <div v-if="meta.fields.target" class="form-field span-4">
          <label>Hedef ekran</label>
          <Select
            v-model="form.target" :options="pushTriggerTargetGroups" option-label="label" option-value="value"
            option-group-label="label" option-group-children="items" fluid
          />
          <small class="label-hint">Bildirime dokunan kullanıcı bu ekrana gider.</small>
        </div>
      </div>

      <div class="trigger-preview">
        <p class="preview-label">Önizleme</p>
        <div class="push-bubble">
          <img class="push-app-icon" src="/icon.svg" alt="" />
          <div class="push-bubble-copy">
            <div class="push-bubble-top">
              <strong>afiet</strong>
              <span>şimdi</span>
            </div>
            <strong class="push-bubble-title">{{ form.title.trim() || 'Başlık' }}</strong>
            <p v-if="form.body.trim()" class="push-bubble-body">{{ form.body.trim() }}</p>
          </div>
        </div>
      </div>

      <p v-if="meta.readOnlyNote" class="trigger-lock">
        <i class="pi pi-lock" />
        <span>{{ meta.readOnlyNote }}</span>
      </p>
    </div>

    <template #footer>
      <Button label="Vazgeç" severity="secondary" text @click="emit('close')" />
      <Button label="Kaydet" icon="pi pi-check" :loading="saving" :disabled="!dirty" @click="submit" />
    </template>
  </Dialog>
</template>
