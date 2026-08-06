<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AutoComplete from 'primevue/autocomplete'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import QualityFindings from './QualityFindings.vue'
import {
  CANDIDATE_STATUS_LABELS, catalogNeighbors, type CustomFoodCandidate, type DecisionInput,
} from '../../services/foodCuration'
import { AbortedError, emptyFilters, foodsApi, type Food } from '../../services/foods'
import { decimal, label, measureLabel, number } from '../../services/foodLabels'
import { runFoodChecks, type CatalogNeighbor, type QualityReport } from '../../services/foodQuality'

const props = defineProps<{ candidate: CustomFoodCandidate | null; busy: boolean }>()
const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{
  (e: 'promote', candidate: CustomFoodCandidate): void
  (e: 'decide', input: DecisionInput): void
  (e: 'undo'): void
}>()

const neighbors = ref<CatalogNeighbor[]>([])
const neighborsLoaded = ref(false)
const neighborError = ref('')

const note = ref('')
const mergeTarget = ref<Food | null>(null)
const mergeSuggestions = ref<Food[]>([])
const rejecting = ref(false)
const merging = ref(false)

const status = computed(() => props.candidate?.decision?.status ?? 'bekliyor')

/**
 * Adayı kalite motorunun anladığı taslağa çevirir. Kullanıcı besinlerinde
 * gramaj, lif, diyet etiketi ve öğün yakıştırması YOK; o alanlar bilerek
 * `undefined` bırakılır, böylece ilgili kurallar yanlış tetiklenmek yerine
 * "değerlendirilemedi" listesine düşer ve kataloğa alma formunda koşar.
 */
const report = computed<QualityReport | null>(() => {
  const candidate = props.candidate
  if (!candidate) return null
  return runFoodChecks({
    name: candidate.name,
    groups: candidate.groups,
    measure: candidate.measure ?? undefined,
    macros: candidate.macros
      ? {
        kcal: candidate.macros.kcal.median,
        protein: candidate.macros.protein.median,
        carb: candidate.macros.carb.median,
        fat: candidate.macros.fat.median,
      }
      : null,
  }, { neighbors: neighbors.value, neighborsLoaded: neighborsLoaded.value })
})

const macroRows = computed(() => {
  const macros = props.candidate?.macros
  if (!macros) return []
  return [
    { key: 'kcal', text: 'Enerji', unit: 'kcal', stat: macros.kcal },
    { key: 'protein', text: 'Protein', unit: 'g', stat: macros.protein },
    { key: 'carb', text: 'Karbonhidrat', unit: 'g', stat: macros.carb },
    { key: 'fat', text: 'Yağ', unit: 'g', stat: macros.fat },
  ]
})

const matchKindLabels: Record<string, string> = {
  ad: 'Aynı ad',
  takma_ad: 'Takma ad',
  benzer: 'Benzer ad',
}

const dateText = (value: string) => new Date(value).toLocaleDateString('tr-TR')

let neighborRequest: AbortController | null = null

watch([visible, () => props.candidate?.key], async ([open]) => {
  if (!open || !props.candidate) return
  note.value = ''
  mergeTarget.value = null
  rejecting.value = false
  merging.value = false
  neighbors.value = []
  neighborsLoaded.value = false
  neighborError.value = ''

  neighborRequest?.abort()
  const controller = new AbortController()
  neighborRequest = controller
  try {
    const found = await catalogNeighbors(props.candidate.name, controller.signal)
    if (controller.signal.aborted) return
    neighbors.value = found
    neighborsLoaded.value = true
  } catch (err) {
    if (err instanceof AbortedError) return
    neighborError.value = err instanceof Error ? err.message : 'Katalog araması yapılamadı.'
  }
})

async function searchCatalog(event: { query: string }) {
  try {
    const page = await foodsApi.list({ ...emptyFilters(), query: event.query.trim() }, 1, 20)
    mergeSuggestions.value = page.items
  } catch {
    mergeSuggestions.value = []
  }
}

function promote() {
  if (props.candidate) emit('promote', props.candidate)
}

function reject() {
  emit('decide', { action: 'reddet', note: note.value.trim() })
}

function merge() {
  if (!mergeTarget.value) return
  emit('decide', { action: 'birlestir', foodId: mergeTarget.value.id, note: note.value.trim() })
}
</script>

