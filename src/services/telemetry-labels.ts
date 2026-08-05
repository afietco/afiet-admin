/**
 * Mobil telemetri anahtarlarının Türkçe karşılıkları.
 *
 * Anahtarların kaynağı afiet-mobile'dır: ekranlar route adından türür
 * (lib/useSessionTracking.ts), alt sayfalar `ui/Sheet.tsx` `name` prop'undan,
 * dokunuşlar `trackTap` hedeflerinden gelir (docs/feature-list/event-altyapisi.md).
 * Bilinmeyen anahtar ham haliyle düşer: mobil yeni anahtar eklediğinde panel
 * kırılmaz, yalnız çevirisi eksik kalır.
 */

/** Mobildeki route kümesiyle aynı (ilk path parçası; tab index'i "bugun"). */
export const SCREEN_LABELS: Record<string, string> = {
  bugun: 'Bugün', beslenme: 'Beslenme', vucudum: 'Vücudum', grubum: 'Grubum',
  ekle: 'Öğün ekle', menum: 'Menüm', besinler: 'Besin rehberi', gorevlerim: 'Görevlerim',
  arkadaslarim: 'Arkadaşlarım', lig: 'Lig', profil: 'Profil', hesap: 'Hesap ayarları',
  bilgilerim: 'Bilgilerim', gorunum: 'Görünüm', veri: 'Veri', katil: 'Gruba katıl',
  onboarding: 'Tanışma', intro: 'Karşılama', login: 'Giriş', sohbet: 'Sohbet',
  premium: 'Premium', 'afi-galeri': 'Afi galerisi', 'first-meal': 'İlk öğün',
  'yapay-zeka': 'Yapay zeka', 'oauth-callback': 'Giriş yönlendirmesi',
}

/** ui/Sheet.tsx `name` prop sözlüğü. */
export const SHEET_LABELS: Record<string, string> = {
  add_food: 'Besin ekle', add_food_flow: 'Besin ekleme akışı', add_friend: 'Arkadaş ekle',
  body_setup: 'Vücut bilgileri', change_email: 'E-posta değiştirme', change_password: 'Şifre değiştirme',
  create_group: 'Grup kurma', direction: 'Denge yönü', food_detail: 'Besin detayı',
  group_edit: 'Grup düzenleme', group_search: 'Grup arama', insight_history: 'İçgörü geçmişi',
  join_group: 'Gruba katılma', kese: 'İkram kesesi', meal_detail: 'Öğün detayı',
  measurement: 'Ölçüm girişi', measurement_history: 'Ölçüm geçmişi', notifications: 'Bildirimler',
  public_profile: 'Profil kartı', quest_detail: 'Görev detayı', rhythm_info: 'Ritim bilgisi',
  sofra: 'Sofra', whats_new: 'Yenilikler', hamburger_menu: 'Hamburger menü',
}

/** trackTap hedefleri; şimdilik yalnız giriş düğmeleri enstrümante. */
export const TAP_LABELS: Record<string, string> = {
  auth_email: 'E-posta ile giriş', auth_google: 'Google ile giriş', auth_apple: 'Apple ile giriş',
}

/** Oturum iskeleti dışındaki ürün olayları (oturum akışında görünenler). */
export const EVENT_LABELS: Record<string, string> = {
  cold_start: 'Soğuk açılış', meal_logged: 'Öğün kaydedildi', water_logged: 'Su kaydedildi',
  measurement_added: 'Ölçüm eklendi', onboarding_completed: 'Tanışma tamamlandı',
  balance_viewed: 'Denge tabağı görüntülendi', afiyet_day_completed: 'Afiyet günü tamamlandı',
  move_offered: 'Denge hamlesi önerildi', move_done: 'Denge hamlesi yapıldı',
  move_dismissed: 'Denge hamlesi geçildi', week_summary_opened: 'Haftalık özet açıldı',
  rhythm_week_completed: 'Ritim haftası tamamlandı', nudge_shown: 'Dürtme gösterildi',
  nudge_acted: 'Dürtme karşılık buldu', reaction_sent: 'Tepki gönderildi',
  pause_started: 'Mola başladı', pause_ended: 'Mola bitti',
  afi_celebration_shown: 'Afi kutlaması gösterildi', afi_assist_used: 'Afi yardımı kullanıldı',
  afi_suggestion_accepted: 'Afi önerisi kabul edildi', afi_suggestion_rejected: 'Afi önerisi reddedildi',
  afi_guide_started: 'Afi rehberi başladı', afi_guide_step_shown: 'Afi rehberi adımı gösterildi',
  chat_opened: 'Sohbet açıldı', chat_session_started: 'Sohbet oturumu başladı',
  chat_message_sent: 'Mesaj gönderildi', chat_attachment_sent: 'Görsel gönderildi',
  chat_reply_completed: 'Yanıt tamamlandı', chat_session_deleted: 'Sohbet oturumu silindi',
  chat_destek_intro_accepted: 'Destek tanıtımı kabul edildi',
}

export const screenLabel = (key: string) => SCREEN_LABELS[key] ?? key
export const sheetLabel = (key: string) => SHEET_LABELS[key] ?? key
export const tapLabel = (key: string) => TAP_LABELS[key] ?? key
export const eventLabel = (key: string) => EVENT_LABELS[key] ?? key
