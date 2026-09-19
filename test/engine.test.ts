import assert from 'node:assert/strict';
import { concat, exportPublic, generateKeyPair, sha256, sign, u32 } from '../src/engine/crypto';
import {
  BODY_LEN, MAX_STATUS_AGE_DAYS, SIG_LEN, STATUS_LEN, PROOF_LEN, currentBucket, dayNumber,
  encodeBody, decodeBody, issueStatus, makeProof, proofToText, textToProof, serialHex, verifyProof,
  type CredentialFields, type StatusToken,
} from '../src/engine/credential';
import { auditReceipts, buildWorld, refreshStatus, revokeStudent } from '../src/engine/world';
import { DeviceClock, issueBeacon, verifyBeacon } from '../src/engine/clock';
import { project, revocationCurve } from '../src/engine/scale';
import { onEntitledRoute } from '../src/engine/entitlement';
import { fareFor, findAnomalies, reconcile, type Receipt } from '../src/engine/ledger';
import { DEPOTS } from '../src/data/depots';

let pass = 0;
const checks: { name: string; fn: () => Promise<void> | void }[] = [];
const it = (name: string, fn: () => Promise<void> | void): void => { checks.push({ name, fn }); };

const world = await buildWorld();
const ctxFor = (over: Partial<Parameters<typeof verifyProof>[1]> = {}): Parameters<typeof verifyProof>[1] => ({
  trust: world.trust,
  revocations: world.revocations,
  nowMs: Date.now(),
  serviceClass: 'Ordinary',
  routeCheck: onEntitledRoute,
  ...over,
});

const alice = world.students[0];
const live = async (student = alice, at = Date.now()): Promise<Uint8Array> =>
  makeProof(student.credential, student.status, student.deviceKeys.privateKey, at);

it('a live pass is accepted', async () => {
  const r = await verifyProof(await live(), ctxFor({ boardingDepot: alice.homeDepot }));
  assert.equal(r.reason, 'ok');
  assert.equal(r.accepted, true);
  assert.ok(r.phrase && r.phrase.split(' ').length === 2);
});

it('the proof is the size the protocol claims', async () => {
  const proof = await live();
  assert.equal(proof.length, PROOF_LEN);
  assert.equal(PROOF_LEN, 297);
  assert.equal(STATUS_LEN, 68);
  assert.ok(proofToText(proof).length < 410);
});

it('proof text round-trips', async () => {
  const proof = await live();
  const back = textToProof(proofToText(proof));
  assert.ok(back);
  assert.deepEqual([...back!], [...proof]);
  assert.equal(textToProof('not a pass'), null);
});

it('body encoding round-trips every field', () => {
  const f = alice.credential.fields;
  const again = decodeBody(encodeBody(f));
  assert.equal(serialHex(again), serialHex(f));
  assert.equal(again.validToDay, f.validToDay);
  assert.equal(again.classMask, f.classMask);
  assert.equal(again.homeDepot, f.homeDepot);
  assert.deepEqual([...again.devicePublicRaw], [...f.devicePublicRaw]);
});

it('a screenshot from nine minutes ago is rejected', async () => {
  const r = await verifyProof(await live(alice, Date.now() - 9 * 60_000), ctxFor({ boardingDepot: alice.homeDepot }));
  assert.equal(r.reason, 'stale_proof');
});

it('a proof a few seconds old is still accepted', async () => {
  const r = await verifyProof(await live(alice, Date.now() - 20_000), ctxFor({ boardingDepot: alice.homeDepot }));
  assert.equal(r.accepted, true);
});

it('the credential copied onto another device is rejected', async () => {
  const impostor = await generateKeyPair(true);
  const bucket = currentBucket(Date.now());
  const bodyHash = await sha256(concat(alice.credential.body, alice.credential.issuerSignature));
  const badSig = await sign(impostor.privateKey, concat(bodyHash, u32(alice.status.day), u32(bucket)));
  const forged = concat(
    alice.credential.body, alice.credential.issuerSignature,
    u32(alice.status.day), alice.status.signature, u32(bucket), badSig,
  );
  const r = await verifyProof(forged, ctxFor({ boardingDepot: alice.homeDepot }));
  assert.equal(r.reason, 'wrong_device');
});

it('editing the expiry date breaks the institution signature', async () => {
  const proof = await live();
  const fields: CredentialFields = { ...alice.credential.fields, validToDay: alice.credential.fields.validToDay + 365 };
  const forged = concat(encodeBody(fields), proof.slice(BODY_LEN));
  const r = await verifyProof(forged, ctxFor({ boardingDepot: alice.homeDepot }));
  assert.equal(r.reason, 'tampered');
});

