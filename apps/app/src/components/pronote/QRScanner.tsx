/**
 * QRScanner Component - Pronote QR code scanner using html5-qrcode
 *
 * Scans Pronote QR codes which contain JSON: {jeton, login, url}
 * Inspired by Papillon app approach - no over-engineering.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';

export interface PronoteQRData {
  jeton: string;
  login: string;
  url: string;
}

interface QRScannerProps {
  onScan: (data: PronoteQRData) => void;
  onError?: (error: string) => void;
}

/**
 * Parse Pronote QR code JSON data
 * Returns null if invalid format
 */
function parsePronoteQR(text: string): PronoteQRData | null {
  try {
    const data = JSON.parse(text);
    // Validate required fields
    if (
      typeof data.jeton === 'string' &&
      typeof data.login === 'string' &&
      typeof data.url === 'string'
    ) {
      return {
        jeton: data.jeton,
        login: data.login,
        url: data.url,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // Scanner may already be stopped
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const startScanner = useCallback(async () => {
    if (!containerRef.current) return;

    setError(null);
    setIsScanning(true);

    try {
      // Create scanner instance
      const scanner = new Html5Qrcode('qr-scanner-container');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' }, // Prefer back camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // QR code detected
          const qrData = parsePronoteQR(decodedText);
          if (qrData) {
            void stopScanner();
            onScan(qrData);
          } else {
            setError('QR code invalide. Scannez le QR code depuis l\'app Pronote.');
          }
        },
        () => {
          // QR scanning error (frame without QR) - ignore
        }
      );

      setHasPermission(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      if (errorMsg.includes('NotAllowedError') || errorMsg.includes('Permission')) {
        setHasPermission(false);
        setError('Accès à la caméra refusé. Veuillez autoriser l\'accès dans les paramètres.');
      } else if (errorMsg.includes('NotFoundError')) {
        setError('Aucune caméra détectée sur cet appareil.');
      } else {
        setError('Erreur lors du démarrage de la caméra.');
      }

      setIsScanning(false);
      onError?.(errorMsg);
    }
  }, [onScan, onError, stopScanner]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  // Auto-start scanner on mount
  useEffect(() => {
    void startScanner();
  }, [startScanner]);

  return (
    <div className="space-y-4">
      {/* Scanner viewport */}
      <div className="relative rounded-xl overflow-hidden bg-black/5 border border-primary/20">
        <div
          id="qr-scanner-container"
          ref={containerRef}
          className="w-full aspect-square"
        />

        {/* Overlay when not scanning */}
        {!isScanning && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-primary/5">
            <Camera className="w-12 h-12 text-primary/40 mb-4" />
            <p className="text-sm text-primary/60">Initialisation de la caméra...</p>
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Retry button */}
      {(error ?? hasPermission === false) && (
        <Button
          variant="outline"
          onClick={startScanner}
          className="w-full"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Réessayer
        </Button>
      )}

      {/* Instructions */}
      <div className="text-center text-sm text-primary/60 space-y-1">
        <p className="font-medium">Comment obtenir le QR code ?</p>
        <ol className="text-xs text-left pl-4 space-y-1">
          <li>1. Ouvrez l'app Pronote sur votre téléphone</li>
          <li>2. Allez dans Paramètres → Code QR</li>
          <li>3. Notez le code PIN à 4 chiffres affiché</li>
          <li>4. Scannez le QR code avec cette caméra</li>
        </ol>
      </div>
    </div>
  );
}

export default QRScanner;
