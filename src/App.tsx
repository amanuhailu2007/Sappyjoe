/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  InventoryItem, 
  QuickSalePreset, 
  ShopSettings, 
  UserProfile, 
  HeldCart, 
  SaleTransaction,
  SecuritySettings
} from './types';
import { 
  subscribeItems, 
  subscribeQuickPresets, 
  subscribeSales, 
  subscribeHeldCarts, 
  subscribeSettings, 
  subscribeUsers, 
  subscribeSecuritySettings,
  saveQuickPreset,
  bootstrapSettingsIfMissing,
  DEFAULT_SHOP_SETTINGS,
  DEFAULT_SECURITY_SETTINGS
} from './services/dataService';
import { AppLayout, ActiveTab } from './components/layout/AppLayout';
import { ToastProvider, useToast } from './components/common/ToastContext';
import { AuthProvider, useAuth } from './components/auth/AuthContext';
import { LoginView } from './components/auth/LoginView';
import { FirebaseSetupError } from './components/common/FirebaseSetupError';
import { CameraScannerModal } from './components/scanner/CameraScannerModal';
import { UnknownBarcodeModal } from './components/scanner/UnknownBarcodeModal';
import { useKeyboardBarcodeScanner } from './hooks/useKeyboardBarcodeScanner';
import { playScanBeep } from './utils/sound';
import { missingFirebaseEnvVars } from './config/firebase';

// Pages
import { POSPage } from './pages/POSPage';
import { ScannerPage } from './pages/ScannerPage';
import { BarcodeStudioPage } from './pages/BarcodeStudioPage';
import { InventoryPage } from './pages/InventoryPage';
import { BulkImportPage } from './pages/BulkImportPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { UsersPage } from './pages/UsersPage';

