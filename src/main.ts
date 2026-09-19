import './styles/app.css';
import { h, clear } from './ui/dom';
import { buildWorld } from './engine/world';
import type { AppCtx } from './ui/shared';
import { walletView } from './ui/wallet';
import { scannerView } from './ui/scanner';
import { issuerView } from './ui/issuer';
import { ledgerView } from './ui/ledger';
import { benchView } from './ui/bench';
import { methodView } from './ui/method';

const TABS = [
  { id: 'wallet', label: 'Student wallet' },
  { id: 'scanner', label: 'Conductor' },
  { id: 'bench', label: 'Attack bench' },
  { id: 'issuer', label: 'Institution' },
  { id: 'ledger', label: 'Subsidy ledger' },
  { id: 'method', label: 'How it works' },
];

const viewHost = h('div', { class: 'wrap' });
const tabBar = h('nav', { class: 'tabs', role: 'tablist', 'aria-label': 'Sections' });

let current = 'wallet';
let ctx: AppCtx;
let mounted: HTMLElement | null = null;

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
              : methodView();

  mounted = view;
  viewHost.appendChild(view);
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

  const loading = h('div', { class: 'wrap', style: 'padding-block:40px' },
    h('p', { class: 'lede' }, 'Generating the authority root, four institution keys and six device keys in this browser…'));
  document.body.appendChild(h('main', {}, viewHost));
  viewHost.appendChild(loading);

  const world = await buildWorld();
  ctx = {
    world,
    go: (tab) => { current = tab; render(); },
    handoff: null,
    walletStudentId: world.students[0].id,
    refresh: () => render(),
  };
  render();
}

void boot();
