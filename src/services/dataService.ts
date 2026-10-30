/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  runTransaction,
  onSnapshot,
  type Unsubscribe
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../config/firebase';
import { 
  InventoryItem, 
  Category,
  ShopSettings, 
  UserProfile, 
  HeldCart, 
  SaleTransaction, 
  StockLog, 
  StockAdjustmentReason,
  CartItem,
  PaymentMethod,
  QuickSalePreset,
  SecuritySettings
} from '../types';

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  passcode: "Default",
  changedAt: new Date().toISOString(),
  changedBy: "system",
  isDefault: true
};

export const DEFAULT_SHOP_SETTINGS: ShopSettings = {
  shopName: "Sappy Stationary",
  shopNameAmharic: "ሳፒ ስቴሽነሪ",
  tagline: "Quality Stationery & Printing Services",
  taglineAmharic: "ጥራት ያላቸው የጽህፈት መሣሪያዎችና የህትመት አገልግሎቶች",
  tinNumber: "0084729105",
  phone: "+251 911 234 567",
  email: "contact@sappystationary.local",
  address: "Bole Medhanialem, Sub City Bole, Addis Ababa, Ethiopia",
  addressAmharic: "ቦሌ መድኃኔዓለም፣ ቦሌ ክ/ከተማ፣ አዲስ አበባ፣ ኢትዮጵያ",
  currencySymbol: "ETB",
  currencyCode: "ETB",
  enableTax: false, // Default: TAX EXEMPT
  taxRate: 0.0,
  taxName: "VAT",
  pricesIncludeVat: false,
  useEthiopianCalendar: false,
  language: 'en',
  receiptFooter: "Thank you for shopping at Sappy Stationary!",
  receiptFooterAmharic: "ስለገበዩ እናመሰግናለን!",
  enableSoundBeep: true,
  lowStockGlobalThreshold: 10,
  inactivityTimeoutMinutes: 30
};

// -------------------------------------------------------------
// SETTINGS
// -------------------------------------------------------------

export async function getSettings(): Promise<ShopSettings> {
  if (!db) return DEFAULT_SHOP_SETTINGS;
  try {
    const snap = await getDoc(doc(db, 'settings', 'store'));
    if (snap.exists()) {
      return { ...DEFAULT_SHOP_SETTINGS, ...(snap.data() as ShopSettings) };
    }
    return DEFAULT_SHOP_SETTINGS;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'settings/store');
    return DEFAULT_SHOP_SETTINGS;
  }
}

export function subscribeSettings(onUpdate: (settings: ShopSettings) => void): Unsubscribe {
  if (!db) {
    onUpdate(DEFAULT_SHOP_SETTINGS);
    return () => {};
  }
  return onSnapshot(doc(db, 'settings', 'store'), (snap) => {
    if (snap.exists()) {
      onUpdate({ ...DEFAULT_SHOP_SETTINGS, ...(snap.data() as ShopSettings) });
    } else {
      onUpdate(DEFAULT_SHOP_SETTINGS);
    }
  }, (err) => {
    console.error("Settings subscription error:", err);
  });
}

/**
 * Creates the settings document automatically on first admin login if missing.
 */
export async function bootstrapSettingsIfMissing(adminUser: UserProfile): Promise<ShopSettings> {
  if (!db || adminUser.role !== 'admin') return DEFAULT_SHOP_SETTINGS;
  try {
    const settingsRef = doc(db, 'settings', 'store');
    const snap = await getDoc(settingsRef);
    if (!snap.exists()) {
      const initialSettings: ShopSettings = {
        ...DEFAULT_SHOP_SETTINGS,
        shopName: "Sappy Stationary",
        currencySymbol: "ETB",
        currencyCode: "ETB"
      };
      await setDoc(settingsRef, initialSettings);
      return initialSettings;
    }
    return { ...DEFAULT_SHOP_SETTINGS, ...(snap.data() as ShopSettings) };
  } catch (err) {
    console.warn("Bootstrap settings check caught:", err);
    return DEFAULT_SHOP_SETTINGS;
  }
}

