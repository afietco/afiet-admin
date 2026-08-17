<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import PageHeader from '../../components/PageHeader.vue'
import AdminPlaceholder from '../../components/AdminPlaceholder.vue'
import PlatformGateCard from './PlatformGateCard.vue'
import AppFlagsCard from './AppFlagsCard.vue'
import {
  appVersionApi,
  emptyPlatformGate,
  type AppFlags,
  type AppVersionGate,
  type AppVersionPlatform,
  type PlatformVersionGate,
} from '../../services/appVersion'

/**
 * Sürüm kapısı: mobil uygulamanın açılışta okuduğu iki eşik, platform başına.
 *
 * Ayar afiet.co'da (Vercel + Neon) yaşıyor, kendi API'mizde değil: bu kolun
 * gerekeceği gün büyük ihtimalle API'nin bozulduğu gündür ve o gün uygulamanın
 * soracağı yerin ayakta olması gerekir.
 */
const toast = useToast()
const gate = ref<AppVersionGate | null>(null)
const loading = ref(false)
const error = ref('')
const saving = ref<AppVersionPlatform | 'flags' | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    gate.value = (await appVersionApi.get()).gate
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Sürüm kapısı okunamadı.'
  } finally {
    loading.value = false
  }
}

async function save(platform: AppVersionPlatform, value: PlatformVersionGate) {
  saving.value = platform
  try {
    gate.value = (await appVersionApi.put(platform, value)).gate
    toast.add({
      severity: 'success',
      summary: 'Kaydedildi',
      detail: 'Uygulamalar en geç bir dakika içinde yeni ayarı okur.',
      life: 4000,
    })
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Kaydedilemedi',
      detail: err instanceof Error ? err.message : 'Bilinmeyen hata',
      life: 6000,
    })
  } finally {
    saving.value = null
  }
}

async function saveFlags(value: AppFlags) {
  saving.value = 'flags'
  try {
    gate.value = (await appVersionApi.putFlags(value)).gate
    toast.add({
      severity: 'success',
      summary: 'Kaydedildi',
      detail: 'Uygulamalar en geç bir dakika içinde yeni ayarı okur.',
      life: 4000,
    })
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Kaydedilemedi',
      detail: err instanceof Error ? err.message : 'Bilinmeyen hata',
      life: 6000,
    })
  } finally {
    saving.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="page-wrap version-gate">
    <PageHeader
      eyebrow="ÜRÜN"
      title="Sürüm kapısı"
      description="Mağazada ne olduğunu uygulamaya buradan söylüyoruz. iOS ve Android ayrı, çünkü iki mağaza aynı anda yayına almıyor."
    />

    <Message severity="warn" :closable="false">
      <strong>En düşük sürüm alanı bir acil durum kolu.</strong> Doldurduğun anda
      o sürümün altındaki herkes uygulamayı açamaz hâle gelir; kayıtlarına bir
      şey olmaz ama güncellemeden hiçbir yere gidemezler. Yalnız bir sürüm
      gerçekten çalışamaz duruma geldiğinde kullan. Mağazadaki güncel sürüm
      alanı zararsızdır: yalnız atlanabilir bir kart gösterir.
    </Message>

    <AdminPlaceholder
      v-if="loading && !gate"
      icon="pi pi-mobile"
      title="Sürüm kapısı yükleniyor"
      description="afiet.co'daki ayar okunuyor."
    />
    <AdminPlaceholder
      v-else-if="error"
      icon="pi pi-exclamation-triangle"
      title="Sürüm kapısı okunamadı"
      :description="error"
      retryable
      :loading="loading"
      @retry="load"
    />

    <div v-else-if="gate" class="cards">
      <PlatformGateCard
        platform="ios"
        :value="gate.ios ?? emptyPlatformGate()"
        :saving="saving === 'ios'"
        :db-connected="true"
        @save="(value) => save('ios', value)"
      />
      <PlatformGateCard
        platform="android"
        :value="gate.android ?? emptyPlatformGate()"
        :saving="saving === 'android'"
        :db-connected="true"
        @save="(value) => save('android', value)"
      />
      <AppFlagsCard
        :value="gate.flags ?? { ftueDoors: null }"
        :saving="saving === 'flags'"
        @save="saveFlags"
      />
    </div>
  </div>
</template>

<style scoped>
.version-gate {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.cards {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  align-items: start;
}
</style>
