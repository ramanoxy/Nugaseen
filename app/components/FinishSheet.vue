<script setup lang="ts">
import type { MoodKey, Reflection, Task } from '~~/shared/types'

/**
 * Momen paling penting di app ini: tugas nggak bisa dianggap kelar
 * sebelum kamu nulis rasanya. Mood + cerita wajib, sisanya opsional.
 */
const props = defineProps<{ task: Task; mode?: 'finish' | 'edit' }>()
const emit = defineEmits<{ save: [Reflection]; close: [] }>()

const editing = computed(() => props.mode === 'edit')
const prior = props.task.reflection

const picked = ref<MoodKey | null>(prior?.mood ?? null)
const felt = ref(prior?.felt ?? '')
const vent = ref(prior?.vent ?? '')
const weight = ref(prior?.weight ?? 3)
const minutes = ref(prior?.minutes != null ? String(prior.minutes) : '')
const tried = ref(false)

const BAR_H = ['8px', '14px', '20px', '26px', '32px']

const VENT_SHORTCUTS = [
  'Nggak ada, lancar kok',
  'Mepet deadline',
  'Instruksinya nggak jelas',
  'Kebanyakan revisi',
  'Males dari awal',
]

const moodErr = computed(() =>
  tried.value && !picked.value ? 'Pilih satu dulu — ini yang bikin arsipnya ada gunanya nanti.' : '',
)

const feltErr = computed(() =>
  tried.value && felt.value.trim().length < 3
    ? 'Tulis walau cuma sebaris. Nanti kamu sendiri yang baca ini lagi.'
    : '',
)

const ok = computed(() => !!picked.value && felt.value.trim().length >= 3)

/** Begitu mood kepilih, batang "seberapa berat" ikut warnanya. */
const tint = computed(() => (picked.value ? mood(picked.value).color : 'var(--signal)'))

function useShortcut(text: string) {
  vent.value = vent.value.trim() ? `${vent.value.trim()}. ${text}` : text
}

function submit() {
  tried.value = true
  if (!ok.value) return
  emit('save', {
    mood: picked.value!,
    felt: felt.value.trim(),
    vent: vent.value.trim(),
    weight: weight.value,
    minutes: minutes.value.trim() ? Number(minutes.value) : null,
  })
}
</script>

<template>
  <BaseSheet
    :title="editing ? 'Betulin catatan rasanya' : 'Kelar. Sekarang ceritain.'"
    :kicker="task.title"
    @close="emit('close')"
  >
    <form novalidate @submit.prevent="submit">
      <div class="sheet__body">
        <fieldset class="fieldset">
          <legend class="label">Gimana rasanya ngerjain ini?</legend>
          <div class="moods">
            <button
              v-for="m in MOODS"
              :key="m.key"
              type="button"
              class="mood"
              :style="{ '--c': m.color }"
              :aria-pressed="picked === m.key"
              @click="picked = m.key"
            >
              <span class="mood__swatch" aria-hidden="true" />
              <span>
                <span class="mood__name">{{ m.label }}</span>
                <span class="mood__blurb">{{ m.blurb }}</span>
              </span>
            </button>
          </div>
          <p v-if="moodErr" class="err">{{ moodErr }}</p>
        </fieldset>

        <div class="field">
          <label class="label" for="fs-felt">
            Ceritain dikit
            <span class="label__sub">— apa yang kamu rasain pas ngerjain</span>
          </label>
          <textarea
            id="fs-felt"
            v-model="felt"
            class="textarea"
            rows="4"
            maxlength="4000"
            placeholder="misal: awalnya males banget, pas udah mulai ternyata cepet. Yang bikin lama nyari referensinya."
            :aria-invalid="!!feltErr"
          />
          <p v-if="feltErr" class="err">{{ feltErr }}</p>
        </div>

        <div class="field">
          <label class="label" for="fs-vent">
            Keluh kesah
            <span class="label__sub">— boleh kosong, boleh pedas</span>
          </label>
          <textarea
            id="fs-vent"
            v-model="vent"
            class="textarea"
            rows="3"
            maxlength="4000"
            placeholder="misal: formatnya diganti di hari terakhir."
          />
          <div class="row">
            <button
              v-for="s in VENT_SHORTCUTS"
              :key="s"
              type="button"
              class="chip"
              @click="useShortcut(s)"
            >
              + {{ s }}
            </button>
          </div>
        </div>

        <fieldset class="fieldset">
          <legend class="label">Seberapa berat?</legend>
          <div class="weights" :style="{ '--c': tint }">
            <button
              v-for="n in 5"
              :key="n"
              type="button"
              class="weight"
              :style="{ '--h': BAR_H[n - 1] }"
              :aria-pressed="weight === n"
              :aria-label="`${n} dari 5 — ${weightLabel(n)}`"
              @click="weight = n"
            >
              <span class="weight__bar" aria-hidden="true" />
              <span>{{ weightLabel(n) }}</span>
            </button>
          </div>
        </fieldset>

        <div class="field" style="max-width: 14rem">
          <label class="label" for="fs-min">
            Habis berapa lama?
            <span class="label__sub">— menit, boleh kosong</span>
          </label>
          <input
            id="fs-min"
            v-model="minutes"
            class="input"
            type="number"
            inputmode="numeric"
            min="1"
            max="20160"
            step="5"
            placeholder="90"
          />
        </div>
      </div>

      <div class="sheet__foot">
        <p v-if="!editing" class="hint grow">Masuk arsip, bukan kehapus.</p>
        <button type="button" class="btn btn--bare" @click="emit('close')">Nanti dulu</button>
        <button type="submit" class="btn btn--go">
          {{ editing ? 'Simpan perubahan' : 'Simpan ke arsip' }}
        </button>
      </div>
    </form>
  </BaseSheet>
</template>
