<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import PhoneFrame from './PhoneFrame.vue'
import TraceBox from './TraceBox.vue'
import { label, measureLabel } from '../../../services/foodLabels'
import { simPhotoTurn, type PhotoFood, type PhotoReply, type SimTrace } from '../../../services/intelligenceSim'

/**
 * Fotoğraftan tanıma simülasyonu: mobil AfiPhotoSheet'in kopyası. Sohbet
 * serbest değil süreç odaklıdır: ajan ya net bir soru sorar ya sonuç döner,
 * o yüzden simülasyon da ilk turda sonuca atlamaz.
 *
 * Seçilen fotoğraf HİÇBİR YERE gitmez: yalnız tarayıcıda önizlenir. Gerçek
 * akışta bile fotoğraf saklanmaz, Files API'ye yüklenip tur dönünce silinir.
 */

type Bubble =
  | { role: 'user'; text: string; image?: string }
  | { role: 'afi'; reply: PhotoReply }

const bubbles = ref<Bubble[]>([])
const draft = ref('')
const hint = ref('')
const busy = ref(false)
const trace = ref<SimTrace | null>(null)
const imageUrl = ref('')
const hasImage = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const chatEl = ref<HTMLElement | null>(null)

// Sonuç kartı uzun; yeni tur gelince aşağı inmezse cevap görünmeyen alanda
// kalır. Uygulamadaki sheet de yeni mesaja kayıyor.
async function scrollToLatest() {
  await nextTick()
  if (chatEl.value) chatEl.value.scrollTop = chatEl.value.scrollHeight
}

function releaseImage() {
  if (imageUrl.value) URL.revokeObjectURL(imageUrl.value)
  imageUrl.value = ''
}

function onFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  releaseImage()
  imageUrl.value = URL.createObjectURL(file)
  hasImage.value = true
}

/** Fotoğraf seçemeyen/istemeyen için: dosyasız da akış denenebilmeli. */
function useSampleImage() {
  releaseImage()
  hasImage.value = true
}

async function send(text: string) {
  if (busy.value) return
  const turnIndex = bubbles.value.filter((b) => b.role === 'user').length
  const attaching = turnIndex === 0 && hasImage.value
  if (!text.trim() && !attaching) return

  bubbles.value.push({
    role: 'user',
    text: text.trim() || (attaching ? 'Bu ne kadar?' : ''),
    image: attaching ? imageUrl.value || 'sample' : undefined,
  })
  draft.value = ''
  busy.value = true
  void scrollToLatest()
  try {
    const out = await simPhotoTurn({
      turnIndex,
      text: text.trim(),
      hasImage: hasImage.value,
      hint: hint.value,
    })
    bubbles.value.push({ role: 'afi', reply: out.reply })
    trace.value = out.trace
  } finally {
    busy.value = false
    void scrollToLatest()
  }
}

function reset() {
  bubbles.value = []
  trace.value = null
  draft.value = ''
  hasImage.value = false
  releaseImage()
  if (fileInput.value) fileInput.value.value = ''
}

const macroLine = (f: PhotoFood) =>
  `${f.macros.kcal} kcal · P ${f.macros.protein} · K ${f.macros.carb} · Y ${f.macros.fat}`

onBeforeUnmount(releaseImage)
</script>

