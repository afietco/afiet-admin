import { webRequest } from './webApi'

/**
 * Sürüm kapısı istemcisi (afiet-web).
 *
 * Tipler web tarafındaki `shared/types/appVersion.ts` ile BİREBİR aynıdır ve
 * o da mobildeki `@afiet/core > AppVersionGate` ile aynıdır: uygulama bu
 * gövdeyi olduğu gibi diske yazıp kararı ondan veriyor, yani alan adı üç
 * yerde birden değişir.
 */

export interface PlatformVersionGate {
  latestVersion: string | null
  minimumVersion: string | null
  storeUrl: string | null
  message: string | null
}

/**
 * Uygulamanın sürüm kapısıyla birlikte okuduğu anahtarlar. Bugün tek anahtar
 * var: yeni hesapta Bugün panosu bölüm bölüm mü açılsın (yayınlandığı gibi),
 * hepsi birden mi. Boş değer "yayınlandığı gibi" demektir.
 */
export interface AppFlags {
  ftueDoors: 'progressive' | 'open' | null
}

export interface AppVersionGate {
  ios: PlatformVersionGate
  android: PlatformVersionGate
  flags?: AppFlags | null
}

export type AppVersionPlatform = 'ios' | 'android'

export const PLATFORM_LABELS: Record<AppVersionPlatform, string> = {
  ios: 'iOS · App Store',
  android: 'Android · Google Play',
}

export function emptyPlatformGate(): PlatformVersionGate {
  return { latestVersion: null, minimumVersion: null, storeUrl: null, message: null }
}

export const appVersionApi = {
  get: () => webRequest<{ gate: AppVersionGate }>('/api/admin/app-version'),
  put: (platform: AppVersionPlatform, value: PlatformVersionGate) =>
    webRequest<{ gate: AppVersionGate }>(`/api/admin/app-version/${platform}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),
  putFlags: (value: AppFlags) =>
    webRequest<{ gate: AppVersionGate }>('/api/admin/app-version/flags', {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),
}

export const FTUE_DOOR_OPTIONS: { value: NonNullable<AppFlags['ftueDoors']>; label: string }[] = [
  { value: 'progressive', label: 'Bölüm bölüm (yayınlandığı gibi)' },
  { value: 'open', label: 'Hepsi açık' },
]

/** Panelde yazılanı gövdeye çevirir; boş alan "kural yok" demektir. Biçim
 *  denetiminin TEK yetkilisi sunucudur, buradaki yalnız anlık geri bildirim. */
export function versionInputValue(value: string): string | null {
  const trimmed = value.trim().replace(/^v/i, '')
  return trimmed === '' ? null : trimmed
}

export function isVersionShaped(value: string): boolean {
  const trimmed = value.trim().replace(/^v/i, '')
  return trimmed === '' || /^\d+(\.\d+)*$/.test(trimmed)
}

function compare(a: string, b: string): number {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0)
    if (difference !== 0) return difference < 0 ? -1 : 1
  }
  return 0
}

export type Verdict = 'none' | 'suggested' | 'required'

/**
 * Uygulamadaki `decideAppUpdate`in panel aynası: verilen sürümü çalıştıran
 * birinin ne göreceğini söyler. Panelde iki sayı yerine cümle görünsün diye
 * var; kararın kaynağı her zaman uygulamadaki koddur.
 */
export function verdictFor(gate: PlatformVersionGate, runningVersion: string): Verdict {
  if (!isVersionShaped(runningVersion) || runningVersion.trim() === '') return 'none'
  const running = runningVersion.trim().replace(/^v/i, '')
  if (gate.minimumVersion && compare(running, gate.minimumVersion) < 0) return 'required'
  if (gate.latestVersion && compare(running, gate.latestVersion) < 0) return 'suggested'
  return 'none'
}

export const VERDICT_COPY: Record<Verdict, { label: string; detail: string; tone: string }> = {
  none: {
    label: 'Hiçbir şey görmez',
    detail: 'Uygulama normal açılır.',
    tone: 'muted',
  },
  suggested: {
    label: 'Atlanabilir kart',
    detail: '"Şimdi değil" derse aynı sürüm için 3 gün sorulmaz.',
    tone: 'blue',
  },
  required: {
    label: 'Kapatılamayan duvar',
    detail: 'Uygulamayı kullanamaz; tek yol mağazadan güncellemek.',
    tone: 'coral',
  },
}
