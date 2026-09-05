/**
 * The single source of truth for the product's identity.
 *
 * "LingoNest" is a working name. Everything user-visible resolves through this
 * object (or through the `brand.*` i18n keys that interpolate from it), so
 * renaming the product is a one-file change plus the app slug/scheme in
 * `apps/mobile/app.json`. Nothing else in the codebase may contain the product
 * name as a literal — CI greps for it.
 */
export interface BrandConfig {
  /** Product name as shown to users. */
  readonly name: string;
  /** Short name for tight spaces (tab bars, share cards). */
  readonly shortName: string;
  /** Legal entity used in policy documents and receipts. */
  readonly legalName: string;
  readonly tagline: string;
  readonly domain: string;
  readonly supportEmail: string;
  readonly privacyUrl: string;
  readonly termsUrl: string;
  /** Deep link scheme, must match app.json `scheme`. */
  readonly scheme: string;
  /** Used to namespace local storage keys so a rename does not orphan data. */
  readonly storagePrefix: string;
  readonly social: { readonly x?: string; readonly instagram?: string };
}

export const BRAND: BrandConfig = {
  name: 'LingoNest',
  shortName: 'LingoNest',
  legalName: 'LingoNest, Inc.',
  tagline: 'Learn. Practice. Connect.',
  domain: 'lingonest.app',
  supportEmail: 'support@lingonest.app',
  privacyUrl: 'https://lingonest.app/privacy',
  termsUrl: 'https://lingonest.app/terms',
  scheme: 'lingonest',
  storagePrefix: 'ln',
  social: {},
};

/** Namespaced storage key, e.g. `ln:session`. Survives a rebrand. */
export function storageKey(key: string): string {
  return `${BRAND.storagePrefix}:${key}`;
}

/** Values injected into i18n interpolation so locale files never hardcode the name. */
export function brandInterpolation(): Record<string, string> {
  return {
    brandName: BRAND.name,
    brandShortName: BRAND.shortName,
    brandTagline: BRAND.tagline,
    supportEmail: BRAND.supportEmail,
  };
}
