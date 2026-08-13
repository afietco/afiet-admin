<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import PageHeader from '../components/PageHeader.vue'
import EmptyState from '../components/EmptyState.vue'
import QuestPreview from './QuestPreview.vue'
import QuestTierPanel from './quests/QuestTierPanel.vue'
import { adminApi, type Quest, type QuestInput } from '../services/admin'
import { questTargetLabel } from '../services/questActions'
import {
  TIER_META, TIER_ORDER, countLabel, percent, pouchLabel, tierLadder,
} from './quests/questTiers'

const toast = useToast()
const confirm = useConfirm()
const rows = ref<Quest[]>([])
// Populated from the API so the form can never drift from the quest_metric enum.
const metrics = ref<string[]>([])
const scopes = ref<string[]>([])
const actionTargets = ref<string[]>([])
const loading = ref(false)
const dialogOpen = ref(false)
const saving = ref(false)
const editing = ref<Quest | null>(null)
const submitted = ref(false)
const metricFilter = ref('')
const statusFilter = ref('')

const METRIC_LABELS: Record<string, string> = {
  afiyet_day: 'Afiyet günü',
  afiyet_week: 'Afiyet haftası',
  meal_entry: 'Öğün kaydı',
  water_goal: 'Su hedefi',
  measurement: 'Ölçüm',
  rainbow_week: 'Gökkuşağı haftası',
  custom: 'Elle',
  distinct_food: 'Farklı besin',
  distinct_group: 'Farklı besin grubu',
  custom_food: "Menüm'e eklenen yemek",
  group_join: 'Gruba katılma',
  greeting: 'Afiyet selamı',
}
// Metrics with no counter behind them: store.QuestMetrics.value() returns 0, so
// a quest using one never progresses and can never be claimed.
const INERT_METRICS = new Set(['rainbow_week', 'custom'])
const SCOPE_LABELS: Record<string, string> = {
  lifetime: 'Tüm zamanlar',
  weekly: 'Haftalık',
  monthly: 'Aylık',
}

const metricLabel = (value: string) => METRIC_LABELS[value] ?? value
const scopeLabel = (value: string) => SCOPE_LABELS[value] ?? value
const metricOptions = computed(() =>
  metrics.value.map((value) => ({
    value,
    label: INERT_METRICS.has(value) ? `${metricLabel(value)} (ilerlemez)` : metricLabel(value),
  })),
)
const scopeOptions = computed(() => scopes.value.map((value) => ({ value, label: scopeLabel(value) })))
const metricFilterOptions = computed(() => [
  { value: '', label: 'Tüm metrikler' },
  ...metrics.value.map((value) => ({ value, label: metricLabel(value) })),
])
const statusOptions = [
  { value: '', label: 'Tüm durumlar' },
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Pasif' },
]

const visibleRows = computed(() =>
  rows.value.filter((quest) => {
    if (metricFilter.value && quest.metric !== metricFilter.value) return false
    if (statusFilter.value === 'active' && !quest.active) return false
    if (statusFilter.value === 'inactive' && quest.active) return false
    return true
  }),
)
const activeCount = computed(() => rows.value.filter((quest) => quest.active).length)
const inertCount = computed(() =>
  rows.value.filter((quest) => quest.active && INERT_METRICS.has(quest.metric)).length,
)

/**
 * Hedef listesi sunucudan gelir (metrik listesiyle aynı sebep: form, uygulamanın
 * tanıdığı kümeden ayrışamasın). Etiketleri questActions.ts taşır; sunucunun
 * gönderdiği ama panelin tanımadığı bir jeton olursa jetonun kendisi yazılır.
 */
const targetOptions = computed(() => [
  { value: '', label: 'Metrik ailesinin varsayılanı' },
  ...actionTargets.value.map((value) => ({ value, label: questTargetLabel(value) })),
])

