<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Tag from 'primevue/tag'
import { adminApi } from '../../services/admin'
import {
  decisionStatusLabels, dropReasonLabel, pushKindLabel, stageLabels,
  type PushPerson,
} from '../../services/push'
import { ago, dateTime } from './shared'

/**
 * Bu kişiye ne gidiyor, ne gitmiyor.
 *
 * Ekran eskiden kapının iç sözlüğünü olduğu gibi basıyordu: "meal_10 ·
 * Bekliyor", "SOSYAL KOVA · günde 2 + 1 özet", "BU KADEMEDE HAK". Hepsi doğru
 * ama hiçbiri sorulan soru değil. Sorulan soru şu: bu kişi ne aldı, açtı mı,
 * neyi alamadı.
 *
 * Bu yüzden üst yarı cümleyle konuşur ve tür adları Türkçedir; kapının
 * mekaniği (kademe, kova, hak, dinlenme) katlanmış "Teknik detay" bölümünde
 * DURMAYA DEVAM EDER. Silinmedi: kural sayıları görünmezse "neden susuyor"
 * sorusu tahminle cevaplanmaya başlanır ve bu panel tam olarak onun için var.
 *
 * Ekranın tamamı salt okunur. Düzeltilecek bir durum yok çünkü saklanan bir
 * durum yok: hepsi kapının kendi girdilerinden türetiliyor.
 */
const props = defineProps<{ userId: string }>()

const person = ref<PushPerson | null>(null)
const error = ref('')
const loading = ref(true)

/** Ekranda gösterilen satır sayısı; uç zaten son 40'ı döndürüyor. */
const ROWS = 8

