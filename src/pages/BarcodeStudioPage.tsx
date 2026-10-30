/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import { 
  Barcode as BarcodeIcon, 
  Printer, 
  Download, 
  RefreshCw, 
  Sparkles, 
  Sliders, 
  Grid, 
  Copy, 
  Check, 
  FileText
} from 'lucide-react';
import { InventoryItem, ShopSettings } from '../types';
import { 
  calculateEan13Checksum, 
  generateRandomEan13, 
  generateRandomCode128, 
  isValidEan13,
  formatCurrency 
} from '../utils/barcode';
import { useToast } from '../components/common/ToastContext';

interface BarcodeStudioPageProps {
  items: InventoryItem[];
  shopSettings: ShopSettings;
}

export const BarcodeStudioPage: React.FC<BarcodeStudioPageProps> = ({
  items,
  shopSettings
}) => {
  const toast = useToast();
  const [selectedItemId, setSelectedItemId] = useState<string>(items[0]?.id || 'custom');
  const [barcodeValue, setBarcodeValue] = useState<string>(items[0]?.barcode || '8901234567890');
  const [barcodeFormat, setBarcodeFormat] = useState<'CODE128' | 'EAN13'>('CODE128');
  const [labelTitle, setLabelTitle] = useState<string>(items[0]?.name || 'A4 Copy Paper 80gsm');
  const [labelPrice, setLabelPrice] = useState<number>(items[0]?.sellingPrice || 5.50);
  const [labelSku, setLabelSku] = useState<string>(items[0]?.sku || 'PAP-A4-80');

  // Customization options
  const [showShopName, setShowShopName] = useState(true);
  const [showItemName, setShowItemName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showBarcodeText, setShowBarcodeText] = useState(true);
  const [labelSize, setLabelSize] = useState<'small' | 'medium' | 'large'>('medium');

  // Multi-label sheet printing
  const [sheetColumns, setSheetColumns] = useState<number>(3);
  const [sheetQuantity, setSheetQuantity] = useState<number>(12);

  const previewSvgRef = useRef<SVGSVGElement | null>(null);

  // Sync when selecting item from dropdown
  const handleSelectItem = (id: string) => {
    setSelectedItemId(id);
    if (id === 'custom') {
      const generated = generateRandomCode128('STN');
      setBarcodeValue(generated);
      setLabelTitle('Custom Stationery Item');
      setLabelPrice(2.50);
      setLabelSku('STN-NEW-01');
      return;
    }
    const item = items.find((i) => i.id === id);
    if (item) {
      setBarcodeValue(item.barcode);
      setLabelTitle(item.name);
      setLabelPrice(item.sellingPrice);
      setLabelSku(item.sku);
      if (/^\d{13}$/.test(item.barcode) && isValidEan13(item.barcode)) {
        setBarcodeFormat('EAN13');
      } else {
        setBarcodeFormat('CODE128');
      }
    }
  };

  // Generate unique barcode code
  const handleGenerateCode = () => {
    if (barcodeFormat === 'EAN13') {
      const code = generateRandomEan13();
      setBarcodeValue(code);
      toast.success(`Generated valid EAN-13: ${code}`);
    } else {
      const code = generateRandomCode128('STN');
      setBarcodeValue(code);
      toast.success(`Generated Code 128: ${code}`);
    }
  };

  // Render SVG live barcode preview
  useEffect(() => {
    if (!previewSvgRef.current || !barcodeValue) return;

    try {
      let valToRender = barcodeValue.trim();
      let format = barcodeFormat;

      if (format === 'EAN13') {
        if (!/^\d{12,13}$/.test(valToRender)) {
          // If not 12 or 13 digits, temporarily fallback to CODE128 for preview without throwing
          format = 'CODE128';
        } else if (valToRender.length === 12) {
          valToRender += calculateEan13Checksum(valToRender);
        }
      }

      JsBarcode(previewSvgRef.current, valToRender, {
        format,
        width: labelSize === 'small' ? 1.2 : labelSize === 'medium' ? 1.6 : 2.0,
        height: labelSize === 'small' ? 32 : labelSize === 'medium' ? 42 : 55,
        displayValue: showBarcodeText,
        fontSize: labelSize === 'small' ? 10 : 12,
        font: 'JetBrains Mono',
        margin: 2
      });
    } catch (err) {
      console.warn("JsBarcode render issue:", err);
    }
  }, [barcodeValue, barcodeFormat, labelSize, showBarcodeText]);

  // Download Single PNG
  const handleDownloadPng = () => {
    const svg = previewSvgRef.current;
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const svgSize = svg.getBoundingClientRect();
    canvas.width = svgSize.width * 2 || 300;
    canvas.height = svgSize.height * 2 || 120;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const pngUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = pngUrl;
      downloadLink.download = `barcode_${barcodeValue}.png`;
      downloadLink.click();
      toast.success("Barcode PNG downloaded");
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  // Download Multi-Label PDF using jsPDF
  const handleDownloadPdf = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const cols = sheetColumns;
      const rows = Math.ceil(sheetQuantity / cols);
      const labelW = (210 - 20) / cols;
      const labelH = 30;

      doc.setFont('Helvetica', 'normal');

      let rendered = 0;
      for (let r = 0; r < rows && rendered < sheetQuantity; r++) {
        for (let c = 0; c < cols && rendered < sheetQuantity; c++) {
          const x = 10 + c * labelW;
          const y = 15 + r * (labelH + 4);

          // Draw border outline
          doc.setDrawColor(220, 220, 220);
          doc.rect(x, y, labelW - 2, labelH);

          // Text info
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          if (showShopName) {
            doc.text(shopSettings.shopName.substring(0, 28), x + 3, y + 5);
          }

          doc.setFontSize(9);
          doc.setTextColor(20, 20, 20);
          if (showItemName) {
            doc.text(labelTitle.substring(0, 24), x + 3, y + 10);
          }

          doc.setFontSize(10);
          doc.setFont('Helvetica', 'bold');
          if (showPrice) {
            doc.text(formatCurrency(labelPrice, shopSettings.currencySymbol), x + 3, y + 15);
          }

          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.text(`* ${barcodeValue} *`, x + 3, y + 22);
          doc.text(labelSku, x + 3, y + 26);

          rendered++;
        }
      }

      doc.save(`labels_${barcodeValue}_x${sheetQuantity}.pdf`);
      toast.success(`Generated PDF with ${sheetQuantity} labels!`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Could not generate PDF");
    }
  };

  // Print Label Sheet directly via browser print
  const handlePrintSheet = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DCE8DC]">
        <div>
          <h2 className="text-xl font-bold text-[#14391A] flex items-center gap-2">
            <BarcodeIcon className="w-6 h-6 text-[#228B22]" />
            Barcode Studio &amp; Label Designer
          </h2>
          <p className="text-xs text-slate-500">
            Design, generate, print sticker sheets, and export custom barcodes in EAN-13 &amp; Code128
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPng}
            className="px-3.5 py-2 border border-[#DCE8DC] hover:bg-[#F6FAF6] text-[#14391A] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-4 h-4 text-[#228B22]" />
            Download PNG
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="px-3.5 py-2 border border-[#DCE8DC] hover:bg-[#F6FAF6] text-[#14391A] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-4 h-4 text-[#228B22]" />
            Export PDF
          </button>
          <button
            type="button"
            onClick={handlePrintSheet}
            className="px-4 py-2 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" />
            Print Label Sheet
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Barcode Parameters & Label Customizer (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-[#DCE8DC] space-y-4">
            <h3 className="font-bold text-sm text-[#14391A] flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#228B22]" />
              Barcode &amp; Product Details
            </h3>

            {/* Select product source */}
            <div>
              <label className="block text-xs font-semibold text-[#14391A] mb-1">
                Select Existing Inventory Item or Custom
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => handleSelectItem(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#228B22]/20 bg-[#F6FAF6]"
              >
                <option value="custom">-- Custom Item / Code Generator --</option>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.barcode})
                  </option>
                ))}
              </select>
            </div>

            {/* Barcode Format Selection */}
            <div>
              <label className="block text-xs font-semibold text-[#14391A] mb-1">
                Barcode Symbology
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBarcodeFormat('CODE128')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    barcodeFormat === 'CODE128'
                      ? 'border-[#228B22] bg-[#228B22]/10 text-[#14391A] ring-1 ring-[#228B22]'
                      : 'border-[#DCE8DC] text-slate-600'
                  }`}
                >
                  Code 128 (Alphanumeric)
                </button>
                <button
                  type="button"
                  onClick={() => setBarcodeFormat('EAN13')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    barcodeFormat === 'EAN13'
                      ? 'border-[#228B22] bg-[#228B22]/10 text-[#14391A] ring-1 ring-[#228B22]'
                      : 'border-[#DCE8DC] text-slate-600'
                  }`}
                >
                  EAN-13 (Standard Retail)
                </button>
              </div>
            </div>

            {/* Barcode string & auto-generator */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-[#14391A]">Barcode Data</label>
                <button
                  type="button"
                  onClick={handleGenerateCode}
                  className="text-[11px] text-[#228B22] hover:underline flex items-center gap-1 font-semibold"
                >
                  <Sparkles className="w-3 h-3" />
                  Auto-Generate Unique Code
                </button>
              </div>
              <input
                type="text"
                value={barcodeValue}
                onChange={(e) => setBarcodeValue(e.target.value)}
                className="w-full px-3 py-2 text-sm font-bold font-mono-numbers border border-[#DCE8DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#228B22]/20"
              />
              {barcodeFormat === 'EAN13' && !isValidEan13(barcodeValue) && (
                <p className="text-[10px] text-amber-600 mt-1">
                  Note: EAN-13 requires exactly 13 numeric digits with valid checksum. Click "Auto-Generate" to create one.
                </p>
              )}
            </div>

            {/* Label Content Fields */}
            <div className="space-y-2.5 pt-2 border-t border-[#DCE8DC]">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Product Title</label>
                <input
                  type="text"
                  value={labelTitle}
                  onChange={(e) => setLabelTitle(e.target.value)}
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
                    value={labelPrice}
                    onChange={(e) => setLabelPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-1.5 text-xs border border-[#DCE8DC] rounded-xl font-mono-numbers"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">SKU</label>
                  <input
                    type="text"
                    value={labelSku}
                    onChange={(e) => setLabelSku(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-[#DCE8DC] rounded-xl font-mono-numbers"
                  />
                </div>
              </div>
            </div>

            {/* Elements Toggle Toggles */}
            <div className="pt-2 border-t border-[#DCE8DC] space-y-2">
              <span className="block text-xs font-semibold text-[#14391A]">Label Elements &amp; Size</span>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showShopName}
                    onChange={(e) => setShowShopName(e.target.checked)}
                    className="rounded text-[#228B22] focus:ring-[#228B22]"
                  />
                  <span>Shop Name</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showItemName}
                    onChange={(e) => setShowItemName(e.target.checked)}
                    className="rounded text-[#228B22] focus:ring-[#228B22]"
                  />
                  <span>Product Title</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="rounded text-[#228B22] focus:ring-[#228B22]"
                  />
                  <span>Price Tag</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBarcodeText}
                    onChange={(e) => setShowBarcodeText(e.target.checked)}
                    className="rounded text-[#228B22] focus:ring-[#228B22]"
                  />
                  <span>Barcode Text</span>
                </label>
              </div>

              {/* Label Size */}
              <div className="pt-2">
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">Sticker Physical Size</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['small', 'medium', 'large'] as const).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setLabelSize(sz)}
                      className={`py-1.5 text-xs font-semibold rounded-lg capitalize border ${
                        labelSize === sz
                          ? 'bg-[#228B22] text-white border-[#228B22]'
                          : 'border-[#DCE8DC] text-slate-600'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Label Preview & Multi-Sticker Sheet (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Single Sticker Card Live Preview */}
          <div className="bg-white p-6 rounded-2xl border border-[#DCE8DC] shadow-sm flex flex-col items-center justify-center">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
              Single Sticker Live Preview
            </span>

            {/* Sticker Preview Box */}
            <div className="p-4 bg-white rounded-xl border-2 border-dashed border-[#DCE8DC] shadow-sm flex flex-col items-center text-center max-w-[280px] w-full">
              {showShopName && (
                <p className="text-[10px] text-slate-500 font-medium truncate max-w-[240px]">
                  {shopSettings.shopName}
                </p>
              )}
              {showItemName && (
                <h4 className="font-bold text-xs text-[#14391A] truncate max-w-[240px] mt-0.5">
                  {labelTitle}
                </h4>
              )}
              {showPrice && (
                <p className="text-sm font-bold text-[#228B22] font-mono-numbers mt-0.5">
                  {formatCurrency(labelPrice, shopSettings.currencySymbol)}
                </p>
              )}

              {/* SVG Live Barcode */}
              <div className="my-1.5 flex justify-center">
                <svg ref={previewSvgRef} />
              </div>

              <div className="flex items-center justify-between w-full text-[9px] text-slate-400 font-mono-numbers px-2">
                <span>SKU: {labelSku}</span>
                <span>{barcodeFormat}</span>
              </div>
            </div>
          </div>

          {/* Sheet Grid Configuration & Live Sheet Preview */}
          <div className="bg-white p-5 rounded-2xl border border-[#DCE8DC] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Grid className="w-4 h-4 text-[#228B22]" />
                <h3 className="font-bold text-sm text-[#14391A]">Printable Sheet Configuration</h3>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span>Columns:</span>
                  <select
                    value={sheetColumns}
                    onChange={(e) => setSheetColumns(parseInt(e.target.value) || 3)}
                    className="px-2 py-1 border border-[#DCE8DC] rounded-lg text-xs"
                  >
                    <option value={2}>2 Cols</option>
                    <option value={3}>3 Cols</option>
                    <option value={4}>4 Cols</option>
                    <option value={5}>5 Cols</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span>Qty:</span>
                  <select
                    value={sheetQuantity}
                    onChange={(e) => setSheetQuantity(parseInt(e.target.value) || 12)}
                    className="px-2 py-1 border border-[#DCE8DC] rounded-lg text-xs font-mono-numbers"
                  >
                    <option value={6}>6 labels</option>
                    <option value={12}>12 labels</option>
                    <option value={24}>24 labels</option>
                    <option value={36}>36 labels</option>
                    <option value={48}>48 labels</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Printable Sheet Viewport Area */}
            <div
              id="barcode-sheet-print-area"
              className={`grid gap-2.5 p-4 bg-[#F6FAF6] rounded-xl border border-[#DCE8DC] max-h-[380px] overflow-y-auto`}
              style={{
                gridTemplateColumns: `repeat(${sheetColumns}, minmax(0, 1fr))`
              }}
            >
              {Array.from({ length: sheetQuantity }).map((_, index) => (
                <div
                  key={index}
                  className="bg-white p-2.5 rounded-lg border border-[#DCE8DC] flex flex-col items-center text-center shadow-xs text-[10px]"
                >
                  {showShopName && (
                    <span className="text-[9px] text-slate-400 truncate max-w-full">
                      {shopSettings.shopName}
                    </span>
                  )}
                  {showItemName && (
                    <span className="font-bold text-[11px] text-[#14391A] truncate max-w-full">
                      {labelTitle}
                    </span>
                  )}
                  {showPrice && (
                    <span className="font-bold text-[#228B22] font-mono-numbers">
                      {formatCurrency(labelPrice, shopSettings.currencySymbol)}
                    </span>
                  )}

                  {/* Micro barcode representation for sheet */}
                  <div className="my-1 py-1 px-2 border-y border-neutral-300 font-mono-numbers text-[9px] font-bold tracking-widest text-neutral-800">
                    ||| | |||| | |||
                  </div>

                  <span className="font-mono-numbers text-[9px] text-neutral-500">
                    {barcodeValue}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
