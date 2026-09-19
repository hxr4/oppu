import { h, clear, toast } from './dom';
import { panel, pill, type AppCtx } from './shared';
import { qrPath } from '../engine/qr';
import { checkPhrase } from '../engine/crypto';
import {
  BUCKET_SECONDS, classesIn, dayToDate, makeProof, proofToText, serialHex,
} from '../engine/credential';
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
    const now = Date.now();
    const proof = await makeProof(student.credential, student.deviceKeys.privateKey, now);
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
    qrHost.appendChild(svg);
    qrHost.appendChild(h('span', { class: 'phrase' }, phrase));
    qrHost.appendChild(
      h('div', { class: 'note', style: 'text-align:center' },
        `${text.length} characters · ${count}×${count} modules · reissues every ${BUCKET_SECONDS} s`),
    );
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

    detailHost.appendChild(kv);

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
    h('div', { style: 'display:grid;gap:18px' },
      panel('Whose pass', 'Demo', h('div', { class: 'panel__body' },
        h('div', { class: 'field' }, h('label', { for: 'oppu-student' }, 'Open a wallet'), picker),
        h('div', { class: 'row' }, handBtn, copyBtn),
        h('p', { class: 'note' },
          'On a phone the conductor simply scans the screen. On a laptop, hand the proof across to the scanner tab — the bytes are identical either way.'),
      )),
      panel('Entitled journey', 'Where the concession applies', mapHost,
        h('span', { class: 'note' }, 'home stop to institution')),
      panel('What the QR actually carries', 'Protocol', h('div', { class: 'panel__body' },
        h('div', { class: 'prose' },
          h('p', {},
            'A 229-byte envelope: the credential the institution signed, that signature, the current half-minute, ' +
            'and this device’s signature over the two. No name, no roll number, no address — a conductor learns ' +
            'only that a valid student of a named institution is boarding within their entitlement.'),
          h('p', {},
            'The device key was generated inside this browser as non-extractable. It cannot be exported, copied ' +
            'into a friend’s phone, or lifted from a screenshot.'),
        ),
      )),
    ),
  );

  root.addEventListener('oppu:teardown', () => window.clearInterval(timer));
  return root;
}

export function studentLabel(s: Student): string {
  return `${s.name} (${s.institutionCode})`;
}