function POSApp() {
  const toast = useToast();
  const { 
    currentUserProfile, 
    isAuthReady, 
    signOut 
  } = useAuth();

  const [activeTab, setActiveTab] = useState<ActiveTab>('pos');
  const [shopSettings, setShopSettings] = useState<ShopSettings>(DEFAULT_SHOP_SETTINGS);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [quickPresets, setQuickPresets] = useState<QuickSalePreset[]>([]);
  const [sales, setSales] = useState<SaleTransaction[]>([]);
  const [heldCarts, setHeldCarts] = useState<HeldCart[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>(DEFAULT_SECURITY_SETTINGS);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Global modals
  const [isQuickScannerOpen, setIsQuickScannerOpen] = useState(false);
  const [unknownBarcodeScanned, setUnknownBarcodeScanned] = useState<string | null>(null);
  const [prefilledBarcodeForNewItem, setPrefilledBarcodeForNewItem] = useState<string | null>(null);

  const isAdmin = currentUserProfile?.role === 'admin';

  // Role guard: prevent cashier from remaining on restricted admin tabs
  useEffect(() => {
    if (currentUserProfile && currentUserProfile.role === 'cashier') {
      const adminTabs: ActiveTab[] = ['import', 'reports', 'settings', 'users'];
      if (adminTabs.includes(activeTab)) {
        setActiveTab('pos');
      }
    }
  }, [currentUserProfile, activeTab]);

  // Real-time Firestore subscriptions
  useEffect(() => {
    if (!currentUserProfile) return;

    // Bootstrap default settings if first admin
    if (currentUserProfile.role === 'admin') {
      bootstrapSettingsIfMissing(currentUserProfile).then((st) => {
        if (st) setShopSettings(st);
      }).catch(console.warn);
    }

    const unsubSettings = subscribeSettings((st) => {
      setShopSettings(st);
    });

    const unsubItems = subscribeItems((loadedItems) => {
      setItems(loadedItems);
      setIsLoadingData(false);
    });

    const unsubPresets = subscribeQuickPresets((loadedPresets) => {
      setQuickPresets(loadedPresets);
    });

    const unsubSales = subscribeSales(
      currentUserProfile.id,
      currentUserProfile.role === 'admin',
      (loadedSales) => {
        setSales(loadedSales);
      }
    );

    const unsubHeld = subscribeHeldCarts((loadedCarts) => {
      setHeldCarts(loadedCarts);
    });

    let unsubUsers = () => {};
    let unsubSecurity = () => {};

    if (currentUserProfile.role === 'admin') {
      unsubUsers = subscribeUsers((loadedUsers) => {
        setUsers(loadedUsers);
      });
      unsubSecurity = subscribeSecuritySettings((sec) => {
        setSecuritySettings(sec);
      });
    }

    return () => {
      unsubSettings();
      unsubItems();
      unsubPresets();
      unsubSales();
      unsubHeld();
      unsubUsers();
      unsubSecurity();
    };
  }, [currentUserProfile]);

  // Handle hardware USB or Bluetooth keyboard-wedge barcode scanner
  const handleHardwareBarcodeScanned = useCallback((scannedCode: string) => {
    const trimmed = scannedCode.trim();
    if (!trimmed) return;

    playScanBeep(shopSettings.enableSoundBeep);

    const found = items.find(
      (it) => it.barcode === trimmed || it.sku.toLowerCase() === trimmed.toLowerCase()
    );

    if (found) {
      toast.success(`Scanned: ${found.name}`);
      if (activeTab !== 'pos') {
        setActiveTab('pos');
      }
    } else {
      setUnknownBarcodeScanned(trimmed);
      toast.warning(`Unknown barcode scanned: ${trimmed}`);
    }
  }, [items, activeTab, shopSettings.enableSoundBeep, toast]);

  // Mount global hardware keyboard barcode listener
  useKeyboardBarcodeScanner({
    onBarcodeScanned: handleHardwareBarcodeScanned,
    enabled: !!currentUserProfile
  });

  // Add new item with scanned unknown barcode
  const handleAddNewItemWithBarcode = (barcode: string) => {
    setPrefilledBarcodeForNewItem(barcode);
    setActiveTab('inventory');
  };

  // Quick preset updates from POS
  const handleUpdatePreset = async (preset: QuickSalePreset) => {
    await saveQuickPreset(preset);
    toast.success(`Preset "${preset.name}" updated`);
  };

  const handleAddPreset = async (preset: QuickSalePreset) => {
    await saveQuickPreset(preset);
    toast.success(`Preset "${preset.name}" added`);
  };

  // 1. Missing Firebase Environment Configuration
  if (missingFirebaseEnvVars.length > 0) {
    return <FirebaseSetupError missingVars={missingFirebaseEnvVars} />;
  }

  // 2. Auth loading state
  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-[#F6FAF6] flex flex-col items-center justify-center gap-3">
        <div className="w-9 h-9 border-3 border-[#228B22] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-[#14391A]">Connecting to Sappy Stationary POS...</p>
      </div>
    );
  }

  // 3. Not authenticated -> Login View
  if (!currentUserProfile) {
    return (
      <LoginView 
        shopSettings={shopSettings} 
        onLoginSuccess={(profile) => {
          setActiveTab(profile.role === 'admin' ? 'reports' : 'pos');
        }}
      />
    );
  }

  return (
    <AppLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      currentUser={currentUserProfile}
      shopSettings={shopSettings}
      securitySettings={securitySettings}
      onOpenQuickScanner={() => setIsQuickScannerOpen(true)}
      onSignOut={signOut}
    >
      {isLoadingData ? (
        <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
          <div className="w-6 h-6 border-2 border-[#228B22] border-t-transparent rounded-full animate-spin" />
          <span>Synchronizing with real Firestore database...</span>
        </div>
      ) : (
        <>
          {activeTab === 'pos' && (
            <POSPage
              items={items}
              quickPresets={quickPresets}
              shopSettings={shopSettings}
              currentUser={currentUserProfile}
              heldCarts={heldCarts}
              onOpenScanner={() => setIsQuickScannerOpen(true)}
              onRefreshData={async () => {}}
              onUpdatePreset={handleUpdatePreset}
              onAddPreset={handleAddPreset}
              onAddNewItemWithBarcode={handleAddNewItemWithBarcode}
            />
          )}

          {activeTab === 'scanner' && (
            <ScannerPage
              items={items}
              shopSettings={shopSettings}
              currentUser={currentUserProfile}
              onAddNewItemWithBarcode={handleAddNewItemWithBarcode}
            />
          )}

          {activeTab === 'barcode-studio' && (
            <BarcodeStudioPage
              items={items}
              shopSettings={shopSettings}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryPage
              items={items}
              shopSettings={shopSettings}
              currentUser={currentUserProfile}
              prefilledBarcode={prefilledBarcodeForNewItem}
              onClearPrefilledBarcode={() => setPrefilledBarcodeForNewItem(null)}
              onRefreshData={async () => {}}
            />
          )}

          {activeTab === 'import' && isAdmin && (
            <BulkImportPage
              existingItems={items}
              shopSettings={shopSettings}
              currentUser={currentUserProfile}
              onRefreshData={async () => {}}
            />
          )}

          {activeTab === 'reports' && isAdmin && (
            <ReportsPage
              sales={sales}
              items={items}
              shopSettings={shopSettings}
              currentUser={currentUserProfile}
            />
          )}

          {activeTab === 'users' && isAdmin && (
            <UsersPage
              currentUser={currentUserProfile}
              shopSettings={shopSettings}
            />
          )}

          {activeTab === 'settings' && isAdmin && (
            <SettingsPage
              shopSettings={shopSettings}
              users={users}
              currentUser={currentUserProfile}
              onRefreshData={async () => {}}
            />
          )}
        </>
      )}

      {/* Global Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={isQuickScannerOpen}
        onClose={() => setIsQuickScannerOpen(false)}
        onScan={(code) => {
          setIsQuickScannerOpen(false);
          handleHardwareBarcodeScanned(code);
        }}
        soundEnabled={shopSettings.enableSoundBeep}
      />

      {/* Global Unknown Barcode Prompt */}
      <UnknownBarcodeModal
        isOpen={unknownBarcodeScanned !== null}
        barcode={unknownBarcodeScanned || ''}
        onClose={() => setUnknownBarcodeScanned(null)}
        onAddNewItem={(code) => {
          setUnknownBarcodeScanned(null);
          handleAddNewItemWithBarcode(code);
        }}
      />
    </AppLayout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <POSApp />
      </AuthProvider>
    </ToastProvider>
  );
}
