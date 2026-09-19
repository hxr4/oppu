import assert from 'node:assert/strict';
import { concat, exportPublic, generateKeyPair, sha256, sign, u32 } from '../src/engine/crypto';
import {
  BODY_LEN, SIG_LEN, PROOF_LEN, currentBucket, dayNumber, encodeBody, decodeBody,
  makeProof, proofToText, textToProof, serialHex, verifyProof,
  type CredentialFields,
} from '../src/engine/credential';
import { buildWorld, revokeStudent } from '../src/engine/world';
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
  makeProof(student.credential, student.deviceKeys.privateKey, at);

it('a live pass is accepted', async () => {
  const r = await verifyProof(await live(), ctxFor({ boardingDepot: alice.homeDepot }));
  assert.equal(r.reason, 'ok');
  assert.equal(r.accepted, true);
  assert.ok(r.phrase && r.phrase.split(' ').length === 2);
});

it('the proof is the size the protocol claims', async () => {
  const proof = await live();
  assert.equal(proof.length, PROOF_LEN);
  assert.equal(PROOF_LEN, 229);
  assert.ok(proofToText(proof).length < 340);
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
  const badSig = await sign(impostor.privateKey, concat(bodyHash, u32(bucket)));
  const forged = concat(alice.credential.body, alice.credential.issuerSignature, u32(bucket), badSig);
  const r = await verifyProof(forged, ctxFor({ boardingDepot: alice.homeDepot }));
  assert.equal(r.reason, 'wrong_device');
});

it('editing the expiry date breaks the institution signature', async () => {
  const proof = await live();
  const fields: CredentialFields = { ...alice.credential.fields, validToDay: alice.credential.fields.validToDay + 365 };
  const forged = concat(encodeBody(fields), proof.slice(BODY_LEN, BODY_LEN + SIG_LEN), proof.slice(BODY_LEN + SIG_LEN));
  const r = await verifyProof(forged, ctxFor({ boardingDepot: alice.homeDepot }));
  assert.equal(r.reason, 'tampered');
});

it('a college the authority never signed is rejected', async () => {
  const rogue = await generateKeyPair(true);
  const device = await generateKeyPair(true);
  const fields: CredentialFields = { ...alice.credential.fields, devicePublicRaw: await exportPublic(device.publicKey) };
  const body = encodeBody(fields);
  const issuerSig = await sign(rogue.privateKey, body);
  const bucket = currentBucket(Date.now());
  const devSig = await sign(device.privateKey, concat(await sha256(concat(body, issuerSig)), u32(bucket)));
  const r = await verifyProof(concat(body, issuerSig, u32(bucket), devSig), ctxFor({ boardingDepot: alice.homeDepot }));
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

it('revocation takes effect with no network', async () => {
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
  junk[0] = 1;
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
    ts: now + minutes * 60_000, conductorId: 'X', signatureB64: 'x', synced: true,
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
    ts: day.getTime() + i * 90 * 60_000, conductorId: 'X', signatureB64: 'x', synced: true,
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
