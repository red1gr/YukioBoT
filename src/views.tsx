import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, fmt, dur, toast } from './api'

type P = { G: string; owner: boolean }
const Empty = ({ children }: { children: ReactNode }) => <span className="empty">{children}</span>
const Skeleton = () => <><div className="sk" /><div className="sk s" /><div className="sk s" /></>
const copyId = (e: React.MouseEvent) => navigator.clipboard?.writeText(e.currentTarget.textContent!.trim()).then(() => toast('ID copied'))
const Id = ({ v }: { v: string }) => <span className="mono cp" onClick={copyId}>{v}</span>
const Opt = ({ list, pre = '#' }: { list: any[]; pre?: string }) => <>{list.map(c => <option key={c.id} value={c.id}>{pre}{c.name}</option>)}</>

function useLoad<T>(fn: () => Promise<T>, deps: any[]) {
  const [d, setD] = useState<T>()
  const reload = useCallback(() => { fn().then(setD).catch(() => {}) }, deps) // eslint-disable-line
  useEffect(reload, [reload])
  return [d, reload, setD] as const
}

/* ---------- Events ---------- */
function EventRow({ e }: { e: any }) {
  const f = Object.entries(e.fields || {})
  return (
    <div className="ev">
      <span className={'t ' + e.type}>{e.type}</span><b>{e.title}</b> <span className="dim">{fmt(e.ts)}</span>
      <div>{e.body}</div>
      {f.length > 0 && <details><summary>Details</summary>{f.map(([k, v]) => <div key={k}><span className="mono">{k}</span>: {String(v)}</div>)}</details>}
    </div>
  )
}

/* ---------- Overview ---------- */
export function Overview({ G, owner }: P) {
  const [o] = useLoad(() => api('/overview'), [])
  const [ev] = useLoad(() => api<any[]>('/events?limit=15' + (G ? '&guild_id=' + G : '')), [G])
  const [st] = useLoad(() => api<any[]>('/stats?days=7' + (G ? '&guild_id=' + G : '')), [G])
  const [status, setStatus] = useState('online'); const [text, setText] = useState('')
  if (!o) return <Skeleton />
  const days: Record<string, number> = {}; (st || []).forEach(x => (days[x.day] = (days[x.day] || 0) + x.count))
  const mx = Math.max(1, ...Object.values(days))
  const cards = [['Bot', o.bot], ['Ping', o.latency_ms + ' ms'], ['Uptime', dur(o.uptime)], ['Servers', o.guilds], ['Members', o.members], ['Commands', o.commands]]
  return <>
    <div className="grid">{cards.map(([a, b]) => <div className="card" key={a}><small>{a}</small><b>{String(b)}</b></div>)}</div>
    <div className="cols" style={owner ? undefined : { gridTemplateColumns: '1fr' }}>
      <div><h3>Activity (7 days)</h3><div className="card">
        {Object.entries(days).map(([k, v]) => (
          <div className="row" key={k} style={{ padding: '6px 0', border: 0 }}>
            <span className="dim mono" style={{ width: 90 }}>{k}</span>
            <div className="bar" style={{ width: (v / mx) * 60 + '%' }} />
            <span style={{ marginLeft: 'auto', fontWeight: 700 }}>{v}</span>
          </div>))}
        {!Object.keys(days).length && <Empty>No data yet.</Empty>}
      </div></div>
      {owner && <div><h3>Bot presence</h3><div className="row">
        <select value={status} onChange={e => setStatus(e.target.value)}>{['online', 'idle', 'dnd', 'invisible'].map(s => <option key={s}>{s}</option>)}</select>
        <input placeholder="Playing..." style={{ flex: 1 }} value={text} onChange={e => setText(e.target.value)} />
        <button className="p" onClick={async () => { await api('/presence', { status, text }); toast('Presence updated') }}>Set</button>
      </div></div>}
    </div>
    <h3>Latest activity</h3>
    {ev?.map((e, i) => <EventRow key={i} e={e} />)}{ev && !ev.length && <Empty>Nothing yet.</Empty>}
  </>
}