<template>
  <div class="sim-layout">
    <div class="sim-controls">
      <label class="field">
        <span>Fotoğraf</span>
        <input ref="fileInput" type="file" accept="image/*" @change="onFile" />
        <small class="field-note">
          Seçtiğin görsel hiçbir yere gönderilmez, yalnız bu sekmede önizlenir.
        </small>
      </label>
      <Button label="Örnek kare kullan" icon="pi pi-image" outlined size="small" @click="useSampleImage" />

      <label class="field">
        <span>Hint <small>(Besin Ekle'de yazılmış ad, yalnız ilk tur)</small></span>
        <InputText v-model="hint" placeholder="Örn. ızgara tavuk" />
      </label>

      <p class="control-note">
        İlk turda hint referanstır; fotoğrafla çelişirse ajan <strong>fotoğrafa güvenir</strong>.
      </p>

      <Button label="Sohbeti sıfırla" icon="pi pi-refresh" text size="small" @click="reset" />
    </div>

    <div class="sim-stage">
      <PhoneFrame surface="mobile" title="Afi'ye sor" caption="Mobil · AfiPhotoSheet (tam ekran)">
        <div ref="chatEl" class="chat">
          <div v-if="!bubbles.length" class="chat-idle">
            <div class="afi-bubble">📷</div>
            <p>Fotoğrafı gönder, ne olduğunu ve yaklaşık değerlerini birlikte bulalım.</p>
          </div>

          <template v-for="(b, i) in bubbles" :key="i">
            <div v-if="b.role === 'user'" class="msg user">
              <img v-if="b.image && b.image !== 'sample'" :src="b.image" alt="Gönderilen fotoğraf" />
              <div v-else-if="b.image" class="sample-photo"><i class="pi pi-image" /> örnek kare</div>
              <p v-if="b.text">{{ b.text }}</p>
            </div>

            <div v-else class="msg afi">
              <p>{{ b.reply.text }}</p>

              <div v-if="b.reply.quickReplies.length" class="quick">
                <button
                  v-for="q in b.reply.quickReplies"
                  :key="q"
                  type="button"
                  :disabled="busy || i !== bubbles.length - 1"
                  @click="send(q)"
                >{{ q }}</button>
              </div>

              <div v-if="b.reply.needsPhoto" class="needs-photo">
                <i class="pi pi-camera" /> Fotoğraf bekleniyor
              </div>

              <div v-if="b.reply.food" class="food-card">
                <div class="food-top">
                  <strong>{{ b.reply.food.name }}</strong>
                  <span class="measure">1 {{ measureLabel(b.reply.food.measure) }}</span>
                </div>
                <div class="chips">
                  <span v-for="g in b.reply.food.groups" :key="g">{{ label(g) }}</span>
                </div>
                <div class="macro-line">{{ macroLine(b.reply.food) }}</div>
                <p v-if="b.reply.food.description" class="food-desc">{{ b.reply.food.description }}</p>
                <button type="button" class="save-btn" disabled>Menüne Kaydet</button>
              </div>

              <div v-if="b.reply.extraFoods.length" class="extras">
                <span class="extras-cap">Karede bunlar da var</span>
                <div v-for="ex in b.reply.extraFoods" :key="ex.name" class="extra-card">
                  <div>
                    <strong>{{ ex.name }}</strong>
                    <small>{{ macroLine(ex) }}</small>
                  </div>
                  <button type="button" disabled>
                    {{ ex.inPool ? 'Ekle' : 'Oluştur' }}
                  </button>
                </div>
              </div>
            </div>
          </template>

          <div v-if="busy" class="msg afi typing"><span /><span /><span /></div>
        </div>

        <form class="composer" @submit.prevent="send(draft)">
          <input v-model="draft" placeholder="Bir şey yaz…" :disabled="busy" />
          <button type="submit" :disabled="busy" aria-label="Gönder"><i class="pi pi-send" /></button>
        </form>
      </PhoneFrame>

      <TraceBox v-if="trace" :trace="trace" />
    </div>
  </div>
</template>

<style scoped>
.sim-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(340px, 440px); gap: 22px; align-items: start; }

.sim-controls { display: grid; gap: 14px; padding: 19px 21px; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); }
.field { display: grid; gap: 6px; }
.field > span { color: var(--muted); font-size: 11px; font-weight: 850; letter-spacing: .05em; text-transform: uppercase; }
.field > span small { font-weight: 650; letter-spacing: 0; text-transform: none; }
.field input[type='file'] { font-size: 12px; }
.field-note { color: var(--muted); font-size: 11px; line-height: 1.5; }
.control-note { margin: 0; color: var(--muted); font-size: 11.5px; line-height: 1.55; }

.sim-stage { display: grid; gap: 13px; }

