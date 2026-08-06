<script setup lang="ts">
import { computed, ref } from 'vue'
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import type { AgentView } from '../../../services/intelligence'

const props = defineProps<{ agent: AgentView; loading: boolean }>()
const toast = useToast()

/**
 * Sistem promptu Foundry'de yaşar ve buraya SUNUCUDAN gelir; anahtar hiçbir
 * zaman tarayıcıya inmez.
 *
 * "Afi'ye sor" akışında promptun ziyaretçiye sızmaması bir güvenlik
 * kuralıdır; bu panel admin rolünün arkasında ve promptu görmek ekranın
 * varlık sebebi. İki bağlam karıştırılmamalı.
 */

const text = computed(() => props.agent.live?.instructions ?? '')
const showRaw = ref(false)

const rawJson = computed(() => {
  const raw = props.agent.live?.raw
  if (!raw) return ''
  try {
    return JSON.stringify(raw, null, 2)
  } catch {
    return ''
  }
})

const lineCount = computed(() => (text.value ? text.value.split('\n').length : 0))
const charCount = computed(() => text.value.length)

async function copyPrompt() {
  try {
    await navigator.clipboard.writeText(text.value)
    toast.add({ severity: 'success', summary: 'Prompt kopyalandı', life: 2500 })
  } catch {
    toast.add({
      severity: 'error', summary: 'Kopyalanamadı',
      detail: 'Tarayıcı panoya yazma izni vermedi.', life: 4000,
    })
  }
}
</script>

<template>
  <section class="panel-stack">
    <div v-if="loading" class="missing-card">
      <p>Talimat Foundry'den okunuyor…</p>
    </div>

    <template v-else-if="text">
      <div class="prompt-head">
        <div>
          <strong>Foundry'deki canlı talimat</strong>
          <small>
            {{ agent.live?.name }}
            <template v-if="agent.live?.version"> · v{{ agent.live.version }}</template>
            · {{ lineCount }} satır · {{ charCount }} karakter
          </small>
        </div>
        <div class="prompt-actions">
          <Button label="Kopyala" icon="pi pi-copy" outlined size="small" @click="copyPrompt" />
          <Button
            :label="showRaw ? 'Ham gövdeyi gizle' : 'Ham gövde'"
            icon="pi pi-code" text size="small"
            @click="showRaw = !showRaw"
          />
        </div>
      </div>

      <pre class="prompt-text">{{ text }}</pre>

      <pre v-if="showRaw && rawJson" class="raw-text">{{ rawJson }}</pre>
      <p v-else-if="showRaw" class="no-raw">Sağlayıcı ham gövde döndürmedi.</p>
    </template>

    <div v-else class="missing-card">
      <div class="missing-head">
        <i class="pi pi-lock" />
        <div>
          <strong>Talimat okunamadı</strong>
          <small v-if="agent.live && !agent.live.configured">
            Bu ortamda Foundry anahtarı yapılandırılmamış.
          </small>
          <small v-else-if="agent.live?.error">
            Foundry ajanı çözemedi. Ad yanlış olabilir ya da anahtar bu ajana yetmiyor.
          </small>
          <small v-else>Sağlayıcı talimat alanı döndürmedi.</small>
        </div>
      </div>
      <p>
        Talimat, portaldaki <code>{{ agent.live?.name || agent.id }}</code> ajanının üzerinde
        durur ve sunucu onu
        <code>GET {FOUNDRY_PROJECT_URL}/agents/{ad}?api-version=v1</code> ile okur. Repoda kopyası
        yoktur; burada boş görünmesi, panelin yaklaşık bir metin uydurmadığı anlamına gelir.
      </p>
      <pre v-if="rawJson" class="raw-text">{{ rawJson }}</pre>
    </div>

    <div class="constraint-card">
      <h3>Teyitli kısıtlar</h3>
      <p class="constraint-lead">
        Aşağıdakiler promptun kendisi değil; koddan, sözleşmelerden ve karar kaydından
        doğrulanmış davranış sınırları. Sunucu bunların bir kısmını çıktı üzerinde ayrıca zorlar,
        yani prompt değişse bile geçerli kalırlar.
      </p>
      <ul>
        <li v-for="rule in agent.promptConstraints" :key="rule">{{ rule }}</li>
      </ul>
    </div>

    <div class="version-card">
      <h3><i class="pi pi-history" /> Sürüm kuralı</h3>
      <p>
        Talimat değişikliği <strong>yeni sürüm</strong> olarak eklenir, mevcut sürüme dokunulmaz.
        Bu panel yalnız OKUR; buradan talimat değiştirilemez, sürüm yayınlanamaz.
        <template v-if="agent.live?.pinnedVersion">
          Bu ajan <code>{{ agent.live.pinnedVersion }}</code> sürümüne sabitli: üç ortam tek
          Foundry projesini paylaşıyor, sabitlenmemiş olsaydı portalda yayınlanan her sürüm
          prod'u da anında etkilerdi.
        </template>
        <template v-else>
          Bu ajanın sürümü <strong>sabitlenmemiş</strong>: portalda yeni sürüm yayınlandığı anda
          dev, staging ve prod birden onu kullanmaya başlar.
        </template>
      </p>
    </div>
  </section>
