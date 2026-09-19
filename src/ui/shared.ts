import { h } from './dom';
import type { VerifyResult } from '../engine/credential';
import { REASON_TEXT } from '../engine/credential';
import type { World, Student } from '../engine/world';

export interface AppCtx {
  world: World;
  go: (tab: string) => void;
  handoff: { proof: Uint8Array; student: Student; mintedAt: number } | null;
  walletStudentId: string;
  refresh: () => void;
  save: () => void;
}

export function panel(
  title: string,
  eyebrow: string,
  body: HTMLElement,
  aside?: HTMLElement | null,
): HTMLElement {
  return h(
    'section',
    { class: 'panel' },
    h(
      'div',
      { class: 'panel__head' },
      h('div', {}, h('div', { class: 'eyebrow' }, eyebrow), h('h2', { style: 'font-size:15px' }, title)),
      aside ?? null,
    ),
    body,
  );
}

export function pill(cls: string, text: string): HTMLElement {
  return h('span', { class: `pill ${cls}` }, text);
}

export function tile(n: string, label: string): HTMLElement {
  return h('div', { class: 'tile' }, h('div', { class: 'tile__n' }, n), h('div', { class: 'tile__l' }, label));
}

export function stepList(result: VerifyResult, reveal = false): HTMLElement {
  const wrap = h('div', { class: reveal ? 'steps steps--reveal' : 'steps' });
  result.steps.forEach((s, i) => {
    wrap.appendChild(
      h(
        'div',
        { class: 'step', style: reveal ? `animation-delay:${i * 70}ms` : '' },
        h('div', { class: `step__glyph step__glyph--${s.pass ? 'ok' : 'bad'}` }, s.pass ? '✓' : '✗'),
        h('div', {}, h('div', { class: 'step__title' }, s.title), h('div', { class: 'step__detail' }, s.detail)),
      ),
    );
  });
  return wrap;
}

export function verdictBox(result: VerifyResult, extra?: string, fare?: string): HTMLElement {
  return h(
    'div',
    { class: `verdict verdict--${result.accepted ? 'ok' : 'bad'}`, role: 'status' },
    h('div', { class: 'verdict__head' },
      h('span', { class: 'verdict__glyph', 'aria-hidden': 'true' }, result.accepted ? '\u2713' : '\u2717'),
      h('span', {}, result.accepted ? 'Concession valid' : 'Not accepted')),
    fare ? h('div', { class: 'verdict__fare' }, fare) : null,
    h('div', { class: 'verdict__why' }, REASON_TEXT[result.reason]),
    h(
      'div',
      { class: 'verdict__meta' },
      `decided ${result.elapsedMs < 1 ? 'in under a millisecond' : `in ${result.elapsedMs} ms`}, entirely on this device${extra ? ` · ${extra}` : ''}`,
    ),
    result.phrase ? h('div', {}, h('span', { class: 'phrase' }, `check phrase — ${result.phrase}`)) : null,
  );
}

export const rupees = (n: number): string => `₹${n.toLocaleString('en-IN')}`;
