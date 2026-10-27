// Security tab for the Yukio dashboard — simple version.
// Layout: status + presets  ->  essentials  ->  one card per protection (switch + "More options")  ->  quick actions  ->  backups.
// Backend: same endpoints the Settings page already uses:
//   GET  /api/cogs                          (to read the security cog's setting definitions)
//   GET  /api/cogs/security/settings/:guild (current values, {key: value})
//   POST /api/cogs/security/settings/:guild (body = {key: value, ...}, only the changed keys)
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, toast } from './api'
import BackupPanel from './BackupPanel'
import './security.css'

type Def = { key: string; label: string; type: string; default: any }
type Ctx = { v: Record<string, any>; defs: Record<string, Def>; chans: { id: string; name: string }[]; save: (p: Record<string, any>) => void }

const PUNISH = ['ban', 'kick', 'strip', 'mute', 'none']
const ACTION_KEYS = ['ban', 'kick', 'prune', 'channel_create', 'channel_delete', 'role_create', 'role_delete', 'bot_add', 'danger_perm', 'danger_role']
const GUARDS: Record<string, string> = {
  mention: '@everyone / @here', webhook: 'New webhooks', vanity: 'Vanity URL change', server_rename: 'Server rename',
  server_icon: 'Server icon change', role_rename: 'Role rename', channel_rename: 'Channel rename',
  emoji_delete: 'Emoji delete', emoji_rename: 'Emoji rename', invite_delete: 'Invite delete',
}
const PRESETS = [
  { id: 'low', title: 'Low', color: '#34d8a6', text: 'Relaxed. Removes roles instead of banning. Only blocks @everyone.' },
  { id: 'normal', title: 'Normal', color: '#38b6ff', text: 'Recommended. Anti-nuke, raid and spam protection, key guards, daily backup.' },
  { id: 'high', title: 'High', color: '#ff627a', text: 'Strict. Everything on, bans offenders, raid lock, backup every 6 hours.' },
]

const truthy = (x: any) => x === true || ['1', 'true', 'yes', 'on'].includes(String(x).toLowerCase())
const parseLabel = (l: string) => {
  const m = /^\[(\d+)\s+([^\]]+)\]\s*(.*)$/.exec(l)
  return m ? { n: +m[1], name: m[3] } : { n: 99, name: l }
}
const isButton = (k: string) => k.startsWith('act_') || k.startsWith('preset_') || k === 'mod_run'

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
    <span className="n">{label ?? parseLabel(s.label).name}{hint && <small className="dim"> {hint}</small>}</span>
    <Field s={s} C={C} />
  </div>

