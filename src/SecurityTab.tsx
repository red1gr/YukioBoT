// Security page for the Yukio dashboard.
// Four tabs: Setup (checklist, level, essentials) / Protections / Backups / Tools (quick actions, import/export, advanced).
// Backend: the same endpoints the Settings page uses:
//   GET  /api/cogs                          (setting definitions of the security cog)
//   GET  /api/cogs/security/settings/:guild (current values, {key: value})
//   POST /api/cogs/security/settings/:guild (body = {key: value, ...}, only the changed keys)
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, toast } from './api'
import BackupPanel from './BackupPanel'
import './security.css'

type Def = { key: string; label: string; type: string; default: any }
type Ctx = { v: Record<string, any>; defs: Record<string, Def>; chans: { id: string; name: string }[]; save: (p: Record<string, any>) => Promise<void> }

const PUNISH = ['ban', 'kick', 'strip', 'mute', 'none']
const ACTION_KEYS = ['ban', 'kick', 'prune', 'channel_create', 'channel_delete', 'role_create', 'role_delete', 'bot_add', 'danger_perm', 'danger_role']
const GUARDS: Record<string, string> = {
  mention: '@everyone / @here', webhook: 'New webhooks', vanity: 'Vanity URL change', server_rename: 'Server rename',
  server_icon: 'Server icon change', role_rename: 'Role rename', channel_rename: 'Channel rename',
  emoji_delete: 'Emoji delete', emoji_rename: 'Emoji rename', invite_delete: 'Invite delete',
}
const PRESETS = [
  { id: 'low', title: 'Low', color: '#34d8a6', text: 'Relaxed. Removes roles instead of banning. Only blocks @everyone.', rec: false },
  { id: 'normal', title: 'Normal', color: '#38b6ff', text: 'Anti-nuke, raid and spam protection, key guards and a daily backup.', rec: true },
  { id: 'high', title: 'High', color: '#ff627a', text: 'Strict. Everything on, bans offenders, raid lock, backup every 6 hours.', rec: false },
]
const TABS = [['setup', 'Setup'], ['protect', 'Protections'], ['backup', 'Backups'], ['tools', 'Tools']] as const
type Tab = typeof TABS[number][0]

const QUICK = [
  { key: 'act_lockall', title: 'Lock all channels', text: 'Stops everyone from sending messages in every text channel. Use it during an attack.', danger: true, ask: 'Lock ALL text channels' },
  { key: 'act_unlockall', title: 'Unlock all channels', text: 'Lets members send messages again in every channel.', ask: 'Unlock all channels' },
  { key: 'act_raid_end', title: 'End raid mode', text: 'Ends raid mode early and unlocks the server.', ask: 'End raid mode and unlock the server' },
  { key: 'act_beast_calm', title: 'Calm Beast Mode', text: 'Puts Beast Mode back to sleep right away.', ask: 'Calm Beast Mode' },
]

const truthy = (x: any) => x === true || ['1', 'true', 'yes', 'on'].includes(String(x).toLowerCase())
const parseLabel = (l: string) => {
  const m = /^\[(\d+)\s+([^\]]+)\]\s*(.*)$/.exec(l)
  return m ? { n: +m[1], name: m[3] } : { n: 99, name: l }
}
const isButton = (k: string) => k.startsWith('act_') || k.startsWith('preset_') || k === 'mod_run'
const READ_ONLY = ['preset_current', 'backup_view']
// settings that only make sense on the server they were exported from (IDs)
const SERVER_BOUND = (d: Def) => d.type === 'channel' || d.key.startsWith('wl_') || ['unverified_role', 'verified_role', 'mod_target', 'backup_id'].includes(d.key)

