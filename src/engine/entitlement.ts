import { DEPOTS } from '../data/depots';
import { haversineKm, type LatLng } from './geo';

const CORRIDOR_TOLERANCE_KM = 14;
const ENDPOINT_TOLERANCE_KM = 12;

function pointToSegmentKm(p: LatLng, a: LatLng, b: LatLng): number {
  const k = Math.cos((p.lat * Math.PI) / 180);
  const ax = a.lng * k;
  const bx = b.lng * k;
  const px = p.lng * k;
  const dx = bx - ax;
  const dy = b.lat - a.lat;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (p.lat - a.lat) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return haversineKm(p, { lat: a.lat + t * dy, lng: (ax + t * dx) / k });
}

/**
 * The concession is granted for the journey between a student's registered home
 * stop and their institution. A boarding far off that line is not covered, and
 * the scanner can decide that with nothing but the numbers already in the pass.
 */
export function onEntitledRoute(homeDepot: number, instDepot: number, boardingDepot: number): boolean {
  const home = DEPOTS[homeDepot];
  const inst = DEPOTS[instDepot];
  const boarding = DEPOTS[boardingDepot];
  if (!home || !inst || !boarding) return false;
  if (haversineKm(boarding, home) <= ENDPOINT_TOLERANCE_KM) return true;
  if (haversineKm(boarding, inst) <= ENDPOINT_TOLERANCE_KM) return true;
  return pointToSegmentKm(boarding, home, inst) <= CORRIDOR_TOLERANCE_KM;
}

export function entitledRouteLabel(homeDepot: number, instDepot: number): string {
  return `${DEPOTS[homeDepot]?.name ?? '—'} → ${DEPOTS[instDepot]?.name ?? '—'}`;
}
