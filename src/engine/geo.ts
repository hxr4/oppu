import { DEPOTS, DEPOT_BY_CODE, CORRIDORS, type Depot, type Corridor } from '../data/depots';

export interface LatLng {
  lat: number;
  lng: number;
}

const R = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function metresBetween(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) * 1000;
}

/**
 * Straight-line distance inflated by a detour factor, a cheap stand-in for
 * road distance until a routing service is wired in.
 */
const DETOUR = 1.32;

export function roadDistanceKm(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) * DETOUR;
}

export interface DepotDistance {
  depot: Depot;
  km: number;
  withinJurisdiction: boolean;
}

export function rankDepots(point: LatLng, limit = 5): DepotDistance[] {
  return DEPOTS.map((depot) => {
    const km = roadDistanceKm(point, depot);
    return { depot, km, withinJurisdiction: km <= depot.radiusKm };
  })
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

function pointToSegmentKm(p: LatLng, a: LatLng, b: LatLng): number {
  const k = Math.cos((p.lat * Math.PI) / 180);
  const px = p.lng * k;
  const ax = a.lng * k;
  const bx = b.lng * k;
  const dx = bx - ax;
  const dy = b.lat - a.lat;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (p.lat - a.lat) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const projLat = a.lat + t * dy;
  const projLng = (ax + t * dx) / k;
  return haversineKm(p, { lat: projLat, lng: projLng });
}

export interface CorridorHit {
  corridor: Corridor;
  km: number;
}

export function corridorsNear(point: LatLng, toleranceKm = 6): CorridorHit[] {
  const hits: CorridorHit[] = [];
  for (const corridor of CORRIDORS) {
    let best = Infinity;
    for (let i = 0; i < corridor.via.length - 1; i++) {
      const a = DEPOT_BY_CODE[corridor.via[i]];
      const b = DEPOT_BY_CODE[corridor.via[i + 1]];
      if (!a || !b) continue;
      best = Math.min(best, pointToSegmentKm(point, a, b));
    }
    if (best <= toleranceKm) hits.push({ corridor, km: Number(best.toFixed(2)) });
  }
  return hits.sort((a, b) => a.km - b.km);
}

export function segmentKey(point: LatLng, metres = 250): string {
  const dLat = metres / 111320;
  const dLng = metres / (111320 * Math.cos((point.lat * Math.PI) / 180));
  return `${Math.round(point.lat / dLat)}:${Math.round(point.lng / dLng)}`;
}
