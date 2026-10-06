/**
 * Jembatan ke Penyimpanan Sync.
 *
 * Semua panggilan keluar lewat sini (server-side), bukan dari browser —
 * jadi nggak ada masalah CORS dan providernya bisa ditukar di satu tempat.
 *
 * Mendukung:
 * 1. Cloud Provider (restful-api.dev) — default zero-config, jalan di Vercel/serverless & antar perangkat
 * 2. Upstash Redis / Vercel KV — jika env KV_REST_API_* atau UPSTASH_* diset di Vercel
 * 3. Nitro (internal) — untuk dev server lokal
 * 4. jsonstorage.net — jika SYNC_API_KEY diset
 */

/** Crockford base32: tanpa I, L, O, U — biar nggak ketuker pas diketik ulang. */
const A32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export interface SyncProvider {
  name: string
  /** Cara ID penyimpanan diubah jadi kode yang enak diketik manusia. */
  codec: 'base32num' | 'hex32' | 'raw'
  create(data: unknown): Promise<string>
  read(id: string): Promise<unknown>
  write(id: string, data: unknown): Promise<void>
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Nugaseen/1.0',
}

/* ------------------------------------------- restful-api.dev (free cloud) --- */
const CLOUD_URL = 'https://api.restful-api.dev/objects'

function cloudProvider(): SyncProvider {
  return {
    name: 'cloud',
    codec: 'hex32',

    async create(data) {
      const res = await $fetch<{ id?: string }>(CLOUD_URL, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: { name: 'nugaseen-sync', data },
        timeout: 8000,
      })
      if (!res?.id) throw new Error('Penyimpanan awan nggak ngasih ID balik.')
      return res.id
    },

    async read(id) {
      const res = await $fetch<{ data?: unknown }>(`${CLOUD_URL}/${encodeURIComponent(id)}`, {
        headers: JSON_HEADERS,
        timeout: 8000,
      })
      if (!res?.data) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Kode sync itu tidak ditemukan di awan. Pastikan kodenya benar.',
        })
      }
      return res.data
    },

    async write(id, data) {
      await $fetch(`${CLOUD_URL}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: { name: 'nugaseen-sync', data },
        timeout: 8000,
      })
    },
  }
}

/* ----------------------------------------------------- Vercel KV / Upstash --- */
function upstashProvider(url: string, token: string): SyncProvider {
  const cleanUrl = url.replace(/\/$/, '')
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  return {
    name: 'upstash',
    codec: 'base32num',

    async create(data) {
      const id = Math.floor(100_000_000 + Math.random() * 900_000_000).toString()
      await $fetch(cleanUrl, {
        method: 'POST',
        headers,
        body: ['SET', id, JSON.stringify(data)],
        timeout: 6000,
      })
      return id
    },

    async read(id) {
      const res = await $fetch<{ result?: string | null }>(cleanUrl, {
        method: 'POST',
        headers,
        body: ['GET', id],
        timeout: 6000,
      })
      if (!res || res.result === null || res.result === undefined) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Kode sync itu tidak ditemukan di penyimpanan.',
        })
      }
      return typeof res.result === 'string' ? JSON.parse(res.result) : res.result
    },

    async write(id, data) {
      await $fetch(cleanUrl, {
        method: 'POST',
        headers,
        body: ['SET', id, JSON.stringify(data)],
        timeout: 6000,
      })
    },
  }
}

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
  // 1. Cek Vercel KV / Upstash Redis env (jika user mengaktifkan KV di Vercel)
  const kvUrl =
    process.env.KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.UPSTASH_REDIS_REST_URL_URL
  const kvToken =
    process.env.KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN
  if (kvUrl && kvToken) {
    return upstashProvider(kvUrl, kvToken)
  }

  const cfg = useRuntimeConfig()
  const name = String(cfg.syncProvider || 'cloud').toLowerCase()

  if (name === 'jsonstorage' && cfg.syncApiKey) {
    return jsonstorageProvider(String(cfg.syncApiKey))
  }

  // 2. Di Vercel atau serverless: gunakan cloudProvider (tidak butuh fs dan zero-config)
  if (process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return cloudProvider()
  }

  // 3. Jika diset nitro lokal:
  if (name === 'nitro') {
    return nitroProvider()
  }

  // Default: cloudProvider agar bisa sync antar perangkat nyata secara gratis
  return cloudProvider()
}

/* ----------------------------------------------------------- kode sync --- */

function badCode(): Error {
  return createError({ statusCode: 400, statusMessage: 'Kode sync-nya nggak kebaca.' })
}

const B0 = BigInt(0)
const B32 = BigInt(32)

/** ID penyimpanan → kode yang dipegang pengguna. */
export function idToCode(id: string, codec: SyncProvider['codec']): string {
  if (codec === 'base32num' && /^\d+$/.test(id)) {
    let n = BigInt(id)
    if (n === B0) return '0'
    let out = ''
    while (n > B0) {
      out = A32[Number(n % B32)]! + out
      n /= B32
    }
    return out
  }

  if (codec === 'hex32' && /^[0-9a-fA-F]{32}$/.test(id)) {
    let n = BigInt('0x' + id)
    let out = ''
    while (n > B0) {
      out = A32[Number(n % B32)]! + out
      n /= B32
    }
    return out
  }

  return id
}

/** Kode dari pengguna → ID penyimpanan. Toleran sama spasi & huruf mirip. */
export function codeToId(code: string, codec: SyncProvider['codec']): string {
  const raw = String(code ?? '').trim()
  if (!raw) throw badCode()

  if (codec === 'hex32') {
    const clean = raw
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '')
      .replace(/[IL]/g, '1')
      .replace(/O/g, '0')
      .replace(/U/g, 'V')

    if (!clean) throw badCode()
    let n = B0
    for (const ch of clean) {
      const i = A32.indexOf(ch)
      if (i < 0) throw badCode()
      n = n * B32 + BigInt(i)
    }
    return n.toString(16).padStart(32, '0')
  }

  if (codec === 'base32num') {
    const clean = raw
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, '')
      .replace(/[IL]/g, '1')
      .replace(/O/g, '0')
      .replace(/U/g, 'V')

    if (!clean || clean.length > 20) throw badCode()
    let n = B0
    for (const ch of clean) {
      const i = A32.indexOf(ch)
      if (i < 0) throw badCode()
      n = n * B32 + BigInt(i)
    }
    return n.toString()
  }

  if (!/^[A-Za-z0-9_\-/]{8,140}$/.test(raw)) throw badCode()
  return raw
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
        'Kode itu belum ada atau sudah kadaluwarsa di awan. Bikin kode baru dari perangkat yang datanya masih lengkap.',
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
      statusMessage: 'Penyimpanan sync lagi error. Data lokal kamu aman, coba lagi nanti.',
    })
  }
  return createError({
    statusCode: 502,
    statusMessage: `Gagal ${what} ke penyimpanan sync. Cek koneksi, data lokal kamu aman.`,
  })
}

/** Batas aman payload — provider gratisan biasanya nolak yang lebih besar. */
export const MAX_PAYLOAD = 900_000
