<script setup lang="ts">
import type { Reflection, Task } from '~~/shared/types'
import { MOODS, mood, weightLabel } from '~/utils/mood'
import { monthKeyOf, monthLabel, duration } from '~/utils/format'

const { finished, reflectAgain, reopen, remove, statsOf } = useTasks()
const toast = useToast()

useHead({ title: 'Nugaseen — arsip bulanan & rekap' })

type Sheet = { kind: 'reflect'; task: Task }
const sheet = ref<Sheet | null>(null)

/** Filter pencarian & filter bulan di arsip. */
const search = ref('')
const filterTag = ref('')
const selectedMonth = ref<string>('all')
const showRecap = ref(true)

// Daftar semua bulan yang ada tugas selesai (terurut dari yang terbaru)
const allMonthKeys = computed(() => {
  const set = new Set<string>()
  for (const t of finished.value) {
    if (t.doneAt) set.add(monthKeyOf(t.doneAt))
  }
  return [...set].sort((a, b) => b.localeCompare(a))
})

const tags = computed(() => {
  const set = new Set<string>()
  for (const t of finished.value) {
    if (t.tag) set.add(t.tag)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'id'))
})

// Filter teks dan label
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

// Filter juga berdasarkan bulan yang dipilih
const displayedTasks = computed(() => {
  if (selectedMonth.value === 'all') return filtered.value
  return filtered.value.filter((t) => monthKeyOf(t.doneAt!) === selectedMonth.value)
})

