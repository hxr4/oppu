import { s } from './dom';
import { DISTRICTS, MAP, project } from '../data/kerala-geo';
import { CORRIDORS, DEPOTS, DEPOT_BY_CODE } from '../data/depots';
import type { LatLng } from '../engine/geo';

export interface MapPoint {
  id: string;
  point: LatLng;
  weight: number;
  tone: 'accent' | 'good' | 'bad';
  title: string;
}

export interface MapOptions {
  points?: MapPoint[];
  selectedId?: string | null;
  marker?: LatLng | null;
  highlightCorridors?: string[];
  onPickPoint?: (p: LatLng) => void;
  onPickPoint2?: (id: string) => void;
  showDepots?: boolean;
  links?: { from: LatLng; to: LatLng }[];
}

export function unproject(x: number, y: number): LatLng {
  return {
    lng: MAP.lng0 + (x - MAP.pad) / (MAP.k * MAP.scale),
    lat: MAP.lat1 - (y - MAP.pad) / MAP.scale,
  };
}

export function keralaMap(o: MapOptions): SVGElement {
  const svg = s('svg', {
    class: 'mapsvg',
    viewBox: `0 0 ${MAP.width} ${MAP.height}`,
    role: 'img',
    'aria-label': 'Kerala with KSRTC corridors and reported issues',
  });

  for (const d of DISTRICTS) {
    svg.appendChild(s('path', { class: 'district', d: d.d }));
  }

  const hi = new Set(o.highlightCorridors ?? []);
  for (const c of CORRIDORS) {
    const pts = c.via
      .map((code) => DEPOT_BY_CODE[code])
      .filter(Boolean)
      .map((d) => project(d.lng, d.lat).map((n) => n.toFixed(1)).join(','))
      .join(' ');
    svg.appendChild(
      s('polyline', {
        class: hi.has(c.id) ? 'corridor corridor--hi' : 'corridor',
        points: pts,
      }),
    );
  }

  for (const link of o.links ?? []) {
    const [x1, y1] = project(link.from.lng, link.from.lat);
    const [x2, y2] = project(link.to.lng, link.to.lat);
    svg.appendChild(
      s('path', {
        d: `M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`,
        class: 'corridor corridor--hi',
      }),
    );
  }

  if (o.showDepots !== false) {
    for (const d of DEPOTS) {
      const [x, y] = project(d.lng, d.lat);
      svg.appendChild(
        s('circle', { class: 'depotdot', cx: x.toFixed(1), cy: y.toFixed(1), r: d.cls === 'central' ? 2.4 : 1.4 }),
      );
    }
  }

  for (const p of o.points ?? []) {
    const [x, y] = project(p.point.lng, p.point.lat);
    const sel = o.selectedId === p.id;
    const radius = 2.6 + Math.min(4.5, Math.log2(1 + p.weight) * 1.1);
    const fill = p.tone === 'good' ? 'var(--good)' : p.tone === 'bad' ? 'var(--bad)' : 'var(--accent)';
    const dot = s('circle', {
      class: sel ? 'pin pin--sel' : 'pin',
      cx: x.toFixed(1),
      cy: y.toFixed(1),
      r: radius.toFixed(1),
      fill,
      'fill-opacity': 0.85,
      onclick: () => o.onPickPoint2?.(p.id),
    });
    dot.appendChild(s('title', {}, p.title));
    svg.appendChild(dot);
  }

  if (o.marker) {
    const [x, y] = project(o.marker.lng, o.marker.lat);
    svg.appendChild(
      s('g', {}, 
        s('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 9, fill: 'var(--accent)', 'fill-opacity': 0.18 }),
        s('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 3.6, fill: 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': 1.4 }),
      ),
    );
  }

  if (o.onPickPoint) {
    svg.style.cursor = 'crosshair';
    svg.addEventListener('click', (ev) => {
      const target = ev.target as Element;
      if (target.classList.contains('pin')) return;
      const rect = svg.getBoundingClientRect();
      const me = ev as MouseEvent;
      const x = ((me.clientX - rect.left) / rect.width) * MAP.width;
      const y = ((me.clientY - rect.top) / rect.height) * MAP.height;
      o.onPickPoint?.(unproject(x, y));
    });
  }

  return svg;
}
