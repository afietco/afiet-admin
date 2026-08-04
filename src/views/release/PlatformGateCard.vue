<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import {
  emptyPlatformGate,
  isVersionShaped,
  PLATFORM_LABELS,
  VERDICT_COPY,
  verdictFor,
  versionInputValue,
  type AppVersionPlatform,
  type PlatformVersionGate,
} from '../../services/appVersion'

/**
 * Tek mağazanın eşikleri.
 *
 * Kartın asıl işi iki sayı toplamak değil, o iki sayının ne anlama geldiğini
 * yazmak: alanların altındaki şerit, seçilen sürümü çalıştıran birinin ne
 * göreceğini cümleyle söyler. Zorunlu güncelleme insanları kendi verilerinden
 * kilitleyen bir kol; panelde soyut kalmamalı.
 */
const props = defineProps<{
  platform: AppVersionPlatform
  value: PlatformVersionGate
  saving: boolean
  dbConnected: boolean
}>()

const emit = defineEmits<{ save: [PlatformVersionGate] }>()

const form = ref({ latestVersion: '', minimumVersion: '', storeUrl: '', message: '' })

function fill(source: PlatformVersionGate) {
  form.value = {
    latestVersion: source.latestVersion ?? '',
    minimumVersion: source.minimumVersion ?? '',
    storeUrl: source.storeUrl ?? '',
    message: source.message ?? '',
  }
}

watch(() => props.value, fill, { immediate: true, deep: true })

const draft = computed<PlatformVersionGate>(() => ({
  latestVersion: versionInputValue(form.value.latestVersion),
  minimumVersion: versionInputValue(form.value.minimumVersion),
  storeUrl: form.value.storeUrl.trim() || null,
  message: form.value.message.trim() || null,
}))

const dirty = computed(
  () => JSON.stringify(draft.value) !== JSON.stringify(props.value),
)

const versionsWellFormed = computed(
  () => isVersionShaped(form.value.latestVersion) && isVersionShaped(form.value.minimumVersion),
)

/** Sunucudaki kuralın aynası: minimum, en yeniden büyük olamaz. */
const minimumTooHigh = computed(() => {
  const { minimumVersion, latestVersion } = draft.value
  if (!minimumVersion || !latestVersion) return false
  return verdictFor({ ...emptyPlatformGate(), minimumVersion }, latestVersion) === 'required'
})

const canSave = computed(
  () => props.dbConnected && dirty.value && versionsWellFormed.value && !minimumTooHigh.value,
)

/** Kapının kimi nasıl etkilediğini gösteren örnek sürümler. */
const samples = computed(() => {
  const rows: string[] = []
  const { minimumVersion, latestVersion } = draft.value
  if (minimumVersion) rows.push(previousOf(minimumVersion))
  if (minimumVersion) rows.push(minimumVersion)
  if (latestVersion && latestVersion !== minimumVersion) rows.push(latestVersion)
  return [...new Set(rows)].filter(Boolean)
})

/** Eşiğin bir altındaki sürüm: kapının kime çarptığını somutlaştırır. */
function previousOf(version: string): string {
  const parts = version.split('.').map(Number)
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if ((parts[i] ?? 0) > 0) {
      parts[i] = (parts[i] ?? 0) - 1
      return parts.join('.')
    }
    parts[i] = 0
  }
  return version
}
</script>

