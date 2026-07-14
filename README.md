# afiet-admin

afiet operasyon paneli. Vue 3 + Vite + PrimeVue kullanır ve veriyi yalnızca
`afiet-backend` içindeki korumalı `/v1/admin/*` uçlarından alır.

## Yerel geliştirme

```sh
cp .env.example .env
npm install
npm run dev
```

Backend tarafında migration'ları uygulayın ve admin kullanıcısı için JWT'de
`admin` rolü veya `ADMIN_EMAILS` allowlist'i tanımlayın. Frontend token'ları
kalıcı local storage yerine tarayıcı oturumu boyunca `sessionStorage` içinde
tutar.

## Ekranlar

- Genel bakış: katalog, kullanıcı ve bekleme listesi sayaçları
- Besin kataloğu: arama, filtreleme, ekleme, düzenleme, pasifleştirme ve silme
- Kullanıcılar: profil ve temel kullanım sinyalleri
- Bekleme listesi: web kayıtları, arama ve CSV dışa aktarma (ilk 500 kayıt)

## Kontroller

```sh
npm run typecheck
npm run build
```

## 3 katman (dev / staging / prod)

Backend'le simetrik: her katman kendi Cloud Run backend'ine ve kendi izole Stack
projesine bakar. Dal modeli: `feature/* → development → staging → main`.

| Katman | Dal | Vercel hedef | Backend | Stack |
| --- | --- | --- | --- | --- |
| development | `development` | Preview (development) | `app-api-dev` | dev projesi |
| staging | `staging` | Preview (staging) | `app-api-staging` | staging projesi |
| production | `main` | Production (admin.afiet.co) | `app-api-prod` | prod projesi |

SEO/GEO tüm katmanlarda `afiet.co`'dur (web tek kaynak). Config `VITE_*` env
değişkenlerinden build anında okunur (`src/config.ts`); değerleri Vercel'de
katman-başına ayarla:

```sh
bash scripts/vercel-env-setup.sh   # 3 katmanın VITE_* değerlerini Vercel'e yazar
```

**Deploy:** Vercel'in Git entegrasyonu otomatik alır — `main`→Production,
`development`/`staging` dalları→Preview. Ayrı deploy workflow'u yok. PR'larda
`.github/workflows/ci.yml` tip kontrolü + build kapısı koşar.

**CORS (zorunlu):** admin bir backend'e localhost dışından bağlanacaksa o domain
backend'in `CORS_ALLOWED_ORIGINS`'inde olmalı. staging/dev admin domainlerini
ilgili backend'lere ekle (yoksa giriş sonrası `/v1/admin/*` CORS'a takılır).
