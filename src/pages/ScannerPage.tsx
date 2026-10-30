/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Scan, 
  Camera, 
  Volume2, 
  PlusCircle, 
  ShoppingCart, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Barcode as BarcodeIcon,
  HelpCircle,
  Package
} from 'lucide-react';
import { InventoryItem, ShopSettings, UserProfile } from '../types';
import { formatCurrency } from '../utils/barcode';
import { CameraScannerModal } from '../components/scanner/CameraScannerModal';
import { UnknownBarcodeModal } from '../components/scanner/UnknownBarcodeModal';
import { playScanBeep } from '../utils/sound';
import { useToast } from '../components/common/ToastContext';

interface ScannerPageProps {
  items: InventoryItem[];
  shopSettings: ShopSettings;
  currentUser: UserProfile;
  onAddToCart?: (item: InventoryItem) => void;
  onAddNewItemWithBarcode: (barcode: string) => void;
}

interface ScanLogEntry {
  id: string;
  code: string;
  timestamp: string;
  item?: InventoryItem;
}

export const ScannerPage: React.FC<ScannerPageProps> = ({
  items,
  shopSettings,
  currentUser,
  onAddToCart,
  onAddNewItemWithBarcode
}) => {
  const toast = useToast();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [recentScans, setRecentScans] = useState<ScanLogEntry[]>([]);
  const [lastScannedItem, setLastScannedItem] = useState<InventoryItem | null>(null);
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);

  // Handle barcode scanned from camera or manual entry
  const handleBarcodeIdentified = (barcode: string) => {
    const trimmed = barcode.trim();
    if (!trimmed) return;

    playScanBeep(shopSettings.enableSoundBeep);

    const foundItem = items.find(
      (it) => it.barcode === trimmed || it.sku.toLowerCase() === trimmed.toLowerCase()
    );

    const newLog: ScanLogEntry = {
      id: `scan_${Date.now()}`,
      code: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      item: foundItem
    };

    setRecentScans((prev) => [newLog, ...prev.slice(0, 19)]);

    if (foundItem) {
      setLastScannedItem(foundItem);
      toast.success(`Found: ${foundItem.name}`);
    } else {
      setLastScannedItem(null);
      setUnknownBarcode(trimmed);
      toast.warning(`Unknown barcode: ${trimmed}`);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleBarcodeIdentified(manualCode);
    setManualCode('');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DCE8DC]">
        <div>
          <h2 className="text-xl font-bold text-[#14391A] flex items-center gap-2">
            <Scan className="w-6 h-6 text-[#228B22]" />
            Barcode Scanner Hub
          </h2>
          <p className="text-xs text-slate-500">
            Real-time camera optical recognition &amp; USB/Bluetooth scanner hardware reader
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => playScanBeep(true)}
            className="px-3 py-2 text-xs font-semibold rounded-xl border border-[#DCE8DC] hover:bg-[#F6FAF6] text-slate-600 flex items-center gap-1.5 transition-colors"
            title="Test POS audio beep"
          >
            <Volume2 className="w-4 h-4 text-[#228B22]" />
            Test Beep Sound
          </button>
          <button
            type="button"
            onClick={() => setIsCameraOpen(true)}
            className="px-4 py-2 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all shadow-sm"
          >
            <Camera className="w-4 h-4" />
            Launch Camera Scanner
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Scanner input & active product match (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Hardware Wedge Scanner Active Listener Card */}
          <div className="bg-[#F6FAF6] p-5 rounded-2xl border border-[#DCE8DC] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarcodeIcon className="w-5 h-5 text-[#228B22]" />
                <h3 className="font-bold text-sm text-[#14391A]">USB &amp; Bluetooth Scanner Ready</h3>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-[#14391A]">
                Listener Active
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pull the trigger on your handheld USB or Bluetooth barcode scanner at any time. Barcodes are instantly detected, verified against inventory, and matched.
            </p>

            {/* Quick manual entry form */}
            <form onSubmit={handleManualSubmit} className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Or type/paste barcode manually..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#228B22]/20 font-mono-numbers bg-white"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#14391A] hover:bg-[#1B6E1B] text-white text-xs font-semibold rounded-xl transition-colors"
              >
                Scan Code
              </button>
            </form>
          </div>

          {/* Scanned Item Spotlight Card */}
          {lastScannedItem ? (
            <div className="bg-white p-5 rounded-2xl border-2 border-[#228B22] shadow-sm animate-in fade-in duration-200">
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#DCE8DC]">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#228B22]" />
                    <span className="text-xs font-bold text-[#228B22] uppercase tracking-wider">Product Matched</span>
                  </div>
                  <h3 className="text-base font-bold text-[#14391A] mt-1">{lastScannedItem.name}</h3>
                  <p className="text-xs text-slate-400 font-mono-numbers mt-0.5">
                    Barcode: {lastScannedItem.barcode} · SKU: {lastScannedItem.sku}
                  </p>
                </div>
                <span className="text-xl font-bold text-[#228B22] font-mono-numbers">
                  {formatCurrency(lastScannedItem.sellingPrice, shopSettings.currencySymbol)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 py-3 text-xs border-b border-[#DCE8DC]">
                <div>
                  <span className="text-slate-400 block text-[10px]">Category</span>
                  <span className="font-semibold text-[#14391A]">{lastScannedItem.category}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Current Stock</span>
                  <span className={`font-semibold font-mono-numbers ${lastScannedItem.stock <= lastScannedItem.lowStockThreshold ? 'text-amber-600 font-bold' : 'text-[#14391A]'}`}>
                    {lastScannedItem.stock} {lastScannedItem.unit || 'units'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Cost Price</span>
                  <span className="font-semibold font-mono-numbers text-slate-600">
                    {formatCurrency(lastScannedItem.costPrice, shopSettings.currencySymbol)}
                  </span>
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                {onAddToCart && (
                  <button
                    type="button"
                    onClick={() => {
                      onAddToCart(lastScannedItem);
                      toast.success(`Added ${lastScannedItem.name} to POS Cart`);
                    }}
                    className="flex-1 py-2.5 px-3 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Add to POS Cart
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-2xl border border-[#DCE8DC] text-center text-slate-400">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-30 text-[#228B22]" />
              <p className="text-sm font-semibold text-slate-600">Ready for Next Barcode</p>
              <p className="text-xs text-slate-400 mt-1">
                Scan an item using the camera or USB scanner to view its details.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Scan History Feed (5 cols) */}
        <div className="lg:col-span-5 bg-white p-4 rounded-2xl border border-[#DCE8DC] flex flex-col h-[520px]">
          <div className="flex items-center justify-between pb-3 border-b border-[#DCE8DC]">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#228B22]" />
              <h3 className="font-bold text-sm text-[#14391A]">Session Scan History</h3>
            </div>
            {recentScans.length > 0 && (
              <button
                type="button"
                onClick={() => setRecentScans([])}
                className="text-[11px] text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pt-2 space-y-2">
            {recentScans.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 text-xs">
                <Scan className="w-8 h-8 mb-1.5 opacity-20 text-[#228B22]" />
                <span>No scans recorded this session</span>
              </div>
            ) : (
              recentScans.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-xl border border-[#DCE8DC] bg-[#F6FAF6] hover:bg-slate-50 flex items-center justify-between gap-2 text-xs transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono-numbers font-semibold text-[#14391A] truncate">{log.code}</p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {log.item ? log.item.name : 'Unknown Product'}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 block">{log.timestamp}</span>
                    {log.item ? (
                      <span className="font-bold text-xs font-mono-numbers text-[#228B22]">
                        {formatCurrency(log.item.sellingPrice, shopSettings.currencySymbol)}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAddNewItemWithBarcode(log.code)}
                        className="text-[10px] text-[#228B22] hover:underline font-semibold"
                      >
                        + Add Item
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Camera Barcode Scanner Modal */}
      <CameraScannerModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onScan={(code) => {
          setIsCameraOpen(false);
          handleBarcodeIdentified(code);
        }}
        soundEnabled={shopSettings.enableSoundBeep}
      />

      {/* Unknown Barcode Modal */}
      <UnknownBarcodeModal
        isOpen={unknownBarcode !== null}
        barcode={unknownBarcode || ''}
        onClose={() => setUnknownBarcode(null)}
        onAddNewItem={(code) => {
          setUnknownBarcode(null);
          onAddNewItemWithBarcode(code);
        }}
      />
    </div>
  );
};
