import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, fmt, toast } from './api'
import TicketChat from './TicketChat'

type TType = { label: string; emoji?: string; description?: string; welcome?: string; category?: string; ping_role?: string; staff_role?: string; questions?: string }

const DEF: Record<string, any> = {
  enabled: false, category_name: 'TICKETS', archive_category: '', channel_name: '{type}-{user}',
  claim_enabled: true, claim_label: 'CLAIM', close_label: 'CLOSE', confirm_close: false, ask_reason: false, allow_user_close: true, ticket_commands: true, delete_empty_category: false,
  staff_role: '', extra_staff_roles: '', ping_staff: true, required_role: '', blacklist_role: '',
  max_open: 1, cooldown_seconds: 0, min_account_days: 0, min_member_days: 0,
  types_json: '', ticket_types: 'Support,Purchase,Bug report',
  panel_title: 'RD TICKETS', panel_text: 'Select a ticket type below to open a ticket.', panel_image: '', panel_thumbnail: '', panel_footer: '',
  panel_style: 'dropdown', button_style: 'blurple', select_placeholder: 'Select a ticket type...', replace_panel: true, embed_color: '0f00ff', v2_panel: false, v2_ticket: false, v2_close: false,
  v2_box: true, v2_image: true, v2_thumbnail: true, v2_separator: true, v2_footer: true,
  welcome_title: '{type} TICKET', welcome_text: 'Hello {user}, please describe your {type} request. Staff will reply shortly.',
  welcome_image: '', welcome_thumbnail: '', footer_text: '',
  close_text: 'Thank you for contacting us! Open a new ticket if you need more help.', rating_text: 'How was your support?',
  close_mode: 'delete', close_delay: 5, delete_after_hours: 12, closed_prefix: 'closed-', auto_close_hours: 0,
  log_channel: '', log_opens: false, feedback_channel: '', transcript_format: 'html', dm_transcript: true,
  transcript_title: 'Ticket transcript', transcript_logo: '', transcript_links: '',
}

const TABS = [['live', 'Live'], ['general', 'General'], ['types', 'Ticket types'], ['panel', 'Panel'], ['messages', 'Messages'], ['access', 'Access'], ['closing', 'Closing & logs']] as const
type Tab = typeof TABS[number][0]

