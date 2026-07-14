<script setup lang="ts">
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import SectionFooter from './SectionFooter.vue'
import { useSettingsSection } from './shared'
import { config } from '../../config'
import type { AdminSeoPayload } from '../../services/webApi'

const props = defineProps<{ payload: AdminSeoPayload }>()
const emit = defineEmits<{ saved: [AdminSeoPayload] }>()

const { form, dirty, hasOverride, updatedAt, saving, save, reset } = useSettingsSection(
  'llms',
  (p) => p.effective.settings.llms,
  () => props.payload,
  (p) => emit('saved', p),
)
</script>

<template>
  <div class="tab-body">
    <div class="seo-info">
      <i class="pi pi-info-circle" />
      <p>AI asistanlarının siteyi doğru özetlemesi için standart bir dosya. Google kullanmaz; maliyeti sıfır, riski yok — açık tutmak güvenli.</p>
    </div>

    <label class="switch-row big">
      <div><strong>llms.txt yayınla</strong><small>Kapalıysa dosya sunulmaz.</small></div>
      <ToggleSwitch v-model="form.enabled" />
    </label>

    <div class="llms-editor">
      <div class="form-field">
        <label>İçerik (Markdown)</label>
        <Textarea v-model="form.content" rows="20" fluid class="mono" />
      </div>
      <div class="llms-preview">
        <div class="preview-head">
          <p class="preview-label">Önizleme</p>
          <a class="file-link" :href="`${config.webApiUrl}/llms.txt`" target="_blank" rel="noopener">Canlı dosya <i class="pi pi-external-link" /></a>
        </div>
        <pre class="code-preview tall">{{ form.content || '(boş)' }}</pre>
      </div>
    </div>

    <SectionFooter :dirty="dirty" :saving="saving" :has-override="hasOverride" :updated-at="updatedAt" :db-connected="props.payload.dbConnected" @save="save" @reset="reset" />
  </div>
</template>