<template>
  <Dialog v-model:visible="visible" modal class="candidate-dialog" :style="{ width: '46rem' }">
    <template #header>
      <div v-if="candidate" class="cd-head">
        <strong>{{ candidate.name }}</strong>
        <small>Kullanıcı besni · kürasyon adayı</small>
      </div>
    </template>

    <div v-if="candidate" class="cd-body">
      <section v-if="candidate.decision" class="cd-decision" :class="status">
        <div>
          <strong>{{ CANDIDATE_STATUS_LABELS[status] }}</strong>
          <small>
            {{ dateText(candidate.decision.decidedAt) }} · {{ candidate.decision.decidedBy }}
            <template v-if="candidate.decision.foodName"> · {{ candidate.decision.foodName }}</template>
          </small>
          <p v-if="candidate.decision.note">{{ candidate.decision.note }}</p>
        </div>
        <Button label="Kararı geri al" icon="pi pi-undo" severity="secondary" outlined size="small"
          :loading="busy" @click="emit('undo')" />
      </section>

      <section class="cd-section">
        <h4>Yaygınlık</h4>
        <div class="cd-metrics">
          <div><strong>{{ number(candidate.userCount) }}</strong><small>farklı kullanıcı ekledi</small></div>
          <div><strong>{{ number(candidate.entryCount) }}</strong><small>öğün kaydına girdi</small></div>
          <div><strong>{{ dateText(candidate.firstSeenAt) }}</strong><small>ilk eklenme</small></div>
          <div><strong>{{ dateText(candidate.lastSeenAt) }}</strong><small>son eklenme</small></div>
        </div>
        <p class="cd-note">
          Kataloğa alma sinyali kullanıcı sayısıdır: tek kişinin eklediği bir ad o kişinin
          mutfağıdır, kataloğun değil.
        </p>
      </section>

      <section v-if="candidate.variants.length > 1" class="cd-section">
        <h4>Yazım varyantları</h4>
        <div class="cd-chips">
          <span v-for="variant in candidate.variants" :key="variant.name" class="cd-chip">
            {{ variant.name }} <b>{{ number(variant.userCount) }}</b>
          </span>
        </div>
      </section>

      <section class="cd-section">
        <h4>Kullanıcıların girdiği değerler</h4>
        <table v-if="macroRows.length" class="cd-table">
          <thead>
            <tr><th>Değer</th><th>Ortanca</th><th>En düşük</th><th>En yüksek</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in macroRows" :key="row.key">
              <td>{{ row.text }}</td>
              <td><b>{{ decimal(row.stat.median) }}</b> {{ row.unit }}</td>
              <td>{{ decimal(row.stat.min) }}</td>
              <td>{{ decimal(row.stat.max) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else class="cd-empty">Hiçbir kullanıcı makro değeri girmemiş; kataloğa alınırken değerler elle yazılmalı.</p>
        <p v-if="candidate.macros" class="cd-note">
          {{ number(candidate.macros.filled) }} kullanıcı makro doldurdu. Aralık genişse ad birden
          çok yemeği topluyor demektir ve tek kayıt olarak alınamaz.
        </p>
        <div class="cd-chips">
          <Tag v-for="group in candidate.groups" :key="group" :value="label(group)" severity="secondary" />
          <span v-if="candidate.measure" class="cd-chip">{{ measureLabel(candidate.measure) }} ölçüsü</span>
        </div>
      </section>

      <section class="cd-section">
        <h4>Katalogla çakışma</h4>
        <ul v-if="candidate.matches.length" class="cd-matches">
          <li v-for="match in candidate.matches" :key="match.foodId">
            <span class="cd-match-kind" :class="match.kind">{{ matchKindLabels[match.kind] ?? match.kind }}</span>
            <span class="cd-match-name">{{ match.name }}</span>
            <span class="cd-match-meta">{{ decimal(match.kcal) }} kcal · %{{ Math.round(match.similarity * 100) }} benzerlik</span>
          </li>
        </ul>
        <p v-else class="cd-empty">Kürasyon ucu eşleşme bildirmedi.</p>
        <p v-if="neighborsLoaded" class="cd-note">
          Panel ayrıca katalogda canlı arama yaptı ve {{ number(neighbors.length) }} yakın kayıt taradı;
          ad ya da takma ad çakışması varsa aşağıdaki kalite kutusunda görünür.
        </p>
        <p v-if="neighborError" class="cd-empty">{{ neighborError }}</p>
      </section>

      <QualityFindings v-if="report" :report="report" />

      <section v-if="status === 'bekliyor'" class="cd-section">
        <h4>Karar</h4>
        <div class="cd-actions">
          <Button label="Kataloğa al" icon="pi pi-plus-circle" :disabled="busy" @click="promote" />
          <Button label="Mevcut kayda bağla" icon="pi pi-link" severity="secondary" outlined
            :disabled="busy" @click="merging = !merging; rejecting = false" />
          <Button label="Reddet" icon="pi pi-times-circle" severity="danger" text
            :disabled="busy" @click="rejecting = !rejecting; merging = false" />
        </div>
        <p class="cd-note">
          Kataloğa alma formu açar; kayıt ancak sen kaydettiğinde oluşur ve kararı geri
          alabilirsin. Katalog 2007 besin, yanlış giren kayıt hepsini kirletir.
        </p>

        <div v-if="merging" class="cd-form">
          <label for="cd-merge">Hangi katalog kaydına bağlansın?</label>
          <AutoComplete id="cd-merge" v-model="mergeTarget" :suggestions="mergeSuggestions"
            option-label="name" fluid placeholder="Katalogda ara" @complete="searchCatalog" />
          <Button label="Bağla" icon="pi pi-check" size="small" :loading="busy"
            :disabled="!mergeTarget" @click="merge" />
        </div>

        <div v-if="rejecting" class="cd-form">
          <label for="cd-note">Reddetme gerekçesi</label>
          <Textarea id="cd-note" v-model="note" rows="2" fluid auto-resize
            placeholder="Neden kataloğa girmiyor?" />
          <Button label="Reddet" icon="pi pi-times" size="small" severity="danger" :loading="busy" @click="reject" />
        </div>
      </section>
    </div>
  </Dialog>
</template>

<style scoped>
.cd-head strong { display: block; font-size: 16px; font-weight: 850; letter-spacing: -.025em; }
.cd-head small { display: block; margin-top: 3px; color: #8d9087; font-size: 10px; font-weight: 750; }

.cd-body { display: grid; gap: 20px; }
.cd-section h4 {
  margin: 0 0 10px; color: #8b8e84; font-size: 9px; font-weight: 900;
  letter-spacing: .1em; text-transform: uppercase;
}
.cd-note { margin: 10px 0 0; color: #8a8d84; font-size: 10px; line-height: 1.55; }
.cd-empty { margin: 0; color: #a3a59c; font-size: 10px; font-style: italic; }

.cd-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.cd-metrics strong {
  display: block; color: #2c332e; font-size: 19px; font-weight: 850;
  letter-spacing: -.04em; line-height: 1; font-variant-numeric: tabular-nums;
}
.cd-metrics small { display: block; margin-top: 4px; color: #9a9c93; font-size: 9px; font-weight: 750; }

.cd-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 10px; }
.cd-chip {
  padding: 3px 8px; border: 1px solid #e8e2d5; border-radius: 7px;
  color: #62665c; background: #faf7f0; font-size: 9px; font-weight: 800;
}
.cd-chip b { color: #2c332e; }

.cd-table { width: 100%; border-collapse: collapse; font-size: 11px; }
.cd-table th {
  padding: 0 0 6px; color: #8b8e84; font-size: 9px; font-weight: 900;
  letter-spacing: .05em; text-align: right;
}
.cd-table th:first-child { text-align: left; }
.cd-table td {
  padding: 6px 0; border-top: 1px solid #f2ede1; color: #4e5249;
  font-weight: 750; text-align: right; font-variant-numeric: tabular-nums;
}
.cd-table td:first-child { text-align: left; }
.cd-table b { color: #2c332e; font-weight: 900; }

.cd-matches { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.cd-matches li { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.cd-match-kind { padding: 2px 7px; border-radius: 6px; font-size: 8px; font-weight: 900; }
.cd-match-kind.ad { color: #8d2f24; background: #f6e0dc; }
.cd-match-kind.takma_ad { color: #8a6512; background: #f8ebd0; }
.cd-match-kind.benzer { color: #3f6472; background: #e4eef1; }
.cd-match-name { color: #2c332e; font-size: 11px; font-weight: 800; }
.cd-match-meta { color: #9a9c93; font-size: 9px; font-weight: 750; }

.cd-decision {
  display: flex; gap: 12px; align-items: center; justify-content: space-between;
  padding: 12px 14px; border: 1px solid var(--line); border-radius: 14px; background: #faf7f0;
}
.cd-decision.kabul { border-color: #cbe8d9; background: #f1f9f4; }
.cd-decision.red { border-color: #eccfc9; background: #fbf3f1; }
.cd-decision strong { display: block; font-size: 12px; font-weight: 850; }
.cd-decision small { display: block; margin-top: 2px; color: #8d9087; font-size: 9px; font-weight: 750; }
.cd-decision p { margin: 6px 0 0; color: #5c6058; font-size: 10px; line-height: 1.5; }

.cd-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.cd-form {
  display: grid; gap: 8px; justify-items: start; margin-top: 12px;
  padding: 12px 14px; border: 1px solid var(--line); border-radius: 14px; background: #faf7f0;
}
.cd-form label { color: #52574f; font-size: 10px; font-weight: 900; letter-spacing: .035em; }
.cd-form :deep(.p-autocomplete), .cd-form :deep(.p-textarea) { width: 100%; }
</style>
