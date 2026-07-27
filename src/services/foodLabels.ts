/**
 * Enum anahtarlarının Türkçe karşılıkları. Anahtar listesinin KENDİSİ artık
 * /v1/admin/foods/facets ucundan geliyor; burası yalnız görünen adı verir.
 *
 * Bu ayrım kasıtlı: sözlükte olmayan bir anahtar geldiğinde değer kaybolmaz,
 * ham hâliyle görünür. Eskiden panel enum listesini elle aynalıyordu ve dört
 * besin grubu (bakliyat, kuruyemiş, hamur işi, içecek) panelden hiç
 * atanamıyordu — bir daha o sessiz kayıp yaşanmasın.
 */
const LABELS: Record<string, string> = {
  // food_category
  kahvaltilik: 'Kahvaltılık',
  corba: 'Çorba',
  ana_yemek: 'Ana yemek',
  yan: 'Pilav & garnitür',
  salata_yogurt: 'Salata & yoğurt',
  meyve_kuruyemis: 'Meyve & kuruyemiş',
  atistirmalik: 'Atıştırmalık',
  tatli: 'Tatlı',
  icecek: 'İçecek',
  temel_gida: 'Temel gıda',
  // food_group (tatli ve icecek kategoriyle aynı anahtarı paylaşır)
  sebze: 'Sebze',
  meyve: 'Meyve',
  protein: 'Protein',
  tahil: 'Tahıl',
  sut: 'Süt',
  bakliyat: 'Bakliyat',
  yag: 'Yağ',
  kuruyemis: 'Kuruyemiş',
  hamurisi: 'Hamur işi',
  fastfood: 'Fast food',
  // diet_tag
  vejetaryen: 'Vejetaryen',
  vegan: 'Vegan',
  glutensiz: 'Glutensiz',
  laktozsuz: 'Laktozsuz',
  // meal_type
  kahvalti: 'Kahvaltı',
  ogle: 'Öğle',
  aksam: 'Akşam',
  ara: 'Ara öğün',
  // food_measure
  adet: 'Adet',
  dilim: 'Dilim',
  kase: 'Kâse',
  kasik: 'Kaşık',
  bardak: 'Bardak',
  fincan: 'Fincan',
  avuc: 'Avuç',
  porsiyon: 'Porsiyon',
  gram: 'Gram',
}

/** Sözlükte yoksa anahtarın kendisi okunur hâle getirilir, kaybolmaz. */
export function label(key: string) {
  return LABELS[key] ?? key.replace(/_/g, ' ')
}

/** Ölçü adı cümle içinde küçük harfle geçer: "1 kâse", "2 dilim". */
export function measureLabel(key: string) {
  const text = label(key)
  return text.charAt(0).toLocaleLowerCase('tr-TR') + text.slice(1)
}

export const DIMENSION_TITLES: Record<string, string> = {
  category: 'Kategori',
  group: 'Besin grubu',
  dietTag: 'Diyet uyumu',
  meal: 'Uygun öğün',
  measure: 'Doğal ölçü',
}

export const SORT_LABELS: Record<string, string> = {
  name: 'Ada göre',
  kcal: 'Enerjiye göre',
  protein: 'Proteine göre',
  fiber: 'Life göre',
  created: 'Eklenme tarihine göre',
}

export const number = (value: number) => value.toLocaleString('tr-TR')

/**
 * Ondalıkları gereksiz sıfır olmadan yazar: 30, 2,5.
 *
 * Basamak sayısı büyüklüğe göre seçilir. Gram ölçülü besinlerde değerler 1
 * GRAM içindir (migration 000025) ve küçüktür: 185 besnin lifi 0,05'in
 * altında. Sabit tek basamak bunların hepsini "0" gösterirdi.
 */
export function decimal(value: number) {
  const size = Math.abs(value)
  let digits = 1
  if (size >= 10) digits = 0
  else if (size < 0.1) digits = 3
  else if (size < 1) digits = 2
  return value.toLocaleString('tr-TR', { maximumFractionDigits: digits })
}

export function percent(part: number, whole: number) {
  if (!whole) return '%0'
  return `%${Math.round((part / whole) * 100)}`
}