it('a college the authority never signed is rejected', async () => {
  const rogue = await generateKeyPair(true);
  const device = await generateKeyPair(true);
  const fields: CredentialFields = { ...alice.credential.fields, devicePublicRaw: await exportPublic(device.publicKey) };
  const body = encodeBody(fields);
  const issuerSig = await sign(rogue.privateKey, body);
  const day = dayNumber(Date.now());
  const status = await issueStatus(rogue.privateKey, fields.serial, day);
  const bucket = currentBucket(Date.now());
  const devSig = await sign(device.privateKey, concat(await sha256(concat(body, issuerSig)), u32(day), u32(bucket)));
  const r = await verifyProof(
    concat(body, issuerSig, u32(day), status.signature, u32(bucket), devSig),
    ctxFor({ boardingDepot: alice.homeDepot }),
  );
  assert.ok(r.reason === 'forged_issuer' || r.reason === 'tampered');
  assert.equal(r.accepted, false);
});

it('an expired pass is rejected', async () => {
  const r = await verifyProof(await live(), ctxFor({
    boardingDepot: alice.homeDepot,
    nowMs: Date.now() + 400 * 86_400_000,
  }));
  assert.equal(r.reason, 'expired');
});

it('emergency revocation takes effect with no network', async () => {
  const victim = world.students[3];
  const before = await verifyProof(await live(victim), ctxFor({ boardingDepot: victim.homeDepot }));
  assert.equal(before.accepted, true);
  await revokeStudent(world, victim);
  const after = await verifyProof(await live(victim), ctxFor({
    revocations: world.revocations,
    boardingDepot: victim.homeDepot,
  }));
  assert.equal(after.reason, 'revoked');
});

it('a revoked pass also dies by starvation, with no list distributed', async () => {
  const victim = world.students[3];
  assert.equal(victim.revoked, true);
  const refreshed = await refreshStatus(world, victim);
  assert.equal(refreshed, false, 'the institution must refuse to re-sign a revoked pass');
  const stale = await verifyProof(await live(victim), ctxFor({
    revocations: [],
    boardingDepot: victim.homeDepot,
    nowMs: Date.now() + (MAX_STATUS_AGE_DAYS + 2) * 86_400_000,
  }));
  assert.equal(stale.reason, 'stale_status');
});

it('a status token older than the window is refused', async () => {
  const inst = world.institutions.find((i) => i.code === alice.institutionCode)!;
  const old: StatusToken = await issueStatus(
    inst.privateKey!, alice.credential.fields.serial, dayNumber(Date.now()) - (MAX_STATUS_AGE_DAYS + 1),
  );
  const proof = await makeProof(alice.credential, old, alice.deviceKeys.privateKey, Date.now());
  const r = await verifyProof(proof, ctxFor({ boardingDepot: alice.homeDepot }));
  assert.equal(r.reason, 'stale_status');
});

it('a status token cannot be re-dated without the institution key', async () => {
  const inst = world.institutions.find((i) => i.code === alice.institutionCode)!;
  const old: StatusToken = await issueStatus(
    inst.privateKey!, alice.credential.fields.serial, dayNumber(Date.now()) - 40,
  );
  const relabelled: StatusToken = { day: dayNumber(Date.now()), signature: old.signature };
  const proof = await makeProof(alice.credential, relabelled, alice.deviceKeys.privateKey, Date.now());
  const r = await verifyProof(proof, ctxFor({ boardingDepot: alice.homeDepot }));
  assert.equal(r.reason, 'bad_status');
});

it('one student cannot borrow another student status token', async () => {
  const other = world.students[1];
  const proof = await makeProof(alice.credential, other.status, alice.deviceKeys.privateKey, Date.now());
  const r = await verifyProof(proof, ctxFor({ boardingDepot: alice.homeDepot }));
  assert.equal(r.reason, 'bad_status');
});

it('a signed time beacon survives a wrong device clock', async () => {
  const beacon = await issueBeacon(world.rootKeys.privateKey, Date.now());
  assert.equal(await verifyBeacon(world.trust.rootPublicRaw, beacon), true);
  const clock = new DeviceClock();
  clock.setSimulatedSkewMinutes(9);
  assert.ok(Math.abs(clock.osNow() - Date.now()) > 8 * 60_000);
  clock.adopt(beacon);
  assert.ok(Math.abs(clock.now() - Date.now()) < 2_000, 'beacon time must track real time');
  assert.ok(clock.driftSeconds() > 500);
  assert.ok((clock.note() ?? '').includes('9 min'));
});

it('a tampered beacon is rejected', async () => {
  const beacon = await issueBeacon(world.rootKeys.privateKey, Date.now());
  assert.equal(await verifyBeacon(world.trust.rootPublicRaw, { ...beacon, epochMs: Date.now() + 600_000 }), false);
});

it('every receipt verifies against an enrolled conductor device', async () => {
  const audit = await auditReceipts(world);
  assert.ok(audit.total > 50);
  assert.equal(audit.verified, audit.total);
  assert.equal(audit.failed.length, 0);
});

it('a receipt with an altered subsidy stops verifying', async () => {
  const tampered = { ...world.receipts[0], subsidy: world.receipts[0].subsidy + 50 };
  const saved = world.receipts[0];
  world.receipts[0] = tampered;
  const audit = await auditReceipts(world);
  world.receipts[0] = saved;
  assert.equal(audit.failed.length, 1);
});

it('the conductor device is countersigned by the authority root', () => {
  assert.equal(world.trust.conductors.length, 1);
  assert.equal(world.trust.conductors[0].rootSignature.length, SIG_LEN);
  assert.equal(world.receipts[0].conductorKeyIdHex, world.conductor.keyIdHex);
});

