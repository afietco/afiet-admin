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
`admin` rolü veya `ADMIN_EMAILS` allowlist'i tanımlayın.

## Oturum (services/auth.ts)

- **Pencere: kayan 30 gün.** Panele her uğrayış "son kullanım" damgasını
  tazeler; 30 gün hiç uğranmazsa oturum kendiliğinden düşer ve token silinir.
  Pencereyi biz uygularız: Stack Auth kendi refresh token'ını daha erken
  geçersiz kılarsa akış yine giriş ekranına çıkar.
- **Saklama:** refresh token `localStorage`ta (tarayıcı kapansa da oturum
  sürsün diye), access token YALNIZ bellekte. Eskiden ikisi de
  `sessionStorage`taydı, yani her yeni sekme yeniden giriş demekti.
- **Yenileme:** Stack Auth access token'ı varsayılan olarak **10 dakikada**
  dolar (`STACK_ACCESS_TOKEN_EXPIRATION_TIME`, bulut sürümünde bize kapalı).
  Bu yüzden yenileme tepkisel değil: bitişine 90 sn kala zamanlayıcıyla, sekme
  öne geldiğinde ve ağ geri geldiğinde peşinen yenilenir. Yenileme TEK
  UÇUŞLUDUR; eşzamanlı on istek tek bir yenileme çağrısı doğurur.
- **Düşüş:** oturum nerede biterse bitsin (istek sırasında, arka planda, başka
  sekmede çıkışta) kullanıcı bozuk ekranda bırakılmaz; `/giris`e gider,
  `sebep` query'si cümleyi kurar, `devam` query'si giriş sonrası kaldığı yere
  döndürür (yalnız uygulama içi yollar kabul edilir).
- **Yetki:** admin yetkisi açılışta ve en fazla 10 dakikada bir `/v1/me` +
  `/v1/admin/summary` ile yeniden doğrulanır. 403 tek başına oturumu kapatmaz
  (bazı uçlar iş kuralı için de 403 döner); karar yetki kaynağına sorularak
  verilir. Ağ/5xx hatası oturum hakkında bir şey söylemez, oturumu düşürmez.
- Servisler 401'i kendileri yorumlamaz; tek karar noktası `authorizedFetch`tir.

## Ekranlar

- Genel bakış: katalog, kullanıcı ve beta başvurusu sayaçları
- Besin kataloğu: arama, filtreleme, ekleme, düzenleme, pasifleştirme ve silme
- Kullanıcılar: profil ve temel kullanım sinyalleri
- Beta başvuruları: web kayıtları, arama ve CSV dışa aktarma
- İçerik: sosyal medya + blog takvimi (gün/hafta/ay, sürükle-bırak), tarihsiz
  fikirler için Plan kutusu, ölçümler
- Zeka merkezi: ajanlar, bilgi tabanları ve tazeleme koşuları

### Zeka merkezi notları

Eski "Afi'ye sor" sayfası buraya taşındı; `/afi` yolu `/zeka`ya yönlenir.
Bilgi tabanı ve Tazeleme sekmeleri olduğu gibi geldi, Sorular sekmesi
`afi-bilgi-sofrasi` ajanının kendi sayfasına indi.

**İki kaynak, bilinçli ayrım.** `services/intelligence.ts` yalnız ARAYÜZ
KOPYASI tutar: etiket, ne işe yaradığı, uygulamadaki yüzü, kota cümlesi,
tuzaklar. Ad, sürüm, model, effort, araç bağları ve sistem promptu Azure AI
Foundry'de yaşar ve `/v1/admin/zeka/agents` ucundan canlı okunur. Canlı alanlar
panele elle YAZILMAZ: bir ajanın sürümü portalda değiştiğinde panelin eski
değeri güvenle göstermesi, hiç göstermemesinden daha kötü.

- Sunucu okuyamazsa alan boş kalır ve ekranda "okunmadı" görünür. Uydurulmuş
  bir effort değeri, boş bir alandan daha zararlı olur.
- Ajan tanımını Foundry'den **sunucu** çeker
  (`GET {FOUNDRY_PROJECT_URL}/agents/{ad}?api-version=v1`); anahtar tarayıcıya
  inmez. Yanıt şeması sürüme göre kayabildiği için çözümleme hoşgörülüdür ve
  ham gövde de saklanır (Sistem promptu sekmesinde "Ham gövde").
- Simülasyonlar (`views/intelligence/sims/`) GERÇEK ajanı çağırır ve sunucuda
  ürünün kendi kod yolundan geçer (aynı Suggester / VisionAssistant / Asker).
  Tek fark kullanıcı kotasına yazmamaları; yönetici başına günde 200 tur sınırı
  var.
- "Afi'ye sor" simülasyonu AKAR ve ucu bilinçli olarak `/v1` dışındadır
  (`POST /stream/admin/zeka/sim/ask`): `/v1`'deki `middleware.Timeout` akan
  gövdenin üstüne 504 yazıp cevabı cümlenin ortasında keserdi.
- Akan cevabı DİZİ ÜZERİNDEN güncelliyoruz. Ham nesneye tutunup mutasyona
  uğratmak Vue'nun reaktif proxy'sini atlar: metin birikir ama ekran akış
  boyunca yenilenmez, cevap ancak akış bitince bir anda belirir.
- Uzman dizinlerinin (`diyetisyen-bilgi`, `psikolog-bilgi`) belge sayıları elle
  tutuluyor: kaynakları `afiet-backend/tools/uzman-bilgi/icerik/` altındaki md
  dosyaları ve senkron `sync.py` ile elle koşuyor. Yalnız `bilgi-sofrasi`
  sayıları canlı uçtan (`/v1/admin/kb/status`) okunur. Arama servisinin kota ve
  depo rakamları da elle: Azure yönetim API'si ayrı kimlik ister.

### İçerik takvimi notları

- Takvim kütüphanesiz: ızgara CSS grid, tarih matematiği
  `views/content/calendar.ts`. Saat dilimi **Europe/Istanbul**'a sabittir
  (paneli başka bir saat diliminden açmak "Pzt 12:30" slotunu kaydırmaz),
  hafta pazartesi başlar.
- Etkinliği sürüklemek yalnız zamanı taşır ve anında kaydeder
  (`/api/admin/content/move`); diğer alanlar ezilmez.
- Ekler afiet-web üzerinden `gs://afiet-icerik` kovasına **doğrudan** yüklenir
  (imzalı PUT); dosya panel sunucusundan geçmez. Kova gizlidir, indirme
  bağlantıları 15 dakikalık imzalardır, yani kalıcı link yok.
- Veri ve tipler afiet-web'in `server/utils/contentTypes.ts`'inin aynasıdır;
  alan eklerken iki repo birlikte güncellenir.
- Analitik sekmesinin başındaki **Bağlı hesaplar** bölümü (`AccountsPanel.vue`)
  Instagram bağlantısını yönetir. Ölçümler günlük cron ile otomatik gelir ve
  "otomatik" rozetiyle görünür; bağlı olmayan platformda elle girilir.
  Platformda olup takvimde karşılığı bulunamayan gönderiler "eşleşmemiş"
  listesinde durur ve tek tıkla bir etkinliğe bağlanır.
- Instagram bağlama akışı **yalnız production'da** çalışır (Meta'ya kayıtlı tek
  redirect adresi afiet.co'dur); panelde app kimliği yoksa bölüm bunu söyler.

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
