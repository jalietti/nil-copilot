import { describe, expect, it } from 'vitest'
import { buildPilotReport } from '@/lib/pilot-report'

describe('buildPilotReport', () => {
  const report = buildPilotReport({
    inviteCodes: [
      { code: 'TEAM', label: 'water polo', uses: 2, max_uses: 10, revoked_at: null },
      { code: 'SOLO', label: null, uses: 1, max_uses: 1, revoked_at: '2026-09-01T00:00:00Z' },
    ],
    profiles: [
      { invite_code: 'TEAM', onboarding_completed_at: '2026-09-02T00:00:00Z' },
      { invite_code: 'TEAM', onboarding_completed_at: null },
      { invite_code: 'SOLO', onboarding_completed_at: '2026-09-03T00:00:00Z' },
    ],
    interviews: { total: 2, withVoiceProfile: 1 },
    runs: [
      { status: 'completed', brands_found: 4, matches_created: 3 },
      { status: 'completed', brands_found: 2, matches_created: 1 },
      { status: 'failed', brands_found: 0, matches_created: 0 },
    ],
    matches: [
      { status: 'suggested', has_email: true },
      { status: 'contacted', has_email: true },
      { status: 'suggested', has_email: false },
      { status: 'dismissed', has_email: true },
    ],
    deals: [{ status: 'sent' }, { status: 'reply_received' }, { status: 'agreed' }, { status: 'draft' }],
    messages: [
      { direction: 'outbound_draft', athlete_edited: true },
      { direction: 'outbound_draft', athlete_edited: false },
      { direction: 'inbound_pasted', athlete_edited: false },
    ],
  })

  it('breaks signups down per invite code', () => {
    expect(report.inviteCodes).toEqual([
      { code: 'TEAM', label: 'water polo', used: '2/10', signups: 2, onboarded: 1, revoked: false },
      { code: 'SOLO', label: '', used: '1/1', signups: 1, onboarded: 1, revoked: true },
    ])
  })

  it('computes the pilot success signals from counts', () => {
    expect(report.discovery).toMatchObject({ runs: 3, completed: 2, failed: 1, avgBrandsFound: '3.0' })
    // Dismissed matches don't count toward the usable-email rate.
    expect(report.matches).toMatchObject({ withUsableEmail: 2, usableEmailRate: '67%', dismissed: 1 })
    expect(report.signals).toMatchObject({
      matchesWithEmailPerRun: '1.0',
      dealsSentOrLater: 3,
      repliedPerSentDeal: '67%',
      draftsEditedByAthlete: '50%',
      repliesPasted: 1,
    })
  })

  it('handles an empty pilot without dividing by zero', () => {
    const empty = buildPilotReport({
      inviteCodes: [],
      profiles: [],
      interviews: { total: 0, withVoiceProfile: 0 },
      runs: [],
      matches: [],
      deals: [],
      messages: [],
    })
    expect(empty.signals.repliedPerSentDeal).toBe('—')
    expect(empty.matches.usableEmailRate).toBe('—')
  })
})
