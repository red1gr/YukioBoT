import { useEffect } from 'react'
import './legal.css'

export const LEGAL_PATHS = { terms: '/terms-of-service', privacy: '/privacy-policy' } as const
export type LegalPage = keyof typeof LEGAL_PATHS

export const legalPage = (): LegalPage | null => {
  const p = location.pathname.replace(/\/+$/, '').replace(/\s+/g, '').toLowerCase()
  return p == LEGAL_PATHS.terms ? 'terms' : p == LEGAL_PATHS.privacy ? 'privacy' : null
}

const UPDATED = 'October 29, 2026'

const TERMS: [string, string[]][] = [
  ['1. Acceptance of these terms', [
    'By inviting Yukio ("the Bot") to a Discord server, logging in to the Yukio dashboard, or using any of its commands, you agree to these Terms of Service. If you do not agree, please do not use the Bot or the dashboard.',
    'You must also follow the Discord Terms of Service and Community Guidelines at all times.',
  ]],
  ['2. What Yukio does', [
    'Yukio is a Discord bot that offers moderation, security (anti-nuke, anti-raid, anti-spam, link and scam blocking, backups), logging, leveling, tickets, welcome images and fun commands, together with a web dashboard to configure them.',
  ]],
  ['3. Your responsibilities', [
    'You are responsible for how you configure and use the Bot in your server, including the actions it takes on your behalf (for example kicks, bans, mutes, role removals, channel locks and message deletions).',
    'Only give dashboard access to people you trust. Anyone with the Manage Server permission on a server may be able to change that server\'s Bot settings.',
    'You may not use the Bot to harass, abuse, scam or harm others, to break the law, to break Discord\'s rules, or to attack, overload or reverse-engineer the Bot or the dashboard.',
  ]],
  ['4. Security features and backups', [
    'Security tools and backups are provided to help reduce damage, not to guarantee protection. We do not promise that every attack, raid, scam or deletion will be detected, blocked or restored.',
    'A backup stores roles, permissions, channels, categories and emojis. It does not store messages or members. Restoring a backup only re-creates items that are missing.',
  ]],
  ['5. Availability and changes', [
    'The Bot and the dashboard are provided "as is" and "as available". They may go offline, change or be discontinued at any time, with or without notice. Features may be added or removed.',
  ]],
  ['6. Suspension and removal', [
    'We may restrict or block a user or a server from using the Bot if these terms are broken or if the Bot is being abused. You can stop using Yukio at any time by removing the Bot from your server.',
  ]],
  ['7. Disclaimer and limitation of liability', [
    'To the fullest extent allowed by law, Yukio and its operators make no warranties of any kind and are not liable for any indirect or consequential damages, loss of data, loss of server content, or loss of members resulting from the use of, or inability to use, the Bot or dashboard.',
  ]],
  ['8. Changes to these terms', [
    'We may update these terms from time to time. The date at the top of this page shows the latest version. Continuing to use the Bot after a change means you accept the new terms.',
  ]],
  ['9. Contact', [
    'Questions about these terms can be sent to the Yukio team through our Discord support channel.',
  ]],
]

const PRIVACY: [string, string[]][] = [
  ['1. Overview', [
    'This Privacy Policy explains what information Yukio ("the Bot") and its dashboard collect, why, and how it is handled. We only collect what is needed for the Bot to work.',
  ]],
  ['2. Information we collect', [
    'Discord account data when you log in to the dashboard: your user ID, username, avatar and the list of servers you belong to (via Discord OAuth2). We do not receive your Discord password.',
    'Server data needed for features to work: server (guild), channel, role, emoji and member IDs and names, and the settings you choose in the dashboard.',
    'Moderation and activity data: warnings, moderation actions, ticket records and transcripts, leveling data (XP, level and message counts), and event logs such as joins, leaves, deletions and security alerts.',
    'Message content: the Bot processes messages as they arrive to run features such as anti-spam, link and scam blocking, leveling and commands. Message content is only stored where a feature requires it, for example ticket transcripts, deleted or edited message logs and ghost-ping alerts, if you enable them.',
    'Backups: server structure (roles, permissions, channels, categories and emojis) when a backup is created. Backups do not include messages or member lists.',
  ]],
  ['3. How we use information', [
    'To run and secure the features you enable, to show information in the dashboard, to prevent abuse of the Bot, and to fix bugs and improve Yukio.',
    'We do not sell your data and we do not use it for advertising.',
  ]],
  ['4. Cookies and local storage', [
    'The dashboard uses a session cookie to keep you logged in. Your browser\'s local storage is used to remember simple preferences such as the selected server and the last opened tab. No advertising or tracking cookies are used.',
  ]],
  ['5. Sharing', [
    'Data is not shared with third parties except where needed to run the service (for example Discord, which delivers the Bot\'s features, and our hosting providers), or where required by law.',
    'Logs and transcripts you configure are posted to channels or sent by DM inside Discord, and are visible to whoever has access there.',
  ]],
  ['6. Retention and deletion', [
    'Data is kept while the Bot is in your server and while it is needed for the features you use. Event logs can be pruned from the dashboard, ticket channels and backups can be deleted by server staff, and settings can be reset at any time.',
    'To request deletion of data linked to your user ID or your server, contact us using the details below. Removing the Bot from a server stops further collection for that server.',
  ]],
  ['7. Security', [
    'We take reasonable steps to protect stored data, but no system is completely secure and we cannot guarantee absolute security.',
  ]],
  ['8. Children', [
    'Yukio is intended for users who meet Discord\'s minimum age requirement. We do not knowingly collect data from anyone below that age.',
  ]],
  ['9. Changes to this policy', [
    'We may update this policy from time to time. The date at the top of this page shows the latest version.',
  ]],
  ['10. Contact', [
    'For privacy questions or data requests, contact the Yukio team through our Discord support channel.',
  ]],
]

export function LegalFooter() {
  return (
    <footer className="legal-foot">
      <a href={LEGAL_PATHS.terms}>Terms of Service</a>
      <span aria-hidden="true">·</span>
      <a href={LEGAL_PATHS.privacy}>Privacy Policy</a>
    </footer>
  )
}

export default function Legal({ page }: { page: LegalPage }) {
  const isTerms = page == 'terms'
  const title = isTerms ? 'Terms of Service' : 'Privacy Policy'
  const sections = isTerms ? TERMS : PRIVACY
  useEffect(() => { document.title = `Yukio - ${title}`; window.scrollTo(0, 0) }, [title])
  return (
    <div id="legal">
      <div className="legal-wrap">
        <a className="legal-back" href="/">← Back to Yukio</a>
        <h1>{title}</h1>
        <p className="legal-date">Last updated: {UPDATED}</p>
        {sections.map(([h, ps]) => (
          <section key={h}>
            <h2>{h}</h2>
            {ps.map((p, i) => <p key={i}>{p}</p>)}
          </section>
        ))}
        <LegalFooter />
      </div>
    </div>
  )
}
