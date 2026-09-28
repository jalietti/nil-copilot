// Hand-authored to match supabase/migrations/.
// Replace with `supabase gen types typescript` output once a project is linked.

export type CitizenshipStatus =
  | 'us_citizen'
  | 'permanent_resident'
  | 'f1_visa'
  | 'other_visa'
  | 'prefer_not_to_say'

export type MatchStatus = 'suggested' | 'dismissed' | 'drafting' | 'contacted'

export type DealStatus =
  | 'draft'
  | 'sent'
  | 'reply_received'
  | 'negotiating'
  | 'agreed'
  | 'closed'
  | 'dead'

export type MessageDirection = 'outbound_draft' | 'inbound_pasted'

export type DiscoveryRunStatus = 'queued' | 'running' | 'completed' | 'failed'

export type Profile = {
  id: string
  full_name: string
  school: string | null
  sport: string | null
  division: string | null
  instagram_followers: number | null
  tiktok_followers: number | null
  other_followers: number | null
  citizenship_status: CitizenshipStatus | null
  visa_guidance_shown_at: string | null
  onboarding_completed_at: string | null
  invite_code: string | null
  created_at: string
  updated_at: string
}

export type Interview = {
  id: string
  athlete_id: string
  interests: string[]
  brands_used: string[]
  category_tags: string[]
  deal_preferences: Record<string, unknown>
  raw_answers: Record<string, unknown> | null
  voice_profile: string | null
  created_at: string
  updated_at: string
}

export type Brand = {
  id: string
  domain: string
  name: string
  description: string | null
  categories: string[]
  contact_email: string | null
  contact_checked_at: string | null
  source_urls: string[]
  discovered_via: string | null
  verified_at: string | null
  created_at: string
  updated_at: string
}

export type BrandMatch = {
  id: string
  athlete_id: string
  brand_id: string
  fit_reason: string
  status: MatchStatus
  // Added by the athlete (validated); private to their match.
  contact_email: string | null
  created_at: string
  updated_at: string
}

export type Deal = {
  id: string
  athlete_id: string
  brand_id: string
  status: DealStatus
  sent_at: string | null
  created_at: string
  updated_at: string
}

export type Message = {
  id: string
  deal_id: string
  direction: MessageDirection
  subject: string | null
  content: string
  athlete_edited: boolean
  // The copilot's generated text, kept once the athlete edits it.
  original_subject: string | null
  original_content: string | null
  // Versions replaced by "Try another version" (see draft-edits.ts).
  previous_versions: unknown[]
  created_at: string
}

export type DiscoveryRun = {
  id: string
  athlete_id: string
  status: DiscoveryRunStatus
  params: Record<string, unknown>
  brands_found: number
  matches_created: number
  error: string | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

// Service-role only (no anon/authenticated grants).
export type InviteCode = {
  code: string
  label: string | null
  max_uses: number | null
  uses: number
  revoked_at: string | null
  created_at: string
}

// Brand-level outcome facts (service role only; no athlete identity or text).
export type BrandOutcome = {
  brand_id: string
  any_reply: boolean
  any_agreed: boolean
  working_contact_email: string | null
  updated_at: string
}

// Owner-only (service role). One row per external API call.
export type ApiUsage = {
  id: number
  created_at: string
  provider: 'anthropic' | 'tavily'
  operation: string
  source: string
  call: string | null
  athlete_id: string | null
  discovery_run_id: string | null
  model: string | null
  input_tokens: number | null
  output_tokens: number | null
  urls_requested: number | null
  urls_succeeded: number | null
  credits: number | null
}

type TableSpec<Row, Required extends keyof Row = never> = {
  Row: Row
  Insert: Partial<Row> & Pick<Row, Required>
  Update: Partial<Row>
  Relationships: []
}

export interface Database {
  public: {
    Tables: {
      profiles: TableSpec<Profile, 'id'>
      interviews: TableSpec<Interview, 'athlete_id'>
      brands: TableSpec<Brand, 'domain' | 'name'>
      brand_matches: TableSpec<BrandMatch, 'athlete_id' | 'brand_id'>
      deals: TableSpec<Deal, 'athlete_id' | 'brand_id'>
      messages: TableSpec<Message, 'deal_id' | 'direction' | 'content'>
      discovery_runs: TableSpec<DiscoveryRun, 'athlete_id'>
      invite_codes: TableSpec<InviteCode, 'code'>
      brand_outcomes: TableSpec<BrandOutcome, 'brand_id'>
      api_usage: TableSpec<ApiUsage, 'provider' | 'operation' | 'source'>
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      citizenship_status: CitizenshipStatus
      match_status: MatchStatus
      deal_status: DealStatus
      message_direction: MessageDirection
      discovery_run_status: DiscoveryRunStatus
    }
    CompositeTypes: Record<string, never>
  }
}
