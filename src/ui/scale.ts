import { h, clear, toast } from './dom';
import { panel, tile, type AppCtx } from './shared';
import { horizontalBars } from './charts';
import { KERALA_SCALE, project, revocationCurve, statusWindowDays } from '../engine/scale';
import { PROOF_LEN, STATUS_LEN, makeProof, verifyProof } from '../engine/credential';
import { onEntitledRoute } from '../engine/entitlement';
import { auditReceipts, trustBundleBytes } from '../engine/world';
import { deviceClock } from '../engine/clock';

const fmt = (n: number): string => n.toLocaleString('en-IN');

export function scaleView(ctx: AppCtx): HTMLElement {
  const p = project();
  const benchHost = h('div', { class: 'panel__body' });
  const auditHost = h('div', { class: 'panel__body' });

  async function runBenchmark(): Promise<void> {
    const student = ctx.world.students[0];
    const proof = await makeProof(student.credential, student.status, student.deviceKeys.privateKey, deviceClock.now());
    const runs = 200;
    const timings: number[] = [];
    for (let i = 0; i < runs; i++) {
      const t0 = performance.now();
      await verifyProof(proof, {
        trust: ctx.world.trust,
        revocations: ctx.world.revocations,
        nowMs: deviceClock.now(),
        serviceClass: 'Ordinary',
        boardingDepot: student.homeDepot,
        routeCheck: onEntitledRoute,
      });
      timings.push(performance.now() - t0);
    }
    timings.sort((a, b) => a - b);
    const median = timings[Math.floor(runs / 2)];
    const p95 = timings[Math.floor(runs * 0.95)];
    const perSecond = Math.round(1000 / median);

    clear(benchHost);
    benchHost.appendChild(
      h('div', { class: 'tiles' },
        tile(`${median.toFixed(2)} ms`, 'Median full verification'),
        tile(`${p95.toFixed(2)} ms`, '95th percentile'),
        tile(fmt(perSecond), 'Passes per second, one thread'),
        tile(String(runs), 'Verifications measured'),
      ),
    );
    benchHost.appendChild(
      h('p', { class: 'note' },
        'Measured in this browser just now, over the complete check — four signature verifications, a hash and the ' +
        'entitlement tests. A busy stop boards perhaps two passengers a second.'),
    );
  }

  async function runAudit(): Promise<void> {
    const result = await auditReceipts(ctx.world);
    clear(auditHost);
    auditHost.appendChild(
      h('div', { class: 'tiles' },
        tile(fmt(result.total), 'Receipts in the ledger'),
        tile(fmt(result.verified), 'Signatures that verified'),
        tile(String(result.failed.length), 'Failed'),
        tile(`${result.elapsedMs} ms`, 'Time to audit the batch'),
      ),
    );
    auditHost.appendChild(
      h('p', { class: 'note' },
        result.failed.length === 0
          ? 'Every receipt was signed by a conductor device the authority root has countersigned. That is what an audit is here: no inspection, no paperwork, a signature check over the batch.'
          : `Receipts that did not verify: ${result.failed.join(', ')}.`),
    );
  }

  const curve = revocationCurve().map((r) => ({
    label: `${(r.students / 1000).toFixed(0)}k students`,
    value: Number(r.listKb.toFixed(0)),
  }));

  void runBenchmark();
  void runAudit();

  return h(
    'div',
    { style: 'display:grid;gap:18px' },
    h('div', { class: 'tiles' },
      tile(`${PROOF_LEN} B`, 'One proof, whatever the state’s size'),
      tile(`${STATUS_LEN} B`, 'The status token inside it'),
      tile(`${(trustBundleBytes(ctx.world) / 1024).toFixed(2)} kB`, 'Trust anchor on this scanner'),
      tile(`${fmt(p.syncBytesPerBusPerDay / 1024 | 0)} kB`, 'Receipts per bus per day'),
    ),
    h('div', { class: 'grid grid--work' },
      panel('How fast is the check', 'Measured here, now', benchHost,
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => void runBenchmark() }, 'Run again')),
      panel('Auditing the ledger', 'Signature check over the batch', auditHost,
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => { void runAudit(); toast('Re-verified every receipt.'); } }, 'Re-audit')),
    ),
    panel('Why revocation had to change', 'The design decision', h('div', { class: 'panel__body' },
      h('div', { class: 'prose' },
        h('p', {},
          'The first version shipped a signed list of revoked serials to every bus. That is fine for a pilot and ' +
          'hopeless for a state: at Kerala’s scale it grows into this.'),
      ),
      horizontalBars(curve, { unit: ' kB' }),
      h('div', { class: 'prose' },
        h('p', {},
          `So the pass carries its own recency instead. Its institution signs a ${STATUS_LEN}-byte "not revoked as of ` +
          `today" token whenever the wallet has a network, and a scanner refuses anything older than ` +
          `${statusWindowDays} days. Revoking a pass means declining to sign it again — nothing is distributed to ` +
          'anyone, and the bus carries the same two kilobytes whether Kerala has fifty thousand students or two million.'),
        h('p', {},
          'The signed list stays, shrunk to its real job: same-day emergency revocation of a handful of serials, ' +
          'for the case that cannot wait a week.'),
      ),
    )),
    panel('Assumptions behind these numbers', 'Arithmetic', h('div', { class: 'panel__body' },
      h('div', { class: 'tablewrap' },
        h('table', {},
          h('thead', {}, h('tr', {}, h('th', {}, 'Quantity'), h('th', { class: 'num' }, 'Value'), h('th', {}, 'Where it comes from'))),
          h('tbody', {},
            h('tr', {}, h('td', {}, 'Students assumed'), h('td', { class: 'num' }, fmt(KERALA_SCALE.students)), h('td', {}, 'order-of-magnitude estimate, not a published figure')),
            h('tr', {}, h('td', {}, 'Passes revoked per year'), h('td', { class: 'num' }, `${KERALA_SCALE.revokedPerYearPct}%`), h('td', {}, 'assumption: graduations, transfers, lost phones')),
            h('tr', {}, h('td', {}, 'Boardings per student per day'), h('td', { class: 'num' }, String(KERALA_SCALE.boardingsPerStudentPerDay)), h('td', {}, 'the daily cap the entitlement allows')),
            h('tr', {}, h('td', {}, 'Buses in the fleet'), h('td', { class: 'num' }, fmt(KERALA_SCALE.busesInFleet)), h('td', {}, 'order-of-magnitude estimate')),
            h('tr', {}, h('td', {}, 'Receipt on the wire'), h('td', { class: 'num' }, `${p.receiptBytes} B`), h('td', {}, 'measured from the record this build writes')),
            h('tr', {}, h('td', {}, 'Student data per week'), h('td', { class: 'num' }, `${p.studentSyncBytesPerWeek} B`), h('td', {}, 'one status token, once a week')),
          ))),
      h('p', { class: 'note' },
        'The population figures are estimates we have marked as such. The byte counts are not estimates — they are ' +
        'measured from the structures this prototype actually encodes.'),
    )),
  );
}
