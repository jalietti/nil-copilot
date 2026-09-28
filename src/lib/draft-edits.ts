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
