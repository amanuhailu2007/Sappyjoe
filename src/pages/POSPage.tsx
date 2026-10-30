/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Camera, 
  Plus, 
  AlertTriangle, 
  Tag, 
  RotateCcw,
  Package,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  InventoryItem, 
  CartItem, 
  QuickSalePreset, 
  ShopSettings, 
  UserProfile, 
  HeldCart,
  SaleTransaction,
  ItemCategory,
  PaymentMethod
} from '../types';
import { formatCurrency } from '../utils/barcode';
import { CartPanel } from '../components/pos/CartPanel';
import { QuickSalePanel } from '../components/pos/QuickSalePanel';
import { PaymentModal } from '../components/pos/PaymentModal';
import { ThermalReceiptModal } from '../components/pos/ThermalReceiptModal';
import { HeldCartsModal } from '../components/pos/HeldCartsModal';
import { useToast } from '../components/common/ToastContext';
import { processCheckout, saveHeldCart, deleteHeldCart } from '../services/dataService';
import { playScanBeep } from '../utils/sound';

interface POSPageProps {
  items: InventoryItem[];
  quickPresets: QuickSalePreset[];
  shopSettings: ShopSettings;
  currentUser: UserProfile;
  heldCarts: HeldCart[];
  onOpenScanner: () => void;
  onRefreshData: () => Promise<void>;
  onUpdatePreset?: (preset: QuickSalePreset) => void;
  onAddPreset?: (preset: QuickSalePreset) => void;
  onAddNewItemWithBarcode?: (barcode: string) => void;
}

