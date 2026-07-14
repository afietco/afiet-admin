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
        { path: 'besinler', name: 'foods', component: () => import('./views/FoodsView.vue') },
        { path: 'kullanicilar', name: 'users', component: () => import('./views/UsersView.vue') },
        { path: 'bekleme-listesi', name: 'waitlist', component: () => import('./views/WaitlistView.vue') },
        { path: 'seo', name: 'seo', component: () => import('./views/SeoView.vue') },
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
