import { DEPOTS } from '../data/depots';
import { haversineKm } from './geo';
import type { ServiceClass } from './credential';

export interface Receipt {
  id: string;
  serialHex: string;
  instCode: string;
  boardingDepot: number;
  serviceClass: ServiceClass;
  km: number;
  fareOrdinary: number;
  fareConcession: number;
  subsidy: number;
  ts: number;
  conductorId: string;
  conductorKeyIdHex: string;
  signatureB64: string;
  synced: boolean;
}

export const CONCESSION_FLAT = 6;

/**
 * Illustrative stage-fare model. Production reads the published KSRTC fare
 * table; the structure — an ordinary fare the state would otherwise collect, a
 * flat concessional fare the student pays, and the difference carried as
 * subsidy — is what the ledger is actually about.
 */
export function ordinaryFare(km: number, cls: ServiceClass): number {
  const base = km <= 5 ? 10 : 10 + Math.ceil(km - 5) * 1.1;
  const multiplier =
    cls === 'Super fast' ? 1.35
      : cls === 'Fast passenger' ? 1.2
        : cls === 'Limited stop' ? 1.1
          : cls === 'Long distance' ? 1.4
            : 1;
  return Math.round(base * multiplier);
}

export function fareFor(km: number, cls: ServiceClass): { ordinary: number; concession: number; subsidy: number } {
  const ordinary = ordinaryFare(km, cls);
  const concession = CONCESSION_FLAT;
  return { ordinary, concession, subsidy: Math.max(0, ordinary - concession) };
}

export type AnomalyKind = 'impossible_travel' | 'over_daily_cap' | 'repeated_rejection';

export interface Anomaly {
  kind: AnomalyKind;
  serialHex: string;
  detail: string;
  at: number;
}

export const ANOMALY_LABEL: Record<AnomalyKind, string> = {
  impossible_travel: 'Impossible travel',
  over_daily_cap: 'Over the daily trip cap',
  repeated_rejection: 'Repeated failed attempts',
};

const MAX_PLAUSIBLE_KMH = 80;
const DAILY_CAP = 2;

/**
 * Offline acceptance cannot see a pass being used in two places at once.
 * Reconciliation can: once receipts reach the depot, a pass that boarded in two
 * districts within the hour is arithmetic, not suspicion.
 */
export function findAnomalies(
  receipts: Receipt[],
  rejections: { serialHex: string; ts: number }[],
): Anomaly[] {
  const out: Anomaly[] = [];
  const bySerial = new Map<string, Receipt[]>();
  for (const r of receipts) {
    const list = bySerial.get(r.serialHex) ?? [];
    list.push(r);
    bySerial.set(r.serialHex, list);
  }

  for (const [serial, list] of bySerial) {
    const sorted = [...list].sort((a, b) => a.ts - b.ts);
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1];
      const b = sorted[i];
      const gapHours = (b.ts - a.ts) / 3_600_000;
      const apart = haversineKm(DEPOTS[a.boardingDepot], DEPOTS[b.boardingDepot]);
      if (apart > 12 && gapHours > 0 && apart / gapHours > MAX_PLAUSIBLE_KMH) {
        out.push({
          kind: 'impossible_travel',
          serialHex: serial,
          at: b.ts,
          detail: `${DEPOTS[a.boardingDepot].name} then ${DEPOTS[b.boardingDepot].name}, ${apart.toFixed(0)} km apart in ${gapHours < 1 ? `${Math.round(gapHours * 60)} min` : `${gapHours.toFixed(1)} h`}.`,
        });
      }
    }

    const byDay = new Map<string, number>();
    for (const r of sorted) {
      const key = new Date(r.ts).toDateString();
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
    }
    for (const [day, n] of byDay) {
      if (n > DAILY_CAP) {
        out.push({
          kind: 'over_daily_cap',
          serialHex: serial,
          at: new Date(day).getTime(),
          detail: `${n} concessional boardings on ${new Date(day).toLocaleDateString('en-IN')}, against a cap of ${DAILY_CAP}.`,
        });
      }
    }
  }

  const rejectCount = new Map<string, { n: number; last: number }>();
  for (const r of rejections) {
    const cur = rejectCount.get(r.serialHex) ?? { n: 0, last: 0 };
    rejectCount.set(r.serialHex, { n: cur.n + 1, last: Math.max(cur.last, r.ts) });
  }
  for (const [serial, v] of rejectCount) {
    if (v.n >= 3) {
      out.push({
        kind: 'repeated_rejection',
        serialHex: serial,
        at: v.last,
        detail: `${v.n} rejected presentations of this serial.`,
      });
    }
  }

  return out.sort((a, b) => b.at - a.at);
}

export interface Reconciliation {
  boardings: number;
  subsidy: number;
  collected: number;
  wouldHaveBeen: number;
  byInstitution: { code: string; boardings: number; subsidy: number }[];
  byDay: { day: string; boardings: number; subsidy: number }[];
  unsynced: number;
}

export function reconcile(receipts: Receipt[]): Reconciliation {
  const byInst = new Map<string, { boardings: number; subsidy: number }>();
  const byDay = new Map<string, { boardings: number; subsidy: number }>();
  let subsidy = 0;
  let collected = 0;
  let wouldHaveBeen = 0;
  let unsynced = 0;

  for (const r of receipts) {
    subsidy += r.subsidy;
    collected += r.fareConcession;
    wouldHaveBeen += r.fareOrdinary;
    if (!r.synced) unsynced += 1;
    const i = byInst.get(r.instCode) ?? { boardings: 0, subsidy: 0 };
    i.boardings += 1;
    i.subsidy += r.subsidy;
    byInst.set(r.instCode, i);
    const key = new Date(r.ts).toISOString().slice(0, 10);
    const d = byDay.get(key) ?? { boardings: 0, subsidy: 0 };
    d.boardings += 1;
    d.subsidy += r.subsidy;
    byDay.set(key, d);
  }

  return {
    boardings: receipts.length,
    subsidy,
    collected,
    wouldHaveBeen,
    unsynced,
    byInstitution: [...byInst].map(([code, v]) => ({ code, ...v })).sort((a, b) => b.subsidy - a.subsidy),
    byDay: [...byDay].map(([day, v]) => ({ day, ...v })).sort((a, b) => a.day.localeCompare(b.day)),
  };
}
