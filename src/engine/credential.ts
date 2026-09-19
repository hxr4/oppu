import {
  b64u, checkPhrase, concat, exportPublic, hex, importPublic, keyId, randomBytes,
  readU32, sha256, sign, u32, unb64u, verify,
} from './crypto';

export const VERSION = 2;
export const BUCKET_SECONDS = 30;
export const BUCKET_TOLERANCE = 2;

/**
 * How stale a signed status token may be before a scanner stops accepting it.
 * This is the dial that trades student convenience against how long a revoked
 * pass can keep working: seven days means a student must touch a network once a
 * week, and a revocation reaches every bus in the state within a week without
 * anybody distributing a list.
 */
export const MAX_STATUS_AGE_DAYS = 7;

export const BODY_LEN = 97;
export const SIG_LEN = 64;
export const STATUS_LEN = 4 + SIG_LEN;
export const PROOF_LEN = BODY_LEN + SIG_LEN + STATUS_LEN + 4 + SIG_LEN;

const OFF_ISSUER_SIG = BODY_LEN;
const OFF_STATUS_DAY = OFF_ISSUER_SIG + SIG_LEN;
const OFF_STATUS_SIG = OFF_STATUS_DAY + 4;
const OFF_BUCKET = OFF_STATUS_SIG + SIG_LEN;
const OFF_DEVICE_SIG = OFF_BUCKET + 4;

export const SERVICE_CLASSES = ['Ordinary', 'Limited stop', 'Fast passenger', 'Super fast', 'Long distance'] as const;
export type ServiceClass = (typeof SERVICE_CLASSES)[number];

export interface Institution {
  code: string;
  name: string;
  district: string;
  keyIdHex: string;
  publicRaw: Uint8Array;
  rootSignature: Uint8Array;
  privateKey?: CryptoKey;
}

export interface Conductor {
  id: string;
  depotCode: string;
  keyIdHex: string;
  publicRaw: Uint8Array;
  rootSignature: Uint8Array;
}

export interface TrustList {
  rootPublicRaw: Uint8Array;
  institutions: Institution[];
  conductors: Conductor[];
}

export interface CredentialFields {
  serial: Uint8Array;
  instKeyId: Uint8Array;
  pseudonym: Uint8Array;
  validFromDay: number;
  validToDay: number;
  classMask: number;
  homeDepot: number;
  instDepot: number;
  devicePublicRaw: Uint8Array;
}

export interface IssuedCredential {
  fields: CredentialFields;
  body: Uint8Array;
  issuerSignature: Uint8Array;
}

/** A short-lived "not revoked as of this day" statement, signed by the institution. */
export interface StatusToken {
  day: number;
  signature: Uint8Array;
}

export const DAY_MS = 86_400_000;
export const dayNumber = (ms: number): number => Math.floor(ms / DAY_MS);
export const dayToDate = (d: number): Date => new Date(d * DAY_MS);
export const currentBucket = (ms: number): number => Math.floor(ms / 1000 / BUCKET_SECONDS);

export function classMaskFor(classes: ServiceClass[]): number {
  return classes.reduce((m, c) => m | (1 << SERVICE_CLASSES.indexOf(c)), 0);
}

export function classesIn(mask: number): ServiceClass[] {
  return SERVICE_CLASSES.filter((_, i) => mask & (1 << i));
}

export function encodeBody(f: CredentialFields): Uint8Array {
  return concat(
    new Uint8Array([VERSION]),
    f.serial,
    f.instKeyId,
    f.pseudonym,
    u32(f.validFromDay),
    u32(f.validToDay),
    new Uint8Array([f.classMask, f.homeDepot, f.instDepot]),
    f.devicePublicRaw,
  );
}

export function decodeBody(body: Uint8Array): CredentialFields {
  return {
    serial: body.slice(1, 9),
    instKeyId: body.slice(9, 13),
    pseudonym: body.slice(13, 21),
    validFromDay: readU32(body, 21),
    validToDay: readU32(body, 25),
    classMask: body[29],
    homeDepot: body[30],
    instDepot: body[31],
    devicePublicRaw: body.slice(32, 97),
  };
}

