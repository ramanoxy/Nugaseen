<script setup lang="ts">
const { toJSON, fromJSON, snapshot } = useTasks()
const { code, auto, lastAt, busy, error, linked, setAuto, push, pull, syncNow, unlink } = useSync()
const toast = useToast()

useHead({ title: 'Nugaseen — sync antar perangkat' })

const inputCode = ref('')
const confirmUnlink = ref(false)

/** Tempel kode dari perangkat lain, lalu tarik. */
async function joinWithCode() {
  const raw = inputCode.value.trim()
  if (!raw) return
  const ok = await pull(raw)
  if (ok) inputCode.value = ''
}

/** Ekspor ke file JSON. */
function exportFile() {
  const json = toJSON()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `nugaseen-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  toast.ok('File JSON udah diunduh.')
}

/** Impor dari file JSON. */
function importFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      fromJSON(text, 'merge')
      toast.ok('Catatan dari file udah digabung.')
    } catch {
      toast.bad('File-nya nggak bisa dibaca. Pastiin format JSON yang valid.')
    }
  }
  input.click()
}

function doUnlink() {
  unlink()
  confirmUnlink.value = false
  toast.ok('Kode sync udah dilepas dari perangkat ini. Data lokal tetap aman.')
}
</script>

<template>
  <div class="stack stack--lg">
    <section class="stack">
      <div>
        <h1>Sync</h1>
        <p class="lede">
          Sambungin beberapa perangkat pakai kode yang sama. Catatan kamu hidup di browser ini —
          sync cuma nyalin salinan ke awan biar perangkat lain bisa narik.
        </p>
      </div>
    </section>

    <!-- Status kalau udah tersambung -->
    <section v-if="linked" class="slab stack">
      <div class="row row--split">
        <div>
          <p class="label">Kode sync kamu</p>
          <p class="code">{{ prettyCode(code) }}</p>
          <p class="hint" style="margin-top: 0.4rem">
            Ketik kode ini di perangkat lain buat nyambungin.
          </p>
        </div>
      </div>

      <div class="row">
        <button
          class="btn btn--go"
          :disabled="!!busy"
          @click="syncNow()"
        >
          {{ busy === 'push' ? 'Mendorong…' : busy === 'pull' ? 'Menarik…' : 'Sinkronkan sekarang' }}
        </button>
        <button class="btn" :disabled="!!busy" @click="push()">Dorong ke awan</button>
        <button class="btn" :disabled="!!busy" @click="pull()">Tarik dari awan</button>
      </div>

      <p v-if="error" class="err">{{ error }}</p>

      <div class="meta-row">
        <label class="toggle">
          <input
            type="checkbox"
            :checked="auto"
            @change="setAuto(($event.target as HTMLInputElement).checked)"
          />
          <span class="toggle__label">Auto-sync</span>
          <span class="toggle__hint">Dorong otomatis tiap ada perubahan</span>
        </label>
        <p v-if="lastAt" class="hint">
          Terakhir sync: {{ stamp(lastAt) }}
        </p>
      </div>

      <div class="divider" />

      <div class="row">
        <button v-if="!confirmUnlink" class="btn btn--bare" @click="confirmUnlink = true">
          Lepas kode dari perangkat ini
        </button>
        <template v-else>
          <p class="hint grow">Data lokal nggak disentuh, cuma kodenya yang dibuang.</p>
          <button class="btn btn--bad" @click="doUnlink">Ya, lepas</button>
          <button class="btn btn--bare" @click="confirmUnlink = false">Batal</button>
        </template>
      </div>
    </section>

    <!-- Belum tersambung -->
    <section v-else class="stack">
      <div class="slab stack">
        <h2>Mulai sync baru</h2>
        <p class="muted">
          Bikin kode baru dari perangkat ini. Nanti tinggal ketik kode itu di perangkat lain.
        </p>
        <button
          class="btn btn--go"
          :disabled="!!busy"
          @click="push()"
        >
          {{ busy === 'push' ? 'Mendorong…' : 'Bikin kode baru & dorong' }}
        </button>
        <p v-if="error" class="err">{{ error }}</p>
      </div>

      <div class="slab stack">
        <h2>Punya kode dari perangkat lain?</h2>
        <p class="muted">
          Ketik atau tempel kode sync yang udah ada, lalu tarik catatannya ke sini.
        </p>
        <form class="join-form" @submit.prevent="joinWithCode">
          <input
            v-model="inputCode"
            class="input code--input"
            maxlength="30"
            placeholder="XXXX XXXX XXXX"
            aria-label="Kode sync"
          />
          <button
            type="submit"
            class="btn btn--go"
            :disabled="!!busy || !inputCode.trim()"
          >
            {{ busy === 'pull' ? 'Menarik…' : 'Sambung & tarik' }}
          </button>
        </form>
        <p v-if="error" class="err">{{ error }}</p>
      </div>
    </section>

    <!-- Ekspor / Impor -->
    <section class="stack">
      <div class="section__head">
        <h2>Cadangan file</h2>
      </div>
      <p class="muted">
        Ekspor semua catatan ke file JSON, atau impor dari file cadangan. Impor pakai mode gabung — yang lebih baru menang.
      </p>
      <div class="row">
        <button class="btn" @click="exportFile">Ekspor ke JSON</button>
        <button class="btn" @click="importFile">Impor dari JSON</button>
      </div>
    </section>

    <!-- Info -->
    <section class="stack">
      <div class="section__head">
        <h2>Gimana cara kerjanya?</h2>
      </div>
      <div class="info-grid">
        <div class="info-card slab--quiet">
          <h3>Data di browser kamu</h3>
          <p class="muted small">
            Semua catatan hidup di localStorage perangkat ini. Nggak ada akun, nggak ada server yang nyimpen data kamu secara permanen.
          </p>
        </div>
        <div class="info-card slab--quiet">
          <h3>Sync = nyalin ke awan</h3>
          <p class="muted small">
            Pas kamu dorong, salinan dikirim ke penyimpanan JSON gratis. Perangkat lain bisa narik salinan itu pakai kode yang sama.
          </p>
        </div>
        <div class="info-card slab--quiet">
          <h3>Yang baru menang</h3>
          <p class="muted small">
            Kalau ada tugas yang sama tapi beda isi, yang paling terakhir diubah yang dipakai. Nggak ada data yang hilang.
          </p>
        </div>
        <div class="info-card slab--quiet">
          <h3>Penyimpanan terpercaya</h3>
          <p class="muted small">
            Tersimpan aman di server Nugaseen. Kamu juga bisa pakai jsonstorage atau ekspor ke file JSON kapan saja.
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lede {
  margin-top: 0.6rem;
  font-size: 1.02rem;
  color: var(--chalk-2);
}

.join-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.join-form .input {
  flex: 1 1 14rem;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}

.toggle {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.2rem 0.6rem;
  align-items: center;
  cursor: pointer;
}

.toggle input[type='checkbox'] {
  width: 1.1rem;
  height: 1.1rem;
  grid-row: span 2;
  accent-color: var(--signal);
  cursor: pointer;
}

.toggle__label {
  font-size: 0.9rem;
  font-weight: 700;
}

.toggle__hint {
  font-size: 0.78rem;
  color: var(--chalk-3);
}

.divider {
  height: 1px;
  background: var(--line);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: 0.5rem;
}

.info-card {
  padding: 1rem;
  display: grid;
  gap: 0.4rem;
  border: 1px solid var(--line-2);
  border-radius: 10px;
}
</style>