export async function saveSettings(settings: ShopSettings): Promise<void> {
  if (!db) throw new Error("Database not connected");
  try {
    await setDoc(doc(db, 'settings', 'store'), settings, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/store');
  }
}

// -------------------------------------------------------------
// MASTER PASSCODE & SECURITY SETTINGS
// -------------------------------------------------------------

export async function getSecuritySettings(): Promise<SecuritySettings> {
  if (!db) return DEFAULT_SECURITY_SETTINGS;
  try {
    const snap = await getDoc(doc(db, 'settings', 'security'));
    if (snap.exists()) {
      return snap.data() as SecuritySettings;
    }
    return DEFAULT_SECURITY_SETTINGS;
  } catch (err) {
    console.warn("Could not fetch security settings:", err);
    return DEFAULT_SECURITY_SETTINGS;
  }
}

export function subscribeSecuritySettings(onUpdate: (sec: SecuritySettings) => void): Unsubscribe {
  if (!db) {
    onUpdate(DEFAULT_SECURITY_SETTINGS);
    return () => {};
  }
  return onSnapshot(doc(db, 'settings', 'security'), (snap) => {
    if (snap.exists()) {
      onUpdate(snap.data() as SecuritySettings);
    } else {
      onUpdate(DEFAULT_SECURITY_SETTINGS);
    }
  }, (err) => {
    console.error("Security settings subscription error:", err);
  });
}

export async function bootstrapSecurityIfMissing(adminUser: UserProfile): Promise<SecuritySettings> {
  if (!db || adminUser.role !== 'admin') return DEFAULT_SECURITY_SETTINGS;
  try {
    const secRef = doc(db, 'settings', 'security');
    const snap = await getDoc(secRef);
    if (!snap.exists()) {
      const initialSecurity: SecuritySettings = {
        passcode: "Default",
        changedAt: new Date().toISOString(),
        changedBy: adminUser.displayName || adminUser.email || "system",
        isDefault: true
      };
      await setDoc(secRef, initialSecurity);
      return initialSecurity;
    }
    return snap.data() as SecuritySettings;
  } catch (err) {
    console.warn("Bootstrap security check caught:", err);
    return DEFAULT_SECURITY_SETTINGS;
  }
}

export async function updateMasterPasscode(
  currentPasscode: string,
  newPasscode: string,
  adminUser: UserProfile
): Promise<void> {
  if (!db) throw new Error("Database not connected");
  const secRef = doc(db, 'settings', 'security');
  const snap = await getDoc(secRef);
  const currentData = snap.exists() ? (snap.data() as SecuritySettings) : DEFAULT_SECURITY_SETTINGS;

  if (currentData.passcode !== currentPasscode.trim()) {
    throw new Error("Current master passcode is incorrect.");
  }

  const trimmedNew = newPasscode.trim();
  if (trimmedNew.length < 6) {
    throw new Error("New master passcode must be at least 6 characters long.");
  }
  if (trimmedNew === "Default") {
    throw new Error("New master passcode cannot equal 'Default'.");
  }

  const updated: SecuritySettings = {
    passcode: trimmedNew,
    changedAt: new Date().toISOString(),
    changedBy: adminUser.displayName || adminUser.email || "Admin",
    isDefault: false
  };

  await setDoc(secRef, updated);
}

export async function verifyMasterPasscode(enteredPasscode: string): Promise<boolean> {
  if (!db) return false;
  try {
    const snap = await getDoc(doc(db, 'settings', 'security'));
    if (!snap.exists()) {
      return enteredPasscode.trim() === "Default";
    }
    const data = snap.data() as SecuritySettings;
    return data.passcode === enteredPasscode.trim();
  } catch (err) {
    console.error("Passcode verification error:", err);
    return false;
  }
}

export async function refundSaleTransaction(saleId: string, adminUser?: UserProfile): Promise<void> {
  if (!db) throw new Error("Database not connected");
  const firestore = db;
  const now = new Date().toISOString();

  try {
    await runTransaction(firestore, async (tx) => {
      const saleRef = doc(firestore, 'sales', saleId);
      const saleDoc = await tx.get(saleRef);
      if (!saleDoc.exists()) throw new Error("Sale transaction record not found.");
      const saleData = saleDoc.data() as SaleTransaction;
      if (saleData.status === 'refunded') {
        throw new Error("This transaction has already been refunded.");
      }

      // Restore inventory items
      if (saleData.items && saleData.items.length) {
        for (const item of saleData.items) {
          if (!item.isQuickService && item.itemId) {
            const itemRef = doc(firestore, 'items', item.itemId);
            const itemSnap = await tx.get(itemRef);
            if (itemSnap.exists()) {
              const currentStock = Number(itemSnap.data().stock) || 0;
              const newStock = currentStock + item.quantity;
              tx.update(itemRef, {
                stock: newStock,
                updatedAt: now
              });

              const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
              const returnLog: StockLog = {
                id: logId,
                itemId: item.itemId,
                itemName: item.name,
                sku: item.sku || '',
                previousStock: currentStock,
                newStock: newStock,
                change: item.quantity,
                reason: 'Customer Return',
                notes: `Void/Refund on receipt ${saleData.receiptNumber}`,
                cashierId: adminUser?.id || 'admin',
                cashierName: adminUser?.displayName || 'Admin',
                timestamp: now
              };
              tx.set(doc(firestore, 'stockLogs', logId), returnLog);
            }
          }
        }
      }

      tx.update(saleRef, {
        status: 'refunded',
        refundedAt: now,
        refundedBy: adminUser?.displayName || adminUser?.email || 'Admin'
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `sales/${saleId}`);
  }
}

// -------------------------------------------------------------
// ITEMS
// -------------------------------------------------------------

export async function getItems(): Promise<InventoryItem[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'items'));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<InventoryItem, 'id'>) }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'items');
    return [];
  }
}

