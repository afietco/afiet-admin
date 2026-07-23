<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import { auth, signOut } from '../services/auth'
import { config } from '../config'

const route = useRoute()
const router = useRouter()
const mobileOpen = ref(false)
const items = [
  { to: '/', label: 'Genel bakış', icon: 'pi pi-th-large', name: 'dashboard' },
  { to: '/buyume', label: 'Büyüme', icon: 'pi pi-chart-line', name: 'growth' },
  { to: '/besinler', label: 'Besin kataloğu', icon: 'pi pi-book', name: 'foods' },
  { to: '/kullanicilar', label: 'Kullanıcılar', icon: 'pi pi-users', name: 'users' },
  { to: '/bekleme-listesi', label: 'Bekleme listesi', icon: 'pi pi-inbox', name: 'waitlist' },
  { to: '/beta-basvurulari', label: 'Beta başvuruları', icon: 'pi pi-send', name: 'beta' },
  { to: '/analitik', label: 'Analitik', icon: 'pi pi-chart-bar', name: 'analytics' },
  { to: '/icerik', label: 'İçerik', icon: 'pi pi-megaphone', name: 'content' },
  { to: '/bildirimler', label: 'Bildirimler', icon: 'pi pi-bell', name: 'push' },
]

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

      <p class="nav-caption">OPERASYON</p>
      <nav aria-label="Ana menü">
        <RouterLink
          v-for="item in items"
          :key="item.name"
          :to="item.to"
          class="nav-item"
          :class="{ active: route.name === item.name }"
          @click="mobileOpen = false"
        >
          <i :class="item.icon" />
          <span>{{ item.label }}</span>
          <i class="pi pi-angle-right nav-arrow" />
        </RouterLink>
      </nav>

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
