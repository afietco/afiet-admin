<script setup lang="ts">
import { computed, ref } from 'vue'
import Tag from 'primevue/tag'
import SourceChip from './SourceChip.vue'
import { label, type Provenance, type UserDetail } from '../../services/users'
import { date, dateTime, duration, num, pct, timeFmt } from './shared'

const props = defineProps<{ detail: UserDetail; sources: Record<keyof UserDetail, Provenance> }>()

const sessions = computed(() => props.detail.sessions)
const openId = ref<string | null>(null)

const cards = computed(() => {
  const summary = sessions.value.summary
  return [
    { label: 'Oturum (30 gün)', value: num(summary.total30d), foot: `haftada ${summary.perWeek.toLocaleString('tr-TR')}`, tone: 'green', icon: 'pi pi-mobile' },
    { label: 'Ortalama süre', value: duration(summary.avgDurationSec), foot: 'oturum başına', tone: 'blue', icon: 'pi pi-clock' },
    { label: 'Ekran / oturum', value: num(summary.medianScreens), foot: 'ortanca', tone: 'amber', icon: 'pi pi-window-maximize' },
    { label: 'Son oturum', value: summary.lastSessionAt ? date(summary.lastSessionAt) : '—', foot: summary.lastSessionAt ? timeFmt.format(new Date(summary.lastSessionAt)) : 'kayıt yok', tone: 'coral', icon: 'pi pi-history' },
  ]
})

const dailyMax = computed(() => Math.max(1, ...sessions.value.daily.map((row) => row.sessions)))
const hourMax = computed(() => Math.max(1, ...sessions.value.byHour.map((row) => row.count)))
const screenMax = computed(() => Math.max(1, ...sessions.value.screens.map((row) => row.opens)))

/** Bildirimden açılan oturumların payı; tetikleyicilerin işe yarayıp
    yaramadığını kişi düzeyinde okumanın tek yolu. */
const fromNotification = computed(() => Math.round(sessions.value.summary.fromNotification * 100))

function toggle(id: string) {
  openId.value = openId.value === id ? null : id
}
</script>

<template>
  <div class="detail-body">
    <div v-if="sources.sessions === 'demo'" class="detail-banner">
      <i class="pi pi-info-circle" />
      <p>
        Bu kullanıcıdan son 30 günde oturum verisi gelmemiş. Oturumlar mobil telemetrisinden
        (<strong>session_start / session_end / screen_view</strong>) gelir; kullanıcı bu event'leri
        gönderen sürüme henüz geçmediyse ya da uygulamayı hiç açmadıysa burası boş kalır.
      </p>
      <SourceChip :source="sources.sessions" />
    </div>

    <section class="metric-grid" aria-label="Oturum özeti">
      <article v-for="card in cards" :key="card.label" class="metric-card" :class="card.tone">
        <div class="metric-top"><span>{{ card.label }}</span><i :class="card.icon" /></div>
        <strong>{{ card.value }}</strong>
        <small>{{ card.foot }}</small>
      </article>
    </section>

    <div class="split-grid wide-left">
      <article class="panel-card pad">
        <div class="panel-title sm"><div><p>GÜNLÜK</p><h2>Son 30 günde açılış</h2></div></div>
        <div class="bar-chart short">
          <div
            v-for="day in sessions.daily"
            :key="day.date"
            class="bar-col slim"
            :title="`${date(day.date)} · ${String(day.sessions)} oturum · ${duration(day.durationSec)}`"
          >
            <div class="bar-track">
              <div class="bar-fill" :style="{ height: `${String(Math.max(day.sessions ? 8 : 2, Math.round((day.sessions / dailyMax) * 100)))}%`, opacity: day.sessions ? 1 : 0.25 }" />
            </div>
          </div>
        </div>
        <p class="note-line">
          <i class="pi pi-bell" />
          Oturumların %{{ fromNotification }} kadarı bir bildirime dokunarak başlamış.
        </p>
      </article>

      <article class="panel-card pad">
        <div class="panel-title sm"><div><p>SAAT</p><h2>Ne zaman açıyor</h2></div></div>
        <div class="hour-chart">
          <div v-for="row in sessions.byHour" :key="row.hour" class="hour-col" :title="`${String(row.hour)}:00 · ${String(row.count)} oturum`">
            <div class="hour-fill blue" :style="{ height: `${String(Math.round((row.count / hourMax) * 100))}%` }" />
          </div>
        </div>
        <div class="hour-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
      </article>
    </div>

    <section class="panel-card pad">
      <div class="panel-title sm"><div><p>EKRANLAR</p><h2>Nerede vakit geçiriyor</h2></div></div>
      <ul class="src-list tight">
        <li v-for="row in sessions.screens" :key="row.screen">
          <div class="src-row">
            <span class="src-name">{{ row.label }}</span>
            <span class="src-val">{{ num(row.opens) }} açılış · {{ duration(row.avgSec) }} ortalama</span>
          </div>
          <div class="mini-track"><div class="mini-fill green" :style="{ width: `${String(pct(row.opens, screenMax))}%` }" /></div>
        </li>
      </ul>
    </section>

    <section class="panel-card pad">
      <div class="panel-title sm"><div><p>SON OTURUMLAR</p><h2>Oturum akışı</h2></div></div>
      <ul class="session-list">
        <li v-for="session in sessions.recent" :key="session.id" :class="{ open: openId === session.id }">
          <button type="button" class="session-head" @click="toggle(session.id)">
            <i class="pi" :class="openId === session.id ? 'pi-chevron-down' : 'pi-chevron-right'" />
            <div class="session-when">
              <strong>{{ dateTime(session.startedAt) }}</strong>
              <small>{{ duration(session.durationSec) }} · {{ num(session.screens) }} ekran</small>
            </div>
            <Tag :value="session.platform === 'ios' ? 'iOS' : 'Android'" :severity="session.platform === 'ios' ? 'info' : 'success'" />
            <span class="session-version">{{ session.appVersion }}</span>
          </button>
          <ol v-if="openId === session.id" class="event-timeline">
            <li v-for="(event, index) in session.events" :key="index">
              <span class="timeline-time">{{ timeFmt.format(new Date(event.at)) }}</span>
              <span class="timeline-dot" />
              <div class="timeline-body">
                <strong>{{ event.name }}</strong>
                <small v-if="event.props.screen">{{ label.screen(String(event.props.screen)) }}</small>
              </div>
            </li>
          </ol>
        </li>
      </ul>
      <p class="note-line subtle">
        <i class="pi pi-shield" />
        Event içeriğinde kişisel veri taşınmaz: ekran adı, sayaç ve tetikleyici kimliği dışında bir şey yazılmaz.
      </p>
    </section>
  </div>
</template>