/* ── Kademeler ─────────────────────────────────────────────────────────────
 * Merdiven ve huni 13 Ağu 2026'dan beri uçtan geliyor (quest.tiers /
 * quest.reach). Panelin eski yerel üreticisi silindi.
 *
 * `reach` null olabilir ve bu "kimse erişmedi" DEĞİL, "hesaplanamadı"
 * demektir; sayı isteyen her yer bunu ayrı ele alır.
 */
const expandedRows = ref<Record<string, boolean>>({})
/** Üç kademenin eşikleri, satırda tek bakışta okunacak kısalıkta. */
function tierTargets(quest: Quest) {
  return quest.tiers.map((tier) => tier.target)
}
/** İlk kademenin istatistiği; huni yoksa null ve satır "ölçüm yok" der. */
function firstTierStats(quest: Quest) {
  return quest.reach?.tiers[0]?.stats ?? null
}
/**
 * Usta kademesini tamamlayanın tüm havuza oranı: görevin gerçek zirvesi.
 * Huni yoksa null döner ve satır sayı yerine tire gösterir.
 */
function topShare(quest: Quest): number | null {
  const reach = quest.reach
  if (!reach || reach.tiers.length === 0 || reach.audience <= 0) return null
  const top = reach.tiers[reach.tiers.length - 1]
  return top.stats.completedUsers / reach.audience
}
const expandAll = () => {
  expandedRows.value = Object.fromEntries(visibleRows.value.map((quest) => [quest.id, true]))
}
const collapseAll = () => {
  expandedRows.value = {}
}
const expandedCount = computed(() => Object.keys(expandedRows.value).length)
/** Sıradaki kademenin adı; satırdaki eşik rozetleri için. */
const tierNameAt = (index: number) => TIER_META[TIER_ORDER[index]].label

const emptyForm = (): QuestInput => ({
  key: '',
  title: '',
  detail: '',
  narration: '',
  actionLabel: '',
  actionTarget: '',
  emoji: '🌱',
  metric: '',
  scope: 'lifetime',
  target: 1,
  xpReward: 10,
  active: true,
  sortOrder: 0,
  tiers: [],
})
const form = reactive<QuestInput>(emptyForm())
/**
 * Diyalogdaki merdiven: tek eşikten türetilir ve KAYDEDİLEN de budur.
 *
 * Panelde kademe kademe düzenleyen bir alan yok; form tek eşiği alıyor ve
 * merdiven ondan açılıyor. Bu yüzden kaydederken türetileni AÇIKÇA
 * gönderiyoruz: sunucu boş `tiers`i "merdivene dokunma" diye okur ve hedefi
 * değiştiren bir düzenleme uygulamada hiçbir şeyi oynatmazdı, çünkü uygulama
 * artık kök hedefi değil kademeleri okuyor.
 *
 * Sonucu: elle ayarlanmış bir merdiven (API'den yazılmış) panelden yapılan
 * her kayıtta türetilene döner. Kademe kademe düzenleme geldiğinde burası da
 * değişir; o güne kadar davranış öngörülebilir olsun diye açık.
 */
const formLadder = computed(() => tierLadder(form.target, form.xpReward))
const title = computed(() => (editing.value ? 'Görevi düzenle' : 'Yeni görev'))
const keyInvalid = computed(() => !/^[a-z0-9_-]{3,40}$/.test(form.key))
const formInert = computed(() => INERT_METRICS.has(form.metric))

async function load() {
  loading.value = true
  try {
    const result = await adminApi.quests()
    rows.value = result.quests
    metrics.value = result.metrics
    scopes.value = result.scopes
    actionTargets.value = result.actionTargets ?? []
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Görevler alınamadı',
      detail: err instanceof Error ? err.message : '',
      life: 4000,
    })
  } finally {
    loading.value = false
  }
}

function createQuest() {
  Object.assign(form, emptyForm())
  // Continue the tens-based ordering the seeded set uses.
  form.sortOrder = rows.value.reduce((max, quest) => Math.max(max, quest.sortOrder), 0) + 10
  editing.value = null
  submitted.value = false
  dialogOpen.value = true
}

