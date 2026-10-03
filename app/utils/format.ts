/** Format tanggal & durasi. Semua pakai waktu lokal perangkat. */

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
] as const

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
] as const

const pad = (n: number) => String(n).padStart(2, '0')

/** 'yyyy-mm-dd' hari ini, waktu lokal. */
export function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Baca 'yyyy-mm-dd' sebagai tengah hari lokal.
 * (`new Date('2026-10-03')` dibaca sebagai UTC midnight — di Indonesia itu
 * bisa kegeser jadi tanggal 2. Tengah hari aman di semua zona waktu.)
 */
export function parseDay(day: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Selisih hari dari hari ini. Negatif = sudah lewat. */
export function daysFromToday(day: string): number | null {
  const target = parseDay(day)
  if (!target) return null
  const now = parseDay(todayKey())!
  return Math.round((target.getTime() - now.getTime()) / 86_400_000)
}

/** Teks tenggat yang enak dibaca: 'hari ini', 'telat 3 hari', '12 Okt'. */
export function dueLabel(day: string): string {
  const diff = daysFromToday(day)
  if (diff === null) return day
  if (diff === 0) return 'hari ini'
  if (diff === 1) return 'besok'
  if (diff === 2) return 'bentar lagi · 2 hari'
  if (diff === -1) return 'telat 1 hari'
  if (diff < 0) return `telat ${Math.abs(diff)} hari`
  if (diff <= 7) return `${diff} hari lagi`
  return shortDay(day)
}

/** '12 Okt' — tahun ikut kalau beda dari tahun ini. */
export function shortDay(day: string): string {
  const d = parseDay(day)
  if (!d) return day
  const sameYear = d.getFullYear() === new Date().getFullYear()
  const base = `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`
  return sameYear ? base : `${base} ${d.getFullYear()}`
}

/** '12 Okt 2026, 14:03' dari ISO datetime. */
export function stamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 'barusan', '5 menit lalu', '2 jam lalu', lebih dari itu pakai tanggal. */
export function ago(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const secs = Math.round((Date.now() - d.getTime()) / 1000)
  if (secs < 45) return 'barusan'
  if (secs < 3600) return `${Math.round(secs / 60)} menit lalu`
  if (secs < 86_400) return `${Math.round(secs / 3600)} jam lalu`
  if (secs < 604_800) return `${Math.round(secs / 86_400)} hari lalu`
  return stamp(iso)
}

/** 'yyyy-mm' lokal dari ISO datetime — kunci pengelompokan arsip. */
export function monthKeyOf(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '0000-00'
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function thisMonthKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** 'Oktober 2026' dari 'yyyy-mm'. */
export function monthLabel(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key)
  if (!m) return key
  return `${MONTHS[Number(m[2]) - 1] ?? key} ${m[1]}`
}

/** '1j 20m' dari menit. */
export function duration(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (!h) return `${m}m`
  if (!m) return `${h}j`
  return `${h}j ${m}m`
}

/** '6 tugas' / '1 tugas' — bahasa Indonesia nggak butuh plural, tapi tetap rapi. */
export function plural(n: number, word: string): string {
  return `${n} ${word}`
}
