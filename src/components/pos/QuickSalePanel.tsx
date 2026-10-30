/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Printer, 
  Copy, 
  Layers, 
  BookOpen, 
  FileText, 
  Palette, 
  Plus, 
  Edit3, 
  Check, 
  X,
  PlusCircle
} from 'lucide-react';
import { QuickSalePreset, ShopSettings, UserRole } from '../../types';
import { formatCurrency } from '../../utils/barcode';

interface QuickSalePanelProps {
  presets: QuickSalePreset[];
  shopSettings: ShopSettings;
  userRole: UserRole;
  onAddQuickService: (preset: QuickSalePreset, quantity: number) => void;
  onUpdatePreset?: (preset: QuickSalePreset) => void;
  onAddPreset?: (preset: QuickSalePreset) => void;
}

export const QuickSalePanel: React.FC<QuickSalePanelProps> = ({
  presets,
  shopSettings,
  userRole,
  onAddQuickService,
  onUpdatePreset,
  onAddPreset
}) => {
  const [selectedPreset, setSelectedPreset] = useState<QuickSalePreset | null>(null);
  const [qty, setQty] = useState<number>(1);
  const [editingPreset, setEditingPreset] = useState<QuickSalePreset | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newPresetForm, setNewPresetForm] = useState<Partial<QuickSalePreset>>({
    name: '',
    category: 'Services & Binding',
    unitPrice: 1.0,
    costPrice: 0.3,
    unit: 'per page',
    sku: 'SRV-CUSTOM',
    barcode: `SRV${Math.floor(1000 + Math.random() * 9000)}`
  });

  const getServiceIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Printer': return <Printer className="w-5 h-5 text-[#228B22]" />;
      case 'FileText': return <FileText className="w-5 h-5 text-[#228B22]" />;
      case 'Palette': return <Palette className="w-5 h-5 text-[#228B22]" />;
      case 'Layers': return <Layers className="w-5 h-5 text-[#228B22]" />;
      case 'BookOpen': return <BookOpen className="w-5 h-5 text-[#228B22]" />;
      case 'Copy':
      default: return <Copy className="w-5 h-5 text-[#228B22]" />;
    }
  };

  const handleOpenQtyPrompt = (preset: QuickSalePreset) => {
    setSelectedPreset(preset);
    setQty(1);
  };

  const handleConfirmAdd = () => {
    if (!selectedPreset) return;
    onAddQuickService(selectedPreset, Math.max(1, qty));
    setSelectedPreset(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingPreset && onUpdatePreset) {
      onUpdatePreset(editingPreset);
      setEditingPreset(null);
    }
  };

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetForm.name || !onAddPreset) return;
    const fullPreset: QuickSalePreset = {
      id: `preset_${Date.now()}`,
      name: newPresetForm.name,
      category: 'Services & Binding',
      unitPrice: Number(newPresetForm.unitPrice) || 1.0,
      costPrice: Number(newPresetForm.costPrice) || 0.2,
      unit: newPresetForm.unit || 'per unit',
      sku: newPresetForm.sku || `SRV-${Date.now().toString().slice(-4)}`,
      barcode: newPresetForm.barcode || `SRV${Math.floor(1000 + Math.random() * 9000)}`,
      vatApplicable: false,
      iconName: 'Printer'
    };
    onAddPreset(fullPreset);
    setIsCreating(false);
    setNewPresetForm({
      name: '',
      unitPrice: 1.0,
      costPrice: 0.3,
      unit: 'per page'
    });
  };

  return (
    <div className="bg-[#F6FAF6] rounded-2xl border border-[#DCE8DC] p-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#DCE8DC] mb-3">
        <div>
          <h3 className="font-bold text-sm text-[#14391A] flex items-center gap-1.5">
            <Copy className="w-4 h-4 text-[#228B22]" />
            Quick Services
          </h3>
          <p className="text-[11px] text-slate-500">Photocopy, printing, binding &amp; lamination</p>
        </div>
        {userRole === 'admin' && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="px-2.5 py-1 text-[11px] font-semibold text-[#228B22] hover:bg-[#228B22]/10 rounded-lg flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Service Preset
          </button>
        )}
      </div>

      {/* Preset Grid */}
      {presets.length === 0 ? (
        <div className="py-6 px-4 text-center bg-white rounded-xl border border-dashed border-[#DCE8DC]">
          <p className="text-xs font-semibold text-slate-600">No quick services configured</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {userRole === 'admin' 
              ? 'Click "+ Add Service Preset" above to create one-touch buttons for photocopy, printing, or binding.'
              : 'Contact store manager to add service presets.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="group relative bg-white p-3 rounded-xl border border-[#DCE8DC] hover:border-[#228B22] hover:shadow-md transition-all flex flex-col justify-between text-left cursor-pointer"
              onClick={() => handleOpenQtyPrompt(preset)}
            >
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-[#F6FAF6] group-hover:bg-[#228B22]/10 transition-colors">
                  {getServiceIcon(preset.iconName)}
                </div>
                {userRole === 'admin' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPreset(preset);
                    }}
                    className="p-1 text-slate-300 hover:text-slate-600 rounded hover:bg-slate-100 transition-colors"
                    title="Edit Preset Price"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="mt-2">
                <h4 className="font-semibold text-xs text-[#14391A] line-clamp-1">{preset.name}</h4>
                <p className="text-[10px] text-slate-400 capitalize">{preset.unit}</p>
                <p className="text-xs font-bold text-[#228B22] font-mono-numbers mt-1">
                  {formatCurrency(preset.unitPrice, shopSettings.currencySymbol)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Prompt Quantity Modal for clicked service */}
      {selectedPreset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-xs overflow-hidden shadow-2xl border border-[#DCE8DC] p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-bold text-sm text-[#14391A]">{selectedPreset.name}</h4>
                <p className="text-xs text-slate-500">
                  {formatCurrency(selectedPreset.unitPrice, shopSettings.currencySymbol)} {selectedPreset.unit}
                </p>
              </div>
              <button
                onClick={() => setSelectedPreset(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#14391A] mb-1">
                  Quantity / Pages
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="w-10 h-10 rounded-xl border border-[#DCE8DC] text-slate-600 font-bold hover:bg-slate-50 text-base"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 h-10 px-3 text-center text-base font-bold font-mono-numbers border border-[#DCE8DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#228B22]/30"
                  />
                  <button
                    type="button"
                    onClick={() => setQty(qty + 1)}
                    className="w-10 h-10 rounded-xl border border-[#DCE8DC] text-slate-600 font-bold hover:bg-slate-50 text-base"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Quick Qty Buttons */}
              <div className="flex gap-1.5 justify-center">
                {[1, 5, 10, 25, 50, 100].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setQty(v)}
                    className={`px-2 py-1 text-xs rounded-lg font-mono-numbers ${
                      qty === v ? 'bg-[#228B22] text-white font-bold' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>

              {/* Total preview */}
              <div className="p-2.5 bg-[#F6FAF6] rounded-xl border border-[#DCE8DC] flex justify-between items-center text-xs">
                <span className="text-slate-600">Total:</span>
                <span className="font-bold text-[#14391A] font-mono-numbers text-sm">
                  {formatCurrency(selectedPreset.unitPrice * qty, shopSettings.currencySymbol)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleConfirmAdd}
                className="w-full py-2.5 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <PlusCircle className="w-4 h-4" />
                Add to Current Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Edit Preset Modal */}
      {editingPreset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-[#DCE8DC] p-5">
            <h4 className="font-bold text-sm text-[#14391A] mb-3">Edit Service Preset</h4>
            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Service Name</label>
                <input
                  type="text"
                  required
                  value={editingPreset.name}
                  onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-[#DCE8DC] rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Selling Price</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editingPreset.unitPrice}
                    onChange={(e) => setEditingPreset({ ...editingPreset, unitPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs border border-[#DCE8DC] rounded-xl font-mono-numbers"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cost Price</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editingPreset.costPrice}
                    onChange={(e) => setEditingPreset({ ...editingPreset, costPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs border border-[#DCE8DC] rounded-xl font-mono-numbers"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Unit Description</label>
                <input
                  type="text"
                  value={editingPreset.unit}
                  onChange={(e) => setEditingPreset({ ...editingPreset, unit: e.target.value })}
                  placeholder="e.g. per page, per doc, per card"
                  className="w-full px-3 py-1.5 text-xs border border-[#DCE8DC] rounded-xl"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPreset(null)}
                  className="flex-1 py-2 border border-[#DCE8DC] text-xs font-semibold rounded-xl text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Create Preset Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-[#DCE8DC] p-5">
            <h4 className="font-bold text-sm text-[#14391A] mb-3">Add Quick Service Preset</h4>
            <form onSubmit={handleCreateNew} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Service Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hardcover Gold Foil Stamp"
                  value={newPresetForm.name}
                  onChange={(e) => setNewPresetForm({ ...newPresetForm, name: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs border border-[#DCE8DC] rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Price ({shopSettings.currencySymbol})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newPresetForm.unitPrice}
                    onChange={(e) => setNewPresetForm({ ...newPresetForm, unitPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs border border-[#DCE8DC] rounded-xl font-mono-numbers"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cost ({shopSettings.currencySymbol})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={newPresetForm.costPrice}
                    onChange={(e) => setNewPresetForm({ ...newPresetForm, costPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs border border-[#DCE8DC] rounded-xl font-mono-numbers"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Unit</label>
                <input
                  type="text"
                  value={newPresetForm.unit}
                  onChange={(e) => setNewPresetForm({ ...newPresetForm, unit: e.target.value })}
                  placeholder="e.g. per book, per page"
                  className="w-full px-3 py-1.5 text-xs border border-[#DCE8DC] rounded-xl"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="flex-1 py-2 border border-[#DCE8DC] text-xs font-semibold rounded-xl text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Preset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
