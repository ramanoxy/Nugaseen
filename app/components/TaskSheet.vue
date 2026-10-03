<script setup lang="ts">
import type { Priority, Task } from '~~/shared/types'
import type { NewTaskInput } from '~/composables/useTasks'

const props = defineProps<{ task?: Task | null; knownTags?: string[] }>()
const emit = defineEmits<{ save: [NewTaskInput]; close: [] }>()

const editing = computed(() => !!props.task)

const title = ref(props.task?.title ?? '')
const note = ref(props.task?.note ?? '')
const tag = ref(props.task?.tag ?? '')
const prio = ref<Priority>(props.task?.priority ?? 'mid')
const due = ref(props.task?.due ?? '')
const tried = ref(false)

const titleErr = computed(() =>
  tried.value && !title.value.trim() ? 'Tulis dulu tugasnya apa.' : '',
)

const tagListId = useId()

function submit() {
  tried.value = true
  if (!title.value.trim()) return
  emit('save', {
    title: title.value,
    note: note.value,
    tag: tag.value,
    priority: prio.value,
    due: due.value || null,
  })
}
</script>

<template>
  <BaseSheet
    :title="editing ? 'Ubah tugas' : 'Tugas baru'"
    :kicker="editing ? task!.title : 'Yang kamu tulis sekarang bisa diubah kapan aja.'"
    @close="emit('close')"
  >
    <form novalidate @submit.prevent="submit">
      <div class="sheet__body">
        <div class="field">
          <label class="label" for="ts-title">Tugasnya apa?</label>
          <input
            id="ts-title"
            v-model="title"
            class="input"
            maxlength="300"
            placeholder="Laporan praktikum fisika bab 3"
            :aria-invalid="!!titleErr"
          />
          <p v-if="titleErr" class="err">{{ titleErr }}</p>
        </div>

        <div class="two">
          <div class="field">
            <label class="label" for="ts-due">
              Tenggat <span class="label__sub">— boleh kosong</span>
            </label>
            <input id="ts-due" v-model="due" class="input" type="date" />
          </div>

          <div class="field">
            <label class="label" for="ts-tag">
              Label <span class="label__sub">— kuliah, kerjaan, rumah…</span>
            </label>
            <input
              id="ts-tag"
              v-model="tag"
              class="input"
              maxlength="40"
              :list="tagListId"
              placeholder="kuliah"
            />
            <datalist :id="tagListId">
              <option v-for="t in knownTags ?? []" :key="t" :value="t" />
            </datalist>
          </div>
        </div>

        <fieldset class="fieldset">
          <legend class="label">Seberapa mendesak?</legend>
          <div class="row">
            <button
              v-for="p in PRIORITIES"
              :key="p.key"
              type="button"
              class="chip"
              :aria-pressed="prio === p.key"
              @click="prio = p.key"
            >
              {{ p.label }}
            </button>
          </div>
        </fieldset>

        <div class="field">
          <label class="label" for="ts-note">
            Catatan <span class="label__sub">— detail biar nanti nggak lupa</span>
          </label>
          <textarea
            id="ts-note"
            v-model="note"
            class="textarea"
            rows="3"
            maxlength="2000"
            placeholder="Minimal 10 halaman, pakai template dari grup."
          />
        </div>
      </div>

      <div class="sheet__foot">
        <button type="button" class="btn btn--bare" @click="emit('close')">Batal</button>
        <button type="submit" class="btn btn--go">
          {{ editing ? 'Simpan perubahan' : 'Tambah ke daftar' }}
        </button>
      </div>
    </form>
  </BaseSheet>
</template>

<style scoped>
.two {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: 0.75rem;
}
</style>
