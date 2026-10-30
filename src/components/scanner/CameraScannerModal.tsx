/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, Flashlight, RefreshCw, X, AlertCircle } from 'lucide-react';
import { playScanBeep } from '../../utils/sound';

interface CameraScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  soundEnabled?: boolean;
}

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  soundEnabled = true
}) => {
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [manualCode, setManualCode] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'interactive-camera-barcode-reader';

  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).then(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        });
      }
      return;
    }

    setScannerError(null);
    let html5QrCode: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        html5QrCode = new Html5Qrcode(containerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.QR_CODE
          ],
          verbose: false
        });
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode },
          {
            fps: 15,
            qrbox: { width: 280, height: 180 },
            aspectRatio: 1.333333
          },
          (decodedText) => {
            // Success handler
            playScanBeep(soundEnabled);
            onScan(decodedText.trim());
          },
          () => {
            // Frame scan failure - ignore normal continuous search
          }
        );

        // Check if torch/flashlight is supported
        try {
          const stream = (document.getElementById(containerId)?.querySelector('video') as HTMLVideoElement)?.srcObject as MediaStream;
          const track = stream?.getVideoTracks()[0];
          const capabilities = (track?.getCapabilities ? track.getCapabilities() : {}) as { torch?: boolean };
          if (capabilities.torch) {
            setHasTorch(true);
          }
        } catch {
          setHasTorch(false);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setScannerError(msg.includes('NotAllowedError') 
          ? 'Camera permission denied. Please allow camera access in browser settings or type code below.' 
          : 'Could not access camera. Please enter barcode manually.');
      }
    };

    const timer = setTimeout(startScanner, 200);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {}).then(() => {
          scannerRef.current?.clear();
          scannerRef.current = null;
        });
      }
    };
  }, [isOpen, facingMode, onScan, soundEnabled]);

  const toggleTorch = async () => {
    try {
      const stream = (document.getElementById(containerId)?.querySelector('video') as HTMLVideoElement)?.srcObject as MediaStream;
      const track = stream?.getVideoTracks()[0];
      if (track) {
        const nextState = !isTorchOn;
        await (track as unknown as { applyConstraints: (c: unknown) => Promise<void> }).applyConstraints({
          advanced: [{ torch: nextState }]
        });
        setIsTorchOn(nextState);
      }
    } catch (err) {
      console.warn("Torch toggle error:", err);
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    playScanBeep(soundEnabled);
    onScan(manualCode.trim());
    setManualCode('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-[#DCE8DC] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#DCE8DC] flex items-center justify-between bg-[#F6FAF6]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#228B22]/10 flex items-center justify-center text-[#228B22]">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-[#14391A]">Barcode Camera Scanner</h3>
              <p className="text-xs text-slate-500">Supports EAN-13, Code128 &amp; QR</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-black/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewport */}
        <div className="relative bg-slate-950 flex flex-col items-center justify-center min-h-[300px] overflow-hidden">
          <div id={containerId} className="w-full h-full min-h-[280px]" />

          {/* Scanner Reticle Overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-36 border-2 border-[#228B22] rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
              {/* Laser line animation */}
              <div className="absolute left-2 right-2 top-1/2 -translate-y-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse" />
              <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-[#228B22]" />
              <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-[#228B22]" />
              <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-[#228B22]" />
              <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-[#228B22]" />
            </div>
          </div>

          {/* Scanner Controls Floating */}
          <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3 z-10">
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
                  isTorchOn ? 'bg-amber-400 text-slate-950 shadow-md' : 'bg-black/60 text-white hover:bg-black/80'
                }`}
              >
                <Flashlight className="w-3.5 h-3.5" />
                {isTorchOn ? 'Torch On' : 'Torch Off'}
              </button>
            )}
            <button
              type="button"
              onClick={toggleCamera}
              className="px-3 py-1.5 text-xs font-medium bg-black/60 text-white hover:bg-black/80 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Flip Camera
            </button>
          </div>
        </div>

        {/* Error notice if camera fails */}
        {scannerError && (
          <div className="p-3 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{scannerError}</span>
          </div>
        )}

        {/* Manual Barcode Input Fallback */}
        <div className="p-4 bg-white border-t border-[#DCE8DC]">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Or enter barcode manually..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-[#DCE8DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#228B22]/30 focus:border-[#228B22] font-mono-numbers"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-medium rounded-xl transition-colors shrink-0"
            >
              Submit Code
            </button>
          </form>
          <p className="text-[11px] text-slate-400 mt-2 text-center">
            USB or Bluetooth barcode guns work automatically on any screen.
          </p>
        </div>
      </div>
    </div>
  );
};