/* ---------- small inputs (module scope so they keep focus) ---------- */
function Field({ s, C }: { s: Def; C: Ctx }) {
  const val = C.v[s.key] ?? s.default
  const [loc, setLoc] = useState(String(val ?? ''))
  useEffect(() => setLoc(String(val ?? '')), [val])
  const save = (x: any) => C.save({ [s.key]: x })
  if (s.type === 'bool') return <input type="checkbox" checked={truthy(val)} onChange={e => save(e.target.checked)} />
  if (s.key.endsWith('_punish'))
    return <select value={String(val)} onChange={e => save(e.target.value)}>{PUNISH.map(p => <option key={p}>{p}</option>)}</select>
  if (s.type === 'channel')
    return <select value={String(val ?? '')} onChange={e => save(e.target.value)}>
      <option value="">- none -</option>{C.chans.map(c => <option key={c.id} value={c.id}>#{c.name}</option>)}</select>
  if (s.type === 'number')
    return <input type="number" value={loc} onChange={e => setLoc(e.target.value)} onBlur={() => Number(loc) !== Number(val) && save(Number(loc))} />
  return <input value={loc} onChange={e => setLoc(e.target.value)} onBlur={() => loc !== String(val ?? '') && save(loc)} />
}

const Row = ({ s, C, label, hint }: { s: Def; C: Ctx; label?: string; hint?: string }) =>
  <div className="row sc-row">
    <span className="n">{label ?? parseLabel(s.label).name}{hint && <small className="dim">{hint}</small>}</span>
    <Field s={s} C={C} />
  </div>

const Pill = ({ kind, children }: { kind: 'ok' | 'todo' | 'opt' | 'off'; children: ReactNode }) => <span className={'sc-pill ' + kind}>{children}</span>

function Card({ title, desc, on, onToggle, children, more, C }: {
  title: string; desc: string; on?: boolean; onToggle?: (b: boolean) => void
  children?: ReactNode; more?: Def[]; C: Ctx
}) {
  return (
    <div className="card sc-card">
      <div className="sc-head">
        <div>
          <h4>{title}{onToggle && <Pill kind={on ? 'ok' : 'off'}>{on ? 'On' : 'Off'}</Pill>}</h4>
          <p className="dim">{desc}</p>
        </div>
        {onToggle && <input type="checkbox" aria-label={title} checked={!!on} onChange={e => onToggle(e.target.checked)} />}
      </div>
      {children}
      {!!more?.length && <details><summary>Advanced options ({more.length})</summary>
        {more.map(s => <Row key={s.key} s={s} C={C} />)}</details>}
    </div>
  )
}

/* ---------- main ---------- */
export default function SecurityTab({ guildId }: { guildId: string }) {
  const [v, setV] = useState<Record<string, any>>()
  const [defList, setDefList] = useState<Def[]>()
  const [chans, setChans] = useState<{ id: string; name: string }[]>([])
  const [missing, setMissing] = useState(false)
  const [applying, setApplying] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>(() => {
    let t = ''; try { t = localStorage.getItem('yukio.sec.tab') ?? '' } catch { /* ignore */ }
    return (TABS.some(x => x[0] === t) ? t : 'setup') as Tab
  })
  const poll = useRef<number>()
  const file = useRef<HTMLInputElement>(null)

  const reload = useCallback(() => {
    api<any>(`/cogs/security/settings/${guildId}`).then(setV).catch(() => {})
  }, [guildId])

  useEffect(() => () => window.clearInterval(poll.current), [])
  useEffect(() => {
    api<any[]>('/cogs').then(cs => {
      const c = cs.find(x => x.name === 'security')
      if (!c || !c.loaded) setMissing(true)
      else setDefList(c.settings)
    }).catch(() => {})
    api<any>('/guilds/' + guildId).then(g => setChans((g.channels ?? []).map((x: any) => ({ id: String(x.id), name: x.name })))).catch(() => {})
    reload()
  }, [guildId, reload])

  const go = (t: Tab) => { setTab(t); try { localStorage.setItem('yukio.sec.tab', t) } catch { /* ignore */ } window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const defs = useMemo(() => Object.fromEntries((defList ?? []).map(s => [s.key, s])), [defList])

  const save = useCallback(async (patch: Record<string, any>) => {
    setV(x => ({ ...x, ...patch }))
    try { await api(`/cogs/security/settings/${guildId}`, patch); toast('Saved') } catch { reload() }
  }, [guildId, reload])

  if (missing) return <span className="empty">The Security cog is not loaded. Load it from Settings first.</span>
  if (!v || !defList) return <><div className="sk" /><div className="sk s" /><div className="sk s" /></>

  const C: Ctx = { v, defs, chans, save }
  const val = (k: string) => v[k] ?? defs[k]?.default
  const on = (k: string) => truthy(val(k))
  const def = (k: string, type = 'text', label = k): Def => defs[k] ?? { key: k, label, type, default: '' }
  const setAll = (keys: string[], suffix: string, value: any) => save(Object.fromEntries(keys.map(k => [k + suffix, value])))

  // settings of a section that are not already shown as a main control
  const rest = (n: number, shown: (k: string) => boolean = () => false) =>
    defList.filter(s => parseLabel(s.label).n === n && !isButton(s.key) && !shown(s.key) && s.key !== 'backup_view' && s.key !== 'preset_current')

  // one-shot actions: the bot sees the switch go ON, runs it and switches it back (checks every ~10 s)
  const run = async (key: string, what: string) => {
    if (!confirm(`${what}?`)) return
    await save({ [key]: true })
    toast('Sent. The bot runs it within about 10 seconds')
    window.setTimeout(reload, 12000)
  }

  // Apply a preset: poll and refresh every setting on the page until the bot has finished
  const applyPreset = (p: typeof PRESETS[number]) => {
    if (!confirm(`Apply the ${p.title.toUpperCase()} preset? It overwrites limits, punishments and guard switches. Your trusted list and log channel are kept.`)) return
    window.clearInterval(poll.current)
    setApplying(p.id)
    save({ [`preset_${p.id}`]: true })
    let tries = 0
    poll.current = window.setInterval(async () => {
      tries++
      try {
        const nv = await api<any>(`/cogs/security/settings/${guildId}`)
        if (String(nv.preset_current).toLowerCase() === p.id && !truthy(nv[`preset_${p.id}`])) {
          window.clearInterval(poll.current); setV(nv); setApplying(null)
          toast(`${p.title} preset applied. All settings were updated`)
          return
        }
      } catch { /* keep trying */ }
      if (tries >= 20) {
        window.clearInterval(poll.current); setApplying(null); reload()
        toast('The bot has not answered yet. Check that it is online, then refresh')
      }
    }, 2000)
  }

  const exportSettings = () => {
    const settings: Record<string, any> = {}
    for (const s of defList) if (!isButton(s.key) && !READ_ONLY.includes(s.key)) settings[s.key] = v[s.key] ?? s.default
    const data = { app: 'yukio-security', version: 1, guild: guildId, preset: val('preset_current') ?? 'none', exported: new Date().toISOString(), settings }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    a.download = `yukio-security-${guildId}.json`
    a.click(); URL.revokeObjectURL(a.href)
    toast('Settings exported')
  }

  const importSettings = async (f?: File) => {
    if (!f) return
    try {
      const data = JSON.parse(await f.text())
      if (data?.app !== 'yukio-security' || typeof data.settings !== 'object') throw 0
      const same = String(data.guild) === guildId
      const patch: Record<string, any> = {}
      let skipped = 0
      for (const [k, raw] of Object.entries<any>(data.settings)) {
        const d = defs[k]
        if (!d || isButton(k) || READ_ONLY.includes(k) || (!same && SERVER_BOUND(d))) { skipped++; continue }
        patch[k] = d.type === 'bool' ? truthy(raw) : d.type === 'number' ? Number(raw) : String(raw ?? '')
      }
      const n = Object.keys(patch).length
      if (!n) return toast('Nothing to import')
      if (!confirm(`Import ${n} settings${same ? '' : ' from another server'}?${skipped ? ` (${skipped} skipped${same ? '' : ': channels, role IDs and trusted lists are server specific'})` : ''} Current values will be overwritten.`)) return
      await save(patch)
      toast(`Imported ${n} settings`)
    } catch { toast('Import failed: not a valid Yukio security file') }
    finally { if (file.current) file.current.value = '' }
  }

  const preset = String(val('preset_current') ?? 'none')
  const active = PRESETS.find(p => p.id === preset.toLowerCase())
  const nukeOn = ACTION_KEYS.some(k => on(k + '_on'))
  const isNukeKey = (k: string) => ACTION_KEYS.some(a => k === a + '_on' || k === a + '_punish')
  const isGuardKey = (k: string) => Object.keys(GUARDS).some(g => k === g + '_on')

  // setup checklist
  const hasBackup = String(val('backup_view') ?? 'No backups yet') !== 'No backups yet' || Number(val('backup_auto_hours')) > 0
  const steps: { ok: boolean; opt?: boolean; title: string; text: string; tab: Tab }[] = [
    { ok: on('enabled'), title: 'Turn protection on', text: 'Use the master switch at the top of this page.', tab: 'setup' },
    { ok: !!active, title: 'Choose a protection level', text: 'Pick Low, Normal or High in step 1. Normal is a good start.', tab: 'setup' },
    { ok: !!String(val('log_channel') ?? '').trim(), title: 'Pick a log channel', text: 'This is where the bot reports what it blocked. Set it in step 2.', tab: 'setup' },
    { ok: hasBackup, title: 'Create a backup', text: 'A backup lets you rebuild roles and channels if something is deleted.', tab: 'backup' },
    { ok: !!(String(val('wl_users') ?? '').trim() || String(val('wl_roles') ?? '').trim()), opt: true, title: 'Add trusted people (optional)', text: 'Trusted users and roles are never punished. The owner is always trusted.', tab: 'setup' },
  ]
  const req = steps.filter(s => !s.opt)
  const done = req.filter(s => s.ok).length

  return (
    <div className="sec">
      {/* always visible: master switch + current mode */}
      <div className={'card sc-status' + (on('enabled') ? ' live' : '')}>
        <div>
          <h4>{on('enabled') ? 'Protection is ON' : 'Protection is OFF'}</h4>
          <p className="dim">Master switch. When it is off, none of the protections below do anything.</p>
          <p className="sc-mode" style={{ ['--c' as any]: active?.color ?? 'var(--dim)' }}>
            Mode: <span>{applying ? 'applying' : active ? active.title : 'Custom or none'}</span>
          </p>
        </div>
        <input type="checkbox" aria-label="Protection master switch" checked={on('enabled')} onChange={e => save({ enabled: e.target.checked })} />
      </div>

      <nav className="sc-tabs" aria-label="Security sections">
        {TABS.map(([k, name]) => <button key={k} className={tab === k ? 'act' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => go(k)}>{name}</button>)}
      </nav>

      {/* ================= SETUP ================= */}
      {tab === 'setup' && <>
        <h3>Setup progress</h3>
        <div className="card sc-card">
          <div className="sc-head">
            <div><h4>{done === req.length ? 'Your server is protected' : `${done} of ${req.length} steps done`}</h4>
              <p className="dim">{done === req.length ? 'All the basics are set. Review the Protections tab to fine tune.' : 'Complete these steps and you are done. Most servers need nothing else.'}</p></div>
          </div>
          <div className="sc-prog" style={{ ['--w' as any]: `${(done / req.length) * 100}%` }}><i /></div>
          <div className="sc-steps">
            {steps.map(s => (
              <div key={s.title} className="sc-step">
                <Pill kind={s.ok ? 'ok' : s.opt ? 'opt' : 'todo'}>{s.ok ? 'Done' : s.opt ? 'Optional' : 'To do'}</Pill>
                <div><strong>{s.title}</strong><small className="dim">{s.text}</small></div>
                {!s.ok && s.tab !== 'setup' && <button onClick={() => go(s.tab)}>Open</button>}
              </div>
            ))}
          </div>
        </div>

        <h3>Step 1. Choose a protection level</h3>
        <p className="dim sc-lead">This sets all limits, punishments and guards in one click. You can still change any single option afterwards.</p>
        <div className="sc-presets">
          {PRESETS.map(p => {
            const isOn = active?.id === p.id, busy = applying === p.id
            return (
              <button key={p.id} disabled={!!applying} className={'sc-preset' + (isOn ? ' active' : '') + (busy ? ' busy' : '')}
                style={{ ['--c' as any]: p.color }} aria-pressed={isOn} onClick={() => applyPreset(p)}>
                {(isOn || busy) && <em className="sc-badge">{busy ? 'Applying' : 'Active'}</em>}
                <strong>{p.title}</strong>
                {p.rec && <small className="sc-rec">Recommended for most servers</small>}
                <span>{p.text}</span>
              </button>
            )
          })}
        </div>
        {!active && !applying && <p className="dim sc-note">No level is active, so you are using custom settings. Pick a level to reset everything to a ready-made setup.</p>}

        <h3>Step 2. Essentials</h3>
        <div className="card sc-card">
          <Row s={def('log_channel', 'channel')} C={C} label="Log channel" hint="The bot posts alerts here. Choose a private staff channel." />
          <Row s={def('wl_users')} C={C} label="Trusted users and bots" hint="Paste user IDs separated by commas. These are never punished." />
          <Row s={def('wl_roles')} C={C} label="Trusted roles" hint="Paste role IDs separated by commas. Members with these roles are never punished." />
          <p className="dim sc-note">The server owner and the bot are always trusted. To copy an ID, turn on Developer Mode in Discord, then right click and choose Copy ID.</p>
        </div>
        <div className="sc-btns"><button className="p" onClick={() => go('protect')}>Next: review protections</button></div>
      </>}

      {/* ================= PROTECTIONS ================= */}
      {tab === 'protect' && <>
        <h3>Protections</h3>
        <p className="dim sc-lead">Switch each protection on or off. Open Advanced options only if you want exact limits. A level from the Setup tab already sets sensible values.</p>
        <div className="sc-list">
          <Card C={C} title="Anti-Nuke" desc="Punishes anyone who mass bans, kicks, or deletes and creates channels and roles."
            on={nukeOn} onToggle={b => setAll(ACTION_KEYS, '_on', b)} more={rest(5, isNukeKey)}>
            <div className="row sc-row"><span className="n">Punishment<small className="dim">What happens to someone who goes over the limit.</small></span>
              <select value={String(val('ban_punish') ?? 'ban')} onChange={e => setAll(ACTION_KEYS, '_punish', e.target.value)}>
                {PUNISH.map(p => <option key={p}>{p}</option>)}</select></div>
          </Card>

          <Card C={C} title="Beast Mode" desc="If many dangerous actions happen quickly, every one is punished instantly for a while."
            on={on('beast_on')} onToggle={b => save({ beast_on: b })} more={rest(6, k => k === 'beast_on')} />

          <Card C={C} title="Anti-Raid" desc="Detects waves of suspicious joins, locks the server and punishes the raiders."
            on={on('raid_on')} onToggle={b => save({ raid_on: b })} more={rest(7, k => k === 'raid_on' || k === 'raid_lock' || k === 'raid_punish')}>
            <Row s={def('raid_lock', 'bool')} C={C} label="Lock the server during a raid" />
            <Row s={def('raid_punish')} C={C} label="Punish raiders with" />
          </Card>

          <Card C={C} title="Anti-Spam" desc="Stops message floods, repeated messages and mention spam."
            on={on('spam_on')} onToggle={b => save({ spam_on: b })} more={rest(9, k => k === 'spam_on')} />

          <Card C={C} title="Guards" desc="Blocks and reverts sensitive changes. Tick what you want to protect."
            more={rest(8, k => isGuardKey(k))}>
            <div className="sc-chips">
              {Object.entries(GUARDS).map(([k, name]) => (
                <label key={k} className={on(k + '_on') ? 'on' : ''}>
                  {name}<input type="checkbox" checked={on(k + '_on')} onChange={e => save({ [k + '_on']: e.target.checked })} />
                </label>
              ))}
            </div>
            <div className="sc-btns">
              <button onClick={() => save(Object.fromEntries(Object.keys(GUARDS).map(k => [k + '_on', true])))}>Enable all</button>
              <button onClick={() => save(Object.fromEntries(Object.keys(GUARDS).map(k => [k + '_on', false])))}>Disable all</button>
            </div>
          </Card>

          <Card C={C} title="Ghost ping alert" desc="Posts a notice when someone mentions a person and then deletes the message."
            on={on('ghost_on')} onToggle={b => save({ ghost_on: b })}>
            {on('ghost_on') && <Row s={def('ghost_show_content', 'bool')} C={C} label="Also show the deleted text" />}
          </Card>

          <Card C={C} title="Auto recovery" desc="Re-creates channels, roles and emojis that an offender deletes."
            on={on('recover_on')} onToggle={b => save({ recover_on: b })} more={rest(11, k => k === 'recover_on')} />

          <Card C={C} title="Verification" desc="New members must verify with a button or a captcha before they get access."
            on={on('verify_on')} onToggle={b => save({ verify_on: b })} more={rest(10, k => ['verify_on', 'verify_mode', 'verify_channel'].includes(k))}>
            <div className="row sc-row"><span className="n">Method<small className="dim">Button is easy. Captcha blocks most bots.</small></span>
              <select value={String(val('verify_mode') ?? 'button')} onChange={e => save({ verify_mode: e.target.value })}>
                <option value="button">Button</option><option value="captcha">Captcha</option></select></div>
            <Row s={def('verify_channel', 'channel')} C={C} label="Verification channel" hint="Where the verify message is posted." />
            <div className="sc-btns"><button onClick={() => run('act_verify_panel', 'Post the verification message in the verification channel')}>Post verification message</button></div>
          </Card>
        </div>
      </>}

      {/* ================= BACKUPS ================= */}
      {tab === 'backup' && <BackupPanel guildId={guildId} v={v} save={save} reload={reload} />}

      {/* ================= TOOLS ================= */}
      {tab === 'tools' && <>
        <h3>Quick actions</h3>
        <div className="card sc-card">
          {QUICK.map(a => (
            <div className="row sc-row" key={a.key}>
              <span className="n">{a.title}<small className="dim">{a.text}</small></span>
              <button className={a.danger ? 'd' : ''} onClick={() => run(a.key, a.ask)}>{a.title}</button>
            </div>
          ))}
        </div>

        <h3>Import and export</h3>
        <div className="card sc-card">
          <p className="dim">Save all security settings to a file, or load a file to restore them or copy them to another server.</p>
          <div className="sc-btns">
            <button className="p" onClick={exportSettings}>Export settings</button>
            <button onClick={() => file.current?.click()}>Import settings</button>
            <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => importSettings(e.target.files?.[0])} />
          </div>
        </div>

        <h3>Advanced</h3>
        <div className="card sc-card"><details open={false}><summary>Logging, owner alerts and per-action allow lists ({rest(12).length})</summary>
          {rest(12).map(s => <Row key={s.key} s={s} C={C} />)}</details></div>
      </>}
    </div>
  )
}