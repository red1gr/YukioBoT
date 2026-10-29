import { useEffect, useState } from 'react'

const OWNER_ID = '146007196617015296'
type Act = { type: number; name: string; state?: string; details?: string; emoji?: { name: string } }
type LY = {
  discord_status: 'online' | 'idle' | 'dnd' | 'offline'
  discord_user: { id: string; username: string; global_name?: string; avatar?: string }
  activities: Act[]
  listening_to_spotify?: boolean
  spotify?: { song: string; artist: string }
}

const avatarOf = (u: LY['discord_user']) =>
  u.avatar
    ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.${u.avatar.startsWith('a_') ? 'gif' : 'png'}?size=128`
    : `https://cdn.discordapp.com/embed/avatars/${(Number(BigInt(u.id) >> 22n)) % 6}.png`

const doing = (d: LY): string => {
  if (d.listening_to_spotify && d.spotify) return `Listening to ${d.spotify.song} - ${d.spotify.artist}`
  const custom = d.activities.find(a => a.type == 4)
  if (custom?.state) return custom.state
  const a = d.activities.find(a => a.type != 4)
  if (a) return `${['Playing', 'Streaming', 'Listening to', 'Watching', '', 'Competing in'][a.type] ?? ''} ${a.name}`.trim()
  return ''
}

const LABEL = { online: 'Online', idle: 'Away', dnd: 'Busy', offline: 'Offline' }

export default function OwnerCard() {
  const [d, setD] = useState<LY | null>(null)
  const [fail, setFail] = useState(false)
  useEffect(() => {
    let live = true
    const load = async () => {
      try {
        const r = await fetch(`https://api.lanyard.rest/v1/users/${OWNER_ID}`, { cache: 'no-store' })
        const j = await r.json()
        if (!live) return
        if (j.success) { setD(j.data); setFail(false) } else setFail(true)
      } catch { live && setFail(true) }
    }
    load(); const t = setInterval(load, 15000)
    return () => { live = false; clearInterval(t) }
  }, [])

  if (fail && !d) return null // not in the Lanyard server / API down: hide quietly
  if (!d) return <div className="own skel" aria-hidden="true" />
  const s = d.discord_status
  const name = d.discord_user.global_name || d.discord_user.username
  const line = doing(d)
  return (
    <a className="own" data-s={s} href={`https://discord.com/users/${OWNER_ID}`} target="_blank" rel="noopener"
       title="Open on Discord">
      <span className="own-av">
        <img src={avatarOf(d.discord_user)} alt="" />
        <i className="own-dot" data-s={s} role="img" aria-label={LABEL[s]} />
      </span>
      <span className="own-tx">
        <small>Developed By</small>
        <b>{name}</b>
        <em>{line || LABEL[s]}</em>
      </span>
    </a>
  )
}