/* ---------- Logs ---------- */
export function Logs({ G, owner }: P) {
  const [q, setQ] = useState(''); const [type, setType] = useState('')
  const [types, setTypes] = useState<string[]>([])
  const [ev, setEv] = useState<any[]>()
  useEffect(() => {
    (G ? api('/guilds/' + G) : Promise.resolve({ log_types: [] })).then(i =>
      setTypes([...new Set<string>([...i.log_types, 'command', 'error', 'dashboard', 'guild', 'warn', 'automod', 'ticket', 'antinuke', 'verify', 'protect'])]))
  }, [G])
  const load = useCallback(() => api<any[]>(`/events?limit=200&guild_id=${G}&type=${type}&q=${encodeURIComponent(q)}`).then(setEv).catch(() => {}), [G, type, q])
  useEffect(() => {
    load()
    let t: number | undefined
    const start = () => { clearInterval(t); t = window.setInterval(load, 4000) }
    const vis = () => (document.hidden ? clearInterval(t) : (load(), start()))
    start(); document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [load])
  return <>
    <div className="row">
      <input placeholder="Search logs" style={{ flex: 1 }} value={q} onChange={e => setQ(e.target.value)} />
      <select value={type} onChange={e => setType(e.target.value)}><option value="">All types</option>{types.map(t => <option key={t}>{t}</option>)}</select>
      <button onClick={() => (location.href = '/api/events/export?guild_id=' + G)}>Export CSV</button>
      {owner && <button className="d" onClick={async () => {
        const d = prompt('Delete events older than how many days?', '30'); if (d === null) return
        await api('/events?days=' + encodeURIComponent(d), null, 'DELETE'); load()
      }}>Prune</button>}
    </div>
    {!ev ? <Skeleton /> : ev.length ? ev.map((e, i) => <EventRow key={i} e={e} />) : <Empty>No events.</Empty>}
  </>
}

/* ---------- Server ---------- */
function Members({ G }: { G: string }) {
  const [q, setQ] = useState(''); const [m, setM] = useState<any[]>()
  const act = async (a: string, u: string) => {
    let body: any
    if (a == 'timeout') { const n = prompt('Timeout minutes (0 = remove)?', '10'); if (n === null) return; body = { minutes: +n } }
    else if (a == 'nick') { const n = prompt('New nickname (blank = reset)'); if (n === null) return; body = { nick: n } }
    else {
      const r = prompt(`Reason to ${a}?`); if (r === null) return
      if ((a == 'kick' || a == 'ban') && !confirm(`Really ${a} this member?`)) return
      body = { reason: r }
    }
    const r = await api(`/guilds/${G}/members/${u}/${a}`, body)
    toast(a == 'warn' ? `Warned (${r.total} total)${r.timed_out ? ', timed out' : ''}` : 'Done')
  }
  return <>
    <h3>Members</h3>
    <div className="row"><input placeholder="Name or ID" style={{ flex: 1 }} value={q} onChange={e => setQ(e.target.value)} />
      <button onClick={async () => setM(await api(`/guilds/${G}/members?q=` + encodeURIComponent(q)))}>Search</button></div>
    {m?.map(x => <div className="row" key={x.id}>
      <span className="n">{x.name} <Id v={x.id} /></span>
      {['warn', 'timeout', 'nick'].map(a => <button key={a} onClick={() => act(a, x.id)}>{a[0].toUpperCase() + a.slice(1)}</button>)}
      {['kick', 'ban'].map(a => <button key={a} className="d" onClick={() => act(a, x.id)}>{a[0].toUpperCase() + a.slice(1)}</button>)}
    </div>)}
    {m && !m.length && <Empty>No members found.</Empty>}
  </>
}



function Bans({ G }: { G: string }) {
  const [b, setB] = useState<any[]>()
  return <>
    <h3>Bans</h3><div className="row"><button onClick={async () => setB(await api(`/guilds/${G}/bans`))}>Load bans</button></div>
    {b?.map(x => <div className="row" key={x.id}>
      <span className="n">{x.name} <span className="dim"><Id v={x.id} /> {x.reason || ''}</span></span>
      <button onClick={async () => {
        if (!confirm('Unban this user?')) return
        await api(`/guilds/${G}/members/${x.id}/unban`, { reason: 'via dashboard' }); setB(b.filter(y => y.id != x.id))
      }}>Unban</button>
    </div>)}
    {b && !b.length && <Empty>No bans.</Empty>}
  </>
}

export function Server({ G, owner }: P) {
  const [g] = useLoad(() => (G ? api('/guilds/' + G) : Promise.resolve(null)), [G])
  const [msg, setMsg] = useState(''); const [ch, setCh] = useState('')
  const [et, setEt] = useState(''); const [ed, setEd] = useState(''); const [ecol, setEcol] = useState('5865F2')
  const [amount, setAmount] = useState(10); const [du, setDu] = useState(''); const [dm, setDm] = useState('')
  if (!G) return <Empty>No server selected.</Empty>
  if (!g) return <Skeleton />
  const channels: any[] = g.channels
  const cid = ch || channels[0]?.id || ''
  const Chan = <select value={cid} onChange={e => setCh(e.target.value)}><Opt list={channels} /></select>
  return <>
    <h3>Log channels</h3>
    {g.has_logs_cog ? g.log_types.map((t: string) => (
      <div className="row" key={t}><span className="n">{t}</span>
        <select defaultValue={g.log_channels[t] ?? ''} onChange={async e => { await api(`/guilds/${G}/logchannel`, { type: t, channel_id: e.target.value }); toast('Saved') }}>
          <option value="">off</option><Opt list={channels} /></select>
      </div>)) : <Empty>Logs cog is not loaded.</Empty>}

    <h3>Send message</h3>
    <div className="row">{Chan}<input placeholder="Message" style={{ flex: 1 }} value={msg} onChange={e => setMsg(e.target.value)} />
      <button className="p" onClick={async () => { await api(`/guilds/${G}/send`, { channel_id: cid, content: msg }); setMsg(''); toast('Sent') }}>Send</button></div>

    <h3>Send embed</h3>
    <div className="row">{Chan}<input placeholder="Title" style={{ flex: 1 }} value={et} onChange={e => setEt(e.target.value)} />
      <input placeholder="Color hex" style={{ width: 110 }} value={ecol} onChange={e => setEcol(e.target.value)} /></div>
    <div className="row" style={{ border: 0 }}>
      <textarea placeholder="Description" rows={3} style={{ flex: 1 }} value={ed} onChange={e => setEd(e.target.value)} />
      <button className="p" onClick={async () => { await api(`/guilds/${G}/embed`, { channel_id: cid, title: et, description: ed, color: ecol }); setEt(''); setEd(''); toast('Sent') }}>Send embed</button></div>

    <h3>Purge messages</h3>
    <div className="row">{Chan}<input type="number" min={1} max={100} style={{ width: 90 }} value={amount} onChange={e => setAmount(+e.target.value)} />
      <button className="d" onClick={async () => {
        if (!confirm(`Delete the last ${amount} messages in this channel?`)) return
        const r = await api(`/guilds/${G}/purge`, { channel_id: cid, amount }); toast('Deleted ' + r.deleted)
      }}>Purge</button></div>

    {owner && <><h3>Direct message</h3>
      <div className="row"><input placeholder="User ID" value={du} onChange={e => setDu(e.target.value)} />
        <input placeholder="Message" style={{ flex: 1 }} value={dm} onChange={e => setDm(e.target.value)} />
        <button className="p" onClick={async () => { await api(`/guilds/${G}/dm`, { user_id: du, content: dm }); setDm(''); toast('Sent') }}>Send DM</button></div></>}

    <Members G={G} /><Bans G={G} />
  </>
}

/* ---------- Leaderboard ---------- */
export function Leaderboard({ G }: P) {
  const [r] = useLoad(() => (G ? api<any[]>(`/guilds/${G}/leaderboard`) : Promise.resolve([])), [G])
  if (!G) return <Empty>No server selected.</Empty>
  if (!r) return <Skeleton />
  if (!r.length) return <Empty>No XP yet. Load the leveling cog and enable it under Settings.</Empty>
  return <>{r.map((x, i) => <div className="row" key={i}>
    <span className="mono" style={{ width: 32 }}>#{i + 1}</span><span className="n">{x.name}</span>
    <span className="dim">{x.msgs} msgs</span><span>Lv {x.level}</span><span className="mono">{x.xp} XP</span></div>)}</>
}

/* ---------- Settings (cogs) ---------- */
function CogCard({ c, G, owner, info, refresh }: any) {
  const [vals, setVals] = useState<any>()
  const [chan, setChan] = useState('')
  useEffect(() => { if (c.loaded && c.settings.length && G) api(`/cogs/${c.name}/settings/${G}`).then(setVals) }, [c.name, c.loaded, G])
  const lists: any = { channel: info.channels || [], role: info.roles || [], voice: info.voice_channels || [] }
  const pre: any = { channel: '#', role: '@', voice: '🔊 ' }
  const set = (k: string, v: any) => setVals((x: any) => ({ ...x, [k]: v }))
  const life = async (a: string) => {
    if (a == 'unload' && !confirm(`Unload ${c.name}?`)) return
    try { await api(`/cogs/${c.name}/${a}`, {}); toast(`${c.name}: ${a}ed`) } finally { refresh() }
  }
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="row" style={{ border: 0, padding: 0 }}>
        <span className="n"><b style={{ textTransform: 'uppercase' }}>{c.name}</b>{owner && <> <span className={c.loaded ? 'on' : 'off'}>{c.loaded ? 'loaded' : 'unloaded'}</span></>}</span>
        {owner && (c.loaded ? <><button onClick={() => life('reload')}>Reload</button><button className="d" onClick={() => life('unload')}>Unload</button></>
          : <button className="p" onClick={() => life('load')}>Load</button>)}
      </div>
      {vals && <>
        <h3>Settings for this server</h3>
        {c.settings.map((s: any) => {
          const v = vals[s.key]
          return <div className="row" key={s.key}><span className="n">{s.label}</span>
            {lists[s.type] ? <select value={v ?? ''} onChange={e => set(s.key, e.target.value)}>
                <option value="">- none -</option><Opt list={lists[s.type]} pre={pre[s.type]} /></select>
              : s.type == 'bool' ? <input type="checkbox" checked={!!v} onChange={e => set(s.key, e.target.checked)} />
              : <input value={v ?? ''} onChange={e => set(s.key, s.type == 'number' ? Number(e.target.value) : e.target.value)} />}
          </div>
        })}
        <button className="p" onClick={async () => { await api(`/cogs/${c.name}/settings/${G}`, vals); toast('Saved') }}>Save</button>
        {c.actions?.length > 0 && <><h3>Actions</h3><div className="row">
          <select value={chan} onChange={e => setChan(e.target.value)}><option value="">- channel -</option><Opt list={info.channels || []} /></select>
          {c.actions.map((a: any) => <button key={a.key} onClick={async e => {
            const b = e.currentTarget; b.disabled = true
            try { const r = await api(`/cogs/${c.name}/action/${G}`, { action: a.key, channel_id: chan }); toast(r.message) } finally { b.disabled = false }
          }}>{a.label}</button>)}</div></>}
      </>}
    </div>
  )
}

export function Settings({ G, owner }: P) {
  const [cs, refresh] = useLoad(() => api<any[]>('/cogs'), [])
  const [info] = useLoad(() => (G ? api('/guilds/' + G) : Promise.resolve({})), [G])
  if (!cs || !info) return <Skeleton />
  return <>{cs.filter(c => owner || c.settings.length > 0).map(c => <CogCard key={c.name} c={c} G={G} owner={owner} info={info} refresh={refresh} />)}</>
}

/* ---------- Commands ---------- */
export function Commands(_: P) {
  const [c] = useLoad(() => api<any[]>('/commands'), [])
  if (!c) return <Skeleton />
  if (!c.length) return <Empty>No commands.</Empty>
  return <>{c.map(x => <div className="row" key={x.name}><code className="n">/{x.name}</code><span className="dim" style={{ flex: 3 }}>{x.description}</span></div>)}</>
}