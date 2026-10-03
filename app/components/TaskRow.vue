<script setup lang="ts">
import type { Task } from '~~/shared/types'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{ finish: []; edit: []; remove: [] }>()

const days = computed(() => (props.task.due ? daysFromToday(props.task.due) : null))
const late = computed(() => days.value !== null && days.value < 0)
const soon = computed(() => days.value !== null && days.value >= 0 && days.value <= 2)
const prio = computed(() => priority(props.task.priority))

/** Tepi kiri cuma nyala kalau ada tekanan waktu — warna = urgensi, bukan hiasan. */
const edge = computed(() => (soon.value ? 'var(--m-capek)' : 'var(--line-2)'))
</script>

<template>
  <li class="task" :data-late="late">
    <span class="task__edge" :style="{ '--c': edge }" aria-hidden="true" />

    <div class="task__body">
      <h3 class="task__title">{{ task.title }}</h3>
      <p v-if="task.note" class="task__note">{{ task.note }}</p>

      <p class="task__meta">
        <span v-if="task.due" class="due" :data-late="late" :data-soon="soon">
          <time :datetime="task.due">{{ dueLabel(task.due) }}</time>
        </span>
        <span>{{ prio.label }}</span>
        <span v-if="task.tag">#{{ task.tag }}</span>
        <span>ditulis {{ ago(task.createdAt) }}</span>
      </p>
    </div>

    <div class="task__acts">
      <button class="btn btn--go" :aria-label="`Kelarin: ${task.title}`" @click="emit('finish')">
        Kelarin
      </button>
      <button class="btn btn--bare" :aria-label="`Ubah: ${task.title}`" @click="emit('edit')">
        Ubah
      </button>
      <button class="btn btn--bare" :aria-label="`Buang: ${task.title}`" @click="emit('remove')">
        Buang
      </button>
    </div>
  </li>
</template>
