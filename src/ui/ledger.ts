import { h } from './dom';
import { panel, pill, tile, rupees, type AppCtx } from './shared';
import { horizontalBars, lineChart } from './charts';
import { ANOMALY_LABEL, findAnomalies, reconcile } from '../engine/ledger';
import { DEPOTS } from '../data/depots';

export function ledgerView(ctx: AppCtx): HTMLElement {
  const { receipts, rejections, institutions } = ctx.world;
  const summary = reconcile(receipts);
  const anomalies = findAnomalies(receipts, rejections);

  const nameOf = (code: string): string => institutions.find((i) => i.code === code)?.name ?? code;

  const byInstitution = summary.byInstitution.map((r) => ({
    label: nameOf(r.code).replace(/,.*/, ''),
    value: r.subsidy,
  }));

  const days = summary.byDay.slice(-9);
  const labels = days.map((d) => new Date(d.day).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }));

  const anomalyTable = h(
    'table',
    {},
    h('thead', {}, h('tr', {},
      h('th', {}, 'Flag'), h('th', {}, 'Pass'), h('th', {}, 'What the receipts show'), h('th', {}, 'When'))),
    h('tbody', {}, ...anomalies.slice(0, 10).map((a) =>
      h('tr', {},
        h('td', {}, pill(a.kind === 'impossible_travel' ? 'pill--bad' : 'pill--warn', ANOMALY_LABEL[a.kind])),
        h('td', { class: 'mono', style: 'font-size:11.5px' }, a.serialHex),
        h('td', { style: 'white-space:normal' }, a.detail),
        h('td', {}, new Date(a.at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })),
      ))),
  );

  const recent = h(
    'table',
    {},
    h('thead', {}, h('tr', {},
      h('th', {}, 'Pass'), h('th', {}, 'Institution'), h('th', {}, 'Boarded'),
      h('th', { class: 'num' }, 'km'), h('th', { class: 'num' }, 'Paid'),
      h('th', { class: 'num' }, 'Subsidy'), h('th', {}, 'State'))),
    h('tbody', {}, ...receipts.slice(0, 12).map((r) =>
      h('tr', {},
        h('td', { class: 'mono', style: 'font-size:11.5px' }, r.serialHex),
        h('td', {}, r.instCode),
        h('td', {}, DEPOTS[r.boardingDepot]?.name ?? '—'),
        h('td', { class: 'num' }, r.km.toFixed(0)),
        h('td', { class: 'num' }, rupees(r.fareConcession)),
        h('td', { class: 'num' }, rupees(r.subsidy)),
        h('td', {}, r.synced ? pill('pill--plain', 'synced') : pill('pill--warn', 'queued')),
      ))),
  );

  return h(
    'div',
    { style: 'display:grid;gap:18px' },
    h('div', { class: 'tiles' },
      tile(String(summary.boardings), 'Concessional boardings recorded'),
      tile(rupees(summary.subsidy), 'Subsidy attributable to a signed receipt'),
      tile(rupees(summary.collected), 'Fares actually collected'),
      tile(String(anomalies.length), 'Flags for the vigilance wing'),
    ),
    h('div', { class: 'grid grid--work' },
      panel('Where the subsidy went', 'By institution', h('div', { class: 'panel__body' },
        horizontalBars(byInstitution, { unit: '' }),
        h('p', { class: 'note' },
          'Today this is an estimate argued between the corporation and the government. Here it is the sum of signed receipts.'))),
      panel('Boardings and subsidy by day', 'Last nine days', h('div', { class: 'panel__body' },
        lineChart(
          [
            { name: 'boardings', color: 'var(--c2)', points: days.map((d, x) => ({ x, y: d.boardings })) },
            { name: 'subsidy ÷10', color: 'var(--c4)', points: days.map((d, x) => ({ x, y: Math.round(d.subsidy / 10) })) },
          ],
          { xLabels: labels },
        ),
        h('p', { class: 'note' }, 'Subsidy is scaled down tenfold so both series share one axis honestly.'))),
    ),
    panel('Flags reconciliation found', 'Anomalies', h('div', { class: 'panel__body' },
      h('div', { class: 'tablewrap' }, anomalyTable),
      h('p', { class: 'note' },
        'A conductor offline cannot know a pass is being used in two districts at once. The ledger can, the moment the receipts meet.'))),
    panel('Recent receipts', 'Audit trail', h('div', { class: 'panel__body' },
      h('div', { class: 'tablewrap' }, recent),
      h('p', { class: 'note' },
        `${summary.unsynced} of ${summary.boardings} receipts are still queued on a bus. Every one carries the conductor device’s signature.`))),
  );
}