export function subscribeItems(onUpdate: (items: InventoryItem[]) => void): Unsubscribe {
  if (!db) {
    onUpdate([]);
    return () => {};
  }
  return onSnapshot(collection(db, 'items'), (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<InventoryItem, 'id'>) }));
    onUpdate(items);
  }, (err) => {
    console.error("Items subscription error:", err);
  });
}

export async function saveItem(item: InventoryItem): Promise<void> {
  if (!db) throw new Error("Database not connected");
  try {
    await setDoc(doc(db, 'items', item.id), item);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `items/${item.id}`);
  }
}

export async function deleteItem(itemId: string): Promise<void> {
  if (!db) throw new Error("Database not connected");
  try {
    await deleteDoc(doc(db, 'items', itemId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `items/${itemId}`);
  }
}

// -------------------------------------------------------------
// CATEGORIES
// -------------------------------------------------------------

export async function getCategories(): Promise<Category[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'categories'));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'categories');
    return [];
  }
}

export function subscribeCategories(onUpdate: (cats: Category[]) => void): Unsubscribe {
  if (!db) {
    onUpdate([]);
    return () => {};
  }
  return onSnapshot(collection(db, 'categories'), (snap) => {
    const cats = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }));
    onUpdate(cats);
  }, (err) => {
    console.error("Categories subscription error:", err);
  });
}

export async function saveCategory(cat: Category): Promise<void> {
  if (!db) throw new Error("Database not connected");
  try {
    await setDoc(doc(db, 'categories', cat.id), cat);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `categories/${cat.id}`);
  }
}

export async function deleteCategory(catId: string): Promise<void> {
  if (!db) throw new Error("Database not connected");
  try {
    await deleteDoc(doc(db, 'categories', catId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `categories/${catId}`);
  }
}

// -------------------------------------------------------------
// QUICK SALE PRESETS (Services like photocopy, printing, binding)
// -------------------------------------------------------------

export async function getQuickPresets(): Promise<QuickSalePreset[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'quick_presets'));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<QuickSalePreset, 'id'>) }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'quick_presets');
    return [];
  }
}

export function subscribeQuickPresets(onUpdate: (presets: QuickSalePreset[]) => void): Unsubscribe {
  if (!db) {
    onUpdate([]);
    return () => {};
  }
  return onSnapshot(collection(db, 'quick_presets'), (snap) => {
    const presets = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<QuickSalePreset, 'id'>) }));
    onUpdate(presets);
  }, (err) => {
    console.error("Quick presets subscription error:", err);
  });
}

export async function saveQuickPreset(preset: QuickSalePreset): Promise<void> {
  if (!db) throw new Error("Database not connected");
  try {
    await setDoc(doc(db, 'quick_presets', preset.id), preset);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `quick_presets/${preset.id}`);
  }
}

