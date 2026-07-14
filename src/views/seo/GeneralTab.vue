<script setup lang="ts">
import { computed } from 'vue'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import SerpPreview from './SerpPreview.vue'
import SectionFooter from './SectionFooter.vue'
import { countState, useSettingsSection } from './shared'
import type { AdminSeoPayload } from '../../services/webApi'

const props = defineProps<{ payload: AdminSeoPayload }>()
const emit = defineEmits<{ saved: [AdminSeoPayload] }>()

const { form, dirty, hasOverride, updatedAt, saving, save, reset } = useSettingsSection(
  'general',
  (p) => p.effective.settings.general,
  () => props.payload,
  (p) => emit('saved', p),
)

function absolutize(value: string, base: string): string {
  if (!value) return ''
  if (/^https?:\/\//.test(value)) return value
  return base.replace(/\/$/, '') + (value.startsWith('/') ? value : `/${value}`)
}
const ogImageSrc = computed(() => absolutize(form.defaultOgImage, form.baseUrl))
</script>

<template>
  <div class="tab-body">
    <section class="preview-strip">
      <div class="preview-col">
        <p class="preview-label">Google araması</p>
        <SerpPreview :url="form.baseUrl" :title="form.defaultTitle" :description="form.defaultDescription" />
      </div>
      <div class="preview-col">
        <p class="preview-label">Paylaşım kartı (OG)</p>
        <div class="og-card">
          <div class="og-image">
            <img v-if="ogImageSrc" :src="ogImageSrc" alt="" @error="($event.target as HTMLImageElement).style.visibility = 'hidden'" />
            <span v-else class="og-image-empty"><i class="pi pi-image" /> Görsel yok</span>
          </div>
          <div class="og-meta">
            <span class="og-domain">{{ form.baseUrl.replace(/^https?:\/\//, '') }}</span>
            <strong>{{ form.defaultTitle || '(başlık boş)' }}</strong>
            <small>{{ form.defaultDescription || '(açıklama boş)' }}</small>
          </div>
        </div>
      </div>
    </section>

    <div class="form-grid">
      <div class="form-field"><label>Site adı</label><InputText v-model="form.siteName" fluid /></div>
      <div class="form-field"><label>Temel URL</label><InputText v-model="form.baseUrl" fluid placeholder="https://afiet.co" /></div>
      <div class="form-field span-2">
        <label>Varsayılan başlık <small class="seo-count" :class="countState(form.defaultTitle.length, 50, 60)">{{ form.defaultTitle.length }} karakter · ideal 50–60</small></label>
        <InputText v-model="form.defaultTitle" fluid />
      </div>
      <div class="form-field span-2">
        <label>Varsayılan açıklama <small class="seo-count" :class="countState(form.defaultDescription.length, 140, 160)">{{ form.defaultDescription.length }} karakter · ideal 140–160</small></label>
        <Textarea v-model="form.defaultDescription" rows="3" fluid auto-resize />
      </div>
      <div class="form-field"><label>Varsayılan OG görseli</label><InputText v-model="form.defaultOgImage" fluid placeholder="/og.png" /></div>
      <div class="form-field"><label>OG görsel alt metni</label><InputText v-model="form.ogImageAlt" fluid /></div>
      <div class="form-field"><label>Twitter hesabı</label><InputText v-model="form.twitterSite" fluid placeholder="@afiet" /></div>
      <div class="form-field"><label>Dil (locale)</label><InputText v-model="form.locale" fluid placeholder="tr_TR" /></div>
      <div class="form-field">
        <label>Tema rengi</label>
        <span class="color-field"><input type="color" v-model="form.themeColor" aria-label="Tema rengi" /><InputText v-model="form.themeColor" fluid /></span>
      </div>
      <div class="form-field span-2">
        <label>Site doğrulama kodları</label>
        <div class="verify-grid">
          <span class="verify-cell"><small>Google</small><InputText v-model="form.verification.google" fluid /></span>
          <span class="verify-cell"><small>Bing</small><InputText v-model="form.verification.bing" fluid /></span>
          <span class="verify-cell"><small>Yandex</small><InputText v-model="form.verification.yandex" fluid /></span>
        </div>
      </div>
    </div>

    <SectionFooter :dirty="dirty" :saving="saving" :has-override="hasOverride" :updated-at="updatedAt" :db-connected="props.payload.dbConnected" @save="save" @reset="reset" />
  </div>
</template>
