import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { api } from './api'
import './ticketchat.css'

type Emb = { title?: string; description?: string; color?: number; fields: { name: string; value: string; inline: boolean }[]; footer?: string; image?: string; thumbnail?: string; author?: string }
type Att = { name: string; url: string; type: string; size: number }
type Msg = {
  id: string; ts: number; edited: number | null; system: boolean; content: string; embeds: Emb[]; attachments: Att[]
  author: { id: string; name: string; avatar: string; bot: boolean; me: boolean; color: string | null }
}
type Ticket = { id: string; name: string; kind?: string; owner_name?: string; owner?: string; closed?: boolean }

const time = (t: number) => new Date(t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const day = (t: number) => new Date(t * 1000).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })
const merge = (old: Msg[], add: Msg[]) => { const seen = new Set(old.map(m => m.id)); return [...old, ...add.filter(m => !seen.has(m.id))] }

/* tiny Discord-style markdown: **bold** *italic* __underline__ ~~strike~~ `code` ```block``` and links */
const MD = /(```[\s\S]*?```|`[^`\n]+`|\*\*[\s\S]+?\*\*|__[\s\S]+?__|~~[\s\S]+?~~|\*[^*\n]+\*|https?:\/\/[^\s<>]+)/g
function Md({ text }: { text: string }) {
  return <>{text.split(MD).map((p, i) => {
    if (i % 2 == 0) return p
    if (p.startsWith('```')) return <pre key={i} className="tc-pre">{p.slice(3, -3).replace(/^\w*\n/, '')}</pre>
    if (p.startsWith('`')) return <code key={i} className="tc-code">{p.slice(1, -1)}</code>
    if (p.startsWith('**')) return <strong key={i}><Md text={p.slice(2, -2)} /></strong>
    if (p.startsWith('__')) return <u key={i}><Md text={p.slice(2, -2)} /></u>
    if (p.startsWith('~~')) return <s key={i}><Md text={p.slice(2, -2)} /></s>
    if (p.startsWith('*')) return <em key={i}><Md text={p.slice(1, -1)} /></em>
    return <a key={i} href={p} target="_blank" rel="noopener noreferrer">{p}</a>
  })}</>
}

function Embed({ e }: { e: Emb }) {
  const c = e.color ? '#' + e.color.toString(16).padStart(6, '0') : 'var(--line2)'
  return (
    <div className={"tc-emb" + (e.thumbnail ? " th" : "")} style={{ borderLeftColor: c }}>
      {e.thumbnail && <img className="tc-emb-th" src={e.thumbnail} alt="" />}
      {e.author && <small>{e.author}</small>}
      {e.title && <b><Md text={e.title} /></b>}
      {e.description && <p><Md text={e.description} /></p>}
      {e.fields.length > 0 && <div className="tc-fields">{e.fields.map((f, i) =>
        <div key={i} style={f.inline ? undefined : { gridColumn: '1/-1' }}><strong>{f.name}</strong><span><Md text={f.value} /></span></div>)}</div>}
      {e.image && <img className="tc-emb-im" src={e.image} alt="" />}
      {e.footer && <small>{e.footer}</small>}
    </div>
  )
}

