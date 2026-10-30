/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';

interface UseKeyboardBarcodeScannerOptions {
  onBarcodeScanned: (barcode: string) => void;
  minChars?: number;
  maxIntervalMs?: number; // threshold between keystrokes to detect hardware scanner vs slow human typing
  enabled?: boolean;
}

/**
 * Custom hook to detect USB / Bluetooth physical keyboard-wedge barcode scanners.
 * Hardware scanners send character keystrokes in rapid succession (< 45ms apart) ending with Enter.
 */
export function useKeyboardBarcodeScanner({
  onBarcodeScanned,
  minChars = 4,
  maxIntervalMs = 50,
  enabled = true
}: UseKeyboardBarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing inside an open form input/textarea UNLESS it's an Enter submission of barcode
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      
      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;
      lastKeyTimeRef.current = currentTime;

      // Enter key indicates end of barcode transmission
      if (e.key === 'Enter') {
        const scannedCode = bufferRef.current.trim();
        bufferRef.current = '';

        if (scannedCode.length >= minChars) {
          // Prevent default form submit if triggered by scanner
          e.preventDefault();
          onBarcodeScanned(scannedCode);
        }
        return;
      }

      // If keys are too slow (> 100ms apart), reset buffer (it's human typing)
      if (timeDiff > maxIntervalMs * 2.5) {
        bufferRef.current = '';
      }

      // Printable single characters (digits, letters, hyphens)
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // If inside an input and keys are slow, let human type normally
        if (isInput && timeDiff > maxIntervalMs) {
          return;
        }
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, minChars, maxIntervalMs, onBarcodeScanned]);
}
