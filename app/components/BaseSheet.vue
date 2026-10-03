<script setup lang="ts">
/** Kerangka modal: Escape nutup, fokus terkunci di dalam, scroll latar mati. */
defineProps<{ title: string; kicker?: string }>()
const emit = defineEmits<{ close: [] }>()

const sheet = ref<HTMLElement | null>(null)
const titleId = useId()
let returnTo: HTMLElement | null = null

const SELECTOR =
  'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])'

function focusables(): HTMLElement[] {
  if (!sheet.value) return []
  return [...sheet.value.querySelectorAll<HTMLElement>(SELECTOR)].filter(
    (el) => el.offsetParent !== null || el === document.activeElement,
  )
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    emit('close')
    return
  }
  if (e.key !== 'Tab') return
  const list = focusables()
  if (list.length < 2) return
  const first = list[0]!
  const last = list[list.length - 1]!
  const here = document.activeElement
  if (e.shiftKey && (here === first || !sheet.value?.contains(here))) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && here === last) {
    e.preventDefault()
    first.focus()
  }
}

onMounted(() => {
  returnTo = document.activeElement as HTMLElement | null
  document.body.style.overflow = 'hidden'
  nextTick(() => focusables()[0]?.focus())
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  returnTo?.focus?.()
})
</script>

<template>
  <Teleport to="body">
    <div class="scrim" @click.self="emit('close')" @keydown="onKeydown">
      <div ref="sheet" class="sheet" role="dialog" aria-modal="true" :aria-labelledby="titleId">
        <div class="sheet__head">
          <h2 :id="titleId">{{ title }}</h2>
          <p v-if="kicker" class="sheet__kicker">{{ kicker }}</p>
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
