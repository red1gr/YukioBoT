// Backups tab for the Yukio dashboard.
// Works out of the box: it drives the Security cog through its settings (create / restore / delete are one-shot switches).
// Optional: if the dashboard backend also exposes these routes (see backup_routes.py), the tab switches to full mode and
// can show exactly what is inside each backup:
//   GET    /api/guilds/:id/backups            -> cog.api_list(g)
//   GET    /api/guilds/:id/backups/:bid       -> cog.api_detail(g, bid)
//   POST   /api/guilds/:id/backups            -> await cog.api_create(g, body.note)
//   POST   /api/guilds/:id/backups/:bid/restore -> await cog.api_restore(g, bid)
//   DELETE /api/guilds/:id/backups/:bid       -> cog.api_delete(g, bid)
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { toast } from './api'

type Summary = { id: string; created?: string; note?: string; roles: number; channels: number; categories?: number; emojis: number; size?: number }
type Detail = {
  id: string
  roles: { name: string; position: number }[]
  channels: { name: string; type: string; category: string | null }[]
  emojis: { name: string }[]
}
type Props = { guildId: string; v: Record<string, any>; save: (p: Record<string, any>) => Promise<void>; reload: () => void }

const truthy = (x: any) => x === true || ['1', 'true', 'yes', 'on'].includes(String(x).toLowerCase())
const EMPTY = 'No backups yet'

async function call<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch(url, {
    method, credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (r.status === 401) { location.href = '/login'; throw new Error('401') }
  if (!r.ok) { const e: any = new Error(await r.text()); e.status = r.status; throw e }
  return r.json()
}

// "20261027-221800 (12R/8C/3E, note) | ..." (written by the cog into the read-only "backup_view" setting)
function parseView(text: any): { list: Summary[]; older: number } {
  const s = String(text ?? EMPTY)
  if (s === EMPTY) return { list: [], older: 0 }
  const list: Summary[] = []
  let older = 0
  for (const part of s.split(' | ')) {
    const m = /^(\S+) \((\d+)R\/(\d+)C\/(\d+)E(?:, (.*))?\)$/.exec(part.trim())
    if (m) list.push({ id: m[1], roles: +m[2], channels: +m[3], emojis: +m[4], note: m[5] })
    const o = /^\+(\d+) older$/.exec(part.trim())
    if (o) older = +o[1]
  }
  return { list, older }
}

const idDate = (id: string) => {
  const m = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/.exec(id)
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])) : null
}
const when = (b: Summary) => (b.created ? new Date(b.created) : idDate(b.id))
const ago = (d: Date | null) => {
  if (!d) return ''
  const m = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000))
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  if (m < 1440) return `${Math.round(m / 60)} h ago`
  return `${Math.round(m / 1440)} days ago`
}
const TYPE_TAG: Record<string, string> = { text: '#', news: 'news', voice: 'voice', stage: 'stage', forum: 'forum' }

/* Popup window: closes with the Close button, the Escape key or a click outside */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const o = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    addEventListener('keydown', k)
    return () => { removeEventListener('keydown', k); document.body.style.overflow = o }
  }, [onClose])
  return createPortal(
    <div className="sc-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="sc-dialog sec">
        <div className="sc-dialog-top">
          <div><h4>{title}</h4><p className="dim">This is what Restore can re-create.</p></div>
          <button className="p" onClick={onClose}>Close</button>
        </div>
        <div className="sc-dialog-body">{children}</div>
      </div>
    </div>, document.body)
}

