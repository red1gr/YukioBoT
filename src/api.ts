type Listener = (m: string) => void
const listeners = new Set<Listener>()
export const onToast = (f: Listener) => (listeners.add(f), () => void listeners.delete(f))
export const toast = (m: string) => listeners.forEach(f => f(m))

export async function api<T = any>(path: string, body?: unknown, method?: string): Promise<T> {
  const r = await fetch('/api' + path, body || method
    ? { method: method || 'POST', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }
    : {})
  if (r.status === 401) { location.href = '/login'; throw 0 }
  const j = await r.json()
  if (!r.ok) { toast(j.detail || 'Error'); throw 0 }
  return j
}

export const fmt = (t: number) => new Date(t * 1000).toLocaleString()
export const dur = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
