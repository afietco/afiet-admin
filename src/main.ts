import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import 'primeicons/primeicons.css'
import '@fontsource-variable/nunito'
import './styles/main.css'
import App from './App.vue'
import router from './router'

createApp(App)
  .use(PrimeVue, {
    theme: {
      preset: Aura,
      options: { darkModeSelector: '.never-dark', cssLayer: false },
    },
  })
  .use(ToastService)
  .use(ConfirmationService)
  .directive('tooltip', Tooltip)
  .use(router)
  .mount('#app')
