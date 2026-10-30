/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'admin' | 'cashier';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean; // active account status enforced
  signupCode?: string; // used during passcode-protected self registration
  createdAt: string;
  lastLogin?: string;
  avatarUrl?: string;
}

export interface SecuritySettings {
  passcode: string;
  changedAt: string;
  changedBy: string;
  isDefault: boolean;
}

export interface Category {
  id: string;
  name: string;
  nameAmharic?: string;
  createdAt: string;
}

export type ItemCategory = 
  | 'Paper & Notebooks'
  | 'Writing & Pens'
  | 'Office Supplies'
  | 'Printing & Media'
  | 'Art & Craft'
  | 'Services & Binding'
  | 'Other';

export interface InventoryItem {
  id: string;
  name: string;
  nameAmharic?: string;
  sku: string;
  barcode: string;
  category: ItemCategory;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  lowStockThreshold: number;
  vatApplicable: boolean; // VAT applies (default true) or exempt
  supplier?: string;
  description?: string;
  unit?: string; // e.g. "pcs", "pack", "ream", "page"
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  item: InventoryItem;
  quantity: number;
  discountType: 'percentage' | 'fixed';
  discountValue: number; // e.g. 10% or ETB 20
  finalUnitPrice: number;
  subtotal: number;
  vatApplicable: boolean;
  isQuickService?: boolean;
}

export type PaymentMethod = 
  | 'cash' 
  | 'telebirr' 
  | 'cbe_birr' 
  | 'bank_transfer' 
  | 'card';

export interface SaleTransaction {
  id: string;
  receiptNumber: string;
  items: {
    itemId: string;
    name: string;
    nameAmharic?: string;
    sku: string;
    barcode: string;
    category: ItemCategory;
    costPrice: number;
    sellingPrice: number;
    quantity: number;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
    finalUnitPrice: number;
    subtotal: number;
    vatApplicable: boolean;
    isQuickService?: boolean;
  }[];
  subtotal: number;
  cartDiscountType: 'percentage' | 'fixed';
  cartDiscountValue: number;
  cartDiscountAmount: number;
  taxableSubtotal: number; // sum of items with VAT applicable
  exemptSubtotal: number;  // sum of items exempt from VAT
  taxRate: number; // e.g. 15.0 for Ethiopia VAT
  taxAmount: number;
  total: number;
  costTotal: number;
  profitTotal: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string; // Transaction code for Telebirr, CBE Birr, Bank Transfer, Card
  amountTendered: number;
  changeGiven: number;
  cashierId: string;
  cashierName: string;
  cashierEmail: string;
  timestamp: string; // ISO string in UTC/Addis Ababa
  notes?: string;
  status: 'completed' | 'refunded';
}

export interface HeldCart {
  id: string;
  label: string;
  customerName?: string;
  items: CartItem[];
  cartDiscountType: 'percentage' | 'fixed';
  cartDiscountValue: number;
  taxRate: number;
  createdAt: string;
}

export interface QuickSalePreset {
  id: string;
  name: string;
  nameAmharic?: string;
  category: ItemCategory;
  unitPrice: number;
  costPrice: number;
  unit: string; // e.g. "per page", "per doc", "sheet"
  sku: string;
  barcode: string;
  vatApplicable: boolean;
  iconName?: string;
}

export type StockAdjustmentReason = 
  | 'Restock / Delivery'
  | 'Damaged / Spoiled'
  | 'Inventory Count Correction'
  | 'Internal Shop Use'
  | 'Customer Return'
  | 'Sale Deduction';

export interface StockLog {
  id: string;
  itemId: string;
  itemName: string;
  sku: string;
  previousStock: number;
  newStock: number;
  change: number; // positive or negative
  reason: StockAdjustmentReason;
  notes?: string;
  cashierId: string;
  cashierName: string;
  timestamp: string;
}

export interface ShopSettings {
  shopName: string;
  shopNameAmharic?: string;
  tagline: string;
  taglineAmharic?: string;
  tinNumber: string; // Ethiopian Tax Identification Number
  phone: string;
  email: string;
  address: string;
  addressAmharic?: string;
  currencySymbol: string; // "ETB"
  currencyCode: string;   // "ETB"
  enableTax: boolean;     // "Charge tax" switch (default false for tax-exempt business)
  taxRate: number;        // default 0%
  taxName: string;        // "VAT" or "Tax"
  pricesIncludeVat: boolean; // toggle for VAT-inclusive vs exclusive prices
  useEthiopianCalendar: boolean; // toggle for Ethiopian calendar display
  language: 'en' | 'am';   // UI language
  receiptFooter: string;
  receiptFooterAmharic?: string;
  logoUrl?: string;
  enableSoundBeep: boolean;
  lowStockGlobalThreshold: number;
  inactivityTimeoutMinutes?: number; // 30 minutes default
}
