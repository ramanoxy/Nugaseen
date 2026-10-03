<script setup lang="ts">
import type { Task } from '~~/shared/types'
import type { MoodMeta } from '~/utils/mood'

/**
 * Barcode mood — satu batang per tugas yang udah kelar.
 *   warna  = rasanya (ramp hijau ‹ netral › merah)
 *   tinggi = seberapa berat (1–5)
 * Urutannya kronologis, kiri paling lama.
 */
const props = defineProps<{
  tasks: Task[]
  /** Teks di bawah grafik waktu nggak ada batang yang disentuh. */
  caption?: string
}>()

const { statsOf } = useTasks()
const stats = computed(() => statsOf(props.tasks))

interface Bar {
  id: string
  task: Task
  meta: MoodMeta
  weight: number
  h: string
  label: string
}

const bars = computed<Bar[]>(() =>
  props.tasks
    .slice()
    .reverse()
    .map((t) => {
      const meta = mood(t.reflection?.mood)
      const weight = t.reflection?.weight ?? 3
      return {
        id: t.id,
        task: t,
        meta,
        weight,
        // 20%–100%: batang paling enteng tetap kelihatan.
        h: `${20 + (weight - 1) * 20}%`,
        label: `${t.title} — ${meta.label}, ${weightLabel(weight)}`,
      }
    }),
)

const hover = ref<Bar | null>(null)

const summary = computed(() => {
  const s = stats.value
  if (!s.count) return 'Belum ada tugas yang dikelarin di periode ini.'
  const bits = [`${s.count} tugas kelar`]
  if (s.top) bits.push(`paling sering ngerasa ${s.top.label.toLowerCase()}`)
  if (s.minutes) bits.push(duration(s.minutes))
  return bits.join(' · ')
})

const altText = computed(
  () =>
    `Grafik batang: ${summary.value}. Warna batang menunjukkan perasaan, tingginya menunjukkan seberapa berat. Rinciannya ada di tabel di bawah.`,
)

const tableId = useId()
</script>

<template>
  <figure class="stack stack--sm" style="margin: 0">
    <div class="barcode" role="img" :aria-label="altText">
      <div
        v-for="b in bars"
        :key="b.id"
        class="barcode__bar"
        :style="{ '--c': b.meta.color, '--h': b.h }"
        :title="b.label"
        @mouseenter="hover = b"
        @mouseleave="hover = null"
      />
      <p v-if="!bars.length" class="barcode__empty">
        Belum ada batang di sini. Kelarin satu tugas, nanti muncul.
      </p>
    </div>

    <!-- Pembacaan: info batang nggak disembunyiin di tooltip aja. -->
    <figcaption class="readout">
      <template v-if="hover">
        <span class="swatch swatch--tall" :style="{ '--c': hover.meta.color }" aria-hidden="true" />
        <strong class="grow">{{ hover.task.title }}</strong>
        <span class="muted small nowrap">
          {{ hover.meta.label }} · {{ weightLabel(hover.weight) }} ·
          {{ hover.task.doneAt ? shortDay(hover.task.doneAt.slice(0, 10)) : '—' }}
        </span>
      </template>
      <span v-else class="muted small">{{ caption ?? summary }}</span>
    </figcaption>

    <p class="axis-note">
      Tinggi batang = seberapa berat (enteng → brutal). Warna = rasanya.
    </p>

    <ul class="legend">
      <li v-for="m in stats.moodCounts" :key="m.meta.key" class="legend__item" :data-zero="m.n === 0">
        <span class="swatch" :style="{ '--c': m.meta.color }" aria-hidden="true" />
        {{ m.meta.label }}
        <span class="num">{{ m.n }}</span>
      </li>
    </ul>

    <details v-if="bars.length" class="raw">
      <summary>Lihat angkanya sebagai tabel</summary>
      <div class="scroll-x">
        <table :id="tableId" class="table">
          <caption class="vh">Rincian tugas yang sudah dikelarin</caption>
          <thead>
            <tr>
              <th scope="col">Tugas</th>
              <th scope="col">Kelar</th>
              <th scope="col">Rasanya</th>
              <th scope="col">Berat</th>
              <th scope="col">Lama</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in bars" :key="b.id">
              <td>{{ b.task.title }}</td>
              <td class="nowrap">{{ b.task.doneAt ? shortDay(b.task.doneAt.slice(0, 10)) : '—' }}</td>
              <td class="nowrap">{{ b.meta.label }}</td>
              <td class="nowrap">{{ b.weight }} · {{ weightLabel(b.weight) }}</td>
              <td class="nowrap">{{ duration(b.task.reflection?.minutes) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </figure>
</template>

<style scoped>
.readout {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 1.6rem;
  padding: 0.35rem 0.5rem;
  background: var(--void-2);
  border: var(--bw-2) solid var(--line);
  font-size: 0.9rem;
}

.readout strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.01em;
}

.axis-note {
  font-size: 0.76rem;
  color: var(--chalk-3);
  max-width: none;
}

.legend__item[data-zero='true'] {
  opacity: 0.4;
}

.legend .num {
  font-weight: 700;
  color: var(--chalk);
}

.raw summary {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--chalk-2);
  cursor: pointer;
  padding: 0.2rem 0;
  width: fit-content;
}

.raw summary:hover {
  color: var(--chalk);
}

.raw > .scroll-x {
  margin-top: 0.5rem;
}
</style>
