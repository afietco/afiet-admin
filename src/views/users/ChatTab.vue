<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import { usersApi, type ChatSessionSummary, type UserChat } from '../../services/users'
import { ago, dateTime } from './shared'

/**
 * Sohbet, okumadan.
 *
 * Bu ekranda tek kelime yazışma metni yok ve olmayacak. Onay ekranının
 * söylediği şu: yazdıkların cihaz değiştirsen de kaybolmasın diye sunucuda
 * saklanıyor, ve burada konuşulanlar ruh sağlığıyla ilgili olabileceği için
 * özel korumalı. "Ekibimiz okuyabilir" demiyor. Metni buraya getirmek
 * eklenmemiş bir özellik değil, verilmemiş bir izin.
 *
 * Geriye kalan, desteğin gerçekten sorduklarını cevaplıyor: hat işliyor mu,
 * bir oturum ortada kesildi mi, ne kadar kullanılıyor ve sohbet neden hiç
 * açılmıyor.
 */

const props = defineProps<{ userId: string }>()

const ASSISTANTS: Record<string, string> = {
  afi: 'Afi',
  beslenme: 'Beslenme',
  destek: 'Destek',
}

const TONES: Record<string, string> = {
  sakin: 'sakin',
  'doğrudan': 'doğrudan',
  oyunlu: 'oyunlu',
}

const RISKS: Record<string, { label: string; severity: 'success' | 'warn' | 'danger' }> = {
  yok: { label: 'risk yok', severity: 'success' },
  izlenmeli: { label: 'izlenmeli', severity: 'warn' },
  'yüksek': { label: 'yüksek risk', severity: 'danger' },
}

const data = ref<UserChat | null>(null)
const loading = ref(true)
const error = ref('')

const sessions = computed(() => data.value?.sessions ?? [])
const consents = computed(() => data.value?.consents ?? [])
const profile = computed(() => data.value?.productProfile ?? {})

const hasProfile = computed(() => Object.values(profile.value).some(Boolean))

/** Toplamlar: tek tek satırlardan önce okunacak olan şey. */
const totals = computed(() => {
  const rows = sessions.value
  return {
    sessions: rows.length,
    turns: rows.reduce((sum, r) => sum + r.turns, 0),
    partials: rows.reduce((sum, r) => sum + r.partialTurns, 0),
    candidates: rows.reduce((sum, r) => sum + r.candidates, 0),
  }
})

/**
 * Turlar var ama hiç hafıza adayı yoksa çıkarıcı durmuş olabilir. Tek bir
 * oturumda normal (biri hal hatır sormuştur); her oturumda öyleyse değil.
 */
const extractorSuspect = computed(
  () => totals.value.turns >= 6 && totals.value.candidates === 0,
)

function consentState(version: string, revokedAt: string | null) {
  if (revokedAt) return { label: 'geri alındı', severity: 'danger' as const }
  if (version !== data.value?.currentConsentVersion) {
    return { label: 'eski metne verilmiş', severity: 'warn' as const }
  }
  return { label: 'güncel', severity: 'success' as const }
}

const assistant = (key: string) => ASSISTANTS[key] ?? key

/** Karakteri kabaca dakikaya çevirmiyoruz; sayı olduğu gibi daha dürüst. */
const nf = new Intl.NumberFormat('tr-TR')

