export const config = {
  apiUrl: (import.meta.env.VITE_API_URL || 'https://app-api-dev-f7cnieuuza-ew.a.run.app').replace(/\/$/, ''),
  stackProjectId: import.meta.env.VITE_STACK_PROJECT_ID || 'df8401ea-a019-4316-9cbd-4192a5ab22a0',
  stackBaseUrl: (import.meta.env.VITE_STACK_BASE_URL || 'https://api.stack-auth.com').replace(/\/$/, ''),
  appEnv: import.meta.env.VITE_APP_ENV || 'development',
  // SEO/GEO verisi afiet-web'in (Nuxt) Nitro API'sinde yaşar; panel oraya bağlanır.
  webApiUrl: (import.meta.env.VITE_WEB_API_URL || 'https://afiet.co').replace(/\/$/, ''),
  // YALNIZ yerel geliştirme: web tarafındaki NUXT_ADMIN_DEV_TOKEN ile aynı değer.
  webAdminDevToken: import.meta.env.VITE_WEB_ADMIN_DEV_TOKEN || '',
}