export const serialHex = (f: CredentialFields): string => hex(f.serial, 4).toUpperCase();

function hexToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function issueCredential(opts: {
  institution: Institution;
  institutionPrivate: CryptoKey;
  devicePublicRaw: Uint8Array;
  validFromDay: number;
  validToDay: number;
  classes: ServiceClass[];
  homeDepot: number;
  instDepot: number;
  pseudonym?: Uint8Array;
}): Promise<IssuedCredential> {
  const fields: CredentialFields = {
    serial: randomBytes(8),
    instKeyId: hexToBytes(opts.institution.keyIdHex),
    pseudonym: opts.pseudonym ?? randomBytes(8),
    validFromDay: opts.validFromDay,
    validToDay: opts.validToDay,
    classMask: classMaskFor(opts.classes),
    homeDepot: opts.homeDepot,
    instDepot: opts.instDepot,
    devicePublicRaw: opts.devicePublicRaw,
  };
  const body = encodeBody(fields);
  const issuerSignature = await sign(opts.institutionPrivate, body);
  return { fields, body, issuerSignature };
}

export function statusMessage(serial: Uint8Array, day: number): Uint8Array {
  return concat(new Uint8Array([0x53]), serial, u32(day));
}

/**
 * Issued by the institution whenever the wallet has a network. A revoked
 * student simply stops receiving these, so no list of revoked serials has to
 * travel anywhere.
 */
export async function issueStatus(
  institutionPrivate: CryptoKey,
  serial: Uint8Array,
  day: number,
): Promise<StatusToken> {
  return { day, signature: await sign(institutionPrivate, statusMessage(serial, day)) };
}

/** The rotating proof the wallet renders: credential, status, the current half-minute, device signature. */
export async function makeProof(
  credential: IssuedCredential,
  status: StatusToken,
  devicePrivate: CryptoKey,
  atMs: number,
): Promise<Uint8Array> {
  const bucket = currentBucket(atMs);
  const bodyHash = await sha256(concat(credential.body, credential.issuerSignature));
  const deviceSignature = await sign(
    devicePrivate,
    concat(bodyHash, u32(status.day), u32(bucket)),
  );
  return concat(
    credential.body,
    credential.issuerSignature,
    u32(status.day),
    status.signature,
    u32(bucket),
    deviceSignature,
  );
}

export const proofToText = (proof: Uint8Array): string => `OPPU2:${b64u(proof)}`;

export function textToProof(text: string): Uint8Array | null {
  const t = text.trim();
  if (!t.startsWith('OPPU2:')) return null;
  try {
    const bytes = unb64u(t.slice(6));
    return bytes.length === PROOF_LEN ? bytes : null;
  } catch {
    return null;
  }
}

export interface RevocationDigest {
  epochDay: number;
  instKeyIdHex: string;
  serialsHex: string[];
  signature: Uint8Array;
}

export async function signRevocation(
  institution: Institution,
  privateKey: CryptoKey,
  serialsHex: string[],
  epochDay: number,
): Promise<RevocationDigest> {
  const payload = new TextEncoder().encode(`${epochDay}|${serialsHex.slice().sort().join(',')}`);
  return {
    epochDay,
    instKeyIdHex: institution.keyIdHex,
    serialsHex: [...serialsHex].sort(),
    signature: await sign(privateKey, payload),
  };
}

export type Reason =
  | 'ok'
  | 'malformed'
  | 'unknown_issuer'
  | 'forged_issuer'
  | 'tampered'
  | 'not_yet_valid'
  | 'expired'
  | 'revoked'
  | 'stale_status'
  | 'bad_status'
  | 'stale_proof'
  | 'wrong_device'
  | 'class_not_covered'
  | 'off_entitled_route';

