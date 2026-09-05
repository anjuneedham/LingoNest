import { splitAmount, type Currency } from './currency';

/**
 * Marketplace commission (brief §38).
 *
 * Rates are tiered by lifetime lessons taught and are configuration, not code:
 * `DEFAULT_COMMISSION_TIERS` is only the fallback used before remote config
 * loads. Admin can edit `commission_tiers` in the database at any time.
 */

export interface CommissionTier {
  readonly minLessons: number;
  /** Inclusive upper bound; null means "and above". */
  readonly maxLessons: number | null;
  /** Basis points, so 2000 = 20 %. */
  readonly bps: number;
}

export const DEFAULT_COMMISSION_TIERS: readonly CommissionTier[] = [
  { minLessons: 0, maxLessons: 10, bps: 2500 },
  { minLessons: 11, maxLessons: 50, bps: 2000 },
  { minLessons: 51, maxLessons: 150, bps: 1800 },
  { minLessons: 151, maxLessons: null, bps: 1500 },
];

/** Rate that applies to a teacher who has taught `lessonsTaught` lessons. */
export function commissionBpsFor(
  lessonsTaught: number,
  tiers: readonly CommissionTier[] = DEFAULT_COMMISSION_TIERS,
): number {
  const sorted = [...tiers].sort((a, b) => a.minLessons - b.minLessons);
  let applicable = sorted[0]?.bps ?? 2000;
  for (const tier of sorted) {
    if (lessonsTaught >= tier.minLessons && (tier.maxLessons === null || lessonsTaught <= tier.maxLessons)) {
      applicable = tier.bps;
    }
  }
  return applicable;
}

export interface LessonEarnings {
  readonly priceMinor: number;
  readonly currency: Currency;
  readonly commissionBps: number;
  readonly platformFeeMinor: number;
  readonly teacherEarningsMinor: number;
}

/**
 * Break a lesson price into platform fee and teacher earnings.
 *
 * The same function runs in the Edge Function that creates the charge and in the
 * teacher's earnings preview, so the number a teacher is quoted before a lesson
 * is exactly what they are paid.
 */
export function lessonEarnings(input: {
  priceMinor: number;
  currency: Currency;
  lessonsTaught: number;
  tiers?: readonly CommissionTier[];
  /** Per-teacher negotiated override, in bps. */
  overrideBps?: number | null;
}): LessonEarnings {
  const bps = input.overrideBps ?? commissionBpsFor(input.lessonsTaught, input.tiers);
  const { feeMinor, netMinor } = splitAmount(input.priceMinor, bps);
  return {
    priceMinor: input.priceMinor,
    currency: input.currency,
    commissionBps: bps,
    platformFeeMinor: feeMinor,
    teacherEarningsMinor: netMinor,
  };
}

export interface PackageDefinition {
  readonly id: string;
  readonly lessonCount: number;
  readonly priceMinor: number;
  readonly currency: Currency;
}

/** Effective per-lesson price of a package, for the "save 12 %" badge. */
export function packagePerLessonMinor(pkg: PackageDefinition): number {
  if (pkg.lessonCount <= 0) return pkg.priceMinor;
  return Math.round(pkg.priceMinor / pkg.lessonCount);
}

export function packageSavingBps(pkg: PackageDefinition, singleLessonMinor: number): number {
  if (singleLessonMinor <= 0 || pkg.lessonCount <= 0) return 0;
  const full = singleLessonMinor * pkg.lessonCount;
  if (pkg.priceMinor >= full) return 0;
  return Math.round(((full - pkg.priceMinor) / full) * 10_000);
}

/** Apply a subscriber discount to a marketplace price. */
export function applyTutorDiscount(priceMinor: number, discountBps: number): number {
  if (discountBps <= 0) return priceMinor;
  const capped = Math.min(10_000, discountBps);
  return priceMinor - Math.floor((priceMinor * capped) / 10_000);
}

export interface EarningsSummary {
  readonly pendingMinor: number;
  readonly availableMinor: number;
  readonly lifetimeMinor: number;
  readonly thisMonthMinor: number;
  readonly currency: Currency;
  readonly lessonsThisMonth: number;
  readonly nextTierAtLessons: number | null;
  readonly nextTierBps: number | null;
}

/** What the teacher earnings screen shows, including their next commission tier. */
export function summariseEarnings(input: {
  pendingMinor: number;
  availableMinor: number;
  lifetimeMinor: number;
  thisMonthMinor: number;
  currency: Currency;
  lessonsThisMonth: number;
  lessonsTaught: number;
  tiers?: readonly CommissionTier[];
}): EarningsSummary {
  const tiers = [...(input.tiers ?? DEFAULT_COMMISSION_TIERS)].sort((a, b) => a.minLessons - b.minLessons);
  const next = tiers.find((t) => t.minLessons > input.lessonsTaught);
  return {
    pendingMinor: input.pendingMinor,
    availableMinor: input.availableMinor,
    lifetimeMinor: input.lifetimeMinor,
    thisMonthMinor: input.thisMonthMinor,
    currency: input.currency,
    lessonsThisMonth: input.lessonsThisMonth,
    nextTierAtLessons: next ? next.minLessons : null,
    nextTierBps: next ? next.bps : null,
  };
}
