import { useEffect, useState } from 'react'
import './legal.css'

export const LEGAL_PATHS = { terms: '/terms-of-service', privacy: '/privacy-policy' } as const
export type LegalPage = keyof typeof LEGAL_PATHS

export const legalPage = (): LegalPage | null => {
  const p = location.pathname.replace(/\/+$/, '').replace(/\s+/g, '').toLowerCase()
  return p == LEGAL_PATHS.terms ? 'terms' : p == LEGAL_PATHS.privacy ? 'privacy' : null
}

const AVATAR = 'https://r2.fivemanage.com/S1wPEooftNoEmQjn8jhwx/5b55ae114cd60f4af538b42a45814f09.jpg'
const UPDATED = 'October 29, 2026'

/* a paragraph is plain text, or [bold lead-in, text] */
type Para = string | [string, string]
type Sec = { id: string; title: string; body: Para[] }
type Doc = { title: string; intro: string; summary: string[]; sections: Sec[] }

const DOCS: Record<LegalPage, Doc> = {
  terms: {
    title: 'Terms of Service',
    intro: 'The rules for using Yukio and its dashboard. Short version: use it responsibly, and you are in charge of how it runs in your server.',
    summary: [
      'You must follow the Discord Terms of Service and Community Guidelines.',
      'You are responsible for how you configure Yukio, including automatic punishments.',
      'Security tools and backups help, but they cannot guarantee protection.',
      'The service is provided as is and may change or go offline.',
    ],
    sections: [
      { id: 'acceptance', title: 'Acceptance of these terms', body: [
        'By inviting Yukio ("the Bot") to a Discord server, logging in to the Yukio dashboard, or using any of its commands, you agree to these Terms of Service. If you do not agree, please do not use the Bot or the dashboard.',
        'You must also follow the Discord Terms of Service and Community Guidelines at all times.',
      ] },
      { id: 'service', title: 'What Yukio does', body: [
        'Yukio is a Discord bot that offers moderation, security (anti-nuke, anti-raid, anti-spam, link and scam blocking, backups), logging, leveling, tickets, welcome images and fun commands, together with a web dashboard to configure them.',
      ] },
      { id: 'responsibilities', title: 'Your responsibilities', body: [
        ['Your configuration.', 'You are responsible for how you configure and use the Bot in your server, including the actions it takes on your behalf, such as kicks, bans, mutes, role removals, channel locks and message deletions.'],
        ['Dashboard access.', 'Only give dashboard access to people you trust. Anyone with the Manage Server permission on a server may be able to change that server\'s Bot settings.'],
        ['Acceptable use.', 'You may not use the Bot to harass, abuse, scam or harm others, to break the law, to break Discord\'s rules, or to attack, overload or reverse-engineer the Bot or the dashboard.'],
      ] },
      { id: 'security', title: 'Security features and backups', body: [
        'Security tools and backups are provided to help reduce damage, not to guarantee protection. We do not promise that every attack, raid, scam or deletion will be detected, blocked or restored.',
        'A backup stores roles, permissions, channels, categories and emojis. It does not store messages or members. Restoring a backup only re-creates items that are missing.',
      ] },
      { id: 'availability', title: 'Availability and changes', body: [
        'The Bot and the dashboard are provided "as is" and "as available". They may go offline, change or be discontinued at any time, with or without notice. Features may be added or removed.',
      ] },
      { id: 'suspension', title: 'Suspension and removal', body: [
        'We may restrict or block a user or a server from using the Bot if these terms are broken or if the Bot is being abused. You can stop using Yukio at any time by removing the Bot from your server.',
      ] },
      { id: 'liability', title: 'Disclaimer and limitation of liability', body: [
        'To the fullest extent allowed by law, Yukio and its operators make no warranties of any kind and are not liable for any indirect or consequential damages, loss of data, loss of server content, or loss of members resulting from the use of, or inability to use, the Bot or dashboard.',
      ] },
      { id: 'changes', title: 'Changes to these terms', body: [
        'We may update these terms from time to time. The date at the top of this page shows the latest version. Continuing to use the Bot after a change means you accept the new terms.',
      ] },
      { id: 'contact', title: 'Contact', body: [
        'Questions about these terms can be sent to the Yukio team through our Discord support channel.',
      ] },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    intro: 'What Yukio collects, why it collects it, and how you stay in control. We only collect what the Bot needs to work.',
    summary: [
      'We never sell your data and never use it for advertising.',
      'We never see your Discord password. Login goes through Discord OAuth2.',
      'Messages are processed to run features, and stored only where a feature needs it (for example ticket transcripts).',
      'Backups save server structure only, never messages or member lists.',
    ],
    sections: [
      { id: 'overview', title: 'Overview', body: [
        'This Privacy Policy explains what information Yukio ("the Bot") and its dashboard collect, why, and how it is handled.',
      ] },
      { id: 'collect', title: 'Information we collect', body: [
        ['Account data.', 'When you log in to the dashboard: your user ID, username, avatar and the list of servers you belong to (via Discord OAuth2). We do not receive your Discord password.'],
        ['Server data.', 'Server (guild), channel, role, emoji and member IDs and names, and the settings you choose in the dashboard.'],
        ['Moderation and activity data.', 'Warnings, moderation actions, ticket records and transcripts, leveling data (XP, level and message counts), and event logs such as joins, leaves, deletions and security alerts.'],
        ['Message content.', 'The Bot processes messages as they arrive to run features such as anti-spam, link and scam blocking, leveling and commands. Content is only stored where a feature requires it, for example ticket transcripts, deleted or edited message logs and ghost-ping alerts, if you enable them.'],
        ['Backups.', 'Server structure (roles, permissions, channels, categories and emojis) when a backup is created. Backups do not include messages or member lists.'],
      ] },
      { id: 'use', title: 'How we use information', body: [
        'To run and secure the features you enable, to show information in the dashboard, to prevent abuse of the Bot, and to fix bugs and improve Yukio.',
        'We do not sell your data and we do not use it for advertising.',
      ] },
      { id: 'cookies', title: 'Cookies and local storage', body: [
        'The dashboard uses a session cookie to keep you logged in. Your browser\'s local storage is used to remember simple preferences such as the selected server and the last opened tab. No advertising or tracking cookies are used.',
      ] },
      { id: 'sharing', title: 'Sharing', body: [
        'Data is not shared with third parties except where needed to run the service (for example Discord, which delivers the Bot\'s features, and our hosting providers), or where required by law.',
        'Logs and transcripts you configure are posted to channels or sent by DM inside Discord, and are visible to whoever has access there.',
      ] },
      { id: 'retention', title: 'Retention and deletion', body: [
        'Data is kept while the Bot is in your server and while it is needed for the features you use. Event logs can be pruned from the dashboard, ticket channels and backups can be deleted by server staff, and settings can be reset at any time.',
        'To request deletion of data linked to your user ID or your server, contact us using the details below. Removing the Bot from a server stops further collection for that server.',
      ] },
      { id: 'security', title: 'Security', body: [
        'We take reasonable steps to protect stored data, but no system is completely secure and we cannot guarantee absolute security.',
      ] },
      { id: 'children', title: 'Children', body: [
        'Yukio is intended for users who meet Discord\'s minimum age requirement. We do not knowingly collect data from anyone below that age.',
      ] },
      { id: 'changes', title: 'Changes to this policy', body: [
        'We may update this policy from time to time. The date at the top of this page shows the latest version.',
      ] },
      { id: 'contact', title: 'Contact', body: [
        'For privacy questions or data requests, contact the Yukio team through our Discord support channel.',
      ] },
    ],
  },
}

export function LegalFooter() {
  return (
    <footer className="legal-foot">
      <a href={LEGAL_PATHS.terms}>Terms of Service</a>
      <span aria-hidden="true">·</span>
      <a href={LEGAL_PATHS.privacy}>Privacy Policy</a>
    </footer>
  )
}

const pad = (n: number) => String(n + 1).padStart(2, '0')

export default function Legal({ page }: { page: LegalPage }) {
  const doc = DOCS[page]
  const [active, setActive] = useState(doc.sections[0].id)

  useEffect(() => { document.title = `Yukio - ${doc.title}`; window.scrollTo(0, 0); setActive(doc.sections[0].id) }, [doc])

  // highlight the section currently being read
  useEffect(() => {
    const els = doc.sections.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver(es => {
      const vis = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (vis) setActive(vis.target.id)
    }, { rootMargin: '-90px 0px -65% 0px' })
    els.forEach(e => io.observe(e))
    return () => io.disconnect()
  }, [doc])

  const jump = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    history.replaceState(null, '', '#' + id)
  }

  return (
    <div id="legal">
      <header className="lg-bar">
        <a className="lg-brand" href="/"><img src={AVATAR} alt="" /><b>Yukio</b></a>
        <nav className="lg-nav" aria-label="Legal pages">
          {(Object.keys(LEGAL_PATHS) as LegalPage[]).map(k => (
            <a key={k} href={LEGAL_PATHS[k]} className={k == page ? 'on' : ''} aria-current={k == page ? 'page' : undefined}>{DOCS[k].title}</a>
          ))}
        </nav>
        <a className="lg-cta" href="/">Back to home</a>
      </header>

      <div className="lg-hero">
        <p className="lg-eyebrow">Legal</p>
        <h1>{doc.title}</h1>
        <p className="lg-intro">{doc.intro}</p>
        <p className="lg-date">Last updated {UPDATED}</p>
      </div>

      <div className="lg-layout">
        <aside className="lg-toc" aria-label="On this page">
          <h5>On this page</h5>
          {doc.sections.map((s, i) => (
            <a key={s.id} href={'#' + s.id} className={active == s.id ? 'on' : ''} onClick={jump(s.id)}>
              <span>{pad(i)}</span>{s.title}
            </a>
          ))}
        </aside>

        <main className="lg-body">
          <div className="lg-sum">
            <h5>In short</h5>
            <ul>{doc.summary.map(s => <li key={s}>{s}</li>)}</ul>
          </div>

          {doc.sections.map((s, i) => (
            <section key={s.id} id={s.id}>
              <h2><span>{pad(i)}</span>{s.title}</h2>
              {s.body.map((p, j) => typeof p == 'string'
                ? <p key={j}>{p}</p>
                : <p key={j}><strong>{p[0]}</strong> {p[1]}</p>)}
            </section>
          ))}

          <div className="lg-end">
            <div>
              <h4>Questions?</h4>
              <p>Reach the Yukio team on our Discord support channel and we will get back to you.</p>
            </div>
            <a className="lg-cta" href={LEGAL_PATHS[page == 'terms' ? 'privacy' : 'terms']}>
              Read the {DOCS[page == 'terms' ? 'privacy' : 'terms'].title} →
            </a>
          </div>
        </main>
      </div>

      <div className="lg-bottom"><LegalFooter /><p>© {new Date().getFullYear()} Yukio</p></div>
    </div>
  )
}