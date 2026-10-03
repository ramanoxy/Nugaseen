/**
 * Jembatan ke JSON Storage API.
 *
 * Semua panggilan keluar lewat sini (server-side), bukan dari browser —
 * jadi nggak ada masalah CORS dan providernya bisa ditukar di satu tempat.
 */

/** Crockford base32: tanpa I, L, O, U — biar nggak ketuker pas diketik ulang. */
const A32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export interface SyncProvider {
  name: string
  /** Cara ID penyimpanan diubah jadi kode yang enak diketik manusia. */
  codec: 'base32num' | 'raw'
  create(data: unknown): Promise<string>
  read(id: string): Promise<unknown>
  write(id: string, data: unknown): Promise<void>
}

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' }

/* ----------------------------------------------------- nitro (internal) --- */
function nitroProvider(): SyncProvider {
  return {
    name: 'nitro',
    codec: 'base32num',

    async create(data) {
      const storage = useStorage('sync')
      let id = ''
      let attempts = 0
      while (attempts < 10) {
        attempts++
        const num = Math.floor(100_000_000 + Math.random() * 900_000_000)
        id = num.toString()
        const has = await storage.hasItem(id)
        if (!has) break
      }
      await storage.setItem(id, data)
      return id
    },

    async read(id) {
      const storage = useStorage('sync')
      const item = await storage.getItem(id)
      if (!item) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Kode itu belum terdaftar atau sudah kadaluwarsa di penyimpanan.',
        })
      }
      return item
    },

    async write(id, data) {
      const storage = useStorage('sync')
      await storage.setItem(id, data)
    },
  }
}

/* --------------------------------------------------------- jsonblob.com --- */
const JSONBLOB = 'https://jsonblob.com/api/jsonBlob'

function jsonblobProvider(): SyncProvider {
  const fallback = nitroProvider()

  return {
    name: 'jsonblob',
    codec: 'base32num',

    async create(data) {
      try {
        const res = await $fetch.raw<unknown>(JSONBLOB, {
          method: 'POST',
          body: data,
          headers: JSON_HEADERS,
        })
        const id =
          res.headers.get('x-jsonblob') ||
          res.headers.get('location')?.split('/').filter(Boolean).pop() ||
          ''
        if (!/^\d+$/.test(id)) throw new Error('Penyimpanan nggak ngasih ID balik.')
        return id
      } catch {
        return fallback.create(data)
      }
    },

    async read(id) {
      try {
        return await $fetch(`${JSONBLOB}/${encodeURIComponent(id)}`, { headers: JSON_HEADERS })
      } catch {
        return fallback.read(id)
      }
    },

    async write(id, data) {
      try {
        await $fetch(`${JSONBLOB}/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: data,
          headers: JSON_HEADERS,
        })
      } catch {
        return fallback.write(id, data)
      }
    },
  }
}

/* ----------------------------------------------------- jsonstorage.net --- */
const JSONSTORAGE = 'https://api.jsonstorage.net/v1/json'

function jsonstorageProvider(apiKey: string): SyncProvider {
  const q = apiKey ? { apiKey } : undefined

  return {
    name: 'jsonstorage',
    codec: 'raw',

    async create(data) {
      const res = await $fetch<{ uri?: string }>(JSONSTORAGE, {
        method: 'POST',
        body: data,
        headers: JSON_HEADERS,
        query: q,
      })
      const id = (res?.uri ?? '').split('/v1/json/')[1] ?? ''
      if (!id) throw new Error('Penyimpanan nggak ngasih ID balik.')
      return id
    },

    read: (id) => $fetch(`${JSONSTORAGE}/${id}`, { headers: JSON_HEADERS, query: q }),

    async write(id, data) {
      await $fetch(`${JSONSTORAGE}/${id}`, {
        method: 'PUT',
        body: data,
        headers: JSON_HEADERS,
        query: q,
      })
    },
  }
}

export function getProvider(): SyncProvider {
  const cfg = useRuntimeConfig()
  const name = String(cfg.syncProvider || 'nitro').toLowerCase()
  if (name === 'jsonstorage') return jsonstorageProvider(String(cfg.syncApiKey || ''))
  if (name === 'jsonblob') return jsonblobProvider()
  return nitroProvider()
}

/* ----------------------------------------------------------- kode sync --- */

function badCode(): Error {
  return createError({ statusCode: 400, statusMessage: 'Kode sync-nya nggak kebaca.' })
}

/** ID penyimpanan → kode yang dipegang pengguna. */
export function idToCode(id: string, codec: SyncProvider['codec']): string {
  if (codec !== 'base32num' || !/^\d+$/.test(id)) return id
  let n = BigInt(id)
  if (n === 0n) return '0'
  let out = ''
  while (n > 0n) {
    out = A32[Number(n % 32n)]! + out
    n /= 32n
  }
  return out
}

/** Kode dari pengguna → ID penyimpanan. Toleran sama spasi & huruf mirip. */
export function codeToId(code: string, codec: SyncProvider['codec']): string {
  const raw = String(code ?? '').trim()
  if (!raw) throw badCode()

  if (codec !== 'base32num') {
    if (!/^[A-Za-z0-9_\-/]{8,140}$/.test(raw)) throw badCode()
    return raw
  }

  const clean = raw
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')
    .replace(/U/g, 'V')

  if (!clean || clean.length > 20) throw badCode()

  let n = 0n
  for (const ch of clean) {
    const i = A32.indexOf(ch)
    if (i < 0) throw badCode()
    n = n * 32n + BigInt(i)
  }
  return n.toString()
}

/** Status HTTP dari error ofetch, kalau ada. */
export function statusOf(e: unknown): number {
  const any = e as { statusCode?: number; status?: number; response?: { status?: number } }
  return any?.statusCode ?? any?.status ?? any?.response?.status ?? 0
}

/** Error jaringan mentah → pesan yang bisa dibaca orang. */
export function explain(e: unknown, what: 'baca' | 'tulis'): Error {
  const status = statusOf(e)
  if (status === 404 || status === 410) {
    return createError({
      statusCode: 404,
      statusMessage:
        'Kode itu udah nggak ada di penyimpanan. Blob gratis kehapus kalau nggak disentuh sebulan — bikin kode baru dari perangkat yang datanya masih lengkap.',
    })
  }
  if (status === 429) {
    return createError({
      statusCode: 429,
      statusMessage: 'Penyimpanan-nya minta istirahat (kena rate limit). Coba lagi bentar.',
    })
  }
  if (status >= 500) {
    return createError({
      statusCode: 502,
      statusMessage: 'Penyimpanan sync-nya lagi error. Data lokal kamu aman, coba lagi nanti.',
    })
  }
  return createError({
    statusCode: 502,
    statusMessage: `Gagal ${what} ke penyimpanan sync. Cek koneksi, data lokal kamu aman.`,
  })
}

/** Batas aman payload — provider gratisan biasanya nolak yang lebih besar. */
export const MAX_PAYLOAD = 900_000
