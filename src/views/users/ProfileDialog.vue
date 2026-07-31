<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import { ACTIVITY_LABELS, SEX_LABELS, type UserProfile, type UserProfilePatch } from '../../services/users'

const props = defineProps<{ visible: boolean; profile: UserProfile; saving: boolean; writable: boolean }>()
const emit = defineEmits<{ 'update:visible': [boolean]; save: [UserProfilePatch] }>()

const form = reactive({
  displayName: '', emoji: '', username: '', email: '',
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
const usernameInvalid = computed(() =>
  form.username.length > 0 && !/^[a-z0-9_]{3,20}$/.test(form.username))
const emailInvalid = computed(() => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email))

watch(
  () => [props.visible, props.profile] as const,
  ([visible]) => {
    if (!visible) return
    submitted.value = false
    Object.assign(form, {
      displayName: props.profile.displayName ?? '',
      emoji: props.profile.emoji ?? '',
      username: props.profile.username ?? '',
      email: props.profile.email,
      sex: props.profile.sex,
      birthDate: props.profile.birthDate ?? '',
      heightCm: props.profile.heightCm,
      activityLevel: props.profile.activityLevel,
    })
  },
  { immediate: true },
)

function save() {
  submitted.value = true
  if (usernameInvalid.value || emailInvalid.value) return
  emit('save', {
    displayName: form.displayName.trim() || null,
    emoji: form.emoji.trim() || null,
    username: form.username.trim() || null,
    email: form.email.trim(),
    sex: form.sex,
    birthDate: form.birthDate || null,
    heightCm: form.heightCm,
    activityLevel: form.activityLevel,
  })
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
    <Message v-if="!writable" severity="warn" :closable="false" class="dialog-note">
      Yazma ucu henüz açık değil. Kaydet düğmesi akışı gösterir, sunucuya bir şey yazmaz.
    </Message>

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
      <div class="form-field">
        <label for="edit-username">Kullanıcı adı</label>
        <InputText id="edit-username" v-model="form.username" fluid :invalid="submitted && usernameInvalid" />
        <small v-if="submitted && usernameInvalid" class="field-error">3-20 karakter; küçük harf, rakam, alt çizgi.</small>
        <small v-else>Arkadaş aramasının kimliği. Boş bırakılabilir.</small>
      </div>

      <div class="form-field span-4">
        <label for="edit-email">E-posta</label>
        <InputText id="edit-email" v-model="form.email" fluid :invalid="submitted && emailInvalid" />
        <small class="field-hint">
          Burada değişen adres yalnız uygulama profilidir; giriş sağlayıcısındaki (Stack) adresi değiştirmez.
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
