#!/usr/bin/env bash
# admin.afiet.co'yu PRODUCTION paneli yapar: prod Stack projesi + prod backend +
# afiet.co web API'si. Değerleri Secret Manager'dan okur, Vercel production
# env'lerine yazar ve production deploy alır.
#
# DİKKAT: Bundan sonra paneldeki Besinler/Kullanıcılar/Bekleme listesi ekranları
# PRODUCTION verisini yönetir (dev paneli olarak localhost ya da preview kullan).
#
# Gerekenler: vercel (login + bu klasör afiet-admin projesine link'li), gcloud.
# Kullanım: repo kökünden  bash scripts/vercel-env-prod.sh
set -euo pipefail
cd "$(dirname "$0")/.."

PROD_ID=$(gcloud secrets versions access latest --secret="app-prod-auth-audience" --project afiet-co)
API_URL="https://app-api-prod-916424808227.europe-west1.run.app"

add() { printf '%s' "$2" | vercel env add "$1" production --force; }
add VITE_STACK_PROJECT_ID "$PROD_ID"
add VITE_API_URL "$API_URL"
add VITE_WEB_API_URL "https://afiet.co"
add VITE_APP_ENV "production"

echo "→ production deploy"
vercel deploy --prod

echo "✓ Bitti. admin.afiet.co artık prod Stack + prod backend + afiet.co'ya bağlı."
echo "  Girişte 403 'admin yetkisi yok' alırsan: hem backend prod ADMIN_EMAILS'te"
echo "  hem afiet-web Vercel production NUXT_ADMIN_EMAILS'te kendi e-postan olmalı"
echo "  (şu an ikisi de admin@afiet.co varsayıyor)."
