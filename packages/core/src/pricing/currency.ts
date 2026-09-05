/** Supported billing currencies (brief §67). */
export const CURRENCIES = ['USD', 'CAD', 'GBP', 'EUR', 'AUD', 'JPY', 'MXN', 'BRL'] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Number of minor units per major unit exponent. JPY has none. */
const EXPONENT: Record<Currency, number> = {
  USD: 2,
  CAD: 2,
  GBP: 2,
  EUR: 2,
  AUD: 2,
  JPY: 0,
  MXN: 2,
  BRL: 2,
};

export const DEFAULT_CURRENCY: Currency = 'USD';

export function isCurrency(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

export function minorUnitExponent(currency: Currency): number {
  return EXPONENT[currency];
}

/** Convert a major-unit amount (12.50) into minor units (1250). */
export function toMinorUnits(amount: number, currency: Currency): number {
  return Math.round(amount * 10 ** EXPONENT[currency]);
}

export function toMajorUnits(minor: number, currency: Currency): number {
  return minor / 10 ** EXPONENT[currency];
}

/**
 * Format money for display. All amounts inside the system are integer minor
 * units; this is the only place they become a string.
 */
export function formatMoney(minor: number, currency: Currency, locale = 'en-US'): string {
  const exponent = EXPONENT[currency];
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(minor / 10 ** exponent);
}

/**
 * Split an amount into platform fee and recipient share without losing a cent.
 * The remainder always goes to the recipient (the teacher), never to us.
 */
export function splitAmount(totalMinor: number, feeBps: number): { feeMinor: number; netMinor: number } {
  if (totalMinor < 0) throw new RangeError('totalMinor must be non-negative');
  if (feeBps < 0 || feeBps > 10_000) throw new RangeError('feeBps must be between 0 and 10000');
  const feeMinor = Math.floor((totalMinor * feeBps) / 10_000);
  return { feeMinor, netMinor: totalMinor - feeMinor };
}
