import encodeQR from 'qr';
import { qrPath } from '../lib/pairing';

// The quiet zone a reader needs around the code, in modules.
const MARGIN = 4;

/** A QR code drawn as an SVG path from the encoder's matrix: no markup nor data URL the CSP would refuse. */
export function QrCode({ text, label }: { text: string; label: string }) {
  const matrix = encodeQR(text, 'raw');
  const size = matrix.length + 2 * MARGIN;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${String(-MARGIN)} ${String(-MARGIN)} ${String(size)} ${String(size)}`}
      className="size-48 self-center bg-qr-background fill-qr"
      shapeRendering="crispEdges"
    >
      <path d={qrPath(matrix)} />
    </svg>
  );
}
