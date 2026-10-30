/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  AlertTriangle, 
  Edit3, 
  Trash2, 
  SlidersHorizontal, 
  History, 
  Sparkles, 
  Check, 
  X, 
  ArrowUpDown,
  Layers
} from 'lucide-react';
import { 
  InventoryItem, 
  ItemCategory, 
  ShopSettings, 
  UserProfile, 
  StockLog, 
  StockAdjustmentReason 
} from '../types';
import { 
  formatCurrency, 
  generateRandomCode128, 
  generateRandomEan13 
} from '../utils/barcode';
import { 
  saveItem, 
  deleteItem, 
  adjustStock, 
  getStockLogs 
} from '../services/dataService';
import { useToast } from '../components/common/ToastContext';
import { MasterPasscodeModal } from '../components/common/MasterPasscodeModal';

interface InventoryPageProps {
  items: InventoryItem[];
  shopSettings: ShopSettings;
  currentUser: UserProfile;
  prefilledBarcode?: string | null;
  onClearPrefilledBarcode?: () => void;
  onRefreshData: () => Promise<void>;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({
  items,
  shopSettings,
  currentUser,
  prefilledBarcode,
  onClearPrefilledBarcode,
  onRefreshData
}) => {
  const toast = useToast();
  const isAdmin = currentUser.role === 'admin';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

  // Modals
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [stockChangeVal, setStockChangeVal] = useState<number>(10);
  const [stockReason, setStockReason] = useState<StockAdjustmentReason>('Restock / Delivery');
  const [stockNotes, setStockNotes] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<InventoryItem | null>(null);

  // Item Form state
  const [formData, setFormData] = useState<Partial<InventoryItem>>({
    name: '',
    sku: '',
    barcode: '',
    category: 'Paper & Notebooks',
    costPrice: 1.0,
    sellingPrice: 2.0,
    stock: 20,
    lowStockThreshold: 10,
    supplier: '',
    description: '',
    unit: 'pcs'
  });

  // Open modal if prefilledBarcode is passed
  React.useEffect(() => {
    if (prefilledBarcode && isAdmin) {
      setEditingItem(null);
      setFormData({
        name: '',
        sku: `STN-${Date.now().toString().slice(-4)}`,
        barcode: prefilledBarcode,
        category: 'Office Supplies',
        costPrice: 1.0,
        sellingPrice: 2.5,
        stock: 15,
        lowStockThreshold: 5,
        unit: 'pcs'
      });
      setIsAddEditModalOpen(true);
      if (onClearPrefilledBarcode) onClearPrefilledBarcode();
    }
  }, [prefilledBarcode, isAdmin, onClearPrefilledBarcode]);

  // Categories
  const categories: string[] = [
    'All',
    'Paper & Notebooks',
    'Writing & Pens',
    'Office Supplies',
    'Printing & Media',
    'Art & Craft',
    'Other'
  ];

  // Low stock items count
  const lowStockItems = useMemo(() => {
    return items.filter((i) => i.stock <= i.lowStockThreshold);
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filterLowStockOnly && item.stock > item.lowStockThreshold) return false;
      if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        item.barcode.includes(q) ||
        (item.supplier && item.supplier.toLowerCase().includes(q))
      );
    });
  }, [items, selectedCategory, searchQuery, filterLowStockOnly]);

  // Open Add Item modal
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      sku: `STN-${Date.now().toString().slice(-4)}`,
      barcode: generateRandomEan13(),
      category: 'Paper & Notebooks',
      costPrice: 1.0,
      sellingPrice: 2.50,
      stock: 25,
      lowStockThreshold: 10,
      supplier: 'Local Distributor',
      description: '',
      unit: 'pcs'
    });
    setIsAddEditModalOpen(true);
  };

  // Open Edit Item modal
  const handleOpenEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({ ...item });
    setIsAddEditModalOpen(true);
  };

  // Submit Add or Edit
  const handleSaveItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.barcode || !formData.sku) {
      toast.error("Please fill in required fields: Name, SKU, Barcode");
      return;
    }

    const now = new Date().toISOString();
    const finalItem: InventoryItem = {
      id: editingItem ? editingItem.id : `item_${Date.now()}`,
      name: formData.name,
      sku: formData.sku,
      barcode: formData.barcode,
      category: (formData.category as ItemCategory) || 'Other',
      costPrice: Number(formData.costPrice) || 0,
      sellingPrice: Number(formData.sellingPrice) || 0,
      stock: Number(formData.stock) || 0,
      lowStockThreshold: Number(formData.lowStockThreshold) || 10,
      vatApplicable: formData.vatApplicable ?? false,
      supplier: formData.supplier || '',
      description: formData.description || '',
      unit: formData.unit || 'pcs',
      createdAt: editingItem ? editingItem.createdAt : now,
      updatedAt: now
    };

    await saveItem(finalItem);
    setIsAddEditModalOpen(false);
    await onRefreshData();
    toast.success(editingItem ? "Item updated successfully" : "New item registered");
  };

  // Delete item
  const handleDeleteItem = async () => {
    if (!deleteConfirmItem) return;
    await deleteItem(deleteConfirmItem.id);
    setDeleteConfirmItem(null);
    await onRefreshData();
    toast.info("Product removed from inventory");
  };

  // Stock Adjustment Submit
  const handleStockAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;

    await adjustStock(
      adjustingItem.id,
      stockChangeVal,
      stockReason,
      stockNotes,
      currentUser
    );

    setAdjustingItem(null);
    setStockNotes('');
    await onRefreshData();
    toast.success(`Stock adjusted for ${adjustingItem.name} (${stockChangeVal > 0 ? '+' : ''}${stockChangeVal})`);
  };

  // Open Stock History
  const handleOpenStockHistory = async () => {
    const logs = await getStockLogs();
    setStockLogs(logs);
    setIsHistoryOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DCE8DC]">
        <div>
          <h2 className="text-xl font-bold text-[#14391A] flex items-center gap-2">
            <Package className="w-6 h-6 text-[#228B22]" />
            Stationery &amp; Print Inventory
          </h2>
          <p className="text-xs text-slate-500">
            {items.length} total products · Real-time stock counts and movement auditing
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenStockHistory}
            className="px-3 py-2 border border-[#DCE8DC] hover:bg-[#F6FAF6] text-[#14391A] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <History className="w-4 h-4 text-[#228B22]" />
            Stock Audit Log
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add New Product
            </button>
          )}
        </div>
      </div>

      {/* Low Stock Warning Banner */}
      {lowStockItems.length > 0 && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 text-amber-900 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{lowStockItems.length} products</strong> have reached or fallen below their restock threshold.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
            className="font-bold underline text-amber-800 hover:text-amber-950 shrink-0"
          >
            {filterLowStockOnly ? 'Show All Products' : 'Filter Low Stock'}
          </button>
        </div>
      )}

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, SKU, barcode, supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-[#DCE8DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#228B22]/20 bg-white"
          />
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-[#228B22] text-white'
                  : 'bg-white border border-[#DCE8DC] text-slate-600 hover:bg-[#F6FAF6]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl border border-[#DCE8DC] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6FAF6] border-b border-[#DCE8DC] text-[#14391A] font-bold">
              <tr>
                <th className="py-3 px-4">PRODUCT NAME</th>
                <th className="py-3 px-4">SKU / BARCODE</th>
                <th className="py-3 px-4">CATEGORY</th>
                <th className="py-3 px-4 text-right">COST</th>
                <th className="py-3 px-4 text-right">PRICE</th>
                <th className="py-3 px-4 text-center">STOCK STATUS</th>
                <th className="py-3 px-4">SUPPLIER</th>
                <th className="py-3 px-4 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE8DC]">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No inventory products found matching the criteria.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isLow = item.stock <= item.lowStockThreshold;
                  const isOut = item.stock <= 0;

                  return (
                    <tr key={item.id} className="hover:bg-[#F6FAF6] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[#14391A]">
                        {item.name}
                        {item.unit && <span className="text-[10px] text-slate-400 block font-normal">{item.unit}</span>}
                      </td>
                      <td className="py-3.5 px-4 font-mono-numbers">
                        <span className="text-slate-700 block font-medium">{item.sku}</span>
                        <span className="text-[10px] text-slate-400 block">{item.barcode}</span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {item.category}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-numbers text-slate-600">
                        {formatCurrency(item.costPrice, shopSettings.currencySymbol)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono-numbers font-bold text-[#14391A]">
                        {formatCurrency(item.sellingPrice, shopSettings.currencySymbol)}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono-numbers">
                        <div className="inline-flex items-center gap-1.5">
                          <span className={`font-bold ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-[#14391A]'}`}>
                            {item.stock}
                          </span>
                          {isOut ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                              Out of Stock
                            </span>
                          ) : isLow ? (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              Low (Limit: {item.lowStockThreshold})
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-[11px] truncate max-w-[140px]">
                        {item.supplier || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustingItem(item);
                              setStockChangeVal(10);
                            }}
                            className="p-1.5 text-slate-500 hover:text-[#228B22] hover:bg-[#228B22]/10 rounded-lg transition-colors"
                            title="Adjust Stock Quantity"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(item)}
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Edit Product"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmItem(item)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete Product"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Item Modal */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-[#DCE8DC] flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-[#DCE8DC] flex items-center justify-between bg-[#F6FAF6]">
              <h3 className="font-bold text-base text-[#14391A]">
                {editingItem ? 'Edit Inventory Item' : 'Register New Inventory Item'}
              </h3>
              <button
                onClick={() => setIsAddEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-black/5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItemSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-[#14391A] mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Oxford A4 Spiral Notebook 200p"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl focus:ring-1 focus:ring-[#228B22]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#14391A] mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl font-mono-numbers"
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-[#14391A]">Barcode *</label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, barcode: generateRandomEan13() })}
                      className="text-[10px] text-[#228B22] hover:underline"
                    >
                      Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl font-mono-numbers"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#14391A] mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as ItemCategory })}
                    className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl"
                  >
                    {categories.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#14391A] mb-1">Unit of Measure</label>
                  <input
                    type="text"
                    placeholder="e.g. pcs, pack, ream, box"
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#14391A] mb-1">
                    Cost Price ({shopSettings.currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl font-mono-numbers"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#14391A] mb-1">
                    Selling Price ({shopSettings.currencySymbol}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl font-mono-numbers"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#14391A] mb-1">Initial Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl font-mono-numbers"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#14391A] mb-1">Low-Stock Alert Limit</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.lowStockThreshold}
                    onChange={(e) => setFormData({ ...formData, lowStockThreshold: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl font-mono-numbers"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14391A] mb-1">Supplier / Vendor</label>
                <input
                  type="text"
                  placeholder="e.g. Apex Office Supplies Ltd"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl"
                />
              </div>

              {/* Conditional Per-Item Tax Toggle: Only visible when Charge Tax is enabled in Settings */}
              {shopSettings.enableTax && (
                <div className="flex items-center gap-2 p-3 rounded-xl border border-[#DCE8DC] bg-[#F6FAF6] animate-in fade-in duration-150">
                  <input
                    type="checkbox"
                    id="vatApplicableToggle"
                    checked={formData.vatApplicable ?? true}
                    onChange={(e) => setFormData({ ...formData, vatApplicable: e.target.checked })}
                    className="rounded text-[#228B22] focus:ring-[#228B22]"
                  />
                  <label htmlFor="vatApplicableToggle" className="text-xs text-[#14391A] font-medium cursor-pointer">
                    Charge {shopSettings.taxRate}% {shopSettings.taxName} on this item
                  </label>
                </div>
              )}

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="flex-1 py-2.5 border border-[#DCE8DC] hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-[#DCE8DC] p-5 space-y-4">
            <div>
              <h3 className="font-bold text-sm text-[#14391A]">Adjust Stock Level</h3>
              <p className="text-xs text-slate-500">{adjustingItem.name}</p>
              <p className="text-xs font-semibold font-mono-numbers text-[#228B22] mt-0.5">
                Current Stock: {adjustingItem.stock} {adjustingItem.unit}
              </p>
            </div>

            <form onSubmit={handleStockAdjustmentSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Stock Change (+ to add, - to deduct)
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={stockChangeVal}
                  onChange={(e) => setStockChangeVal(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-lg font-bold font-mono-numbers border border-[#DCE8DC] rounded-xl text-center"
                />
                <p className="text-[11px] text-slate-500 mt-1 text-center">
                  New projected stock: {Math.max(0, adjustingItem.stock + stockChangeVal)} {adjustingItem.unit}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Adjustment Reason</label>
                <select
                  value={stockReason}
                  onChange={(e) => setStockReason(e.target.value as StockAdjustmentReason)}
                  className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl"
                >
                  <option value="Restock / Delivery">Restock / Delivery Received</option>
                  <option value="Damaged / Spoiled">Damaged / Spoiled</option>
                  <option value="Inventory Count Correction">Inventory Count Correction</option>
                  <option value="Internal Shop Use">Internal Shop Use</option>
                  <option value="Customer Return">Customer Return</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Invoice #</label>
                <input
                  type="text"
                  placeholder="e.g. Delivery Waybill #7781"
                  value={stockNotes}
                  onChange={(e) => setStockNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustingItem(null)}
                  className="flex-1 py-2 border border-[#DCE8DC] text-xs font-semibold rounded-xl text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-bold rounded-xl"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Movement Audit Log Modal */}
      {isHistoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-[#DCE8DC] flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-[#DCE8DC] flex items-center justify-between bg-[#F6FAF6]">
              <div className="flex items-center gap-2 text-[#228B22]">
                <History className="w-5 h-5" />
                <h3 className="font-bold text-sm text-[#14391A]">Stock Movement Audit History</h3>
              </div>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {stockLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No stock adjustment logs recorded yet.
                </div>
              ) : (
                stockLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-[#F6FAF6] rounded-xl border border-[#DCE8DC] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[#14391A] truncate">{log.itemName}</p>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="font-semibold text-slate-700">{log.reason}</span>
                        <span>·</span>
                        <span>By {log.cashierName}</span>
                        <span>·</span>
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      {log.notes && (
                        <p className="text-[10px] text-slate-400 mt-0.5 italic">{log.notes}</p>
                      )}
                    </div>

                    <div className="text-right shrink-0 font-mono-numbers">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        log.change > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {log.change > 0 ? `+${log.change}` : log.change}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {log.previousStock} &rarr; {log.newStock}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-white border-t border-[#DCE8DC] text-right">
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="px-4 py-2 border border-[#DCE8DC] hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Item Master Passcode Dialog */}
      <MasterPasscodeModal
        isOpen={deleteConfirmItem !== null}
        title="Delete Inventory Product"
        actionDescription={`Enter the master passcode to permanently delete "${deleteConfirmItem?.name}" (${deleteConfirmItem?.sku}) from the store catalog.`}
        confirmButtonText="Delete Product"
        isDangerous={true}
        onConfirm={handleDeleteItem}
        onClose={() => setDeleteConfirmItem(null)}
      />
    </div>
  );
};
