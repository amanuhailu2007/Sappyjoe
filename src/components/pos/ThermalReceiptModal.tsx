/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer, Check, X, ArrowRight } from 'lucide-react';
import { SaleTransaction, ShopSettings } from '../../types';
import { formatCurrency } from '../../utils/barcode';
import { formatAddisDate } from '../../utils/date';
import { getTranslation } from '../../i18n/translations';

interface ThermalReceiptModalProps {
  isOpen: boolean;
  transaction: SaleTransaction | null;
  shopSettings: ShopSettings;
  onClose: () => void;
  onNewSale: () => void;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  isOpen,
  transaction,
  shopSettings,
  onClose,
  onNewSale
}) => {
  const t = getTranslation(shopSettings.language);
  const barcodeRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (isOpen && transaction && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, transaction.receiptNumber, {
          format: 'CODE128',
          width: 1.4,
          height: 38,
          displayValue: false,
          margin: 0
        });
      } catch (err) {
        console.warn("Receipt barcode render failed:", err);
      }
    }
  }, [isOpen, transaction]);

  if (!isOpen || !transaction) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = formatAddisDate(transaction.timestamp, {
    useEthiopianCalendar: shopSettings.useEthiopianCalendar,
    language: shopSettings.language,
    includeTime: true
  });

  const getPaymentMethodDisplay = (method: string) => {
    switch (method) {
      case 'telebirr': return `${t.telebirr}`;
      case 'cbe_birr': return `${t.cbeBirr}`;
      case 'bank_transfer': return `${t.bankTransfer}`;
      case 'card': return `${t.card}`;
      case 'cash':
      default: return `${t.cash}`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-[#DCE8DC] flex flex-col max-h-[94vh]">
        
        {/* Modal Top Bar */}
        <div className="px-5 py-3.5 border-b border-[#DCE8DC] flex items-center justify-between bg-[#F6FAF6] print:hidden">
          <div className="flex items-center gap-2 text-[#228B22]">
            <Check className="w-5 h-5 bg-[#228B22]/10 p-0.5 rounded-full" />
            <span className="font-semibold text-sm text-[#14391A]">{t.saleCompleted}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-black/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Receipt Area */}
        <div className="overflow-y-auto p-5 bg-slate-50 flex justify-center">
          
          {/* Printable 80mm Thermal Receipt Content */}
          <div 
            id="thermal-receipt-print-area"
            className="w-[80mm] bg-white p-4 shadow-sm border border-slate-200 text-black font-mono-numbers text-[12px] leading-tight select-all"
            style={{ minHeight: '120mm' }}
          >
            {/* Header: Shop name top, bold, centered */}
            <div className="text-center pb-3 border-b border-dashed border-neutral-300">
              <h2 className="font-extrabold text-[16px] uppercase tracking-wide text-neutral-900 text-center font-ethiopic">
                {shopSettings.shopName || 'Sappy Stationary'}
              </h2>
              {shopSettings.shopNameAmharic && (
                <p className="text-[11px] font-ethiopic text-neutral-700 font-semibold">{shopSettings.shopNameAmharic}</p>
              )}
              {shopSettings.tagline && (
                <p className="text-[10px] text-neutral-600 mt-0.5 font-ethiopic">
                  {shopSettings.tagline}
                </p>
              )}

              {/* TIN & Address in Addis Ababa */}
              <div className="mt-2 text-[10px] text-neutral-700 space-y-0.5">
                {shopSettings.tinNumber && (
                  <p className="font-bold tracking-wider">
                    {t.tin}: {shopSettings.tinNumber}
                  </p>
                )}
                {shopSettings.address && (
                  <p className="font-ethiopic">{shopSettings.address}</p>
                )}
                {shopSettings.phone && (
                  <p>Tel: {shopSettings.phone}</p>
                )}
              </div>
            </div>

            {/* Receipt Meta */}
            <div className="py-2.5 border-b border-dashed border-neutral-300 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span className="text-neutral-500">{t.receiptNo}:</span>
                <span className="font-bold">{transaction.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">{t.dateTime}:</span>
                <span className="font-ethiopic">{formattedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">{t.cashier}:</span>
                <span className="capitalize">{transaction.cashierName}</span>
              </div>
            </div>

            {/* Line Items */}
            <div className="py-2.5 border-b border-dashed border-neutral-300">
              <div className="flex justify-between text-[11px] font-bold pb-1 text-neutral-600">
                <span>{t.itemQty}</span>
                <span>{t.total}</span>
              </div>
              <div className="space-y-1.5 pt-1">
                {transaction.items.map((item, idx) => (
                  <div key={idx} className="text-[11px]">
                    <div className="font-semibold text-neutral-900 truncate font-ethiopic flex items-center justify-between">
                      <span>{shopSettings.language === 'am' && item.nameAmharic ? item.nameAmharic : item.name}</span>
                      {shopSettings.enableTax && !item.vatApplicable && (
                        <span className="text-[9px] text-neutral-500 font-normal">[{t.vatExempt}]</span>
                      )}
                    </div>
                    <div className="flex justify-between text-neutral-600 text-[10px]">
                      <span>
                        {item.quantity} x {formatCurrency(item.finalUnitPrice, shopSettings.currencySymbol)}
                        {item.discountValue > 0 && ` (-${item.discountValue}${item.discountType === 'percentage' ? '%' : ''})`}
                      </span>
                      <span className="font-semibold text-neutral-900">
                        {formatCurrency(item.subtotal, shopSettings.currencySymbol)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals Breakdown: Subtotal, Discount, Tax (if enabled), Total */}
            <div className="py-2.5 border-b border-dashed border-neutral-300 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-neutral-600">{t.subtotal}:</span>
                <span>{formatCurrency(transaction.subtotal, shopSettings.currencySymbol)}</span>
              </div>

              {transaction.cartDiscountAmount > 0 && (
                <div className="flex justify-between text-neutral-700">
                  <span>{t.cartDiscount}:</span>
                  <span>-{formatCurrency(transaction.cartDiscountAmount, shopSettings.currencySymbol)}</span>
                </div>
              )}

              {/* Tax lines: ONLY appear when Charge Tax is enabled in Settings */}
              {shopSettings.enableTax && transaction.taxAmount > 0 && (
                <div className="flex justify-between text-neutral-700 pt-0.5">
                  <span>{shopSettings.taxName} ({transaction.taxRate}%):</span>
                  <span className="font-semibold">{formatCurrency(transaction.taxAmount, shopSettings.currencySymbol)}</span>
                </div>
              )}

              {shopSettings.enableTax && transaction.exemptSubtotal > 0 && (
                <div className="flex justify-between text-neutral-500 text-[10px]">
                  <span>{t.vatExempt} Items:</span>
                  <span>{formatCurrency(transaction.exemptSubtotal, shopSettings.currencySymbol)}</span>
                </div>
              )}

              <div className="flex justify-between text-[14px] font-bold pt-1.5 border-t border-neutral-200">
                <span>{t.total}:</span>
                <span>{formatCurrency(transaction.total, shopSettings.currencySymbol)}</span>
              </div>
            </div>

            {/* Payment Info */}
            <div className="py-2.5 border-b border-dashed border-neutral-300 space-y-1 text-[11px]">
              <div className="flex justify-between capitalize">
                <span className="text-neutral-600">{t.paidVia}:</span>
                <span className="font-semibold font-ethiopic">{getPaymentMethodDisplay(transaction.paymentMethod)}</span>
              </div>

              {transaction.paymentReference && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-neutral-600">{t.refNo}:</span>
                  <span className="font-bold">{transaction.paymentReference}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-neutral-600">{t.tendered}:</span>
                <span>{formatCurrency(transaction.amountTendered, shopSettings.currencySymbol)}</span>
              </div>

              {transaction.changeGiven > 0 && (
                <div className="flex justify-between font-semibold">
                  <span className="text-neutral-600">{t.change}:</span>
                  <span>{formatCurrency(transaction.changeGiven, shopSettings.currencySymbol)}</span>
                </div>
              )}
            </div>

            {/* Footer & Barcode */}
            <div className="pt-3 text-center space-y-2">
              <svg ref={barcodeRef} className="mx-auto" />
              <p className="text-[10px] text-neutral-600 font-ethiopic leading-normal">
                {shopSettings.language === 'am' && shopSettings.receiptFooterAmharic 
                  ? shopSettings.receiptFooterAmharic 
                  : shopSettings.receiptFooter}
              </p>
              <p className="text-[8px] text-neutral-400 font-mono-numbers">
                {t.endOfReceipt}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="p-4 bg-white border-t border-[#DCE8DC] flex gap-3 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 px-4 py-2.5 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            {t.printThermalReceipt}
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onNewSale();
            }}
            className="px-4 py-2.5 border border-[#DCE8DC] hover:bg-slate-50 text-[#14391A] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            {t.newSale}
            <ArrowRight className="w-4 h-4 text-[#228B22]" />
          </button>
        </div>
      </div>
    </div>
  );
};
