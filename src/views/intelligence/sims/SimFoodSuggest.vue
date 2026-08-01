<script setup lang="ts">
import { ref } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import PhoneFrame from './PhoneFrame.vue'
import TraceBox from './TraceBox.vue'
import { label, measureLabel } from '../../../services/foodLabels'
import { simFoodSuggest, type FoodSuggestion, type SimTrace } from '../../../services/intelligenceSim'

const props = defineProps<{ agentName: string; version: string }>()

/**
 * Menüm doldurma simülasyonu: mobil CustomFoodSheet'teki "Afi doldursun"
 * akışının birebir kopyası. Öneri DÜZENLENEBİLİR taslaktır; uygulamada da
 * öyle, kullanıcı onaylamadan hiçbir şey kaydedilmez.
 */

const name = ref('mercimek çorbası')
const hint = ref('')
const busy = ref(false)
const result = ref<FoodSuggestion | null>(null)
const trace = ref<SimTrace | null>(null)
const error = ref('')

const examples = ['mercimek çorbası', 'menemen', 'lahmacun', 'ev yapımı kısır']

async function run() {
  const trimmed = name.value.trim()
  if (!trimmed || busy.value) return
  busy.value = true
  error.value = ''
  result.value = null
  try {
    const out = await simFoodSuggest(trimmed, props.agentName, props.version)
    result.value = out.suggestion
    trace.value = out.trace
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Simülasyon çalıştırılamadı.'
  } finally {
    busy.value = false
  }
}

function pick(example: string) {
  name.value = example
  void run()
}
</script>

<template>
  <div class="sim-layout">
    <div class="sim-controls">
      <label class="field">
        <span>Besin adı</span>
        <InputText v-model="name" placeholder="Örn. mercimek çorbası" @keyup.enter="run" />
      </label>
      <label class="field">
        <span>Not <small>(kullanıcının yazdığı açıklama)</small></span>
        <InputText v-model="hint" placeholder="Örn. tereyağsız, az tuzlu" @keyup.enter="run" />
        <small class="field-note">
          Ürün ucu bugün yalnız adı gönderiyor; not yerel bir hatırlatma, ajana gitmiyor.
        </small>
      </label>
      <Button label="Afi doldursun" icon="pi pi-sparkles" :loading="busy" @click="run" />
      <div class="examples">
        <span>Hazır örnek:</span>
        <button v-for="ex in examples" :key="ex" type="button" :disabled="busy" @click="pick(ex)">
          {{ ex }}
        </button>
      </div>
    </div>

    <div class="sim-stage">
      <PhoneFrame surface="mobile" title="Besin Ekle" caption="Mobil · CustomFoodSheet">
        <div class="sheet-head">
          <div class="afi-bubble">🍲</div>
          <div>
            <strong>{{ name.trim() || 'Yeni besin' }}</strong>
            <small v-if="busy">Afi bakıyor…</small>
            <small v-else-if="result">Afi doldurdu, istediğini değiştirebilirsin</small>
            <small v-else>Adı yaz, Afi grubu ve makroları önersin</small>
          </div>
        </div>

        <div v-if="busy" class="skeleton">
          <div class="sk-line w60" />
          <div class="sk-line w40" />
          <div class="sk-grid"><div /><div /><div /><div /></div>
        </div>

        <div v-else-if="error" class="sim-error">
          <i class="pi pi-exclamation-triangle" />
          <p>{{ error }}</p>
        </div>

        <div v-else-if="result" class="filled">
          <div class="field-row">
            <span class="field-key">Gruplar</span>
            <div class="chips">
              <span v-for="g in result.groups" :key="g" class="chip-group">{{ label(g) }}</span>
              <span v-if="!result.groups?.length" class="chip-empty">öneri gelmedi</span>
            </div>
          </div>

          <div class="field-row">
            <span class="field-key">Ölçü</span>
            <span class="measure">1 {{ measureLabel(result.measure) }}</span>
          </div>

          <div class="macro-grid">
            <div class="macro kcal"><small>Enerji</small><strong>{{ Math.round(result.macros.kcal) }}</strong><span>kcal</span></div>
            <div class="macro"><small>Protein</small><strong>{{ Math.round(result.macros.protein) }}</strong><span>g</span></div>
            <div class="macro"><small>Karbonhidrat</small><strong>{{ Math.round(result.macros.carb) }}</strong><span>g</span></div>
            <div class="macro"><small>Yağ</small><strong>{{ Math.round(result.macros.fat) }}</strong><span>g</span></div>
          </div>

          <p v-if="result.description" class="desc">{{ result.description }}</p>

          <button type="button" class="save-btn" disabled>Menüne Kaydet</button>
          <p class="save-note">Simülasyonda kayıt yok. Uygulamada bu düğme kayıt kapısını açar.</p>
        </div>

        <div v-else class="idle">
          <!-- Yön belirtmiyoruz: dar ekranda kontroller solda değil üstte. -->
          <p>Bir besin adı girip “Afi doldursun”a bas.</p>
        </div>
      </PhoneFrame>

      <TraceBox v-if="trace && result" :trace="trace" />
    </div>
  </div>
