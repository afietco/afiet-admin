<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import SectionFooter from './SectionFooter.vue'
import { useSettingsSection } from './shared'
import type { AdminSeoPayload } from '../../services/webApi'

const props = defineProps<{ payload: AdminSeoPayload }>()
const emit = defineEmits<{ saved: [AdminSeoPayload] }>()
const onSaved = (p: AdminSeoPayload) => emit('saved', p)

const schema = useSettingsSection('schema', (p) => p.effective.settings.schema, () => props.payload, onSaved)
const faq = useSettingsSection('faq', (p) => p.effective.settings.faq, () => props.payload, onSaved)

function addSameAs() { schema.form.organization.sameAs.push('') }
function removeSameAs(i: number) { schema.form.organization.sameAs.splice(i, 1) }

function addFaq() { faq.form.items.push({ q: '', a: '' }) }
function removeFaq(i: number) { faq.form.items.splice(i, 1) }
function moveFaq(i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= faq.form.items.length) return
  const items = faq.form.items
  ;[items[i], items[j]] = [items[j]!, items[i]!]
}
</script>

<template>
  <div class="tab-body">
    <!-- Yapısal veri (schema) -->
    <section class="sub-card">
      <div class="sub-card-head">
        <div><h3>Yapısal veri (Schema.org)</h3><p>Arama motorlarına ve AI'a afiet'i JSON-LD ile tanıtır.</p></div>
      </div>

      <label class="switch-row">
        <div><strong>Organization</strong><small>Marka kimliği: ad, site, logo, iletişim.</small></div>
        <ToggleSwitch v-model="schema.form.organization.enabled" />
      </label>
      <div class="form-grid nested">
        <div class="form-field"><label>Ad</label><InputText v-model="schema.form.organization.name" fluid /></div>
        <div class="form-field"><label>URL</label><InputText v-model="schema.form.organization.url" fluid /></div>
        <div class="form-field"><label>Logo URL</label><InputText v-model="schema.form.organization.logo" fluid /></div>
        <div class="form-field"><label>İletişim e-postası</label><InputText v-model="schema.form.organization.contactEmail" fluid /></div>
        <div class="form-field span-2">
          <label>sameAs (sosyal/profil bağlantıları)</label>
          <div class="line-list">
            <div v-for="(_, i) in schema.form.organization.sameAs" :key="i" class="line-row">
              <InputText v-model="schema.form.organization.sameAs[i]" fluid placeholder="https://..." />
              <Button icon="pi pi-trash" text rounded severity="danger" aria-label="Sil" @click="removeSameAs(i)" />
            </div>
            <Button label="Bağlantı ekle" icon="pi pi-plus" text size="small" @click="addSameAs" />
          </div>
        </div>
      </div>

      <label class="switch-row">
        <div><strong>WebSite</strong><small>Sitenin kendisini tanımlar (arama kutusu vb. için temel).</small></div>
        <ToggleSwitch v-model="schema.form.website.enabled" />
      </label>

      <label class="switch-row">
        <div><strong>SoftwareApplication</strong><small>Mobil uygulamayı tanıtır.</small></div>
        <ToggleSwitch v-model="schema.form.mobileApp.enabled" />
      </label>
      <div class="form-grid nested">
        <div class="form-field"><label>Uygulama adı</label><InputText v-model="schema.form.mobileApp.name" fluid /></div>
        <div class="form-field"><label>İşletim sistemi</label><InputText v-model="schema.form.mobileApp.operatingSystem" fluid placeholder="iOS, Android" /></div>
        <div class="form-field"><label>Kategori</label><InputText v-model="schema.form.mobileApp.category" fluid placeholder="HealthApplication" /></div>
        <div class="form-field span-2"><label>Açıklama</label><Textarea v-model="schema.form.mobileApp.description" rows="3" fluid auto-resize /></div>
        <div class="form-field"><label>App Store URL</label><InputText v-model="schema.form.mobileApp.appStoreUrl" fluid placeholder="(boş — basılmaz)" /></div>
        <div class="form-field"><label>Google Play URL</label><InputText v-model="schema.form.mobileApp.playStoreUrl" fluid placeholder="(boş — basılmaz)" /></div>
        <p class="seo-hint span-2"><i class="pi pi-info-circle" /> Mağaza linkleri boşken şemaya yazılmaz — uygulama yayınlanınca doldur.</p>
      </div>

      <SectionFooter :dirty="schema.dirty.value" :saving="schema.saving.value" :has-override="schema.hasOverride.value" :updated-at="schema.updatedAt.value" :db-connected="props.payload.dbConnected" @save="schema.save" @reset="schema.reset" />
    </section>

    <!-- SSS (faq) -->
    <section class="sub-card">
      <div class="sub-card-head">
        <div><h3>Sıkça sorulanlar (SSS)</h3><p>Ana sayfada görünür bölüm + FAQPage şeması olarak birlikte yayımlanır.</p></div>
      </div>

      <label class="switch-row">
        <div><strong>FAQPage şeması (JSON-LD)</strong><small>Arama sonuçlarında açılır soru-cevap olarak çıkabilir.</small></div>
        <ToggleSwitch v-model="faq.form.enabled" />
      </label>
      <label class="switch-row">
        <div><strong>Ana sayfada göster</strong><small>SSS'yi landing'de görünür bir bölüm olarak yayımlar.</small></div>
        <ToggleSwitch v-model="faq.form.showOnLanding" />
      </label>
      <div class="form-grid nested">
        <div class="form-field span-2"><label>Bölüm başlığı</label><InputText v-model="faq.form.title" fluid /></div>
        <div class="form-field span-2"><label>Giriş metni</label><Textarea v-model="faq.form.intro" rows="2" fluid auto-resize /></div>
      </div>

      <div class="faq-list">
        <div v-for="(item, i) in faq.form.items" :key="i" class="faq-item">
          <div class="faq-item-head">
            <span class="faq-index">{{ i + 1 }}</span>
            <div class="faq-item-actions">
              <Button icon="pi pi-arrow-up" text rounded size="small" aria-label="Yukarı" :disabled="i === 0" @click="moveFaq(i, -1)" />
              <Button icon="pi pi-arrow-down" text rounded size="small" aria-label="Aşağı" :disabled="i === faq.form.items.length - 1" @click="moveFaq(i, 1)" />
              <Button icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Sil" @click="removeFaq(i)" />
            </div>
          </div>
          <InputText v-model="item.q" fluid placeholder="Soru" />
          <Textarea v-model="item.a" rows="2" fluid auto-resize placeholder="Cevap" />
        </div>
        <Button label="Soru ekle" icon="pi pi-plus" text size="small" @click="addFaq" />
      </div>

      <SectionFooter :dirty="faq.dirty.value" :saving="faq.saving.value" :has-override="faq.hasOverride.value" :updated-at="faq.updatedAt.value" :db-connected="props.payload.dbConnected" @save="faq.save" @reset="faq.reset" />
    </section>
  </div>
</template>
