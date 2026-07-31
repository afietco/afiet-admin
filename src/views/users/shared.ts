/** Kullanıcı ekranlarının ortak biçimlendiricileri. */

const day = 86_400_000

export const dateFmt = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
export const dateTimeFmt = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
})
export const timeFmt = new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' })

export const date = (value: string | null | undefined) => (value ? dateFmt.format(new Date(value)) : '—')
export const dateTime = (value: string | null | undefined) => (value ? dateTimeFmt.format(new Date(value)) : '—')
export const num = (value: number) => value.toLocaleString('tr-TR')

/** "bugün" / "dün" / "12 gün önce"; tabloda tarihten daha çabuk okunuyor. */
export function ago(value: string | null | undefined, now = Date.now()): string {
  if (!value) return '—'
  const days = Math.floor((now - new Date(value).getTime()) / day)
  if (days <= 0) return 'bugün'
  if (days === 1) return 'dün'
  if (days < 30) return `${String(days)} gün önce`
  const months = Math.floor(days / 30)
  if (months < 12) return `${String(months)} ay önce`
  return `${String(Math.floor(months / 12))} yıl önce`
}

/** 4835 → "1 sa 20 dk", 95 → "1 dk 35 sn". */
export function duration(seconds: number): string {
  if (seconds < 60) return `${String(Math.round(seconds))} sn`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${String(minutes)} dk ${String(seconds % 60)} sn`
  return `${String(Math.floor(minutes / 60))} sa ${String(minutes % 60)} dk`
}

export const initial = (user: { emoji?: string | null; displayName?: string | null; email: string }) =>
  user.emoji || (user.displayName || user.email)[0].toLocaleUpperCase('tr')

/** Yaş — doğum tarihi verilmişse. Profilde "1994 (32)" biçiminde okunuyor. */
export function age(birthDate: string | null): number | null {
  if (!birthDate) return null
  const born = new Date(birthDate)
  const now = new Date()
  let years = now.getFullYear() - born.getFullYear()
  const beforeBirthday =
    now.getMonth() < born.getMonth() ||
    (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())
  if (beforeBirthday) years -= 1
  return years >= 0 && years < 130 ? years : null
}

export const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0)
