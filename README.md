# OPPU — ഒപ്പ്

**A digital student concession pass for Kerala state buses that proves itself in about a millisecond with no network, and turns every boarding into an auditable subsidy record.**

Built for the ANAVANDI Hackathon 2026 selection round — **SC-01, Digital student concession pass (Track 1: Public Transport)**.
Team **SleepDeprived** — Harinarayanan R, Anamika Jaideep.

- Live: https://oppu-bice.vercel.app/
- Source: https://github.com/hxr4/oppu

---

## The problem, stated properly

A concession check happens on a moving bus, on a ghat road, at seven in the morning, in about two seconds. Everything that is wrong with the paper card follows from that moment:

- A laminated card is verified by a glance. A glance cannot tell a sibling from a student, a current card from last year's, or a colour photocopy from the real thing.
- The obvious fix — an app that phones a server — fails exactly where students are. There is no signal on the churam.
- And the money never gets counted. The concession is a subsidy the state owes the corporation, and today the claim is an estimate argued between them, because nobody has a per-boarding record anyone can audit.

A QR code on a screen solves none of this. A screenshot of a QR code is everybody's pass.

## The design

Four keys, three signatures, no lookup.

```
transport authority root ──signs──▶ institution key ──signs──▶ credential
                         └─signs──▶ conductor device                │ binds
                                                                    ▼
                                                              device key
                                                                    │ signs status + clock
                                                                    ▼
                                                     proof · 297 bytes · 30 s
```

- **The scanner trusts one key.** The transport authority root. Institution keys *and* conductor devices are countersigned by it, so adding a college is a signature, not a database migration — and a forged key fails on a bus with no network in sight.
- **The credential is signed by the institution.** Serial, pseudonym, validity window, entitled service classes, home stop, institution stop, and the student device's public key. Alter any field and the signature stops matching.
- **The proof rotates every 30 seconds.** The wallet signs the current half-minute with a key generated **non-extractable** inside the phone and kept in IndexedDB. A screenshot carries a stale signature. A credential copied into a friend's app carries the wrong key. Both are rejected by arithmetic, not by a conductor's judgement.
- **Revocation is starvation, not a list.** The pass carries a 68-byte token from its own institution saying "not revoked as of this day", refreshed whenever the wallet has a network; a scanner refuses anything older than seven days. Revoking a pass means declining to sign it again — nothing is distributed to anybody, and the bus carries the same two kilobytes whether Kerala has fifty thousand students or two million. A signed serial list survives, shrunk to its real job: same-day emergency revocation.
- **The scanner does not trust its own clock.** At each depot sync the authority hands the device a signed timestamp; the device then tells time by that beacon plus its own monotonic counter and treats the OS clock as a suggestion. A conductor phone nine minutes fast would otherwise reject a whole depot's students.
- **A two-word check phrase** derived from the exact bytes scanned appears on both screens, so a live relay of somebody else's screen does not match.
- **The conductor never learns a name.** A pseudonym, an institution and an entitlement is everything needed to decide the fare, and nothing that should be readable by a stranger on a bus.

### The ten checks, in order

| | Check | Rejects |
|---|---|---|
| 1 | Read the 297-byte proof | malformed input |
| 2 | Find the issuing institution in the trust list | a college the device has never been told about |
| 3 | Institution key countersigned by the root | a fake college issuing itself passes |
| 4 | Credential signature over every field | an edited expiry, route or class |
| 5 | Validity window against today | last year's pass |
| 6 | Status token signed by the institution, dated within 7 days | a revoked pass, with no list sent anywhere |
| 7 | Signed same-day emergency list | a pass revoked this morning |
| 8 | Proof minted within the last 30 s | screenshots and saved images |
| 9 | Device signature over status and clock | the credential copied into another app |
| 10 | Class of service and entitled route | super-fast misuse, weekend trips across the state |

Each check writes a line the conductor can read. A rejection is never "computer says no" — it is a sentence.

## The part that carries the money

Every acceptance writes a receipt signed by the conductor's enrolled device — pass serial, boarding stop, distance, fare collected, subsidy carried — queued offline and synced at the depot.

