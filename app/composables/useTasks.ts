import type { Priority, Reflection, Snapshot, Task } from '~~/shared/types'
import { SNAPSHOT_VERSION, emptySnapshot } from '~~/shared/types'
import type { MoodMeta } from '~/utils/mood'

const LS_KEY = 'nugaseen:snapshot:v1'

const now = () => new Date().toISOString()

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/* ------------------------------------------------- pembersih data masuk ---
   Snapshot bisa datang dari jaringan atau dari file yang diimpor, jadi
   setiap field dicek ulang. Yang nggak masuk akal dibuang, bukan dipercaya. */

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

function isoOr(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback
  return Number.isNaN(new Date(v).getTime()) ? fallback : v
}

function isoOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null
  return Number.isNaN(new Date(v).getTime()) ? null : v
}

function dayOrNull(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

function clampInt(v: unknown, lo: number, hi: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(hi, Math.max(lo, Math.round(n)))
}

function minutesOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(60 * 24 * 14, Math.round(n))
}

function coerceReflection(raw: unknown): Reflection | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!isMoodKey(r.mood)) return null
  return {
    mood: r.mood,
    felt: str(r.felt, 4000),
    vent: str(r.vent, 4000),
    weight: clampInt(r.weight, 1, 5, 3),
    minutes: minutesOrNull(r.minutes),
  }
}

function coerceTask(raw: unknown): Task | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = str(r.id, 120).trim()
  const title = str(r.title, 300).trim()
  if (!id || !title) return null

  const createdAt = isoOr(r.createdAt, now())
  const doneAt = isoOrNull(r.doneAt)
  const reflection = coerceReflection(r.reflection)

  return {
    id,
    title,
    note: str(r.note, 2000),
    tag: str(r.tag, 40).trim(),
    priority: isPriority(r.priority) ? r.priority : 'mid',
    due: dayOrNull(r.due),
    createdAt,
    touchedAt: isoOr(r.touchedAt, createdAt),
    // Tugas kelar tanpa refleksi nggak mungkin ada di app ini — kalau
    // ketemu, dibalikin jadi aktif daripada bikin arsip bolong.
    doneAt: doneAt && reflection ? doneAt : null,
    reflection: doneAt && reflection ? reflection : null,
    deletedAt: isoOrNull(r.deletedAt),
  }
}

export function coerceSnapshot(raw: unknown): Snapshot {
  if (!raw || typeof raw !== 'object') return emptySnapshot()
  const s = raw as Record<string, unknown>
  const list = Array.isArray(s.tasks) ? s.tasks : []
  const tasks: Task[] = []
  const seen = new Set<string>()
  for (const item of list.slice(0, 5000)) {
    const t = coerceTask(item)
    if (t && !seen.has(t.id)) {
      seen.add(t.id)
      tasks.push(t)
    }
  }
  return {
    v: SNAPSHOT_VERSION,
    tasks,
    updatedAt: isoOr(s.updatedAt, new Date(0).toISOString()),
  }
}

/** Gabung dua snapshot per-tugas: yang paling baru disentuh menang. */
export function mergeSnapshots(local: Snapshot, remote: Snapshot): Snapshot {
  const map = new Map<string, Task>()
  for (const t of local.tasks) map.set(t.id, t)
  for (const r of remote.tasks) {
    const mine = map.get(r.id)
    if (!mine || r.touchedAt > mine.touchedAt) map.set(r.id, r)
  }
  return {
    v: SNAPSHOT_VERSION,
    tasks: [...map.values()],
    updatedAt: local.updatedAt > remote.updatedAt ? local.updatedAt : remote.updatedAt,
  }
}

function loadLocal(): Snapshot {
  if (!import.meta.client) return emptySnapshot()
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return emptySnapshot()
    return coerceSnapshot(JSON.parse(raw))
  } catch {
    return emptySnapshot()
  }
}

/** Urutan daftar aktif: yang paling mendesak di atas. */
function cmpActive(a: Task, b: Task): number {
  const da = a.due ? daysFromToday(a.due) : null
  const db = b.due ? daysFromToday(b.due) : null
  if (da !== null && db === null) return -1
  if (da === null && db !== null) return 1
  if (da !== null && db !== null && da !== db) return da - db
  const pa = priority(a.priority).rank
  const pb = priority(b.priority).rank
  if (pa !== pb) return pb - pa
  return b.createdAt.localeCompare(a.createdAt)
}

export interface NewTaskInput {
  title: string
  note?: string
  tag?: string
  priority?: Priority
  due?: string | null
}

export interface MonthGroup {
  key: string
  label: string
  tasks: Task[]
}

export interface Stats {
  count: number
  minutes: number
  avgWeight: number
  /** Jumlah per mood, urut sesuai sumbu enak → nggak enak. */
  moodCounts: { meta: MoodMeta; n: number }[]
  top: MoodMeta | null
}

