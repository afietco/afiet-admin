<script setup lang="ts">
import Button from 'primevue/button'
import type { Agent } from '../../../services/intelligence'

defineProps<{ agent: Agent }>()

/**
 * Sistem promptunun tam metni YALNIZ Foundry'de duruyor; repoda kopyası yok ve
 * panele taşıyacak bir uç henüz açılmadı. Bu panel o boşluğu saklamıyor:
 * "prompt burada" diye yaklaşık bir metin göstermek, gerçek talimattan sapan
 * bir sürümün panelde doğruymuş gibi okunmasına yol açardı.
 *
 * Yerine koddan ve karar kaydından TEYİTLİ kısıtlar listeleniyor: ajanın neye
 * zorlandığını gösterir, ne dediğini değil.
 */
</script>

<template>
  <section class="panel-stack">
    <template v-if="agent.promptText">
      <pre class="prompt-text">{{ agent.promptText }}</pre>
    </template>

    <template v-else>
      <div class="missing-card">
        <div class="missing-head">
          <i class="pi pi-lock" />
          <div>
            <strong>Tam metin Foundry'de</strong>
            <small>Talimatın repoda kopyası yok, panele taşıyacak uç da henüz açılmadı.</small>
          </div>
        </div>
        <p>
          Ajan talimatı Azure AI Foundry portalındaki <code>{{ agent.name }}</code> ajanının
          <code>{{ agent.version }}</code> sürümünün üzerinde durur. Buraya çekmek
          <code>GET {FOUNDRY_PROJECT_URL}/agents/{{ agent.name }}?api-version=v1</code> çağrısını
          sunucudan yapan bir yönetim ucu gerektirir; anahtar tarayıcıya inmemeli.
        </p>
        <Button label="Foundry'den çek" icon="pi pi-download" outlined disabled />
        <small class="disabled-why">Uç açılınca etkinleşir.</small>
      </div>

      <div class="constraint-card">
        <h3>Teyitli kısıtlar</h3>
        <p class="constraint-lead">
          Aşağıdakiler promptun kendisi değil; koddan, sözleşmelerden ve karar kaydından
          doğrulanmış davranış sınırları. Sunucu bunların bir kısmını çıktı üzerinde ayrıca zorlar.
        </p>
        <ul>
          <li v-for="rule in agent.promptConstraints" :key="rule">{{ rule }}</li>
        </ul>
      </div>
    </template>

    <div class="version-card">
      <h3><i class="pi pi-history" /> Sürüm kuralı</h3>
      <p>
        Talimat değişikliği <strong>yeni sürüm</strong> olarak eklenir, mevcut sürüme dokunulmaz.
        <template v-if="agent.versionPin === 'pinned'">
          Bu ajan <code>{{ agent.version }}</code>'de sabitli: üç ortam tek Foundry projesini
          paylaşıyor, sabitlenmemiş olsaydı portalda yayınlanan her sürüm prod'u da anında
          etkilerdi.
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
.panel-stack { display: grid; gap: 16px; }

.prompt-text {
  margin: 0; padding: 20px 22px; max-width: 100%; overflow-x: auto;
  border: 1px solid var(--line); border-radius: 16px; background: var(--paper);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; line-height: 1.65;
  white-space: pre-wrap; overflow-wrap: anywhere;
}

.missing-card { padding: 20px 22px; border: 1px dashed #d5cdb8; border-radius: 16px; background: #faf7ee; }
.missing-head { display: flex; gap: 12px; align-items: flex-start; }
.missing-head i { margin-top: 3px; color: var(--muted); font-size: 15px; }
.missing-head strong { display: block; font-size: 14px; }
.missing-head small { display: block; margin-top: 3px; color: var(--muted); font-size: 12px; }
.missing-card p { margin: 14px 0 16px; max-width: 88ch; color: #5b6159; font-size: 12.5px; line-height: 1.65; }
.missing-card code { padding: 1px 5px; border-radius: 5px; background: #efeade; font-size: 11.5px; overflow-wrap: anywhere; }
.disabled-why { display: block; margin-top: 8px; color: var(--muted); font-size: 11px; }

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
