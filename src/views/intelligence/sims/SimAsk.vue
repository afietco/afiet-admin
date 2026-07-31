<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import PhoneFrame from './PhoneFrame.vue'
import TraceBox from './TraceBox.vue'
import { simAskStream, type AskSource, type SimTrace } from '../../../services/intelligenceSim'

/**
 * Landing'deki "Afi'ye sor" kartının kopyası (afiet-web AskAfiPanel). Metinler
 * oradaki content.ts ile aynı tutuldu ki panelde görülen şey ziyaretçinin
 * gördüğüyle aynı olsun.
 *
 * Cevap DÜZ METİN basılır: v-html yok, istemci tarafı markdown yok. Ziyaretçinin
 * yönlendirebildiği bir model çıktısını render etmek gereksiz bir XSS yüzeyi.
 */

const copy = {
  invitation: 'Merhaba, ben Afi. afiet’le ilgili ne merak ediyorsan sor, kısaca anlatayım.',
  chipsLabel: 'Şunları sorabilirsin',
  chips: [
    'afiet kalori saymadan nasıl çalışıyor?',
    'Beta’ya nasıl katılırım?',
    'Verilerim ne oluyor?',
  ],
  placeholder: 'afiet’e dair ne merak ediyorsun?',
  answering: 'Afi yazıyor…',
}

type Turn = { role: 'sen' | 'afi'; text: string; sources?: AskSource[] }

const turns = ref<Turn[]>([])
const draft = ref('')
const busy = ref(false)
const trace = ref<SimTrace | null>(null)
// Akış kesilebilmeli: gerçek uçta ziyaretçi "Dur"a basınca SSE kapanıyor.
const aborted = ref(false)

const canSend = computed(() => draft.value.trim().length > 0 && !busy.value)

async function ask(question: string) {
  const q = question.trim()
  if (!q || busy.value) return
  turns.value.push({ role: 'sen', text: q })
  draft.value = ''
  busy.value = true
  aborted.value = false

  const answer: Turn = { role: 'afi', text: '' }
  turns.value.push(answer)
  try {
    const out = await simAskStream(q, (chunk) => {
      if (aborted.value) return false
      answer.text += chunk
      return true
    })
    if (!aborted.value) answer.sources = out.sources
    trace.value = out.trace
  } finally {
    busy.value = false
  }
}

function stop() {
  aborted.value = true
}

function reset() {
  aborted.value = true
  turns.value = []
  trace.value = null
}

/** Cevabı paragraflara böl; boş satır ayırıcı, markdown yok. */
const paragraphs = (text: string) => text.split(/\n{2,}/).filter(Boolean)

onBeforeUnmount(() => { aborted.value = true })
</script>

<template>
  <div class="sim-layout">
    <div class="sim-controls">
      <p class="control-lead">
        Bu kart afiet.co ana sayfasında SSS listesinin altında duruyor. Ziyaretçi anonimdir;
        sohbet geçmişi istemciden değil <strong>sunucunun kendi kaydından</strong> gelir.
      </p>
      <ul class="control-facts">
        <li>Turnstile ilk gerçek etkileşimde ısıtılır, sayfa açılışında değil.</li>
        <li>Alıntılar yalnız site içi yollar; host içeren uydurma bağlantı düşürülür.</li>
        <li>Kota dolunca giriş etkisizleşir ve odak CTA'ya taşınır.</li>
      </ul>
      <button type="button" class="reset-btn" @click="reset">Sohbeti sıfırla</button>
    </div>

    <div class="sim-stage">
      <PhoneFrame surface="web" title="afiet.co" caption="Web · SSS altındaki Afi'ye sor kartı">
        <div class="ask-head">
          <div class="afi-stage">🍲</div>
          <p class="invitation">{{ copy.invitation }}</p>
        </div>

        <ol v-if="turns.length" class="ask-turns">
          <li v-for="(turn, i) in turns" :key="i" :class="turn.role">
            <div class="ask-bubble">
              <template v-if="turn.role === 'afi'">
                <p v-for="(p, pi) in paragraphs(turn.text)" :key="pi">{{ p }}</p>
                <span v-if="!turn.text && busy" class="thinking">{{ copy.answering }}</span>
                <div v-if="turn.sources?.length" class="sources">
                  <span
                    v-for="s in turn.sources"
                    :key="s.url"
                    class="source-chip"
                  ><i class="pi pi-link" />{{ s.title }}</span>
                </div>
              </template>
              <p v-else>{{ turn.text }}</p>
            </div>
          </li>
        </ol>

        <div v-if="!turns.length" class="ask-chips">
          <span class="chips-label">{{ copy.chipsLabel }}</span>
          <button v-for="chip in copy.chips" :key="chip" type="button" @click="ask(chip)">{{ chip }}</button>
        </div>

        <form class="ask-form" @submit.prevent="canSend && ask(draft)">
          <input v-model="draft" :placeholder="copy.placeholder" />
          <button v-if="busy" type="button" class="stop" @click="stop">Dur</button>
          <button v-else type="submit" class="send" :disabled="!canSend">Sor</button>
        </form>
      </PhoneFrame>

      <TraceBox v-if="trace" :trace="trace" />
    </div>
  </div>
