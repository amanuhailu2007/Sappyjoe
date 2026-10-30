/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Banknote, 
  Smartphone, 
  Check, 
  X, 
  AlertCircle,
  Loader2,
  Building2,
  Hash
} from 'lucide-react';
import { PaymentMethod, ShopSettings } from '../../types';
import { formatCurrency } from '../../utils/barcode';
import { getTranslation } from '../../i18n/translations';

interface PaymentModalProps {
  isOpen: boolean;
  total: number;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  shopSettings: ShopSettings;
  onClose: () => void;
  onConfirmPayment: (details: {
    method: PaymentMethod;
    amountTendered: number;
    paymentReference?: string;
    notes?: string;
  }) => Promise<void>;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  total,
  subtotal,
  taxAmount,
  discountAmount,
  shopSettings,
  onClose,
  onConfirmPayment
}) => {
  const t = getTranslation(shopSettings.language);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amountTendered, setAmountTendered] = useState<string>(total.toFixed(2));
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setAmountTendered(total.toFixed(2));
      setPaymentReference('');
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen, total]);

  if (!isOpen) return null;

  const numericTendered = parseFloat(amountTendered) || 0;
  const changeGiven = Math.max(0, numericTendered - total);
  const isCash = method === 'cash';
  const isInsufficient = isCash && numericTendered < total - 0.001;

  const handleQuickCash = (amt: number) => {
    setAmountTendered(amt.toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isInsufficient) {
      setErrorMessage(`Tendered amount cannot be less than ${formatCurrency(total, shopSettings.currencySymbol)}`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onConfirmPayment({
        method,
        amountTendered: method === 'cash' ? numericTendered : total,
        paymentReference: paymentReference.trim() || undefined,
        notes: notes.trim() || undefined
      });
    } catch (err: unknown) {
      setIsSubmitting(false);
      setErrorMessage(err instanceof Error ? err.message : 'Transaction failed. Please try again.');
    }
  };

  // Quick cash note denominations in Ethiopian Birr (10, 50, 100, 200, 500, 1000)
  const quickAmounts = [
    Math.ceil(total),
    Math.ceil(total / 50) * 50 || 50,
    Math.ceil(total / 100) * 100 || 100,
    Math.ceil(total / 200) * 200 || 200,
    500,
    1000,
    2000
  ].filter((v, i, a) => a.indexOf(v) === i && v >= total);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-[#DCE8DC] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#DCE8DC] flex items-center justify-between bg-[#F6FAF6]">
          <div>
            <h3 className="font-bold text-base text-[#14391A]">{t.paymentCheckout}</h3>
            <p className="text-xs text-slate-500">{t.paymentSub}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-black/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Total Display Card */}
          <div className="p-4 bg-[#F6FAF6] rounded-xl border border-[#DCE8DC] flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t.totalDue}</span>
              <p className="text-2xl font-bold font-mono-numbers text-[#14391A]">
                {formatCurrency(total, shopSettings.currencySymbol)}
              </p>
              <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 mt-0.5">
                <span>{t.subtotal}: {formatCurrency(subtotal, shopSettings.currencySymbol)}</span>
                {shopSettings.enableTax && taxAmount > 0 && (
                  <span>· {shopSettings.taxName} ({shopSettings.taxRate}%): {formatCurrency(taxAmount, shopSettings.currencySymbol)}</span>
                )}
              </div>
            </div>
            {isCash && (
              <div className="text-right">
                <span className="text-xs text-slate-500">{t.changeDue}</span>
                <p className={`text-xl font-bold font-mono-numbers ${changeGiven > 0 ? 'text-[#228B22]' : 'text-slate-400'}`}>
                  {formatCurrency(changeGiven, shopSettings.currencySymbol)}
                </p>
              </div>
            )}
          </div>

          {/* Payment Method Selector: Cash, Telebirr, CBE Birr, Bank Transfer, Card */}
          <div>
            <label className="block text-xs font-semibold text-[#14391A] mb-2">
              {t.paidVia}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMethod('cash');
                  setAmountTendered(total.toFixed(2));
                }}
                className={`py-2.5 px-3 rounded-xl border flex flex-col items-center gap-1 transition-all text-xs font-semibold ${
                  method === 'cash'
                    ? 'border-[#228B22] bg-[#228B22]/10 text-[#14391A] ring-1 ring-[#228B22]'
                    : 'border-[#DCE8DC] hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Banknote className="w-5 h-5 text-[#228B22]" />
                {t.cash}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMethod('telebirr');
                  setAmountTendered(total.toFixed(2));
                }}
                className={`py-2.5 px-3 rounded-xl border flex flex-col items-center gap-1 transition-all text-xs font-semibold ${
                  method === 'telebirr'
                    ? 'border-[#008CD0] bg-[#008CD0]/10 text-[#006090] ring-1 ring-[#008CD0]'
                    : 'border-[#DCE8DC] hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Smartphone className="w-5 h-5 text-[#008CD0]" />
                {t.telebirr}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMethod('cbe_birr');
                  setAmountTendered(total.toFixed(2));
                }}
                className={`py-2.5 px-3 rounded-xl border flex flex-col items-center gap-1 transition-all text-xs font-semibold ${
                  method === 'cbe_birr'
                    ? 'border-[#8B2252] bg-[#8B2252]/10 text-[#501030] ring-1 ring-[#8B2252]'
                    : 'border-[#DCE8DC] hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Building2 className="w-5 h-5 text-[#8B2252]" />
                {t.cbeBirr}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMethod('bank_transfer');
                  setAmountTendered(total.toFixed(2));
                }}
                className={`py-2.5 px-3 rounded-xl border flex flex-col items-center gap-1 transition-all text-xs font-semibold ${
                  method === 'bank_transfer'
                    ? 'border-[#228B22] bg-[#228B22]/10 text-[#14391A] ring-1 ring-[#228B22]'
                    : 'border-[#DCE8DC] hover:bg-slate-50 text-slate-600'
                }`}
              >
                <Building2 className="w-5 h-5 text-[#228B22]" />
                {t.bankTransfer}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMethod('card');
                  setAmountTendered(total.toFixed(2));
                }}
                className={`py-2.5 px-3 rounded-xl border flex flex-col items-center gap-1 transition-all text-xs font-semibold ${
                  method === 'card'
                    ? 'border-[#228B22] bg-[#228B22]/10 text-[#14391A] ring-1 ring-[#228B22]'
                    : 'border-[#DCE8DC] hover:bg-slate-50 text-slate-600'
                }`}
              >
                <CreditCard className="w-5 h-5 text-[#228B22]" />
                {t.card}
              </button>
            </div>
          </div>

          {/* Reference / Transaction Number for non-cash methods */}
          {method !== 'cash' && (
            <div className="p-3 bg-[#F6FAF6] rounded-xl border border-[#DCE8DC] space-y-1.5 animate-in fade-in duration-150">
              <label className="block text-xs font-semibold text-[#14391A] flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-[#228B22]" />
                {t.paymentRef}
              </label>
              <input
                type="text"
                placeholder={t.referencePlaceholder}
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#228B22] bg-white font-mono-numbers"
              />
              <p className="text-[10px] text-slate-500">
                {method === 'telebirr' && 'Enter the 12-digit Telebirr transaction confirmation code.'}
                {method === 'cbe_birr' && 'Enter the CBE Birr transaction ID or branch authorization slip code.'}
                {method === 'bank_transfer' && 'Enter the mobile banking transfer reference / screenshot code.'}
                {method === 'card' && 'Enter POS terminal receipt approval authorization code.'}
              </p>
            </div>
          )}

          {/* Cash Amount Tendered & Quick Preset Buttons */}
          {method === 'cash' && (
            <div className="space-y-2.5">
              <div>
                <label className="block text-xs font-semibold text-[#14391A] mb-1">
                  {t.tenderedAmount} ({shopSettings.currencySymbol})
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  required
                  value={amountTendered}
                  onChange={(e) => setAmountTendered(e.target.value)}
                  className="w-full px-4 py-2.5 text-lg font-bold font-mono-numbers border border-[#DCE8DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#228B22]/30 focus:border-[#228B22]"
                />
              </div>

              {/* Quick Bill Chips */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setAmountTendered(total.toFixed(2))}
                  className="px-2.5 py-1 text-xs rounded-lg border border-[#DCE8DC] bg-slate-50 hover:bg-[#228B22]/10 hover:border-[#228B22] text-[#14391A] font-semibold transition-colors"
                >
                  Exact ({formatCurrency(total, shopSettings.currencySymbol)})
                </button>
                {quickAmounts.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleQuickCash(amt)}
                    className="px-2.5 py-1 text-xs rounded-lg border border-[#DCE8DC] bg-white hover:bg-[#228B22]/10 hover:border-[#228B22] text-[#14391A] font-medium font-mono-numbers transition-colors"
                  >
                    {formatCurrency(amt, shopSettings.currencySymbol)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Customer / Order Notes */}
          <div>
            <label className="block text-xs font-semibold text-[#14391A] mb-1">
              {t.customerNote}
            </label>
            <input
              type="text"
              placeholder="e.g. Ato Girma / Bole Print Order #104"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl focus:outline-none focus:ring-1 focus:ring-[#228B22]"
            />
          </div>

          {/* Error banner */}
          {errorMessage && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 border border-[#DCE8DC] hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isInsufficient}
              className={`flex-2 py-3 px-4 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                isInsufficient
                  ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                  : 'bg-[#228B22] hover:bg-[#1B6E1B]'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t.recordingSale}
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {t.confirmCompleteSale}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
