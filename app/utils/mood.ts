import type { MoodKey, Priority } from '~~/shared/types'

/**
 * Enam mood disusun di satu sumbu: enak → nggak enak.
 * Urutannya penting — warnanya ramp diverging (hijau ‹ netral › merah),
 * jadi sebaris blok mood langsung kebaca "bulan ini berat apa nggak"
 * tanpa harus baca legenda dulu.
 */
export interface MoodMeta {
  key: MoodKey
  label: string
  blurb: string
  /** Posisi di sumbu, 1 = paling enak. */
  rank: number
  /** Dipakai buat `--c` di CSS. */
  color: string
}

export const MOODS: readonly MoodMeta[] = [
  { key: 'puas', label: 'Puas', blurb: 'lega, worth it juga', rank: 1, color: 'var(--m-puas)' },
  { key: 'santai', label: 'Santai', blurb: 'ngalir aja, nggak berat', rank: 2, color: 'var(--m-santai)' },
  { key: 'biasa', label: 'Biasa aja', blurb: 'nggak ngerasain apa-apa', rank: 3, color: 'var(--m-biasa)' },
  { key: 'capek', label: 'Capek', blurb: 'kelar tapi abis tenaga', rank: 4, color: 'var(--m-capek)' },
  { key: 'stres', label: 'Stres', blurb: 'kepala penuh, kepikiran terus', rank: 5, color: 'var(--m-stres)' },
  { key: 'kesel', label: 'Kesel', blurb: 'ngeselin dari awal sampe akhir', rank: 6, color: 'var(--m-kesel)' },
] as const

const MOOD_MAP = new Map<string, MoodMeta>(MOODS.map((m) => [m.key, m]))

export function mood(key: MoodKey | null | undefined): MoodMeta {
  return (key && MOOD_MAP.get(key)) || MOODS[2]!
}

export function isMoodKey(v: unknown): v is MoodKey {
  return typeof v === 'string' && MOOD_MAP.has(v)
}

/** Rata-rata rank mood → warna ringkasan buat satu bulan. */
export function moodOfAverage(ranks: number[]): MoodMeta {
  if (!ranks.length) return MOODS[2]!
  const avg = ranks.reduce((a, b) => a + b, 0) / ranks.length
  const nearest = MOODS.reduce((best, m) =>
    Math.abs(m.rank - avg) < Math.abs(best.rank - avg) ? m : best,
  )
  return nearest
}

/* ---------------------------------------------------------- prioritas --- */

export interface PriorityMeta {
  key: Priority
  label: string
  /** Makin tinggi makin duluan muncul. */
  rank: number
}

export const PRIORITIES: readonly PriorityMeta[] = [
  { key: 'high', label: 'Genting', rank: 3 },
  { key: 'mid', label: 'Lumayan', rank: 2 },
  { key: 'low', label: 'Nyantai', rank: 1 },
] as const

const PRIO_MAP = new Map<string, PriorityMeta>(PRIORITIES.map((p) => [p.key, p]))

export function priority(key: Priority | null | undefined): PriorityMeta {
  return (key && PRIO_MAP.get(key)) || PRIORITIES[2]!
}

export function isPriority(v: unknown): v is Priority {
  return typeof v === 'string' && PRIO_MAP.has(v)
}

export const WEIGHT_LABELS = ['', 'enteng', 'agak', 'sedang', 'berat', 'brutal'] as const

export function weightLabel(w: number): string {
  return WEIGHT_LABELS[Math.min(5, Math.max(1, Math.round(w)))] ?? 'sedang'
}
