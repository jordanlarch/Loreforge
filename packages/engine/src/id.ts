/**
 * Sortable id generation. ULID-style: 48-bit timestamp prefix (lexicographically
 * sortable by creation time) + random suffix. Used for command ids and any
 * engine-generated identifiers. Not security-sensitive.
 */
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32

function encodeTime(time: number, length: number): string {
  let out = "";
  for (let i = length - 1; i >= 0; i--) {
    const mod = time % 32;
    out = ENCODING[mod] + out;
    time = (time - mod) / 32;
  }
  return out;
}

function randomChars(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ENCODING[Math.floor(Math.random() * 32)];
  }
  return out;
}

/** Generate a 26-char sortable id (10 time + 16 random). */
export function createId(): string {
  return encodeTime(Date.now(), 10) + randomChars(16);
}
