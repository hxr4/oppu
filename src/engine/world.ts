import {
  b64u,
  exportPublic,
  generateKeyPair,
  hex,
  importKeyPair,
  importPublic,
  keyId,
  randomBytes,
  sign,
  unb64u,
  verify,
} from './crypto';
import {
  MAX_STATUS_AGE_DAYS, dayNumber, issueCredential, issueStatus, serialHex, signRevocation,
  type Conductor, type Institution, type IssuedCredential, type RevocationDigest,
  type ServiceClass, type StatusToken, type TrustList,
} from './credential';
import { issueBeacon, type TimeBeacon } from './clock';
import { DEPOTS } from '../data/depots';
import { DEMO_ROOT, DEMO_INSTITUTIONS } from '../data/demo-keys';
import { haversineKm } from './geo';
import { fareFor, type Receipt } from './ledger';

export interface Student {
  id: string;
  name: string;
  malayalam: string;
  course: string;
  institutionCode: string;
  homeDepot: number;
  instDepot: number;
  classes: ServiceClass[];
  credential: IssuedCredential;
  deviceKeys: CryptoKeyPair;
  status: StatusToken;
  revoked: boolean;
}

export interface Rejection {
  serialHex: string;
  reason: string;
  ts: number;
  depot: number;
}

export interface World {
  version: 2;
  rootKeys: CryptoKeyPair;
  trust: TrustList;
  institutions: Institution[];
  students: Student[];
  receipts: Receipt[];
  rejections: Rejection[];
  revocations: RevocationDigest[];
  conductorKeys: CryptoKeyPair;
  conductor: Conductor;
  beacon: TimeBeacon;
  builtAt: number;
}

const depotIndex = (code: string): number => DEPOTS.findIndex((d) => d.code === code);

interface InstitutionSeed { code: string; name: string; district: string; depot: string }

/** Example institutions. The names are invented so that nothing here is a credential in any real college's name. */
const INSTITUTION_SEEDS: InstitutionSeed[] = [
  { code: 'CHT', name: 'Chithira Arts and Science College', district: 'Ernakulam', depot: 'MVP' },
  { code: 'NLP', name: 'Neelambari Polytechnic', district: 'Thrissur', depot: 'TSR' },
  { code: 'PLM', name: 'Palliyara Higher Secondary School', district: 'Kozhikode', depot: 'TMR' },
  { code: 'VYN', name: 'Vayanad Institute of Engineering', district: 'Wayanad', depot: 'KLP' },
];

interface StudentSeed {
  name: string; malayalam: string; course: string; inst: string; home: string;
  classes: ServiceClass[]; statusAgeDays?: number;
}

const STUDENT_SEEDS: StudentSeed[] = [
  { name: 'Aparna Ravindran', malayalam: 'അപർണ രവീന്ദ്രൻ', course: 'BSc Computer Science, year 2', inst: 'CHT', home: 'KTG', classes: ['Ordinary', 'Limited stop'] },
  { name: 'Fahad Nazeer', malayalam: 'ഫഹദ് നസീർ', course: 'Diploma in Mechanical, year 3', inst: 'NLP', home: 'IJK', classes: ['Ordinary'] },
  { name: 'Meenakshi Prasad', malayalam: 'മീനാക്ഷി പ്രസാദ്', course: 'Plus Two, Science', inst: 'PLM', home: 'KYL', classes: ['Ordinary', 'Limited stop'] },
  { name: 'Joel Thomas', malayalam: 'ജോയൽ തോമസ്', course: 'BTech Civil, year 1', inst: 'VYN', home: 'SBY', classes: ['Ordinary', 'Limited stop', 'Fast passenger'] },
  { name: 'Ayisha Beevi', malayalam: 'ആയിഷ ബീവി', course: 'BCom, year 3', inst: 'CHT', home: 'PBR', classes: ['Ordinary'] },
  { name: 'Sreehari Menon', malayalam: 'ശ്രീഹരി മേനോൻ', course: 'Diploma in Electronics, year 2', inst: 'NLP', home: 'CKD', classes: ['Ordinary', 'Limited stop'], statusAgeDays: MAX_STATUS_AGE_DAYS + 3 },
];

