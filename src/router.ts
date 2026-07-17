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
        { path: 'besinler', name: 'foods', component: () => import('./views/FoodsView.vue') },
        { path: 'kullanicilar', name: 'users', component: () => import('./views/UsersView.vue') },
        { path: 'bekleme-listesi', name: 'waitlist', component: () => import('./views/WaitlistView.vue') },
        { path: 'analitik', name: 'analytics', component: () => import('./views/analytics/AnalyticsView.vue') },
        { path: 'seo', redirect: { name: 'analytics' } },
        { path: 'icerik', name: 'content', component: () => import('./views/content/ContentView.vue') },
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
