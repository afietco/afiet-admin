# Organizasyon ve Rol Otomasyonu

> Durum: tartışma notu, karar değil. Tarih: 2026-08-01. Sahip: Berk.
> Bağlam: afiet mağazalarda yayınlanıp binlerce kullanıcıya ulaştığında organizasyonun ne hale
> geleceği ve bu rollerin ne kadarının Foundry ajanlarıyla otomatize edilebileceği tartışıldı.
> İlgili: `afiet-backend/docs/veri-orkestrasyonu.md` (ajan hafızası omurgası, planlandı/uygulanmadı).

## 1. Çıkış noktası

afiet bugün tek kişi (Berk) + ajanlarla dönüyor. Soru iki parçalı:

1. Kullanıcı binlere çıktığında klasik org şeması ne olur?
2. Bu rollerin tamamına yakını ajanlarla otomatize edilebilir mi?

Kısa hüküm: kod üretimi ajanlarla ölçekleniyor, **sorumluluk, ilişki ve nöbet ölçeklenmiyor**.
Bu yüzden ilk kırılan yer mühendislik değil.

## 2. Aşamalar ve tetikleyiciler

Takvimle değil eşiklerle planlanır. Eşikler admin Büyüme panelindeki mevcut metriklere bağlanabilir
(kayıt → ilk ölçüm → grup → 3+ gün).

| Aşama | Tetikleyici | İlk kırılan | Eklenen rol |
|---|---|---|---|
| 0. Şimdi | Beta, ~10 kişi | Yok | Berk + ajanlar |
| 1. Mağaza yayını | 100-1.000 MAU | Mağaza yorumları, DM, destek maili | Topluluk/destek (yarı zamanlı) + diyetisyen (danışman, saatlik) |
| 2. Gelir başlıyor | 1.000-10.000 MAU, ilk abonelikler | Nöbet, klinik denetim, içerik ritmi | 2. ürün mühendisi + diyetisyen (yarı/tam) + içerik üreticisi (freelance) |
| 3. Ölçek | 10.000+ MAU, düzenli gelir | Tasarım borcu, edinim maliyeti, finans/hukuk | Ürün tasarımcısı + büyüme + dış mali müşavir/avukat |

Klasik yolla 10.000 kullanıcıda toplam 6-8 kişi. Ajanların taşıdığı yükü tekrar insana çevirmek
en pahalı hata olurdu.

## 3. Rol profilleri

**Diyetisyen / klinik sorumlu** (mağaza yayınından önce, danışman olarak). İki nedenle kritik:
sorumluluk (Afi ajanları binlerce kişiye beslenme yönlendirmesi yapacak, prompt'ları ve reddetme
davranışını denetleyen lisanslı bir isim gerekir; blog künyesinde "inceleyen" alanı bugün boş) ve
felsefe uyumu (kalori sayan klasik diyetisyen ürünle kavga eder; aranan profil davranışsal beslenme
veya sezgisel yeme yaklaşımına yakın, "sayma, dengele" ve kayıp draması yasağını içselleştiren biri).
Ek sorumluluk: yeme bozukluğu eskalasyon protokolü.

**Topluluk ve destek sorumlusu** (muhtemelen ilk gerçek işe alım). Çağrı merkezi elemanı değil.
Aranan: afiet'in sıcak diliyle yazabilen, mağaza yorumu / IG DM / destek maili üçlüsünü tek kapıda
toplayıp hatayı GitHub issue'ya çevirebilen biri. Aynı zamanda en iyi geri bildirim kanalı.

**İçerik ve sosyal üretici** (önce freelance). Reels, Instagram ritmi, blog görselleri. Planlama bugün
Business Suite'te elle yapılıyor, kişisel darboğaz. Ajansa verme, marka sesi ilk ayda dağılır.

**İkinci ürün mühendisi.** Tetikleyici iş yükü değil, bus factor. Prod'a bugün tek kişi erişiyor.
Neon hesap seviyesi kota ve pooler search_path olayı gibi vakalarda ikinci el yok.
Aranan: Expo/React Native + biraz Go, migration disiplini, nöbet alabilen. Ayrı backend/mobil bölmesi
10.000 kullanıcıya kadar gereksiz.

**Ürün tasarımcısı** (aşama 3). Mobil + web + admin üç yüzey ve lig, sofra, Afi sohbeti gibi
katmanlar birikince.

**Büyüme** (aşama 3). ASO, performans pazarlama, retention kampanyaları.
Retention kanıtlanmadan büyüme işe alınmaz.

