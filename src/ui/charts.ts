import { h, s } from './dom';

export interface BarDatum {
  label: string;
  value: number;
  note?: string;
}

export function horizontalBars(data: BarDatum[], opts: { width?: number; unit?: string } = {}): SVGElement {
  const W = opts.width ?? 520;
  const rowH = 26;
  const labelW = 168;
  const right = 46;
  const H = data.length * rowH + 12;
  const max = Math.max(1, ...data.map((d) => d.value));
  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img' });

  data.forEach((d, i) => {
    const y = i * rowH + 6;
    const w = ((W - labelW - right) * d.value) / max;
    svg.appendChild(
      s('text', { x: labelW - 8, y: y + 12, 'text-anchor': 'end' }, d.label),
    );
    const bar = s('rect', {
      x: labelW,
      y: y + 3,
      width: Math.max(2, w).toFixed(1),
      height: 12,
      rx: 4,
      fill: 'var(--c1)',
      'fill-opacity': 0.85,
    });
    bar.appendChild(s('title', {}, `${d.label}: ${d.value}${opts.unit ?? ''}${d.note ? ` · ${d.note}` : ''}`));
    svg.appendChild(bar);
    svg.appendChild(
      s('text', { class: 'val', x: labelW + Math.max(2, w) + 7, y: y + 13 }, `${d.value}${opts.unit ?? ''}`),
    );
  });

  return svg;
}

export interface Series {
  name: string;
  color: string;
  points: { x: number; y: number }[];
}

export function lineChart(
  series: Series[],
  opts: { width?: number; height?: number; xLabels: string[]; yUnit?: string },
): HTMLElement {
  const W = opts.width ?? 560;
  const H = opts.height ?? 200;
  const padL = 34;
  const padR = 58;
  const padT = 12;
  const padB = 26;
  const xs = series[0]?.points.length ?? 0;
  const maxY = Math.max(1, ...series.flatMap((se) => se.points.map((p) => p.y)));
  const niceMax = Math.ceil(maxY / 4) * 4 || 4;

  const px = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, xs - 1);
  const py = (v: number) => H - padB - (v / niceMax) * (H - padT - padB);

  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img' });

  for (let g = 0; g <= 4; g++) {
    const v = (niceMax / 4) * g;
    svg.appendChild(s('line', { class: 'gridline', x1: padL, x2: W - padR, y1: py(v), y2: py(v) }));
    svg.appendChild(s('text', { x: padL - 7, y: py(v) + 3.5, 'text-anchor': 'end' }, String(v)));
  }

  opts.xLabels.forEach((lab, i) => {
    if (xs > 6 && i % 2 === 1 && i !== xs - 1) return;
    svg.appendChild(s('text', { x: px(i), y: H - padB + 14, 'text-anchor': 'middle' }, lab));
  });

  for (const se of series) {
    const d = se.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${py(p.y).toFixed(1)}`).join(' ');
    svg.appendChild(s('path', { d, fill: 'none', stroke: se.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    const last = se.points[se.points.length - 1];
    svg.appendChild(
      s('circle', { cx: px(se.points.length - 1), cy: py(last.y), r: 4, fill: se.color, stroke: 'var(--surface)', 'stroke-width': 2 }),
    );
    svg.appendChild(
      s('text', { class: 'val', x: px(se.points.length - 1) + 9, y: py(last.y) + 3.5, fill: 'var(--ink)' }, `${last.y} ${se.name}`),
    );
  }

  svg.appendChild(s('line', { class: 'axis', x1: padL, x2: W - padR, y1: H - padB, y2: H - padB }));

  const legend = h(
    'div',
    { class: 'legend' },
    ...series.map((se) =>
      h(
        'span',
        { style: 'display:inline-flex;align-items:center;gap:6px' },
        h('i', { class: 'swatch', style: `background:${se.color}` }),
        se.name,
      ),
    ),
  );

  return h('div', { style: 'display:grid;gap:8px' }, svg, legend);
}

export function sparkArea(values: number[], opts: { width?: number; height?: number; max?: number } = {}): SVGElement {
  const W = opts.width ?? 520;
  const H = opts.height ?? 120;
  const max = opts.max ?? Math.max(1, ...values);
  if (values.length < 2) {
    return s(
      'svg',
      { class: 'chart', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', role: 'img', style: `height:${H}px` },
      s('line', { x1: 0, x2: W, y1: H - 6, y2: H - 6, stroke: 'var(--line)', 'stroke-width': 2 }),
    );
  }
  const n = values.length;
  const px = (i: number) => (i * W) / (n - 1);
  const py = (v: number) => H - 6 - (Math.min(v, max) / max) * (H - 16);
  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)} ${py(v).toFixed(1)}`).join(' ');
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  return s(
    'svg',
    { class: 'chart', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', role: 'img', style: `height:${H}px` },
    s('path', { d: area, fill: 'var(--accent)', 'fill-opacity': 0.14 }),
    s('path', { d: line, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2 }),
  );
}
