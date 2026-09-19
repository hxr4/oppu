import { h, clear, toast } from './dom';
import { panel, pill, tile, type AppCtx } from './shared';
import { classesIn, dayToDate, serialHex } from '../engine/credential';
import { entitledRouteLabel } from '../engine/entitlement';
import { revokeStudent, restoreStudent, trustBundleSize } from '../engine/world';
import { hex } from '../engine/crypto';

export function issuerView(ctx: AppCtx): HTMLElement {
  const listHost = h('div', { class: 'rows scroller' });
  const trustHost = h('div', { class: 'panel__body' });
  const tilesHost = h('div', { class: 'tiles' });

  function renderTiles(): void {
    const active = ctx.world.students.filter((s) => !s.revoked).length;
    const revoked = ctx.world.students.length - active;
    const serials = ctx.world.revocations.reduce((n, d) => n + d.serialsHex.length, 0);
    clear(tilesHost);
    tilesHost.appendChild(tile(String(ctx.world.institutions.length), 'Institutions in the trust list'));
    tilesHost.appendChild(tile(String(active), 'Active passes'));
    tilesHost.appendChild(tile(String(revoked), 'Revoked passes'));
    tilesHost.appendChild(tile(`${(trustBundleSize(ctx.world) / 1024).toFixed(2)} kB`, 'Everything a bus needs to hold'));
    void serials;
  }

  function renderList(): void {
    clear(listHost);
    for (const student of ctx.world.students) {
      const f = student.credential.fields;
      const institution = ctx.world.institutions.find((i) => i.code === student.institutionCode);
      listHost.appendChild(
        h(
          'div',
          { class: 'rowitem', style: 'cursor:default' },
          h(
            'div',
            { class: 'rowitem__top' },
            student.revoked ? pill('pill--bad', 'revoked') : pill('pill--ok', 'active'),
            h('b', { style: 'font-size:13.5px' }, student.name),
            h('span', { class: 'mono', style: 'font-size:11px;color:var(--ink-3)' }, serialHex(f)),
            h(
              'button',
              {
                class: student.revoked ? 'btn btn--ghost btn--sm' : 'btn btn--danger btn--sm',
                type: 'button',
                style: 'margin-left:auto',
                onclick: () => {
                  void (async () => {
                    if (student.revoked) {
                      await restoreStudent(ctx.world, student);
                      toast(`${student.name}'s pass restored — the digest was re-signed.`);
                    } else {
                      await revokeStudent(ctx.world, student);
                      toast(`${student.name}'s pass revoked. Every scanner rejects it once the digest reaches it.`);
                    }
                    renderList();
                    renderTiles();
                    renderTrust();
                  })();
                },
              },
              student.revoked ? 'Restore' : 'Revoke',
            ),
          ),
          h('div', { class: 'note' }, `${institution?.name ?? ''} · ${student.course}`),
          h(
            'div',
            { class: 'note' },
            `${entitledRouteLabel(student.homeDepot, student.instDepot)} · ${classesIn(f.classMask).join(', ')} · to ${dayToDate(f.validToDay).toLocaleDateString('en-IN')}`,
          ),
        ),
      );
    }
  }

  function renderTrust(): void {
    clear(trustHost);
    const root = ctx.world.trust.rootPublicRaw;
    trustHost.appendChild(
      h(
        'div',
        { class: 'prose' },
        h('p', {},
          'A scanner trusts one key: the transport authority root. Every institution key is countersigned by it, so ' +
          'adding a college is a signature, not a database migration, and a forged college key fails on the bus with no network in sight.'),
      ),
    );
    const kv = h('dl', { class: 'kv' });
    kv.appendChild(h('dt', {}, 'Root key'));
    kv.appendChild(h('dd', { class: 'mono' }, `${hex(root.slice(1, 9), 2)} …`));
    for (const inst of ctx.world.institutions) {
      kv.appendChild(h('dt', {}, inst.code));
      kv.appendChild(
        h('dd', {},
          h('span', {}, `${inst.name} — `),
          h('span', { class: 'mono', style: 'font-size:11.5px' }, `key ${inst.keyIdHex}`),
        ),
      );
    }
    trustHost.appendChild(kv);

    const digests = ctx.world.revocations;
    trustHost.appendChild(
      h('div', {},
        h('div', { class: 'eyebrow', style: 'margin-bottom:6px' }, 'Signed revocation digest'),
        digests.length
          ? h('div', { class: 'prose' },
            ...digests.map((d) =>
              h('p', { class: 'mono', style: 'font-size:11.5px;color:var(--ink-2)' },
                `${d.instKeyIdHex} · ${dayToDate(d.epochDay).toLocaleDateString('en-IN')} · ${d.serialsHex.length} serial(s) · sig ${hex(d.signature.slice(0, 6), 2)}…`)))
          : h('p', { class: 'note' }, 'Nothing revoked. The digest a bus carries is empty and still signed.'),
      ),
    );
  }

  renderTiles();
  renderList();
  renderTrust();

  return h(
    'div',
    { style: 'display:grid;gap:18px' },
    tilesHost,
    h(
      'div',
      { class: 'grid grid--work' },
      panel('Issued passes', 'Institution console', listHost,
        h('span', { class: 'note' }, 'revocation takes effect on the next digest sync')),
      panel('Trust list on every scanner', 'Keys', trustHost),
    ),
  );
}
