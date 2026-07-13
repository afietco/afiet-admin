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
