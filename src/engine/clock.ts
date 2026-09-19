import { importPublic, sign, verify } from './crypto';

export interface TimeBeacon {
  epochMs: number;
  signature: Uint8Array;
}

const beaconMessage = (epochMs: number): Uint8Array =>
  new TextEncoder().encode(`OPPU-TIME|${Math.round(epochMs / 1000)}`);

export async function issueBeacon(rootPrivate: CryptoKey, epochMs: number): Promise<TimeBeacon> {
  return { epochMs, signature: await sign(rootPrivate, beaconMessage(epochMs)) };
}

export async function verifyBeacon(rootPublicRaw: Uint8Array, beacon: TimeBeacon): Promise<boolean> {
  return verify(await importPublic(rootPublicRaw), beacon.signature, beaconMessage(beacon.epochMs));
}

/**
 * A scanner that trusts nothing but its own clock is one wrong wall-clock away
 * from rejecting a whole depot's students. At every depot sync the authority
 * hands the device a signed timestamp; from then on the device tells time by
 * that beacon plus its own monotonic counter, and treats the operating system
 * clock as a suggestion.
 */
export class DeviceClock {
  private beaconEpochMs = 0;
  private monotonicAnchor = 0;
  private simulatedSkewMs = 0;
  private trusted = false;

  /** What the device's own operating-system clock claims, including any simulated drift. */
  osNow(): number {
    return Date.now() + this.simulatedSkewMs;
  }

  now(): number {
    if (!this.trusted) return this.osNow();
    return this.beaconEpochMs + (performance.now() - this.monotonicAnchor);
  }

  adopt(beacon: TimeBeacon): void {
    this.beaconEpochMs = beacon.epochMs;
    this.monotonicAnchor = performance.now();
    this.trusted = true;
  }

  forget(): void {
    this.trusted = false;
  }

  get hasBeacon(): boolean {
    return this.trusted;
  }

  setSimulatedSkewMinutes(minutes: number): void {
    this.simulatedSkewMs = minutes * 60_000;
  }

  get skewMinutes(): number {
    return this.simulatedSkewMs / 60_000;
  }

  /** Seconds the operating-system clock is out by, measured against the beacon. */
  driftSeconds(): number {
    if (!this.trusted) return 0;
    return (this.osNow() - this.now()) / 1000;
  }

  note(): string | undefined {
    if (!this.trusted) {
      return this.simulatedSkewMs
        ? 'This device has no synced time beacon and its own clock is out.'
        : undefined;
    }
    const drift = this.driftSeconds();
    if (Math.abs(drift) < 45) return undefined;
    const minutes = Math.abs(drift) / 60;
    return `This device’s own clock is ${minutes.toFixed(0)} min ${drift > 0 ? 'fast' : 'slow'}; synced depot time was used instead.`;
  }
}

export const deviceClock = new DeviceClock();