**Dış hizmetler** (asla tam zamanlı değil). Mali müşavir, avukat: KVKK/VERBİS, mesafeli satış,
abonelik iadesi, mağaza vergisi.

## 4. Kurulmayacak roller

- **QA ekibi.** Yerine "release doğrulama ritüeli" sahibi. Rol değil süreç.
- **Ayrı DevOps.** Bu ölçekte Cloud Run + Neon + Vercel ürün mühendisinin işi.
- **Veri bilimci.** Birinci taraf analitik + Büyüme paneli zaten var.
- **Satış.** B2C abonelik modelinde yok.
- **Product manager.** Kurucu ürün sahibiyken karar hızını yarıya indirir.

## 5. Plan: rolleri ajanlarla otomatize etmek

Berk'in yaklaşımı: rollerin tamamına yakınını Foundry ajanları + Azure AI Search dizinleri ile
belirli uzmanlık seviyelerine çekmek; ek mühendisliğin ajanların birbiriyle ve Berk'le iletişimi
olacağını varsaymak.

Değerlendirme: yön doğru ve en zor kısmı zaten kanıtlanmış (mühendislik rolü ajanlarla ölçeklendi).
Ancak **darboğaz iletişim değil**.

### 5.1 İletişim neden asıl problem değil

Çözümü ajanları konuşturmamaktır. Ajanların birbiriyle sohbet ettiği mimari cazip ve yanlış:
deterministik değil, denetlenemez, pahalı, zamanla savruluyor. Doğrusu veri-orkestrasyonu
Karar 1'de zaten yazılı olan desen: Postgres outbox + `FOR UPDATE SKIP LOCKED` relay + tek yazar.
Ajanlar birbirine mesaj atmaz, **şemalı artefakt üretip kuyruğa bırakır**; sırayı deterministik kod
belirler. `work_items` tablosu, tipli çıktı, idempotent tüketici. Dilim 1'in aynısı, yalnız üretici
ve tüketici kümesi farklı.

### 5.2 Asıl üç darboğaz

**Doğrulama.** Her rol için tek soru: çıktıyı okumadan kabul etmemi sağlayan mekanik kontrol nedir?
Kod için CI + typecheck + test. Katalog için besin-denetimi'nin 77 kontrolü. Blog için kaynak
URL'lerini curl'leyen tarama. Bu kontrolü kuramadığın rol otonom olamaz, yalnız yardımcı olur.
Klinik iddia doğruluğunun mekanik kontrolü yok.

**Dikkat bütçesi.** On ajan, on inceleme kuyruğu demek ve hepsi tek kafaya iniyor. Ajanlar işi yok
etmiyor, "yapma"yı "inceleme ve karar verme"ye çeviriyor. İnceleme daha ucuz ama bedava değil ve
tek kafada paralelleşmiyor. Tavan tahmini 3-5 aktif akış. Tasarım ilkesi: **sağlıklı ajan sessizdir**,
yalnız istisna yukarı çıkar ve her eskalasyon varsayılan eylemi doldurulmuş gelir.

**Hakemlik.** Diyetisyen ajanı "bu besini kaldır" derken büyüme ajanı "bu besin etkileşim üretiyor"
diyecek. Sistem çelişkiyi yüzeye çıkarmalı, son yazanı kazandırmamalı. Kullanıcı sayfası tarafında
karşılığı tam-bölüm yeniden yazım; iç taraf için karşılığı henüz yok.

## 6. Rollerin otomasyon katmanları

| Katman | Roller | Neden |
|---|---|---|
| Tam otomasyon mümkün | Kod, katalog denetimi, veri/analitik yorumu, ASO/SEO, içerik taslağı, destek 1. kademe | Mekanik doğrulama kurulabiliyor. Destek için 98 yazılık destek merkezi eşleştirme malzemesi. |
| Ajan %80, insan imza | Klinik içerik denetimi, hukuk/finans, kriz iletişimi | Teknik engel değil, sorumluluk devredilemiyor. "Ajan öyle dedi" ne mahkemede ne App Review'da savunma. |
| Otomasyon dışı | Nöbet erişilebilirliği, yeme bozukluğu eskalasyonu, temsil/ilişki | Aşağıda. |

**Nöbet.** Ajan tespit eder, hatta onarır. Ama pooler olayı gibi bir vakada karar para ve veri
hakkındaydı ve ulaşılabilir bir insan gerekiyordu. Ajanlar bus factor'ü iyileştirmiyor,
kötüleştiriyor: sistem karmaşıklaşıyor ve hâlâ tek kişi anlıyor.

