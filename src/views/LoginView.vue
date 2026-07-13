<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Message from 'primevue/message'
import { signIn } from '../services/auth'

const router = useRouter()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await signIn(email.value, password.value)
    await router.push('/')
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