export const POSPage: React.FC<POSPageProps> = ({
  items,
  quickPresets,
  shopSettings,
  currentUser,
  heldCarts,
  onOpenScanner,
  onRefreshData,
  onUpdatePreset,
  onAddPreset,
  onAddNewItemWithBarcode
}) => {
  const toast = useToast();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [cartDiscountType, setCartDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [cartDiscountValue, setCartDiscountValue] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(shopSettings.taxRate);

  // Modals state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isHoldModalOpen, setIsHoldModalOpen] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<SaleTransaction | null>(null);

  // Categories list
  const categories: string[] = [
    'All',
    'Paper & Notebooks',
    'Writing & Pens',
    'Office Supplies',
    'Printing & Media',
    'Art & Craft'
  ];

  // Filter products by search and category
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.barcode.includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [items, selectedCategory, searchQuery]);

  // Add inventory item to cart
  const handleAddToCart = (item: InventoryItem) => {
    playScanBeep(shopSettings.enableSoundBeep);
    setCart((prev) => {
      const existingIdx = prev.findIndex((ci) => !ci.isQuickService && ci.item.id === item.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        const existing = next[existingIdx];
        const newQty = existing.quantity + 1;
        const discountAmount = existing.discountType === 'percentage'
          ? (item.sellingPrice * existing.discountValue) / 100
          : existing.discountValue;
        const finalUnitPrice = Math.max(0, item.sellingPrice - discountAmount);

        next[existingIdx] = {
          ...existing,
          quantity: newQty,
          finalUnitPrice,
          subtotal: Number((finalUnitPrice * newQty).toFixed(2))
        };
        return next;
      } else {
        return [
          ...prev,
          {
            item,
            quantity: 1,
            discountType: 'percentage',
            discountValue: 0,
            finalUnitPrice: item.sellingPrice,
            subtotal: item.sellingPrice,
            vatApplicable: item.vatApplicable ?? false,
            isQuickService: false
          }
        ];
      }
    });
    toast.success(`Added ${item.name}`);
  };

  // Add quick non-barcode service to cart
  const handleAddQuickService = (preset: QuickSalePreset, quantity: number) => {
    playScanBeep(shopSettings.enableSoundBeep);
    const serviceItem: InventoryItem = {
      id: preset.id,
      name: preset.name,
      sku: preset.sku,
      barcode: preset.barcode,
      category: preset.category,
      costPrice: preset.costPrice,
      sellingPrice: preset.unitPrice,
      stock: 999999,
      lowStockThreshold: 0,
      vatApplicable: preset.vatApplicable ?? false,
      unit: preset.unit,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    setCart((prev) => {
      const existingIdx = prev.findIndex((ci) => ci.isQuickService && ci.item.id === preset.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        const existing = next[existingIdx];
        const newQty = existing.quantity + quantity;
        const finalUnitPrice = serviceItem.sellingPrice;
        next[existingIdx] = {
          ...existing,
          quantity: newQty,
          subtotal: Number((finalUnitPrice * newQty).toFixed(2))
        };
        return next;
      } else {
        return [
          ...prev,
          {
            item: serviceItem,
            quantity,
            discountType: 'percentage',
            discountValue: 0,
            finalUnitPrice: preset.unitPrice,
            subtotal: Number((preset.unitPrice * quantity).toFixed(2)),
            vatApplicable: preset.vatApplicable ?? false,
            isQuickService: true
          }
        ];
      }
    });

    toast.success(`Added ${quantity}x ${preset.name}`);
  };

  // Cart operations
  const handleUpdateQuantity = (index: number, quantity: number) => {
    setCart((prev) => {
      const next = [...prev];
      const target = next[index];
      if (!target) return prev;
      next[index] = {
        ...target,
        quantity,
        subtotal: Number((target.finalUnitPrice * quantity).toFixed(2))
      };
      return next;
    });
  };

  const handleUpdateItemDiscount = (
    index: number, 
    discountType: 'percentage' | 'fixed', 
    discountValue: number
  ) => {
    setCart((prev) => {
      const next = [...prev];
      const target = next[index];
      if (!target) return prev;
      const base = target.item.sellingPrice;
      const discountAmount = discountType === 'percentage' ? (base * discountValue) / 100 : discountValue;
      const finalUnitPrice = Math.max(0, base - discountAmount);

      next[index] = {
        ...target,
        discountType,
        discountValue,
        finalUnitPrice: Number(finalUnitPrice.toFixed(2)),
        subtotal: Number((finalUnitPrice * target.quantity).toFixed(2))
      };
      return next;
    });
  };

  const handleRemoveItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearCart = () => {
    setCart([]);
    setCartDiscountValue(0);
  };

  // Hold / Resume Cart
  const handleHoldCurrentCart = async (label: string) => {
    if (cart.length === 0) return;
    const newHeld: HeldCart = {
      id: `hold_${Date.now()}`,
      label,
      items: cart,
      cartDiscountType,
      cartDiscountValue,
      taxRate,
      createdAt: new Date().toISOString()
    };
    await saveHeldCart(newHeld);
    setCart([]);
    setCartDiscountValue(0);
    setIsHoldModalOpen(false);
    await onRefreshData();
    toast.info(`Cart parked: "${label}"`);
  };

  const handleResumeCart = async (heldCart: HeldCart) => {
    setCart(heldCart.items);
    setCartDiscountType(heldCart.cartDiscountType);
    setCartDiscountValue(heldCart.cartDiscountValue);
    setTaxRate(heldCart.taxRate);
    await deleteHeldCart(heldCart.id);
    setIsHoldModalOpen(false);
    await onRefreshData();
    toast.success(`Resumed "${heldCart.label}"`);
  };

  const handleDeleteHeldCart = async (cartId: string) => {
    await deleteHeldCart(cartId);
    await onRefreshData();
    toast.info("Parked cart removed");
  };

  // Checkout submission
  const handleConfirmPayment = async (details: {
    method: PaymentMethod;
    amountTendered: number;
    notes?: string;
  }) => {
    const transaction = await processCheckout(
      cart,
      {
        method: details.method,
        amountTendered: details.amountTendered,
        cartDiscountType,
        cartDiscountValue,
        taxRate,
        notes: details.notes
      },
      currentUser,
      shopSettings
    );

    setCompletedTransaction(transaction);
    setIsPaymentModalOpen(false);
    setIsReceiptModalOpen(true);
    await onRefreshData();
    toast.success(`Transaction ${transaction.receiptNumber} completed!`);
  };

  const handleNewSale = () => {
    setCart([]);
    setCartDiscountValue(0);
    setTaxRate(shopSettings.taxRate);
    setIsReceiptModalOpen(false);
    setCompletedTransaction(null);
  };

  // Totals preview
  const subtotal = cart.reduce((sum, ci) => sum + ci.subtotal, 0);
  let cartDiscountAmount = 0;
  if (cartDiscountType === 'percentage') {
    cartDiscountAmount = (subtotal * cartDiscountValue) / 100;
  } else {
    cartDiscountAmount = Math.min(subtotal, cartDiscountValue);
  }
  const taxableAmount = Math.max(0, subtotal - cartDiscountAmount);
  const taxAmount = (taxableAmount * taxRate) / 100;
  const grandTotal = taxableAmount + taxAmount;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      
      {/* Left Column: Search, Quick Services, Products Grid (8 cols) */}
      <div className="lg:col-span-7 xl:col-span-8 space-y-4">
        
        {/* Search & Camera Scanner Bar */}
        <div className="bg-white p-3 rounded-2xl border border-[#DCE8DC] shadow-sm flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search product name, SKU, or scan barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs border border-[#DCE8DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#228B22]/20 focus:border-[#228B22] bg-[#F6FAF6]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-600 text-xs absolute right-3 top-1/2 -translate-y-1/2"
              >
                Clear
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenScanner}
            className="px-4 py-2.5 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm shrink-0"
          >
            <Camera className="w-4 h-4" />
            Scan Barcode
          </button>
        </div>

        {/* Quick Sale Services Panel */}
        <QuickSalePanel
          presets={quickPresets}
          shopSettings={shopSettings}
          userRole={currentUser.role}
          onAddQuickService={handleAddQuickService}
          onUpdatePreset={onUpdatePreset}
          onAddPreset={onAddPreset}
        />

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-[#228B22] text-white shadow-sm'
                  : 'bg-white border border-[#DCE8DC] text-slate-600 hover:bg-[#F6FAF6]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredItems.length === 0 ? (
            <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-[#DCE8DC]">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-30 text-[#228B22]" />
              <p className="text-sm font-semibold text-slate-700">No Products Found</p>
              <p className="text-xs text-slate-400 mt-1">
                Try searching with a different keyword or category.
              </p>
            </div>
          ) : (
            filteredItems.map((item) => {
              const isLowStock = item.stock <= item.lowStockThreshold;
              const isOutOfStock = item.stock <= 0;

              return (
                <div
                  key={item.id}
                  onClick={() => !isOutOfStock && handleAddToCart(item)}
                  className={`bg-white p-3.5 rounded-2xl border border-[#DCE8DC] flex flex-col justify-between transition-all select-none ${
                    isOutOfStock
                      ? 'opacity-60 cursor-not-allowed bg-slate-50'
                      : 'hover:border-[#228B22] hover:shadow-md cursor-pointer active:scale-[0.98]'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-1.5">
                      <span className="text-[10px] text-slate-500 font-medium truncate max-w-[120px]">
                        {item.category.split(' ')[0]}
                      </span>
                      {isOutOfStock ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                          Out
                        </span>
                      ) : isLowStock ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 flex items-center gap-0.5">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {item.stock} left
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-500 font-mono-numbers">
                          {item.stock} {item.unit || 'in stock'}
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-xs text-[#14391A] line-clamp-2 leading-snug">
                      {item.name}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-mono-numbers mt-0.5 truncate">
                      {item.barcode}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#DCE8DC]/50">
                    <span className="font-bold text-sm text-[#228B22] font-mono-numbers">
                      {formatCurrency(item.sellingPrice, shopSettings.currencySymbol)}
                    </span>
                    <button
                      type="button"
                      disabled={isOutOfStock}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                        isOutOfStock
                          ? 'bg-slate-200 text-slate-400'
                          : 'bg-[#228B22]/10 hover:bg-[#228B22] text-[#228B22] hover:text-white'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Column: Sticky Cart Panel (4-5 cols) */}
      <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-4 h-[calc(100vh-2rem)]">
        <CartPanel
          cart={cart}
          shopSettings={shopSettings}
          taxRate={taxRate}
          cartDiscountType={cartDiscountType}
          cartDiscountValue={cartDiscountValue}
          heldCartsCount={heldCarts.length}
          onUpdateQuantity={handleUpdateQuantity}
          onUpdateItemDiscount={handleUpdateItemDiscount}
          onRemoveItem={handleRemoveItem}
          onClearCart={handleClearCart}
          onOpenHoldModal={() => setIsHoldModalOpen(true)}
          onUpdateCartDiscount={(type, val) => {
            setCartDiscountType(type);
            setCartDiscountValue(val);
          }}
          onUpdateTaxRate={setTaxRate}
          onProceedToPay={() => setIsPaymentModalOpen(true)}
        />
      </div>

      {/* Payment Tender Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        total={grandTotal}
        subtotal={subtotal}
        taxAmount={taxAmount}
        discountAmount={cartDiscountAmount}
        shopSettings={shopSettings}
        onClose={() => setIsPaymentModalOpen(false)}
        onConfirmPayment={handleConfirmPayment}
      />

      {/* 80mm Thermal Receipt Print Modal */}
      <ThermalReceiptModal
        isOpen={isReceiptModalOpen}
        transaction={completedTransaction}
        shopSettings={shopSettings}
        onClose={() => setIsReceiptModalOpen(false)}
        onNewSale={handleNewSale}
      />

      {/* Parked / Held Carts Modal */}
      <HeldCartsModal
        isOpen={isHoldModalOpen}
        heldCarts={heldCarts}
        shopSettings={shopSettings}
        onClose={() => setIsHoldModalOpen(false)}
        onResume={handleResumeCart}
        onDelete={handleDeleteHeldCart}
        onHoldCurrentCart={handleHoldCurrentCart}
        canHoldCurrentCart={cart.length > 0}
      />
    </div>
  );
};
