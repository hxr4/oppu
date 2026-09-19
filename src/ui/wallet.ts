import { h, clear, toast } from './dom';
import { panel, pill, type AppCtx } from './shared';
import { qrPath } from '../engine/qr';
import { checkPhrase } from '../engine/crypto';
import {
  BUCKET_SECONDS, MAX_STATUS_AGE_DAYS, classesIn, dayNumber, dayToDate,
  makeProof, proofToText, serialHex,
} from '../engine/credential';
import { deviceClock } from '../engine/clock';
import { refreshStatus } from '../engine/world';
import { entitledRouteLabel } from '../engine/entitlement';
import { DEPOTS } from '../data/depots';
import { keralaMap } from './map';
import type { Student } from '../engine/world';

export function walletView(ctx: AppCtx): HTMLElement {
  const students = ctx.world.students;
  let student = students.find((s) => s.id === ctx.walletStudentId) ?? students[0];

  const qrHost = h('div', { class: 'qrbox' });
  const mapHost = h('div', { class: 'mapwrap' });
  const detailHost = h('div', { class: 'panel__body' });
  const rotor = h('div', { class: 'rotor' });
  let timer = 0;
  let currentProof: Uint8Array | null = null;

  const picker = h(
    'select',
    {
      id: 'oppu-student',
      'aria-label': 'Student',
      onchange: (e: Event) => {
        const id = (e.target as HTMLSelectElement).value;
        student = students.find((s) => s.id === id) ?? students[0];
        ctx.walletStudentId = id;
        void render();
      },
    },
    ...students.map((s) =>
      h('option', { value: s.id, selected: s.id === student.id }, `${s.name} — ${s.institutionCode}`),
    ),
  );

  async function drawProof(): Promise<void> {
    const now = deviceClock.now();
    const proof = await makeProof(student.credential, student.status, student.deviceKeys.privateKey, now);
    currentProof = proof;
    const text = proofToText(proof);
    const { d, count } = qrPath(text, 'M');
    const phrase = await checkPhrase(proof);

    clear(qrHost);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'qr');
    svg.setAttribute('viewBox', `0 0 ${count} ${count}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Rotating proof for pass ${serialHex(student.credential.fields)}`);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
    svg.addEventListener('click', () => openFullscreen(d, count, phrase));
    svg.setAttribute('tabindex', '0');
    svg.addEventListener('keydown', (ev) => {
      const e = ev as KeyboardEvent;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFullscreen(d, count, phrase); }
    });
    qrHost.appendChild(svg);
    qrHost.appendChild(h('span', { class: 'phrase' }, phrase));
    qrHost.appendChild(
      h('div', { class: 'note', style: 'text-align:center' },
        `${text.length} characters · ${count}×${count} modules · reissues every ${BUCKET_SECONDS} s`),
    );
  }

  function openFullscreen(d: string, count: number, phrase: string): void {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `-2 -2 ${count + 4} ${count + 4}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Concession pass proof, enlarged for scanning');
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', '-2'); bg.setAttribute('y', '-2');
    bg.setAttribute('width', String(count + 4)); bg.setAttribute('height', String(count + 4));
    bg.setAttribute('fill', '#fff');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', '#111');
    svg.appendChild(bg);
    svg.appendChild(path);
    const overlay = h('div', { class: 'qrfull', role: 'dialog', 'aria-modal': 'true' },
      svg,
      h('span', { class: 'phrase' }, phrase),
      h('p', {}, `${student.name} \u00b7 pass ${serialHex(student.credential.fields)} \u00b7 tap anywhere to close`),
    );
    const close = (): void => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
    };
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') close(); };
    overlay.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    toast('Scan this with another phone\u2019s camera on the Conductor tab.');
  }

  function tickRotor(): void {
    const remaining = BUCKET_SECONDS - ((Date.now() / 1000) % BUCKET_SECONDS);
    const frac = remaining / BUCKET_SECONDS;
    const circumference = 2 * Math.PI * 6;
    clear(rotor);
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ring.setAttribute('class', 'rotor__ring');
    ring.setAttribute('viewBox', '0 0 16 16');
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    bg.setAttribute('class', 'rotor__bg');
    bg.setAttribute('cx', '8'); bg.setAttribute('cy', '8'); bg.setAttribute('r', '6');
    const fg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    fg.setAttribute('class', 'rotor__fg');
    fg.setAttribute('cx', '8'); fg.setAttribute('cy', '8'); fg.setAttribute('r', '6');
    fg.setAttribute('stroke-dasharray', String(circumference));
    fg.setAttribute('stroke-dashoffset', String(circumference * (1 - frac)));
    fg.setAttribute('stroke-linecap', 'round');
    ring.appendChild(bg); ring.appendChild(fg);
    rotor.appendChild(ring);
    rotor.appendChild(h('span', {}, `${Math.ceil(remaining)} s until this proof expires`));
  }

  async function render(): Promise<void> {
    const f = student.credential.fields;
    clear(detailHost);
    detailHost.appendChild(
      h('div', { class: 'pass' },
        h('div', { class: 'pass__head' },
          h('div', {},
            h('div', { class: 'pass__inst' }, ctx.world.institutions.find((i) => i.code === student.institutionCode)?.name ?? ''),
            h('div', { class: 'pass__serial' }, `pass ${serialHex(f)}`),
          ),
          student.revoked ? pill('pill--bad', 'revoked') : pill('pill--ok', 'active'),
        ),
        h('div', { class: 'pass__micro', 'aria-hidden': 'true' },
          `${serialHex(f).replace(/ /g, '')}\u00b7`.repeat(9)),
        h('div', {},
          h('div', { class: 'pass__name' }, student.name),
          h('div', { class: 'pass__name ml', style: 'font-size:15px;color:var(--ink-2)' }, student.malayalam),
          h('div', { class: 'pass__course' }, student.course),
        ),
        qrHost,
        rotor,
      ),
    );

    const kv = h('dl', { class: 'kv' });
    const put = (k: string, v: string, mono = false): void => {
      kv.appendChild(h('dt', {}, k));
      kv.appendChild(h('dd', { class: mono ? 'mono' : '' }, v));
    };
    put('Entitled route', entitledRouteLabel(student.homeDepot, student.instDepot));
    put('Covers', classesIn(f.classMask).join(', '));
    put('Valid until', dayToDate(f.validToDay).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }));
    put('Home stop', DEPOTS[student.homeDepot]?.name ?? '—');
    put('Device key', `${[...f.devicePublicRaw.slice(1, 7)].map((b) => b.toString(16).padStart(2, '0')).join(' ')} …`, true);
    put('Issuer key id', f.instKeyId.length ? [...f.instKeyId].map((b) => b.toString(16).padStart(2, '0')).join('') : '—', true);

    const age = dayNumber(deviceClock.now()) - student.status.day;
    kv.appendChild(h('dt', {}, 'Status checked'));
    kv.appendChild(
      h('dd', {},
        age <= 0 ? 'today' : `${age} day${age === 1 ? '' : 's'} ago`,
        h('span', { style: 'margin-left:8px' },
          age > MAX_STATUS_AGE_DAYS
            ? pill('pill--bad', `over the ${MAX_STATUS_AGE_DAYS}-day window`)
            : pill('pill--ok', `within ${MAX_STATUS_AGE_DAYS} days`)),
      ),
    );

    detailHost.appendChild(kv);
    detailHost.appendChild(
      h('div', { class: 'row' },
        h('button', {
          class: 'btn btn--ghost btn--sm',
          type: 'button',
          onclick: () => {
            void (async () => {
              const ok = await refreshStatus(ctx.world, student, deviceClock.now());
              toast(ok
                ? 'Status refreshed — the institution re-signed this pass.'
                : 'The institution refused: this pass is revoked.');
              await render();
              ctx.save();
            })();
          },
        }, 'Check in with the institution'),
        h('span', { class: 'note' }, 'what the wallet does whenever it has a network'),
      ),
    );

    clear(mapHost);
    mapHost.appendChild(
      keralaMap({
        showDepots: true,
        links: [{ from: DEPOTS[student.homeDepot], to: DEPOTS[student.instDepot] }],
        points: [
          { id: 'home', point: DEPOTS[student.homeDepot], weight: 3, tone: 'accent', title: `Home stop — ${DEPOTS[student.homeDepot].name}` },
          { id: 'inst', point: DEPOTS[student.instDepot], weight: 3, tone: 'good', title: `Institution — ${DEPOTS[student.instDepot].name}` },
        ],
      }),
    );

    await drawProof();
    tickRotor();
  }

  const handBtn = h('button', {
    class: 'btn',
    type: 'button',
    onclick: () => {
      if (!currentProof) return;
      ctx.handoff = { proof: currentProof, student, mintedAt: Date.now() };
      toast('Proof handed to the conductor screen.');
      ctx.go('scanner');
    },
  }, 'Show this to the conductor');

  const copyBtn = h('button', {
    class: 'btn btn--ghost',
    type: 'button',
    onclick: () => {
      if (!currentProof) return;
      const text = proofToText(currentProof);
      void navigator.clipboard?.writeText(text).then(
        () => toast('Proof text copied — paste it into the scanner.'),
        () => toast('Clipboard is blocked here; use the hand-over button instead.'),
      );
    },
  }, 'Copy proof text');

  void render();
  timer = window.setInterval(() => {
    tickRotor();
    const remaining = BUCKET_SECONDS - ((Date.now() / 1000) % BUCKET_SECONDS);
    if (remaining > BUCKET_SECONDS - 1.2) void drawProof();
  }, 1000);

  const root = h(
    'div',
    { class: 'grid grid--wallet' },
    panel('Student wallet', 'On the phone', detailHost,
      h('span', { class: 'note' }, 'works with the network off')),
    h('div', { class: 'grid grid--split' },
      h('div', { style: 'display:grid;gap:18px' },
        panel('Whose pass', 'Demo', h('div', { class: 'panel__body' },
          h('div', { class: 'field' }, h('label', { for: 'oppu-student' }, 'Open a wallet'), picker),
          h('div', { class: 'row' }, handBtn, copyBtn),
          h('p', { class: 'note' },
            'On a phone the conductor scans the screen \u2014 tap the code to blow it up first. On one laptop, hand ' +
            'the proof across to the scanner tab; the bytes are identical either way.'),
        )),
        panel('What the QR actually carries', 'Protocol', h('div', { class: 'panel__body' },
          h('div', { class: 'prose' },
            h('p', {},
              'A 297-byte envelope: the credential the institution signed, that signature, a 68-byte token saying the ' +
              'institution has not revoked it, the current half-minute, and this device\u2019s signature over all of it. ' +
              'No name, no roll number, no address \u2014 a conductor learns only that a valid student of a named ' +
              'institution is boarding within their entitlement.'),
            h('p', {},
              'The device key was generated inside this browser as non-extractable and kept in its key store. It cannot ' +
              'be exported, copied into a friend\u2019s phone, or lifted from a screenshot \u2014 and it is still the ' +
              'same key after you reload this page.'),
          ),
        )),
      ),
      panel('Entitled journey', 'Where the concession applies', mapHost,
        h('span', { class: 'note' }, 'home stop to institution')),
    ),
  );

  root.addEventListener('oppu:teardown', () => window.clearInterval(timer));
  return root;
}

export function studentLabel(s: Student): string {
  return `${s.name} (${s.institutionCode})`;
}
