<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { FTUE_DOOR_OPTIONS, type AppFlags } from '../../services/appVersion'

/**
 * Uygulama anahtarları: bir release beklemeden çevrilen tek tük şalter.
 *
 * Bugün tek anahtar var. Yeni hesapta Bugün panosu bölüm bölüm açılıyor
 * (FTUE, docs/ftue.md); ilk günlerde pano ince görünüp kayıp yaratırsa bütün
 * satırlar buradan tek seferde açılır, bölümler anlatmaya devam eder.
 */
const props = defineProps<{ value: AppFlags; saving: boolean }>()
const emit = defineEmits<{ save: [value: AppFlags] }>()

const ftueDoors = ref<'progressive' | 'open'>(props.value.ftueDoors ?? 'progressive')
watch(
  () => props.value,
  (next) => {
    ftueDoors.value = next.ftueDoors ?? 'progressive'
  },
)
const dirty = computed(() => ftueDoors.value !== (props.value.ftueDoors ?? 'progressive'))
</script>

<template>
  <section class="gate-card">
    <header>
      <div>
        <p class="eyebrow">UYGULAMA ANAHTARLARI</p>
        <h2>Bugün panosu</h2>
      </div>
      <span v-if="dirty" class="dirty-flag"><i class="pi pi-circle-fill" /> Kaydedilmemiş</span>
    </header>

    <div class="fields">
      <label>
        <span>Yeni hesapta pano nasıl açılsın?</span>
        <SelectButton
          v-model="ftueDoors"
          :options="FTUE_DOOR_OPTIONS"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
        <small>
          "Bölüm bölüm": Su, Afi, Vücudum, Menüm, Grubum, Görevlerim satırları kendi bölümleriyle
          gelir (her biri en geç 5-7. afiyet gününde). "Hepsi açık": satırlar ilk günden durur,
          bölümler yine anlatır. Uygulama en geç bir dakika içinde okur.
        </small>
      </label>
    </div>

    <footer>
      <Button
        label="Kaydet"
        icon="pi pi-check"
        :loading="props.saving"
        :disabled="!dirty"
        @click="emit('save', { ftueDoors })"
      />
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

.fields label {
  display: grid;
  gap: 0.5rem;
}

.fields label > span {
  font-size: 0.85rem;
  font-weight: 600;
}

.fields small {
  color: var(--p-text-muted-color);
  line-height: 1.45;
}

footer {
  display: flex;
  justify-content: flex-end;
}
</style>