function Card({ title, desc, on, onToggle, children, more, C }: {
  title: string; desc: string; on?: boolean; onToggle?: (b: boolean) => void
  children?: ReactNode; more?: Def[]; C: Ctx
}) {
  return (
    <div className="card sc-card">
      <div className="sc-head">
        <div><h4>{title}</h4><p className="dim">{desc}</p></div>
        {onToggle && <input type="checkbox" aria-label={title} checked={!!on} onChange={e => onToggle(e.target.checked)} />}
      </div>
      {children}
      {!!more?.length && <details><summary>More options</summary>
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

  const reload = useCallback(() => {
    api<any>(`/cogs/security/settings/${guildId}`).then(setV).catch(() => {})
  }, [guildId])

  useEffect(() => {
    api<any[]>('/cogs').then(cs => {
      const c = cs.find(x => x.name === 'security')
      if (!c || !c.loaded) setMissing(true)
      else setDefList(c.settings)
    }).catch(() => {})
    api<any>('/guilds/' + guildId).then(g => setChans((g.channels ?? []).map((x: any) => ({ id: String(x.id), name: x.name })))).catch(() => {})
    reload()
  }, [guildId, reload])

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

  const run = (key: string, what: string) => {
    if (!confirm(`${what}?`)) return
    save({ [key]: true })
    toast('Sent. The bot runs it within ~10 seconds')
    window.setTimeout(reload, 12000)
  }

  const preset = String(val('preset_current') ?? 'none')
  const nukeOn = ACTION_KEYS.some(k => on(k + '_on'))
  const isNukeKey = (k: string) => ACTION_KEYS.some(a => k === a + '_on' || k === a + '_punish')
  const isGuardKey = (k: string) => Object.keys(GUARDS).some(g => k === g + '_on')

  return (
    <div className="sec">
      {/* 1. status + presets */}
      <div className={'card sc-status' + (on('enabled') ? ' live' : '')}>
        <div>
          <h4>{on('enabled') ? 'Protection is ON' : 'Protection is OFF'}</h4>
          <p className="dim">Current preset: <b className="inl">{preset}</b>. The master switch turns every protection below on or off.</p>
        </div>
        <input type="checkbox" aria-label="Protection master switch" checked={on('enabled')} onChange={e => save({ enabled: e.target.checked })} />
      </div>

      <h3>1. Pick a level</h3>
      <div className="sc-presets">
        {PRESETS.map(p => (
          <button key={p.id} className={'sc-preset' + (preset.toLowerCase() === p.id ? ' active' : '')} style={{ ['--c' as any]: p.color }}
            onClick={() => run(`preset_${p.id}`, `Apply the ${p.title.toUpperCase()} preset? It overwrites limits, punishments and guard switches. Your trusted list and log channel are kept`)}>
            <strong>{p.title}</strong><span>{p.text}</span>
          </button>
        ))}
      </div>

      {/* 2. essentials */}
      <h3>2. Essentials</h3>
      <div className="card sc-card">
        <Row s={def('log_channel', 'channel')} C={C} label="Log channel" hint="alerts are posted here" />
        <Row s={def('wl_users')} C={C} label="Trusted users / bots" hint="user IDs, comma separated" />
        <Row s={def('wl_roles')} C={C} label="Trusted roles" hint="role IDs, comma separated" />
        <p className="dim sc-note">The server owner and the bot are always trusted.</p>
      </div>

      {/* 3. protections */}
      <h3>3. Protections</h3>
      <div className="sc-list">
        <Card C={C} title="Anti-Nuke" desc="Punishes anyone who mass bans, kicks, or deletes/creates channels and roles."
          on={nukeOn} onToggle={b => setAll(ACTION_KEYS, '_on', b)} more={rest(5, isNukeKey)}>
          <div className="row sc-row"><span className="n">Punishment</span>
            <select value={String(val('ban_punish') ?? 'ban')} onChange={e => setAll(ACTION_KEYS, '_punish', e.target.value)}>
              {PUNISH.map(p => <option key={p}>{p}</option>)}</select></div>
        </Card>

        <Card C={C} title="Beast Mode" desc="If lots of dangerous actions happen quickly, every one is punished instantly for a while."
          on={on('beast_on')} onToggle={b => save({ beast_on: b })} more={rest(6, k => k === 'beast_on')} />

        <Card C={C} title="Anti-Raid" desc="Detects waves of suspicious joins, locks the server and punishes raiders."
          on={on('raid_on')} onToggle={b => save({ raid_on: b })} more={rest(7, k => k === 'raid_on' || k === 'raid_lock')}>
          <Row s={def('raid_lock', 'bool')} C={C} label="Lock the server during a raid" />
          <Row s={def('raid_punish')} C={C} label="Punish raiders with" />
        </Card>

        <Card C={C} title="Anti-Spam" desc="Stops message floods, repeated messages and mention spam."
          on={on('spam_on')} onToggle={b => save({ spam_on: b })} more={rest(9, k => k === 'spam_on')} />

        <Card C={C} title="Guards" desc="Blocks and reverts sensitive changes. Choose what to protect."
          more={rest(8, k => isGuardKey(k))}>
          <div className="sc-chips">
            {Object.entries(GUARDS).map(([k, name]) => (
              <label key={k} className={on(k + '_on') ? 'on' : ''}>
                <input type="checkbox" checked={on(k + '_on')} onChange={e => save({ [k + '_on']: e.target.checked })} />{name}
              </label>
            ))}
          </div>
          <div className="sc-btns">
            <button onClick={() => save(Object.fromEntries(Object.keys(GUARDS).map(k => [k + '_on', true])))}>Enable all</button>
            <button onClick={() => save(Object.fromEntries(Object.keys(GUARDS).map(k => [k + '_on', false])))}>Disable all</button>
          </div>
        </Card>

        <Card C={C} title="Ghost ping alert" desc="Posts a notice when someone mentions a person and deletes the message."
          on={on('ghost_on')} onToggle={b => save({ ghost_on: b })}>
          {on('ghost_on') && <Row s={def('ghost_show_content', 'bool')} C={C} label="Also show the deleted text" />}
        </Card>

        <Card C={C} title="Auto recovery" desc="Re-creates channels, roles and emojis that an offender deletes."
          on={on('recover_on')} onToggle={b => save({ recover_on: b })} more={rest(11, k => k === 'recover_on')} />

        <Card C={C} title="Verification" desc="New members must verify (button or captcha) before getting access."
          on={on('verify_on')} onToggle={b => save({ verify_on: b })} more={rest(10, k => ['verify_on', 'verify_mode', 'verify_channel'].includes(k))}>
          <div className="row sc-row"><span className="n">Method</span>
            <select value={String(val('verify_mode') ?? 'button')} onChange={e => save({ verify_mode: e.target.value })}>
              <option value="button">Button</option><option value="captcha">Captcha</option></select></div>
          <Row s={def('verify_channel', 'channel')} C={C} label="Verification channel" />
          <div className="sc-btns"><button onClick={() => run('act_verify_panel', 'Post the verification panel in the verification channel')}>Post verification panel</button></div>
        </Card>
      </div>

      {/* 4. quick actions */}
      <h3>4. Quick actions</h3>
      <div className="card sc-card">
        <div className="sc-btns">
          <button className="d" onClick={() => run('act_lockall', 'Lock ALL text channels')}>Lock all channels</button>
          <button onClick={() => run('act_unlockall', 'Unlock all channels')}>Unlock all channels</button>
          <button onClick={() => run('act_raid_end', 'End raid mode and unlock')}>End raid mode</button>
          <button onClick={() => run('act_beast_calm', 'Calm Beast Mode')}>Calm Beast Mode</button>
        </div>
      </div>

      {/* 5. backups */}
      <h3>5. Backups</h3>
      <BackupPanel guildId={guildId} />
      <div className="card sc-card">
        <Row s={def('backup_auto_hours', 'number')} C={C} label="Automatic backup every (hours)" hint="0 = off" />
        <Row s={def('backup_keep', 'number')} C={C} label="Keep the newest" hint="backups" />
        <details><summary>More options</summary>
          {rest(2, k => ['backup_auto_hours', 'backup_keep'].includes(k)).map(s => <Row key={s.key} s={s} C={C} />)}</details>
      </div>

      {/* advanced */}
      <h3>Advanced</h3>
      <div className="card sc-card"><details><summary>Logging, owner alerts and per-action allow lists</summary>
        {rest(12).map(s => <Row key={s.key} s={s} C={C} />)}</details></div>
    </div>
  )
}