export async function deleteQuickPreset(presetId: string): Promise<void> {
  if (!db) throw new Error("Database not connected");
  try {
    await deleteDoc(doc(db, 'quick_presets', presetId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `quick_presets/${presetId}`);
  }
}

// -------------------------------------------------------------
// SALES TRANSACTIONS & STOCK DEDUCTION
// -------------------------------------------------------------

export async function getSales(userId: string, isAdmin: boolean): Promise<SaleTransaction[]> {
  if (!db) return [];
  try {
    const salesCol = collection(db, 'sales');
    const q = isAdmin 
      ? query(salesCol, orderBy('timestamp', 'desc'), limit(500))
      : query(salesCol, where('cashierId', '==', userId), orderBy('timestamp', 'desc'), limit(250));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<SaleTransaction, 'id'>) }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'sales');
    return [];
  }
}

export function subscribeSales(userId: string, isAdmin: boolean, onUpdate: (sales: SaleTransaction[]) => void): Unsubscribe {
  if (!db) {
    onUpdate([]);
    return () => {};
  }
  const salesCol = collection(db, 'sales');
  const q = isAdmin 
    ? query(salesCol, orderBy('timestamp', 'desc'), limit(500))
    : query(salesCol, where('cashierId', '==', userId), orderBy('timestamp', 'desc'), limit(250));
  
  return onSnapshot(q, (snap) => {
    const sales = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<SaleTransaction, 'id'>) }));
    onUpdate(sales);
  }, (err) => {
    console.error("Sales subscription error:", err);
  });
}

/**
 * Atomic sale checkout with transaction stock deduction in Firestore
 */
