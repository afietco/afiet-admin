<script setup lang="ts">
import { onMounted, ref } from 'vue'
import Tag from 'primevue/tag'
import { adminApi } from '../../services/admin'
import {
  decisionStatusLabels, dropReasonLabel, stageLabels, type PushPerson,
} from '../../services/push'
import { dateTime } from './shared'

/**
 * Neden bu kişi şu an susuyor.
 *
 * Altı kural bir bildirimin gidip gitmeyeceğine karar veriyor ve hepsi sessizce
 * reddedebiliyor. Bu doğru davranış ama görülemez olması yanlış: cevabı
 * olmayan bir sistem, kurallarını tahminle gevşetmeye başlar.
 *
 * Ekranın tamamı salt okunur. Düzeltilecek bir durum yok çünkü saklanan bir
 * durum yok: hepsi kapının kendi girdilerinden türetiliyor.
 */
const props = defineProps<{ userId: string }>()

const person = ref<PushPerson | null>(null)
const error = ref('')
const loading = ref(true)

onMounted(async () => {
  try {
    person.value = await adminApi.pushPerson(props.userId)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Bildirim durumu okunamadı'
  } finally {
    loading.value = false
  }
})

function days(value: number): string {
  return value < 0 ? 'hiç' : `${value} gün`
}
</script>

<template>
  <section class="policy">
    <h3>Bildirim durumu</h3>

    <p v-if="loading" class="muted">Yükleniyor…</p>
    <p v-else-if="error" class="muted">{{ error }}</p>

    <template v-else-if="person">
      <div class="row">
        <Tag :value="stageLabels[person.stage] ?? person.stage" />
        <span class="muted">
          İlk kayıt {{ days(person.tenure.daysSinceFirstLog) }} önce ·
          son kayıt {{ days(person.tenure.daysSinceLastLog) }} önce ·
          son 7 günde {{ person.tenure.loggingDaysLast7 }} gün ·
          {{ person.devices }} aktif cihaz
        </span>
      </div>

      <div class="grid">
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
          <span class="k">{{ item.kind }}</span>
          <span class="v">
            üst üste {{ item.consecutiveUnopened }} açılmadı ·
            son {{ days(item.daysSinceLast) }} önce
          </span>
          <Tag v-if="item.damped" severity="warn" value="dinlenmede" />
        </div>
      </div>

      <h4>Son kararlar</h4>
      <p v-if="!person.decisions.length" class="muted">Henüz teklif üretilmemiş.</p>
      <table v-else>
        <tbody>
          <tr v-for="(d, i) in person.decisions" :key="i">
            <td class="n">{{ dateTime(d.createdAt) }}</td>
            <td>{{ d.kind }}</td>
            <td>
              <Tag
                :severity="d.status === 'promoted' ? 'success' : d.status === 'dropped' ? 'danger' : 'secondary'"
                :value="decisionStatusLabels[d.status]"
              />
            </td>
            <td class="muted">{{ dropReasonLabel(d.reason) }}</td>
          </tr>
        </tbody>
      </table>

      <h4>Son gönderimler</h4>
      <p v-if="!person.events.length" class="muted">Henüz bildirim gitmemiş.</p>
      <table v-else>
        <tbody>
          <tr v-for="(e, i) in person.events" :key="i">
            <td class="n">{{ dateTime(e.sentAt) }}</td>
            <td>{{ e.kind }}</td>
            <td class="muted">{{ e.variant }}</td>
            <td>
              <Tag
                :severity="e.openedAt ? 'success' : 'secondary'"
                :value="e.openedAt ? 'açıldı' : 'açılmadı'"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </section>
</template>

<style scoped>
.policy { margin-top: 1.5rem }
h3 { margin: 0 0 .75rem; font-size: 1rem }
h4 { margin: 1.25rem 0 .5rem; font-size: .85rem; text-transform: uppercase; letter-spacing: .05em; opacity: .6 }
.row { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; margin-bottom: .75rem }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: .5rem 1rem }
.grid > div { display: flex; flex-direction: column }
.k { font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; opacity: .55 }
.v { font-size: .9rem }
.muted { opacity: .65; font-size: .85rem }
.note { margin-top: .75rem }
.kinds { margin-top: .75rem; display: flex; flex-direction: column; gap: .35rem }
.kind { display: flex; align-items: center; gap: .6rem; flex-wrap: wrap }
table { width: 100%; border-collapse: collapse; font-size: .85rem }
td { padding: .35rem .5rem; border-bottom: 1px solid rgba(128,128,128,.18) }
td.n { white-space: nowrap; opacity: .7 }
</style>
