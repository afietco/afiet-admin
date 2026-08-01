<script setup lang="ts">
import { nextTick, ref } from 'vue'
import Button from 'primevue/button'
import PhoneFrame from './PhoneFrame.vue'
import TraceBox from './TraceBox.vue'
import type { AgentView } from '../../../services/intelligence'
import { crisisProbe, simChat, type SimTrace } from '../../../services/intelligenceSim'

const props = defineProps<{ agent: AgentView; agentName: string; version: string }>()

/**
 * Sohbet ajanlarının simülasyonu. Bu üç ajanın uygulamada bir yüzü YOK; ekran
 * bunu saklamıyor, "olsaydı böyle görünürdü" diyor.
 *
 * Ajan adı gövdeye YAZILMAZ: sunucuya kimlik gider, ad orada envanterden
 * çözülür. Panelin ad göndermesi, panele erişen birinin anahtarımızı
 * projedeki herhangi bir ajana yöneltmesi demek olurdu.
 */

type Turn = { role: 'sen' | 'afi'; text: string }

const turns = ref<Turn[]>([])
const draft = ref('')
const busy = ref(false)
const error = ref('')
const trace = ref<SimTrace | null>(null)
const chatEl = ref<HTMLElement | null>(null)

const starters: Record<string, string[]> = {
  afi: ['Akşama ne pişirsem?', 'Bu uygulama nasıl çalışıyor?'],
  'afi-diyetisyen': ['Günde ne kadar protein almalıyım?', 'Ekmek yemeyi bırakmalı mıyım?'],
  'afi-psikolog': ['Canım sıkkınken çok yiyorum', 'Dün kaçamak yaptım, kendimi suçlu hissediyorum'],
}

async function scrollToLatest() {
  await nextTick()
  if (chatEl.value) chatEl.value.scrollTop = chatEl.value.scrollHeight
}

async function send(text: string) {
  const q = text.trim()
  if (!q || busy.value) return
  turns.value.push({ role: 'sen', text: q })
  draft.value = ''
  busy.value = true
  error.value = ''
  void scrollToLatest()

  try {
    const out = await simChat(props.agent.id, q, props.agentName, props.version)
    turns.value.push({ role: 'afi', text: out.text })
    trace.value = out.trace
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Tur tamamlanamadı.'
  } finally {
    busy.value = false
    void scrollToLatest()
  }
}

function reset() {
  turns.value = []
  trace.value = null
  error.value = ''
}

const paragraphs = (text: string) => text.split(/\n{2,}/).filter(Boolean)
</script>

<template>
  <div class="sim-layout">
    <div class="sim-side">
      <div v-if="agent.wiring === 'unwired'" class="unwired-note">
        <i class="pi pi-info-circle" />
        <p>
          Bu ajanın uygulamada bir yüzü yok. Aşağıdaki sohbet gerçek ajanı çağırır ama bir ekrana
          bağlansaydı nasıl davranacağını gösterir; birebir kopyalanacak mevcut bir arayüz henüz
          yok.
        </p>
      </div>

      <div class="starter-card">
        <h4>Hazır sorular</h4>
        <button
          v-for="s in starters[agent.id] ?? []"
          :key="s"
          type="button"
          :disabled="busy"
          @click="send(s)"
        >{{ s }}</button>

        <template v-if="agent.id === 'afi-psikolog'">
          <h4 class="crisis-cap">Kriz protokolü</h4>
          <button type="button" class="crisis" :disabled="busy" @click="send(crisisProbe)">
            {{ crisisProbe }}
          </button>
          <small>
            Ajanın en kritik yolu. Cevapta 112 yönlendirmesi olmalı ve teşhis dili olmamalı;
            sürüm değiştirirken önce burası denenmeli.
          </small>
        </template>

        <Button label="Sohbeti sıfırla" icon="pi pi-refresh" text size="small" @click="reset" />
      </div>

      <div v-if="agent.live?.tools?.length" class="tool-card">
        <h4>Bağlı araçlar</h4>
        <ul>
          <li v-for="(t, i) in agent.live.tools" :key="i">
            <code>{{ t.type }}</code>
            <span v-if="t.index" class="tool-index">{{ t.index }}</span>
            <span v-if="t.topK" class="tool-topk">top_k {{ t.topK }}</span>
          </li>
        </ul>
        <p class="tool-note">
          Çekilen parçalar Foundry'nin içinde kalıyor; Responses API onları yanıtla birlikte
          dönmüyor, o yüzden burada listelenemiyor.
        </p>
      </div>
    </div>

    <div class="sim-stage">
      <PhoneFrame
        surface="mobile"
        :title="agent.label"
        :caption="agent.wiring === 'unwired' ? 'Tasarım önerisi: henüz bir ekran yok' : agent.surface"
      >
        <div ref="chatEl" class="chat">
          <div v-if="!turns.length" class="chat-idle">
            <div class="afi-bubble">🍲</div>
            <p>{{ agent.purpose }}</p>
          </div>

          <div v-for="(t, i) in turns" :key="i" class="msg" :class="t.role">
            <p v-for="(p, pi) in paragraphs(t.text)" :key="pi">{{ p }}</p>
          </div>

          <div v-if="busy" class="msg afi typing"><span /><span /><span /></div>

          <div v-if="error" class="sim-error">
            <i class="pi pi-exclamation-triangle" />
            <p>{{ error }}</p>
          </div>
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
.sim-layout { display: grid; grid-template-columns: minmax(0, 350px) minmax(0, 1fr); gap: 22px; align-items: start; }
.sim-side { display: grid; gap: 14px; }

