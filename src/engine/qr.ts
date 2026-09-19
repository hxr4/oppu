import qrcode from 'qrcode-generator';
import jsQR from 'jsqr';

/**
 * The QR library is bundled, not fetched. A pass that claims to work without a
 * network cannot depend on a CDN to draw itself.
 */
export function qrPath(text: string, errorCorrection: 'L' | 'M' | 'Q' | 'H' = 'M'): { d: string; count: number } {
  const qr = qrcode(0, errorCorrection);
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const parts: string[] = [];
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) parts.push(`M${c} ${r}h1v1h-1z`);
    }
  }
  return { d: parts.join(''), count };
}

export function decodeFrame(data: Uint8ClampedArray, width: number, height: number): string | null {
  const found = jsQR(data, width, height, { inversionAttempts: 'dontInvert' });
  return found?.data ?? null;
}