export async function buildWorld(nowMs = Date.now()): Promise<World> {
  const rootKeys = await importKeyPair(
    DEMO_ROOT.priv,
    DEMO_ROOT.pub,
  );
  const rootPublicRaw = await exportPublic(rootKeys.publicKey);

  const institutions: Institution[] = [];
  for (const seed of INSTITUTION_SEEDS) {
    const keys = await importKeyPair(
      DEMO_INSTITUTIONS[seed.code as keyof typeof DEMO_INSTITUTIONS].priv,
      DEMO_INSTITUTIONS[seed.code as keyof typeof DEMO_INSTITUTIONS].pub,
    );
    const publicRaw = await exportPublic(keys.publicKey);
    const id = await keyId(publicRaw);
    const record = new TextEncoder().encode(`${seed.code}|${seed.name}|${b64u(publicRaw)}`);
    institutions.push({
      code: seed.code,
      name: seed.name,
      district: seed.district,
      keyIdHex: hex(id),
      publicRaw,
      rootSignature: await sign(rootKeys.privateKey, record),
      privateKey: keys.privateKey,
    });
  }

  const conductorKeys = await generateKeyPair(false);
  const conductorPublicRaw = await exportPublic(conductorKeys.publicKey);
  const conductor: Conductor = {
    id: 'TMR/CND/1184',
    depotCode: 'TMR',
    keyIdHex: hex(await keyId(conductorPublicRaw)),
    publicRaw: conductorPublicRaw,
    rootSignature: await sign(
      rootKeys.privateKey,
      new TextEncoder().encode(`TMR|TMR/CND/1184|${b64u(conductorPublicRaw)}`),
    ),
  };

  const trust: TrustList = { rootPublicRaw, institutions, conductors: [conductor] };
  const today = dayNumber(nowMs);
  const yearStart = today - 96;
  const yearEnd = today + 188;

  const students: Student[] = [];
  for (const seed of STUDENT_SEEDS) {
    const institution = institutions.find((i) => i.code === seed.inst)!;
    const instSeed = INSTITUTION_SEEDS.find((i) => i.code === seed.inst)!;
    const deviceKeys = await generateKeyPair(false);
    const devicePublicRaw = await exportPublic(deviceKeys.publicKey);
    const credential = await issueCredential({
      institution,
      institutionPrivate: institution.privateKey!,
      devicePublicRaw,
      validFromDay: yearStart,
      validToDay: yearEnd,
      classes: seed.classes,
      homeDepot: depotIndex(seed.home),
      instDepot: depotIndex(instSeed.depot),
    });
    const statusDay = today - (seed.statusAgeDays ?? Math.floor(Math.random() * 3));
    students.push({
      id: `S-${students.length + 1}`,
      name: seed.name,
      malayalam: seed.malayalam,
      course: seed.course,
      institutionCode: seed.inst,
      homeDepot: depotIndex(seed.home),
      instDepot: depotIndex(instSeed.depot),
      classes: seed.classes,
      credential,
      deviceKeys,
      status: await issueStatus(institution.privateKey!, credential.fields.serial, statusDay),
      revoked: false,
    });
  }

  const world: World = {
    version: 2,
    rootKeys,
    trust,
    institutions,
    students,
    receipts: [],
    rejections: [],
    revocations: [],
    conductorKeys,
    conductor,
    beacon: await issueBeacon(rootKeys.privateKey, nowMs),
    builtAt: nowMs,
  };

  await seedHistory(world, nowMs);
  return world;
}

async function seedHistory(world: World, nowMs: number): Promise<void> {
  let s = 90210077;
  const rnd = (): number => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  const push = async (student: Student, boardingDepot: number, ts: number, cls: ServiceClass): Promise<void> => {
    await recordReceipt(world, student, boardingDepot, cls, ts, rnd() > 0.12, false);
  };

  for (let day = 8; day >= 0; day--) {
    const date = new Date(nowMs - day * 86_400_000);
    if (date.getDay() === 0) continue;
    for (const student of world.students) {
      const trips = rnd() < 0.82 ? 2 : rnd() < 0.5 ? 1 : 0;
      for (let t = 0; t < trips; t++) {
        const morning = t === 0;
        const boarding = morning ? student.homeDepot : student.instDepot;
        const hour = morning ? 7 + rnd() * 1.5 : 15.5 + rnd() * 2;
        const ts = new Date(date).setHours(Math.floor(hour), Math.floor((hour % 1) * 60), 0, 0);
        await push(student, boarding, ts, student.classes[0]);
      }
    }
  }

  const lender = world.students[2];
  const base = nowMs - 2 * 86_400_000;
  await push(lender, lender.homeDepot, new Date(base).setHours(8, 5, 0, 0), 'Ordinary');
  await push(lender, depotIndex('KTM'), new Date(base).setHours(8, 40, 0, 0), 'Ordinary');
  await push(lender, lender.instDepot, new Date(base).setHours(16, 10, 0, 0), 'Ordinary');
  await push(lender, lender.homeDepot, new Date(base).setHours(18, 45, 0, 0), 'Ordinary');

  const hounded = world.students[4];
  for (let i = 0; i < 4; i++) {
    world.rejections.push({
      serialHex: serialHex(hounded.credential.fields),
      reason: 'stale_proof',
      ts: nowMs - (i + 1) * 5 * 3_600_000,
      depot: hounded.homeDepot,
    });
  }

  world.receipts.sort((a, b) => b.ts - a.ts);
}

