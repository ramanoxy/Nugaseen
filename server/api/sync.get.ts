import { isSnapshot } from '~~/shared/types'

/** Tarik snapshot dari penyimpanan: GET /api/sync?code=XXXXXXX */
export default defineEventHandler(async (event) => {
  const { code } = getQuery(event)
  if (typeof code !== 'string' || !code.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Kode sync-nya belum diisi.' })
  }

  const provider = getProvider()
  const id = codeToId(code, provider.codec)

  let raw: unknown
  try {
    raw = await provider.read(id)
  } catch (e) {
    throw explain(e, 'baca')
  }

  if (!isSnapshot(raw)) {
    throw createError({
      statusCode: 422,
      statusMessage: 'Isi dari kode itu bukan catatan Nugaseen. Cek lagi kodenya.',
    })
  }

  return { code: idToCode(id, provider.codec), snapshot: raw }
})
