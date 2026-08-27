<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import { auth, signOut } from '../services/auth'
import { config } from '../config'

type NavItem = {
  to: string
  label: string
  icon: string
  name: string
  /** Bu maddenin altında yaşayan alt rota adları. */
  also?: string[]
}
type NavGroup = { key: string; label: string; items: NavItem[] }

const route = useRoute()
const router = useRouter()
const mobileOpen = ref(false)

// İki grup. Önceden dört vardı ve ikisi tek maddelikti: bir başlığın altında
// tek satır durması gruplamayı bilgi değil dekor yapar. "Kullanıcılar" kimin
// geldiğini söylediği için genel bakışın yanına, "İçerik" ve "Bildirimler"
// kullanıcıya ne gittiğini yönettiği için ürünün yanına taşındı.
const groups: NavGroup[] = [
  {
    key: 'genel',
    label: 'GENEL',
    items: [
      { to: '/', label: 'Genel bakış', icon: 'pi pi-th-large', name: 'dashboard' },
      { to: '/buyume', label: 'Büyüme', icon: 'pi pi-chart-line', name: 'growth' },
      { to: '/analitik', label: 'Analitik', icon: 'pi pi-chart-bar', name: 'analytics' },
      // Kullanıcı detayı da bu maddenin altında yaşar; alt rota adı verilmezse
      // detaya girildiğinde menüde hiçbir madde işaretli kalmıyor.
      //
      // Beta başvuruları menüde madde DEĞİL: liste Kullanıcılar sayfasındaki
      // karttan açılan yan panelde. Rota duruyor ki yer imleri kırılmasın ama
      // menüden erişilen tek yol o karttır — menü araması kalktığı için
      // "beta" yazarak da bulunamaz.
      { to: '/kullanicilar', label: 'Kullanıcılar', icon: 'pi pi-users', name: 'users', also: ['user-detail', 'beta'] },
    ],
  },
  {
    key: 'urun',
    label: 'ÜRÜN',
    items: [
      { to: '/besinler', label: 'Besin kataloğu', icon: 'pi pi-book', name: 'foods' },
      { to: '/gorevler', label: 'Görevler', icon: 'pi pi-sparkles', name: 'quests' },
      { to: '/surum', label: 'Sürüm kapısı', icon: 'pi pi-mobile', name: 'version-gate' },
      // Ajan detayı da bu maddenin altında yaşar; alt rota adı verilmezse
      // detaya girildiğinde menüde hiçbir madde işaretli kalmıyor.
      { to: '/zeka', label: 'Zeka merkezi', icon: 'pi pi-comments', name: 'intelligence', also: ['agent-detail'] },
      { to: '/icerik', label: 'İçerik', icon: 'pi pi-megaphone', name: 'content' },
      { to: '/bildirimler', label: 'Bildirimler', icon: 'pi pi-bell', name: 'push' },
    ],
  },
]

const GROUPS_KEY = 'afiet-admin:nav-groups'
const RAIL_KEY = 'afiet-admin:nav-rail'
/** Dar kip yalnız geniş ekranda anlamlı; altında sidebar zaten çekmece. */
const WIDE_QUERY = '(min-width: 821px)'

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch { /* özel sekme: tercih saklanmaz, menü yine çalışır */ }
}

/** Madde bu rotayı temsil ediyor mu; `also` alt rotaları da maddeye bağlar. */
function covers(item: { name: string; also?: string[] }, routeName: unknown) {
  return item.name === routeName || (item.also ?? []).includes(String(routeName))
}

function groupOf(routeName: unknown) {
  return groups.find((g) => g.items.some((i) => covers(i, routeName)))?.key
}

const activeGroup = computed(() => groupOf(route.name))

const sidebarEl = ref<HTMLElement | null>(null)

/* ------------------------------------------------------------ grup katı */

