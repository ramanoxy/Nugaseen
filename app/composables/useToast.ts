export interface Toast {
  id: number
  text: string
  kind: 'ok' | 'bad'
}

let seq = 0

export function useToast() {
  const toasts = useState<Toast[]>('nuga:toasts', () => [])

  function show(text: string, kind: Toast['kind'] = 'ok') {
    const id = ++seq
    toasts.value = [...toasts.value, { id, text, kind }]
    if (import.meta.client) {
      setTimeout(() => {
        toasts.value = toasts.value.filter((t) => t.id !== id)
      }, kind === 'bad' ? 6500 : 3800)
    }
  }

  return {
    toasts,
    ok: (text: string) => show(text, 'ok'),
    bad: (text: string) => show(text, 'bad'),
  }
}