onMounted(async () => {
  try {
    person.value = await adminApi.pushPerson(props.userId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Bildirim durumu okunamadı'
  } finally {
    loading.value = false
  }
})

const sent = computed(() => (person.value?.events ?? []).slice(0, ROWS))

/**
 * Gitmeyenler: kapının reddettikleri ve özete katılanlar. Bekleyen teklifler
 * BURAYA GİRMEZ — henüz karar verilmemiş bir teklif "gitmedi" değildir, ve
 * "Bekliyor" etiketi ekranın en çok yer kaplayan, en az şey söyleyen satırıydı.
 */
const blocked = computed(() =>
  (person.value?.decisions ?? [])
    .filter((d) => d.status === 'dropped' || d.status === 'merged')
    .slice(0, ROWS))

const pending = computed(() =>
  (person.value?.decisions ?? []).filter((d) => d.status === 'pending').length)

/** Son 7 günde açılan bildirim sayısı; olay listesinden sayılır. */
const openedLast7 = computed(() => {
  const since = Date.now() - 7 * 86_400_000
  return (person.value?.events ?? [])
    .filter((e) => e.openedAt && new Date(e.sentAt).getTime() >= since).length
})

/** Üstteki üç cümle. Sayı yoksa cümle de kurulmaz. */
const lines = computed<string[]>(() => {
  const p = person.value
  if (!p) return []
  const out: string[] = []
  out.push(p.allowance.daily > 0
    ? `Bu kişi günde en fazla ${p.allowance.daily} bildirim alabilir; bugün ${p.spend.today} aldı.`
    : 'Bu kişiye bugün planlı bildirim gönderilmiyor.')
  out.push(p.spend.last7 > 0
    ? `Son 7 günde ${p.spend.last7} bildirim gitti, ${openedLast7.value} tanesini açtı.`
    : 'Son 7 günde hiç bildirim gitmedi.')
  out.push(p.devices > 0
    ? `${p.devices} cihazı kayıtlı.`
    : 'Kayıtlı cihazı yok: bildirimler yalnız uygulamadaki zilde birikiyor.')
  return out
})

function days(value: number): string {
  return value < 0 ? 'hiç' : `${value} gün`
}
</script>

<template>
  <section class="policy">
    <h3>Bildirimler</h3>

    <p v-if="loading" class="muted">Yükleniyor…</p>
    <p v-else-if="error" class="muted">{{ error }}</p>

    <template v-else-if="person">
      <p v-for="line in lines" :key="line" class="lead">{{ line }}</p>

      <h4>Son gidenler</h4>
      <p v-if="!sent.length" class="muted">Bu kişiye henüz hiç bildirim gitmemiş.</p>
      <table v-else>
        <tbody>
          <tr v-for="(e, i) in sent" :key="i">
            <td class="n" :title="dateTime(e.sentAt)">{{ ago(e.sentAt) }}</td>
            <td><strong>{{ pushKindLabel(e.kind) }}</strong><small>{{ e.title }}</small></td>
            <td class="right">
              <Tag :severity="e.openedAt ? 'success' : 'secondary'" :value="e.openedAt ? 'açtı' : 'açmadı'" />
            </td>
          </tr>
        </tbody>
      </table>

      <h4>Gitmeyenler</h4>
      <p v-if="!blocked.length" class="muted">Reddedilen bildirim yok.</p>
      <table v-else>
        <tbody>
          <tr v-for="(d, i) in blocked" :key="i">
            <td class="n" :title="dateTime(d.createdAt)">{{ ago(d.createdAt) }}</td>
            <td><strong>{{ pushKindLabel(d.kind) }}</strong></td>
            <td class="right muted">{{ d.status === 'merged' ? decisionStatusLabels.merged : dropReasonLabel(d.reason) }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="pending" class="muted note">{{ pending }} teklif sıradaki geçişi bekliyor.</p>

      <!-- Kapının mekaniği. Günlük işte gerekmiyor ama "neden susuyor"
           sorusunun cevabı burada; kapatılabilir, silinemez. -->
      <details class="tech">
        <summary>Teknik detay · kademe, hak, dinlenme</summary>

        <div class="grid">
          <div>
            <span class="k">Kademe</span>
            <span class="v">{{ stageLabels[person.stage] ?? person.stage }}</span>
          </div>
          <div>
            <span class="k">Kayıt geçmişi</span>
            <span class="v">
              ilk {{ days(person.tenure.daysSinceFirstLog) }} önce ·
              son {{ days(person.tenure.daysSinceLastLog) }} önce ·
              7 günde {{ person.tenure.loggingDaysLast7 }} gün
            </span>
          </div>
          <div>
            <span class="k">Bu kademede hak</span>
            <span class="v">
              {{ person.allowance.windowDays }} günde {{ person.allowance.weekly }},
              günde {{ person.allowance.daily }}
            </span>
          </div>
          <div>
            <span class="k">Harcanan</span>
            <span class="v">
              bugün {{ person.spend.today }} · 7 günde {{ person.spend.last7 }} ·
              30 günde {{ person.spend.last30 }}
            </span>
          </div>
          <div>
            <span class="k">Hatırlatma</span>
            <span class="v">
              <template v-if="!person.allowance.remindersAllowed">bu kademede kapalı</template>
              <template v-else-if="person.allowance.weeklyReminderCap">
                haftada {{ person.allowance.weeklyReminderCap }} ·
                kullanılan {{ person.spend.remindersLast7 }}
              </template>
              <template v-else>açık · son 7 günde {{ person.spend.remindersLast7 }}</template>
            </span>
          </div>
          <div>
            <span class="k">Sosyal kova</span>
            <span class="v">günde {{ person.allowance.social }} + 1 özet</span>
          </div>
        </div>

        <!-- Ölçüm penceresi açılmadan hiçbir tür dinlenmeye alınamaz: açılmamış
             bir bildirim ile açılmayı bildiremeyen eski bir uygulama aynı
             görünüyor, ve ikisini aynı saymak herkesi susturmak olurdu. -->
        <p v-if="!person.measuring" class="muted note">
          Bu kişiden henüz hiç açılma kaydı gelmedi, o yüzden hiçbir tür
          dinlenmeye alınmıyor.
        </p>
        <div v-else-if="person.kinds.length" class="kinds">
          <div v-for="item in person.kinds" :key="item.kind" class="kind">
            <span class="k">{{ pushKindLabel(item.kind) }}</span>
            <span class="v">
              üst üste {{ item.consecutiveUnopened }} açılmadı ·
              son {{ days(item.daysSinceLast) }} önce
            </span>
            <Tag v-if="item.damped" severity="warn" value="dinlenmede" />
          </div>
        </div>
      </details>
    </template>
  </section>
</template>

<style scoped>
.policy { margin-top: 1.5rem }
h3 { margin: 0 0 .6rem; font-size: 1rem }
h4 { margin: 1.35rem 0 .5rem; font-size: .8rem; color: var(--green); letter-spacing: .05em; text-transform: uppercase }
.lead { margin: 0 0 .3rem; font-size: .92rem; line-height: 1.55 }
.muted { opacity: .65; font-size: .85rem }
.note { margin-top: .6rem }
table { width: 100%; border-collapse: collapse; font-size: .85rem }
td { padding: .45rem .5rem; border-bottom: 1px solid rgba(128,128,128,.18); vertical-align: top }
td.n { white-space: nowrap; opacity: .7; width: 8.5rem }
td.right { text-align: right; white-space: nowrap }
td strong { display: block; font-size: .85rem; font-weight: 800 }
td small { display: block; margin-top: 2px; opacity: .6; font-size: .78rem }

.tech { margin-top: 1.5rem; border-top: 1px solid rgba(128,128,128,.18); padding-top: .75rem }
.tech > summary { cursor: pointer; font-size: .8rem; font-weight: 800; opacity: .6; list-style: revert }
.tech > summary:hover { opacity: .9 }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: .6rem 1rem; margin-top: .9rem }
.grid > div { display: flex; flex-direction: column }
.k { font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; opacity: .55 }
.v { font-size: .88rem }
.kinds { margin-top: .9rem; display: flex; flex-direction: column; gap: .35rem }
.kind { display: flex; align-items: center; gap: .6rem; flex-wrap: wrap }
</style>
