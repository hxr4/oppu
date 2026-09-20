/**
 * Every signature in OPPU is ECDSA over NIST P-256 with SHA-256, produced and
 * checked by the browser's own WebCrypto implementation. Nothing here is a
 * stand-in: the keys are real CryptoKey objects, student device keys are
 * generated non-extractable, and verification is the same primitive a bank card
 * terminal uses.
 */

const ALG = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const SIGN = { name: 'ECDSA', hash: 'SHA-256' } as const;

export const subtle: SubtleCrypto = globalThis.crypto.subtle;

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

export function b64u(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64u(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function hex(bytes: Uint8Array, groups = 0): string {
  const s = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  if (!groups) return s;
  return (s.match(new RegExp(`.{1,${groups}}`, 'g')) ?? [s]).join(' ');
}

export function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

export function u32(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, false);
  return b;
}

export function readU32(b: Uint8Array, at: number): number {
  return new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(at, false);
}

export async function generateKeyPair(extractable = true): Promise<CryptoKeyPair> {
  return subtle.generateKey(ALG, extractable, ['sign', 'verify']) as Promise<CryptoKeyPair>;
}

export async function importKeyPair(
  priv: JsonWebKey,
  pub: JsonWebKey,
): Promise<CryptoKeyPair> {
  const privateKey = await subtle.importKey(
    'jwk',
    priv,
    ALG,
    true,
    ['sign'],
  );

  const publicKey = await subtle.importKey(
    'jwk',
    pub,
    ALG,
    true,
    ['verify'],
  );

  return { privateKey, publicKey };
}

export async function exportPublic(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await subtle.exportKey('raw', key));
}

export async function importPublic(raw: Uint8Array): Promise<CryptoKey> {
  return subtle.importKey('raw', raw as BufferSource, ALG, true, ['verify']);
}

export async function sign(priv: CryptoKey, data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle.sign(SIGN, priv, data as BufferSource));
}

export async function verify(pub: CryptoKey, sig: Uint8Array, data: Uint8Array): Promise<boolean> {
  return subtle.verify(SIGN, pub, sig as BufferSource, data as BufferSource);
}

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle.digest('SHA-256', data as BufferSource));
}

/** Short stable identifier for a public key, used to pick it out of the trust list. */
export async function keyId(publicRaw: Uint8Array): Promise<Uint8Array> {
  return (await sha256(publicRaw)).slice(0, 4);
}

const WORDS = [
  'anchor', 'basil', 'cardamom', 'delta', 'ember', 'fathom', 'ginger', 'harbour',
  'indigo', 'jasmine', 'kettle', 'lantern', 'mango', 'nutmeg', 'orchid', 'pepper',
  'quarry', 'rattan', 'saffron', 'teak', 'umbrella', 'vetiver', 'walnut', 'yarrow',
  'almond', 'bamboo', 'coral', 'dune', 'estuary', 'fern', 'granite', 'hibiscus',
];

/**
 * Two words derived from the exact bytes that were scanned. The wallet shows the
 * phrase for the proof it just rendered and the scanner shows the phrase for the
 * proof it just read; if they differ, the conductor is looking at a picture of
 * somebody else's screen.
 */
export async function checkPhrase(data: Uint8Array): Promise<string> {
  const d = await sha256(data);
  return `${WORDS[d[0] % WORDS.length]} ${WORDS[d[1] % WORDS.length]}`;
}