it('status tokens keep the bus payload flat as the state grows', () => {
  const p = project();
  assert.equal(p.statusRevocationBytesPerBus, 0);
  const curve = revocationCurve();
  assert.ok(curve[curve.length - 1].listKb > 500, 'a serial list at state scale is hundreds of kB');
  assert.ok(p.proofBytes < 320);
});

it('a class of service outside the entitlement is rejected', async () => {
  const r = await verifyProof(await live(world.students[1]), ctxFor({
    serviceClass: 'Super fast',
    boardingDepot: world.students[1].homeDepot,
  }));
  assert.equal(r.reason, 'class_not_covered');
});

it('boarding far off the entitled route is rejected', async () => {
  const far = DEPOTS.findIndex((d) => d.code === 'TVM');
  const r = await verifyProof(await live(), ctxFor({ boardingDepot: far }));
  assert.equal(r.reason, 'off_entitled_route');
});

it('the entitled route covers the line between home and institution', () => {
  const home = DEPOTS.findIndex((d) => d.code === 'KTG');
  const inst = DEPOTS.findIndex((d) => d.code === 'MVP');
  assert.equal(onEntitledRoute(home, inst, home), true);
  assert.equal(onEntitledRoute(home, inst, inst), true);
  assert.equal(onEntitledRoute(home, inst, DEPOTS.findIndex((d) => d.code === 'KSD')), false);
});

it('garbage bytes are rejected without throwing', async () => {
  const junk = new Uint8Array(PROOF_LEN);
  junk[0] = 2;
  const r = await verifyProof(junk, ctxFor());
  assert.equal(r.accepted, false);
  assert.equal(r.reason, 'unknown_issuer');
  const short = await verifyProof(new Uint8Array(12), ctxFor());
  assert.equal(short.reason, 'malformed');
});

it('every rejection carries a failing step the conductor can read', async () => {
  const r = await verifyProof(await live(alice, Date.now() - 20 * 60_000), ctxFor({ boardingDepot: alice.homeDepot }));
  assert.equal(r.accepted, false);
  const failing = r.steps.filter((s) => !s.pass);
  assert.equal(failing.length, 1);
  assert.ok(failing[0].detail.length > 10);
});

it('the fare model carries the difference as subsidy', () => {
  const near = fareFor(4, 'Ordinary');
  const far = fareFor(42, 'Ordinary');
  assert.equal(near.concession, far.concession);
  assert.ok(far.subsidy > near.subsidy);
  assert.equal(far.ordinary - far.concession, far.subsidy);
  assert.ok(fareFor(42, 'Super fast').ordinary > far.ordinary);
});

it('reconciliation sums what the receipts say', () => {
  const summary = reconcile(world.receipts);
  assert.equal(summary.boardings, world.receipts.length);
  assert.equal(
    summary.subsidy,
    world.receipts.reduce((n, r) => n + r.subsidy, 0),
  );
  assert.ok(summary.byInstitution.length > 1);
});

it('the same pass in two districts within the hour is flagged', () => {
  const now = Date.now();
  const mk = (depotCode: string, minutes: number): Receipt => ({
    id: `T-${minutes}`, serialHex: 'AAAA BBBB', instCode: 'CHT',
    boardingDepot: DEPOTS.findIndex((d) => d.code === depotCode),
    serviceClass: 'Ordinary', km: 10, fareOrdinary: 16, fareConcession: 6, subsidy: 10,
    ts: now + minutes * 60_000, conductorId: 'X', conductorKeyIdHex: 'ffffffff', signatureB64: 'x', synced: true,
  });
  const flags = findAnomalies([mk('KKD', 0), mk('TVM', 35)], []);
  assert.ok(flags.some((f) => f.kind === 'impossible_travel'));
});

it('a fourth trip on a two-trip entitlement is flagged', () => {
  const day = new Date();
  day.setHours(8, 0, 0, 0);
  const mk = (i: number): Receipt => ({
    id: `C-${i}`, serialHex: 'CCCC DDDD', instCode: 'NLP', boardingDepot: 0,
    serviceClass: 'Ordinary', km: 8, fareOrdinary: 14, fareConcession: 6, subsidy: 8,
    ts: day.getTime() + i * 90 * 60_000, conductorId: 'X', conductorKeyIdHex: 'ffffffff', signatureB64: 'x', synced: true,
  });
  const flags = findAnomalies([mk(0), mk(1), mk(2), mk(3)], []);
  assert.ok(flags.some((f) => f.kind === 'over_daily_cap'));
});

it('the trust anchor a bus carries stays small', () => {
  const bytes = 65 + world.trust.institutions.length * 153;
  assert.ok(bytes < 2048, `${bytes} bytes`);
  assert.ok(dayNumber(Date.now()) > 20000);
  assert.equal(SIG_LEN, 64);
});

for (const c of checks) {
  await c.fn();
  pass += 1;
  console.log(`  ok  ${c.name}`);
}
console.log(`\n${pass} checks passed`);