function editQuest(quest: Quest) {
  editing.value = quest
  Object.assign(form, {
    key: quest.key,
    title: quest.title,
    detail: quest.detail,
    narration: quest.narration,
    actionLabel: quest.actionLabel,
    actionTarget: quest.actionTarget,
    emoji: quest.emoji,
    metric: quest.metric,
    scope: quest.scope,
    target: quest.target,
    xpReward: quest.xpReward,
    active: quest.active,
    sortOrder: quest.sortOrder,
    tiers: [],
  })
  submitted.value = false
  dialogOpen.value = true
}

function valid() {
  if (!form.title.trim() || form.title.length > 80) return false
  if (form.detail.length > 200) return false
  if (form.narration.length > 600) return false
  if (!form.metric) return false
  if (form.actionLabel && form.actionLabel.length > 32) return false
  // Etiket ile hedef birlikte anlam taşır: yalnız biri yazılmış bir aksiyon
  // uygulamada ya etiketsiz bir düğme ya da hiçbir yere gitmeyen bir düğme olur.
  if (Boolean(form.actionLabel?.trim()) !== Boolean(form.actionTarget)) return false
  if (!editing.value && keyInvalid.value) return false
  return true
}

const actionHalfFilled = computed(() =>
  Boolean(form.actionLabel?.trim()) !== Boolean(form.actionTarget))

async function save() {
  submitted.value = true
  if (!valid()) return
  saving.value = true
  try {
    // Merdiven her kayıtta açıkça gider; gerekçe formLadder'ın başında.
    const payload: QuestInput = { ...form, tiers: formLadder.value }
    if (editing.value) await adminApi.updateQuest(editing.value.id, payload)
    else await adminApi.addQuest(payload)
    toast.add({
      severity: 'success',
      summary: editing.value ? 'Görev güncellendi' : 'Görev eklendi',
      life: 2500,
    })
    dialogOpen.value = false
    await load()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Kaydedilemedi',
      detail: err instanceof Error ? err.message : '',
      life: 4000,
    })
  } finally {
    saving.value = false
  }
}

async function toggleActive(quest: Quest) {
  try {
    await adminApi.updateQuest(quest.id, { ...quest, active: !quest.active })
    toast.add({
      severity: 'success',
      summary: quest.active ? 'Görev pasife alındı' : 'Görev aktif edildi',
      life: 2000,
    })
    await load()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Durum değiştirilemedi',
      detail: err instanceof Error ? err.message : '',
      life: 4000,
    })
  }
}

function remove(quest: Quest) {
  confirm.require({
    header: 'Görevi sil',
    message: `"${quest.title}" kalıcı olarak silinsin mi? Bu görevi almış kullanıcıların kazandığı tecrübe geri alınmaz. Görevi listeden kaldırmak için silmek yerine pasife almayı düşün.`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Vazgeç',
    acceptLabel: 'Sil',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await adminApi.deleteQuest(quest.id)
        toast.add({ severity: 'success', summary: 'Görev silindi', life: 2500 })
        await load()
      } catch (err) {
        toast.add({
          severity: 'error',
          summary: 'Silinemedi',
          detail: err instanceof Error ? err.message : '',
          life: 4000,
        })
      }
    },
  })
}

onMounted(load)
</script>

