<script setup lang="ts">
import type { Reflection, Task } from '~~/shared/types'
import type { NewTaskInput } from '~/composables/useTasks'

const { active, finished, tags, lateCount, statsOf, add, update, finish, remove, restore } =
  useTasks()
const toast = useToast()

useHead({ title: 'Nugaseen — tugas aktif' })

type Sheet = { kind: 'new' } | { kind: 'edit'; task: Task } | { kind: 'finish'; task: Task }

const sheet = ref<Sheet | null>(null)
const quick = ref('')

/** Bulan berjalan. Disegarkan kalau tab ditinggal lewat tengah malam. */
const monthNow = ref(thisMonthKey())
onMounted(() => {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) monthNow.value = thisMonthKey()
  })
})

const monthTasks = computed(() =>
  finished.value.filter((t) => monthKeyOf(t.doneAt!) === monthNow.value),
)
const stats = computed(() => statsOf(monthTasks.value))

/* Buang → bisa dibalikin. Nggak pakai dialog konfirmasi. */
const justBinned = ref<Task | null>(null)
let binTimer: ReturnType<typeof setTimeout> | null = null

function bin(task: Task) {
  remove(task.id)
  justBinned.value = task
  if (binTimer) clearTimeout(binTimer)
  binTimer = setTimeout(() => (justBinned.value = null), 20_000)
}

function unbin() {
  if (!justBinned.value) return
  restore(justBinned.value.id)
  justBinned.value = null
}

function quickAdd() {
  if (!quick.value.trim()) return
  add({ title: quick.value })
  quick.value = ''
}

function saveNew(input: NewTaskInput) {
  add(input)
  sheet.value = null
}

function saveEdit(input: NewTaskInput) {
  if (sheet.value?.kind !== 'edit') return
  update(sheet.value.task.id, input)
  sheet.value = null
}

function saveFinish(reflection: Reflection) {
  if (sheet.value?.kind !== 'finish') return
  const { id, title } = sheet.value.task
  finish(id, reflection)
  sheet.value = null
  toast.ok(`"${title}" masuk arsip. Catatannya kesimpen.`)
}
</script>

<template>
  <div class="stack stack--lg">
    <!-- Hero: apa yang udah kelar bulan ini, dan rasanya gimana. -->
    <section class="stack">
      <div>
        <h1>{{ monthLabel(monthNow) }}</h1>
        <p class="lede">
          <template v-if="stats.count">
            {{ stats.count }} tugas udah kamu kelarin bulan ini.
            <template v-if="stats.top">
              Paling sering ngerasa <strong>{{ stats.top.label.toLowerCase() }}</strong>.
            </template>
          </template>
          <template v-else>
            Belum ada yang dikelarin bulan ini. Satu aja dulu, biar grafiknya mulai keisi.
          </template>
        </p>
      </div>

      <MoodBarcode :tasks="monthTasks" />

      <div class="tallies">
        <div class="tally">
          <p class="tally__num">{{ active.length }}</p>
          <p class="tally__label">masih nunggu</p>
        </div>
        <div class="tally">
          <p class="tally__num">{{ lateCount }}</p>
          <p class="tally__label">kelewat tenggat</p>
        </div>
        <div class="tally">
          <p class="tally__num">{{ stats.count }}</p>
          <p class="tally__label">kelar bulan ini</p>
        </div>
        <div class="tally">
          <p class="tally__num">{{ stats.minutes ? duration(stats.minutes) : '—' }}</p>
          <p class="tally__label">waktu yang kecatat</p>
        </div>
      </div>
    </section>

    <!-- Daftar kerja -->
    <section>
      <div class="section__head">
        <h2>Yang harus dikerjain</h2>
        <p class="count">{{ active.length }} tugas</p>
      </div>

      <div class="stack">
        <form class="addbar" @submit.prevent="quickAdd">
          <input
            v-model="quick"
            class="input"
            maxlength="300"
            aria-label="Tugas baru"
            placeholder="Tulis tugas baru di sini…"
          />
          <button type="submit" class="btn btn--go" :disabled="!quick.trim()">Tambah</button>
          <button type="button" class="btn" @click="sheet = { kind: 'new' }">Pakai detail</button>
        </form>

        <div v-if="justBinned" class="undo">
          <p class="grow">
            Dibuang: <strong>{{ justBinned.title }}</strong>
          </p>
          <button class="btn btn--sm" @click="unbin">Balikin</button>
        </div>

        <ul v-if="active.length" class="stack stack--sm">
          <TaskRow
            v-for="t in active"
            :key="t.id"
            :task="t"
            @finish="sheet = { kind: 'finish', task: t }"
            @edit="sheet = { kind: 'edit', task: t }"
            @remove="bin(t)"
          />
        </ul>

        <div v-else class="empty">
          <p class="empty__title">Daftarnya bersih.</p>
          <p class="muted">
            Nggak ada tugas yang nunggu. Kalau ada yang kepikiran, tulis di kotak atas — nanti pas
            kelar kamu diminta cerita rasanya.
          </p>
          <NuxtLink to="/arsip" class="btn btn--sm">Lihat arsip</NuxtLink>
        </div>
      </div>
    </section>

    <TaskSheet
      v-if="sheet?.kind === 'new'"
      :known-tags="tags"
      @save="saveNew"
      @close="sheet = null"
    />

    <TaskSheet
      v-else-if="sheet?.kind === 'edit'"
      :task="sheet.task"
      :known-tags="tags"
      @save="saveEdit"
      @close="sheet = null"
    />

    <FinishSheet
      v-else-if="sheet?.kind === 'finish'"
      :task="sheet.task"
      @save="saveFinish"
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

.addbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.6rem;
  background: var(--void-2);
  border: 1px solid var(--line-2);
  border-radius: 12px;
  box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.25);
  transition: border-color 0.22s ease, box-shadow 0.22s ease;
}

.addbar:focus-within {
  border-color: var(--signal);
  box-shadow: 0 4px 20px -2px rgba(74, 139, 255, 0.15);
}

.addbar .input {
  flex: 1 1 14rem;
}

.undo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.7rem;
  background: var(--void-2);
  border: 1px dashed var(--line-2);
  border-radius: 8px;
  font-size: 0.9rem;
}
</style>
