/**
 * Client-side identifiers.
 *
 * Attempts are written offline and synced later, so the *client* mints the id
 * that makes the sync idempotent (`client_attempt_id`). Replaying a queued batch
 * therefore cannot double-count an answer.
 */

const HEX = '0123456789abcdef';

/** Minimal shape of the platform CSPRNG; avoids depending on DOM lib types. */
interface CryptoLike {
  getRandomValues?<T extends Uint8Array>(array: T): T;
  randomUUID?(): string;
}

function platformCrypto(): CryptoLike | undefined {
  return (globalThis as { crypto?: CryptoLike }).crypto;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const cryptoObj = platformCrypto();
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

/** RFC 4122 version 4 UUID, using the platform CSPRNG when available. */
export function uuid(): string {
  const cryptoObj = platformCrypto();
  if (typeof cryptoObj?.randomUUID === 'function') return cryptoObj.randomUUID();

  const bytes = randomBytes(16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  let out = '';
  for (let i = 0; i < 16; i++) {
    const byte = bytes[i] ?? 0;
    out += HEX[byte >> 4]! + HEX[byte & 0x0f]!;
    if (i === 3 || i === 5 || i === 7 || i === 9) out += '-';
  }
  return out;
}

/** Human-shareable referral code: unambiguous alphabet, no vowels (no accidental words). */
const CODE_ALPHABET = '23456789BCDFGHJKLMNPQRSTVWXYZ';

export function referralCode(length = 8): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CODE_ALPHABET[(bytes[i] ?? 0) % CODE_ALPHABET.length];
  }
  return out;
}
