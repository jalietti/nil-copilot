import type { Message } from './supabase/types'

// Edit capture (storage only — edits are not fed back into generation yet).
// The first time an athlete changes a copilot draft, the generated text is
// preserved in original_subject/original_content; later edits only replace
// subject/content, so the original is never overwritten.

export type DraftEditUpdate = Pick<Message, 'subject' | 'content' | 'athlete_edited'> &
  Partial<Pick<Message, 'original_subject' | 'original_content'>>

export function draftEditUpdate(
  current: Pick<Message, 'subject' | 'content' | 'athlete_edited'>,
  edit: { subject: string; content: string },
): DraftEditUpdate | null {
  if (edit.subject === (current.subject ?? '') && edit.content === current.content) return null
  return {
    subject: edit.subject,
    content: edit.content,
    athlete_edited: true,
    ...(current.athlete_edited
      ? {}
      : { original_subject: current.subject, original_content: current.content }),
  }
}

export interface PreviousDraftVersion {
  subject: string | null
  content: string
  athlete_edited: boolean
  original_subject: string | null
  original_content: string | null
  replaced_at: string
}

type RegenerableMessage = Pick<
  Message,
  'subject' | 'content' | 'athlete_edited' | 'original_subject' | 'original_content' | 'previous_versions'
>

// "Try another version": the new draft replaces the current one, and the
// current one (with its edit capture) is appended to previous_versions.
export function regeneratedDraftUpdate(
  current: RegenerableMessage,
  next: { subject: string; content: string },
  now: Date,
) {
  const replaced: PreviousDraftVersion = {
    subject: current.subject,
    content: current.content,
    athlete_edited: current.athlete_edited,
    original_subject: current.original_subject,
    original_content: current.original_content,
    replaced_at: now.toISOString(),
  }
  return {
    subject: next.subject,
    content: next.content,
    athlete_edited: false,
    original_subject: null,
    original_content: null,
    previous_versions: [...(current.previous_versions ?? []), replaced],
  }
}
