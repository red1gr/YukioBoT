import { useEffect, useRef, useState } from 'react'
import './guildpicker.css'

type G = { id: string; name: string; members: number; icon?: string | null }

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
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const idx = Math.max(0, guilds.findIndex(g => g.id == value))
  const [hi, setHi] = useState(idx)
  const cur = guilds[idx]

  useEffect(() => {
    if (!open) return
    const d = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', d)
    return () => document.removeEventListener('mousedown', d)
  }, [open])

  useEffect(() => {
    if (open) (list.current?.children[hi] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' })
  }, [open, hi])

  if (!cur) return null

  const show = () => { setHi(idx); setOpen(true) }
  const pick = (g: G) => { setOpen(false); if (g.id != value) onChange(g.id) }
  const key = (e: React.KeyboardEvent) => {
    if (e.key == 'Escape') return setOpen(false)
    if (e.key == 'ArrowDown' || e.key == 'ArrowUp') {
      e.preventDefault()
      if (!open) return show()
      return setHi(h => Math.min(guilds.length - 1, Math.max(0, h + (e.key == 'ArrowDown' ? 1 : -1))))
    }
    if (e.key == 'Enter' || e.key == ' ') { e.preventDefault(); open ? pick(guilds[hi]) : show() }
  }

  return (
    <div className="gp" ref={root} onKeyDown={key}>
      <button type="button" className={'gp-btn' + (open ? ' open' : '')} aria-haspopup="listbox" aria-expanded={open}
        aria-label={`Server: ${cur.name}`} onClick={() => (open ? setOpen(false) : show())}>
        <Icon g={cur} />
        <span className="gp-tx"><b>{cur.name}</b><small>{count(cur.members)}</small></span>
        <i className="gp-chev" aria-hidden="true" />
      </button>
      {open && (
        <div className="gp-list" role="listbox" aria-label="Servers" ref={list}>
          {guilds.map((g, i) => (
            <div key={g.id} role="option" aria-selected={g.id == value}
              className={'gp-opt' + (g.id == value ? ' sel' : '') + (i == hi ? ' hi' : '')}
              onMouseEnter={() => setHi(i)} onClick={() => pick(g)}>
              <Icon g={g} />
              <span className="gp-tx"><b>{g.name}</b><small>{count(g.members)}</small></span>
              {g.id == value && <i className="gp-tick" aria-hidden="true" />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
