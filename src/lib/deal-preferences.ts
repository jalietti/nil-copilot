// V1 "good deal" logic: athlete-stated preference per brand tier
// (follower count x product value). No external market comp data.

export type FollowerTier = 'nano' | 'micro' | 'mid' | 'large'

export type ProductValueTier = 'low' | 'mid' | 'high'

export type CompensationAsk =
  | 'product_only'
  | 'discount_plus_product'
  | 'product_plus_payment'
  | 'payment_required'

export interface DealPreferences {
  low: CompensationAsk
  mid: CompensationAsk
  high: CompensationAsk
  notes?: string
}

export const COMPENSATION_ASK_LABELS: Record<CompensationAsk, string> = {
  product_only: 'Free product is enough',
  discount_plus_product: 'Discount plus product',
  product_plus_payment: 'Product plus a modest payment',
  payment_required: 'Real payment required',
}

export const PRODUCT_VALUE_TIER_LABELS: Record<ProductValueTier, string> = {
  low: 'Everyday products (under ~$100)',
  mid: 'Mid-range products (~$100–$500)',
  high: 'High-value products (over ~$500)',
}

export function totalFollowers(
  counts: { instagram?: number | null; tiktok?: number | null; other?: number | null },
): number {
  return (counts.instagram ?? 0) + (counts.tiktok ?? 0) + (counts.other ?? 0)
}

export function followerTier(total: number): FollowerTier {
  if (total < 1_000) return 'nano'
  if (total < 10_000) return 'micro'
  if (total < 100_000) return 'mid'
  return 'large'
}

export function productValueTier(estimatedUsd: number): ProductValueTier {
  if (estimatedUsd < 100) return 'low'
  if (estimatedUsd <= 500) return 'mid'
  return 'high'
}

export function askFor(prefs: DealPreferences, tier: ProductValueTier): CompensationAsk {
  return prefs[tier]
}