</template>

<style scoped>
.sim-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(320px, 420px); gap: 22px; align-items: start; }

.sim-controls { display: grid; gap: 14px; padding: 19px 21px; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); }
.field { display: grid; gap: 6px; }
.field > span { color: var(--muted); font-size: 11px; font-weight: 850; letter-spacing: .05em; text-transform: uppercase; }
.field > span small { font-weight: 650; letter-spacing: 0; text-transform: none; }
.field-note { color: var(--muted); font-size: 11px; line-height: 1.5; }
.examples { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
.examples > span { color: var(--muted); font-size: 11.5px; }
.examples button {
  padding: 4px 10px; border: 1px solid var(--line); border-radius: 999px;
  background: var(--canvas); color: #4f5a53; font-size: 11.5px; cursor: pointer;
}
.examples button:hover:not(:disabled) { border-color: var(--green); color: var(--green-dark); }
.examples button:disabled { opacity: .5; cursor: default; }

.sim-stage { display: grid; gap: 13px; }

.sheet-head { display: grid; grid-template-columns: 46px minmax(0, 1fr); gap: 12px; align-items: center; }
.afi-bubble { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 15px 15px 15px 5px; background: #dff0e7; font-size: 23px; }
.sheet-head strong { display: block; font-size: 15px; }
.sheet-head small { display: block; margin-top: 3px; color: var(--muted); font-size: 11.5px; }

.skeleton { display: grid; gap: 10px; margin-top: 20px; }
.sk-line { height: 13px; border-radius: 7px; background: #eee9dc; animation: pulse 1.3s ease-in-out infinite; }
.sk-line.w60 { width: 60%; } .sk-line.w40 { width: 40%; }
.sk-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 4px; }
.sk-grid div { height: 52px; border-radius: 11px; background: #eee9dc; animation: pulse 1.3s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .5; } }
@media (prefers-reduced-motion: reduce) { .sk-line, .sk-grid div { animation: none; } }

.sim-error { display: flex; gap: 10px; align-items: flex-start; margin-top: 20px; padding: 13px; border-radius: 12px; background: #fdf5f3; }
.sim-error i { margin-top: 2px; color: var(--coral); font-size: 13px; }
.sim-error p { margin: 0; color: #7a4437; font-size: 12.5px; line-height: 1.55; }

.filled { display: grid; gap: 14px; margin-top: 18px; }
.field-row { display: grid; gap: 6px; }
.field-key { color: var(--muted); font-size: 10px; font-weight: 850; letter-spacing: .06em; text-transform: uppercase; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip-group { padding: 4px 11px; border-radius: 999px; background: #dff0e7; color: #1f5843; font-size: 12px; font-weight: 800; }
.chip-empty { color: #a3a59c; font-size: 12px; font-style: italic; }
.measure { padding: 4px 11px; border: 1px solid var(--line); border-radius: 999px; background: var(--canvas); font-size: 12.5px; font-weight: 750; justify-self: start; }

.macro-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.macro { padding: 9px 6px; border: 1px solid var(--line); border-radius: 12px; background: var(--canvas); text-align: center; }
.macro.kcal { border-color: #bfe3cf; background: #eef8f2; }
.macro small { display: block; color: var(--muted); font-size: 9px; font-weight: 850; letter-spacing: .03em; }
.macro strong { display: block; margin-top: 3px; font-size: 18px; font-variant-numeric: tabular-nums; }
.macro span { color: var(--muted); font-size: 9.5px; }

.desc { margin: 0; color: #5b6159; font-size: 12.5px; line-height: 1.55; }
.save-btn {
  margin-top: 2px; padding: 13px; border: 0; border-radius: 14px;
  background: var(--green); color: #fff; font-size: 13px; font-weight: 850; opacity: .55;
}
.save-note { margin: 0; color: #a3a59c; font-size: 10.5px; font-style: italic; text-align: center; }

.idle { padding: 34px 0 22px; text-align: center; }
.idle p { margin: 0; color: #a3a59c; font-size: 12.5px; }

@media (max-width: 1100px) {
  .sim-layout { grid-template-columns: 1fr; }
}
</style>
