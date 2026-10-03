/**
 * Nyimpen tiap perubahan ke localStorage, dan — kalau auto-sync nyala —
 * ngedorong ke awan setelah kamu berhenti ngetik sebentar.
 */
export default defineNuxtPlugin(() => {
  const tasks = useTasks()
  const sync = useSync()
  const toast = useToast()

  let warned = false
  let timer: ReturnType<typeof setTimeout> | null = null

  function flush() {
    if (tasks.persist() === false && !warned) {
      warned = true
      toast.bad('Browser nggak ngizinin nyimpen data. Coba keluar dari mode privat.')
    }
  }

  // commit() selalu nukar snapshot utuh, jadi watch biasa udah cukup.
  watch(tasks.snapshot, () => {
    flush()
    if (!sync.auto.value || !sync.code.value) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void sync.push(true), 2500)
  })

  // Tarik sekali pas buka, biar perangkat ini nyusul yang lain.
  if (sync.auto.value && sync.code.value) void sync.pull(undefined, true)

  // Kalau tab ditutup pas timer masih jalan, minimal yang lokal kesimpen.
  window.addEventListener('pagehide', flush)
})
