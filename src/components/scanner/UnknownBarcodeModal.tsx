/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HelpCircle, PlusCircle, X } from 'lucide-react';

interface UnknownBarcodeModalProps {
  isOpen: boolean;
  barcode: string;
  onClose: () => void;
  onAddNewItem: (barcode: string) => void;
}

export const UnknownBarcodeModal: React.FC<UnknownBarcodeModalProps> = ({
  isOpen,
  barcode,
  onClose,
  onAddNewItem
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-[#DCE8DC] p-5 text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
          <HelpCircle className="w-6 h-6" />
        </div>

        <h3 className="font-bold text-base text-[#14391A]">Unknown Barcode</h3>
        <p className="text-xs text-slate-500 mt-1">
          No inventory product was found with this barcode code:
        </p>

        <div className="my-3 px-3 py-2 bg-[#F6FAF6] rounded-xl border border-[#DCE8DC] font-mono-numbers text-sm font-semibold text-[#14391A] select-all tracking-wider">
          {barcode}
        </div>

        <p className="text-xs text-slate-600 mb-5">
          Would you like to register a new stationery product or service with this code?
        </p>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-[#DCE8DC] hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-xl transition-colors"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onAddNewItem(barcode);
            }}
            className="flex-1 px-4 py-2.5 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            Add New Item
          </button>
        </div>
      </div>
    </div>
  );
};
