import type { Snapshot } from '~~/shared/types'

const LS_CODE = 'nugaseen:code:v1'
const LS_AUTO = 'nugaseen:auto:v1'
const LS_LAST = 'nugaseen:lastsync:v1'

function readLS(key: string): string {
  if (!import.meta.client) return ''
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function writeLS(key: string, value: string) {
  if (!import.meta.client) return
  try {
    if (value) localStorage.setItem(key, value)
    else localStorage.removeItem(key)
  } catch {
    /* mode privat / kuota penuh — nggak apa-apa, cuma nggak keinget */
  }
}

/** Pecah kode jadi kelompok 4 biar gampang dibaca & diketik ulang. */
export function prettyCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, '$1 ')
}

function errText(e: unknown): string {
  const any = e as { data?: { message?: string }; statusMessage?: string; message?: string }
  return (
    any?.data?.message ||
    any?.statusMessage ||
    any?.message ||
    'Gagal nyambung ke penyimpanan sync.'
  )
}

/**
 * Sync lewat JSON Storage API.
 *
 * Sumber kebenaran tetap localStorage di perangkat ini — jaringan cuma
 * dipakai buat nyalin antar perangkat. Jadi kalau servernya mati atau
 * kodenya kadaluwarsa, catatan kamu tetap utuh.
 */
export function useSync() {
  const tasks = useTasks()
  const toast = useToast()

  const code = useState<string>('nuga:code', () => readLS(LS_CODE))
  const auto = useState<boolean>('nuga:auto', () => readLS(LS_AUTO) === '1')
  const lastAt = useState<string>('nuga:lastsync', () => readLS(LS_LAST))
  const busy = useState<'' | 'push' | 'pull'>('nuga:busy', () => '')
  const error = useState<string>('nuga:syncerr', () => '')

  const linked = computed(() => !!code.value)

  function setCode(next: string) {
    code.value = next
    writeLS(LS_CODE, next)
  }

  function setAuto(next: boolean) {
    auto.value = next
    writeLS(LS_AUTO, next ? '1' : '')
  }

  function markSynced() {
    lastAt.value = new Date().toISOString()
    writeLS(LS_LAST, lastAt.value)
  }

  /** Kirim snapshot lokal ke awan. Bikin kode baru kalau belum punya. */
  async function push(silent = false): Promise<boolean> {
    if (busy.value) return false
    busy.value = 'push'
    error.value = ''
    try {
      const res = await $fetch<{ code: string }>('/api/sync', {
        method: 'POST',
        body: { code: code.value || undefined, snapshot: tasks.snapshot.value },
      })
      setCode(res.code)
      markSynced()
      if (!silent) toast.ok('Kelar — catatan udah naik ke awan.')
      return true
    } catch (e) {
      error.value = errText(e)
      if (!silent) toast.bad(error.value)
      return false
    } finally {
      busy.value = ''
    }
  }

  /** Tarik dari awan lalu gabung. Yang paling baru disentuh yang menang. */
  async function pull(candidate?: string, silent = false): Promise<boolean> {
    const want = (candidate ?? code.value).trim()
    if (!want) {
      error.value = 'Belum ada kode sync di perangkat ini.'
      if (!silent) toast.bad(error.value)
      return false
    }
    if (busy.value) return false
    busy.value = 'pull'
    error.value = ''
    try {
      const res = await $fetch<{ code: string; snapshot: Snapshot }>('/api/sync', {
        query: { code: want },
      })
      const diff = tasks.mergeWith(res.snapshot)
      setCode(res.code)
      markSynced()
      if (!silent) {
        const bits = [
          diff.added ? `${diff.added} baru` : '',
          diff.updated ? `${diff.updated} diperbarui` : '',
        ].filter(Boolean)
        toast.ok(bits.length ? `Ketarik: ${bits.join(', ')}.` : 'Udah sama, nggak ada yang berubah.')
      }
      return true
    } catch (e) {
      error.value = errText(e)
      if (!silent) toast.bad(error.value)
      return false
    } finally {
      busy.value = ''
    }
  }

  /** Dua arah: tarik dulu, gabung, baru dorong hasil gabungannya. */
  async function syncNow(silent = false): Promise<boolean> {
    if (code.value) {
      const pulled = await pull(code.value, true)
      if (!pulled) {
        if (!silent) toast.bad(error.value)
        return false
      }
    }
    const pushed = await push(true)
    if (!pushed) {
      if (!silent) toast.bad(error.value)
      return false
    }
    if (!silent) toast.ok('Sinkron. Perangkat lain tinggal tarik pakai kode yang sama.')
    return true
  }

  /** Lepas kode dari perangkat ini. Data lokal nggak disentuh. */
  function unlink() {
    setCode('')
    setAuto(false)
    lastAt.value = ''
    writeLS(LS_LAST, '')
  }

  return { code, auto, lastAt, busy, error, linked, setCode, setAuto, push, pull, syncNow, unlink }
}
