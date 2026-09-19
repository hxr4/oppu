import { h, clear, toast } from './dom';
import { panel, pill, tile, type AppCtx } from './shared';
import { MAX_STATUS_AGE_DAYS, classesIn, dayNumber, dayToDate, serialHex } from '../engine/credential';
import { entitledRouteLabel } from '../engine/entitlement';
import { revokeStudent, restoreStudent, trustBundleBytes, refreshStatus } from '../engine/world';
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
    tilesHost.appendChild(tile(`${(trustBundleBytes(ctx.world) / 1024).toFixed(2)} kB`, 'Everything a bus needs to hold'));
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
                      toast(`${student.name}'s pass restored and a fresh status token issued.`);
                    } else {
                      await revokeStudent(ctx.world, student);
                      toast(`${student.name}'s pass revoked. It stops getting status tokens, so it dies within ${MAX_STATUS_AGE_DAYS} days everywhere — and today, on any bus carrying the emergency list.`);
                    }
                    ctx.save();
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
          h('div', { class: 'note' },
            (() => {
              const age = dayNumber(Date.now()) - student.status.day;
              return `status confirmed ${age <= 0 ? 'today' : `${age} day${age === 1 ? '' : 's'} ago`}${age > MAX_STATUS_AGE_DAYS ? ' — outside the window, this pass is already refused' : ''}`;
            })()),
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
          'A scanner trusts one key: the transport authority root. Every institution key and every conductor device ' +
          'is countersigned by it, so adding a college is a signature, not a database migration, and a forged key ' +
          'fails on the bus with no network in sight.'),
      ),
    );
    const kv = h('dl', { class: 'kv' });
    kv.appendChild(h('dt', {}, 'Root key'));
    kv.appendChild(h('dd', { class: 'mono' }, `${hex(root.slice(1, 9), 2)} …`));
    kv.appendChild(h('dt', {}, 'Conductor'));
    kv.appendChild(
      h('dd', {},
        h('span', {}, `${ctx.world.conductor.id} (${ctx.world.conductor.depotCode}) — `),
        h('span', { class: 'mono', style: 'font-size:11.5px' }, `key ${ctx.world.conductor.keyIdHex}`),
      ),
    );
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

    trustHost.appendChild(
      h('div', { class: 'prose' },
        h('h3', {}, 'Two revocation paths, different jobs'),
        h('p', {},
          `Ordinarily a revoked pass simply stops receiving status tokens, and every bus in the state refuses it ` +
          `within ${MAX_STATUS_AGE_DAYS} days with nothing distributed to anyone. The signed list below is the ` +
          'emergency path for the same day, and it only ever needs to carry a handful of serials.'),
      ),
    );

    const digests = ctx.world.revocations;
    trustHost.appendChild(
      h('div', {},
        h('div', { class: 'eyebrow', style: 'margin-bottom:6px' }, 'Same-day emergency list'),
        digests.length
          ? h('div', { class: 'prose' },
            ...digests.map((d) =>
              h('p', { class: 'mono', style: 'font-size:11.5px;color:var(--ink-2)' },
                `${d.instKeyIdHex} · ${dayToDate(d.epochDay).toLocaleDateString('en-IN')} · ${d.serialsHex.length} serial(s) · sig ${hex(d.signature.slice(0, 6), 2)}…`)))
          : h('p', { class: 'note' }, 'Nothing revoked. The emergency list a bus carries is empty and still signed.'),
      ),
    );
  }

  const refreshAll = h('button', {
    class: 'btn btn--ghost btn--sm',
    type: 'button',
    onclick: () => {
      void (async () => {
        let n = 0;
        for (const st of ctx.world.students) if (await refreshStatus(ctx.world, st)) n += 1;
        toast(`${n} status tokens re-issued. Revoked passes were refused.`);
        renderList();
        ctx.save();
      })();
    },
  }, 'Re-issue today\u2019s status tokens');

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
      panel('Issued passes', 'Institution console', listHost, refreshAll),
      panel('Trust list on every scanner', 'Keys', trustHost),
    ),
  );
}
