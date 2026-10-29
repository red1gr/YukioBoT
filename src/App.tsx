import { useEffect, useState } from 'react'
import { api, onToast } from './api'
import { Overview, Logs, Server, Leaderboard, Settings, Commands } from './views'
import SecurityTab from './SecurityTab'
import TicketsTab from './TicketsTab'
import Legal, { LegalFooter, legalPage } from './Legal'

const BOT_ID = import.meta.env.VITE_BOT_ID ?? '1554260133515886712'
const AVATAR = 'https://r2.fivemanage.com/S1wPEooftNoEmQjn8jhwx/5b55ae114cd60f4af538b42a45814f09.jpg'

const Security = ({ G }: { G: string; owner: boolean }) =>
  G ? <SecurityTab guildId={G} /> : <span className="empty">No server selected.</span>

const VIEWS = {
  overview: ['Overview', Overview], logs: ['Live logs', Logs], server: ['Server', Server],
  security: ['Security', Security],
  leaderboard: ['Leaderboard', Leaderboard], tickets: ['Tickets', TicketsTab], cogs: ['Settings', Settings], commands: ['Commands', Commands],
} as const
type ViewKey = keyof typeof VIEWS
const KEYS = Object.keys(VIEWS) as ViewKey[]

function Landing() {
  const [pub, setPub] = useState<any>({ status: 'offline' })
  useEffect(() => {
    document.title = 'Yukio'
    const load = async () => {
      try { const r = await fetch('/api/public', { cache: 'no-store' }); if (r.ok) setPub(await r.json()) } catch {}
    }
    load(); const t = setInterval(load, 30000); return () => clearInterval(t)
  }, [])
  const s = pub.status || 'offline'
  const label = ({ online: 'Online & ready', idle: 'Taking a nap', dnd: 'Busy right now', offline: 'Sleeping…' } as any)[s] || 'Sleeping…'
  const hello = s == 'offline' ? 'zzz... wake me up soon~' : 'Hi hi! I\'m Yukio~'
  const chips = ['Moderation', 'Live logs', 'Leveling', 'Tickets', 'Anti-nuke', 'Fun commands']
  return (
    <div id="landing">
      <div className="spk" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => <span key={i} style={{ ['--i' as any]: i }} />)}
      </div>
      <section className="hero">
        <div className="bubble" role="status">{hello}</div>
        <div className="av"><i className="ring" aria-hidden="true" />
          <img src={pub.avatar || AVATAR} alt="Bot avatar" />
          <span className="dot" data-s={s} role="img" aria-label={'Status: ' + s} /></div>
        <h1>Yukio<span className="tag">BOT</span></h1>
        <p className="handle">{pub.name ? '@' + pub.name : ''}</p>
        <p className="pill" data-s={s}><i />{label}</p>
        <p className="blurb">Your cute little Discord helper that keeps your server safe, tidy and fun.</p>
        <div className="chips">{chips.map(c => <span key={c}>{c}</span>)}</div>
        <div className="actions">
          <a className="btn p" href="/login">Login with Discord</a>
          <a className="btn" target="_blank" rel="noopener"
             href={`https://discord.com/oauth2/authorize?client_id=${BOT_ID}&permissions=8&scope=bot%20applications.commands`}>Invite the bot</a>
        </div>
        <LegalFooter />
      </section>
    </div>
  )
}

function Dashboard({ guilds, owner }: { guilds: any[]; owner: boolean }) {
  const initial = location.hash.slice(1) as ViewKey
  const [view, setView] = useState<ViewKey>(KEYS.includes(initial) ? initial : 'overview')
  const [G, setG] = useState(() => {
    let saved = ''; try { saved = localStorage.getItem('yukio.guild') ?? '' } catch {}
    return guilds.some(g => g.id == saved) ? saved : guilds[0]?.id || ''
  })

  const go = (v: ViewKey) => { setView(v); history.replaceState(null, '', '#' + v) }
  useEffect(() => { document.title = 'Yukio - Dashboard' }, [])
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? '')) return
      const k = KEYS[+e.key - 1]; if (k) go(k)
    }
    addEventListener('keydown', h); return () => removeEventListener('keydown', h)
  }, [])

  const View = VIEWS[view][1] as any
  return (
    <div id="app">
      <nav>
        <h1><b>Yukio</b></h1>
        {KEYS.map(k => (
          <a key={k} data-v={k} role="button" tabIndex={0} className={view == k ? 'on' : ''}
             aria-current={view == k ? 'page' : undefined} onClick={() => go(k)}
             onKeyDown={e => (e.key == 'Enter' || e.key == ' ') && (e.preventDefault(), go(k))}>{VIEWS[k][0]}</a>
        ))}
        <a href="/logout" style={{ marginTop: 'auto' }} onClick={async e => {
          e.preventDefault()
          try { await fetch('/logout', { redirect: 'manual', credentials: 'same-origin' }) } catch {}
          location.replace('/')
        }}>Log out</a>
      </nav>
      <main>
        <header>
          <h2>{VIEWS[view][0]}</h2>
          <select aria-label="Server" value={G} onChange={e => {
            setG(e.target.value); try { localStorage.setItem('yukio.guild', e.target.value) } catch {}
          }}>
            {guilds.map(g => <option key={g.id} value={g.id}>{g.name} ({g.members})</option>)}
          </select>
        </header>
        <div id="v"><View key={view + G} G={G} owner={owner} /></div>
      </main>
    </div>
  )
}

function Toasts() {
  const [items, setItems] = useState<{ id: number; m: string; out?: boolean }[]>([])
  useEffect(() => onToast(m => {
    const id = Date.now() + Math.random()
    setItems(x => [...x, { id, m }])
    setTimeout(() => setItems(x => x.map(i => i.id == id ? { ...i, out: true } : i)), 2800)
    setTimeout(() => setItems(x => x.filter(i => i.id != id)), 3060)
  }), [])
  return (
    <div id="toasts" aria-live="polite">
      {items.map(i => <div key={i.id} className={'toast' + (/error|fail|denied/i.test(i.m) ? ' err' : '') + (i.out ? ' out' : '')}>{i.m}</div>)}
    </div>
  )
}

export default function App() {
  const legal = legalPage()
  const [state, setState] = useState<{ s: 'loading' | 'out' | 'in'; guilds?: any[]; owner?: boolean }>({ s: 'loading' })
  useEffect(() => {
    if (legal) return
    ;(async () => {
      try {
        const r = await fetch('/api/guilds')
        if (r.ok) {
          let owner = false
          try { owner = !!(await (await fetch('/api/me')).json()).owner } catch {}
          return setState({ s: 'in', guilds: await r.json(), owner })
        }
      } catch {}
      setState({ s: 'out' })
    })()
  }, [])
  if (legal) return <Legal page={legal} />
  return (<>
    {state.s == 'out' && <Landing />}
    {state.s == 'in' && <Dashboard guilds={state.guilds!} owner={!!state.owner} />}
    <Toasts />
  </>)
}