function rowKey(row: ChatSessionSummary) {
  return row.sessionId
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    data.value = await usersApi.chat(props.userId)
  } catch {
    error.value = 'Sohbet üstverisi okunamadı.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="chat-tab">
    <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>

    <template v-else-if="!loading">
      <section class="totals">
        <div class="totals__item">
          <small>Oturum</small><strong>{{ nf.format(totals.sessions) }}</strong>
        </div>
        <div class="totals__item">
          <small>Tur</small><strong>{{ nf.format(totals.turns) }}</strong>
        </div>
        <div class="totals__item" :class="{ 'totals__item--warn': totals.partials > 0 }">
          <small>Yarım kalan</small><strong>{{ nf.format(totals.partials) }}</strong>
        </div>
        <div class="totals__item" :class="{ 'totals__item--warn': extractorSuspect }">
          <small>Hafıza adayı</small><strong>{{ nf.format(totals.candidates) }}</strong>
        </div>
      </section>

      <Message v-if="extractorSuspect" severity="warn" :closable="false">
        {{ totals.turns }} tur konuşulmuş ama hiç hafıza adayı çıkmamış. Tek bir oturumda
        normal olabilir; burada çıkarıcının durmuş olması daha muhtemel.
      </Message>

      <section v-if="consents.length" class="consents">
        <h3>Onaylar</h3>
        <div v-for="item in consents" :key="item.consentKey" class="consents__row">
          <strong>{{ item.consentKey }}</strong>
          <Tag
            :severity="consentState(item.textVersion, item.revokedAt).severity"
            :value="consentState(item.textVersion, item.revokedAt).label"
          />
          <span>{{ item.textVersion }} · {{ ago(item.acceptedAt) }}</span>
        </div>
      </section>
      <Message v-else severity="secondary" :closable="false">
        Hiç onay kaydı yok. Destek sohbeti bu kişide hiç açılmamış demektir; "sohbet
        açılmıyor" şikâyetinin ilk bakılacak yeri burası.
      </Message>

      <section v-if="hasProfile" class="profile">
        <h3>Ürün profili</h3>
        <p class="profile__note">
          Damıtıcının uygulama için ürettiği görüş. Asistanların okuduğu sayfadan ayrı:
          buradaki her alan kodun dallanabileceği bir şey. Ton, bildirim metnini seçiyor;
          saat, kendi saatini seçmemiş kişide hatırlatmanın ne zaman gideceğini belirliyor.
        </p>
        <dl>
          <template v-if="profile.motivationTone">
            <dt>Ton</dt><dd>{{ TONES[profile.motivationTone] ?? profile.motivationTone }}</dd>
          </template>
          <template v-if="profile.logsAround">
            <dt>Kayıt saati</dt><dd>{{ profile.logsAround }}</dd>
          </template>
          <template v-if="profile.skippedMeal">
            <dt>Atlanan öğün</dt><dd>{{ profile.skippedMeal }}</dd>
          </template>
          <template v-if="profile.driftRisk">
            <dt>Uzaklaşma</dt>
            <dd>
              <Tag
                v-if="RISKS[profile.driftRisk]"
                :severity="RISKS[profile.driftRisk].severity"
                :value="RISKS[profile.driftRisk].label"
              />
              <span v-else>{{ profile.driftRisk }}</span>
            </dd>
          </template>
          <template v-if="profile.nudge">
            <dt>Öneri</dt>
            <dd>
              {{ profile.nudge }}
              <small>Bu cümle kullanıcıya GİTMİYOR; bildirim metinleri panelde yazılıyor.</small>
            </dd>
          </template>
        </dl>
      </section>

      <section class="sessions">
        <h3>Oturumlar</h3>
        <DataTable
          v-if="sessions.length"
          :value="sessions" :data-key="'sessionId'" size="small" striped-rows
          :row-key="rowKey"
        >
          <Column header="Asistan">
            <template #body="{ data: row }">{{ assistant(row.assistant) }}</template>
          </Column>
          <Column header="Son tur">
            <template #body="{ data: row }">{{ dateTime(row.lastTurnAt) }}</template>
          </Column>
          <Column header="Tur">
            <template #body="{ data: row }">{{ nf.format(row.turns) }}</template>
          </Column>
          <Column header="Yarım">
            <template #body="{ data: row }">
              <Tag v-if="row.partialTurns" severity="warn" :value="String(row.partialTurns)" />
              <span v-else>—</span>
            </template>
          </Column>
          <Column header="Karakter">
            <template #body="{ data: row }">{{ nf.format(row.chars) }}</template>
          </Column>
          <Column header="Hafıza adayı">
            <template #body="{ data: row }">{{ nf.format(row.candidates) }}</template>
          </Column>
        </DataTable>
        <Message v-else severity="secondary" :closable="false">
          Bu kişinin hiç sohbet oturumu yok.
        </Message>
      </section>

      <p class="privacy">
        Bu ekranda yazışma metni yok. Onay ekranı sohbetin cihaz değiştirince kaybolmaması
        için saklandığını söylüyor, ekibin okuyabileceğini söylemiyor. Bir gün gerekirse
        yolu yeni bir onay sürümünden geçer.
      </p>
    </template>
  </div>
</template>

<style scoped>
.chat-tab { display: flex; flex-direction: column; gap: 1.25rem; }

h3 { margin: 0 0 .6rem; font-size: .95rem; }

.totals { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: .75rem; }
.totals__item {
  display: flex; flex-direction: column; gap: .2rem;
  padding: .7rem .9rem;
  border: 1px solid var(--p-content-border-color); border-radius: .6rem;
}
.totals__item small { color: var(--p-text-muted-color); font-size: .78rem; }
.totals__item strong { font-size: 1.05rem; font-variant-numeric: tabular-nums; }
.totals__item--warn { border-color: var(--p-orange-400); }

.consents__row { display: flex; flex-wrap: wrap; align-items: center; gap: .6rem; padding: .3rem 0; }
.consents__row span { color: var(--p-text-muted-color); font-size: .82rem; }

.profile__note { margin: 0 0 .7rem; color: var(--p-text-muted-color); font-size: .85rem; line-height: 1.6; }
.profile dl { display: grid; grid-template-columns: auto 1fr; gap: .45rem 1rem; margin: 0; }
.profile dt { color: var(--p-text-muted-color); font-size: .85rem; }
.profile dd { margin: 0; }
.profile dd small { display: block; margin-top: .2rem; color: var(--p-text-muted-color); font-size: .78rem; }

.privacy {
  margin: 0; padding-top: .8rem;
  border-top: 1px solid var(--p-content-border-color);
  color: var(--p-text-muted-color); font-size: .82rem; line-height: 1.6;
}
</style>
