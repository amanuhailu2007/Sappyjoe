/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  ShoppingCart, 
  Scan, 
  Barcode, 
  Package, 
  UploadCloud, 
  BarChart3, 
  Settings, 
  Users,
  ShieldCheck, 
  User, 
  Camera,
  Wifi,
  WifiOff,
  Store,
  Languages,
  Clock,
  LogOut,
  AlertTriangle
} from 'lucide-react';
import { UserProfile, ShopSettings, SecuritySettings } from '../../types';
import { isFirebaseConfigured } from '../../config/firebase';
import { getTranslation } from '../../i18n/translations';
import { formatAddisDate } from '../../utils/date';

export type ActiveTab = 'pos' | 'scanner' | 'barcode-studio' | 'inventory' | 'import' | 'reports' | 'users' | 'settings';

interface AppLayoutProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  currentUser: UserProfile;
  shopSettings: ShopSettings;
  securitySettings?: SecuritySettings;
  onOpenQuickScanner: () => void;
  onToggleLanguage?: () => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  activeTab,
  onTabChange,
  currentUser,
  shopSettings,
  securitySettings,
  onOpenQuickScanner,
  onToggleLanguage,
  onSignOut,
  children
}) => {
  const isAdmin = currentUser.role === 'admin';
  const firebaseLive = isFirebaseConfigured();
  const t = getTranslation(shopSettings.language);

  // Keep document title synced with shop name
  React.useEffect(() => {
    document.title = `${shopSettings.shopName || 'Sappy Stationary'} - POS`;
  }, [shopSettings.shopName]);

  // Live Addis Ababa Date & Time
  const currentDateFormatted = formatAddisDate(new Date(), {
    useEthiopianCalendar: shopSettings.useEthiopianCalendar,
    language: shopSettings.language,
    includeTime: true
  });

  const navItems = [
    { id: 'pos' as ActiveTab, label: t.posTerminal, icon: ShoppingCart, allowed: true },
    { id: 'scanner' as ActiveTab, label: t.scanBarcode, icon: Scan, allowed: true },
    { id: 'barcode-studio' as ActiveTab, label: t.barcodeStudio, icon: Barcode, allowed: true },
    { id: 'inventory' as ActiveTab, label: t.inventoryStock, icon: Package, allowed: true },
    { id: 'import' as ActiveTab, label: t.bulkImport, icon: UploadCloud, allowed: isAdmin },
    { id: 'reports' as ActiveTab, label: t.salesReports, icon: BarChart3, allowed: isAdmin },
    { id: 'users' as ActiveTab, label: 'Staff Accounts', icon: Users, allowed: isAdmin },
    { id: 'settings' as ActiveTab, label: t.settingsStaff, icon: Settings, allowed: isAdmin }
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#FFFFFF] text-[#14391A]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[#DCE8DC] bg-[#FFFFFF] shrink-0 h-screen sticky top-0">
        
        {/* Brand Lockup with Sappy Stationary wordmark fallback */}
        <div className="p-4 border-b border-[#DCE8DC] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {shopSettings.logoUrl ? (
              <img src={shopSettings.logoUrl} alt={shopSettings.shopName} className="h-9 w-9 rounded-xl object-contain shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-[#228B22] text-white flex items-center justify-center shadow-sm shrink-0 font-bold text-xs">
                SS
              </div>
            )}
            <div className="min-w-0 flex-1">
              {/* Text-based logo wordmark in Forest Green #228B22 */}
              <h1 className="font-extrabold text-sm text-[#228B22] truncate tracking-tight leading-tight">
                {shopSettings.shopName || 'Sappy Stationary'}
              </h1>
              <p className="text-[10px] text-slate-500 truncate font-ethiopic">
                {shopSettings.language === 'am' && shopSettings.shopNameAmharic 
                  ? shopSettings.shopNameAmharic 
                  : 'Addis Ababa · Stationery POS'}
              </p>
            </div>
          </div>

          {/* Quick Language Switcher */}
          {onToggleLanguage && (
            <button
              type="button"
              onClick={onToggleLanguage}
              className="px-2 py-1 text-[11px] font-bold rounded-lg border border-[#DCE8DC] bg-[#F6FAF6] hover:bg-[#228B22]/10 hover:border-[#228B22] text-[#14391A] transition-colors shrink-0 flex items-center gap-1"
              title="Toggle English / አማርኛ"
            >
              <Languages className="w-3 h-3 text-[#228B22]" />
              <span>{shopSettings.language === 'am' ? 'EN' : 'አማ'}</span>
            </button>
          )}
        </div>

        {/* Addis Ababa Timezone & Calendar Badge */}
        <div className="px-3.5 py-1.5 bg-[#F6FAF6] border-b border-[#DCE8DC] flex items-center gap-1.5 text-[10px] text-slate-600 font-mono-numbers">
          <Clock className="w-3 h-3 text-[#228B22] shrink-0" />
          <span className="truncate font-ethiopic">{currentDateFormatted} (EAT)</span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            if (!item.allowed) return null;
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left font-ethiopic ${
                  isActive
                    ? 'bg-[#228B22] text-white shadow-sm'
                    : 'text-[#14391A] hover:bg-[#F6FAF6] hover:text-[#228B22]'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#228B22]'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Fast Scanner CTA in Sidebar */}
        <div className="p-3">
          <button
            type="button"
            onClick={onOpenQuickScanner}
            className="w-full py-2.5 px-3 bg-[#F6FAF6] hover:bg-[#228B22]/10 border border-[#DCE8DC] hover:border-[#228B22] rounded-xl text-xs font-semibold text-[#14391A] flex items-center justify-center gap-2 transition-all font-ethiopic"
          >
            <Camera className="w-4 h-4 text-[#228B22]" />
            {t.quickScan}
          </button>
        </div>

        {/* User Card & Role Switcher */}
        <div className="p-3 border-t border-[#DCE8DC] bg-[#F6FAF6]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#228B22]/15 text-[#228B22] flex items-center justify-center font-bold text-xs shrink-0">
                {currentUser.displayName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-[#14391A] truncate">{currentUser.displayName}</p>
                <div className="flex items-center gap-1">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded capitalize ${
                    isAdmin ? 'bg-emerald-100 text-[#14391A]' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {currentUser.role}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-1">
              <button
                type="button"
                onClick={onSignOut}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 hover:bg-red-100 text-red-700 flex items-center gap-1 transition-colors"
                title="Log out of system"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log out</span>
              </button>
            </div>
          </div>

          {/* Sync indicator */}
          <div className="mt-2.5 pt-2 border-t border-[#DCE8DC] flex items-center justify-between text-[10px] text-slate-500">
            <div className="flex items-center gap-1.5 font-ethiopic">
              {firebaseLive ? (
                <>
                  <Wifi className="w-3 h-3 text-[#228B22]" />
                  <span>{t.cloudSync}</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-amber-500" />
                  <span>{t.offlineMode}</span>
                </>
              )}
            </div>
            <span className="font-mono-numbers text-[9px] text-slate-400">
              {shopSettings.enableTax ? `ETB · ${shopSettings.taxRate}%` : 'ETB · Tax Exempt'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-h-screen pb-16 md:pb-0">
        {/* Mobile Top Header */}
        <header className="md:hidden px-4 py-3 border-b border-[#DCE8DC] bg-[#FFFFFF] flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2.5 min-w-0">
            {shopSettings.logoUrl ? (
              <img src={shopSettings.logoUrl} alt={shopSettings.shopName} className="h-8 w-8 rounded-lg object-contain shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-[#228B22] text-white flex items-center justify-center font-bold text-xs shrink-0">
                SS
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-extrabold text-xs text-[#228B22] truncate tracking-tight">
                {shopSettings.shopName || 'Sappy Stationary'}
              </h1>
              <span className="text-[10px] text-slate-500 capitalize">{currentUser.role} · {currentUser.displayName.split(' ')[0]}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {onToggleLanguage && (
              <button
                type="button"
                onClick={onToggleLanguage}
                className="px-2 py-1 text-[11px] font-bold rounded-lg border border-[#DCE8DC] bg-[#F6FAF6] text-[#14391A]"
              >
                {shopSettings.language === 'am' ? 'EN' : 'አማ'}
              </button>
            )}
            <button
              type="button"
              onClick={onOpenQuickScanner}
              className="p-1.5 rounded-lg bg-[#F6FAF6] border border-[#DCE8DC] text-[#228B22]"
              title="Camera Scan"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="px-2 py-1 text-xs border border-red-200 bg-red-50 text-red-700 rounded-lg font-semibold flex items-center gap-1"
              title="Log out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </header>

        {/* Persistent Warning Banner when Default Master Passcode is in use */}
        {isAdmin && securitySettings?.isDefault && (
          <div className="bg-amber-600 text-white px-4 py-2.5 text-xs font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-sm sticky top-0 md:static z-20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-white shrink-0 animate-pulse" />
              <span>Default master passcode in use. Change it now.</span>
            </div>
            <button
              type="button"
              onClick={() => onTabChange('settings')}
              className="bg-white text-amber-900 hover:bg-amber-50 px-3 py-1 rounded-lg text-xs font-bold transition-colors shadow-xs"
            >
              Change Passcode
            </button>
          </div>
        )}

        {/* Page Container */}
        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#DCE8DC] px-2 py-1 flex justify-around shadow-lg">
        {navItems.slice(0, 5).map((item) => {
          if (!item.allowed) return null;
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center py-1.5 px-3 rounded-lg text-[10px] font-semibold transition-colors font-ethiopic ${
                isActive ? 'text-[#228B22]' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
        {isAdmin && (
          <button
            type="button"
            onClick={() => onTabChange('reports')}
            className={`flex flex-col items-center py-1.5 px-3 rounded-lg text-[10px] font-semibold transition-colors font-ethiopic ${
              activeTab === 'reports' ? 'text-[#228B22]' : 'text-slate-500'
            }`}
          >
            <BarChart3 className="w-5 h-5 mb-0.5" />
            <span>{t.salesReports.split(' ')[0]}</span>
          </button>
        )}
      </div>
    </div>
  );
};
