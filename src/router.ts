import { createRouter, createWebHistory } from 'vue-router'
import { auth, initializeAuth } from './services/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/giris', name: 'login', component: () => import('./views/LoginView.vue'), meta: { public: true } },
    {
      path: '/',
      component: () => import('./components/AppShell.vue'),
      children: [
        { path: '', name: 'dashboard', component: () => import('./views/DashboardView.vue') },
        { path: 'buyume', name: 'growth', component: () => import('./views/GrowthView.vue') },
        { path: 'besinler', name: 'foods', component: () => import('./views/foods/FoodsView.vue') },
        { path: 'gorevler', name: 'quests', component: () => import('./views/QuestsView.vue') },
        { path: 'kullanicilar', name: 'users', component: () => import('./views/users/UsersView.vue') },
        { path: 'kullanicilar/:userId', name: 'user-detail', component: () => import('./views/users/UserDetailView.vue') },
        { path: 'beta-basvurulari', name: 'beta', component: () => import('./views/beta/BetaView.vue') },
        { path: 'analitik', name: 'analytics', component: () => import('./views/analytics/AnalyticsView.vue') },
        { path: 'seo', redirect: { name: 'analytics' } },
        { path: 'icerik', name: 'content', component: () => import('./views/content/ContentView.vue') },
        { path: 'bildirimler', name: 'push', component: () => import('./views/push/PushView.vue') },
        { path: 'afi', name: 'afi', component: () => import('./views/afi/AfiView.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  await initializeAuth()
  if (!to.meta.public && auth.status !== 'authenticated') return { name: 'login' }
  if (to.name === 'login' && auth.status === 'authenticated') return { name: 'dashboard' }
})

export default router
