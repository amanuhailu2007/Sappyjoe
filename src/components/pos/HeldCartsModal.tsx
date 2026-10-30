/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PauseCircle, Play, Trash2, X, Clock, ShoppingCart } from 'lucide-react';
import { HeldCart, ShopSettings } from '../../types';
import { formatCurrency } from '../../utils/barcode';

interface HeldCartsModalProps {
  isOpen: boolean;
  heldCarts: HeldCart[];
  shopSettings: ShopSettings;
  onClose: () => void;
  onResume: (cart: HeldCart) => void;
  onDelete: (cartId: string) => void;
  onHoldCurrentCart: (label: string) => void;
  canHoldCurrentCart: boolean;
}

export const HeldCartsModal: React.FC<HeldCartsModalProps> = ({
  isOpen,
  heldCarts,
  shopSettings,
  onClose,
  onResume,
  onDelete,
  onHoldCurrentCart,
  canHoldCurrentCart
}) => {
  const [newCartLabel, setNewCartLabel] = useState('');

  if (!isOpen) return null;

  const handleHoldSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCartLabel.trim()) return;
    onHoldCurrentCart(newCartLabel.trim());
    setNewCartLabel('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-[#DCE8DC] flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#DCE8DC] flex items-center justify-between bg-[#F6FAF6]">
          <div className="flex items-center gap-2">
            <PauseCircle className="w-5 h-5 text-[#228B22]" />
            <div>
              <h3 className="font-bold text-base text-[#14391A]">Parked / Held Carts</h3>
              <p className="text-xs text-slate-500">Hold active cart to serve other customers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-black/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hold Current Cart Form */}
        {canHoldCurrentCart && (
          <div className="p-4 bg-emerald-50/50 border-b border-[#DCE8DC]">
            <form onSubmit={handleHoldSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Name or note for current cart (e.g. John's printing)"
                value={newCartLabel}
                onChange={(e) => setNewCartLabel(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#228B22] bg-white"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shrink-0"
              >
                <PauseCircle className="w-4 h-4" />
                Park Current Cart
              </button>
            </form>
          </div>
        )}

        {/* List of Held Carts */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {heldCarts.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-40 text-[#228B22]" />
              <p className="text-sm font-medium text-slate-600">No Carts on Hold</p>
              <p className="text-xs text-slate-400 mt-1">
                You can park an active checkout anytime by clicking "Hold Cart".
              </p>
            </div>
          ) : (
            heldCarts.map((c) => {
              const itemCount = c.items.reduce((sum, it) => sum + it.quantity, 0);
              const subtotal = c.items.reduce((sum, it) => sum + it.subtotal, 0);
              const dateStr = new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={c.id}
                  className="p-3.5 rounded-xl border border-[#DCE8DC] bg-[#F6FAF6] hover:border-[#228B22]/50 transition-all flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm text-[#14391A] truncate">{c.label}</h4>
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {dateStr}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-600 mt-1">
                      <span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
                      <span>·</span>
                      <span className="font-semibold text-[#14391A] font-mono-numbers">
                        {formatCurrency(subtotal, shopSettings.currencySymbol)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">
                      {c.items.map(it => `${it.quantity}x ${it.item.name}`).join(', ')}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onResume(c)}
                      className="px-3 py-1.5 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Resume
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(c.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Discard parked cart"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-[#DCE8DC] text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#DCE8DC] hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-xl transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
