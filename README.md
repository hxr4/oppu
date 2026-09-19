# OPPU — ഒപ്പ്

**A digital student concession pass for Kerala state buses that proves itself in two seconds with no network, and turns every boarding into an auditable subsidy record.**

Built for the ANAVANDI Hackathon 2026 selection round — **SC-01, Digital student concession pass (Track 1: Public Transport)**.

---

## The problem, stated properly

A concession check happens on a moving bus, on a ghat road, at seven in the morning, in about two seconds. Everything that is wrong with the paper card follows from that moment:

- A laminated card is verified by a glance. A glance cannot tell a sibling from a student, a current card from last year's, or a real card from a colour photocopy.
- The obvious fix — an app that phones a server — fails exactly where students are. There is no signal on the churam.
- And the money never gets counted. The concession is a subsidy the state owes the corporation, and today the claim is an estimate argued between them, because nobody has a per-boarding record anyone can audit.

A QR code on a screen solves none of this. A screenshot of a QR code is everybody's pass.

## The design

Four keys, three signatures, no lookup.

```
transport authority root  ──signs──▶  institution key  ──signs──▶  credential
                                                                        │ binds
                                                                        ▼
                                                                   device key
                                                                        │ signs the clock
                                                                        ▼
                                                            proof · 229 bytes · 30 s
```

- **The scanner trusts one key.** The transport authority root. Every institution key is countersigned by it, so adding a college is a signature, not a database migration — and a forged college key fails on a bus with no network in sight.
- **The credential is signed by the institution.** Serial, pseudonym, validity window, entitled service classes, home stop, institution stop, and the student device's public key. Alter any field and the signature stops matching.
- **The proof rotates every 30 seconds.** The wallet signs the current half-minute with a key generated **non-extractable** inside the phone. A screenshot carries a stale signature. A credential copied into a friend's app carries the wrong key. Both are rejected by arithmetic, not by a conductor's judgement.
- **A two-word check phrase** derived from the exact bytes scanned appears on both screens. If a student is relaying somebody else's live screen over a video call, the phrases differ. Costs zero bytes; closes the one gap rotation leaves open.
- **Revocation is a signed digest**, not a server call. The institution re-signs a short list; the bus carries it. Under two kilobytes holds the root, four institution keys and the digest — the entire trust anchor for the state.
- **The conductor never learns a name.** A pseudonym, an institution and an entitlement is everything needed to decide the fare, and nothing that should be readable by a stranger on a bus.

### The nine checks, in order

| | Check | Rejects |
|---|---|---|
| 1 | Read the 229-byte proof | malformed |
| 2 | Find the issuing institution in the trust list | unknown issuer |
| 3 | Institution key countersigned by the root | forged college |
| 4 | Credential signature over every field | tampered validity, route, class |
| 5 | Validity window against today | expired, not yet valid |
| 6 | Signed revocation digest | revoked pass |
| 7 | Proof minted within the last 30 s | screenshots, saved images |
| 8 | Device signature over the clock | credential copied to another phone |
| 9 | Class of service and entitled route | super-fast misuse, weekend trips across the state |

Each check writes a line the conductor can read. A rejection is never "computer says no" — it is a sentence.

## The part that carries the money

Every acceptance writes a receipt signed by the conductor's device — pass serial, boarding stop, distance, fare collected, subsidy carried — queued offline and synced at the depot.

That changes three things:

1. The subsidy claim becomes a **sum of signed receipts** instead of an estimate.
2. The audit becomes a **signature check** instead of an inspection.
3. Fraud that offline verification *cannot* catch becomes visible as arithmetic at reconciliation: the same pass boarding in two districts 35 minutes apart, or a fourth trip on a two-trip entitlement.

Offline acceptance and central accountability are usually a trade-off. Signed receipts are how you get both.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 21 engine checks
npm run build    # single self-contained dist/index.html
```

Deploys to Vercel or Netlify as a static site (`vercel.json` included: build `npm run build`, output `dist`).

### Trying it in two minutes

1. **Student wallet** — watch the QR reissue every 30 seconds. Press *Show this to the conductor*.
2. **Conductor** — *Read the pass in front of me*. Nine checks, a verdict, a queued receipt.
3. **Attack bench** — every forgery is built from fresh keys at the moment you press the button and run through the same verifier. Nothing is scripted to fail.
4. **Institution** — revoke a pass, then try it on the bench. The bus was never online.
5. **Subsidy ledger** — what the receipts add up to, and the flags reconciliation found.

## Layout

```
src/
  engine/crypto.ts        WebCrypto ECDSA P-256, base64url, key ids, check phrase
  engine/credential.ts    229-byte envelope, issuance, the nine-step verifier
  engine/entitlement.ts   home-to-institution route geometry
  engine/ledger.ts        fares, subsidy, reconciliation, anomaly detection
  engine/world.ts         demo institutions, students, seeded receipt history
  engine/qr.ts            bundled QR encode and decode — no CDN at runtime
  data/depots.ts          83 KSRTC depot towns, 12 corridors
  data/kerala-geo.ts      district polygons and projection
  ui/                     wallet, scanner, attack bench, institution, ledger, method
test/engine.test.ts       21 checks over crypto, verification, entitlement and the ledger
```

## What is real, and what is not

**Real.** Every signature is ECDSA P-256 with SHA-256 through the browser's own WebCrypto — nothing simulated. Student device keys are generated non-extractable, so the private key genuinely cannot leave the browser. The QR carries the real envelope and is decoded by a bundled scanner. The attack bench builds each forgery live. District boundaries and the 83 depot towns are real geography.

**Approximated.** Institutions and students are invented, so no credential here carries a real college's name. The fare table is illustrative; production reads the published KSRTC stage-fare table. Entitled-route geometry is a straight line between two depot towns with a tolerance, not the road. Keys are generated fresh on each load; a production wallet keeps the device key in IndexedDB behind the phone's own unlock. Seeded receipts are synthetic so the ledger opens with something in it.

**What production needs.** Issuance inside the existing institution portal, so a pass is a signature on an enrolment record that already exists. The revocation digest riding the daily waybill sync, and SMS where there is no data. Key rotation and a root expiry, so a compromised institution key is a dated problem rather than a permanent one. And a printed fallback pass carrying the same serial, because a student without a smartphone must not be the one person the ledger cannot see.

## Declaration

AI assistance was used during development, as the selection-round rules permit. The protocol, the taxonomy, the threat model and the reconciliation design are ours, and every algorithm described above is implemented in this repository and covered by the test suite.
