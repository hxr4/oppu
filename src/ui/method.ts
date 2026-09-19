import { h, s } from './dom';
import { panel } from './shared';

function chainDiagram(): SVGElement {
  const box = (x: number, y: number, w: number, label: string, sub: string): SVGElement =>
    s('g', {},
      s('rect', { x, y, width: w, height: 46, fill: 'var(--surface-2)', stroke: 'var(--line-strong)' }),
      s('text', { x: x + 11, y: y + 20, fill: 'var(--ink)', 'font-size': '12', 'font-weight': '600' }, label),
      s('text', { x: x + 11, y: y + 36, fill: 'var(--ink-2)', 'font-size': '11' }, sub));

  const arrow = (x1: number, x2: number, y: number, label: string): SVGElement =>
    s('g', {},
      s('path', { d: `M${x1} ${y} L${x2} ${y}`, stroke: 'var(--accent)', fill: 'none', 'stroke-width': '1.4' }),
      s('path', { d: `M${x2 - 6} ${y - 4} L${x2} ${y} L${x2 - 6} ${y + 4}`, stroke: 'var(--accent)', fill: 'none', 'stroke-width': '1.4' }),
      s('text', { x: (x1 + x2) / 2, y: y - 8, fill: 'var(--accent)', 'font-size': '10', 'text-anchor': 'middle', 'font-family': 'var(--mono)' }, label));

  return s('svg', {
    viewBox: '0 0 700 250', class: 'chart', style: 'max-width:700px',
    role: 'img', 'aria-label': 'Signature chain from transport authority root to the proof on a phone',
  },
    box(0, 12, 190, 'Transport authority root', 'one key, in every scanner'),
    arrow(190, 250, 35, 'signs'),
    box(250, 12, 200, 'Institution key', 'one per college'),
    arrow(450, 510, 35, 'signs'),
    box(510, 12, 190, 'Credential', 'serial, validity, route'),
    s('path', { d: 'M605 58 L605 104', stroke: 'var(--accent)', fill: 'none', 'stroke-width': '1.4' }),
    s('path', { d: 'M601 98 L605 104 L609 98', stroke: 'var(--accent)', fill: 'none', 'stroke-width': '1.4' }),
    s('text', { x: 613, y: 86, fill: 'var(--accent)', 'font-size': '10', 'font-family': 'var(--mono)' }, 'binds'),
    box(510, 104, 190, 'Device key', 'non-extractable, on the phone'),
    s('path', { d: 'M605 150 L605 196', stroke: 'var(--accent)', fill: 'none', 'stroke-width': '1.4' }),
    s('path', { d: 'M601 190 L605 196 L609 190', stroke: 'var(--accent)', fill: 'none', 'stroke-width': '1.4' }),
    s('text', { x: 613, y: 178, fill: 'var(--accent)', 'font-size': '10', 'font-family': 'var(--mono)' }, 'signs the clock'),
    box(510, 196, 190, 'Proof, 229 bytes', 'valid for 30 seconds'),
    s('text', { x: 0, y: 130, fill: 'var(--ink-2)', 'font-size': '11.5' }, 'A scanner carries the root key and'),
    s('text', { x: 0, y: 148, fill: 'var(--ink-2)', 'font-size': '11.5' }, 'a signed revocation digest — under'),
    s('text', { x: 0, y: 166, fill: 'var(--ink-2)', 'font-size': '11.5' }, 'two kilobytes. That is the whole'),
    s('text', { x: 0, y: 184, fill: 'var(--ink-2)', 'font-size': '11.5' }, 'trust anchor for the entire state.'),
  );
}

