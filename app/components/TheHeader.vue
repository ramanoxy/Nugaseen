<script setup lang="ts">
const { active } = useTasks()
</script>

<template>
  <header class="masthead">
    <div class="shell masthead__in">
      <NuxtLink to="/" class="brand">
        <span class="brand__mark" aria-hidden="true" />
        Nugaseen
      </NuxtLink>

      <nav class="nav" aria-label="Halaman">
        <NuxtLink class="nav__link" to="/">
          <span>Aktif</span>
          <span v-if="active.length" class="nav__badge">{{ active.length }}</span>
        </NuxtLink>
        <NuxtLink class="nav__link" to="/arsip">Arsip</NuxtLink>
        <NuxtLink class="nav__link" to="/sync">Sync</NuxtLink>
      </nav>
    </div>
  </header>
</template>
