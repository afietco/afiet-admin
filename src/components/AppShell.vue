<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import { auth, signOut } from '../services/auth'
import { config } from '../config'

const route = useRoute()
const router = useRouter()
const mobileOpen = ref(false)

// Menü on bir maddeye çıkınca düz liste okunmaz oldu. Maddeler dört gruba
// ayrıldı ve gruplar native <details> ile katlanıyor: açma/kapama tarayıcının
// işi, Vue tarafında hiçbir yeniden render tetiklenmiyor.
const groups = [
  {
    key: 'genel',
    label: 'GENEL',
    items: [
      { to: '/', label: 'Genel bakış', icon: 'pi pi-th-large', name: 'dashboard' },
      { to: '/buyume', label: 'Büyüme', icon: 'pi pi-chart-line', name: 'growth' },
      { to: '/analitik', label: 'Analitik', icon: 'pi pi-chart-bar', name: 'analytics' },
    ],
  },
  {
    key: 'urun',
    label: 'ÜRÜN',
    items: [
      { to: '/besinler', label: 'Besin kataloğu', icon: 'pi pi-book', name: 'foods' },
      { to: '/gorevler', label: 'Görevler', icon: 'pi pi-sparkles', name: 'quests' },
      { to: '/afi', label: 'Afi’ye sor', icon: 'pi pi-comments', name: 'afi' },
    ],
  },
  {
    key: 'insanlar',
    label: 'İNSANLAR',
    items: [
      // Kullanıcı detayı da bu maddenin altında yaşar; alt rota adı verilmezse
      // detaya girildiğinde menüde hiçbir madde işaretli kalmıyor.
      { to: '/kullanicilar', label: 'Kullanıcılar', icon: 'pi pi-users', name: 'users', also: ['user-detail'] },
      { to: '/beta-basvurulari', label: 'Beta başvuruları', icon: 'pi pi-send', name: 'beta' },
    ],
  },
  {
    key: 'iletisim',
    label: 'İLETİŞİM',
    items: [
      { to: '/icerik', label: 'İçerik', icon: 'pi pi-megaphone', name: 'content' },
      { to: '/bildirimler', label: 'Bildirimler', icon: 'pi pi-bell', name: 'push' },
    ],
  },
]

const STORAGE_KEY = 'afiet-admin:nav-groups'

/** Madde bu rotayı temsil ediyor mu; `also` alt rotaları da maddeye bağlar. */
function covers(item: { name: string; also?: string[] }, routeName: unknown) {
  return item.name === routeName || (item.also ?? []).includes(String(routeName))
}

function groupOf(routeName: unknown) {
  return groups.find((g) => g.items.some((i) => covers(i, routeName)))?.key
}

// Kapalı grupları saklıyoruz, açıkları değil: yeni bir grup eklendiğinde
// varsayılanı açık olsun, kullanıcının eski tercihi onu gizlemesin.
function readClosed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

const closed = ref(readClosed())

function isOpen(key: string) {
  // Aktif sayfayı içeren grup her zaman açık: kapalı bir grubun içinde
  // durduğun sayfayı görememek kafa karıştırır.
  return key === groupOf(route.name) || !closed.value.has(key)
}

function onToggle(key: string, event: Event) {
  const open = (event.target as HTMLDetailsElement).open
  const next = new Set(closed.value)
  if (open) next.delete(key)
  else next.add(key)
  closed.value = next
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
  } catch { /* özel sekme: tercih saklanmaz, menü yine çalışır */ }
}

// Yol değişince mobil menü kapanmalı.
watch(() => route.fullPath, () => { mobileOpen.value = false })

function logout() {
  signOut()
  router.push('/giris')
}
</script>

<template>
  <div class="app-shell">
    <button v-if="mobileOpen" class="mobile-shade visible" aria-label="Menüyü kapat" @click="mobileOpen = false" />
    <aside class="sidebar" :class="{ open: mobileOpen }">
      <div class="brand-lockup">
        <img class="brand-logo" src="/icon.svg" alt="" />
        <div>
          <strong>afiet</strong>
          <small>Sayma, dengele.</small>
        </div>
      </div>

      <div class="nav-groups">
        <details
          v-for="group in groups"
          :key="group.key"
          class="nav-group"
          :open="isOpen(group.key)"
          @toggle="onToggle(group.key, $event)"
        >
          <summary class="nav-caption">
            <span>{{ group.label }}</span>
            <i class="pi pi-chevron-down nav-chevron" />
          </summary>
          <nav :aria-label="group.label">
            <RouterLink
              v-for="item in group.items"
              :key="item.name"
              :to="item.to"
              class="nav-item"
              :class="{ active: covers(item, route.name) }"
              @click="mobileOpen = false"
            >
              <i :class="item.icon" />
              <span>{{ item.label }}</span>
              <i class="pi pi-angle-right nav-arrow" />
            </RouterLink>
          </nav>
        </details>
      </div>

      <div class="sidebar-note">
        <span class="live-dot"></span>
        <div><strong>{{ config.appEnv }}</strong><small>API oturumu doğrulandı</small></div>
      </div>
      <div class="account-row">
        <div class="account-avatar">{{ auth.user?.email?.slice(0, 1).toUpperCase() }}</div>
        <div class="account-copy"><strong>{{ auth.user?.email }}</strong><small>Yönetici</small></div>
        <Button icon="pi pi-sign-out" text rounded severity="secondary" aria-label="Çıkış yap" @click="logout" />
      </div>
    </aside>

    <main class="main-stage">
      <header class="mobile-header">
        <button class="menu-trigger" aria-label="Menüyü aç" @click="mobileOpen = true"><i class="pi pi-bars" /></button>
        <img class="mobile-brand-logo" src="/icon.svg" alt="" />
        <div class="mobile-wordmark"><strong>afiet</strong><span>yönetim</span></div>
      </header>
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.nav-groups { position: relative; z-index: 1; margin-top: 30px; }
.nav-group + .nav-group { margin-top: 4px; }

/* Global .nav-caption'ın kendi margin'i var; summary olarak kullanılınca
   tıklanabilir bir satıra dönüşüyor, o yüzden burada yeniden ölçülüyor. */
.nav-group > summary.nav-caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0;
  padding: 9px 12px;
  border-radius: 10px;
  cursor: pointer;
  list-style: none;
  user-select: none;
}
.nav-group > summary.nav-caption::-webkit-details-marker { display: none; }
.nav-group > summary.nav-caption:hover { background: rgba(255, 255, 255, 0.05); }
.nav-group > summary.nav-caption:focus-visible { outline: 2px solid #62dda8; outline-offset: 2px; }

.nav-chevron { font-size: 9px; opacity: 0.55; transition: transform 0.18s ease; }
.nav-group[open] > summary .nav-chevron { transform: rotate(180deg); }

.nav-group > nav { padding: 2px 0 6px; }

@media (prefers-reduced-motion: reduce) {
  .nav-chevron { transition: none; }
}
</style>
