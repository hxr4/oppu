import { PROOF_LEN, STATUS_LEN, MAX_STATUS_AGE_DAYS } from './credential';

export interface ScaleAssumptions {
  students: number;
  revokedPerYearPct: number;
  boardingsPerStudentPerDay: number;
  busesInFleet: number;
}

export const KERALA_SCALE: ScaleAssumptions = {
  students: 1_200_000,
  revokedPerYearPct: 4,
  boardingsPerStudentPerDay: 2,
  busesInFleet: 5_000,
};

export interface ScaleResult {
  proofBytes: number;
  statusBytes: number;
  receiptBytes: number;
  listRevocationBytesPerBus: number;
  statusRevocationBytesPerBus: number;
  receiptsPerDay: number;
  syncBytesPerBusPerDay: number;
  studentSyncBytesPerWeek: number;
}

const RECEIPT_BYTES = 8 + 4 + 2 + 2 + 4 + 2 + 2 + 4 + 64;

/**
 * Two ways to answer "is this pass still valid": ship every revoked serial to
 * every bus, or have the pass carry a recent signed statement from its own
 * institution. The first grows with the number of revocations in the state; the
 * second is a fixed 68 bytes in the proof, no matter how large Kerala gets.
 */
export function project(a: ScaleAssumptions = KERALA_SCALE): ScaleResult {
  const revokedPerYear = Math.round((a.students * a.revokedPerYearPct) / 100);
  const receiptsPerDay = a.students * a.boardingsPerStudentPerDay;
  return {
    proofBytes: PROOF_LEN,
    statusBytes: STATUS_LEN,
    receiptBytes: RECEIPT_BYTES,
    listRevocationBytesPerBus: revokedPerYear * 8 + 68,
    statusRevocationBytesPerBus: 0,
    receiptsPerDay,
    syncBytesPerBusPerDay: Math.round((receiptsPerDay / a.busesInFleet) * RECEIPT_BYTES),
    studentSyncBytesPerWeek: STATUS_LEN,
  };
}

export function revocationCurve(a: ScaleAssumptions = KERALA_SCALE): { students: number; listKb: number }[] {
  return [50_000, 200_000, 500_000, 1_200_000, 2_000_000].map((students) => ({
    students,
    listKb: Number((((students * a.revokedPerYearPct) / 100) * 8) / 1024),
  }));
}

export const statusWindowDays = MAX_STATUS_AGE_DAYS;
