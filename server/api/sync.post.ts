import { isSnapshot } from '~~/shared/types'

/**
 * Dorong snapshot ke penyimpanan.
 * Tanpa `code` → bikin kode baru. Dengan `code` → timpa yang itu.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ code?: string; snapshot?: unknown }>(event)
  const snapshot = body?.snapshot

  if (!isSnapshot(snapshot)) {
    throw createError({ statusCode: 400, statusMessage: 'Isi snapshot-nya nggak dikenali.' })
  }

  if (JSON.stringify(snapshot).length > MAX_PAYLOAD) {
    throw createError({
      statusCode: 413,
      statusMessage:
        'Catatannya udah kegedean buat sync gratisan. Ekspor ke file JSON aja buat cadangan.',
    })
  }

  const provider = getProvider()

  // Belum punya kode → daftar baru.
  if (!body?.code) {
    try {
      const id = await provider.create(snapshot)
      return { code: idToCode(id, provider.codec), recreated: false }
    } catch (e) {
      throw explain(e, 'tulis')
    }
  }

  const id = codeToId(body.code, provider.codec)

  try {
    await provider.write(id, snapshot)
    return { code: idToCode(id, provider.codec), recreated: false }
  } catch (e) {
    // Blob gratisan bisa kehapus sendiri. Daripada mentok, daftarin ulang
    // dan kasih tau kodenya ganti — datanya tetap kekirim.
    if (statusOf(e) === 404 || statusOf(e) === 410) {
      try {
        const fresh = await provider.create(snapshot)
        return { code: idToCode(fresh, provider.codec), recreated: true }
      } catch (e2) {
        throw explain(e2, 'tulis')
      }
    }
    throw explain(e, 'tulis')
  }
})
