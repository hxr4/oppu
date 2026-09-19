import { h, clear, toast, fmtAgo } from './dom';
import { panel, pill, stepList, verdictBox, rupees, type AppCtx } from './shared';
import { decodeFrame } from '../engine/qr';
import {
  SERVICE_CLASSES, proofToText, serialHex, textToProof, verifyProof,
  type ServiceClass, type VerifyResult,
} from '../engine/credential';
import { onEntitledRoute } from '../engine/entitlement';
import { recordReceipt } from '../engine/world';
import { DEPOTS } from '../data/depots';

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

export function scannerView(ctx: AppCtx): HTMLElement {
  let serviceClass: ServiceClass = 'Ordinary';
  let boardingDepot = ctx.world.students[0].homeDepot;

  const verdictHost = h('div', { class: 'panel__body' });
  const queueHost = h('div', { class: 'panel__body' });
  const cameraHost = h('div', {});
  let stream: MediaStream | null = null;
  let scanning = false;
  let raf = 0;

  const pasteBox = h('textarea', {
    id: 'oppu-paste',
    placeholder: 'OPPU1:…',
    spellcheck: false,
  });

  async function runVerify(text: string, source: string): Promise<void> {
    const proof = textToProof(text);
    if (!proof) {
      clear(verdictHost);
      verdictHost.appendChild(
        h('div', { class: 'verdict verdict--bad' },
          h('div', { class: 'verdict__head' }, 'Not accepted'),
          h('div', { class: 'verdict__why' }, 'That is not an OPPU pass.'),
        ),
      );
      return;
    }

    const result: VerifyResult = await verifyProof(proof, {
      trust: ctx.world.trust,
      revocations: ctx.world.revocations,
      nowMs: Date.now(),
      serviceClass,
      boardingDepot,
      routeCheck: onEntitledRoute,
    });

    let receiptNote = '';
    if (result.accepted && result.fields && result.institution) {
      const receipt = await recordReceipt(
        ctx.world,
        serialHex(result.fields),
        result.institution.code,
        boardingDepot,
        result.fields.instDepot,
        serviceClass,
      );
      receiptNote = `${rupees(receipt.fareConcession)} collected, ${rupees(receipt.subsidy)} carried as subsidy`;
    } else if (result.fields) {
      ctx.world.rejections.push({
        serialHex: serialHex(result.fields),
        reason: result.reason,
        ts: Date.now(),
        depot: boardingDepot,
      });
    }

    clear(verdictHost);
    verdictHost.appendChild(verdictBox(result, source));
    if (receiptNote) {
      verdictHost.appendChild(h('p', { class: 'note' }, `Signed receipt queued — ${receiptNote}.`));
    }
    verdictHost.appendChild(stepList(result));
    renderQueue();
  }

  function renderQueue(): void {
    const pending = ctx.world.receipts.filter((r) => !r.synced);
    clear(queueHost);
    queueHost.appendChild(
      h('div', { class: 'row' },
        h('span', { class: 'tile__n', style: 'font-size:22px' }, String(pending.length)),
        h('span', { class: 'note' }, 'signed receipts waiting for a network'),
        h('button', {
          class: 'btn btn--ghost btn--sm',
          type: 'button',
          style: 'margin-left:auto',
          disabled: pending.length === 0,
          onclick: () => {
            for (const r of ctx.world.receipts) r.synced = true;
            toast(`${pending.length} receipts synced at the depot.`);
            renderQueue();
          },
        }, 'Sync at the depot'),
      ),
    );
    const rows = h('div', { class: 'rows' });
    for (const r of pending.slice(0, 8)) {
      rows.appendChild(
        h('div', { class: 'rowitem', style: 'cursor:default' },
          h('div', { class: 'rowitem__top' },
            pill('pill--plain', r.instCode),
            h('span', { class: 'mono', style: 'font-size:11px' }, r.serialHex),
            h('span', { class: 'note', style: 'margin-left:auto' }, fmtAgo(r.ts)),
          ),
          h('div', { class: 'note' },
            `${DEPOTS[r.boardingDepot]?.name ?? '—'} · ${r.km.toFixed(0)} km · ${rupees(r.subsidy)} subsidy · sig ${r.signatureB64.slice(0, 12)}…`),
        ),
      );
    }
    if (!pending.length) {
      rows.appendChild(h('div', { class: 'note', style: 'padding:8px 0' }, 'Everything has reached the depot.'));
    }
    queueHost.appendChild(rows);
  }

  async function startCamera(): Promise<void> {
    if (scanning) return stopCamera();
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    } catch {
      toast('No camera available here — use the hand-over or paste route.');
      return;
    }
    scanning = true;
    const video = h('video', { autoplay: true, muted: true, playsInline: true }) as HTMLVideoElement;
    video.srcObject = stream;
    clear(cameraHost);
    cameraHost.appendChild(video);
    await video.play().catch(() => undefined);

    const canvas = document.createElement('canvas');
    const g = canvas.getContext('2d', { willReadFrequently: true });
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => BarcodeDetectorLike }).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;

    const loop = async (): Promise<void> => {
      if (!scanning) return;
      if (video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        g?.drawImage(video, 0, 0);
        let text: string | null = null;
        if (detector) {
          const found = await detector.detect(canvas).catch(() => []);
          text = found[0]?.rawValue ?? null;
        } else if (g) {
          const frame = g.getImageData(0, 0, canvas.width, canvas.height);
          text = decodeFrame(frame.data, canvas.width, canvas.height);
        }
        if (text) {
          stopCamera();
          await runVerify(text, 'camera');
          return;
        }
      }
      raf = requestAnimationFrame(() => void loop());
    };
    void loop();
  }

  function stopCamera(): void {
    scanning = false;
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    clear(cameraHost);
  }

  const controls = h(
    'div',
    { class: 'panel__body' },
    h('div', { class: 'field' },
      h('label', { for: 'oppu-class' }, 'Class of service'),
      h('select', {
        id: 'oppu-class',
        onchange: (e: Event) => { serviceClass = (e.target as HTMLSelectElement).value as ServiceClass; },
      }, ...SERVICE_CLASSES.map((c) => h('option', { value: c }, c))),
    ),
    h('div', { class: 'field' },
      h('label', { for: 'oppu-depot' }, 'Boarding stop'),
      h('select', {
        id: 'oppu-depot',
        onchange: (e: Event) => { boardingDepot = Number((e.target as HTMLSelectElement).value); },
      }, ...DEPOTS.map((d, i) => h('option', { value: String(i), selected: i === boardingDepot }, `${d.name} — ${d.district}`))),
    ),
    h('div', { class: 'row' },
      h('button', {
        class: 'btn',
        type: 'button',
        onclick: () => {
          if (!ctx.handoff) {
            toast('Open a wallet first and hand the proof over.');
            return ctx.go('wallet');
          }
          void runVerify(proofToText(ctx.handoff.proof), 'handed over');
        },
      }, 'Read the pass in front of me'),
      h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => void startCamera() }, 'Use the camera'),
    ),
    cameraHost,
    h('div', { class: 'field' },
      h('label', { for: 'oppu-paste' }, 'Or paste a proof'),
      pasteBox,
      h('button', {
        class: 'btn btn--ghost btn--sm',
        type: 'button',
        onclick: () => void runVerify(pasteBox.value, 'pasted'),
      }, 'Verify pasted proof'),
    ),
  );

  clear(verdictHost);
  verdictHost.appendChild(
    h('p', { class: 'lede' },
      'Nothing here talks to a server. The device holds the transport authority root key, four institution keys and a ' +
      'signed revocation digest — under two kilobytes in total — and that is enough to settle every pass in the state.'),
  );
  renderQueue();

  const root = h(
    'div',
    { class: 'grid grid--work' },
    h('div', { style: 'display:grid;gap:18px' },
      panel('Conductor scanner', 'On the bus', controls,
        h('span', { class: 'note' }, 'offline by design')),
      panel('Offline receipt queue', 'Waiting to sync', queueHost),
    ),
    panel('Verdict', 'Decision', verdictHost),
  );
  root.addEventListener('oppu:teardown', () => stopCamera());
  return root;
}
