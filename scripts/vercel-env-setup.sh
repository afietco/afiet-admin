#!/usr/bin/env bash
# afiet-admin'i 3 katmanlı yapar (backend'le simetrik): her katman kendi Cloud
# Run backend'ine ve kendi izole Stack projesine bakar. Değerleri Vercel env'ine
# yazar — Production (main dalı) + branch-scoped Preview (development/staging).
#
#   Katman        Dal          Backend                              Vercel hedef
#   development   development   app-api-dev                          Preview:development
#   staging       staging       app-api-staging                      Preview:staging
#   production    main          app-api-prod                         Production
#
# SEO/GEO tüm katmanlarda afiet.co'dur (web tek kaynak, backend ortamından bağımsız).
# Stack proje id'leri istemci-tarafı (public) tanımlayıcıdır; gcloud secret'larından
# okunur ve EKRANA BASILMAZ — doğrudan vercel env'ine akıtılır.
#
# Gerekenler: vercel (login + bu klasör afiet-admin projesine link'li), gcloud.
# Kullanım: repo kökünden  bash scripts/vercel-env-setup.sh
#
# NOT: env yazmak deploy tetiklemez. Uygulanması için ilgili dala push (Vercel
# Git entegrasyonu build alır) ve backend CORS'una admin domainlerinin eklenmesi
# gerekir (bkz. README "3 katman" bölümü).
set -euo pipefail
cd "$(dirname "$0")/.."

DEV_ID=$(gcloud secrets versions access latest --secret=app-dev-auth-audience --project afiet-co)
STG_ID=$(gcloud secrets versions access latest --secret=app-staging-auth-audience --project afiet-co)
PRD_ID=$(gcloud secrets versions access latest --secret=app-prod-auth-audience --project afiet-co)

DEV_API="https://app-api-dev-f7cnieuuza-ew.a.run.app"
STG_API="https://app-api-staging-f7cnieuuza-ew.a.run.app"
PRD_API="https://app-api-prod-f7cnieuuza-ew.a.run.app"

# put <NAME> <VALUE> <TARGET> [BRANCH]
put() {
  local name=$1 val=$2 target=$3 branch=${4:-}
  # Aynı ada varsa önce sil (idempotent); yoksa hata yut.
  if [ -n "$branch" ]; then
    vercel env rm "$name" "$target" "$branch" -y >/dev/null 2>&1 || true
    printf '%s' "$val" | vercel env add "$name" "$target" "$branch"
  else
    vercel env rm "$name" "$target" -y >/dev/null 2>&1 || true
    printf '%s' "$val" | vercel env add "$name" "$target"
  fi
}

tier() {  # <target> <branch|""> <api> <stackId> <appEnv>
  local target=$1 branch=$2 api=$3 stack=$4 env=$5
  put VITE_API_URL          "$api"              "$target" "$branch"
  put VITE_STACK_PROJECT_ID "$stack"            "$target" "$branch"
  put VITE_STACK_BASE_URL   "https://api.stack-auth.com" "$target" "$branch"
  put VITE_WEB_API_URL      "https://afiet.co"  "$target" "$branch"
  put VITE_APP_ENV          "$env"              "$target" "$branch"
}

echo "→ development (Preview:development)"
tier preview development "$DEV_API" "$DEV_ID" development
echo "→ staging (Preview:staging)"
tier preview staging "$STG_API" "$STG_ID" staging
echo "→ production (main)"
tier production "" "$PRD_API" "$PRD_ID" production

cat <<'EOF'
✓ 3 katman env yazıldı.
Sırada:
  1) Dalları oluştur/push et: development, staging (Vercel Preview build alır).
  2) Domain (opsiyonel ama önerilen): admin-staging.afiet.co → staging dalı,
     admin-dev.afiet.co → development dalı (Vercel > Project > Domains).
  3) CORS: backend'lerin CORS_ALLOWED_ORIGINS'ine admin domainlerini ekle
     (staging backend'e admin-staging..., dev backend'e admin-dev...). Aksi halde
     giriş sonrası /v1/admin/* çağrıları CORS'a takılır.
EOF
