import { z } from 'zod'

const followerCount = z
  .number()
  .int()
  .min(0)
  .max(1_000_000_000)
  .nullable()

export const onboardingSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required').max(200),
  school: z.string().trim().min(1, 'School is required').max(200),
  sport: z.string().trim().min(1, 'Sport is required').max(100),
  division: z.string().trim().max(50).nullable(),
  instagram_followers: followerCount,
  tiktok_followers: followerCount,
  other_followers: followerCount,
  citizenship_status: z.enum([
    'us_citizen',
    'permanent_resident',
    'f1_visa',
    'other_visa',
    'prefer_not_to_say',
  ]),
})

export type OnboardingInput = z.infer<typeof onboardingSchema>
