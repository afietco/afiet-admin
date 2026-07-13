export const config = {
  apiUrl: (import.meta.env.VITE_API_URL || 'https://app-api-dev-f7cnieuuza-ew.a.run.app').replace(/\/$/, ''),
  stackProjectId: import.meta.env.VITE_STACK_PROJECT_ID || 'df8401ea-a019-4316-9cbd-4192a5ab22a0',
  stackBaseUrl: (import.meta.env.VITE_STACK_BASE_URL || 'https://api.stack-auth.com').replace(/\/$/, ''),
  appEnv: import.meta.env.VITE_APP_ENV || 'development',
}