// Kapalı grupları saklıyoruz, açıkları değil: yeni bir grup eklendiğinde
// varsayılanı açık olsun, kullanıcının eski tercihi onu gizlemesin.
function readClosed(): Set<string> {
  try {
    const raw = localStorage.getItem(GROUPS_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

const closed = ref(readClosed())

/** Aktif grup her zaman açık: durduğun sayfayı görememek kafa karıştırır. */
function isLocked(key: string) {
  return key === activeGroup.value
}

function isOpen(key: string) {
  return isLocked(key) || !closed.value.has(key)
}

function toggleGroup(key: string) {
  // Kilitli grubun katlanması görsel olarak karşılıksız kalırdı; tıklama
  // sessizce yutuluyor.
  if (isLocked(key)) return
  const next = new Set(closed.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  closed.value = next
  persist(GROUPS_KEY, JSON.stringify([...next]))
}

/* -------------------------------------------------------- daralt / genişlet */

function readWide() {
  return typeof window === 'undefined' ? true : window.matchMedia(WIDE_QUERY).matches
}

function readRail() {
  try {
    return localStorage.getItem(RAIL_KEY) === '1'
  } catch {
    return false
  }
}

const isWide = ref(readWide())
const collapsed = ref(readRail())
/** Ekranda gerçekten dar kipte miyiz; mobilde çekmece hep tam listedir. */
const rail = computed(() => collapsed.value && isWide.value)

function setCollapsed(next: boolean) {
  collapsed.value = next
  persist(RAIL_KEY, next ? '1' : '0')
}

/* ------------------------------------------------------------- klavye */

function navLinks(): HTMLElement[] {
  const root = sidebarEl.value
  if (!root) return []
  // offsetParent boşsa madde katlanmış ya da süzülmüş demektir.
  return [...root.querySelectorAll<HTMLElement>('a.nav-item')].filter((el) => el.offsetParent !== null)
}

function focusFirstItem() {
  navLinks()[0]?.focus()
}

function onItemKeydown(event: KeyboardEvent) {
  const links = navLinks()
  if (!links.length) return
  const current = links.indexOf(event.target as HTMLElement)
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    links[(current + 1) % links.length]?.focus()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    links[current <= 0 ? links.length - 1 : current - 1]?.focus()
  } else if (event.key === 'Home') {
    event.preventDefault()
    links[0]?.focus()
  } else if (event.key === 'End') {
    event.preventDefault()
    links[links.length - 1]?.focus()
  }
}

function onEscape() {
  if (mobileOpen.value) mobileOpen.value = false
}

function onWideChange(event: MediaQueryListEvent) {
  isWide.value = event.matches
}

let wideQuery: MediaQueryList | null = null

onMounted(() => {
  wideQuery = window.matchMedia(WIDE_QUERY)
  isWide.value = wideQuery.matches
  wideQuery.addEventListener('change', onWideChange)
})

onBeforeUnmount(() => {
  wideQuery?.removeEventListener('change', onWideChange)
})

/* -------------------------------------------------------------- hesap */

const initial = computed(() => auth.user?.email?.slice(0, 1).toUpperCase() ?? '')

function onNavigate() {
  mobileOpen.value = false
}

// Yol değişince mobil menü kapanmalı.
watch(() => route.fullPath, () => {
  mobileOpen.value = false
})

// Yönlendirmeyi auth katmanı yapar (oturum nerede biterse bitsin aynı yol).
function logout() {
  signOut()
}
</script>

<template>
  <div class="app-shell" :class="{ rail }">
    <button v-if="mobileOpen" class="mobile-shade visible" aria-label="Menüyü kapat" @click="mobileOpen = false" />

    <aside
      ref="sidebarEl"
      class="sidebar"
      :class="{ open: mobileOpen, 'is-rail': rail }"
      @keydown.esc="onEscape"
    >
      <div class="side-top">
        <div class="brand-lockup">
          <img class="brand-logo" src="/icon.svg" alt="" />
          <div v-if="!rail" class="brand-copy">
            <strong>afiet</strong>
            <small>Sayma, dengele.</small>
          </div>
        </div>
        <button
          v-if="isWide"
          v-tooltip.right="{ value: rail ? 'Menüyü genişlet' : 'Menüyü daralt', showDelay: 220 }"
          type="button"
          class="rail-toggle"
          :aria-label="rail ? 'Menüyü genişlet' : 'Menüyü daralt'"
          :aria-pressed="rail"
          @click="setCollapsed(!collapsed)"
        >
          <i :class="rail ? 'pi pi-angle-double-right' : 'pi pi-angle-double-left'" aria-hidden="true" />
        </button>
      </div>

      <div class="nav-scroll">
        <div v-for="group in groups" :key="group.key" class="nav-group">
          <button
            v-if="!rail"
            type="button"
            class="nav-caption"
            :class="{ locked: isLocked(group.key) }"
            :aria-expanded="isOpen(group.key)"
            :aria-controls="`nav-${group.key}`"
            :aria-disabled="isLocked(group.key) ? 'true' : undefined"
            @click="toggleGroup(group.key)"
          >
            <span class="cap-text">{{ group.label }}</span>
            <span class="cap-rule" aria-hidden="true" />
            <!-- Katlı grupta kaç madde saklandığı görünsün, tahmin gerekmesin. -->
            <span v-if="!isOpen(group.key)" class="cap-count">{{ group.items.length }}</span>
            <i v-if="isOpen(group.key) && isLocked(group.key)" class="cap-here pi pi-circle-fill" aria-hidden="true" />
            <i v-else class="pi pi-chevron-down nav-chevron" aria-hidden="true" />
          </button>

          <nav v-show="rail || isOpen(group.key)" :id="`nav-${group.key}`" :aria-label="group.label">
            <RouterLink
              v-for="item in group.items"
              :key="item.name"
              v-tooltip.right="{ value: item.label, disabled: !rail, showDelay: 220 }"
              :to="item.to"
              class="nav-item"
              :class="{ active: covers(item, route.name) }"
              :aria-label="item.label"
              :aria-current="covers(item, route.name) ? 'page' : undefined"
              @click="onNavigate()"
              @keydown="onItemKeydown"
            >
              <i :class="item.icon" aria-hidden="true" />
              <span class="nav-label">{{ item.label }}</span>
              <i class="pi pi-angle-right nav-arrow" aria-hidden="true" />
            </RouterLink>
          </nav>
        </div>

      </div>

      <div class="side-foot">
        <div
          v-tooltip.right="{ value: `${config.appEnv} · API oturumu doğrulandı`, disabled: !rail, showDelay: 220 }"
          class="sidebar-note"
        >
          <span class="live-dot"></span>
          <div v-if="!rail"><strong>{{ config.appEnv }}</strong><small>API oturumu doğrulandı</small></div>
        </div>
        <div class="account-row">
          <div
            v-tooltip.right="{ value: auth.user?.email ?? 'Yönetici', disabled: !rail, showDelay: 220 }"
            class="account-avatar"
          >
            {{ initial }}
          </div>
          <div v-if="!rail" class="account-copy">
            <strong>{{ auth.user?.email }}</strong><small>Yönetici</small>
          </div>
          <Button icon="pi pi-sign-out" text rounded severity="secondary" aria-label="Çıkış yap" @click="logout" />
        </div>
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
/* Bütün stiller burada duruyor: global main.css'e dokunulmuyor, gereken
   yerlerde global sınıflar scoped öznitelik özgüllüğüyle eziliyor. */


/* ---------------------------------------------------------- iskelet ---- */

.sidebar {
  padding: 20px 16px 14px;
  gap: 0;
}

/* -------------------------------------------------------------- tepe ---- */

.side-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  position: relative;
  z-index: 1;
}

.brand-lockup {
  min-width: 0;
  gap: 11px;
}
.brand-logo { width: 36px; height: 36px; }
.brand-copy strong { font-size: 22px; }
.brand-copy small { margin-top: 4px; }

.rail-toggle,
.rail-toggle:hover,
.rail-toggle:focus-visible,
.rail-toggle i { font-size: 12px; }

/* ------------------------------------------------------------- arama ---- */






/* --------------------------------------------------------- menü kütlesi -- */

/* Liste kendi içinde kayıyor: uzun menü hesap satırını aşağı itmiyor. */
.nav-scroll {
  flex: 1;
  min-height: 0;
  margin-top: 16px;
  padding-right: 2px;
  overflow-y: auto;
  overscroll-behavior: contain;
  position: relative;
  z-index: 1;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.16) transparent;
}
.nav-scroll::-webkit-scrollbar { width: 5px; }
.nav-scroll::-webkit-scrollbar-thumb { border-radius: 999px; background: rgba(255, 255, 255, 0.14); }

.nav-group + .nav-group { margin-top: 9px; }

/* Grup başlığı artık ince bir editoryal ayraç: metin + saç teli çizgi. */
.nav-caption {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 9px;
  min-height: 30px;
  margin: 0 0 3px;
  padding: 0 10px;
  border: 0;
  border-radius: 9px;
  color: #7fa595;
  background: none;
  font-family: inherit;
  font-size: 9.5px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-align: left;
  cursor: pointer;
}
.nav-caption.locked { cursor: default; }
.nav-caption:not(.locked):hover { color: #d3e9de; background: rgba(255, 255, 255, 0.04); }
.nav-caption:not(.locked):hover .cap-rule { background: rgba(255, 255, 255, 0.18); }
.nav-caption:focus-visible { outline: 2px solid #62dda8; outline-offset: 2px; }

.cap-text { flex: 0 0 auto; }
.cap-rule { flex: 1; height: 1px; background: rgba(255, 255, 255, 0.09); }
.cap-count {
  flex: 0 0 auto;
  padding: 1px 6px;
  border-radius: 999px;
  color: #a7d7c3;
  background: rgba(255, 255, 255, 0.1);
  font-size: 9px;
  letter-spacing: 0;
}
.cap-here { font-size: 5px; color: #62dda8; }
.nav-chevron { font-size: 9px; opacity: 0.5; transition: transform 0.18s ease; }
.nav-caption[aria-expanded='false'] .nav-chevron { transform: rotate(-90deg); }

.sidebar nav { gap: 2px; }

/* Satırlar sıkılaştı ama dokunma hedefi 38px'in altına inmiyor. */
.nav-item {
  grid-template-columns: 20px minmax(0, 1fr) auto;
  gap: 10px;
  min-height: 38px;
  padding: 0 10px;
  border-radius: 11px;
  font-size: 13.5px;
}
.nav-item > i:first-child { font-size: 14px; }
.nav-item .nav-arrow { font-size: 10px; }
.nav-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* Sakin dil: satır kaymıyor, yalnız zemin ısınıyor. */
.nav-item:hover { transform: none; background: rgba(255, 255, 255, 0.07); }
.nav-item.active { box-shadow: 0 6px 16px rgba(0, 0, 0, 0.16); }
.nav-item:focus-visible { outline: 2px solid #62dda8; outline-offset: 2px; }


/* -------------------------------------------------------------- alt ---- */

.side-foot { position: relative; z-index: 1; }
.sidebar-note { margin: 12px 0 12px; padding: 11px 12px; }

/* ------------------------------------------------------------- dar kip -- */

@media (min-width: 821px) {
  .app-shell.rail { grid-template-columns: 72px minmax(0, 1fr); }

  .sidebar.is-rail { padding: 18px 14px 14px; align-items: stretch; }
  /* Dekoratif halka 72px'e sığmıyor, dar kipte kapatılıyor. */
  .sidebar.is-rail::after { display: none; }

  .sidebar.is-rail .side-top { flex-direction: column; gap: 10px; }
  .sidebar.is-rail .brand-lockup { justify-content: center; }
  .sidebar.is-rail .nav-scroll { margin-top: 12px; }
  .sidebar.is-rail .nav-group + .nav-group {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .sidebar.is-rail .nav-item {
    grid-template-columns: 1fr;
    justify-items: center;
    min-height: 40px;
    padding: 0;
    border-radius: 12px;
  }
  .sidebar.is-rail .nav-item > i:first-child { font-size: 16px; }
  .sidebar.is-rail .nav-label,
  .sidebar.is-rail .nav-arrow { display: none; }

  .sidebar.is-rail .sidebar-note { justify-content: center; padding: 12px 0; }
  .sidebar.is-rail .account-row {
    grid-template-columns: 1fr;
    justify-items: center;
    gap: 6px;
    padding-top: 10px;
  }
}

/* ------------------------------------------------------- mobil çekmece -- */

@media (max-width: 820px) {
  /* Parmakla kullanılan çekmecede hedefler yeniden büyüyor. */
  .nav-caption { min-height: 38px; }
  .nav-item { min-height: 44px; }
}

@media (prefers-reduced-motion: reduce) {
  .nav-chevron,
  .rail-toggle { transition: none; }
}
</style>
