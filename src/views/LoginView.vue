<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Message from 'primevue/message'
import { signIn } from '../services/auth'

const router = useRouter()
const route = useRoute()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

// Oturum niye bitti: kullanıcı sebebini bilmeden "yine mi giriş" hissine kapılır.
const NOTICES: Record<string, { text: string; severity: 'warn' | 'info' }> = {
  'suresi-doldu': { text: 'Oturumunun süresi doldu. Tekrar giriş yaptığında kaldığın yerden devam edersin.', severity: 'warn' },
  'yetki-yok': { text: 'Bu hesabın yönetim paneli yetkisi görünmüyor. Yetkili bir hesapla giriş yap.', severity: 'warn' },
  cikis: { text: 'Çıkış yapıldı.', severity: 'info' },
}
const notice = computed(() => NOTICES[String(route.query.sebep ?? '')] ?? null)

// Yalnız uygulama içi yollara dönülür; dışarıdan gelen adres yok sayılır.
function returnPath(): string {
  const devam = route.query.devam
  if (typeof devam !== 'string' || !devam.startsWith('/') || devam.startsWith('//')) return '/'
  return devam
}

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await signIn(email.value, password.value)
    await router.replace(returnPath())
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Giriş yapılamadı.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="login-page">
    <section class="login-story">
      <div class="login-brand">
        <img class="brand-logo" src="/icon.svg" alt="" />
        <div><strong>afiet</strong><small>Sayma, dengele.</small></div>
      </div>
      <div class="story-copy">
        <span class="story-kicker">MUTFAK MASASI</span>
        <h1>İyi bir ürün,<br /><em>iyi bakılan</em> verilerle büyür.</h1>
        <p>Besin kataloğunu, topluluğu ve sıradaki misafirleri tek bir sakin çalışma alanından yönet.</p>
      </div>
      <div class="table-cloth" aria-hidden="true"><span></span><span></span><span></span></div>
      <p class="story-foot">afiet operasyon ekibi · 2026</p>
    </section>
    <section class="login-panel">
      <form class="login-card" @submit.prevent="submit">
        <div class="login-card-head">
          <img class="login-card-logo" src="/icon.svg" alt="afiet" />
          <p>YÖNETİCİ GİRİŞİ</p>
          <h2>Masaya hoş geldin.</h2>
          <span>Stack Auth hesabınla güvenli biçimde devam et.</span>
        </div>
        <Message v-if="error" severity="error" :closable="false">{{ error }}</Message>
        <Message v-else-if="notice" :severity="notice.severity" :closable="false">{{ notice.text }}</Message>
        <label class="field-label" for="email">E-posta</label>
        <InputText id="email" v-model="email" type="email" autocomplete="email" placeholder="sen@afiet.co" fluid required />
        <label class="field-label" for="password">Şifre</label>
        <Password input-id="password" v-model="password" :feedback="false" toggle-mask autocomplete="current-password" placeholder="••••••••" fluid required />
        <Button type="submit" label="Yönetim paneline gir" icon="pi pi-arrow-right" icon-pos="right" :loading="loading" fluid />
        <p class="security-note"><i class="pi pi-shield" /> Yalnızca admin rolü veya izinli e-posta erişebilir.</p>
      </form>
    </section>
  </main>
</template>