export default function BackupPanel({ guildId, v, save, reload }: Props) {
  const base = `/api/guilds/${guildId}/backups`
  const [mode, setMode] = useState<'loading' | 'api' | 'settings'>('loading')
  const [apiList, setApiList] = useState<Summary[]>([])
  const [open, setOpen] = useState<Detail | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')
  const latest = useRef(v); latest.current = v
  const timer = useRef<number>()
  useEffect(() => () => window.clearInterval(timer.current), [])

  const loadApi = () => call<Summary[]>(base).then(l => { setApiList(l); setMode('api') }).catch(() => setMode('settings'))
  useEffect(() => { setMode('loading'); setOpen(null); loadApi() }, [guildId]) // eslint-disable-line

  const view = parseView(v.backup_view)
  const list = mode === 'api' ? apiList : view.list
  const stored = mode === 'api' ? apiList.length : view.list.length + view.older
  const keep = Number(v.backup_keep ?? 10)
  const hours = Number(v.backup_auto_hours ?? 0)
  const latestB = list[0]
  const latestDate = latestB ? when(latestB) : null
  const ageDays = latestDate ? (Date.now() - latestDate.getTime()) / 86400000 : null

  // wait for the bot (it reads switches every ~10 s) and refresh the values until `check` passes
  const wait = (check: () => boolean, ok: string, label: string) => {
    window.clearInterval(timer.current); setBusy(label)
    let n = 0
    timer.current = window.setInterval(() => {
      n++
      if (check()) { window.clearInterval(timer.current); setBusy(''); toast(ok); return }
      if (n >= 20) { window.clearInterval(timer.current); setBusy(''); toast('The bot did not answer. Check that it is online.'); return }
      reload()
    }, 2000)
  }

  const create = async () => {
    if (busy) return
    if (mode === 'api') {
      setBusy('Creating backup')
      try { await call(base, 'POST', { note }); toast('Backup created'); setNote(''); await loadApi(); reload() } catch (e: any) { toast('Backup failed: ' + e.message) }
      return setBusy('')
    }
    const before = String(latest.current.backup_view ?? EMPTY)
    await save({ backup_note: note })
    await save({ act_backup_create: true })
    setNote('')
    wait(() => String(latest.current.backup_view ?? EMPTY) !== before, 'Backup created', 'Creating backup')
  }

  const restore = async (id: string) => {
    if (busy) return
    if (!confirm(`Restore from backup ${id}?\n\nThis only re-creates roles, channels and emojis that are missing. Nothing that exists now is deleted.`)) return
    if (mode === 'api') {
      setBusy('Restoring')
      try { await call(`${base}/${id}/restore`, 'POST'); toast('Restore finished. See the log channel for details') } catch (e: any) { toast('Restore failed: ' + e.message) }
      return setBusy('')
    }
    await save({ backup_id: id, backup_restore_confirm: true })
    await save({ act_backup_restore: true })
    wait(() => !truthy(latest.current.act_backup_restore), 'Restore finished. See the log channel for details', 'Restoring')
  }

  const remove = async (id: string) => {
    if (busy || !confirm(`Delete backup ${id}? This cannot be undone.`)) return
    if (mode === 'api') {
      setBusy('Deleting')
      try { await call(`${base}/${id}`, 'DELETE'); toast('Backup deleted'); setOpen(null); await loadApi(); reload() } catch (e: any) { toast('Delete failed: ' + e.message) }
      return setBusy('')
    }
    await save({ backup_id: id })
    await save({ act_backup_delete: true })
    wait(() => !parseView(latest.current.backup_view).list.some(b => b.id === id), 'Backup deleted', 'Deleting')
  }

  const inspect = (id: string) => call<Detail>(`${base}/${id}`).then(setOpen).catch(e => toast('Could not open backup: ' + e.message))

  const Tog = ({ k, label, hint, d = false }: { k: string; label: string; hint?: string; d?: boolean }) =>
    <div className="row sc-row"><span className="n">{label}{hint && <small className="dim">{hint}</small>}</span>
      <input type="checkbox" checked={truthy(v[k] ?? d)} onChange={e => save({ [k]: e.target.checked })} /></div>

  const withCur = (opts: number[], cur: number) => (opts.includes(cur) ? opts : [...opts, cur].sort((a, b) => a - b))

  let health: { kind: 'ok' | 'todo'; text: string }
  if (!list.length) health = { kind: 'todo', text: 'No backup yet. Create one so you can rebuild the server if it gets damaged.' }
  else if (hours <= 0 && ageDays !== null && ageDays > 7) health = { kind: 'todo', text: 'Your newest backup is more than a week old and automatic backups are off.' }
  else health = { kind: 'ok', text: hours > 0 ? `Backed up automatically every ${hours} hours.` : 'You have a backup. Turn on automatic backups to keep it fresh.' }

  return (
    <>
      <h3>Backup status</h3>
      <div className="card sc-card">
        <div className="sc-head">
          <div><h4>How your server is backed up <span className={'sc-pill ' + health.kind}>{health.kind === 'ok' ? 'OK' : 'Action needed'}</span></h4>
            <p className="dim">{health.text}</p></div>
        </div>
        <div className="sc-stats">
          <div><small>Latest backup</small><strong>{latestDate ? latestDate.toLocaleString() : 'None'}</strong><small>{ago(latestDate)}</small></div>
          <div><small>Backups stored</small><strong>{stored}</strong><small>keeps the newest {keep}</small></div>
          <div><small>Automatic backups</small><strong>{hours > 0 ? `Every ${hours} h` : 'Off'}</strong><small>{hours > 0 ? 'running' : 'set below'}</small></div>
          <div><small>Latest contains</small><strong>{latestB ? `${latestB.roles} roles` : '-'}</strong>
            <small>{latestB ? `${latestB.channels} channels, ${latestB.emojis} emojis` : 'nothing yet'}</small></div>
        </div>
        <p className="dim sc-note">A backup saves roles, permissions, channels, categories and emojis. It does not save messages or members.</p>
      </div>

      <h3>Create a backup</h3>
      <div className="card sc-card">
        <div className="row sc-row">
          <span className="n">Note<small className="dim">Optional label, for example "before big changes".</small></span>
          <input placeholder="Note (optional)" maxLength={60} value={note} onChange={e => setNote(e.target.value)} />
        </div>
        <div className="sc-btns"><button className="p" disabled={!!busy || mode === 'loading'} onClick={create}>{busy || 'Create backup now'}</button></div>
      </div>

      <h3>Saved backups</h3>
      {!list.length && <span className="empty">No backups yet.</span>}
      <div className="sc-list">
        {list.map((b, i) => {
          const d = when(b)
          return (
            <div className="card sc-card sc-bk" key={b.id}>
              <div className="sc-head">
                <div>
                  <h4>{d ? d.toLocaleString() : b.id}{i === 0 && <span className="sc-pill ok">Newest</span>}{b.note && <span className="sc-pill opt">{b.note}</span>}</h4>
                  <p className="dim"><span className="mono">{b.id}</span> {d && <>- {ago(d)}</>}{b.size ? <> - {Math.max(1, Math.round(b.size / 1024))} KB</> : null}</p>
                </div>
                <div className="sc-btns sc-inline">
                  {mode === 'api' && <button disabled={!!busy} onClick={() => inspect(b.id)}>View contents</button>}
                  <button disabled={!!busy} onClick={() => restore(b.id)}>Restore</button>
                  <button className="d" disabled={!!busy} onClick={() => remove(b.id)}>Delete</button>
                </div>
              </div>
              <div className="sc-tags"><span>{b.roles} roles</span><span>{b.channels} channels{b.categories ? ` (${b.categories} categories)` : ''}</span><span>{b.emojis} emojis</span></div>
            </div>
          )
        })}
        {mode === 'settings' && view.older > 0 && <p className="dim sc-note">And {view.older} older backups that are not listed.</p>}
      </div>

      {mode === 'settings' && !!list.length && (
        <p className="dim sc-note">The contents view (roles, channels and emojis inside each backup) needs the optional backup routes on the dashboard backend. Backups, restore and delete work without them.</p>
      )}

      {open && <Modal title={`Inside backup ${open.id}`} onClose={() => setOpen(null)}>
          <div className="sc-inside">
            <div>
              <h5>Roles ({open.roles.length})</h5>
              <div className="sc-tags">{[...open.roles].sort((a, b) => b.position - a.position).map((r, i) => <span key={i}>{r.name}</span>)}{!open.roles.length && <span>none</span>}</div>
            </div>
            <div>
              <h5>Channels ({open.channels.filter(c => c.type !== 'category').length})</h5>
              {[null, ...open.channels.filter(c => c.type === 'category').map(c => c.name)].map(cat => {
                const items = open.channels.filter(c => c.type !== 'category' && c.category === cat)
                if (cat === null && !items.length) return null
                return (
                  <div className="sc-tree" key={cat ?? 'none'}>
                    <strong>{cat ?? 'No category'}</strong>
                    {items.map((c, i) => <div key={i}><em>{TYPE_TAG[c.type] ?? c.type}</em> {c.name}</div>)}
                    {!items.length && <div className="dim">empty category</div>}
                  </div>
                )
              })}
            </div>
            <div>
              <h5>Emojis ({open.emojis.length})</h5>
              <div className="sc-tags">{open.emojis.map((e, i) => <span key={i}>{e.name}</span>)}{!open.emojis.length && <span>none</span>}</div>
            </div>
          </div>
      </Modal>}

      <h3>Automatic backups</h3>
      <div className="card sc-card">
        <div className="row sc-row"><span className="n">Back up automatically<small className="dim">How often the bot makes a new backup by itself.</small></span>
          <select value={hours} onChange={e => save({ backup_auto_hours: Number(e.target.value) })}>
            {withCur([0, 6, 12, 24, 48, 168], hours).map(h => <option key={h} value={h}>{h === 0 ? 'Off' : h === 168 ? 'Every week' : h === 24 ? 'Every day' : `Every ${h} hours`}</option>)}</select></div>
        <div className="row sc-row"><span className="n">Backups to keep<small className="dim">Older backups are deleted automatically.</small></span>
          <select value={keep} onChange={e => save({ backup_keep: Number(e.target.value) })}>
            {withCur([5, 10, 20, 30], keep).map(k => <option key={k} value={k}>Keep the newest {k}</option>)}</select></div>
        <Tog k="backup_emojis" label="Include emoji images" hint="Needed to restore deleted emojis. Makes backup files bigger." d />
      </div>

      <h3>What Restore should re-create</h3>
      <div className="card sc-card">
        <p className="dim">Restore only adds what is missing. It never deletes or changes anything that exists now.</p>
        <Tog k="backup_restore_roles" label="Missing roles" d />
        <Tog k="backup_restore_channels" label="Missing channels and categories" d />
        <Tog k="backup_restore_emojis" label="Missing emojis" d />
        <Tog k="backup_restore_settings" label="Server settings" hint="Verification level, content filter and notification defaults. Changes existing settings." />
      </div>
    </>
  )
}