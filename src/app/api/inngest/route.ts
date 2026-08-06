import { serve } from 'inngest/next'
import { inngest } from '@/inngest/client'
import { discoverBrands } from '@/inngest/functions/discover-brands'

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [discoverBrands],
})
