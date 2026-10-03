<script setup lang="ts">
const { toasts } = useToast()
</script>

<template>
  <div class="toasts" role="status" aria-live="polite">
    <p v-for="t in toasts" :key="t.id" class="toast" :data-kind="t.kind">{{ t.text }}</p>
  </div>
</template>
