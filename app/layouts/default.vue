<template>
  <a class="skip" href="#isi">Lompat ke isi</a>
  <TheHeader />
  <main id="isi" class="shell">
    <slot />
  </main>
  <ToastDeck />
</template>

<style>
.skip {
  position: absolute;
  inset-inline-start: 0.5rem;
  inset-block-start: -4rem;
  z-index: 100;
  background: var(--ring);
  color: var(--void);
  border: var(--bw-2) solid var(--void);
  padding: 0.5rem 0.9rem;
  font-weight: 700;
  text-decoration: none;
  transition: inset-block-start 0.12s linear;
}

.skip:focus-visible {
  inset-block-start: 0.5rem;
  outline-offset: 2px;
}
</style>