export const REASON_TEXT: Record<Reason, string> = {
  ok: 'Valid concession pass',
  malformed: 'Not an OPPU pass',
  unknown_issuer: 'Issuing institution is not in the trust list on this device',
  forged_issuer: 'Institution key is not signed by the transport authority root',
  tampered: 'Credential does not match the institution signature',
  not_yet_valid: 'Academic year has not started for this pass',
  expired: 'Pass validity has ended',
  revoked: 'Pass was revoked by the institution',
  bad_status: 'Status token was not signed by the issuing institution',
  stale_status: 'Pass has not checked in with its institution recently enough',
  stale_proof: 'Proof is not from this moment — a screenshot or a saved image',
  wrong_device: 'Proof was not signed by the device this pass was issued to',
  class_not_covered: 'Concession does not cover this class of service',
  off_entitled_route: 'Boarding point is outside the entitled home-to-institution route',
};

export interface VerifyStep {
  n: number;
  title: string;
  detail: string;
  pass: boolean;
}

export interface VerifyResult {
  accepted: boolean;
  reason: Reason;
  steps: VerifyStep[];
  fields?: CredentialFields;
  institution?: Institution;
  phrase?: string;
  elapsedMs: number;
}

export interface VerifyContext {
  trust: TrustList;
  revocations: RevocationDigest[];
  nowMs: number;
  serviceClass: ServiceClass;
  boardingDepot?: number;
  routeCheck?: (home: number, inst: number, boarding: number) => boolean;
  clockNote?: string;
  maxStatusAgeDays?: number;
}

