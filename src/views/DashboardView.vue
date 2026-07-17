<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import Tag from 'primevue/tag'
import PageHeader from '../components/PageHeader.vue'
import EmptyState from '../components/EmptyState.vue'
import { adminApi, type Summary, type WaitlistEntry } from '../services/admin'

const summary = ref<Summary | null>(null)
const recent = ref<WaitlistEntry[]>([])
const loading = ref(true)
const error = ref('')
const todayLabel = computed(() => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }).format(new Date()).toLocaleUpperCase('tr-TR'))

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [stats, waitlist] = await Promise.all([adminApi.summary(), adminApi.waitlist({ page: 1, pageSize: 5 })])
    summary.value = stats
    recent.value = waitlist.items
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Veriler alınamadı.'
  } finally {
    loading.value = false
  }
}

const formatDate = (value: string) => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
onMounted(load)
</script>

<template>
  <div class="page-wrap">
    <PageHeader :eyebrow="todayLabel" title="Mutfakta bugün" description="afiet’in büyüyen veri ve topluluk fotoğrafı.">
      <Button label="Yenile" icon="pi pi-refresh" outlined :loading="loading" @click="load" />
    </PageHeader>
    <div v-if="error" class="error-banner"><i class="pi pi-exclamation-circle" /><span>{{ error }}</span><button @click="load">Tekrar dene</button></div>

    <section class="metric-grid" aria-label="Özet metrikler">
      <article v-for="card in [
        { label: 'Aktif besin', value: summary?.foodCount, icon: 'pi pi-book', tone: 'green', note: 'ortak katalog' },
        { label: 'Kullanıcı', value: summary?.userCount, icon: 'pi pi-users', tone: 'amber', note: 'profil oluşturan' },
        { label: 'Bekleyen kişi', value: summary?.waitlistCount, icon: 'pi pi-inbox', tone: 'coral', note: 'web listesindeki' },
        { label: 'Son 7 gün', value: summary?.waitlistLast7d, icon: 'pi pi-sparkles', tone: 'blue', note: 'yeni bekleyen' },
      ]" :key="card.label" class="metric-card" :class="card.tone">
        <div class="metric-top"><span>{{ card.label }}</span><i :class="card.icon" /></div>
        <Skeleton v-if="loading" width="5rem" height="2.7rem" />
        <strong v-else>{{ (card.value ?? 0).toLocaleString('tr-TR') }}</strong>
        <small>{{ card.note }}</small>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="panel-card welcome-card">
        <div class="welcome-copy"><p>HIZLI BAŞLANGIÇ</p><h2>Kataloğu canlı tut.</h2><span>Yeni bir besin ekle, ölçüsünü ve makrolarını doğrula; uygulamanın ortak dilini buradan yönet.</span><RouterLink to="/besinler">Besinlere git <i class="pi pi-arrow-right" /></RouterLink></div>
        <div class="plate-illustration" aria-hidden="true"><div class="plate"><span class="leaf l1"></span><span class="leaf l2"></span><span class="dot d1"></span><span class="dot d2"></span><b>{{ summary ? summary.foodCount.toLocaleString('tr-TR') : '…' }}</b><small>aktif<br />besin</small></div></div>
      </article>
      <article class="panel-card recent-card">
        <div class="panel-title"><div><p>SON KATILANLAR</p><h2>Bekleme listesi</h2></div><RouterLink to="/bekleme-listesi">Tümü</RouterLink></div>
        <div v-if="loading" class="recent-list"><Skeleton v-for="i in 4" :key="i" height="3.4rem" /></div>
        <EmptyState v-else-if="!recent.length" icon="pi pi-inbox" title="Henüz kayıt yok" description="Web formundan gelen kişiler burada görünecek." />
        <ul v-else class="recent-list">
          <li v-for="entry in recent" :key="entry.id"><span class="mail-avatar">{{ entry.email[0]?.toUpperCase() }}</span><div><strong>{{ entry.email }}</strong><small>{{ formatDate(entry.createdAt) }}</small></div><Tag :value="entry.source" severity="secondary" /></li>
        </ul>
      </article>
    </section>
  </div>
</template>