</template>

<style scoped>
.panel-stack { display: grid; gap: 16px; padding: 24px; }

.prompt-head { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between; }
.prompt-head strong { display: block; font-size: 14px; }
.prompt-head small { display: block; margin-top: 3px; color: var(--muted); font-size: 11.5px; }
.prompt-actions { display: flex; gap: 6px; }

.prompt-text, .raw-text {
  margin: 0; padding: 20px 22px; max-width: 100%; overflow-x: auto;
  border: 1px solid var(--line); border-radius: 16px; background: var(--paper);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; line-height: 1.65;
  white-space: pre-wrap; overflow-wrap: anywhere;
}
.raw-text { max-height: 420px; overflow-y: auto; background: #f5f2e9; font-size: 11px; }
.no-raw { margin: 0; color: var(--muted); font-size: 12.5px; font-style: italic; }

.missing-card { padding: 20px 22px; border: 1px dashed #d5cdb8; border-radius: 16px; background: #faf7ee; }
.missing-head { display: flex; gap: 12px; align-items: flex-start; }
.missing-head i { margin-top: 3px; color: var(--muted); font-size: 15px; }
.missing-head strong { display: block; font-size: 14px; }
.missing-head small { display: block; margin-top: 3px; color: var(--muted); font-size: 12px; }
.missing-card p { margin: 14px 0 0; max-width: 88ch; color: #5b6159; font-size: 12.5px; line-height: 1.65; }
.missing-card code { padding: 1px 5px; border-radius: 5px; background: #efeade; font-size: 11.5px; overflow-wrap: anywhere; }
.missing-card .raw-text { margin-top: 14px; }

.constraint-card { padding: 20px 22px; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); }
.constraint-card h3 { margin: 0; font-size: 14px; }
.constraint-lead { margin: 8px 0 14px; max-width: 88ch; color: var(--muted); font-size: 12.5px; line-height: 1.6; }
.constraint-card ul { margin: 0; padding-left: 18px; display: grid; gap: 8px; }
.constraint-card li { max-width: 92ch; font-size: 13px; line-height: 1.55; }

.version-card { padding: 17px 19px; border: 1px solid var(--line); border-radius: 15px; background: #f4faf6; }
.version-card h3 { display: flex; gap: 8px; align-items: center; margin: 0; font-size: 13.5px; }
.version-card h3 i { color: var(--green); font-size: 12px; }
.version-card p { margin: 9px 0 0; max-width: 90ch; color: #4f5a53; font-size: 12.5px; line-height: 1.6; }
.version-card code { padding: 1px 5px; border-radius: 5px; background: #e3f0e8; font-size: 11.5px; }
</style>