<template>
  <div class="page-wrap">
    <PageHeader
      eyebrow="OYUNLAŞTIRMA"
      title="Görevler"
      description="Görevlerim listesinin içeriğini yönet. İlerleme sunucuda kullanıcı davranışından türetilir; panel yalnız görev tanımlarını yazar, tecrübe defterine dokunmaz."
    >
      <Button label="Yeni görev" icon="pi pi-plus" @click="createQuest" />
    </PageHeader>

    <Message v-if="inertCount > 0" severity="warn" :closable="false">
      {{ inertCount }} aktif görev, ilerleme kaynağı olmayan bir metrik kullanıyor
      (Gökkuşağı haftası / Elle). Bu görevler kullanıcıda hiç ilerlemez ve alınamaz.
    </Message>

    <section class="table-card">
      <div class="table-toolbar">
        <Select
          v-model="metricFilter"
          :options="metricFilterOptions"
          option-label="label"
          option-value="value"
          placeholder="Tüm metrikler"
        />
        <Select
          v-model="statusFilter"
          :options="statusOptions"
          option-label="label"
          option-value="value"
          placeholder="Tüm durumlar"
        />
        <Button
          :label="expandedCount > 0 ? 'Kademeleri kapat' : 'Kademeleri aç'"
          :icon="expandedCount > 0 ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
          size="small"
          severity="secondary"
          outlined
          @click="expandedCount > 0 ? collapseAll() : expandAll()"
        />
        <span class="result-count">{{ visibleRows.length }} / {{ rows.length }} görev · {{ activeCount }} aktif</span>
      </div>

      <DataTable
        v-model:expanded-rows="expandedRows"
        :value="visibleRows"
        :loading="loading"
        data-key="id"
        striped-rows
        scrollable
        sort-field="sortOrder"
        :sort-order="1"
      >
        <template #empty>
          <EmptyState
            icon="pi pi-sparkles"
            title="Görev bulunamadı"
            description="Filtreleri temizle veya listeye yeni bir görev ekle."
          />
        </template>

        <template #expansion="{ data }">
          <QuestTierPanel :quest="data" :metric-label="metricLabel(data.metric)" />
        </template>

        <Column expander style="width: 3.25rem" />
        <Column field="sortOrder" header="Sıra" sortable style="width: 5rem" />
        <Column header="Görev" style="min-width: 17rem">
          <template #body="{ data }">
            <div class="food-cell">
              <span class="quest-glyph">{{ data.emoji }}</span>
              <div>
                <strong>{{ data.title }}</strong>
                <small>{{ data.detail || data.key }}</small>
              </div>
            </div>
          </template>
        </Column>
        <Column header="Metrik" style="min-width: 10.5rem">
          <template #body="{ data }">
            <Tag
              :value="metricLabel(data.metric)"
              :severity="INERT_METRICS.has(data.metric) ? 'warn' : 'secondary'"
            />
          </template>
        </Column>
        <Column header="Kademe eşikleri" style="min-width: 9.5rem">
          <template #body="{ data }">
            <div class="ladder-cell">
              <span
                v-for="(value, index) in tierTargets(data)"
                :key="index"
                class="ladder-step"
                :class="`s${index}`"
                :title="tierNameAt(index)"
              >{{ value }}</span>
            </div>
            <small class="ladder-note">çırak · kalfa · usta</small>
          </template>
        </Column>
        <Column header="Ödül merdiveni" style="min-width: 10rem">
          <template #body="{ data }">
            <div class="reward-cell">
              <span class="measure-pill xp">
                {{ data.tiers[0].xpReward }} → {{ data.tiers[2].xpReward }} XP
              </span>
              <span class="measure-pill pouch">
                <i class="pi pi-comments" />
                {{ data.tiers[0].pouchReward }} → {{ pouchLabel(data.tiers[2].pouchReward) }}
              </span>
            </div>
          </template>
        </Column>
        <Column header="Erişim" style="min-width: 9rem">
          <template #body="{ data }">
            <div v-if="firstTierStats(data)" class="rate-cell">
              <strong>{{ percent(firstTierStats(data)!.reachedShare) }}</strong>
              <div class="rate-track">
                <div
                  class="rate-fill"
                  :style="{ width: `${Math.round(firstTierStats(data)!.reachedShare * 100)}%` }"
                />
              </div>
              <small>{{ countLabel(firstTierStats(data)!.reachedUsers) }} kişi başladı</small>
            </div>
            <span v-else class="rate-none">ölçüm yok</span>
          </template>
        </Column>
        <Column header="Tamamlama" style="min-width: 9rem">
          <template #body="{ data }">
            <div v-if="firstTierStats(data)" class="rate-cell">
              <strong>{{ percent(firstTierStats(data)!.completionRate) }}</strong>
              <div class="rate-track">
                <div
                  class="rate-fill"
                  :style="{ width: `${Math.round(firstTierStats(data)!.completionRate * 100)}%` }"
                />
              </div>
              <small>
                çırak · ustaya varan
                <template v-if="topShare(data) !== null">{{ percent(topShare(data)!) }}</template>
                <template v-else>—</template>
              </small>
            </div>
            <span v-else class="rate-none">ölçüm yok</span>
          </template>
        </Column>
        <Column header="Durum" style="width: 7rem">
          <template #body="{ data }">
            <Tag
              :value="data.active ? 'Aktif' : 'Pasif'"
              :severity="data.active ? 'success' : 'secondary'"
            />
          </template>
        </Column>
        <Column header="" frozen align-frozen="right" style="width: 9rem">
          <template #body="{ data }">
            <div class="row-actions">
              <Button
                :icon="data.active ? 'pi pi-eye-slash' : 'pi pi-eye'"
                text
                rounded
                severity="secondary"
                :aria-label="data.active ? 'Pasife al' : 'Aktif et'"
                @click="toggleActive(data)"
              />
              <Button icon="pi pi-pencil" text rounded aria-label="Düzenle" @click="editQuest(data)" />
              <Button
                icon="pi pi-trash"
                text
                rounded
                severity="danger"
                aria-label="Sil"
                @click="remove(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </section>

    <Dialog
      v-model:visible="dialogOpen"
      modal
      :header="title"
      class="quest-dialog"
      :style="{ width: '58rem' }"
      :content-style="{ maxHeight: '68vh', overflowY: 'auto' }"
    >
      <div class="quest-dialog-body">
      <div class="form-grid">
        <div class="form-field span-2">
          <label for="quest-title">Başlık *</label>
          <InputText
            id="quest-title"
            v-model="form.title"
            fluid
            :maxlength="80"
            :invalid="submitted && !form.title.trim()"
          />
          <small v-if="submitted && !form.title.trim()" class="field-error">Başlık gerekli.</small>
        </div>

        <div class="form-field span-2">
          <label for="quest-detail">Açıklama</label>
          <Textarea id="quest-detail" v-model="form.detail" rows="3" fluid auto-resize :maxlength="200" />
          <small>{{ form.detail.length }} / 200</small>
        </div>

        <div class="form-field span-2">
          <label for="quest-narration">Afi'nin anlatımı</label>
          <Textarea
            id="quest-narration"
            v-model="form.narration"
            rows="5"
            fluid
            auto-resize
            :maxlength="600"
          />
          <small>
            {{ form.narration.length }} / 600. Uygulamada göreve dokunulunca Afi'nin
            söylediği metin; boş bırakılırsa açıklama gösterilir.
          </small>
        </div>

        <div class="section-rule span-4"><span>EYLEM DÜĞMESİ</span></div>

        <div class="form-field span-2">
          <label for="quest-action-label">Düğme metni</label>
          <InputText
            id="quest-action-label"
            v-model="form.actionLabel"
            fluid
            :maxlength="32"
            placeholder="Öğün ekle"
            :invalid="submitted && actionHalfFilled"
          />
          <small>
            İşin kendi fiili olsun: "Başla" değil "Öğün ekle". Boş bırakılırsa metrik
            ailesinin varsayılanı kullanılır.
          </small>
        </div>

        <div class="form-field span-2">
          <label>Gideceği ekran</label>
          <Select
            v-model="form.actionTarget"
            :options="targetOptions"
            option-label="label"
            option-value="value"
            fluid
            placeholder="Metrik ailesinin varsayılanı"
            :invalid="submitted && actionHalfFilled"
          />
          <small v-if="submitted && actionHalfFilled" class="field-error">
            Metin ve ekran birlikte doldurulmalı; yalnız biri yazılırsa düğme ya adsız ya da hedefsiz kalır.
          </small>
          <small v-else>
            Serbest rota yazılmaz: hedefler uygulamanın tanıdığı ekranlardır, bir ekran taşındığında
            bağ kopmaz.
          </small>
        </div>


        <div class="form-field">
          <label for="quest-emoji">Emoji</label>
          <InputText id="quest-emoji" v-model="form.emoji" fluid placeholder="🌱" />
        </div>
        <div class="form-field">
          <label for="quest-order">Sıra</label>
          <InputNumber id="quest-order" v-model="form.sortOrder" :min="0" fluid />
        </div>

        <div class="form-field span-2">
          <label for="quest-key">Kalıcı anahtar (key) *</label>
          <InputText
            id="quest-key"
            v-model="form.key"
            fluid
            :disabled="Boolean(editing)"
            placeholder="ornek-gorev-anahtari"
            :invalid="submitted && !editing && keyInvalid"
          />
          <small v-if="editing">Anahtar değiştirilemez; kullanıcı ilerlemesi buna bağlı.</small>
          <small v-else-if="submitted && keyInvalid" class="field-error">
            3-40 karakter; küçük harf, rakam, tire, alt çizgi.
          </small>
          <small v-else>Sonradan değiştirilemez. Küçük harf, rakam, tire, alt çizgi.</small>
        </div>

        <div class="form-field">
          <label>İlerleme metriği *</label>
          <Select
            v-model="form.metric"
            :options="metricOptions"
            option-label="label"
            option-value="value"
            fluid
            :disabled="Boolean(editing)"
            :invalid="submitted && !form.metric"
          />
          <small v-if="editing">
            Metrik değiştirilemez; mevcut kullanıcı ilerlemesi bu sayaca göre yorumlanır.
          </small>
        </div>
        <div class="form-field">
          <label>Kapsam</label>
          <Select
            v-model="form.scope"
            :options="scopeOptions"
            option-label="label"
            option-value="value"
            fluid
            :disabled="Boolean(editing)"
          />
          <small>Şu an ilerleme hesabını etkilemiyor; tüm görevler tüm zamanlar gibi sayılır.</small>
        </div>

        <div class="form-field">
          <label for="quest-target">Hedef *</label>
          <InputNumber id="quest-target" v-model="form.target" :min="1" fluid />
          <small>Çırak kademesinin eşiği; üst iki kademe bundan türetilir.</small>
        </div>
        <div class="form-field">
          <label for="quest-xp">Tecrübe ödülü</label>
          <InputNumber id="quest-xp" v-model="form.xpReward" :min="0" suffix=" XP" fluid />
          <small>Çırak kademesinin ödülü.</small>
        </div>

        <div class="section-rule span-4">
          <span>KADEME MERDİVENİ</span>
          <em>öneri · kaydedilmiyor</em>
        </div>

        <div class="ladder-strip span-4">
          <div v-for="(tier, index) in formLadder" :key="tier.key" class="ladder-card">
            <span class="ladder-glyph">{{ TIER_META[tier.key].glyph }}</span>
            <div>
              <strong>{{ TIER_META[tier.key].label }}</strong>
              <small>{{ tier.target }} {{ form.metric ? metricLabel(form.metric) : 'hedef' }}</small>
            </div>
            <div class="ladder-rewards">
              <span class="measure-pill xp">+{{ tier.xpReward }} XP</span>
              <span class="measure-pill pouch">
                <i class="pi pi-comments" />{{ pouchLabel(tier.pouchReward) }}
              </span>
            </div>
            <i v-if="index < 2" class="pi pi-angle-right ladder-arrow" />
          </div>
        </div>
        <p class="ladder-caption span-4">
          Üç kademe aynı metriği sayar, yalnız eşik büyür. Eşikler bugün yukarıdaki tek
          hedeften hesaplanıyor ve kaydedilmiyor: sunucu kademe alanlarını dönmeye
          başlayana kadar bu bölüm salt okunur bir öneridir. İkram kesesi ödülü sohbet
          hakkı adedidir, para değil.
        </p>

        <Message v-if="formInert" severity="warn" :closable="false" class="span-2">
          Bu metriğin arkasında bir sayaç yok: görev kullanıcıda hiç ilerlemez ve alınamaz.
        </Message>

        <label class="switch-row span-2">
          <div>
            <strong>Listede aktif</strong>
            <small>Pasif görevler Görevlerim listesinde görünmez; alınmış tecrübe korunur.</small>
          </div>
          <ToggleSwitch v-model="form.active" />
        </label>
      </div>

      <aside class="quest-dialog-side">
        <p class="preview-label">UYGULAMADA</p>
        <QuestPreview :form="form" />
      </aside>
      </div>

      <template #footer>
        <Button label="Vazgeç" severity="secondary" text @click="dialogOpen = false" />
        <Button
          :label="editing ? 'Değişiklikleri kaydet' : 'Görevi ekle'"
          icon="pi pi-check"
          :loading="saving"
          @click="save"
        />
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
/* Mirrors .food-glyph's shape, but sized for an emoji rather than a letter. */
.quest-glyph {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border-radius: 11px 11px 11px 3px;
  background: #dff0e7;
  font-size: 17px;
  line-height: 1;
}

