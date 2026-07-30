<script setup lang="ts">
import { computed } from 'vue'
import InputMask from 'primevue/inputmask'
import { isValidPushTime } from '../../services/push'

// Saat girdisi: HH:MM metni, Date çevrimi yok. DatePicker'ın timeOnly + 24
// saat kipinde elle yazmayı sessizce yok saydığı görüldüğü için maskeye
// geçildi (bkz. services/push.ts > PUSH_TIME_PATTERN).
const model = defineModel<string | null>({ required: true })
const props = defineProps<{ id: string; showError?: boolean }>()

const invalid = computed(() => props.showError && !isValidPushTime(model.value))
</script>

<template>
  <InputMask
    :id="props.id" v-model="model" mask="99:99" placeholder="19:30"
    fluid :invalid="invalid" :auto-clear="false"
  />
</template>
