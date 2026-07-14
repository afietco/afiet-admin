import { computed, reactive, ref, watch } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { webApi, type AdminSeoPayload, type SettingsKey } from '../../services/webApi'

/** JSON-güvenli derin kopya (tüm SEO verisi düz JSON'dur). */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Anahtar sırasından bağımsız kararlı serileştirme — kirlilik karşılaştırması için. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}

/** ISO zaman damgasını okunur tarihe çevir; boşsa boş döner. */
export function formatWhen(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d)
}

/** Karakter sayacı durumu: aralıktaysa 'ok' (yeşil), değilse 'warn' (amber). */
export function countState(len: number, min: number, max: number): 'ok' | 'warn' {
  return len >= min && len <= max ? 'ok' : 'warn'
}

const SUCCESS_DETAIL = 'Site en geç 1 dakika içinde güncellenir.'

/**
 * Bir ayar bölümünün ortak davranışı: efektif değerden dolan form, kirlilik
 * takibi, kaydet (PUT), varsayılana dön (DELETE + onay), rozet ve updatedAt.
 * Kaydet/sıfırla dönüşünde gelen taze payload üste bildirilir.
 */
export function useSettingsSection<T extends object>(
  sectionKey: SettingsKey,
  read: (p: AdminSeoPayload) => T,
  payload: () => AdminSeoPayload,
  onSaved: (p: AdminSeoPayload) => void,
) {
  const toast = useToast()
  const confirm = useConfirm()
  const form = reactive(clone(read(payload())))
  let baseline = stableStringify(read(payload()))
  const saving = ref(false)

  const dirty = computed(() => stableStringify(form) !== baseline)
  const hasOverride = computed(() => sectionKey in payload().overrides.settings)
  const updatedAt = computed(() => payload().updatedAt[`settings:${sectionKey}`] ?? '')

  function sync(p: AdminSeoPayload) {
    Object.assign(form, clone(read(p)))
    baseline = stableStringify(read(p))
  }

  // Başka bir sekme kaydedince payload tazelenir; kirli değilsek baseline'ı senkronla.
  watch(payload, () => { if (!dirty.value) sync(payload()) })

  async function save() {
    saving.value = true
    try {
      const p = await webApi.putSettings(sectionKey, clone(form))
      sync(p)
      onSaved(p)
      toast.add({ severity: 'success', summary: 'Kaydedildi', detail: SUCCESS_DETAIL, life: 3000 })
    } catch (err) {
      toast.add({ severity: 'error', summary: 'Kaydedilemedi', detail: err instanceof Error ? err.message : '', life: 4000 })
    } finally {
      saving.value = false
    }
  }

  function reset() {
    confirm.require({
      header: 'Varsayılana dön',
      message: 'Bu bölümdeki tüm değişiklikler silinir ve koddaki varsayılana dönülür. Emin misin?',
      icon: 'pi pi-exclamation-triangle',
      rejectLabel: 'Vazgeç',
      acceptLabel: 'Varsayılana dön',
      acceptClass: 'p-button-danger',
      accept: async () => {
        try {
          const p = await webApi.deleteSettings(sectionKey)
          sync(p)
          onSaved(p)
          toast.add({ severity: 'success', summary: 'Varsayılana döndürüldü', detail: SUCCESS_DETAIL, life: 3000 })
        } catch (err) {
          toast.add({ severity: 'error', summary: 'İşlem başarısız', detail: err instanceof Error ? err.message : '', life: 4000 })
        }
      },
    })
  }

  return { form, dirty, hasOverride, updatedAt, saving, save, reset }
}
