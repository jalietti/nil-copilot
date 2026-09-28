// Friendly pre-check for invite codes. The real gate is the auth.users trigger
// (supabase/migrations/0003_invite_codes.sql); this only exists so the athlete
// gets a clear message instead of Supabase's generic trigger-failure error.

export interface InviteCodeRow {
  max_uses: number | null
  uses: number
  revoked_at: string | null
}

export type InviteCodeProblem = 'invalid' | 'exhausted'

export const INVITE_CODE_MESSAGES: Record<InviteCodeProblem, string> = {
  invalid: "That invite code isn't valid. Double-check it with whoever invited you.",
  exhausted: 'That invite code has already been used up. Ask whoever invited you for a new one.',
}

export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase()
}

export function checkInviteCode(row: InviteCodeRow | null): InviteCodeProblem | null {
  if (!row || row.revoked_at) return 'invalid'
  if (row.max_uses !== null && row.uses >= row.max_uses) return 'exhausted'
  return null
}

// What GoTrue returns when handle_new_user raises (e.g. a code was used up
// between the pre-check and the insert).
export function isInviteRejection(message: string): boolean {
  return /database error saving new user|invalid_invite_code/i.test(message)
}
