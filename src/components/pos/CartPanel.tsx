/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Trash2, 
  Plus, 
  Minus, 
  Tag, 
  Percent, 
  DollarSign, 
  PauseCircle, 
  ArrowRight,
  ShoppingCart,
  Receipt
} from 'lucide-react';
import { CartItem, ShopSettings } from '../../types';
import { formatCurrency } from '../../utils/barcode';

interface CartPanelProps {
  cart: CartItem[];
  shopSettings: ShopSettings;
  taxRate: number;
  cartDiscountType: 'percentage' | 'fixed';
  cartDiscountValue: number;
  heldCartsCount: number;
  onUpdateQuantity: (index: number, quantity: number) => void;
  onUpdateItemDiscount: (index: number, discountType: 'percentage' | 'fixed', discountValue: number) => void;
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  onOpenHoldModal: () => void;
  onUpdateCartDiscount: (discountType: 'percentage' | 'fixed', discountValue: number) => void;
  onUpdateTaxRate: (rate: number) => void;
  onProceedToPay: () => void;
}

export const CartPanel: React.FC<CartPanelProps> = ({
  cart,
  shopSettings,
  taxRate,
  cartDiscountType,
  cartDiscountValue,
  heldCartsCount,
  onUpdateQuantity,
  onUpdateItemDiscount,
  onRemoveItem,
  onClearCart,
  onOpenHoldModal,
  onUpdateCartDiscount,
  onUpdateTaxRate,
  onProceedToPay
}) => {
  const [editingDiscountIdx, setEditingDiscountIdx] = useState<number | null>(null);
  const [showCartDiscountModal, setShowCartDiscountModal] = useState(false);
  const [showTaxModal, setShowTaxModal] = useState(false);

  // Totals
  const subtotal = cart.reduce((sum, ci) => sum + ci.subtotal, 0);
  let cartDiscountAmount = 0;
  if (cartDiscountType === 'percentage') {
    cartDiscountAmount = (subtotal * cartDiscountValue) / 100;
  } else {
    cartDiscountAmount = Math.min(subtotal, cartDiscountValue);
  }

  const taxableAmount = Math.max(0, subtotal - cartDiscountAmount);
  // Tax logic: if tax is OFF (tax exempt), tax is 0 and total = sum of items minus discount
  const isTaxActive = Boolean(shopSettings.enableTax && taxRate > 0);
  const taxAmount = isTaxActive 
    ? (shopSettings.pricesIncludeVat 
        ? taxableAmount - (taxableAmount / (1 + (taxRate / 100))) 
        : (taxableAmount * taxRate) / 100)
    : 0;
  const grandTotal = isTaxActive
    ? (shopSettings.pricesIncludeVat ? taxableAmount : taxableAmount + taxAmount)
    : taxableAmount;
  const totalItemCount = cart.reduce((sum, ci) => sum + ci.quantity, 0);

  return (
    <div className="bg-white rounded-2xl border border-[#DCE8DC] flex flex-col h-full shadow-sm overflow-hidden">
      {/* Cart Header */}
      <div className="p-4 border-b border-[#DCE8DC] bg-[#F6FAF6] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-[#228B22]" />
          <h2 className="font-bold text-sm text-[#14391A]">Current Cart</h2>
          {totalItemCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#228B22]/10 text-[#228B22] font-semibold">
              {totalItemCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenHoldModal}
            className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-[#14391A] hover:bg-black/5 rounded-lg flex items-center gap-1 transition-colors"
            title="Park or view held carts"
          >
            <PauseCircle className="w-3.5 h-3.5 text-[#228B22]" />
            Hold ({heldCartsCount})
          </button>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={onClearCart}
              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Clear cart"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 ? (
          <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <Receipt className="w-10 h-10 mb-2 opacity-30 text-[#228B22]" />
            <p className="text-sm font-semibold text-slate-600">Cart is Empty</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
              Scan a barcode, select products, or tap a Quick Service preset to add items.
            </p>
          </div>
        ) : (
          cart.map((item, idx) => (
            <div
              key={`${item.item.id}-${idx}`}
              className="p-2.5 bg-[#F6FAF6] hover:bg-emerald-50/40 rounded-xl border border-[#DCE8DC] transition-all flex flex-col gap-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#14391A] truncate">{item.item.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono-numbers">
                    {formatCurrency(item.finalUnitPrice, shopSettings.currencySymbol)}
                    {item.discountValue > 0 && (
                      <span className="ml-1 text-[#228B22] font-semibold">
                        (-{item.discountValue}{item.discountType === 'percentage' ? '%' : shopSettings.currencySymbol})
                      </span>
                    )}
                    {item.item.unit && ` · ${item.item.unit}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveItem(idx)}
                  className="text-slate-300 hover:text-red-500 p-1 transition-colors"
                  title="Remove item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quantity Stepper & Subtotal */}
              <div className="flex items-center justify-between pt-1 border-t border-[#DCE8DC]/50">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(idx, Math.max(1, item.quantity - 1))}
                    className="w-6 h-6 rounded-lg bg-white border border-[#DCE8DC] hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => onUpdateQuantity(idx, Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-12 h-6 text-center text-xs font-bold font-mono-numbers bg-white border border-[#DCE8DC] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#228B22]"
                  />
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(idx, item.quantity + 1)}
                    className="w-6 h-6 rounded-lg bg-white border border-[#DCE8DC] hover:bg-slate-50 flex items-center justify-center text-slate-600 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>

                  {/* Per-item discount trigger */}
                  <button
                    type="button"
                    onClick={() => setEditingDiscountIdx(editingDiscountIdx === idx ? null : idx)}
                    className="ml-1 px-1.5 py-0.5 text-[10px] rounded border border-[#DCE8DC] bg-white text-slate-600 hover:text-[#228B22] flex items-center gap-0.5"
                    title="Item discount"
                  >
                    <Tag className="w-2.5 h-2.5" />
                    Disc
                  </button>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-[#14391A] font-mono-numbers">
                    {formatCurrency(item.subtotal, shopSettings.currencySymbol)}
                  </span>
                </div>
              </div>

              {/* Item Discount Sub-bar */}
              {editingDiscountIdx === idx && (
                <div className="p-2 bg-white rounded-lg border border-[#DCE8DC] flex items-center gap-2 text-xs">
                  <span className="text-[11px] text-slate-500 font-medium">Discount:</span>
                  <div className="flex rounded border border-[#DCE8DC] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => onUpdateItemDiscount(idx, 'percentage', item.discountValue)}
                      className={`px-1.5 py-0.5 text-[10px] ${item.discountType === 'percentage' ? 'bg-[#228B22] text-white' : 'bg-slate-50'}`}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateItemDiscount(idx, 'fixed', item.discountValue)}
                      className={`px-1.5 py-0.5 text-[10px] ${item.discountType === 'fixed' ? 'bg-[#228B22] text-white' : 'bg-slate-50'}`}
                    >
                      {shopSettings.currencySymbol}
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={item.discountValue}
                    onChange={(e) => onUpdateItemDiscount(idx, item.discountType, Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-16 px-1.5 py-0.5 text-xs font-mono-numbers border border-[#DCE8DC] rounded"
                  />
                  <button
                    type="button"
                    onClick={() => setEditingDiscountIdx(null)}
                    className="text-[10px] text-[#228B22] font-semibold"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Cart Summary & Checkout Action */}
      <div className="p-4 border-t border-[#DCE8DC] bg-white space-y-2.5">
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal:</span>
            <span className="font-mono-numbers font-medium">
              {formatCurrency(subtotal, shopSettings.currencySymbol)}
            </span>
          </div>

          {/* Cart Discount row */}
          <div className="flex justify-between items-center text-slate-600">
            <button
              type="button"
              onClick={() => setShowCartDiscountModal(true)}
              className="text-[#228B22] hover:underline flex items-center gap-1 font-medium"
            >
              <Tag className="w-3 h-3" />
              {cartDiscountValue > 0 
                ? `Cart Discount (${cartDiscountValue}${cartDiscountType === 'percentage' ? '%' : shopSettings.currencySymbol})` 
                : '+ Add Cart Discount'}
            </button>
            <span className="font-mono-numbers font-medium text-slate-700">
              {cartDiscountAmount > 0 
                ? `-${formatCurrency(cartDiscountAmount, shopSettings.currencySymbol)}` 
                : formatCurrency(0, shopSettings.currencySymbol)}
            </span>
          </div>

          {/* Tax row: only visible when Charge Tax is active */}
          {isTaxActive && (
            <div className="flex justify-between items-center text-slate-600 animate-in fade-in duration-150">
              <button
                type="button"
                onClick={() => setShowTaxModal(true)}
                className="text-slate-600 hover:text-[#14391A] flex items-center gap-1 font-medium"
              >
                <span>{shopSettings.taxName} ({taxRate}%):</span>
              </button>
              <span className="font-mono-numbers font-medium">
                {formatCurrency(taxAmount, shopSettings.currencySymbol)}
              </span>
            </div>
          )}

          {/* Grand Total */}
          <div className="flex justify-between items-baseline pt-2 border-t border-[#DCE8DC] text-[#14391A]">
            <span className="font-bold text-sm">TOTAL DUE:</span>
            <span className="font-bold text-xl font-mono-numbers text-[#228B22]">
              {formatCurrency(grandTotal, shopSettings.currencySymbol)}
            </span>
          </div>
        </div>

        {/* Big Checkout Button */}
        <button
          type="button"
          disabled={cart.length === 0}
          onClick={onProceedToPay}
          className={`w-full py-3.5 px-4 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md ${
            cart.length === 0
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
              : 'bg-[#228B22] hover:bg-[#1B6E1B] active:scale-[0.99]'
          }`}
        >
          <span>Charge {formatCurrency(grandTotal, shopSettings.currencySymbol)}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Cart Discount Edit Modal */}
      {showCartDiscountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-xs p-5 border border-[#DCE8DC] shadow-xl space-y-3">
            <h4 className="font-bold text-sm text-[#14391A]">Cart Discount</h4>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onUpdateCartDiscount('percentage', cartDiscountValue)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border ${
                  cartDiscountType === 'percentage' ? 'bg-[#228B22] text-white border-[#228B22]' : 'border-[#DCE8DC]'
                }`}
              >
                Percentage (%)
              </button>
              <button
                type="button"
                onClick={() => onUpdateCartDiscount('fixed', cartDiscountValue)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border ${
                  cartDiscountType === 'fixed' ? 'bg-[#228B22] text-white border-[#228B22]' : 'border-[#DCE8DC]'
                }`}
              >
                Fixed ({shopSettings.currencySymbol})
              </button>
            </div>
            <input
              type="number"
              min="0"
              step="1"
              value={cartDiscountValue}
              onChange={(e) => onUpdateCartDiscount(cartDiscountType, Math.max(0, parseFloat(e.target.value) || 0))}
              className="w-full px-3 py-2 text-base font-bold font-mono-numbers border border-[#DCE8DC] rounded-xl text-center"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onUpdateCartDiscount('percentage', 0)}
                className="flex-1 py-2 text-xs border border-red-200 text-red-600 rounded-xl"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setShowCartDiscountModal(false)}
                className="flex-1 py-2 text-xs bg-[#228B22] text-white font-semibold rounded-xl"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tax Rate Edit Modal */}
      {showTaxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-xs p-5 border border-[#DCE8DC] shadow-xl space-y-3">
            <h4 className="font-bold text-sm text-[#14391A]">Configure Tax Rate</h4>
            <p className="text-xs text-slate-500">Modify tax percentage for this transaction</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.5"
                value={taxRate}
                onChange={(e) => onUpdateTaxRate(Math.max(0, parseFloat(e.target.value) || 0))}
                className="flex-1 px-3 py-2 text-base font-bold font-mono-numbers border border-[#DCE8DC] rounded-xl text-center"
              />
              <span className="text-sm font-bold text-slate-700">%</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onUpdateTaxRate(0)}
                className="flex-1 py-2 text-xs border border-slate-200 text-slate-600 rounded-xl"
              >
                Tax Exempt (0%)
              </button>
              <button
                type="button"
                onClick={() => setShowTaxModal(false)}
                className="flex-1 py-2 text-xs bg-[#228B22] text-white font-semibold rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