export function receiptMessage(r: Omit<Receipt, 'signatureB64'>): Uint8Array {
  return new TextEncoder().encode(
    `OPPU-RCPT|${r.serialHex}|${r.instCode}|${r.boardingDepot}|${r.serviceClass}|${Math.round(r.ts / 1000)}|${r.fareConcession}|${r.subsidy}|${r.conductorId}`,
  );
}

export async function recordReceipt(
  world: World,
  student: Student,
  boardingDepot: number,
  cls: ServiceClass,
  atMs = Date.now(),
  synced = false,
  unshift = true,
): Promise<Receipt> {
  const km = Math.max(3, haversineKm(DEPOTS[boardingDepot], DEPOTS[student.instDepot]) * 1.3);
  const fare = fareFor(km, cls);
  const draft: Omit<Receipt, 'signatureB64'> = {
    id: `R-${world.receipts.length + 1}`,
    serialHex: serialHex(student.credential.fields),
    instCode: student.institutionCode,
    boardingDepot,
    serviceClass: cls,
    km: Number(km.toFixed(1)),
    fareOrdinary: fare.ordinary,
    fareConcession: fare.concession,
    subsidy: fare.subsidy,
    ts: atMs,
    conductorId: world.conductor.id,
    conductorKeyIdHex: world.conductor.keyIdHex,
    synced,
  };
  const receipt: Receipt = {
    ...draft,
    signatureB64: b64u(await sign(world.conductorKeys.privateKey, receiptMessage(draft))),
  };
  if (unshift) world.receipts.unshift(receipt);
  else world.receipts.push(receipt);
  return receipt;
}

export interface ReceiptAudit {
  total: number;
  verified: number;
  failed: string[];
  elapsedMs: number;
}

/**
 * The whole point of signing receipts: an audit is a signature check over the
 * batch, not an inspection of a depot's paperwork.
 */
export async function auditReceipts(world: World): Promise<ReceiptAudit> {
  const t0 = performance.now();
  const byKey = new Map<string, CryptoKey>();
  for (const c of world.trust.conductors) byKey.set(c.keyIdHex, await importPublic(c.publicRaw));
  const failed: string[] = [];
  let verified = 0;
  for (const r of world.receipts) {
    const key = byKey.get(r.conductorKeyIdHex);
    if (!key) {
      failed.push(r.id);
      continue;
    }
    const { signatureB64, ...draft } = r;
    if (await verify(key, unb64u(signatureB64), receiptMessage(draft))) verified += 1;
    else failed.push(r.id);
  }
  return {
    total: world.receipts.length,
    verified,
    failed,
    elapsedMs: Number((performance.now() - t0).toFixed(1)),
  };
}

export async function refreshStatus(world: World, student: Student, nowMs = Date.now()): Promise<boolean> {
  if (student.revoked) return false;
  const institution = world.institutions.find((i) => i.code === student.institutionCode)!;
  student.status = await issueStatus(
    institution.privateKey!,
    student.credential.fields.serial,
    dayNumber(nowMs),
  );
  return true;
}

async function resignDigest(world: World, institution: Institution, nowMs: number): Promise<void> {
  const serials = world.students
    .filter((st) => st.revoked && st.institutionCode === institution.code)
    .map((st) => serialHex(st.credential.fields));
  world.revocations = world.revocations.filter((d) => d.instKeyIdHex !== institution.keyIdHex);
  if (serials.length) {
    world.revocations.push(
      await signRevocation(institution, institution.privateKey!, serials, dayNumber(nowMs)),
    );
  }
}

export async function revokeStudent(world: World, student: Student, nowMs = Date.now()): Promise<void> {
  student.revoked = true;
  const institution = world.institutions.find((i) => i.code === student.institutionCode)!;
  await resignDigest(world, institution, nowMs);
}

export async function restoreStudent(world: World, student: Student, nowMs = Date.now()): Promise<void> {
  student.revoked = false;
  const institution = world.institutions.find((i) => i.code === student.institutionCode)!;
  await resignDigest(world, institution, nowMs);
  await refreshStatus(world, student, nowMs);
}

export function trustBundleBytes(world: World): number {
  const institutions = world.trust.institutions.length * (65 + 64 + 24);
  const conductors = world.trust.conductors.length * (65 + 64 + 20);
  const revocations = world.revocations.reduce((n, d) => n + 64 + 4 + d.serialsHex.length * 8, 0);
  return 65 + 64 + institutions + conductors + revocations;
}

export { unb64u, randomBytes };