**Yeme bozukluğu sinyali.** Otomatikleştirilmez. Yanlış tarafa düşen eskalasyonun maliyeti geri
alınamaz ve psikolog sohbetinde kullanıcıya verilmiş bir söz var.

## 7. Somut engeller (mevcut yığında)

- **Foundry, Students aboneliğinde.** Tüm iş gücü öğrenci aboneliğine kuruluyor. Kod problemi değil,
  abonelik taşıma problemi. Bu planın en acil kalemi.
- **Search dizin kotası 3/3 dolu** (bilgi-sofrasi, diyetisyen-bilgi, psikolog-bilgi). Kısıt ajan
  kotası değil, dizin kotası. "Her role kendi knowledge base'i" doğrudan duvara toslar.
  Doğrusu: tek dizin + metadata filtresi + role özel prompt. Ajanı çoğalt, dizini çoğaltma.
- **Vectorizer anahtar rotasyonu sessizce öldürüyor.** Ajanlar iş gücüyse ajan altyapısı prod
  altyapısıdır: ajan başına sağlık kontrolü ve durum sayfasına bağlanma gerekir.
- **Prompt injection yüzeyi büyüyor.** Kullanıcı verisi okuyup eylem alan iç ajan, yalnız konuşan
  ajandan çok daha tehlikeli. `ekip_notu` ilkesinin iç karşılığı: güvenilmez girdi okuyan ajanın
  yazma yetkisi olmaz.

## 8. Uygulanabilirlik hükmü

**"10.000 kullanıcıya kadar afiet'i tek başıma + 1-2 yarı zamanlı insanla döndürebilir miyim?"**
Evet, yüksek ihtimalle. Kanıt zaten elde.

**"Rollerin tamamını otomatize edebilir miyim?"** Hayır. Kalıcı olarak iki insan kalıyor: klinik
içeriğin arkasındaki lisanslı isim ve ulaşılabilir ikinci teknik kişi. Ama bu 8 tam zamanlı yerine
2 yarı zamanlı demek, yani plan büyük ölçüde tutuyor.

**En büyük risk teknik değil:** ajan-organizasyon katmanı kendi başına bir ürün ve ürün geliştirme
zamanını yiyebilir. veri-orkestrasyonu Dilim 1 daha yazılmadı, mağaza yayını bekliyor.

## 9. Önerilen sıra

1. **Ayrı proje olarak kurma.** veri-orkestrasyonu Dilim 1'i planlandığı gibi yaz. O omurga
   (outbox, relay, `ai_invocations`, provenance, tek yazar) iç ajanların da omurgası. İç ajan
   katmanı üstüne yan ürün olarak biner.
2. **Pilot rol: katalog denetimi.** Mekanik kontrolü var (77 kontrol), kalıcı karar hafızası var,
   riski düşük, yarısı yazılmış. Tam otonom koşan ilk rol bu olsun.
3. **Tek metrik: okumadan kabul oranı.** Bir ajanın çıktısının yüzde kaçı açılmadan onaylanıyor?
   %90'a çıkmayan rol otomatik değildir, yardımcıdır. Her yeni rol kararını bu sayı versin.
4. **Tek gelen kutusu.** `/zeka` tohum. Berk'e düşen her şey tek sıralı listede, varsayılan eylem
   dolu. On bildirim kanalı kurulursa sistem kurucuyu işe alır.

## 10. Açık kararlar

| # | Karar | Not |
|---|---|---|
| 1 | Klinik sorumluluk kimde? | Mağaza yayınından önce cevaplanmalı. Sohbet artık saklanacağı için (veri-orkestrasyonu Karar 3) klinik denetim malzemesi de doğar. |
| 2 | Destek tek kapıya düşüyor mu? | Mağaza yorumu + IG DM + destek maili tek yere düşsün ki hacim ölçülebilsin. İşe alım kararını hacim versin. |
| 3 | Foundry aboneliği ne zaman taşınacak? | Students aboneliği iş gücü altyapısı olamaz. |
| 4 | Bus factor | İkinci mühendis gelene kadar erişim ve kurtarma prosedürü en azından yazılı olsun. |
| 5 | İç ajan katmanı ayrı doküman olacak mı? | Rol tanımları, `work_items` şeması, eskalasyon sözleşmesi, pilot kabul kriterleri. Henüz yazılmadı. |