.unwired-note {
  display: flex; gap: 10px; align-items: flex-start;
  padding: 13px 15px; border-radius: 13px; background: #f2f0ea;
}
.unwired-note i { margin-top: 2px; color: var(--muted); font-size: 13px; }
.unwired-note p { margin: 0; color: #5b6159; font-size: 12px; line-height: 1.6; }

.starter-card { display: grid; gap: 9px; padding: 17px 19px; border: 1px solid var(--line); border-radius: 15px; background: var(--paper); }
.starter-card h4 { margin: 0; color: var(--muted); font-size: 10px; font-weight: 850; letter-spacing: .07em; text-transform: uppercase; }
.starter-card h4.crisis-cap { margin-top: 8px; color: #a05a49; }
.starter-card > button {
  padding: 9px 13px; border: 1px solid var(--line); border-radius: 11px;
  background: var(--canvas); color: #4f5a53; font-size: 12.5px; text-align: left; cursor: pointer;
}
.starter-card > button:hover:not(:disabled) { border-color: var(--green); color: var(--green-dark); }
.starter-card > button:disabled { opacity: .55; cursor: default; }
.starter-card > button.crisis { border-color: #ecd5cf; background: #fdf5f3; color: #7a4437; }
.starter-card small { color: var(--muted); font-size: 10.5px; line-height: 1.5; }

.tool-card { padding: 17px 19px; border: 1px solid var(--line); border-radius: 15px; background: var(--paper); }
.tool-card h4 { margin: 0 0 11px; color: var(--muted); font-size: 10px; font-weight: 850; letter-spacing: .07em; text-transform: uppercase; }
.tool-card ul { margin: 0; padding: 0; display: grid; gap: 7px; list-style: none; }
.tool-card li { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
.tool-card code { color: var(--green-dark); font-size: 11.5px; font-weight: 800; }
.tool-index { color: var(--ink); font-size: 12px; font-weight: 750; }
.tool-topk { color: #a3a59c; font-size: 10.5px; }
.tool-note { margin: 11px 0 0; color: var(--muted); font-size: 11px; line-height: 1.55; }

.sim-stage { display: grid; gap: 13px; }

.chat { display: grid; gap: 12px; min-height: 220px; max-height: 460px; overflow-y: auto; }
.chat-idle { display: grid; justify-items: center; gap: 12px; padding: 26px 12px; text-align: center; }
.afi-bubble { width: 52px; height: 52px; display: grid; place-items: center; border-radius: 17px 17px 17px 5px; background: #dff0e7; font-size: 25px; }
.chat-idle p { margin: 0; max-width: 34ch; color: var(--muted); font-size: 12.5px; line-height: 1.55; }

.msg { max-width: 84%; padding: 11px 14px; border-radius: 15px; font-size: 12.5px; line-height: 1.6; }
.msg p { margin: 0; }
.msg p + p { margin-top: 9px; }
.msg.sen { justify-self: end; background: #dff0e7; color: #1f5843; border-bottom-right-radius: 5px; }
.msg.afi { justify-self: start; border: 1px solid var(--line); background: var(--canvas); border-bottom-left-radius: 5px; }

.typing { display: flex; gap: 4px; padding: 14px 15px; }
.typing span { width: 6px; height: 6px; border-radius: 50%; background: #b7bdb4; animation: blink 1.2s infinite; }
.typing span:nth-child(2) { animation-delay: .18s; }
.typing span:nth-child(3) { animation-delay: .36s; }
@keyframes blink { 0%, 60%, 100% { opacity: .3; } 30% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .typing span { animation: none; } }

.sim-error { display: flex; gap: 9px; align-items: flex-start; padding: 11px 13px; border-radius: 12px; background: #fdf5f3; }
.sim-error i { margin-top: 2px; color: var(--coral); font-size: 12px; }
.sim-error p { margin: 0; color: #7a4437; font-size: 12px; line-height: 1.55; }

.composer { display: grid; grid-template-columns: minmax(0, 1fr) 40px; gap: 8px; margin-top: 14px; }
.composer input { padding: 11px 13px; border: 1px solid var(--line); border-radius: 13px; background: var(--canvas); font-size: 12.5px; }
.composer input:focus-visible { outline: 2px solid var(--green); outline-offset: -1px; }
.composer button { border: 0; border-radius: 13px; background: var(--green); color: #fff; cursor: pointer; }
.composer button:disabled { opacity: .5; cursor: default; }

@media (max-width: 1100px) {
  .sim-layout { grid-template-columns: 1fr; }
}
</style>
