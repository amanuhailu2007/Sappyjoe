/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  ShoppingCart, 
  Download, 
  Calendar, 
  AlertTriangle, 
  FileText, 
  Package,
  Layers,
  Percent,
  RotateCcw,
  Receipt,
  CheckCircle2
} from 'lucide-react';
import { SaleTransaction, InventoryItem, ShopSettings, UserProfile } from '../types';
import { formatCurrency } from '../utils/barcode';
import { refundSaleTransaction } from '../services/dataService';
import { useToast } from '../components/common/ToastContext';
import { MasterPasscodeModal } from '../components/common/MasterPasscodeModal';

interface ReportsPageProps {
  sales: SaleTransaction[];
  items: InventoryItem[];
  shopSettings: ShopSettings;
  currentUser: UserProfile;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  sales,
  items,
  shopSettings,
  currentUser
}) => {
  const toast = useToast();
  const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'all'>('7days');
  const [saleToRefund, setSaleToRefund] = useState<SaleTransaction | null>(null);
  const [isRefunding, setIsRefunding] = useState(false);

  const handleConfirmRefund = async () => {
    if (!saleToRefund) return;
    try {
      setIsRefunding(true);
      await refundSaleTransaction(saleToRefund.id, currentUser);
      toast.success(`Transaction ${saleToRefund.receiptNumber} refunded & inventory restored.`);
      setSaleToRefund(null);
    } catch (err: unknown) {
      toast.error("Refund failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsRefunding(false);
    }
  };

  // Filter sales based on selected date range
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return sales.filter((sale) => {
      const saleTime = new Date(sale.timestamp).getTime();
      if (dateRange === 'today') {
        return saleTime >= todayStart;
      }
      if (dateRange === '7days') {
        return saleTime >= now.getTime() - 7 * 24 * 60 * 60 * 1000;
      }
      if (dateRange === '30days') {
        return saleTime >= now.getTime() - 30 * 24 * 60 * 60 * 1000;
      }
      return true; // all
    });
  }, [sales, dateRange]);

  // Aggregate metrics
  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
  const totalCost = filteredSales.reduce((sum, s) => sum + s.costTotal, 0);
  const totalProfit = filteredSales.reduce((sum, s) => sum + s.profitTotal, 0);
  const totalTransactionsCount = filteredSales.length;
  const averageTicket = totalTransactionsCount > 0 ? totalRevenue / totalTransactionsCount : 0;
  const profitMarginPercent = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Low stock items count
  const lowStockItems = useMemo(() => {
    return items.filter((i) => i.stock <= i.lowStockThreshold);
  }, [items]);

  // Daily Trend Chart Data
  const dailyChartData = useMemo(() => {
    const map: Record<string, { date: string; revenue: number; profit: number; count: number }> = {};
    
    // Sort chronological
    const sorted = [...filteredSales].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    sorted.forEach((sale) => {
      const dateKey = new Date(sale.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
      if (!map[dateKey]) {
        map[dateKey] = { date: dateKey, revenue: 0, profit: 0, count: 0 };
      }
      map[dateKey].revenue += sale.total;
      map[dateKey].profit += sale.profitTotal;
      map[dateKey].count += 1;
    });

    const list = Object.values(map);
    return list.length ? list : [{ date: 'Today', revenue: 0, profit: 0, count: 0 }];
  }, [filteredSales]);

  // Category Breakdown Data
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const cat = item.category || 'Other';
        map[cat] = (map[cat] || 0) + item.subtotal;
      });
    });

    return Object.entries(map).map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2))
    }));
  }, [filteredSales]);

  // Sales by Cashier Data
  const cashierData = useMemo(() => {
    const map: Record<string, { cashier: string; revenue: number; count: number }> = {};
    filteredSales.forEach((sale) => {
      const name = sale.cashierName || 'Staff';
      if (!map[name]) {
        map[name] = { cashier: name, revenue: 0, count: 0 };
      }
      map[name].revenue += sale.total;
      map[name].count += 1;
    });
    return Object.values(map);
  }, [filteredSales]);

  // Top-selling items table
  const topSellingItems = useMemo(() => {
    const map: Record<string, { name: string; sku: string; units: number; revenue: number; profit: number }> = {};
    filteredSales.forEach((sale) => {
      sale.items.forEach((it) => {
        if (!map[it.itemId]) {
          map[it.itemId] = {
            name: it.name,
            sku: it.sku,
            units: 0,
            revenue: 0,
            profit: 0
          };
        }
        map[it.itemId].units += it.quantity;
        map[it.itemId].revenue += it.subtotal;
        map[it.itemId].profit += (it.finalUnitPrice - it.costPrice) * it.quantity;
      });
    });

    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [filteredSales]);

  const COLORS = ['#228B22', '#14391A', '#34D399', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899'];

  // Export report to Excel
  const handleExportExcel = () => {
    try {
      const summaryRows: Record<string, unknown>[] = [
        { Metric: 'Store Name', Value: shopSettings.shopName },
        { Metric: 'Total Revenue', Value: totalRevenue },
        { Metric: 'Total Gross Profit', Value: totalProfit },
        { Metric: 'Profit Margin %', Value: `${profitMarginPercent.toFixed(1)}%` },
        { Metric: 'Total Sales Count', Value: totalTransactionsCount },
        { Metric: 'Average Order Value', Value: averageTicket }
      ];

      const salesRows = filteredSales.map((s) => {
        const row: Record<string, unknown> = {
          'Receipt #': s.receiptNumber,
          'Date': new Date(s.timestamp).toLocaleString(),
          'Cashier': s.cashierName,
          'Payment Method': s.paymentMethod,
          'Payment Ref #': s.paymentReference || '—',
          'Items Count': s.items.reduce((sum, i) => sum + i.quantity, 0),
          'Subtotal': s.subtotal,
          'Discount': s.cartDiscountAmount
        };
        // Only include Tax column if Charge tax is enabled
        if (shopSettings.enableTax) {
          row['Tax'] = s.taxAmount;
        }
        row['Total'] = s.total;
        row['Profit'] = s.profitTotal;
        return row;
      });

      const wb = XLSX.utils.book_new();
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      const wsSales = XLSX.utils.json_to_sheet(salesRows);

      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
      XLSX.utils.book_append_sheet(wb, wsSales, 'Transactions');
      XLSX.writeFile(wb, `${shopSettings.shopName.replace(/\s+/g, '_')}_Report_${dateRange}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Sales report exported to Excel");
    } catch (err) {
      console.error(err);
      toast.error("Excel export failed");
    }
  };

  // Export report to PDF using jsPDF
  const handleExportPdf = () => {
    try {
      const doc = new jsPDF();
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(20, 57, 26);
      doc.text(shopSettings.shopName, 14, 20);

      doc.setFontSize(12);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(`Sales & Revenue Report (${dateRange.toUpperCase()})`, 14, 28);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 34);

      // KPI boxes
      doc.setDrawColor(220, 232, 220);
      doc.setFillColor(246, 250, 246);
      doc.roundedRect(14, 40, 55, 20, 2, 2, 'FD');
      doc.roundedRect(74, 40, 55, 20, 2, 2, 'FD');
      doc.roundedRect(134, 40, 55, 20, 2, 2, 'FD');

      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text('TOTAL REVENUE', 18, 46);
      doc.text('GROSS PROFIT', 78, 46);
      doc.text('SALES COUNT', 138, 46);

      doc.setFontSize(13);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(34, 139, 34);
      doc.text(formatCurrency(totalRevenue, shopSettings.currencySymbol), 18, 55);
      doc.text(formatCurrency(totalProfit, shopSettings.currencySymbol), 78, 55);
      doc.setTextColor(20, 57, 26);
      doc.text(String(totalTransactionsCount), 138, 55);

      // Top Products Table
      doc.setFontSize(11);
      doc.text('Top Performing Products', 14, 72);

      doc.setFontSize(9);
      doc.setFont('Helvetica', 'bold');
      doc.text('Product Name', 14, 80);
      doc.text('Units', 110, 80);
      doc.text('Revenue', 140, 80);
      doc.text('Profit', 170, 80);

      doc.setFont('Helvetica', 'normal');
      let y = 88;
      topSellingItems.slice(0, 8).forEach((item) => {
        doc.text(item.name.substring(0, 42), 14, y);
        doc.text(String(item.units), 110, y);
        doc.text(formatCurrency(item.revenue, shopSettings.currencySymbol), 140, y);
        doc.text(formatCurrency(item.profit, shopSettings.currencySymbol), 170, y);
        y += 7;
      });

      doc.save(`${shopSettings.shopName.replace(/\s+/g, '_')}_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Sales report PDF downloaded");
    } catch (err) {
      console.error(err);
      toast.error("PDF export failed");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DCE8DC]">
        <div>
          <h2 className="text-xl font-bold text-[#14391A] flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#228B22]" />
            {shopSettings.shopName} · Sales &amp; Business Intelligence
          </h2>
          <p className="text-xs text-slate-500">
            Real-time revenue metrics, profit margins, item performance, and stock audits
          </p>
        </div>

        {/* Date Filters & Export */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-[#DCE8DC] bg-white p-1">
            {(['today', '7days', '30days', 'all'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDateRange(r)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                  dateRange === r ? 'bg-[#228B22] text-white' : 'text-slate-600 hover:text-[#14391A]'
                }`}
              >
                {r === 'today' ? 'Today' : r === '7days' ? 'Last 7 Days' : r === '30days' ? 'Last 30 Days' : 'All Time'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 border border-[#DCE8DC] hover:bg-[#F6FAF6] text-[#14391A] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-4 h-4 text-[#228B22]" />
            Excel
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            className="px-3.5 py-2 border border-[#DCE8DC] hover:bg-[#F6FAF6] text-[#14391A] text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <FileText className="w-4 h-4 text-[#228B22]" />
            PDF
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-[#DCE8DC] shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Total Revenue</span>
            <DollarSign className="w-4 h-4 text-[#228B22]" />
          </div>
          <p className="text-2xl font-bold font-mono-numbers text-[#14391A]">
            {formatCurrency(totalRevenue, shopSettings.currencySymbol)}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {totalTransactionsCount} completed transactions
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#DCE8DC] shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Estimated Profit</span>
            <TrendingUp className="w-4 h-4 text-[#228B22]" />
          </div>
          <p className="text-2xl font-bold font-mono-numbers text-[#228B22]">
            {formatCurrency(totalProfit, shopSettings.currencySymbol)}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {profitMarginPercent.toFixed(1)}% gross profit margin
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#DCE8DC] shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Avg Order Value</span>
            <ShoppingCart className="w-4 h-4 text-[#228B22]" />
          </div>
          <p className="text-2xl font-bold font-mono-numbers text-[#14391A]">
            {formatCurrency(averageTicket, shopSettings.currencySymbol)}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Per customer checkout
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#DCE8DC] shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Low Stock Alerts</span>
            <AlertTriangle className={`w-4 h-4 ${lowStockItems.length > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
          </div>
          <p className={`text-2xl font-bold font-mono-numbers ${lowStockItems.length > 0 ? 'text-amber-600' : 'text-[#14391A]'}`}>
            {lowStockItems.length}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Items need reordering
          </span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Daily Revenue Trend (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-[#DCE8DC] shadow-sm">
          <h3 className="font-bold text-sm text-[#14391A] mb-4">
            Sales &amp; Revenue Trend
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChartData}>
                <XAxis dataKey="date" stroke="#888888" fontSize={11} tickLine={false} />
                <YAxis stroke="#888888" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(val: unknown) => [formatCurrency(Number(val) || 0, shopSettings.currencySymbol), '']}
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#DCE8DC', borderRadius: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="revenue" name="Revenue" fill="#228B22" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="#14391A" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-[#DCE8DC] shadow-sm">
          <h3 className="font-bold text-sm text-[#14391A] mb-4">
            Revenue by Category
          </h3>
          <div className="h-64 w-full">
            {categoryData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No categorical sales recorded in this period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: unknown) => [formatCurrency(Number(val) || 0, shopSettings.currencySymbol), 'Revenue']}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Two Column Section: Top Selling Items & Low Stock Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Top Selling Items (8 cols) */}
        <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-[#DCE8DC] shadow-sm">
          <h3 className="font-bold text-sm text-[#14391A] mb-3">
            Top Selling Products &amp; Services
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F6FAF6] border-b border-[#DCE8DC] text-[#14391A] font-bold">
                <tr>
                  <th className="py-2.5 px-3">PRODUCT</th>
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3 text-center">UNITS SOLD</th>
                  <th className="py-2.5 px-3 text-right">TOTAL REVENUE</th>
                  <th className="py-2.5 px-3 text-right">GROSS PROFIT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DCE8DC]">
                {topSellingItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No sales recorded for this period.
                    </td>
                  </tr>
                ) : (
                  topSellingItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-[#14391A]">{item.name}</td>
                      <td className="py-2.5 px-3 font-mono-numbers text-slate-500">{item.sku}</td>
                      <td className="py-2.5 px-3 text-center font-mono-numbers font-bold text-slate-700">
                        {item.units}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-numbers font-bold text-[#14391A]">
                        {formatCurrency(item.revenue, shopSettings.currencySymbol)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono-numbers font-bold text-[#228B22]">
                        {formatCurrency(item.profit, shopSettings.currencySymbol)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Watchlist (4 cols) */}
        <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-[#DCE8DC] shadow-sm flex flex-col">
          <h3 className="font-bold text-sm text-[#14391A] mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Low-Stock Priority Watchlist
          </h3>
          
          <div className="flex-1 overflow-y-auto space-y-2">
            {lowStockItems.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                All inventory products are above their minimum thresholds.
              </div>
            ) : (
              lowStockItems.map((it) => (
                <div
                  key={it.id}
                  className="p-3 bg-[#F6FAF6] rounded-xl border border-[#DCE8DC] flex items-center justify-between text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[#14391A] truncate">{it.name}</p>
                    <p className="text-[11px] text-slate-400 font-mono-numbers">{it.sku}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-bold font-mono-numbers text-amber-600 text-xs block">
                      {it.stock} {it.unit} left
                    </span>
                    <span className="text-[10px] text-slate-400">Limit: {it.lowStockThreshold}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Transaction History & Audit Log */}
      <div className="bg-white p-5 rounded-2xl border border-[#DCE8DC] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#DCE8DC]">
          <div>
            <h3 className="font-bold text-sm text-[#14391A] flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#228B22]" />
              Transaction History &amp; Audit Log
            </h3>
            <p className="text-xs text-slate-500">
              Complete log of sales transactions, cashier receipts, payment references, and refund controls
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-[#F6FAF6] text-[#14391A] border border-[#DCE8DC] rounded-lg self-start sm:self-auto">
            {filteredSales.length} Transactions Recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F6FAF6] border-b border-[#DCE8DC] text-[#14391A] font-bold">
              <tr>
                <th className="py-2.5 px-3">RECEIPT #</th>
                <th className="py-2.5 px-3">DATE &amp; TIME</th>
                <th className="py-2.5 px-3">CASHIER</th>
                <th className="py-2.5 px-3">METHOD</th>
                <th className="py-2.5 px-3">ITEMS</th>
                <th className="py-2.5 px-3 text-right">TOTAL</th>
                <th className="py-2.5 px-3 text-center">STATUS</th>
                {currentUser.role === 'admin' && (
                  <th className="py-2.5 px-3 text-right">ACTION</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE8DC]">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={currentUser.role === 'admin' ? 8 : 7} className="py-8 text-center text-slate-400">
                    No sales transactions match the current date filter.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-mono-numbers font-bold text-[#14391A]">
                      {sale.receiptNumber}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {new Date(sale.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {sale.cashierName || sale.cashierEmail}
                    </td>
                    <td className="py-2.5 px-3 capitalize text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <span className="font-medium">{sale.paymentMethod}</span>
                        {sale.paymentReference && (
                          <span className="text-[10px] text-slate-400 font-mono-numbers">({sale.paymentReference})</span>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={sale.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}>
                      {sale.items.length} item{sale.items.length > 1 ? 's' : ''} ({sale.items.map(i => `${i.quantity}x ${i.name}`).join(', ')})
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono-numbers font-bold text-[#14391A]">
                      {formatCurrency(sale.total, shopSettings.currencySymbol)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        sale.status === 'refunded'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {sale.status === 'refunded' ? 'Refunded / Void' : 'Completed'}
                      </span>
                    </td>
                    {currentUser.role === 'admin' && (
                      <td className="py-2.5 px-3 text-right">
                        {sale.status !== 'refunded' ? (
                          <button
                            type="button"
                            onClick={() => setSaleToRefund(sale)}
                            className="px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-1 ml-auto transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Void / Refund</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Voided</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Master Passcode Modal for Void/Refund Authorization */}
      {saleToRefund && (
        <MasterPasscodeModal
          isOpen={true}
          title={`Authorize Refund for #${saleToRefund.receiptNumber}`}
          description={`Voiding receipt #${saleToRefund.receiptNumber} (${formatCurrency(saleToRefund.total, shopSettings.currencySymbol)}) will return physical items back to inventory stock and mark this transaction as refunded. Enter master passcode to proceed.`}
          onSuccess={handleConfirmRefund}
          onClose={() => setSaleToRefund(null)}
        />
      )}
    </div>
  );
};
