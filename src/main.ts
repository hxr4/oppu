import './styles/app.css';
import { h, clear, toast } from './ui/dom';
import { buildWorld, type World } from './engine/world';
import { loadWorld, saveWorld, clearVault, vaultAvailable } from './engine/vault';
import { deviceClock, verifyBeacon } from './engine/clock';
import type { AppCtx } from './ui/shared';
import { walletView } from './ui/wallet';
import { scannerView } from './ui/scanner';
import { issuerView } from './ui/issuer';
import { ledgerView } from './ui/ledger';
import { benchView } from './ui/bench';
import { scaleView } from './ui/scale';
import { methodView } from './ui/method';

const TABS = [
  { id: 'wallet', label: 'Student wallet' },
  { id: 'scanner', label: 'Conductor' },
  { id: 'bench', label: 'Attack bench' },
  { id: 'issuer', label: 'Institution' },
  { id: 'ledger', label: 'Subsidy ledger' },
  { id: 'scale', label: 'Scale' },
  { id: 'method', label: 'How it works' },
];

const viewHost = h('div', { class: 'wrap' });
const tabBar = h('nav', { class: 'tabs', role: 'tablist', 'aria-label': 'Sections' });

let current = 'wallet';
let ctx: AppCtx;
let mounted: HTMLElement | null = null;
let saveTimer = 0;

function render(): void {
  clear(tabBar);
  for (const t of TABS) {
    tabBar.appendChild(
      h('button', {
        class: 'tab',
        type: 'button',
        role: 'tab',
        'aria-selected': String(current === t.id),
        onclick: () => { current = t.id; render(); },
      }, t.label),
    );
  }

  mounted?.dispatchEvent(new CustomEvent('oppu:teardown'));
  clear(viewHost);

  const view =
    current === 'wallet' ? walletView(ctx)
      : current === 'scanner' ? scannerView(ctx)
        : current === 'bench' ? benchView(ctx)
          : current === 'issuer' ? issuerView(ctx)
            : current === 'ledger' ? ledgerView(ctx)
              : current === 'scale' ? scaleView(ctx)
                : methodView();

  mounted = view;
  viewHost.appendChild(view);
}

function scheduleSave(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => void saveWorld(ctx.world), 400);
}

function statusBar(restored: boolean): HTMLElement {
  return h(
    'div',
    { class: 'wrap', style: 'padding-block:10px 0;display:flex;gap:10px;flex-wrap:wrap;align-items:center' },
    h('span', { class: 'note' },
      vaultAvailable()
        ? restored
          ? 'Passes restored from this device’s secure key store — same device keys as your last visit.'
          : 'New passes generated and stored in this device’s key store. Reload: they survive.'
        : 'This browser has no key store available, so passes live only until you reload.'),
    h('button', {
      class: 'btn btn--ghost btn--sm',
      type: 'button',
      style: 'margin-left:auto',
      onclick: () => {
        void (async () => {
          await clearVault();
          location.reload();
        })();
      },
    }, 'Reset demo data'),
  );
}

async function boot(): Promise<void> {
  const masthead = h(
    'header',
    { class: 'masthead' },
    h('div', { class: 'wrap masthead__row' },
      h('div', { class: 'mark' },
        h('span', { class: 'mark__word' }, 'OPPU'),
        h('span', { class: 'mark__ml' }, 'ഒപ്പ്'),
        h('span', { class: 'mark__sub' }, 'Student concession pass for Kerala state buses'),
      ),
      tabBar,
    ),
  );
  document.body.appendChild(masthead);

  const shell = h('main', {});
  const bar = h('div', {});
  shell.appendChild(bar);
  shell.appendChild(viewHost);
  document.body.appendChild(shell);

  viewHost.appendChild(
    h('div', { style: 'padding-block:40px' },
      h('p', { class: 'lede' }, 'Opening this device’s key store…')),
  );

  let world: World | null = await loadWorld();
  const restored = world !== null;
  if (!world) world = await buildWorld();

  if (await verifyBeacon(world.trust.rootPublicRaw, world.beacon)) deviceClock.adopt(world.beacon);

  ctx = {
    world,
    go: (tab) => { current = tab; render(); },
    handoff: null,
    walletStudentId: world.students[0].id,
    refresh: () => render(),
    save: () => scheduleSave(),
  };

  bar.appendChild(statusBar(restored));
  if (!restored) void saveWorld(world);
  render();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => undefined);
  }

  window.addEventListener('offline', () => toast('Network lost. Nothing here needs it.'));
}

void boot();