export async function verifyProof(proof: Uint8Array, ctx: VerifyContext): Promise<VerifyResult> {
  const t0 = performance.now();
  const steps: VerifyStep[] = [];
  const add = (title: string, detail: string, pass: boolean): void => {
    steps.push({ n: steps.length + 1, title, detail, pass });
  };
  const done = (): number => Number((performance.now() - t0).toFixed(2));
  const fail = (reason: Reason, fields?: CredentialFields, institution?: Institution): VerifyResult => ({
    accepted: false, reason, steps, fields, institution, elapsedMs: done(),
  });

  if (proof.length !== PROOF_LEN || proof[0] !== VERSION) {
    add('Read the proof', 'The scanned bytes are not an OPPU credential.', false);
    return fail('malformed');
  }
  const body = proof.slice(0, BODY_LEN);
  const issuerSignature = proof.slice(OFF_ISSUER_SIG, OFF_STATUS_DAY);
  const statusDay = readU32(proof, OFF_STATUS_DAY);
  const statusSignature = proof.slice(OFF_STATUS_SIG, OFF_BUCKET);
  const bucket = readU32(proof, OFF_BUCKET);
  const deviceSignature = proof.slice(OFF_DEVICE_SIG);
  const fields = decodeBody(body);
  add('Read the proof', `${PROOF_LEN} bytes, pass ${serialHex(fields)}.`, true);

  const wantId = hex(fields.instKeyId);
  const institution = ctx.trust.institutions.find((i) => i.keyIdHex === wantId);
  if (!institution) {
    add('Find the issuing institution', `Key ${wantId} is not in the trust list held on this device.`, false);
    return fail('unknown_issuer', fields);
  }
  add('Find the issuing institution', `${institution.name} (key ${wantId}).`, true);

  const rootKey = await importPublic(ctx.trust.rootPublicRaw);
  const instRecord = new TextEncoder().encode(`${institution.code}|${institution.name}|${b64u(institution.publicRaw)}`);
  if (!(await verify(rootKey, institution.rootSignature, instRecord))) {
    add('Check the institution against the root', 'The transport authority root has not signed this institution key.', false);
    return fail('forged_issuer', fields, institution);
  }
  add('Check the institution against the root', 'Institution key is countersigned by the transport authority root.', true);

  const instKey = await importPublic(institution.publicRaw);
  if (!(await verify(instKey, issuerSignature, body))) {
    add('Check the credential signature', 'A field in this credential has been altered since it was issued.', false);
    return fail('tampered', fields, institution);
  }
  add('Check the credential signature', 'Every field is exactly what the institution signed.', true);

  const today = dayNumber(ctx.nowMs);
  if (today < fields.validFromDay) {
    add('Check validity', `Valid only from ${dayToDate(fields.validFromDay).toLocaleDateString('en-IN')}.`, false);
    return fail('not_yet_valid', fields, institution);
  }
  if (today > fields.validToDay) {
    add('Check validity', `Expired on ${dayToDate(fields.validToDay).toLocaleDateString('en-IN')}.`, false);
    return fail('expired', fields, institution);
  }
  add('Check validity', `Within the academic year, to ${dayToDate(fields.validToDay).toLocaleDateString('en-IN')}.`, true);

  if (!(await verify(instKey, statusSignature, statusMessage(fields.serial, statusDay)))) {
    add('Check the status token', 'The status token does not carry this institution’s signature over this serial.', false);
    return fail('bad_status', fields, institution);
  }
  const maxAge = ctx.maxStatusAgeDays ?? MAX_STATUS_AGE_DAYS;
  const age = today - statusDay;
  if (age > maxAge || age < -1) {
    add(
      'Check the status token',
      age < 0
        ? 'The status token is dated in the future.'
        : `Last confirmed by ${institution.name} ${age} days ago; a pass must check in every ${maxAge} days.`,
      false,
    );
    return fail('stale_status', fields, institution);
  }
  add(
    'Check the status token',
    `${institution.name} confirmed this pass was not revoked ${age <= 0 ? 'today' : `${age} day${age === 1 ? '' : 's'} ago`}.`,
    true,
  );

  const serial = serialHex(fields);
  for (const digest of ctx.revocations) {
    if (digest.instKeyIdHex !== institution.keyIdHex) continue;
    const payload = new TextEncoder().encode(`${digest.epochDay}|${digest.serialsHex.join(',')}`);
    if (!(await verify(instKey, digest.signature, payload))) continue;
    if (digest.serialsHex.includes(serial)) {
      add('Check the emergency revocation list', `Pass ${serial} appears in the signed list of ${dayToDate(digest.epochDay).toLocaleDateString('en-IN')}.`, false);
      return fail('revoked', fields, institution);
    }
  }
  add('Check the emergency revocation list', 'Not named in the signed same-day list held on this device.', true);

  const now = currentBucket(ctx.nowMs);
  const drift = Math.abs(now - bucket);
  if (drift > BUCKET_TOLERANCE) {
    const seconds = drift * BUCKET_SECONDS;
    add('Check the proof is from now', `Proof was minted ${seconds < 120 ? `${seconds} s` : `${Math.round(seconds / 60)} min`} ago. A live pass reissues every ${BUCKET_SECONDS} s.${ctx.clockNote ? ` ${ctx.clockNote}` : ''}`, false);
    return fail('stale_proof', fields, institution);
  }
  add('Check the proof is from now', `Minted within the last ${(drift + 1) * BUCKET_SECONDS} s.${ctx.clockNote ? ` ${ctx.clockNote}` : ''}`, true);

  const deviceKey = await importPublic(fields.devicePublicRaw);
  const bodyHash = await sha256(concat(body, issuerSignature));
  if (!(await verify(deviceKey, deviceSignature, concat(bodyHash, u32(statusDay), u32(bucket))))) {
    add('Check the device that signed it', 'The private key for this pass did not sign this proof.', false);
    return fail('wrong_device', fields, institution);
  }
  add('Check the device that signed it', 'Signed by the non-extractable key held on the enrolled phone.', true);

  if (!(fields.classMask & (1 << SERVICE_CLASSES.indexOf(ctx.serviceClass)))) {
    add('Check the class of service', `Concession covers ${classesIn(fields.classMask).join(', ')} — this is a ${ctx.serviceClass.toLowerCase()} service.`, false);
    return fail('class_not_covered', fields, institution);
  }
  add('Check the class of service', `${ctx.serviceClass} is covered by this entitlement.`, true);

  if (ctx.boardingDepot !== undefined && ctx.routeCheck) {
    if (!ctx.routeCheck(fields.homeDepot, fields.instDepot, ctx.boardingDepot)) {
      add('Check the entitled route', 'Boarding point does not lie between the registered home and institution stops.', false);
      return fail('off_entitled_route', fields, institution);
    }
    add('Check the entitled route', 'Boarding point lies on the registered home-to-institution route.', true);
  }

  return {
    accepted: true,
    reason: 'ok',
    steps,
    fields,
    institution,
    phrase: await checkPhrase(proof),
    elapsedMs: done(),
  };
}

export { keyId, exportPublic };
