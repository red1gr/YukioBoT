import { useEffect, useRef, useState } from 'react'
import './guildpicker.css'

type G = { id: string; name: string; members: number; icon?: string | null }

export const INVITE_URL = 'https://yukio.red1gr.dev/invite'

const initials = (n: string) =>
  n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => [...w][0]).join('').toUpperCase() || '?'
const count = (n: number) => `${(n ?? 0).toLocaleString()} member${n == 1 ? '' : 's'}`

function Icon({ g }: { g: G }) {
  const [bad, setBad] = useState(false)
  return g.icon && !bad
    ? <img className="gp-ic" src={g.icon} alt="" loading="lazy" onError={() => setBad(true)} />
    : <span className="gp-ic gp-fb" aria-hidden="true">{initials(g.name)}</span>
}

export default function GuildPicker({ guilds, value, onChange }: { guilds: G[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const search = guilds.length > 6
  const cur = guilds.find(g => g.id == value) ?? guilds[0]

  const shown = q.trim() ? guilds.filter(g => g.name.toLowerCase().includes(q.trim().toLowerCase())) : guilds
  // keyboard cursor: 0..shown.length-1 are servers, shown.length is the "Add a server" link
  const ADD = shown.length
  const [hi, setHi] = useState(0)

  useEffect(() => {
    if (!open) return
    const d = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', d)
    return () => document.removeEventListener('mousedown', d)
  }, [open])

  useEffect(() => {
    if (open) scroller.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [open, hi])

  if (!cur) return null

  const show = () => { setQ(''); setHi(Math.max(0, guilds.findIndex(g => g.id == cur.id))); setOpen(true) }
  const close = () => { setOpen(false); setQ('') }
  const pick = (g: G) => { close(); if (g.id != value) onChange(g.id) }
  const key = (e: React.KeyboardEvent) => {
    if (e.key == 'Escape') { if (open) { e.stopPropagation(); close() } return }
    if (e.key == 'Tab') return close()
    if (e.key == 'ArrowDown' || e.key == 'ArrowUp') {
      e.preventDefault()
      if (!open) return show()
      return setHi(h => Math.min(ADD, Math.max(0, h + (e.key == 'ArrowDown' ? 1 : -1))))
    }
    if (e.key == 'Home' && open) { e.preventDefault(); return setHi(0) }
    if (e.key == 'End' && open) { e.preventDefault(); return setHi(ADD) }
    if (e.key == 'Enter' || (e.key == ' ' && (e.target as HTMLElement).tagName != 'INPUT')) {
      e.preventDefault()
      if (!open) return show()
      if (hi == ADD) { window.open(INVITE_URL, '_blank', 'noopener'); return close() }
      if (shown[hi]) pick(shown[hi])
    }
  }

  return (
    <div className="gp" ref={root} onKeyDown={key}>
      <button type="button" className={'gp-btn' + (open ? ' open' : '')} aria-haspopup="listbox" aria-expanded={open}
        aria-label={`Server: ${cur.name}`} onClick={() => (open ? close() : show())}>
        <Icon g={cur} />
        <span className="gp-tx"><b>{cur.name}</b><small>{count(cur.members)}</small></span>
        <i className="gp-chev" aria-hidden="true" />
      </button>

      {open && (
        <div className="gp-list">
          <div className="gp-top">
            <span>Your servers</span><em>{guilds.length}</em>
          </div>
          {search && (
            <input className="gp-search" type="text" placeholder="Search servers…" value={q} autoFocus
              aria-label="Search servers" onChange={e => { setQ(e.target.value); setHi(0) }} />
          )}
          <div className="gp-scroll" role="listbox" aria-label="Servers" ref={scroller}>
            {shown.map((g, i) => (
              <div key={g.id} data-i={i} role="option" aria-selected={g.id == value}
                className={'gp-opt' + (g.id == value ? ' sel' : '') + (i == hi ? ' hi' : '')}
                onMouseEnter={() => setHi(i)} onClick={() => pick(g)}>
                <Icon g={g} />
                <span className="gp-tx"><b>{g.name}</b><small>{count(g.members)}</small></span>
                {g.id == value && <i className="gp-tick" aria-hidden="true" />}
              </div>
            ))}
            {!shown.length && <p className="gp-none">No servers match "{q}".</p>}
          </div>
          <a className={'gp-add' + (hi == ADD ? ' hi' : '')} data-i={ADD} href={INVITE_URL} target="_blank" rel="noopener"
            onMouseEnter={() => setHi(ADD)} onClick={close}>
            <span className="gp-plus" aria-hidden="true" />
            <span className="gp-tx"><b>Add a server</b><small>Invite Yukio to another server</small></span>
            <i className="gp-ext" aria-hidden="true" />
          </a>
        </div>
      )}
    </div>
  )
}