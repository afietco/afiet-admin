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
import { adminApi, type Quest, type QuestInput } from '../services/admin'

const toast = useToast()
const confirm = useConfirm()
const rows = ref<Quest[]>([])
// Populated from the API so the form can never drift from the quest_metric enum.
const metrics = ref<string[]>([])
const scopes = ref<string[]>([])
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

const emptyForm = (): QuestInput => ({
  key: '',
  title: '',
  detail: '',
  narration: '',
  emoji: '🌱',
  metric: '',
  scope: 'lifetime',
  target: 1,
  xpReward: 10,
  active: true,
  sortOrder: 0,
})
const form = reactive<QuestInput>(emptyForm())
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
    emoji: quest.emoji,
    metric: quest.metric,
    scope: quest.scope,
    target: quest.target,
    xpReward: quest.xpReward,
    active: quest.active,
    sortOrder: quest.sortOrder,
  })
  submitted.value = false
  dialogOpen.value = true
}

function valid() {
  if (!form.title.trim() || form.title.length > 80) return false
  if (form.detail.length > 200) return false
  if (form.narration.length > 600) return false
  if (!form.metric) return false
  if (!editing.value && keyInvalid.value) return false
  return true
}

async function save() {
  submitted.value = true
  if (!valid()) return
  saving.value = true
  try {
    if (editing.value) await adminApi.updateQuest(editing.value.id, form)
    else await adminApi.addQuest(form)
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
      description="Görevlerim listesinin içeriğini yönet. İlerleme sunucuda kullanıcı davranışından türetilir — panel yalnız görev tanımlarını yazar, tecrübe defterine dokunmaz."
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
        />
        <Select
          v-model="statusFilter"
          :options="statusOptions"
          option-label="label"
          option-value="value"
        />
        <span class="result-count">{{ visibleRows.length }} / {{ rows.length }} görev · {{ activeCount }} aktif</span>
      </div>

      <DataTable
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

        <Column field="sortOrder" header="Sıra" sortable style="width: 5rem" />
        <Column header="Görev" style="min-width: 20rem">
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
        <Column header="Metrik" style="min-width: 12rem">
          <template #body="{ data }">
            <Tag
              :value="metricLabel(data.metric)"
              :severity="INERT_METRICS.has(data.metric) ? 'warn' : 'secondary'"
            />
          </template>
        </Column>
        <Column header="Hedef" style="width: 7rem">
          <template #body="{ data }"><strong>{{ data.target }}</strong></template>
        </Column>
        <Column header="Tecrübe" style="width: 8rem">
          <template #body="{ data }"><span class="measure-pill">+{{ data.xpReward }} XP</span></template>
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

    <Dialog v-model:visible="dialogOpen" modal :header="title" :style="{ width: '44rem' }">
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
          <small v-if="editing">Anahtar değiştirilemez — kullanıcı ilerlemesi buna bağlı.</small>
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
            Metrik değiştirilemez — mevcut kullanıcı ilerlemesi bu sayaca göre yorumlanır.
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
        </div>
        <div class="form-field">
          <label for="quest-xp">Tecrübe ödülü</label>
          <InputNumber id="quest-xp" v-model="form.xpReward" :min="0" suffix=" XP" fluid />
        </div>

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
</style>
