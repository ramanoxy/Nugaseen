/**
 * Bentuk data yang dipakai bareng-bareng sama browser dan server.
 */

/** Perasaan yang dicatat pas tugas dikelarin. Warnanya di app/utils/mood.ts */
export type MoodKey = 'puas' | 'santai' | 'biasa' | 'capek' | 'kesel' | 'stres'

export type Priority = 'low' | 'mid' | 'high'

export interface Reflection {
  mood: MoodKey
  /** "Gimana rasanya ngerjain ini?" — wajib diisi. */
  felt: string
  /** "Ada yang mau diomelin?" — boleh kosong. */
  vent: string
  /** Seberapa berat, 1–5. */
  weight: number
  /** Lama ngerjain dalam menit. null kalau nggak dicatat. */
  minutes: number | null
}

export interface Task {
  id: string
  title: string
  note: string
  /** Label bebas: "kuliah", "kerjaan", "rumah", ... */
  tag: string
  priority: Priority
  /** Tenggat, format yyyy-mm-dd. null kalau nggak ada. */
  due: string | null
  createdAt: string
  /** Terakhir diubah di perangkat ini — dipakai buat nentuin pemenang saat sync. */
  touchedAt: string
  /** Terisi begitu tugas dikelarin. Isinya nggak pernah dihapus. */
  doneAt: string | null
  reflection: Reflection | null
  /** Nisan. Tugas yang dibuang disimpan sebagai tombstone biar hapusnya ikut ter-sync. */
  deletedAt: string | null
}

export interface Snapshot {
  v: 1
  tasks: Task[]
  updatedAt: string
}

export const SNAPSHOT_VERSION = 1 as const

export function emptySnapshot(): Snapshot {
  return { v: SNAPSHOT_VERSION, tasks: [], updatedAt: new Date(0).toISOString() }
}

/** Jaga-jaga kalau JSON dari jaringan isinya ngawur. */
export function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  return s.v === SNAPSHOT_VERSION && Array.isArray(s.tasks) && typeof s.updatedAt === 'string'
}
