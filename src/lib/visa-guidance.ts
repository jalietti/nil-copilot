import type { CitizenshipStatus } from './supabase/types'

export interface VisaGuidance {
  headline: string
  points: string[]
  disclaimer: string
}

const DISCLAIMER =
  'This is general information, not legal or immigration advice. Before accepting any NIL deal, talk to your Designated School Official (DSO) or international student office — decisions here can affect your visa status.'

// Real guidance, not silence: international athletes face immigration
// restrictions on NIL income that US athletes don't.
export function getVisaGuidance(status: CitizenshipStatus): VisaGuidance | null {
  switch (status) {
    case 'f1_visa':
      return {
        headline: 'NIL income on an F-1 visa needs real care before you sign anything.',
        points: [
          'F-1 status generally does not permit off-campus work or self-employment in the US, and most NIL activity (posting sponsored content, appearances, endorsements) counts as work when performed on US soil.',
          'Some international athletes structure NIL activity to be performed outside the US (e.g. content created and deals executed while home in your country) — whether that works depends on your specific situation.',
          'Passive arrangements are treated differently from active promotion, and the lines are genuinely blurry — this is exactly what your DSO is for.',
          'Do not sign or perform any deal this copilot helps you draft until your DSO or an immigration attorney has confirmed it is safe for your status.',
        ],
        disclaimer: DISCLAIMER,
      }
    case 'other_visa':
      return {
        headline: 'Your visa type determines whether you can accept NIL income in the US.',
        points: [
          'Work authorization rules differ by visa category; NIL activity performed in the US typically counts as work.',
          'Before pursuing any deal drafted here, confirm with your international student office or an immigration attorney that your visa permits it.',
        ],
        disclaimer: DISCLAIMER,
      }
    case 'prefer_not_to_say':
      return {
        headline: 'A note in case your status is relevant:',
        points: [
          'If you are in the US on a student or other visa, NIL income can have serious immigration consequences. We recommend checking with your international student office before accepting any deal.',
        ],
        disclaimer: DISCLAIMER,
      }
    case 'us_citizen':
    case 'permanent_resident':
      return null
  }
}
