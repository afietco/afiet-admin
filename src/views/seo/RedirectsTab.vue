<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import InputText from 'primevue/inputtext'
import SelectButton from 'primevue/selectbutton'
import Tag from 'primevue/tag'
import EmptyState from '../../components/EmptyState.vue'
import { webApi, type AdminSeoPayload, type SeoRedirect } from '../../services/webApi'

const props = defineProps<{ payload: AdminSeoPayload }>()
const emit = defineEmits<{ saved: [AdminSeoPayload] }>()
const toast = useToast()
const confirm = useConfirm()

const redirects = computed<SeoRedirect[]>(() => props.payload.effective.redirects)

const codeOptions = [{ label: '301 · kalıcı', value: 301 }, { label: '302 · geçici', value: 302 }]
const from = ref('')
const to = ref('')
const code = ref<301 | 302>(301)
const adding = ref(false)
const submitted = ref(false)

const fromValid = computed(() => from.value.trim().startsWith('/') && from.value.trim() !== '/')
const toValid = computed(() => to.value.trim().length > 0)

async function add() {
  submitted.value = true
  if (!fromValid.value || !toValid.value) return
  adding.value = true
  try {
    const p = await webApi.putRedirect({ from: from.value.trim(), to: to.value.trim(), code: code.value })
    emit('saved', p)
    from.value = ''; to.value = ''; code.value = 301; submitted.value = false
    toast.add({ severity: 'success', summary: 'Yönlendirme eklendi', detail: 'Site en geç 1 dakika içinde güncellenir.', life: 3000 })
  } catch (err) {
    toast.add({ severity: 'error', summary: 'Eklenemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
  } finally {
    adding.value = false
  }
}

function remove(r: SeoRedirect) {
  confirm.require({
    header: 'Yönlendirmeyi sil',
    message: `${r.from} → ${r.to} yönlendirmesi silinsin mi?`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Vazgeç',
    acceptLabel: 'Sil',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        const p = await webApi.deleteRedirect(r.from)
        emit('saved', p)
        toast.add({ severity: 'success', summary: 'Yönlendirme silindi', life: 2500 })
      } catch (err) {
        toast.add({ severity: 'error', summary: 'Silinemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
      }
    },
  })
}
</script>

<template>
  <div class="tab-body">
    <div class="seo-info">
      <i class="pi pi-info-circle" />
      <p>Eski ya da değişen yolları yeni adreslerine gönder. Ana sayfa (/) yönlendirilemez; döngü oluşturan kayıtlar reddedilir.</p>
    </div>

    <section class="add-redirect" :class="{ disabled: !props.payload.dbConnected }">
      <div class="form-field"><label>Kaynak yol</label><InputText v-model="from" placeholder="/eski-yol" fluid :invalid="submitted && !fromValid" /></div>
      <div class="form-field"><label>Hedef</label><InputText v-model="to" placeholder="/yeni-yol veya https://…" fluid :invalid="submitted && !toValid" /></div>
      <div class="form-field code-field"><label>Kod</label><SelectButton v-model="code" :options="codeOptions" option-label="label" option-value="value" :allow-empty="false" /></div>
      <Button label="Ekle" icon="pi pi-plus" :loading="adding" :disabled="!props.payload.dbConnected" @click="add" />
    </section>

    <section class="table-card">
      <DataTable :value="redirects" data-key="from">
        <template #empty><EmptyState icon="pi pi-directions" title="Yönlendirme yok" description="Yukarıdaki formdan ilk yönlendirmeni ekleyebilirsin." /></template>
        <Column header="Kaynak" style="min-width: 14rem"><template #body="{ data }"><span class="redirect-from">{{ data.from }}</span></template></Column>
        <Column header="" style="width: 3rem"><template #body><i class="pi pi-arrow-right redirect-arrow" /></template></Column>
        <Column header="Hedef" style="min-width: 16rem"><template #body="{ data }"><span class="redirect-to">{{ data.to }}</span></template></Column>
        <Column header="Kod"><template #body="{ data }"><Tag :value="String(data.code)" :severity="data.code === 301 ? 'success' : 'warn'" /></template></Column>
        <Column header="" style="width: 4rem"><template #body="{ data }"><Button icon="pi pi-trash" text rounded severity="danger" aria-label="Sil" :disabled="!props.payload.dbConnected" @click="remove(data)" /></template></Column>
      </DataTable>
    </section>
  </div>
</template>