export async function processCheckout(
  cart: CartItem[],
  details: {
    method: PaymentMethod;
    paymentReference?: string;
    amountTendered: number;
    cartDiscountType: 'percentage' | 'fixed';
    cartDiscountValue: number;
    taxRate: number;
    notes?: string;
  },
  cashier: UserProfile,
  shopSettings: ShopSettings
): Promise<SaleTransaction> {
  if (!cart.length) throw new Error("Cart is empty");
  if (!db) throw new Error("Database not connected");

  const grossOrNetSubtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  let cartDiscountAmount = 0;
  if (details.cartDiscountType === 'percentage') {
    cartDiscountAmount = (grossOrNetSubtotal * details.cartDiscountValue) / 100;
  } else {
    cartDiscountAmount = Math.min(grossOrNetSubtotal, details.cartDiscountValue);
  }

  const effectiveTotal = Math.max(0, grossOrNetSubtotal - cartDiscountAmount);
  const discountRatio = grossOrNetSubtotal > 0 ? effectiveTotal / grossOrNetSubtotal : 1;

  let grandTotal = 0;
  let taxAmount = 0;
  let taxableSubtotal = 0;
  let exemptSubtotal = 0;

  // TAX EXEMPT vs ACTIVE TAX
  if (!shopSettings.enableTax || details.taxRate === 0) {
    // Business is TAX EXEMPT: Totals equal sum of item prices minus discounts
    grandTotal = effectiveTotal;
    taxAmount = 0;
    taxableSubtotal = 0;
    exemptSubtotal = effectiveTotal;
  } else if (shopSettings.pricesIncludeVat) {
    const rateFactor = details.taxRate / 100;
    grandTotal = effectiveTotal;
    cart.forEach((ci) => {
      const itemDiscSubtotal = ci.subtotal * discountRatio;
      if (ci.vatApplicable) {
        const base = itemDiscSubtotal / (1 + rateFactor);
        const vatPart = itemDiscSubtotal - base;
        taxableSubtotal += base;
        taxAmount += vatPart;
      } else {
        exemptSubtotal += itemDiscSubtotal;
      }
    });
  } else {
    const rateFactor = details.taxRate / 100;
    cart.forEach((ci) => {
      const itemDiscSubtotal = ci.subtotal * discountRatio;
      if (ci.vatApplicable) {
        taxableSubtotal += itemDiscSubtotal;
        taxAmount += itemDiscSubtotal * rateFactor;
      } else {
        exemptSubtotal += itemDiscSubtotal;
      }
    });
    grandTotal = taxableSubtotal + exemptSubtotal + taxAmount;
  }

  const changeGiven = details.method === 'cash' ? Math.max(0, details.amountTendered - grandTotal) : 0;
  const costTotal = cart.reduce((sum, ci) => sum + (ci.item.costPrice * ci.quantity), 0);
  const profitTotal = grandTotal - taxAmount - costTotal;

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const receiptNumber = `INV-${dateStr}-${randNum}`;

  const transactionRecord: SaleTransaction = {
    id: `sale_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    receiptNumber,
    items: cart.map(ci => ({
      itemId: ci.item.id,
      name: ci.item.name,
      nameAmharic: ci.item.nameAmharic,
      sku: ci.item.sku,
      barcode: ci.item.barcode,
      category: ci.item.category,
      costPrice: ci.item.costPrice,
      sellingPrice: ci.item.sellingPrice,
      quantity: ci.quantity,
      discountType: ci.discountType,
      discountValue: ci.discountValue,
      finalUnitPrice: ci.finalUnitPrice,
      subtotal: ci.subtotal,
      vatApplicable: ci.vatApplicable,
      isQuickService: ci.isQuickService
    })),
    subtotal: grossOrNetSubtotal,
    cartDiscountType: details.cartDiscountType,
    cartDiscountValue: details.cartDiscountValue,
    cartDiscountAmount,
    taxableSubtotal: Number(taxableSubtotal.toFixed(2)),
    exemptSubtotal: Number(exemptSubtotal.toFixed(2)),
    taxRate: shopSettings.enableTax ? details.taxRate : 0,
    taxAmount: Number(taxAmount.toFixed(2)),
    total: Number(grandTotal.toFixed(2)),
    costTotal: Number(costTotal.toFixed(2)),
    profitTotal: Number(profitTotal.toFixed(2)),
    paymentMethod: details.method,
    paymentReference: details.paymentReference,
    amountTendered: details.amountTendered,
    changeGiven: Number(changeGiven.toFixed(2)),
    cashierId: cashier.id,
    cashierName: cashier.displayName,
    cashierEmail: cashier.email,
    timestamp: now.toISOString(),
    notes: details.notes,
    status: 'completed'
  };

  const firestore = db;

  // Run atomic transaction to deduct stock and record sale
  await runTransaction(firestore, async (tx) => {
    // 1. Read all physical items and verify stock
    const itemReads: { ref: ReturnType<typeof doc>; currentStock: number; qtyNeeded: number; item: CartItem }[] = [];
    
    for (const ci of cart) {
      if (!ci.isQuickService && ci.item.id) {
        const itemRef = doc(firestore, 'items', ci.item.id);
        const itemDoc = await tx.get(itemRef);
        if (itemDoc.exists()) {
          const currentStock = Number(itemDoc.data().stock) || 0;
          if (currentStock < ci.quantity) {
            throw new Error(`Insufficient stock for "${ci.item.name}". Available: ${currentStock}, Requested: ${ci.quantity}`);
          }
          itemReads.push({ ref: itemRef, currentStock, qtyNeeded: ci.quantity, item: ci });
        }
      }
    }

    // 2. Perform updates and stock deduction logs
    for (const read of itemReads) {
      const nextStock = read.currentStock - read.qtyNeeded;
      tx.update(read.ref, {
        stock: nextStock,
        updatedAt: now.toISOString()
      });

      const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const deductionLog: StockLog = {
        id: logId,
        itemId: read.item.item.id,
        itemName: read.item.item.name,
        sku: read.item.item.sku,
        previousStock: read.currentStock,
        newStock: nextStock,
        change: -read.qtyNeeded,
        reason: 'Sale Deduction',
        notes: `Receipt ${receiptNumber}`,
        cashierId: cashier.id,
        cashierName: cashier.displayName,
        timestamp: now.toISOString()
      };
      tx.set(doc(firestore, 'stockLogs', logId), deductionLog);
    }

    // 3. Write sale record
    const saleRef = doc(firestore, 'sales', transactionRecord.id);
    tx.set(saleRef, transactionRecord);
  });

  return transactionRecord;
}

// -------------------------------------------------------------
// STOCK ADJUSTMENTS & AUDIT LOGS
// -------------------------------------------------------------

export async function adjustStock(
  itemId: string,
  change: number,
  reason: StockAdjustmentReason,
  notes: string,
  cashier: UserProfile
): Promise<void> {
  if (!db) throw new Error("Database not connected");
  const firestore = db;
  const now = new Date().toISOString();

  await runTransaction(firestore, async (tx) => {
    const itemRef = doc(firestore, 'items', itemId);
    const itemDoc = await tx.get(itemRef);
    if (!itemDoc.exists()) throw new Error("Item not found in inventory");

    const prevStock = Number(itemDoc.data().stock) || 0;
    const nextStock = Math.max(0, prevStock + change);

    tx.update(itemRef, {
      stock: nextStock,
      updatedAt: now
    });

    const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newLog: StockLog = {
      id: logId,
      itemId,
      itemName: itemDoc.data().name || 'Unknown Item',
      sku: itemDoc.data().sku || '',
      previousStock: prevStock,
      newStock: nextStock,
      change,
      reason,
      notes,
      cashierId: cashier.id,
      cashierName: cashier.displayName,
      timestamp: now
    };
    tx.set(doc(firestore, 'stockLogs', logId), newLog);
  });
}

export async function getStockLogs(): Promise<StockLog[]> {
  if (!db) return [];
  try {
    const q = query(collection(db, 'stockLogs'), orderBy('timestamp', 'desc'), limit(200));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<StockLog, 'id'>) }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'stockLogs');
    return [];
  }
}

export function subscribeStockLogs(onUpdate: (logs: StockLog[]) => void): Unsubscribe {
  if (!db) {
    onUpdate([]);
    return () => {};
  }
  const q = query(collection(db, 'stockLogs'), orderBy('timestamp', 'desc'), limit(200));
  return onSnapshot(q, (snap) => {
    const logs = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<StockLog, 'id'>) }));
    onUpdate(logs);
  }, (err) => {
    console.error("Stock logs subscription error:", err);
  });
}

// -------------------------------------------------------------
// USER MANAGEMENT & ROLE CHECKS
// -------------------------------------------------------------

export async function getUsers(): Promise<UserProfile[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<UserProfile, 'id'>) }));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users');
    return [];
  }
}

export function subscribeUsers(onUpdate: (users: UserProfile[]) => void): Unsubscribe {
  if (!db) {
    onUpdate([]);
    return () => {};
  }
  return onSnapshot(collection(db, 'users'), (snap) => {
    const users = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<UserProfile, 'id'>) }));
    onUpdate(users);
  }, (err) => {
    console.error("Users subscription error:", err);
  });
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!db) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      return { id: snap.id, ...(snap.data() as Omit<UserProfile, 'id'>) };
    }
    return null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${uid}`);
    return null;
  }
}