export function methodView(): HTMLElement {
  return h(
    'div',
    { style: 'display:grid;gap:18px' },
    panel('The signature chain', 'How it works', h('div', { class: 'panel__body' },
      chainDiagram(),
      h('div', { class: 'prose' },
        h('p', {},
          'Four keys, three signatures, no lookup. Verification is arithmetic the phone in the conductor’s hand ' +
          'can finish before the student has put theirs away.'),
      ),
    )),
    panel('Why each piece is there', 'Design', h('div', { class: 'panel__body' },
      h('div', { class: 'prose' },
        h('h3', {}, 'Why offline is the requirement, not a feature'),
        h('p', {},
          'A concession check happens on a moving bus on a ghat road at seven in the morning. Any design that needs ' +
          'a server at that moment fails exactly where students actually are. So the pass carries its own proof and ' +
          'the bus carries its own trust anchor.'),
        h('h3', {}, 'Why the QR rotates'),
        h('p', {},
          'A static code is a photograph away from being everybody’s pass. Every 30 seconds the wallet signs the ' +
          'current half-minute with a key that was generated non-extractable inside the phone and has never left it. ' +
          'A screenshot carries a stale signature; a copied credential carries the wrong key. Both are rejected by ' +
          'arithmetic rather than by a conductor’s judgement.'),
        h('h3', {}, 'Why a check phrase'),
        h('p', {},
          'Two words derived from the exact bytes scanned, shown on both screens. If a student is relaying somebody ' +
          'else’s live screen over a video call, the phrases will not match. It costs nothing and closes the one ' +
          'gap rotation leaves open.'),
        h('h3', {}, 'Why the conductor never sees a name'),
        h('p', {},
          'The proof carries a pseudonym, an institution and an entitlement. That is everything needed to decide the ' +
          'fare and nothing that should be readable by a stranger on a bus. The institution can map the pseudonym ' +
          'back; nobody else can.'),
        h('h3', {}, 'Why receipts matter more than the pass'),
        h('p', {},
          'The concession is a subsidy the state owes the corporation. Today the claim is an estimate. Here every ' +
          'boarding leaves a receipt signed by the conductor’s device, which means the claim is a sum, the audit ' +
          'is a signature check, and fraud is visible as arithmetic — the same pass boarding in two districts within ' +
          'the hour, or a fourth trip on a two-trip entitlement.'),
      ),
    )),
    panel('What is real, and what is not', 'Provenance', h('div', { class: 'panel__body' },
      h('div', { class: 'prose' },
        h('h3', {}, 'Real'),
        h('ul', {},
          h('li', {}, 'Every signature is ECDSA P-256 with SHA-256 through the browser’s own WebCrypto. Nothing is simulated.'),
          h('li', {}, 'Student device keys are generated non-extractable, so the private key genuinely cannot leave the browser.'),
          h('li', {}, 'The QR carries the real 229-byte envelope and is decoded by a bundled scanner, not a stub.'),
          h('li', {}, 'The attack bench builds each forgery live with fresh keys, then runs the same verifier the scanner uses.'),
          h('li', {}, 'District boundaries and the 83 depot towns are real geography.'),
        ),
        h('h3', {}, 'Approximated'),
        h('ul', {},
          h('li', {}, 'Institutions and students are invented, so no credential here carries a real college’s name.'),
          h('li', {}, 'The fare table is illustrative. Production reads the published KSRTC stage-fare table.'),
          h('li', {}, 'Entitled-route geometry is a straight line between two depot towns with a tolerance, not the road.'),
          h('li', {}, 'Keys are generated fresh on each load. A production wallet keeps the device key in IndexedDB behind the phone’s own unlock.'),
          h('li', {}, 'Seeded receipts are synthetic so the ledger opens with something in it.'),
        ),
        h('h3', {}, 'What production needs'),
        h('ul', {},
          h('li', {}, 'An issuance flow inside the existing institution portal, so a pass is a signature on an enrolment record that already exists.'),
          h('li', {}, 'The revocation digest distributed with the daily waybill sync, and over SMS where there is no data.'),
          h('li', {}, 'Key rotation and an expiry on the root, so a compromised institution key is a dated problem rather than a permanent one.'),
          h('li', {}, 'A printed fallback pass with the same serial for students without a smartphone — the ledger must not exclude them.'),
        ),
      ),
    )),
  );
}
