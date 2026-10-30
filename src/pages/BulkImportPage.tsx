/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  RefreshCw, 
  ArrowRight, 
  Layers,
  FileText
} from 'lucide-react';
import { InventoryItem, ItemCategory, ShopSettings, UserProfile } from '../types';
import { formatCurrency, generateRandomCode128, isValidEan13 } from '../utils/barcode';
import { saveItem } from '../services/dataService';
import { useToast } from '../components/common/ToastContext';
import { MasterPasscodeModal } from '../components/common/MasterPasscodeModal';

// Set up pdf.js worker
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '3.11.174'}/pdf.worker.min.js`;
} catch {
  // worker fallback
}

interface BulkImportPageProps {
  existingItems: InventoryItem[];
  shopSettings: ShopSettings;
  currentUser: UserProfile;
  onRefreshData: () => Promise<void>;
}

interface ParsedRow {
  name: string;
  sku: string;
  barcode: string;
  category: ItemCategory;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  lowStockThreshold: number;
  supplier: string;
  status: 'valid_new' | 'valid_update' | 'error';
  errorReason?: string;
}

export const BulkImportPage: React.FC<BulkImportPageProps> = ({
  existingItems,
  shopSettings,
  currentUser,
  onRefreshData
}) => {
  const toast = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState<string>('');
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);

  // Column mapping
  const [mapping, setMapping] = useState<{
    name: string;
    sku: string;
    barcode: string;
    category: string;
    costPrice: string;
    sellingPrice: string;
    stock: string;
    lowStockThreshold: string;
    supplier: string;
  }>({
    name: '',
    sku: '',
    barcode: '',
    category: '',
    costPrice: '',
    sellingPrice: '',
    stock: '',
    lowStockThreshold: '',
    supplier: ''
  });

  const [previewRows, setPreviewRows] = useState<ParsedRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);

  // -------------------------------------------------------------
  // STEP 1: DOWNLOAD TEMPLATE
  // -------------------------------------------------------------
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Product Name': 'Faber-Castell 2B Graphite Pencils (Box of 12)',
        'SKU': 'PEN-FC-2B',
        'Barcode': '8901234567900',
        'Category': 'Writing & Pens',
        'Cost Price': 180.00,
        'Selling Price': 350.00,
        'Current Stock': 50,
        'Low Stock Limit': 15,
        'Supplier': 'Faber Direct'
      },
      {
        'Product Name': 'Watercolor Paper Pad 300gsm A3 (12 Sheets)',
        'SKU': 'ART-WC-A3',
        'Barcode': '8901234567901',
        'Category': 'Art & Craft',
        'Cost Price': 450.00,
        'Selling Price': 850.00,
        'Current Stock': 20,
        'Low Stock Limit': 8,
        'Supplier': 'Creative Arts Corp'
      },
      {
        'Product Name': 'A4 Copy Paper 80gsm (500 Sheets Ream)',
        'SKU': 'PAP-A4-80',
        'Barcode': '8901234567890',
        'Category': 'Paper & Notebooks',
        'Cost Price': 550.00,
        'Selling Price': 800.00,
        'Current Stock': 100,
        'Low Stock Limit': 20,
        'Supplier': 'Addis Paper Distributors'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stationery_Template');
    XLSX.writeFile(wb, 'stationery_inventory_import_template.xlsx');
    toast.success("Excel template downloaded");
  };

  // -------------------------------------------------------------
  // STEP 1: FILE UPLOAD (EXCEL, CSV, OR PDF)
  // -------------------------------------------------------------
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = evt.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });

          if (!json.length) {
            toast.error("File contains no records");
            return;
          }

          const headers = Object.keys(json[0]);
          setRawHeaders(headers);
          setRawRows(json);

          // Auto-detect matching headers
          autoDetectMapping(headers);
          setStep(2);
          toast.success(`Loaded ${json.length} rows from ${file.name}`);
        } catch (err) {
          console.error("File parse error:", err);
          toast.error("Error parsing spreadsheet file");
        }
      };
      reader.readAsBinaryString(file);
    } else if (ext === 'pdf') {
      // PDF text extraction using pdfjs-dist
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = content.items.map((item: any) => item.str);
          fullText += strings.join(' ') + '\n';
        }

        // Try extracting structured lines: Name, Price, Stock
        const lines = fullText.split('\n').filter(l => l.trim().length > 3);
        const rows: Record<string, unknown>[] = [];
        lines.forEach((line, idx) => {
          const parts = line.split(/[,\t|]/);
          if (parts.length >= 2) {
            rows.push({
              'Product Name': parts[0]?.trim() || `Item ${idx + 1}`,
              'Price': parseFloat(parts[1]?.replace(/[^0-9.]/g, '') || '0') || 1.0,
              'Stock': parseInt(parts[2]?.replace(/[^0-9]/g, '') || '10') || 10
            });
          }
        });

        if (rows.length === 0) {
          // If unstructured, create sample rows from lines
          lines.slice(0, 15).forEach((line, idx) => {
            rows.push({
              'Product Name': line.substring(0, 50).trim(),
              'Price': 2.50,
              'Stock': 20
            });
          });
        }

        setRawHeaders(['Product Name', 'Price', 'Stock']);
        setRawRows(rows);
        autoDetectMapping(['Product Name', 'Price', 'Stock']);
        setStep(2);
        toast.success(`Extracted ${rows.length} rows from PDF`);
      } catch (err) {
        console.error("PDF parse error:", err);
        toast.error("Could not parse PDF text");
      }
    } else {
      toast.error("Please upload an Excel (.xlsx, .xls), CSV (.csv), or PDF (.pdf) file");
    }
  };

  // Auto-detect header mapping
  const autoDetectMapping = (headers: string[]) => {
    const findHeader = (patterns: string[]) => {
      return headers.find(h => patterns.some(p => h.toLowerCase().includes(p.toLowerCase()))) || '';
    };

    setMapping({
      name: findHeader(['name', 'title', 'product', 'item']),
      sku: findHeader(['sku', 'code', 'part']),
      barcode: findHeader(['barcode', 'upc', 'ean']),
      category: findHeader(['category', 'group', 'type']),
      costPrice: findHeader(['cost', 'buy', 'purchase']),
      sellingPrice: findHeader(['price', 'sell', 'retail', 'amount']),
      stock: findHeader(['stock', 'qty', 'quantity', 'inventory']),
      lowStockThreshold: findHeader(['threshold', 'min', 'low', 'reorder']),
      supplier: findHeader(['supplier', 'vendor', 'distributor'])
    });
  };

  // -------------------------------------------------------------
  // STEP 2: APPLY MAPPING & GENERATE VALIDATION PREVIEW
  // -------------------------------------------------------------
  const handleGeneratePreview = () => {
    if (!mapping.name || !mapping.sellingPrice) {
      toast.error("Please map at least 'Product Name' and 'Selling Price'");
      return;
    }

    const seenBarcodesInBatch = new Set<string>();
    const parsed: ParsedRow[] = rawRows.map((raw, idx) => {
      const name = String(raw[mapping.name] || '').trim();
      const sku = mapping.sku ? String(raw[mapping.sku] || '').trim() : `STN-IMP-${idx + 1}`;
      let barcode = mapping.barcode ? String(raw[mapping.barcode] || '').trim() : '';
      if (!barcode) {
        barcode = generateRandomCode128('STN');
      }

      const category = (mapping.category ? String(raw[mapping.category] || '') : 'Office Supplies') as ItemCategory;
      const costPrice = mapping.costPrice ? parseFloat(String(raw[mapping.costPrice]).replace(/[^0-9.]/g, '')) || 0 : 0;
      const sellingPrice = parseFloat(String(raw[mapping.sellingPrice]).replace(/[^0-9.]/g, '')) || 0;
      const stock = mapping.stock ? parseInt(String(raw[mapping.stock]).replace(/[^0-9]/g, '')) || 0 : 10;
      const lowStockThreshold = mapping.lowStockThreshold ? parseInt(String(raw[mapping.lowStockThreshold]).replace(/[^0-9]/g, '')) || 5 : 5;
      const supplier = mapping.supplier ? String(raw[mapping.supplier] || '').trim() : '';

      // Validation
      let status: 'valid_new' | 'valid_update' | 'error' = 'valid_new';
      let errorReason = '';

      if (!name) {
        status = 'error';
        errorReason = 'Missing product name';
      } else if (sellingPrice <= 0) {
        status = 'error';
        errorReason = 'Invalid selling price (must be > 0)';
      } else if (seenBarcodesInBatch.has(barcode)) {
        status = 'error';
        errorReason = 'Duplicate barcode within this import file';
      }

      if (status !== 'error') {
        seenBarcodesInBatch.add(barcode);
        // Check if barcode or SKU matches existing inventory item
        const existingMatch = existingItems.find(
          ex => ex.barcode === barcode || (sku && ex.sku.toLowerCase() === sku.toLowerCase())
        );
        if (existingMatch) {
          status = 'valid_update';
        }
      }

      return {
        name,
        sku,
        barcode,
        category,
        costPrice,
        sellingPrice,
        stock,
        lowStockThreshold,
        supplier,
        status,
        errorReason
      };
    });

    setPreviewRows(parsed);
    setStep(3);
  };

  // -------------------------------------------------------------
  // STEP 3: CONFIRM & EXECUTE BATCH IMPORT (PASSCODE-PROTECTED)
  // -------------------------------------------------------------
  const handleInitiateImport = () => {
    const validRows = previewRows.filter(r => r.status !== 'error');
    if (!validRows.length) {
      toast.error("No valid rows to import. Please resolve errors.");
      return;
    }
    setIsPasscodeModalOpen(true);
  };

  const executeImportBatch = async () => {
    const validRows = previewRows.filter(r => r.status !== 'error');
    if (!validRows.length) return;

    try {
      setIsImporting(true);
      let newCount = 0;
      let updateCount = 0;
      const now = new Date().toISOString();

      for (const row of validRows) {
        // Find existing match by barcode or SKU
        const existing = existingItems.find(
          ex => ex.barcode === row.barcode || (row.sku && ex.sku.toLowerCase() === row.sku.toLowerCase())
        );

        if (existing) {
          // Update existing item
          const updated: InventoryItem = {
            ...existing,
            name: row.name,
            costPrice: row.costPrice || existing.costPrice,
            sellingPrice: row.sellingPrice,
            stock: row.stock,
            lowStockThreshold: row.lowStockThreshold,
            supplier: row.supplier || existing.supplier,
            updatedAt: now
          };
          await saveItem(updated);
          updateCount++;
        } else {
          // Create new item
          const newItem: InventoryItem = {
            id: `item_imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: row.name,
            sku: row.sku,
            barcode: row.barcode,
            category: row.category || 'Office Supplies',
            costPrice: row.costPrice,
            sellingPrice: row.sellingPrice,
            stock: row.stock,
            lowStockThreshold: row.lowStockThreshold,
            vatApplicable: false,
            supplier: row.supplier,
            unit: 'pcs',
            createdAt: now,
            updatedAt: now
          };
          await saveItem(newItem);
          newCount++;
        }
      }

      await onRefreshData();
      setIsImporting(false);
      setStep(1);
      setFileName('');
      setRawRows([]);
      setPreviewRows([]);
      toast.success(`Import complete! ${newCount} added, ${updateCount} updated.`);
    } catch (err: unknown) {
      setIsImporting(false);
      toast.error("Import error: " + (err instanceof Error ? err.message : String(err)));
    }
  };

  const validNewCount = previewRows.filter(r => r.status === 'valid_new').length;
  const validUpdateCount = previewRows.filter(r => r.status === 'valid_update').length;
  const errorCount = previewRows.filter(r => r.status === 'error').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DCE8DC]">
        <div>
          <h2 className="text-xl font-bold text-[#14391A] flex items-center gap-2">
            <UploadCloud className="w-6 h-6 text-[#228B22]" />
            Bulk Inventory Import
          </h2>
          <p className="text-xs text-slate-500">
            Upload Excel (.xlsx, .xls), CSV, or PDF product price lists with smart field mapping
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="px-3.5 py-2 border border-[#DCE8DC] hover:bg-[#F6FAF6] text-[#14391A] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-[#228B22]" />
          Download Excel Template
        </button>
      </div>

      {/* Stepper Progress */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
          step === 1 ? 'border-[#228B22] bg-[#228B22]/10 text-[#14391A]' : 'border-[#DCE8DC] bg-white text-slate-400'
        }`}>
          <span className="w-6 h-6 rounded-full bg-[#228B22] text-white flex items-center justify-center text-[11px]">1</span>
          <span>Upload File</span>
        </div>
        <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
          step === 2 ? 'border-[#228B22] bg-[#228B22]/10 text-[#14391A]' : 'border-[#DCE8DC] bg-white text-slate-400'
        }`}>
          <span className="w-6 h-6 rounded-full bg-[#228B22] text-white flex items-center justify-center text-[11px]">2</span>
          <span>Map Columns</span>
        </div>
        <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
          step === 3 ? 'border-[#228B22] bg-[#228B22]/10 text-[#14391A]' : 'border-[#DCE8DC] bg-white text-slate-400'
        }`}>
          <span className="w-6 h-6 rounded-full bg-[#228B22] text-white flex items-center justify-center text-[11px]">3</span>
          <span>Validate &amp; Confirm</span>
        </div>
      </div>

      {/* STEP 1: Upload Zone */}
      {step === 1 && (
        <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-[#DCE8DC] hover:border-[#228B22] transition-colors text-center">
          <FileSpreadsheet className="w-12 h-12 text-[#228B22] mx-auto mb-3" />
          <h3 className="font-bold text-base text-[#14391A]">Select Your Inventory File</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Choose an Excel (.xlsx, .xls), CSV, or PDF file from your supplier or accounting software.
          </p>

          <div className="mt-5 flex justify-center">
            <label className="px-5 py-3 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-2 shadow-sm transition-all">
              <UploadCloud className="w-4 h-4" />
              Browse &amp; Upload File
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="mt-6 pt-6 border-t border-[#DCE8DC] grid grid-cols-1 sm:grid-cols-3 gap-3 text-left max-w-xl mx-auto text-xs text-slate-600">
            <div>
              <span className="font-bold block text-[#14391A]">Excel &amp; CSV</span>
              <span>All columns auto-detected</span>
            </div>
            <div>
              <span className="font-bold block text-[#14391A]">PDF Invoices</span>
              <span>Text extraction for catalogs</span>
            </div>
            <div>
              <span className="font-bold block text-[#14391A]">Duplicate Shield</span>
              <span>Updates existing on match</span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Map Columns */}
      {step === 2 && (
        <div className="bg-white p-6 rounded-2xl border border-[#DCE8DC] space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#DCE8DC]">
            <div>
              <h3 className="font-bold text-sm text-[#14391A]">Map Columns for {fileName}</h3>
              <p className="text-xs text-slate-500">Pair your file's header names with inventory fields</p>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-slate-500 hover:underline"
            >
              Choose different file
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#14391A] mb-1">
                Product Name * (Required)
              </label>
              <select
                value={mapping.name}
                onChange={(e) => setMapping({ ...mapping, name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl bg-[#F6FAF6]"
              >
                <option value="">-- Select Column --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#14391A] mb-1">
                Selling Price * (Required)
              </label>
              <select
                value={mapping.sellingPrice}
                onChange={(e) => setMapping({ ...mapping, sellingPrice: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl bg-[#F6FAF6]"
              >
                <option value="">-- Select Column --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#14391A] mb-1">
                Barcode (Auto-generated if unmapped)
              </label>
              <select
                value={mapping.barcode}
                onChange={(e) => setMapping({ ...mapping, barcode: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl bg-[#F6FAF6]"
              >
                <option value="">-- Select Column (or Auto-Generate) --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#14391A] mb-1">
                SKU Code
              </label>
              <select
                value={mapping.sku}
                onChange={(e) => setMapping({ ...mapping, sku: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl bg-[#F6FAF6]"
              >
                <option value="">-- Select Column --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#14391A] mb-1">
                Category
              </label>
              <select
                value={mapping.category}
                onChange={(e) => setMapping({ ...mapping, category: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl bg-[#F6FAF6]"
              >
                <option value="">-- Select Column --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#14391A] mb-1">
                Cost Price
              </label>
              <select
                value={mapping.costPrice}
                onChange={(e) => setMapping({ ...mapping, costPrice: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl bg-[#F6FAF6]"
              >
                <option value="">-- Select Column --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#14391A] mb-1">
                Current Stock Quantity
              </label>
              <select
                value={mapping.stock}
                onChange={(e) => setMapping({ ...mapping, stock: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl bg-[#F6FAF6]"
              >
                <option value="">-- Select Column --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#14391A] mb-1">
                Low-Stock Alert Threshold
              </label>
              <select
                value={mapping.lowStockThreshold}
                onChange={(e) => setMapping({ ...mapping, lowStockThreshold: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl bg-[#F6FAF6]"
              >
                <option value="">-- Select Column --</option>
                {rawHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-between border-t border-[#DCE8DC]">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 border border-[#DCE8DC] text-xs font-semibold rounded-xl text-slate-600"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleGeneratePreview}
              className="px-5 py-2.5 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm"
            >
              Generate Preview &amp; Validate
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Validation Preview & Confirm */}
      {step === 3 && (
        <div className="bg-white p-6 rounded-2xl border border-[#DCE8DC] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#DCE8DC]">
            <div>
              <h3 className="font-bold text-sm text-[#14391A]">Validation Preview</h3>
              <p className="text-xs text-slate-500">
                Review items before committing to Firestore database
              </p>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 font-semibold text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                {validNewCount} New
              </span>
              <span className="flex items-center gap-1 font-semibold text-blue-700">
                <RefreshCw className="w-4 h-4" />
                {validUpdateCount} Updates
              </span>
              {errorCount > 0 && (
                <span className="flex items-center gap-1 font-semibold text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  {errorCount} Errors
                </span>
              )}
            </div>
          </div>

          {/* Table Preview */}
          <div className="overflow-x-auto border border-[#DCE8DC] rounded-xl max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6FAF6] border-b border-[#DCE8DC] text-[#14391A] font-bold sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">STATUS</th>
                  <th className="py-2.5 px-3">NAME</th>
                  <th className="py-2.5 px-3">BARCODE</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">CATEGORY</th>
                  <th className="py-2.5 px-3 text-right">PRICE</th>
                  <th className="py-2.5 px-3 text-center">STOCK</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE8DC]">
                {previewRows.map((r, idx) => (
                  <tr key={idx} className={r.status === 'error' ? 'bg-red-50/50' : 'hover:bg-slate-50'}>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {r.status === 'valid_new' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          New Item
                        </span>
                      )}
                      {r.status === 'valid_update' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                          Update Existing
                        </span>
                      )}
                      {r.status === 'error' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800" title={r.errorReason}>
                          Error: {r.errorReason}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-[#14391A]">{r.name || '—'}</td>
                    <td className="py-2.5 px-3 font-mono-numbers text-slate-600">{r.barcode}</td>
                    <td className="py-2.5 px-3 font-mono-numbers text-slate-600">{r.sku}</td>
                    <td className="py-2.5 px-3 text-slate-500">{r.category}</td>
                    <td className="py-2.5 px-3 text-right font-mono-numbers font-bold text-[#14391A]">
                      {formatCurrency(r.sellingPrice, shopSettings.currencySymbol)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono-numbers">{r.stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-3 flex justify-between items-center border-t border-[#DCE8DC]">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2 border border-[#DCE8DC] text-xs font-semibold rounded-xl text-slate-600"
            >
              Back to Mapping
            </button>

            <button
              type="button"
              disabled={isImporting || (validNewCount === 0 && validUpdateCount === 0)}
              onClick={handleInitiateImport}
              className="px-6 py-2.5 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all"
            >
              {isImporting ? 'Processing Database Import...' : `Confirm Import (${validNewCount + validUpdateCount} Items)`}
            </button>
          </div>
        </div>
      )}

      {/* Master Passcode Authorization Modal */}
      {isPasscodeModalOpen && (
        <MasterPasscodeModal
          isOpen={true}
          title="Authorize Bulk Inventory Import"
          description={`You are about to batch import ${validNewCount + validUpdateCount} items into the live catalog. Enter master passcode to proceed.`}
          onSuccess={async () => {
            setIsPasscodeModalOpen(false);
            await executeImportBatch();
          }}
          onClose={() => setIsPasscodeModalOpen(false)}
        />
      )}
    </div>
  );
};