.chat { display: grid; gap: 12px; min-height: 220px; max-height: 460px; overflow-y: auto; padding-bottom: 4px; }
.chat-idle { display: grid; justify-items: center; gap: 12px; padding: 26px 12px; text-align: center; }
.afi-bubble { width: 52px; height: 52px; display: grid; place-items: center; border-radius: 17px 17px 17px 5px; background: #dff0e7; font-size: 25px; }
.chat-idle p { margin: 0; max-width: 30ch; color: var(--muted); font-size: 12.5px; line-height: 1.55; }

.msg { max-width: 84%; padding: 11px 13px; border-radius: 15px; font-size: 12.5px; line-height: 1.55; }
.msg p { margin: 0; }
.msg.user { justify-self: end; background: #dff0e7; color: #1f5843; border-bottom-right-radius: 5px; }
.msg.user img { display: block; width: 100%; max-width: 190px; margin-bottom: 7px; border-radius: 10px; }
.sample-photo {
  display: flex; gap: 7px; align-items: center; justify-content: center;
  width: 150px; height: 92px; margin-bottom: 7px;
  border: 1px dashed #9dc4af; border-radius: 10px; color: #3f7c62; font-size: 11px;
}
.msg.afi { justify-self: start; border: 1px solid var(--line); background: var(--canvas); border-bottom-left-radius: 5px; }

.typing { display: flex; gap: 4px; padding: 14px 15px; }
.typing span { width: 6px; height: 6px; border-radius: 50%; background: #b7bdb4; animation: blink 1.2s infinite; }
.typing span:nth-child(2) { animation-delay: .18s; }
.typing span:nth-child(3) { animation-delay: .36s; }
@keyframes blink { 0%, 60%, 100% { opacity: .3; } 30% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .typing span { animation: none; } }

.quick { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.quick button {
  padding: 5px 11px; border: 1px solid #bfe3cf; border-radius: 999px;
  background: var(--paper); color: #1f5843; font-size: 11.5px; font-weight: 750; cursor: pointer;
}
.quick button:disabled { opacity: .5; cursor: default; }
.needs-photo { display: flex; gap: 7px; align-items: center; margin-top: 9px; color: var(--muted); font-size: 11px; }

.food-card { margin-top: 11px; padding: 12px; border: 1px solid var(--line); border-radius: 13px; background: var(--paper); }
.food-top { display: flex; gap: 9px; align-items: baseline; justify-content: space-between; }
.food-top strong { font-size: 13.5px; }
.measure { color: var(--muted); font-size: 11.5px; }
.chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
.chips span { padding: 3px 9px; border-radius: 999px; background: #dff0e7; color: #1f5843; font-size: 11px; font-weight: 800; }
.macro-line { margin-top: 9px; color: #4f5a53; font-size: 12px; font-variant-numeric: tabular-nums; }
.food-desc { margin: 7px 0 0; color: var(--muted); font-size: 11.5px; line-height: 1.5; }
.save-btn {
  width: 100%; margin-top: 11px; padding: 10px; border: 0; border-radius: 11px;
  background: var(--green); color: #fff; font-size: 12px; font-weight: 850; opacity: .55;
}

.extras { margin-top: 11px; display: grid; gap: 7px; }
.extras-cap { color: var(--muted); font-size: 10px; font-weight: 850; letter-spacing: .06em; text-transform: uppercase; }
.extra-card {
  display: flex; gap: 10px; align-items: center; justify-content: space-between;
  padding: 9px 11px; border: 1px solid var(--line); border-radius: 11px; background: var(--paper);
}
.extra-card strong { display: block; font-size: 12.5px; }
.extra-card small { display: block; margin-top: 2px; color: var(--muted); font-size: 10.5px; font-variant-numeric: tabular-nums; }
.extra-card button {
  flex: none; padding: 5px 12px; border: 1px solid #bfe3cf; border-radius: 999px;
  background: #eef8f2; color: #1f5843; font-size: 11.5px; font-weight: 800; opacity: .6;
}

.composer { display: grid; grid-template-columns: minmax(0, 1fr) 40px; gap: 8px; margin-top: 14px; }
.composer input { padding: 11px 13px; border: 1px solid var(--line); border-radius: 13px; background: var(--canvas); font-size: 12.5px; }
.composer input:focus-visible { outline: 2px solid var(--green); outline-offset: -1px; }
.composer button { border: 0; border-radius: 13px; background: var(--green); color: #fff; cursor: pointer; }
.composer button:disabled { opacity: .5; cursor: default; }

@media (max-width: 1100px) {
  .sim-layout { grid-template-columns: 1fr; }
}
</style>
