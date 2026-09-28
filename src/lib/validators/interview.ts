import { z } from 'zod'

const compensationAsk = z.enum([
  'product_only',
  'discount_plus_product',
  'product_plus_payment',
  'payment_required',
])

export const interviewSchema = z.object({
  interests: z
    .array(z.string().trim().min(1).max(200))
    .min(1, 'Share at least one genuine interest')
    .max(20),
  brands_used: z.array(z.string().trim().min(1).max(200)).max(20),
  what_matters: z.string().trim().max(2000),
  deal_preferences: z.object({
    low: compensationAsk,
    mid: compensationAsk,
    high: compensationAsk,
    notes: z.string().trim().max(1000).optional(),
  }),
})

export type InterviewInput = z.infer<typeof interviewSchema>

// Shape Claude must return when normalizing free text into category tags.
export const normalizedTagsSchema = z.object({
  category_tags: z.array(z.string().trim().min(1).max(50)).min(1).max(15),
  values: z.array(z.string().trim().min(1).max(60)).max(8).default([]),
})

const preferenceItem = z.string().trim().min(2, 'Too short').max(60, 'Keep each one under 60 characters')

// Edited on the Brands page ("What you're looking for").
export const searchPreferencesSchema = z.object({
  values: z.array(preferenceItem).max(8, 'Up to 8 values'),
  target_industries: z.array(preferenceItem).max(8, 'Up to 8 industries'),
})

export type SearchPreferences = z.infer<typeof searchPreferencesSchema>