/* ── Kademe hücreleri (liste) ───────────────────────────────────────────── */
/* Üç eşik yan yana: merdiven hissi renk koyulaşmasından gelir, ok ya da
   "1-2-3" etiketinden değil; satır dar ve sayılar okunur kalsın. */
.ladder-cell { display: flex; align-items: center; gap: 5px; }
.ladder-step {
  min-width: 30px; padding: 3px 7px;
  border-radius: 8px; text-align: center;
  font-size: 11px; font-weight: 900; font-variant-numeric: tabular-nums;
}
.ladder-step.s0 { color: #4b6f5c; background: #eef6f1; }
.ladder-step.s1 { color: #2f6b4f; background: #dcefe4; }
.ladder-step.s2 { color: #10503a; background: #c6e5d4; }
.ladder-note { display: block; margin-top: 5px; color: #a3a59c; font-size: 8.5px; font-weight: 700; }

.reward-cell { display: grid; gap: 5px; justify-items: start; }
.reward-cell .measure-pill, .ladder-rewards .measure-pill {
  display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;
}
.measure-pill.xp { color: #2f6b4f; border-color: #cfe6da; background: #f1f9f4; }
.measure-pill.pouch { color: #7a5a1f; border-color: #ecdcbb; background: #fdf6e8; }
.measure-pill.pouch i { font-size: 10px; }

.rate-none { color: #a6a9a0; font-size: 10.5px; font-weight: 700; }
.rate-cell { display: grid; gap: 4px; }
.rate-cell strong { color: #333831; font-size: 13px; font-variant-numeric: tabular-nums; }
.rate-cell small { color: #9a9c94; font-size: 8.5px; font-weight: 700; }
.rate-track { height: 6px; border-radius: 999px; background: #eef2ec; overflow: hidden; }
.rate-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, #34d399, #059669); }

/* ── Diyalogdaki merdiven önizlemesi ────────────────────────────────────── */
.ladder-strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.ladder-card {
  position: relative;
  display: grid; gap: 9px; align-content: start;
  padding: 13px 14px;
  border: 1px solid var(--line); border-radius: 14px; background: #fbfaf5;
}
.ladder-card:nth-child(3) { background: #f6faf6; }
.ladder-glyph {
  width: 28px; height: 28px; display: grid; place-items: center;
  border-radius: 9px 9px 9px 3px; background: #dff0e7; font-size: 14px; line-height: 1;
}
.ladder-card strong { display: block; color: #2f342e; font-size: 12px; }
.ladder-card small { display: block; margin-top: 3px; color: #8d9087; font-size: 9.5px; font-weight: 700; }
.ladder-rewards { display: flex; flex-wrap: wrap; gap: 5px; }
.ladder-arrow {
  position: absolute; right: -12px; top: 50%; transform: translateY(-50%);
  z-index: 1; color: #c5c8bf; font-size: 13px;
}
.ladder-caption { margin: -4px 0 0; color: #8a8d84; font-size: 10px; line-height: 1.65; }

@media (max-width: 900px) {
  .ladder-strip { grid-template-columns: 1fr; }
  .ladder-arrow { display: none; }
}
</style>