1. The subsidy claim becomes a **sum of signed receipts** instead of an estimate.
2. The audit becomes a **signature check over the batch** — the Scale tab runs it over the whole ledger and reports how long it took.
3. Fraud that offline verification *cannot* catch becomes visible as arithmetic at reconciliation: the same pass boarding in two districts 35 minutes apart, or a fourth trip on a two-trip entitlement.

Offline acceptance and central accountability are usually a trade-off. Signed receipts are how you get both.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 31 engine checks
npm run build    # single self-contained dist/index.html + service worker
```

Deploys to Vercel or Netlify as a static site (`vercel.json` included: build `npm run build`, output `dist`). There is no server, no database, no API key and no `.env` — every key is generated in the browser and never leaves it.

### Trying it in three minutes

1. **Student wallet** — watch the QR reissue every 30 seconds. Tap the code to blow it up and scan it with a second phone. Reload the page: the same device key, the same pass.
2. **Conductor** — *Read the pass in front of me*. Ten checks, a verdict, a queued receipt. Then set the device clock nine minutes fast and watch a valid pass fail; sync the signed depot time and watch it pass again.
3. **Attack bench** — eleven scenarios, each built from fresh keys at the moment you press the button and run through the same verifier. Nothing is scripted to fail.
4. **Institution** — revoke a pass, then try it on the bench.
5. **Subsidy ledger / Scale** — what the receipts add up to, the flags reconciliation found, a live verification benchmark, and the arithmetic behind the revocation design.
6. **Offline** — load the deployed site once, then turn the network off and reload. The service worker serves the shell; nothing else was ever needed.

## Layout

```
src/
  engine/crypto.ts        WebCrypto ECDSA P-256, base64url, key ids, check phrase
  engine/credential.ts    297-byte envelope, issuance, status tokens, the ten-step verifier
  engine/clock.ts         signed time beacon, monotonic device clock, drift reporting
  engine/vault.ts         IndexedDB store for non-extractable device keys
  engine/entitlement.ts   home-to-institution route geometry
  engine/ledger.ts        fares, subsidy, reconciliation, anomaly detection
  engine/scale.ts         byte and bandwidth projections at state scale
  engine/world.ts         trust list, issuance, conductor enrolment, receipt audit
  engine/qr.ts            bundled QR encode and decode — no CDN at runtime
  data/depots.ts          83 KSRTC depot towns, 12 corridors
  data/kerala-geo.ts      district polygons and projection
  ui/                     wallet, scanner, attack bench, institution, ledger, scale, method
public/                   service worker and web manifest
test/engine.test.ts       31 checks over crypto, verification, status, clock, ledger and scale
```

## What is real, and what is not

**Real.** Every signature is ECDSA P-256 with SHA-256 through the browser's own WebCrypto — nothing simulated. Student device keys are generated non-extractable and kept in IndexedDB, so a pass survives a reload with the same device identity and its private key never becomes serialisable. The QR carries the real envelope and is decoded by a bundled scanner. The attack bench builds each forgery live. The byte counts on the Scale tab are measured from the structures this build encodes. District boundaries and the 83 depot towns are real geography.

**Approximated.** Institutions and students are invented, so no credential here carries a real college's name. The fare table is illustrative; production reads the published KSRTC stage-fare table. Entitled-route geometry is a straight line between two depot towns with a tolerance, not the road. Student population and fleet size on the Scale tab are order-of-magnitude estimates, marked as such there. Seeded receipts are synthetic so the ledger opens with something in it.

**Known gaps.** The wallet's device key is not yet behind a biometric or PIN gate, so handing over an unlocked phone still works — that is the one attack the cryptography deliberately does not claim to stop, and it is caught later by impossible-travel flags in the ledger. There is no printed fallback for students without a smartphone: designed, not built. Key rotation and a root expiry are not implemented. Camera scanning needs a second device to demo properly.

## Declaration

AI assistance was used during development, as the selection-round rules permit. The protocol, the taxonomy, the threat model and the reconciliation design are ours, and every algorithm described above is implemented in this repository and covered by the test suite.
