import encodeQR from 'qr';
import { useMemo } from 'react';
import { QR_BORDER, qrPath } from '../lib/pairing';

/** A QR code drawn as an SVG path from the encoder's matrix: no markup nor data URL the CSP would refuse. */
export function QrCode({ text, label }: { text: string; label: string }) {
  // Encoded once per text: the parent's page polls the devices while a code waits.
  const { size, path } = useMemo(() => {
    const matrix = encodeQR(text, 'raw', { border: QR_BORDER });
    return { size: matrix.length, path: qrPath(matrix) };
  }, [text]);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${String(size)} ${String(size)}`}
      className="size-48 self-center bg-qr-background fill-qr"
      shapeRendering="crispEdges"
    >
      <path d={path} />
    </svg>
  );
}
