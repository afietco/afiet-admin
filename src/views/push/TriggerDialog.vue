<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Textarea from 'primevue/textarea'
import TimeField from './TimeField.vue'
import {
  PUSH_BODY_MAX, PUSH_TITLE_MAX, PUSH_TONES, PUSH_TONE_META,
  isValidPushTime, pushTriggerCondition, pushTriggerMeta,
  pushTriggerTargetGroups, pushWeekdays,
  type PushTarget, type PushTone, type PushTrigger, type PushTriggerPatch,
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
  /** Ton başına gövde; boş bırakılan ton jenerik metne düşer. */
  variants: {} as Record<PushTone, string>,
})

/** Önizlemede hangi tonun gösterileceği. Kaydedilen bir şey değil. */
const previewTone = ref<PushTone | ''>('')

const previewOptions = [
  { label: 'Tonu bilinmeyen', value: '' },
  ...PUSH_TONES.map((tone) => ({ label: PUSH_TONE_META[tone].label, value: tone })),
]

function emptyVariants(): Record<PushTone, string> {
  return { sakin: '', 'doğrudan': '', oyunlu: '' }
}

const submitted = ref(false)

watch(() => props.trigger, (trigger) => {
  if (!trigger) return
  Object.assign(form, {
    title: trigger.title,
    body: trigger.body,
    target: trigger.target,
    time: trigger.time,
    weekday: trigger.weekday ?? 1,
    variants: { ...emptyVariants(), ...trigger.bodyVariants },
  })
  previewTone.value = ''
  submitted.value = false
}, { immediate: true })

const errors = computed(() => ({
  title: !form.title.trim() || form.title.length > PUSH_TITLE_MAX,
  body: form.body.length > PUSH_BODY_MAX,
  time: Boolean(meta.value?.fields.time) && !isValidPushTime(form.time),
  variants: PUSH_TONES.some((tone) => form.variants[tone].length > PUSH_BODY_MAX),
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
    || PUSH_TONES.some((tone) => form.variants[tone].trim() !== (trigger.bodyVariants[tone] ?? ''))
})

/**
 * Önizlemede gösterilen gövde. Ton seçiliyse onun metni, o ton boşsa jenerik
 * metin: gönderim anındaki kuralın aynısı, çünkü "seçtim ama boş bıraktım"
 * durumunda ne gideceğini yazmadan önce görmek gerekiyor.
 */
const previewBody = computed(() => {
  const tone = previewTone.value
  if (tone && form.variants[tone].trim()) return form.variants[tone].trim()
  return form.body.trim()
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
  if (meta.value?.fields.body) {
    // Boş tonlar hiç gönderilmiyor: sunucuda varyant sözlüğü tamamen
    // değiştiriliyor, dolayısıyla göndermemek silmenin yolu.
    const variants: Partial<Record<PushTone, string>> = {}
    for (const tone of PUSH_TONES) {
      const text = form.variants[tone].trim()
      if (text) variants[tone] = text
    }
    patch.bodyVariants = variants
  }
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
          <small class="label-hint">
            {{ PUSH_BODY_MAX - form.body.length }} karakter kaldı ·
            tonu bilinmeyen herkes bu metni alır
          </small>
        </div>

        <div v-if="meta.fields.body" class="form-field span-4 tones">
          <label>Tona göre metin</label>
          <p class="tones__note">
            Afi kişinin tonunu üç kelimeden biriyle söylüyor; hangi cümlenin gideceği
            buradan seçiliyor. <strong>Metni model yazmıyor, aralarından seçiyor:</strong>
            giden her cümleyi burada bir insan yazıyor. Boş bıraktığın ton yukarıdaki
            genel metni alır.
          </p>
          <div v-for="tone in PUSH_TONES" :key="tone" class="tones__row">
            <div class="tones__head">
              <strong>{{ PUSH_TONE_META[tone].label }}</strong>
              <small>{{ PUSH_TONE_META[tone].hint }}</small>
            </div>
            <Textarea
              v-model="form.variants[tone]" rows="2" fluid auto-resize :maxlength="PUSH_BODY_MAX"
              :placeholder="form.body.trim() || 'Boş bırakılırsa genel metin gider'"
            />
          </div>
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
        <div class="preview-head">
          <p class="preview-label">Önizleme</p>
          <SelectButton
            v-if="meta.fields.body"
            v-model="previewTone" :options="previewOptions"
            option-label="label" option-value="value" size="small" :allow-empty="false"
          />
        </div>
        <div class="push-bubble">
          <img class="push-app-icon" src="/icon.svg" alt="" />
          <div class="push-bubble-copy">
            <div class="push-bubble-top">
              <strong>afiet</strong>
              <span>şimdi</span>
            </div>
            <strong class="push-bubble-title">{{ form.title.trim() || 'Başlık' }}</strong>
            <p v-if="previewBody" class="push-bubble-body">{{ previewBody }}</p>
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

<style scoped>
/* Ton bloğu görsel olarak tek bir alan gibi durmalı: üçü birden aynı
   sorunun üç cevabı, ayrı ayrı alanlar değil. */
.tones__note {
  margin: 0 0 .9rem;
  color: var(--p-text-muted-color);
  font-size: .85rem;
  line-height: 1.6;
}
.tones__row { display: flex; flex-direction: column; gap: .35rem; margin-bottom: .8rem; }
.tones__row:last-child { margin-bottom: 0; }
.tones__head { display: flex; flex-wrap: wrap; align-items: baseline; gap: .5rem; }
.tones__head strong { font-size: .9rem; }
.tones__head small { color: var(--p-text-muted-color); font-size: .8rem; }

.preview-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; }
</style>