export async function saveUserDoc(user: UserProfile): Promise<void> {
  if (!db) throw new Error("Database not connected");
  try {
    await setDoc(doc(db, 'users', user.id), user, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.id}`);
  }
}

export async function toggleUserActive(userId: string, active: boolean): Promise<void> {
  if (!db) throw new Error("Database not connected");
  try {
    await updateDoc(doc(db, 'users', userId), { active });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
  }
}

export async function updateUserRole(userId: string, role: 'admin' | 'cashier'): Promise<void> {
  if (!db) throw new Error("Database not connected");
  try {
    await updateDoc(doc(db, 'users', userId), { role });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
  }
}

/**
 * Checks if a user has associated sales transactions before allowing any deletion
 */
export async function checkUserHasSales(userId: string): Promise<boolean> {
  if (!db) return false;
  try {
    const q = query(collection(db, 'sales'), where('cashierId', '==', userId), limit(1));
    const snap = await getDocs(q);
    return !snap.empty;
  } catch {
    return false;
  }
}

// -------------------------------------------------------------
// HELD / PARKED CARTS
// -------------------------------------------------------------

export async function getHeldCarts(): Promise<HeldCart[]> {
  if (!db) return [];
  try {
    const snap = await getDocs(collection(db, 'held_carts'));
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<HeldCart, 'id'>) }));
  } catch {
    return [];
  }
}

export function subscribeHeldCarts(onUpdate: (carts: HeldCart[]) => void): Unsubscribe {
  if (!db) {
    onUpdate([]);
    return () => {};
  }
  return onSnapshot(collection(db, 'held_carts'), (snap) => {
    const carts = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<HeldCart, 'id'>) }));
    onUpdate(carts);
  }, () => {});
}

export async function saveHeldCart(heldCart: HeldCart): Promise<void> {
  if (!db) throw new Error("Database not connected");
  try {
    await setDoc(doc(db, 'held_carts', heldCart.id), heldCart);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `held_carts/${heldCart.id}`);
  }
}

export async function deleteHeldCart(heldCartId: string): Promise<void> {
  if (!db) throw new Error("Database not connected");
  try {
    await deleteDoc(doc(db, 'held_carts', heldCartId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `held_carts/${heldCartId}`);
  }
}
