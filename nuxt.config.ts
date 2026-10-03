export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },

  // Data hidup di localStorage, jadi render-nya di browser aja.
  // Nitro tetap jalan buat /api/sync (proxy ke JSON Storage API).
  ssr: false,

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    syncProvider: 'cloud',
    syncApiKey: '',
  },

  nitro: {
    // fs storage dinonaktifkan di Vercel agar tidak memicu EROFS read-only filesystem
    storage: process.env.VERCEL
      ? {}
      : {
          sync: {
            driver: 'fs',
            base: './.data/sync',
          },
        },
  },

  app: {
    head: {
      htmlAttrs: { lang: 'id' },
      title: 'Nugaseen — tugas kelar, rasanya kecatat',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'color-scheme', content: 'dark' },
        { name: 'theme-color', content: '#0a0f1c' },
        {
          name: 'description',
          content:
            'Catat tugas, kelarin, lalu ceritain gimana rasanya. Nggak ada yang dihapus — semuanya masuk arsip bulanan.',
        },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Archivo+Black&display=swap',
        },
      ],
    },
  },
})