export default function TicketChat({ G, ticket, onClose }: { G: string; ticket: Ticket; onClose: () => void }) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null)
  const [meta, setMeta] = useState<any>(null)
  const [err, setErr] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [away, setAway] = useState(0)
  const [sign, setSign] = useState(() => { try { return localStorage.getItem('yukio.tk.sign') == '1' } catch { return false } })
  const box = useRef<HTMLDivElement>(null)
  const ta = useRef<HTMLTextAreaElement>(null)
  const stick = useRef(true)
  const last = useRef('')
  const prev = useRef(0)
  const base = `/api/guilds/${G}/tickets/${ticket.id}`

  // quiet fetch (no toast spam while polling)
  const poll = useCallback(async (full: boolean) => {
    const q = !full && last.current ? `?after=${last.current}` : ''
    try {
      const r = await fetch(`${base}/messages${q}`, { cache: 'no-store' })
      if (r.status == 401) { location.href = '/login'; return }
      const j = await r.json()
      if (!r.ok) { setErr(j.detail || 'Error'); return }
      setErr(''); setMeta(j)
      if (q) { if (j.messages.length) setMsgs(o => merge(o ?? [], j.messages)) } else setMsgs(j.messages)
    } catch { setErr('Connection lost, retrying...') }
  }, [base])

  useEffect(() => { last.current = msgs?.[msgs.length - 1]?.id ?? '' }, [msgs])

  useEffect(() => {
    let n = 0
    poll(true)
    const t = window.setInterval(() => { if (!document.hidden) poll(++n % 8 == 0) }, 2500) // every 8th poll is a full refresh (edits/deletes)
    const vis = () => { if (!document.hidden) poll(true) }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [poll])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key == 'Escape') onClose() }
    addEventListener('keydown', h); ta.current?.focus({ preventScroll: true })
    return () => removeEventListener('keydown', h)
  }, [onClose])

  useLayoutEffect(() => {
    const el = box.current, n = msgs?.length ?? 0
    if (!el) return
    if (stick.current) { el.scrollTop = el.scrollHeight; setAway(0) }
    else if (n > prev.current && prev.current) setAway(a => a + n - prev.current)
    prev.current = n
  }, [msgs])

  const onScroll = () => {
    const el = box.current!; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    if (stick.current) setAway(0)
  }
  const down = () => { const el = box.current!; el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }) }

  const send = async () => {
    const content = text.trim(); if (!content || sending) return
    setSending(true)
    try {
      const r = await api(`/guilds/${G}/tickets/${ticket.id}/send`, { content, sign })
      setText(''); stick.current = true
      setMsgs(o => merge(o ?? [], [r.message]))
    } catch {} finally { setSending(false); ta.current?.focus({ preventScroll: true }) }
  }
  const toggleSign = (v: boolean) => { setSign(v); try { localStorage.setItem('yukio.tk.sign', v ? '1' : '0') } catch {} }

  const closed = meta?.closed ?? ticket.closed
  const live = !err && msgs
  return (
    <div className="tc-modal" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="tc" role="dialog" aria-label={`Ticket #${ticket.name}`}>
        <div className="tc-top">
          <span className="tc-hash" aria-hidden="true">#</span>
          <div className="tc-title">
            <b>{meta?.name ?? ticket.name}</b>
            <span className="tc-chips">
              {(meta?.kind ?? ticket.kind) && <i>{meta?.kind ?? ticket.kind}</i>}
              {ticket.owner_name && <i>{ticket.owner_name}</i>}
              {closed && <i className="off">closed</i>}
            </span>
          </div>
          <span className={'tc-live' + (live ? '' : ' bad')}>{live ? 'Live' : err ? 'Offline' : 'Loading'}</span>
          <button className="tc-x" onClick={onClose} aria-label="Close chat" />
        </div>

        <div className="tc-body" ref={box} onScroll={onScroll}>
          {!msgs && !err && <p className="tc-note">Loading messages...</p>}
          {err && !msgs && <p className="tc-note bad">{err}</p>}
          {msgs?.length == 0 && <p className="tc-note">No messages yet.</p>}
          {msgs?.map((m, i) => {
            const p = msgs[i - 1]
            const newDay = !p || new Date(p.ts * 1000).toDateString() != new Date(m.ts * 1000).toDateString()
            const grouped = !newDay && !!p && !p.system && !m.system && p.author.id == m.author.id && m.ts - p.ts < 300
            return (
              <div key={m.id}>
                {newDay && <div className="tc-day"><span>{day(m.ts)}</span></div>}
                {m.system
                  ? <div className="tc-sys">{m.content || 'System message'} <small>{time(m.ts)}</small></div>
                  : <div className={'tc-msg' + (grouped ? ' grp' : '') + (m.author.me ? ' me' : '')}>
                      {grouped
                        ? <span className="tc-gt">{time(m.ts)}</span>
                        : <img className="tc-av" src={m.author.avatar} alt="" loading="lazy" />}
                      <div className="tc-mb">
                        {!grouped && <div className="tc-h">
                          <b style={m.author.color ? { color: m.author.color } : undefined}>{m.author.name}</b>
                          {m.author.bot && <em>BOT</em>}<small>{time(m.ts)}</small>
                        </div>}
                        {m.content && <p><Md text={m.content} />{m.edited && <small className="tc-ed"> (edited)</small>}</p>}
                        {m.embeds.map((e, j) => <Embed key={j} e={e} />)}
                        {m.attachments.map((a, j) => /^image\//.test(a.type)
                          ? <a key={j} href={a.url} target="_blank" rel="noopener noreferrer"><img className="tc-img" src={a.url} alt={a.name} loading="lazy" /></a>
                          : <a key={j} className="tc-file" href={a.url} target="_blank" rel="noopener noreferrer">{a.name} <small>{Math.max(1, Math.round(a.size / 1024))} KB</small></a>)}
                      </div>
                    </div>}
              </div>
            )
          })}
        </div>
        {away > 0 && <button className="tc-away" onClick={down}>{away} new message{away == 1 ? '' : 's'}</button>}
        {err && msgs && <div className="tc-err">{err}</div>}

        <div className="tc-foot">
          <textarea ref={ta} value={text} maxLength={2000} rows={1} placeholder={`Reply in #${meta?.name ?? ticket.name} as the bot...`}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key == 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send() } }} />
          <button className="p" disabled={!text.trim() || sending} onClick={send}>{sending ? 'Sending...' : 'Send'}</button>
          <div className="tc-opts">
            <label><input type="checkbox" checked={sign} onChange={e => toggleSign(e.target.checked)} /> Sign with my name</label>
            <span>Enter to send · Shift+Enter for a new line · {text.length}/2000</span>
          </div>
        </div>
      </div>
    </div>
  )
}