<template>
  <section class="gate-card">
    <header>
      <div>
        <p class="eyebrow">{{ PLATFORM_LABELS[props.platform] }}</p>
        <h2>{{ props.platform === 'ios' ? 'iPhone' : 'Android' }}</h2>
      </div>
      <span v-if="dirty" class="dirty-flag"><i class="pi pi-circle-fill" /> Kaydedilmemiş</span>
    </header>

    <div class="fields">
      <label>
        <span>Mağazadaki güncel sürüm</span>
        <InputText v-model="form.latestVersion" placeholder="örn. 0.11.0" :invalid="!isVersionShaped(form.latestVersion)" />
        <small>Bunun altındaki sürümler atlanabilir bir kart görür. Boş bırak, hiçbir şey gösterilmesin.</small>
      </label>

      <label>
        <span>En düşük çalışabilir sürüm</span>
        <InputText v-model="form.minimumVersion" placeholder="boş = kimse kilitlenmez" :invalid="!isVersionShaped(form.minimumVersion) || minimumTooHigh" />
        <small>Bunun altındaki sürümler uygulamayı hiç açamaz. Yalnız bir sürüm gerçekten çalışamaz hâle geldiyse doldur.</small>
      </label>

      <label>
        <span>Mağaza adresi</span>
        <InputText v-model="form.storeUrl" placeholder="https://…" />
        <small>Boşsa uygulama bildiği adrese düşer (Android'de Play sayfası, iOS'ta afiet.co).</small>
      </label>

      <label>
        <span>Zorunlu güncelleme açıklaması</span>
        <InputText v-model="form.message" placeholder="boş = varsayılan metin" maxlength="200" />
        <small>Duvarda görünen tek satır. Marka dili geçerli: suçlayan değil, davet eden.</small>
      </label>
    </div>

    <Message v-if="!versionsWellFormed" severity="error" :closable="false">
      Sürüm yalnız noktalı sayı olabilir (0.11.0). Ön sürüm etiketi kabul edilmiyor.
    </Message>
    <Message v-else-if="minimumTooHigh" severity="error" :closable="false">
      En düşük sürüm, mağazadaki güncel sürümden büyük olamaz: herkes mağazada
      bulunmayan bir sürüme yönlendirilir ve kimse kurtulamaz.
    </Message>

    <div v-if="samples.length" class="effect">
      <p class="effect-title">Bu ayarla kim ne görür?</p>
      <ul>
        <li v-for="sample in samples" :key="sample">
          <code>v{{ sample }}</code>
          <span :class="['verdict', VERDICT_COPY[verdictFor(draft, sample)].tone]">
            {{ VERDICT_COPY[verdictFor(draft, sample)].label }}
          </span>
          <small>{{ VERDICT_COPY[verdictFor(draft, sample)].detail }}</small>
        </li>
      </ul>
    </div>

    <footer>
      <Button label="Geri al" icon="pi pi-history" severity="secondary" outlined :disabled="!dirty" @click="fill(props.value)" />
      <Button label="Kaydet" icon="pi pi-check" :loading="props.saving" :disabled="!canSave" @click="emit('save', draft)" />
    </footer>
  </section>
</template>

<style scoped>
.gate-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem 1.35rem 1.1rem;
  border: 1px solid var(--p-surface-200);
  border-radius: 1rem;
  background: var(--p-surface-0);
}

.gate-card > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.gate-card h2 {
  margin: 0.15rem 0 0;
  font-size: 1.15rem;
}

.eyebrow {
  margin: 0;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--p-text-muted-color);
}

.dirty-flag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: #b45309;
}

.dirty-flag i {
  font-size: 0.5rem;
}

.fields {
  display: grid;
  gap: 0.9rem;
}

.fields label {
  display: grid;
  gap: 0.35rem;
}

.fields label > span {
  font-size: 0.85rem;
  font-weight: 600;
}

.fields small {
  color: var(--p-text-muted-color);
  line-height: 1.45;
}

.effect {
  padding: 0.85rem 1rem;
  border-radius: 0.75rem;
  background: var(--p-surface-50);
}

.effect-title {
  margin: 0 0 0.6rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--p-text-muted-color);
}

.effect ul {
  display: grid;
  gap: 0.55rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.effect li {
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: baseline;
  gap: 0.6rem;
}

.effect code {
  font-weight: 700;
}

.effect small {
  color: var(--p-text-muted-color);
}

.verdict {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 700;
  white-space: nowrap;
}

.verdict.muted {
  background: var(--p-surface-200);
  color: var(--p-text-muted-color);
}

.verdict.blue {
  background: #dbeafe;
  color: #1d4ed8;
}

.verdict.coral {
  background: #fee2e2;
  color: #b91c1c;
}

.gate-card > footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}

@media (max-width: 640px) {
  .effect li {
    grid-template-columns: 1fr;
    gap: 0.2rem;
  }
}
</style>
