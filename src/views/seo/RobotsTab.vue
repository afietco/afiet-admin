<script setup lang="ts">
import { computed } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import Tag from 'primevue/tag'
import SectionFooter from './SectionFooter.vue'
import { useSettingsSection } from './shared'
import { config } from '../../config'
import type { AdminSeoPayload } from '../../services/webApi'

const props = defineProps<{ payload: AdminSeoPayload }>()
const emit = defineEmits<{ saved: [AdminSeoPayload] }>()
const confirm = useConfirm()

const { form, dirty, hasOverride, updatedAt, saving, save, reset } = useSettingsSection(
  'robots',
  (p) => p.effective.settings.robots,
  () => props.payload,
  (p) => emit('saved', p),
)

const purposeTag: Record<string, { label: string; severity: string }> = {
  arama: { label: 'Arama', severity: 'success' },
  kullanici: { label: 'Canlı getirme', severity: 'info' },
  egitim: { label: 'Eğitim', severity: 'secondary' },
}

const baseUrl = computed(() => props.payload.effective.settings.general.baseUrl.replace(/\/$/, ''))

const robotsTxt = computed(() => {
  if (!form.indexable) return 'User-agent: *\nDisallow: /'
  let out = 'User-agent: *\nAllow: /'
  for (const [agent, allow] of Object.entries(form.aiBots)) {
    if (allow === false) out += `\n\nUser-agent: ${agent}\nDisallow: /`
  }
  if (form.extraRules.trim()) out += `\n\n${form.extraRules.trim()}`
  out += `\n\nSitemap: ${baseUrl.value}/sitemap.xml`
  return out
})

function onToggleIndexable(value: boolean) {
  if (value) { form.indexable = true; return }
  confirm.require({
    header: 'Siteyi aramaya kapat',
    message: 'Bu seçenek TÜM siteyi arama motorlarına kapatır: robots.txt "Disallow: /" olur ve her sayfaya "noindex, nofollow" basılır. Emin misin?',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Vazgeç',
    acceptLabel: 'Aramaya kapat',
    acceptClass: 'p-button-danger',
    accept: () => { form.indexable = false },
  })
}
</script>

<template>
  <div class="tab-body">
    <label class="switch-row big" :class="{ danger: !form.indexable }">
      <div>
        <strong>Site arama motorlarına açık</strong>
        <small v-if="form.indexable">Site normal biçimde indekslenir.</small>
        <small v-else>Kapalı — site şu an arama motorlarına tamamen kapalı.</small>
      </div>
      <ToggleSwitch :model-value="form.indexable" @update:model-value="onToggleIndexable" />
    </label>

    <div class="seo-info">
      <i class="pi pi-info-circle" />
      <p>Arama botları seni AI cevaplarında kaynak yapar — <strong>kapatma</strong>. Eğitim botlarını kapatmak arama/AI görünürlüğünü etkilemez, yalnızca model eğitimine veri gitmesini durdurur.</p>
    </div>

    <section class="sub-card">
      <div class="sub-card-head"><div><h3>AI botları</h3><p>Hangi yapay zeka tarayıcısının siteye erişebileceğini seç.</p></div></div>
      <div class="bots-table">
        <div class="bots-row bots-head">
          <span>Bot</span><span>Sahibi</span><span>Amaç</span><span class="bot-note-col">Not</span><span class="bot-allow-col">İzin</span>
        </div>
        <div v-for="bot in props.payload.defaults.aiBots" :key="bot.agent" class="bots-row">
          <span class="bot-agent">{{ bot.agent }}</span>
          <span class="bot-owner">{{ bot.owner }}</span>
          <span><Tag :value="purposeTag[bot.purpose]?.label" :severity="purposeTag[bot.purpose]?.severity" /></span>
          <span class="bot-note bot-note-col">{{ bot.note }}</span>
          <span class="bot-allow-col"><ToggleSwitch v-model="form.aiBots[bot.agent]" /></span>
        </div>
      </div>
    </section>

    <div class="form-field">
      <label>Ek robots.txt kuralları</label>
      <Textarea v-model="form.extraRules" rows="4" fluid class="mono" placeholder="Örn: Crawl-delay: 10" />
    </div>

    <section class="sub-card">
      <div class="sub-card-head">
        <div><h3>robots.txt önizlemesi</h3><p>Yayınlanacak dosyanın form durumundan üretilmiş hali.</p></div>
        <a class="file-link" :href="`${config.webApiUrl}/robots.txt`" target="_blank" rel="noopener">Canlı dosya <i class="pi pi-external-link" /></a>
      </div>
      <pre class="code-preview">{{ robotsTxt }}</pre>
    </section>

    <SectionFooter :dirty="dirty" :saving="saving" :has-override="hasOverride" :updated-at="updatedAt" :db-connected="props.payload.dbConnected" @save="save" @reset="reset" />
  </div>
</template>
