<script setup lang="ts">
import type { Reflection, Task } from '~~/shared/types'

const { finished, months, reflectAgain, reopen, remove, statsOf } = useTasks()
const toast = useToast()

useHead({ title: 'Nugaseen — arsip bulanan' })

type Sheet = { kind: 'reflect'; task: Task }

const sheet = ref<Sheet | null>(null)

/** Filter pencarian di arsip. */
const search = ref('')
const filterTag = ref('')

const tags = computed(() => {
  const set = new Set<string>()
  for (const t of finished.value) {
    if (t.tag) set.add(t.tag)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'id'))
})

const filtered = computed(() => {
  let list = finished.value
  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.reflection?.felt.toLowerCase().includes(q) ||
        t.reflection?.vent.toLowerCase().includes(q) ||
        t.tag.toLowerCase().includes(q),
    )
  }
  if (filterTag.value) {
    list = list.filter((t) => t.tag === filterTag.value)
  }
  return list
})

const filteredMonths = computed(() => {
  const buckets = new Map<string, Task[]>()
  for (const t of filtered.value) {
    const key = monthKeyOf(t.doneAt!)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(t)
    else buckets.set(key, [t])
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, tasks]) => ({ key, label: monthLabel(key), tasks }))
})

const allStats = computed(() => statsOf(finished.value))

function handleReflect(task: Task) {
  sheet.value = { kind: 'reflect', task }
}

function handleReopen(task: Task) {
  reopen(task.id)
  toast.ok(`"${task.title}" balik ke daftar aktif.`)
}

function handleRemove(task: Task) {
  remove(task.id)
  toast.ok(`"${task.title}" udah dihapus dari arsip.`)
}

function saveReflect(reflection: Reflection) {
  if (sheet.value?.kind !== 'reflect') return
  reflectAgain(sheet.value.task.id, reflection)
  sheet.value = null
  toast.ok('Catatan rasanya udah diperbarui.')
}
</script>

<template>
  <div class="stack stack--lg">
    <!-- Ringkasan keseluruhan -->
    <section class="stack">
      <div>
        <h1>Arsip</h1>
        <p class="lede">
          <template v-if="allStats.count">
            {{ allStats.count }} tugas pernah kamu kelarin.
            <template v-if="allStats.top">
              Sepanjang ini paling sering ngerasa <strong>{{ allStats.top.label.toLowerCase() }}</strong>.
            </template>
          </template>
          <template v-else>
            Arsipnya masih kosong. Kelarin satu tugas dulu di halaman utama, nanti masuk sini.
          </template>
        </p>
      </div>

      <!-- Barcode keseluruhan -->
      <MoodBarcode
        v-if="allStats.count"
        :tasks="finished"
        caption="Semua tugas yang pernah dikelarin"
      />
    </section>

    <!-- Filter -->
    <section v-if="allStats.count" class="stack">
      <div class="section__head">
        <h2>Riwayat</h2>
        <p class="count">{{ filtered.length }} tugas</p>
      </div>

      <div class="filters">
        <div class="field" style="flex: 1 1 14rem">
          <input
            v-model="search"
            class="input"
            type="search"
            placeholder="Cari di arsip…"
            aria-label="Cari tugas di arsip"
          />
        </div>
        <div class="field" style="flex: 0 1 12rem">
          <select v-model="filterTag" class="input select" aria-label="Filter label">
            <option value="">Semua label</option>
            <option v-for="t in tags" :key="t" :value="t">#{{ t }}</option>
          </select>
        </div>
      </div>
    </section>

    <!-- Daftar per bulan -->
    <section v-if="filteredMonths.length" class="stack stack--lg">
      <div v-for="group in filteredMonths" :key="group.key" class="ledger">
        <div class="ledger__head">
          <span class="ledger__month">{{ group.label }}</span>
          <span class="ledger__sum">{{ group.tasks.length }} tugas</span>
        </div>
        <ul>
          <ArchiveEntry
            v-for="t in group.tasks"
            :key="t.id"
            :task="t"
            @reflect="handleReflect(t)"
            @reopen="handleReopen(t)"
            @remove="handleRemove(t)"
          />
        </ul>
      </div>
    </section>

    <div v-else-if="allStats.count && !filteredMonths.length" class="empty">
      <p class="empty__title">Nggak ketemu.</p>
      <p class="muted">
        Coba kata kunci lain atau hapus filter label.
      </p>
    </div>

    <div v-else-if="!allStats.count" class="empty">
      <p class="empty__title">Arsipnya masih kosong.</p>
      <p class="muted">
        Begitu kamu kelarin tugas di halaman utama, semuanya masuk sini — nggak ada yang dihapus.
      </p>
      <NuxtLink to="/" class="btn btn--sm">Ke halaman utama</NuxtLink>
    </div>

    <!-- Sheet: edit refleksi -->
    <FinishSheet
      v-if="sheet?.kind === 'reflect'"
      :task="sheet.task"
      mode="edit"
      @save="saveReflect"
      @close="sheet = null"
    />
  </div>
</template>

<style scoped>
.lede {
  margin-top: 0.6rem;
  font-size: 1.02rem;
  color: var(--chalk-2);
}

.lede strong {
  color: var(--chalk);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
</style>
