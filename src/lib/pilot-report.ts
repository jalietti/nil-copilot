import type { DealStatus, DiscoveryRunStatus, MatchStatus } from './supabase/types'

// Aggregate pilot numbers for the owner (scripts/pilot-report.ts). Inputs are
// narrow column selections — never names, visa status, or message text — and
// the output is counts and rates only.

export interface PilotReportInput {
  inviteCodes: { code: string; label: string | null; uses: number; max_uses: number | null; revoked_at: string | null }[]
  profiles: { invite_code: string | null; onboarding_completed_at: string | null }[]
  interviews: { total: number; withVoiceProfile: number }
  runs: { status: DiscoveryRunStatus; brands_found: number; matches_created: number }[]
  matches: { status: MatchStatus; has_email: boolean }[]
  deals: { status: DealStatus }[]
  messages: { direction: 'outbound_draft' | 'inbound_pasted'; athlete_edited: boolean }[]
}

const rate = (part: number, whole: number) => (whole === 0 ? '—' : `${Math.round((part / whole) * 100)}%`)
const perUnit = (part: number, whole: number) => (whole === 0 ? '—' : (part / whole).toFixed(1))

export function buildPilotReport(input: PilotReportInput) {
  const count = <T>(rows: T[], f: (row: T) => boolean) => rows.filter(f).length
  const completed = input.runs.filter((r) => r.status === 'completed')
  const activeMatches = input.matches.filter((m) => m.status !== 'dismissed')
  const matchesWithEmail = count(activeMatches, (m) => m.has_email)
  const reachedSent = count(input.deals, (d) => d.status !== 'draft')
  const replied = count(input.deals, (d) =>
    ['reply_received', 'negotiating', 'agreed', 'closed'].includes(d.status),
  )
  const drafts = input.messages.filter((m) => m.direction === 'outbound_draft')

  return {
    inviteCodes: input.inviteCodes.map((c) => ({
      code: c.code,
      label: c.label ?? '',
      used: c.max_uses === null ? `${c.uses}` : `${c.uses}/${c.max_uses}`,
      signups: count(input.profiles, (p) => p.invite_code === c.code),
      onboarded: count(input.profiles, (p) => p.invite_code === c.code && !!p.onboarding_completed_at),
      revoked: !!c.revoked_at,
    })),
    athletes: {
      signedUp: input.profiles.length,
      onboarded: count(input.profiles, (p) => !!p.onboarding_completed_at),
      interviewed: input.interviews.total,
      withVoiceProfile: input.interviews.withVoiceProfile,
    },
    discovery: {
      runs: input.runs.length,
      completed: completed.length,
      failed: count(input.runs, (r) => r.status === 'failed'),
      avgBrandsFound: perUnit(completed.reduce((n, r) => n + r.brands_found, 0), completed.length),
      avgMatchesCreated: perUnit(completed.reduce((n, r) => n + r.matches_created, 0), completed.length),
    },
    matches: {
      total: input.matches.length,
      dismissed: count(input.matches, (m) => m.status === 'dismissed'),
      withUsableEmail: matchesWithEmail,
      usableEmailRate: rate(matchesWithEmail, activeMatches.length),
    },
    deals: Object.fromEntries(
      (['draft', 'sent', 'reply_received', 'negotiating', 'agreed', 'closed', 'dead'] as const).map(
        (status) => [status, count(input.deals, (d) => d.status === status)],
      ),
    ),
    signals: {
      matchesWithEmailPerRun: perUnit(matchesWithEmail, completed.length),
      dealsSentOrLater: reachedSent,
      repliedPerSentDeal: rate(replied, reachedSent),
      draftsGenerated: drafts.length,
      draftsEditedByAthlete: rate(count(drafts, (m) => m.athlete_edited), drafts.length),
      repliesPasted: count(input.messages, (m) => m.direction === 'inbound_pasted'),
    },
  }
}
