<script setup lang="ts">
import type { Task } from '~~/shared/types'

const props = defineProps<{ task: Task }>()
const emit = defineEmits<{ reflect: []; reopen: [] }>()

const open = ref(false)
const bodyId = useId()
const m = computed(() => mood(props.task.reflection?.mood))
</script>

<template>
  <li class="entry">
    <button
      class="entry__head"
      :aria-expanded="open"
      :aria-controls="bodyId"
      @click="open = !open"
    >
      <span class="entry__edge" :style="{ '--c': m.color }" aria-hidden="true" />
      <span class="entry__main">
        <span class="entry__title">{{ task.title }}</span>
        <span class="entry__meta">
          <time v-if="task.doneAt" :datetime="task.doneAt">{{ stamp(task.doneAt) }}</time>
          <span>{{ m.label }}</span>
          <span>{{ weightLabel(task.reflection?.weight ?? 3) }}</span>
          <span v-if="task.reflection?.minutes">{{ duration(task.reflection.minutes) }}</span>
          <span v-if="task.tag">#{{ task.tag }}</span>
        </span>
      </span>
      <span class="entry__caret" aria-hidden="true">{{ open ? 'tutup' : 'buka' }}</span>
    </button>

    <div v-if="open" :id="bodyId" class="entry__detail">
      <div class="quote" :style="{ '--c': m.color }">
        <p class="quote__cap">Rasanya</p>
        <p class="quote__body">{{ task.reflection?.felt }}</p>
      </div>

      <div class="quote">
        <p class="quote__cap">Keluh kesah</p>
        <p v-if="task.reflection?.vent" class="quote__body">{{ task.reflection.vent }}</p>
        <p v-else class="quote__body quote__body--muted">Waktu itu nggak ada keluhan.</p>
      </div>

      <p v-if="task.note" class="hint">Catatan awal: {{ task.note }}</p>

      <div class="row">
        <button class="btn btn--bare" @click="emit('reflect')">Betulin catatan</button>
        <button class="btn btn--bare" @click="emit('reopen')">Balikin ke aktif</button>
      </div>
    </div>
  </li>
</template>