export function useTasks() {
  const snapshot = useState<Snapshot>('nuga:snapshot', loadLocal)

  /* ---------------------------------------------------------- turunan --- */

  const live = computed(() => snapshot.value.tasks.filter((t) => !t.deletedAt))

  const active = computed(() => live.value.filter((t) => !t.doneAt).sort(cmpActive))

  const finished = computed(() =>
    live.value
      .filter((t) => t.doneAt)
      .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')),
  )

  const months = computed<MonthGroup[]>(() => {
    const buckets = new Map<string, Task[]>()
    for (const t of finished.value) {
      const key = monthKeyOf(t.doneAt!)
      const bucket = buckets.get(key)
      if (bucket) bucket.push(t)
      else buckets.set(key, [t])
    }
    return [...buckets.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, tasks]) => ({ key, label: monthLabel(key), tasks }))
  })

  const tags = computed(() =>
    [...new Set(live.value.map((t) => t.tag).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'id'),
    ),
  )

  const lateCount = computed(
    () => active.value.filter((t) => t.due && (daysFromToday(t.due) ?? 0) < 0).length,
  )

  function statsOf(list: Task[]): Stats {
    const refs = list.map((t) => t.reflection).filter((r): r is Reflection => !!r)
    const counts = new Map<string, number>()
    let minutes = 0
    let weight = 0
    for (const r of refs) {
      counts.set(r.mood, (counts.get(r.mood) ?? 0) + 1)
      minutes += r.minutes ?? 0
      weight += r.weight
    }
    const moodCounts = MOODS.map((meta) => ({ meta, n: counts.get(meta.key) ?? 0 }))
    const top = [...moodCounts].sort((a, b) => b.n - a.n)[0]
    return {
      count: list.length,
      minutes,
      avgWeight: refs.length ? weight / refs.length : 0,
      moodCounts,
      top: top && top.n > 0 ? top.meta : null,
    }
  }

  /* --------------------------------------------------------- perubahan --- */

  function commit(tasks: Task[]) {
    snapshot.value = { v: SNAPSHOT_VERSION, tasks, updatedAt: now() }
  }

  function touch(id: string, change: (t: Task) => Task) {
    commit(
      snapshot.value.tasks.map((t) => (t.id === id ? { ...change(t), touchedAt: now() } : t)),
    )
  }

  function add(input: NewTaskInput): Task | null {
    const title = input.title.trim().slice(0, 300)
    if (!title) return null
    const ts = now()
    const task: Task = {
      id: newId(),
      title,
      note: (input.note ?? '').trim().slice(0, 2000),
      tag: (input.tag ?? '').trim().slice(0, 40),
      priority: input.priority ?? 'mid',
      due: dayOrNull(input.due) ?? null,
      createdAt: ts,
      touchedAt: ts,
      doneAt: null,
      reflection: null,
      deletedAt: null,
    }
    commit([task, ...snapshot.value.tasks])
    return task
  }

  function update(id: string, patch: Partial<NewTaskInput>) {
    touch(id, (t) => ({
      ...t,
      title: patch.title !== undefined ? patch.title.trim().slice(0, 300) || t.title : t.title,
      note: patch.note !== undefined ? patch.note.trim().slice(0, 2000) : t.note,
      tag: patch.tag !== undefined ? patch.tag.trim().slice(0, 40) : t.tag,
      priority: patch.priority ?? t.priority,
      due: patch.due !== undefined ? dayOrNull(patch.due) : t.due,
    }))
  }

  /** Kelarin tugas. Refleksi wajib — itu inti app-nya. */
  function finish(id: string, reflection: Reflection) {
    const clean = coerceReflection(reflection)
    if (!clean) return false
    touch(id, (t) => ({ ...t, doneAt: t.doneAt ?? now(), reflection: clean }))
    return true
  }

  /** Perbaiki catatan rasanya tanpa mengubah tanggal kelar. */
  function reflectAgain(id: string, reflection: Reflection) {
    const clean = coerceReflection(reflection)
    if (!clean) return false
    touch(id, (t) => ({ ...t, reflection: clean }))
    return true
  }

  /** Balikin ke daftar aktif. Catatan rasanya dibuang bareng status kelarnya. */
  function reopen(id: string) {
    touch(id, (t) => ({ ...t, doneAt: null, reflection: null }))
  }

  /** Buang tugas. Disimpan sebagai nisan biar hapusnya ikut ter-sync. */
  function remove(id: string) {
    touch(id, (t) => ({ ...t, deletedAt: now() }))
  }

  function restore(id: string) {
    touch(id, (t) => ({ ...t, deletedAt: null }))
  }

  /* ------------------------------------------------------ sync & berkas --- */

  function replaceWith(next: Snapshot) {
    snapshot.value = coerceSnapshot(next)
  }

  function mergeWith(remote: unknown): { added: number; updated: number } {
    const clean = coerceSnapshot(remote)
    const before = new Map(snapshot.value.tasks.map((t) => [t.id, t.touchedAt]))
    const merged = mergeSnapshots(snapshot.value, clean)
    let added = 0
    let updated = 0
    for (const t of merged.tasks) {
      const prev = before.get(t.id)
      if (prev === undefined) added++
      else if (prev !== t.touchedAt) updated++
    }
    snapshot.value = merged
    return { added, updated }
  }

  function toJSON(): string {
    return JSON.stringify(snapshot.value, null, 2)
  }

  function fromJSON(text: string, mode: 'merge' | 'replace' = 'merge') {
    const parsed = JSON.parse(text) as unknown
    if (mode === 'replace') replaceWith(parsed as Snapshot)
    else mergeWith(parsed)
  }

  function persist() {
    if (!import.meta.client) return
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(snapshot.value))
      return true
    } catch {
      return false
    }
  }

  return {
    snapshot,
    live,
    active,
    finished,
    months,
    tags,
    lateCount,
    statsOf,
    add,
    update,
    finish,
    reflectAgain,
    reopen,
    remove,
    restore,
    replaceWith,
    mergeWith,
    toJSON,
    fromJSON,
    persist,
  }
}
