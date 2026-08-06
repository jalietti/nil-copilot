import { Inngest } from 'inngest'

export const inngest = new Inngest({ id: 'nil-copilot' })

export interface DiscoverBrandsEvent {
  data: {
    athleteId: string
    runId: string
  }
}