const Skeleton = () => <><div className="sk" /><div className="sk s" /><div className="sk s" /></>
const Empty = ({ children }: { children: ReactNode }) => <span className="empty">{children}</span>
const Opts = ({ list, pre = '' }: { list: any[]; pre?: string }) => <>{list.map(c => <option key={c.id} value={c.id}>{pre}{c.name}</option>)}</>
const Row = ({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) =>
  <div className="row"><span className="n">{label}{hint && <><br /><span className="dim">{hint}</span></>}</span>{children}</div>

/* Discord-style embed preview */
function Embed({ c, title, text, image, thumb, footer }: { c: string; title?: string; text?: string; image?: string; thumb?: string; footer?: string }) {
  const f = (s?: string) => String(s || '').replace(/\{user\}/g, '@Member').replace(/\{type\}/g, 'Support').replace(/\{server\}/g, 'My Server')
    .replace(/\{number\}/g, '0001').replace(/\{staff\}/g, '@Staff').replace(/\{reason\}/g, '-')
  return <div className="tk-emb" style={{ borderLeftColor: '#' + (c || '0f00ff').replace('#', '') }}>
    {thumb && <img className="th" src={thumb} alt="" />}
    {title && <b>{f(title)}</b>}<p>{f(text)}</p>
    {image && <img className="im" src={image} alt="" />}
    {footer && <small>{f(footer)}</small>}
  </div>
}

/* multi role picker -> comma separated ids */
function Roles({ value, onChange, roles }: { value: string; onChange: (v: string) => void; roles: any[] }) {
  const ids = String(value || '').split(',').map(s => s.trim()).filter(Boolean)
  const name = (id: string) => roles.find(r => r.id == id)?.name ?? id
  return <div className="tk-chips">
    {ids.map(id => <button key={id} onClick={() => onChange(ids.filter(x => x != id).join(','))}>@{name(id)} ✕</button>)}
    <select value="" onChange={e => e.target.value && onChange([...ids, e.target.value].join(','))}>
      <option value="">+ add role</option><Opts list={roles.filter(r => !ids.includes(String(r.id)))} pre="@" /></select>
  </div>
}

/* ---------- ticket types editor ---------- */
const parseTypes = (raw: string, legacy: string): TType[] => {
  try { const a = JSON.parse(raw); if (Array.isArray(a) && a.length) return a } catch {}
  return String(legacy).split(',').map(s => s.trim()).filter(Boolean).map(s => { const [label, emoji, description] = s.split('|').map(x => x.trim()); return { label, emoji, description } })
}

function Types({ list, onChange, roles }: { list: TType[]; onChange: (l: TType[]) => void; roles: any[] }) {
  const upd = (i: number, p: Partial<TType>) => onChange(list.map((t, j) => j == i ? { ...t, ...p } : t))
  const move = (i: number, d: number) => { const n = [...list]; const j = i + d; if (j < 0 || j >= n.length) return;[n[i], n[j]] = [n[j], n[i]]; onChange(n) }
  return <>
    {list.map((t, i) => (
      <div className="card tk-type" key={i}>
        <div className="row" style={{ border: 0, padding: 0 }}>
          <input style={{ width: 70 }} placeholder="😀" value={t.emoji ?? ''} onChange={e => upd(i, { emoji: e.target.value })} aria-label="Emoji" />
          <input style={{ flex: 1 }} placeholder="Name" value={t.label} onChange={e => upd(i, { label: e.target.value })} aria-label="Name" />
          <button onClick={() => move(i, -1)} disabled={i == 0} aria-label="Move up">↑</button>
          <button onClick={() => move(i, 1)} disabled={i == list.length - 1} aria-label="Move down">↓</button>
          <button className="d" onClick={() => onChange(list.filter((_, j) => j != i))}>Remove</button>
        </div>
        <details style={{ marginTop: 10 }}>
          <summary>Options for this type</summary>
          <Row label="Description" hint="Shown under the name in the dropdown"><input style={{ flex: 2 }} maxLength={100} value={t.description ?? ''} onChange={e => upd(i, { description: e.target.value })} /></Row>
          <Row label="Welcome message" hint="Blank = global message. {user} {type} {server} {number} {staff}">
            <textarea className="tk-ta" value={t.welcome ?? ''} onChange={e => upd(i, { welcome: e.target.value })} /></Row>
          <Row label="Questions" hint="One per line (max 5). Members answer them in a popup before the ticket opens.">
            <textarea className="tk-ta" value={t.questions ?? ''} onChange={e => upd(i, { questions: e.target.value })} /></Row>
          <Row label="Category" hint="Blank = default category"><input value={t.category ?? ''} onChange={e => upd(i, { category: e.target.value })} /></Row>
          <Row label="Ping role" hint="Pinged when this type opens"><select value={t.ping_role ?? ''} onChange={e => upd(i, { ping_role: e.target.value })}><option value="">- default staff -</option><Opts list={roles} pre="@" /></select></Row>
          <Row label="Extra staff role" hint="Can see and handle only this type"><select value={t.staff_role ?? ''} onChange={e => upd(i, { staff_role: e.target.value })}><option value="">- none -</option><Opts list={roles} pre="@" /></select></Row>
        </details>
      </div>
    ))}
    {!list.length && <Empty>No ticket types yet.</Empty>}
    <div className="row"><button className="p" disabled={list.length >= 25} onClick={() => onChange([...list, { label: 'New type' }])}>Add type</button>
      <span className="dim">{list.length}/25</span></div>
  </>
}

/* ---------- live view ---------- */
function Live({ G }: { G: string }) {
  const [rows, setRows] = useState<any[]>(); const [ev, setEv] = useState<any[]>()
  const [chat, setChat] = useState<any>(null)
  const load = useCallback(async () => {
    try { const r = await api(`/cogs/tickets/action/${G}`, { action: 'list_open', channel_id: '' }); setRows(JSON.parse(r.message)) } catch { setRows(x => x ?? []) }
    api<any[]>(`/events?limit=40&guild_id=${G}&type=ticket`).then(setEv).catch(() => {})
  }, [G])
  useEffect(() => {
    load()
    let t = window.setInterval(load, 15000)
    const vis = () => { clearInterval(t); if (!document.hidden) { load(); t = window.setInterval(load, 15000) } }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [load])
  const act = async (action: string, id: string, ask: string) => {
    if (!confirm(ask)) return
    try { const r = await api(`/cogs/tickets/action/${G}`, { action, channel_id: id }); toast(r.message) } finally { load() }
  }
  if (!rows) return <Skeleton />
  const open = rows.filter(r => !r.closed), closed = rows.filter(r => r.closed)
  const cards = [['Open', open.length], ['Claimed', open.filter(r => r.claim).length], ['Unclaimed', open.filter(r => !r.claim).length], ['Archived', closed.length]]
  return <>
    <div className="grid">{cards.map(([a, b]) => <div className="card" key={a}><small>{a}</small><b>{String(b)}</b></div>)}</div>
    <h3>Tickets</h3>
    {rows.map(r => <div className="row" key={r.id}>
      <span className="n"><b>#{r.name}</b> <span className={r.closed ? 'off' : 'on'}>{r.closed ? 'closed' : 'open'}</span><br />
        <span className="dim">{r.kind} · {r.owner_name || r.owner}{r.claim ? ` · claimed by ${r.claim_name || r.claim}` : ''} · {fmt(r.created)}</span></span>
      <button className="p" onClick={() => setChat(r)}>View chat</button>
      {!r.closed && <button onClick={() => act('close_ticket', r.id, `Close #${r.name}?`)}>Close</button>}
      <button className="d" onClick={() => act('delete_ticket', r.id, `Delete #${r.name} permanently?`)}>Delete</button>
    </div>)}
    {!rows.length && <Empty>No tickets right now.</Empty>}
    <h3>History</h3>
    {ev?.map((e, i) => <div className="row" key={i}><span className="dim mono">{fmt(e.ts)}</span><b>{e.title}</b><span className="n">{e.body}</span></div>)}
    {ev && !ev.length && <Empty>Nothing yet.</Empty>}
    {chat && <TicketChat G={G} ticket={chat} onClose={() => setChat(null)} />}
  </>
}

/* ---------- main ---------- */
export default function TicketsTab({ G }: { G: string; owner?: boolean }) {
  const [tab, setTab] = useState<Tab>('live')
  const [loaded, setLoaded] = useState<boolean | null>(null)
  const [info, setInfo] = useState<any>()
  const [vals, setVals] = useState<any>()
  const [dirty, setDirty] = useState(false)
  const [pch, setPch] = useState('')

  useEffect(() => {
    if (!G) return
    let off = false
    api<any[]>('/cogs').then(cs => {
      if (off) return
      const c = cs.find(x => x.name == 'tickets'); setLoaded(!!c?.loaded)
      if (c?.loaded) api(`/cogs/tickets/settings/${G}`).then(v => !off && setVals(v)).catch(() => {})
    }).catch(() => {})
    api('/guilds/' + G).then(i => !off && setInfo(i)).catch(() => {})
    return () => { off = true }
  }, [G])

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault() }
    addEventListener('beforeunload', h); return () => removeEventListener('beforeunload', h)
  }, [dirty])

  if (!G) return <Empty>No server selected.</Empty>
  if (loaded === false) return <Empty>The tickets cog is not loaded. Load it under Settings first.</Empty>
  if (loaded === null || !vals || !info) return <Skeleton />

  const channels: any[] = info.channels || [], roles: any[] = info.roles || []
  const v = (k: string) => vals[k] ?? DEF[k] ?? ''
  const set = (k: string, x: any) => { setVals((o: any) => ({ ...o, [k]: x })); setDirty(true) }
  const save = async () => { await api(`/cogs/tickets/settings/${G}`, vals); setDirty(false); toast('Saved') }

  const T = (k: string, label: string, hint?: string, ph?: string) =>
    <Row label={label} hint={hint}><input style={{ flex: 2 }} value={v(k)} placeholder={ph} onChange={e => set(k, e.target.value)} /></Row>
  const A = (k: string, label: string, hint?: string) =>
    <Row label={label} hint={hint}><textarea className="tk-ta" value={v(k)} onChange={e => set(k, e.target.value)} /></Row>
  const N = (k: string, label: string, hint?: string) =>
    <Row label={label} hint={hint}><input type="number" min={0} style={{ width: 120 }} value={v(k)} onChange={e => set(k, Number(e.target.value))} /></Row>
  const B = (k: string, label: string, hint?: string) =>
    <Row label={label} hint={hint}><input type="checkbox" checked={!!v(k)} onChange={e => set(k, e.target.checked)} /></Row>
  const S = (k: string, label: string, opts: string[][], hint?: string) =>
    <Row label={label} hint={hint}><select value={v(k)} onChange={e => set(k, e.target.value)}>{opts.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select></Row>
  const C = (k: string, label: string, hint?: string) =>
    <Row label={label} hint={hint}><select value={v(k)} onChange={e => set(k, e.target.value)}><option value="">- none -</option><Opts list={channels} pre="#" /></select></Row>
  const R = (k: string, label: string, hint?: string) =>
    <Row label={label} hint={hint}><select value={v(k)} onChange={e => set(k, e.target.value)}><option value="">- none -</option><Opts list={roles} pre="@" /></select></Row>
  const Col = (k: string, label: string) => {
    const hex = String(v(k)).replace('#', '')
    return <Row label={label}>
      <input type="color" className="tk-col" value={'#' + (/^[0-9a-f]{6}$/i.test(hex) ? hex : '0f00ff')} onChange={e => set(k, e.target.value.slice(1))} />
      <input style={{ width: 120 }} value={hex} onChange={e => set(k, e.target.value.replace('#', ''))} /></Row>
  }

  const list = parseTypes(v('types_json'), v('ticket_types'))
  const post = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const b = e.currentTarget; b.disabled = true
    try {
      if (dirty) await save()
      const r = await api(`/cogs/tickets/action/${G}`, { action: 'post_panel', channel_id: pch }); toast(r.message)
    } finally { b.disabled = false }
  }

  return <>
    <div className="tk-tabs">
      {TABS.map(([k, l]) => <button key={k} className={tab == k ? 'p' : ''} onClick={() => setTab(k)}>{l}</button>)}
      <span className="sp" />
      <label className="dim" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Tickets enabled
        <input type="checkbox" checked={!!v('enabled')} onChange={e => set('enabled', e.target.checked)} /></label>
      <button className="p" disabled={!dirty} onClick={save}>{dirty ? 'Save changes' : 'Saved'}</button>
    </div>

    {tab == 'live' && <Live G={G} />}

    {tab == 'general' && <>
      <h3>Channels</h3>
      {T('category_name', 'Ticket category', 'Created automatically. Blank = no category.')}
      {T('channel_name', 'Channel name pattern', '{type} {user} {number} {id}')}
      {B('delete_empty_category', 'Delete the ticket category when it has 0 tickets', 'Only categories used by tickets, and only once they have no channels left. It is recreated when the next ticket opens.')}
      <h3>Buttons inside tickets</h3>
      {B('claim_enabled', 'Show the claim button', 'Staff can claim a ticket; press again to release it.')}
      {T('claim_label', 'Claim button text')}
      {T('close_label', 'Close button text')}
      {B('confirm_close', 'Ask for confirmation before closing')}
      {B('ask_reason', 'Ask for a close reason', 'Shows a popup; the reason goes into the log and transcript embed.')}
      {B('allow_user_close', 'Ticket owner can close their own ticket')}
      <h3>Commands</h3>
      {B('ticket_commands', 'Enable the /ticket commands', 'add, remove, rename and close. When off they reply that commands are disabled; the Close button still works.')}
    </>}

    {tab == 'types' && <>
      <h3>Ticket types</h3>
      <p className="dim">Each type shows up in the panel. Give it a description, its own welcome message, popup questions, category or staff role.</p>
      <Types list={list} roles={roles} onChange={l => set('types_json', JSON.stringify(l))} />
    </>}

    {tab == 'panel' && <>
      <div className="cols">
        <div>
          <h3>Panel</h3>
          {T('panel_title', 'Title')}
          {A('panel_text', 'Text')}
          {T('panel_image', 'Image URL')}
          {T('panel_thumbnail', 'Thumbnail URL')}
          {T('panel_footer', 'Footer')}
          {Col('embed_color', 'Embed colour (classic embeds only, not used by Components V2)')}
          {S('panel_style', 'Style', [['dropdown', 'Dropdown'], ['buttons', 'Buttons']])}
          {v('panel_style') == 'buttons'
            ? S('button_style', 'Button colour', [['blurple', 'Blurple'], ['green', 'Green'], ['red', 'Red'], ['grey', 'Grey']])
            : T('select_placeholder', 'Dropdown placeholder')}
          {B('replace_panel', 'Delete the old panel when posting a new one')}
          {B('v2_panel', 'Use Components V2 for the panel', 'Container layout with the dropdown or buttons inside it. Falls back to an embed if Discord rejects it.')}
          {!!(v('v2_panel') || v('v2_ticket') || v('v2_close')) && <>
            <h3>Components V2 layout</h3>
            <p className="dim">No colour bar. Pick which parts to show (applies to every V2 message).</p>
            {B('v2_box', 'Container box')}
            {B('v2_image', 'Image')}
            {B('v2_thumbnail', 'Thumbnail')}
            {B('v2_separator', 'Divider line before the buttons')}
            {B('v2_footer', 'Footer')}
          </>}
        </div>
        <div><h3>Preview</h3>
          <Embed c={v('embed_color')} title={v('panel_title')} text={v('panel_text')} image={v('panel_image')} thumb={v('panel_thumbnail')} footer={v('panel_footer')} />
          {!!v('v2_panel') && <p className="dim" style={{ marginTop: 10 }}>Components V2: the {v('panel_style') == 'buttons' ? 'buttons' : 'dropdown'} sit inside the box instead of under it.</p>}
          <p className="dim" style={{ marginTop: 10 }}>{list.length} type{list.length == 1 ? '' : 's'}: {list.map(t => `${t.emoji || ''} ${t.label}`.trim()).join(', ') || 'none'}</p>
        </div>
      </div>
      <h3>Post panel</h3>
      <div className="row">
        <select value={pch} onChange={e => setPch(e.target.value)}><option value="">- channel -</option><Opts list={channels} pre="#" /></select>
        <button className="p" onClick={post}>{dirty ? 'Save & post panel' : 'Post panel'}</button>
      </div>
    </>}

    {tab == 'messages' && <div className="cols">
      <div>
        <h3>Welcome message</h3>
        <p className="dim">Placeholders: {'{user} {type} {server} {number} {staff}'}</p>
        {T('welcome_title', 'Title')}
        {A('welcome_text', 'Text')}
        {T('welcome_image', 'Image URL')}
        {T('welcome_thumbnail', 'Thumbnail URL')}
        {T('footer_text', 'Footer')}
        {B('v2_ticket', 'Use Components V2 in new tickets', 'Claim / Close buttons inside the box. Pings are sent as a line above it.')}
        <h3>Closing</h3>
        {A('close_text', 'Message when a ticket closes', '{user} {type} {reason}')}
        {A('rating_text', 'DM text asking for a rating')}
        {B('v2_close', 'Use Components V2 for the closed message', 'Reopen / Delete buttons (archive mode) sit inside the box.')}
      </div>
      <div><h3>Preview</h3>
        <Embed c={v('embed_color')} title={v('welcome_title')} text={v('welcome_text')} image={v('welcome_image')} thumb={v('welcome_thumbnail')} footer={v('footer_text')} />
        <div style={{ height: 14 }} />
        <Embed c="ff0000" title="TICKET CLOSED" text={v('close_text')} />
      </div>
    </div>}

    {tab == 'access' && <>
      <h3>Staff</h3>
      {R('staff_role', 'Staff role', 'Can see, claim and close every ticket.')}
      <Row label="Extra staff roles" hint="Same access as the staff role"><Roles value={v('extra_staff_roles')} roles={roles} onChange={x => set('extra_staff_roles', x)} /></Row>
      {B('ping_staff', 'Ping staff when a ticket opens')}
      <h3>Who can open tickets</h3>
      {R('required_role', 'Required role', 'Only members with this role can open tickets.')}
      {R('blacklist_role', 'Blocked role', 'Members with this role can never open tickets.')}
      {N('max_open', 'Max open tickets per member')}
      {N('cooldown_seconds', 'Cooldown (seconds)', 'Wait time between two tickets. 0 = off.')}
      {N('min_account_days', 'Minimum account age (days)')}
      {N('min_member_days', 'Minimum days in the server')}
    </>}

    {tab == 'closing' && <>
      <h3>When a ticket is closed</h3>
      {S('close_mode', 'Mode', [['delete', 'Delete the channel'], ['archive', 'Archive (lock, keep for a while)']])}
      {v('close_mode') == 'archive' ? <>
        {N('delete_after_hours', 'Delete archived tickets after (hours)', '0 = keep forever. Staff get Reopen / Delete buttons.')}
        {T('closed_prefix', 'Archived name prefix')}
        {T('archive_category', 'Archive category', 'Blank = stay in the same category')}
      </> : N('close_delay', 'Delete after (seconds)')}
      {N('auto_close_hours', 'Auto-close after inactivity (hours)', '0 = off')}
      <h3>Transcripts & logs</h3>
      {C('log_channel', 'Log channel', 'Closed tickets + transcript are posted here.')}
      {B('log_opens', 'Also log when a ticket opens')}
      {S('transcript_format', 'Transcript format', [['html', 'HTML (pretty)'], ['txt', 'Plain text'], ['off', 'None']])}
      {B('dm_transcript', 'DM the transcript to the ticket owner')}
      {C('feedback_channel', 'Feedback channel', 'Members are DM\'d a star rating on close. Blank = off.')}
      {v('transcript_format') == 'html' && <>
        {T('transcript_title', 'Transcript title')}
        {T('transcript_logo', 'Transcript logo URL')}
        {A('transcript_links', 'Transcript buttons', 'One per line: Label|https://link')}
      </>}
    </>}
  </>
}