</template>

<style scoped>
.sim-layout { display: grid; grid-template-columns: minmax(0, 340px) minmax(0, 1fr); gap: 22px; align-items: start; }

.sim-controls { display: grid; gap: 13px; padding: 19px 21px; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); }
.control-lead { margin: 0; color: #5b6159; font-size: 12.5px; line-height: 1.6; }
.control-facts { margin: 0; padding-left: 17px; display: grid; gap: 7px; }
.control-facts li { color: var(--muted); font-size: 12px; line-height: 1.55; }
.reset-btn {
  justify-self: start; padding: 6px 13px; border: 1px solid var(--line); border-radius: 999px;
  background: var(--canvas); color: #4f5a53; font-size: 11.5px; cursor: pointer;
}
.reset-btn:hover { border-color: var(--green); color: var(--green-dark); }

.sim-stage { display: grid; gap: 13px; }

.ask-head { display: flex; gap: 15px; align-items: flex-start; }
.afi-stage { width: 62px; height: 62px; flex: none; display: grid; place-items: center; border-radius: 20px 20px 20px 6px; background: #dff0e7; font-size: 30px; }
.invitation { margin: 6px 0 0; color: var(--ink); font-size: 14px; font-weight: 800; line-height: 1.55; }

.ask-turns { margin: 22px 0 0; padding: 0; display: grid; gap: 14px; list-style: none; }
.ask-turns li { display: flex; }
.ask-turns li.sen { justify-content: flex-end; }
.ask-bubble { max-width: 82%; padding: 12px 15px; border-radius: 16px; font-size: 13px; line-height: 1.6; }
.ask-turns li.sen .ask-bubble { background: #dff0e7; color: #1f5843; border-bottom-right-radius: 5px; }
.ask-turns li.afi .ask-bubble { border: 1px solid var(--line); background: var(--canvas); border-bottom-left-radius: 5px; }
.ask-bubble p { margin: 0; }
.ask-bubble p + p { margin-top: 10px; }
.thinking { color: var(--muted); font-size: 12.5px; font-style: italic; }

.sources { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
.source-chip {
  display: flex; gap: 5px; align-items: center; padding: 4px 10px;
  border: 1px solid #cfe4d7; border-radius: 999px; background: var(--paper);
  color: #2c5a48; font-size: 11px; font-weight: 750;
}
.source-chip i { font-size: 9px; }

.ask-chips { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; margin-top: 20px; }
.chips-label { width: 100%; color: var(--muted); font-size: 11px; font-weight: 800; }
.ask-chips button {
  padding: 6px 13px; border: 1px solid var(--line); border-radius: 999px;
  background: var(--canvas); color: #4f5a53; font-size: 12px; cursor: pointer;
}
.ask-chips button:hover { border-color: var(--green); color: var(--green-dark); }

.ask-form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 9px; margin-top: 20px; }
.ask-form input { padding: 12px 15px; border: 1px solid var(--line); border-radius: 14px; background: var(--canvas); font-size: 13px; }
.ask-form input:focus-visible { outline: 2px solid var(--green); outline-offset: -1px; }
.ask-form button { padding: 0 20px; border: 0; border-radius: 14px; color: #fff; font-size: 13px; font-weight: 850; cursor: pointer; }
.ask-form .send { background: var(--green); }
.ask-form .send:disabled { opacity: .45; cursor: default; }
.ask-form .stop { background: #8a8f85; }

@media (max-width: 1100px) {
  .sim-layout { grid-template-columns: 1fr; }
}
</style>
