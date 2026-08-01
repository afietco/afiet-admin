<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { ACTIVITY_LABELS, SEX_LABELS, type UserProfile, type UserProfilePatch } from '../../services/users'

const props = defineProps<{ visible: boolean; profile: UserProfile; saving: boolean }>()
const emit = defineEmits<{ 'update:visible': [boolean]; save: [UserProfilePatch] }>()

const form = reactive({
  displayName: '', emoji: '', email: '',
  sex: null as string | null, birthDate: '', heightCm: null as number | null,
  activityLevel: null as string | null,
})
const submitted = ref(false)

const sexOptions = [
  { value: null, label: 'Belirtilmemiş' },
  ...Object.entries(SEX_LABELS).map(([value, label]) => ({ value, label })),
]
const activityOptions = [
  { value: null, label: 'Belirtilmemiş' },
  ...Object.entries(ACTIVITY_LABELS).map(([value, label]) => ({ value, label })),
]

// Kullanıcı adı sosyal katmanın kimliği: benzersizliği sunucu kontrol eder,
// biçimi burada. Boş bırakmak "kullanıcı adı yok" demektir, geçerlidir.
const emailInvalid = computed(() => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email))

watch(
  () => [props.visible, props.profile] as const,
  ([visible]) => {
    if (!visible) return
    submitted.value = false
    Object.assign(form, {
      displayName: props.profile.displayName ?? '',
      emoji: props.profile.emoji ?? '',
      email: props.profile.email,
      sex: props.profile.sex,
      birthDate: props.profile.birthDate ?? '',
      heightCm: props.profile.heightCm,
      activityLevel: props.profile.activityLevel,
    })
  },
  { immediate: true },
)

/**
 * Boş dize "temizle" demektir, null "dokunma".
 *
 * Sunucu yaması alanı YOKSA dokunmaz, BOŞ DİZE ise sütunu boşaltır (bkz.
 * handleAdminUpdateUserProfile). Bu form her alanı birlikte gönderdiği için
 * hepsi dize olarak gider; boy sayısal olduğundan temizlenemez, yalnız
 * değiştirilebilir — verilmediğinde alan hiç gönderilmez.
 */
function save() {
  submitted.value = true
  if (emailInvalid.value) return
  const patch: UserProfilePatch = {
    displayName: form.displayName.trim(),
    emoji: form.emoji.trim(),
    email: form.email.trim(),
    sex: form.sex ?? '',
    birthDate: form.birthDate.trim(),
    activityLevel: form.activityLevel ?? '',
  }
  if (form.heightCm != null) patch.heightCm = form.heightCm
  emit('save', patch)
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    header="Profili düzenle"
    :style="{ width: '42rem' }"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="form-grid">
      <div class="form-field span-2">
        <label for="edit-name">Görünen ad</label>
        <InputText id="edit-name" v-model="form.displayName" fluid :maxlength="40" />
        <small>Uygulamada ve grup ekranlarında bu ad görünür.</small>
      </div>
      <div class="form-field">
        <label for="edit-emoji">Emoji</label>
        <InputText id="edit-emoji" v-model="form.emoji" fluid placeholder="🥗" />
      </div>

      <div class="form-field span-4">
        <label for="edit-email">E-posta</label>
        <InputText id="edit-email" v-model="form.email" fluid :invalid="submitted && emailInvalid" />
        <small class="field-hint">
          Burada değişen adres yalnız uygulama profilidir; giriş sağlayıcısındaki (Stack) adresi değiştirmez.
          Kullanıcı adını boş bırakmak adı serbest bırakır.
        </small>
      </div>

      <div class="form-field">
        <label>Cinsiyet</label>
        <Select v-model="form.sex" :options="sexOptions" option-label="label" option-value="value" fluid />
      </div>
      <div class="form-field">
        <label for="edit-birth">Doğum tarihi</label>
        <InputText id="edit-birth" v-model="form.birthDate" fluid placeholder="1994-05-12" />
      </div>
      <div class="form-field">
        <label for="edit-height">Boy (cm)</label>
        <InputNumber id="edit-height" v-model="form.heightCm" :min="90" :max="230" fluid />
      </div>
      <div class="form-field">
        <label>Hareket düzeyi</label>
        <Select v-model="form.activityLevel" :options="activityOptions" option-label="label" option-value="value" fluid />
      </div>
    </div>

    <template #footer>
      <Button label="Vazgeç" severity="secondary" text @click="emit('update:visible', false)" />
      <Button label="Kaydet" icon="pi pi-check" :loading="saving" @click="save" />
    </template>
  </Dialog>
</template>