// Pengelompokan bulan untuk tampilan ledger
const filteredMonths = computed(() => {
  const buckets = new Map<string, Task[]>()
  for (const t of displayedTasks.value) {
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

// Analisis mendalam untuk rekap bulanan (tugas kelar, level stres, beban, mood)
const activeRecap = computed(() => {
  const tasks = displayedTasks.value
  const total = tasks.length
  if (!total) return null

  const weights = tasks.map((t) => t.reflection?.weight).filter((w): w is number => w != null)
  const avgWeight = weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : 0
  const minutes = tasks.reduce((sum, t) => sum + (t.reflection?.minutes ?? 0), 0)

  const counts = new Map<string, number>()
  for (const t of tasks) {
    if (t.reflection?.mood) {
      counts.set(t.reflection.mood, (counts.get(t.reflection.mood) ?? 0) + 1)
    }
  }

  const moodCounts = MOODS.map((m) => {
    const n = counts.get(m.key) ?? 0
    return {
      meta: m,
      n,
      percent: Math.round((n / total) * 100),
    }
  })

  const topMood = [...moodCounts].sort((a, b) => b.n - a.n)[0]?.n
    ? [...moodCounts].sort((a, b) => b.n - a.n)[0]!.meta
    : null

  const stressCount = (counts.get('stres') ?? 0) + (counts.get('kesel') ?? 0)
  const exhaustedCount = counts.get('capek') ?? 0
  const chillCount = (counts.get('puas') ?? 0) + (counts.get('santai') ?? 0)
  const heavyCount = tasks.filter((t) => (t.reflection?.weight ?? 0) >= 4).length
  const stressRate = Math.round(((stressCount + exhaustedCount) / total) * 100)

  // Penilaian tingkat stres & beban mental
  let verdict = {
    label: 'Cukup Seimbang',
    desc: 'Beban kerja dan suasana hati periode ini berjalan seimbang dan terkendali.',
    color: 'var(--signal)',
    bg: 'rgba(74, 139, 255, 0.12)',
  }

  if (stressCount > 0 && (stressCount >= chillCount || stressCount >= 3)) {
    verdict = {
      label: 'Stres Cukup Tinggi',
      desc: 'Bulan ini cukup menguras mental. Banyak tugas yang terasa bikin pusing atau kesel.',
      color: 'var(--bad)',
      bg: 'rgba(255, 77, 107, 0.12)',
    }
  } else if (avgWeight >= 3.4 || stressRate >= 50) {
    verdict = {
      label: 'Beban Melelahkan',
      desc: 'Beban tugas lumayan berat dan menyita banyak energi, tapi semua berhasil dituntaskan.',
      color: 'var(--m-capek)',
      bg: 'rgba(226, 164, 92, 0.12)',
    }
  } else if (chillCount >= total * 0.5) {
    verdict = {
      label: 'Santai & Kondusif',
      desc: 'Bulan yang nyaman! Mayoritas tugas kelar dengan perasaan puas, lega, atau santai.',
      color: 'var(--m-puas)',
      bg: 'rgba(61, 232, 154, 0.12)',
    }
  }

  // Cari tugas paling berat / menguras energi (weight desc, mood rank desc)
  const hardestTask = [...tasks].sort((a, b) => {
    const wDiff = (b.reflection?.weight ?? 0) - (a.reflection?.weight ?? 0)
    if (wDiff !== 0) return wDiff
    const rB = mood(b.reflection?.mood).rank
    const rA = mood(a.reflection?.mood).rank
    return rB - rA
  })[0] ?? null

  return {
    key: selectedMonth.value,
    label: selectedMonth.value === 'all' ? 'Sepanjang Waktu' : monthLabel(selectedMonth.value),
    count: total,
    minutes,
    avgWeight,
    weightLabel: weightLabel(avgWeight),
    stressCount,
    exhaustedCount,
    chillCount,
    heavyCount,
    stressRate,
    verdict,
    topMood,
    moodCounts,
    hardestTask,
    tasks,
  }
})

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

function selectMonth(key: string) {
  selectedMonth.value = key
  showRecap.value = true
}
</script>

<template>
  <div class="stack stack--lg">
    <!-- Header Utama -->
    <section class="stack">
      <div>
        <h1>Arsip & Rekap Bulanan</h1>
        <p class="lede">
          <template v-if="allStats.count">
            Total <strong>{{ allStats.count }} tugas</strong> pernah kamu kelarin.
            <template v-if="allStats.top">
              Paling sering ngerasa <strong>{{ allStats.top.label.toLowerCase() }}</strong>.
            </template>
          </template>
          <template v-else>
            Arsipnya masih kosong. Kelarin satu tugas dulu di halaman utama, nanti masuk sini.
          </template>
        </p>
      </div>

      <!-- Quick Month Chips -->
      <div v-if="allMonthKeys.length > 1" class="month-chips">
        <button
          class="chip"
          :data-on="selectedMonth === 'all'"
          @click="selectMonth('all')"
        >
          Semua Bulan ({{ finished.length }})
        </button>
        <button
          v-for="key in allMonthKeys"
          :key="key"
          class="chip"
          :data-on="selectedMonth === key"
          @click="selectMonth(key)"
        >
          {{ monthLabel(key) }}
        </button>
      </div>
    </section>

    <!-- Barcode Keseluruhan jika memilih Semua Bulan -->
    <section v-if="allStats.count && selectedMonth === 'all' && !showRecap">
      <MoodBarcode
        :tasks="finished"
        caption="Semua tugas yang pernah dikelarin"
      />
    </section>

    <!-- Kartu Rekap Bulanan Mendalam -->
    <section v-if="activeRecap && showRecap" class="stack stack--sm">
      <div class="recap-card">
        <!-- Header Rekap -->
        <div class="recap-head">
          <div>
            <p class="recap-kicker">
              {{ selectedMonth === 'all' ? 'Rekap Keseluruhan' : 'Rekap Bulanan' }}
            </p>
            <h2>{{ activeRecap.label }}</h2>
          </div>

          <div
            class="recap-verdict"
            :style="{
              color: activeRecap.verdict.color,
              background: activeRecap.verdict.bg,
              borderColor: activeRecap.verdict.color,
            }"
          >
            <span class="recap-verdict__dot" />
            <span>{{ activeRecap.verdict.label }}</span>
          </div>
        </div>

        <p class="muted" style="margin-top: -0.4rem; font-size: 0.9rem">
          {{ activeRecap.verdict.desc }}
        </p>

        <!-- Grid 4 Statistik Utama -->
        <div class="recap-grid">
          <div class="recap-stat">
            <p class="recap-stat__num">{{ activeRecap.count }}</p>
            <p class="recap-stat__label">Tugas Selesai</p>
            <p v-if="activeRecap.minutes" class="recap-stat__sub">
              ⏱️ {{ duration(activeRecap.minutes) }} dicatat
            </p>
            <p v-else class="recap-stat__sub">Waktu tidak dicatat</p>
          </div>

          <div class="recap-stat">
            <p
              class="recap-stat__num"
              :style="{ color: activeRecap.stressCount > 0 ? 'var(--bad)' : 'var(--chalk)' }"
            >
              {{ activeRecap.stressRate }}%
            </p>
            <p class="recap-stat__label">Tingkat Stres & Lelah</p>
            <p class="recap-stat__sub">
              {{ activeRecap.stressCount }} stres/kesel · {{ activeRecap.exhaustedCount }} capek
            </p>
          </div>

          <div class="recap-stat">
            <p class="recap-stat__num">{{ activeRecap.avgWeight.toFixed(1) }} <span style="font-size: 0.9rem; font-weight: 500; color: var(--chalk-3)">/ 5</span></p>
            <p class="recap-stat__label">Rata-rata Beban</p>
            <p class="recap-stat__sub">
              Kategori <strong>{{ activeRecap.weightLabel }}</strong> ({{ activeRecap.heavyCount }} berat)
            </p>
          </div>

          <div class="recap-stat">
            <p
              class="recap-stat__num"
              :style="{ color: activeRecap.topMood ? activeRecap.topMood.color : 'inherit' }"
            >
              {{ activeRecap.topMood ? activeRecap.topMood.label : '—' }}
            </p>
            <p class="recap-stat__label">Mood Paling Sering</p>
            <p class="recap-stat__sub">
              {{ activeRecap.topMood ? activeRecap.topMood.blurb : 'Belum ada data' }}
            </p>
          </div>
        </div>

        <!-- Meter Distribusi Mood / Perasaan -->
        <div class="mood-meter-box">
          <div class="mood-meter-box__title">
            <span>Distribusi Perasaan Tugas</span>
            <span class="muted small">{{ activeRecap.count }} total tugas</span>
          </div>

          <!-- Multi-segment Mood Bar -->
          <div class="mood-meter" role="img" aria-label="Meter distribusi mood">
            <template v-for="m in activeRecap.moodCounts" :key="m.meta.key">
              <div
                v-if="m.n > 0"
                class="mood-meter__seg"
                :style="{
                  '--c': m.meta.color,
                  width: `${m.percent}%`,
                }"
                :title="`${m.meta.label}: ${m.n} tugas (${m.percent}%)`"
              />
            </template>
          </div>

          <!-- Mood Pills Breakdown -->
          <div class="mood-pills">
            <div
              v-for="m in activeRecap.moodCounts"
              :key="m.meta.key"
              class="mood-pill"
              :data-zero="m.n === 0"
            >
              <span class="mood-pill__dot" :style="{ '--c': m.meta.color }" />
              <span>{{ m.meta.label }}</span>
              <strong style="color: var(--chalk)">{{ m.n }}</strong>
              <span class="muted">({{ m.percent }}%)</span>
            </div>
          </div>
        </div>

        <!-- Spotlight Tugas Paling Berat / Menguras Energi -->
        <div v-if="activeRecap.hardestTask" class="spotlight-task" :style="{ '--c': mood(activeRecap.hardestTask.reflection?.mood).color }">
          <p class="spotlight-task__cap">🔥 Tugas Paling Menguras Energi</p>
          <p class="spotlight-task__title">{{ activeRecap.hardestTask.title }}</p>
          <div class="spotlight-task__meta">
            <span>Beban: <strong>{{ activeRecap.hardestTask.reflection?.weight }}/5 ({{ weightLabel(activeRecap.hardestTask.reflection?.weight ?? 3) }})</strong></span>
            <span>·</span>
            <span>Mood: <strong :style="{ color: mood(activeRecap.hardestTask.reflection?.mood).color }">{{ mood(activeRecap.hardestTask.reflection?.mood).label }}</strong></span>
            <span v-if="activeRecap.hardestTask.reflection?.minutes">· {{ duration(activeRecap.hardestTask.reflection?.minutes) }}</span>
          </div>
          <p v-if="activeRecap.hardestTask.reflection?.vent" class="spotlight-task__quote">
            "{{ activeRecap.hardestTask.reflection?.vent }}"
          </p>
          <p v-else-if="activeRecap.hardestTask.reflection?.felt" class="spotlight-task__quote">
            "{{ activeRecap.hardestTask.reflection?.felt }}"
          </p>
        </div>

        <!-- Mood Barcode untuk periode ini -->
        <MoodBarcode
          :tasks="displayedTasks"
          :caption="'Grafik runtutan perasaan: ' + activeRecap.label"
        />
      </div>
    </section>

    <!-- Filter & Toolbar -->
    <section v-if="allStats.count" class="stack">
      <div class="section__head">
        <h2>
          <span>Daftar Tugas</span>
          <span v-if="selectedMonth !== 'all'" style="font-size: 0.9rem; font-weight: 500; color: var(--chalk-2)">
            — {{ monthLabel(selectedMonth) }}
          </span>
        </h2>
        <div class="row" style="gap: 0.4rem">
          <button
            v-if="selectedMonth !== 'all'"
            class="btn btn--bare"
            @click="selectMonth('all')"
          >
            ← Semua Bulan
          </button>
          <button
            class="btn btn--bare"
            @click="showRecap = !showRecap"
          >
            {{ showRecap ? 'Sembunyikan Rekap' : 'Buka Rekap' }}
          </button>
          <p class="count">{{ displayedTasks.length }} tugas</p>
        </div>
      </div>

      <div class="filters">
        <div class="field" style="flex: 1 1 14rem">
          <input
            v-model="search"
            class="input"
            type="search"
            placeholder="Cari tugas, perasaan, atau keluhan…"
            aria-label="Cari tugas di arsip"
          />
        </div>

        <div class="field" style="flex: 0 1 13rem">
          <select
            v-model="selectedMonth"
            class="input select"
            aria-label="Pilih Bulan"
          >
            <option value="all">Semua Bulan ({{ finished.length }})</option>
            <option v-for="key in allMonthKeys" :key="key" :value="key">
              {{ monthLabel(key) }}
            </option>
          </select>
        </div>

        <div class="field" style="flex: 0 1 11rem">
          <select v-model="filterTag" class="input select" aria-label="Filter label">
            <option value="">Semua label</option>
            <option v-for="t in tags" :key="t" :value="t">#{{ t }}</option>
          </select>
        </div>
      </div>
    </section>

    <!-- Daftar Tugas Ledger -->
    <section v-if="filteredMonths.length" class="stack stack--lg">
      <div v-for="group in filteredMonths" :key="group.key" class="ledger">
        <div class="ledger__head">
          <span class="ledger__month">{{ group.label }}</span>
          <span class="ledger__sum">{{ group.tasks.length }} tugas</span>

          <!-- Tombol fokus jika sedang di mode Semua Bulan -->
          <button
            v-if="selectedMonth === 'all'"
            class="btn btn--bare btn--sm"
            style="margin-inline-start: 0.5rem"
            @click="selectMonth(group.key)"
          >
            Cek Rekap Bulan Ini →
          </button>
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
        Coba kata kunci lain atau ubah filter bulan & label.
      </p>
      <button class="btn btn--sm" @click="selectedMonth = 'all'; search = ''; filterTag = ''">
        Reset Filter
      </button>
    </div>

    <div v-else-if="!allStats.count" class="empty">
      <p class="empty__title">Arsipnya masih kosong.</p>
      <p class="muted">
        Begitu kamu kelarin tugas di halaman utama, semuanya masuk sini — lengkap dengan rekap emosi dan beban per bulan.
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
