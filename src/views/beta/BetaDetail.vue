<script setup lang="ts">
import { computed } from 'vue'
import Drawer from 'primevue/drawer'
import Tag from 'primevue/tag'
import { label, type BetaApplication } from '../../services/beta'

const props = defineProps<{ application: BetaApplication | null }>()
const visible = defineModel<boolean>('visible', { required: true })

const dateTime = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('tr-TR', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
      }).format(new Date(value))
    : '—'

/** Uygulama listeleri üç ayrı soru; "hiçbiri" cevabı listede yer kaplamasın
    diye ayıklanır ama bölümün kendisi durur, boş olduğu görünsün. */
const appBlocks = computed(() => {
  const row = props.application
  if (!row) return []
  return [
    { title: 'Beslenme / kalori', codes: row.appsNutrition },
    { title: 'Spor / adım', codes: row.appsActivity },
    { title: 'Vücut / cihaz', codes: row.appsBody },
  ].map((block) => ({ ...block, codes: block.codes.filter((code) => code && code !== 'hicbiri') }))
})
</script>

<template>
  <Drawer v-model:visible="visible" position="right" class="food-drawer" :style="{ width: '30rem' }">
    <template #header>
      <div v-if="application" class="drawer-head">
        <span class="email-avatar">{{ application.email[0].toLocaleUpperCase('tr') }}</span>
        <div>
          <strong>{{ application.email }}</strong>
          <small>#{{ application.id }} · {{ dateTime(application.createdAt) }}</small>
        </div>
      </div>
    </template>

    <div v-if="application" class="drawer-body">
      <section class="drawer-section">
        <h4>Platform ve iletişim</h4>
        <dl class="drawer-grid">
          <div>
            <dt>Telefon</dt>
            <dd>{{ label.platform(application.platform || 'unknown') }}</dd>
          </div>
          <div>
            <dt>İletişim tercihi</dt>
            <dd>{{ application.contactChannel ? label.contact(application.contactChannel) : '—' }}</dd>
          </div>
          <div>
            <dt>Nereden duydu</dt>
            <dd>{{ application.heardFrom ? label.heard(application.heardFrom) : '—' }}</dd>
          </div>
          <div>
            <dt>İzin</dt>
            <dd>{{ application.consent ? `verdi · ${dateTime(application.consentAt)}` : 'vermedi' }}</dd>
          </div>
        </dl>
      </section>

      <section class="drawer-section">
        <h4>Ne istiyor</h4>
        <div v-if="application.goals.length" class="drawer-tags">
          <Tag v-for="goal in application.goals" :key="goal" :value="label.goal(goal)" severity="success" />
        </div>
        <p v-else class="drawer-none">Hedef seçmemiş.</p>
      </section>

      <section class="drawer-section">
        <h4>Kalori uygulaması geçmişi</h4>
        <p class="drawer-desc">
          {{ application.countingFeeling ? label.counting(application.countingFeeling) : 'Cevaplamamış.' }}
        </p>
      </section>

      <section class="drawer-section">
        <h4>Kullandığı uygulamalar</h4>
        <div v-for="block in appBlocks" :key="block.title" class="app-block">
          <span class="app-block-title">{{ block.title }}</span>
          <div v-if="block.codes.length" class="drawer-tags">
            <Tag v-for="code in block.codes" :key="code" :value="label.app(code)" severity="secondary" />
          </div>
          <span v-else class="drawer-none">hiçbiri</span>
        </div>
        <p v-if="application.appsOther" class="drawer-desc">
          <strong>Serbest yazdığı:</strong> {{ application.appsOther }}
        </p>
      </section>

      <section class="drawer-section">
        <h4>Kayıt</h4>
        <dl class="drawer-grid">
          <div><dt>Başvuru</dt><dd>{{ dateTime(application.createdAt) }}</dd></div>
          <div><dt>Son güncelleme</dt><dd>{{ dateTime(application.updatedAt) }}</dd></div>
        </dl>
      </section>
    </div>
  </Drawer>
</template>
