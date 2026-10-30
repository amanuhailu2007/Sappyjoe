/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Store, 
  Users, 
  Check, 
  Flame, 
  Wifi, 
  Clock, 
  Volume2, 
  Receipt,
  Globe,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { ShopSettings, UserProfile, SecuritySettings } from '../types';
import { isFirebaseConfigured } from '../config/firebase';
import { saveSettings, updateMasterPasscode, getSecuritySettings } from '../services/dataService';
import { useToast } from '../components/common/ToastContext';

interface SettingsPageProps {
  shopSettings: ShopSettings;
  users?: UserProfile[];
  currentUser: UserProfile;
  onRefreshData?: () => Promise<void>;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  shopSettings,
  currentUser,
  onRefreshData
}) => {
  const toast = useToast();
  const isAdmin = currentUser.role === 'admin';
  const firebaseLive = isFirebaseConfigured();

  const [settingsForm, setSettingsForm] = useState<ShopSettings>({ 
    ...shopSettings,
    inactivityTimeoutMinutes: shopSettings.inactivityTimeoutMinutes || 30
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Security & Master Passcode State
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [showCurrentPasscode, setShowCurrentPasscode] = useState(false);
  const [showNewPasscode, setShowNewPasscode] = useState(false);
  const [isUpdatingPasscode, setIsUpdatingPasscode] = useState(false);
  const [passcodeError, setPasscodeError] = useState<string | null>(null);

  // Handle settings update
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.warning("Only administrators can update shop settings");
      return;
    }
    try {
      setIsSavingSettings(true);
      await saveSettings(settingsForm);
      if (onRefreshData) {
        await onRefreshData();
      }
      setIsSavingSettings(false);
      toast.success("Shop settings updated in Firestore");
    } catch (err: unknown) {
      setIsSavingSettings(false);
      toast.error("Could not save settings to database");
    }
  };

  // Handle master passcode update
  const handleUpdateMasterPasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error("Admin permissions required.");
      return;
    }

    if (!currentPasscode.trim()) {
      setPasscodeError("Please enter the current master passcode.");
      return;
    }

    if (newPasscode.length < 6) {
      setPasscodeError("New master passcode must be at least 6 characters long.");
      return;
    }

    if (newPasscode.trim() === "Default") {
      setPasscodeError("New master passcode cannot equal 'Default'.");
      return;
    }

    if (newPasscode !== confirmPasscode) {
      setPasscodeError("New passcodes do not match.");
      return;
    }

    try {
      setIsUpdatingPasscode(true);
      setPasscodeError(null);
      await updateMasterPasscode(currentPasscode.trim(), newPasscode.trim(), currentUser);
      setCurrentPasscode('');
      setNewPasscode('');
      setConfirmPasscode('');
      setIsUpdatingPasscode(false);
      toast.success("Master passcode successfully updated!");
      if (onRefreshData) {
        await onRefreshData();
      }
    } catch (err: unknown) {
      setIsUpdatingPasscode(false);
      const msg = err instanceof Error ? err.message : String(err);
      setPasscodeError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="pb-4 border-b border-[#DCE8DC]">
        <h2 className="text-xl font-bold text-[#14391A] flex items-center gap-2">
          <SettingsIcon className="w-6 h-6 text-[#228B22]" />
          Store Settings &amp; Configuration
        </h2>
        <p className="text-xs text-slate-500">
          Configure shop branding, tax rules, session security, and regional settings for Sappy Stationary
        </p>
      </div>

      {/* Cloud Sync & Firebase Status Card */}
      <div className="p-5 bg-[#F6FAF6] rounded-2xl border border-[#DCE8DC] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-white border border-[#DCE8DC] text-[#228B22] shadow-xs">
            <Flame className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-[#14391A]">Real Firestore Database</h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                firebaseLive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
              }`}>
                <Wifi className="w-3 h-3 text-[#228B22]" />
                {firebaseLive ? 'Live Firebase Connected' : 'Configuration Missing'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              All transactions, real-time stock sync, audit logs, and user credentials persist directly into your cloud Firestore database.
            </p>
          </div>
        </div>
      </div>

      {/* Shop Identity & Configuration Form */}
      <form onSubmit={handleSaveSettings} className="bg-white p-6 rounded-2xl border border-[#DCE8DC] shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-2 border-b border-[#DCE8DC]">
          <h3 className="font-bold text-sm text-[#14391A] flex items-center gap-2">
            <Store className="w-4 h-4 text-[#228B22]" />
            Store Identity &amp; Receipt Branding
          </h3>
          <span className="text-[11px] text-[#228B22] font-semibold bg-[#228B22]/10 px-2.5 py-0.5 rounded-full">
            Addis Ababa · ETB
          </span>
        </div>

        {/* Basic Store Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#14391A] mb-1">Shop Name (English) *</label>
            <input
              type="text"
              required
              value={settingsForm.shopName}
              onChange={(e) => setSettingsForm({ ...settingsForm, shopName: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl focus:ring-1 focus:ring-[#228B22]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#14391A] mb-1 font-ethiopic">የሱቅ ስም (በአማርኛ)</label>
            <input
              type="text"
              placeholder="ለምሳሌ፦ ሳፒ ስቴሽነሪ"
              value={settingsForm.shopNameAmharic || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, shopNameAmharic: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl font-ethiopic"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#14391A] mb-1">TIN Number (Ethiopian Tax ID)</label>
            <input
              type="text"
              placeholder="e.g. 0084729105"
              value={settingsForm.tinNumber || ''}
              onChange={(e) => setSettingsForm({ ...settingsForm, tinNumber: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl font-mono-numbers"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#14391A] mb-1">Phone Number</label>
            <input
              type="text"
              value={settingsForm.phone}
              onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl font-mono-numbers"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#14391A] mb-1">Store Address (Addis Ababa)</label>
            <input
              type="text"
              value={settingsForm.address}
              onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#14391A] mb-1">Currency Code</label>
            <input
              type="text"
              required
              value={settingsForm.currencySymbol}
              onChange={(e) => setSettingsForm({ ...settingsForm, currencySymbol: e.target.value, currencyCode: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl font-mono-numbers"
            />
          </div>
        </div>

        {/* TAX / VAT CONFIGURATION SECTION */}
        <div className="p-4 rounded-xl border border-[#DCE8DC] bg-[#F6FAF6] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-[#14391A]">Charge Tax</span>
                {!settingsForm.enableTax && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#14391A]">
                    Tax Exempt Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {settingsForm.enableTax 
                  ? 'Tax calculation is active on orders, receipts, and reporting.' 
                  : 'Business is TAX EXEMPT. No tax or VAT is charged or shown in cart, receipts, or reports.'}
              </p>
            </div>

            {/* Toggle Switch */}
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settingsForm.enableTax}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  setSettingsForm({
                    ...settingsForm,
                    enableTax: isChecked,
                    taxRate: isChecked ? (settingsForm.taxRate || 15.0) : 0.0
                  });
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#228B22]"></div>
            </label>
          </div>

          {/* If Charge Tax is turned ON: Show tax rate, tax name, and VAT-inclusive toggle */}
          {settingsForm.enableTax && (
            <div className="pt-3 border-t border-[#DCE8DC] grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-semibold text-[#14391A] mb-1">Tax Rate (%)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={settingsForm.taxRate}
                    onChange={(e) => setSettingsForm({ ...settingsForm, taxRate: parseFloat(e.target.value) || 0 })}
                    className="w-1/2 px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl font-mono-numbers bg-white"
                  />
                  <input
                    type="text"
                    value={settingsForm.taxName}
                    onChange={(e) => setSettingsForm({ ...settingsForm, taxName: e.target.value })}
                    placeholder="VAT / Tax"
                    className="w-1/2 px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14391A] mb-1">Pricing Tax Mode</label>
                <div className="flex rounded-xl border border-[#DCE8DC] overflow-hidden bg-white">
                  <button
                    type="button"
                    onClick={() => setSettingsForm({ ...settingsForm, pricesIncludeVat: true })}
                    className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                      settingsForm.pricesIncludeVat ? 'bg-[#228B22] text-white' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Tax-Inclusive
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettingsForm({ ...settingsForm, pricesIncludeVat: false })}
                    className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                      !settingsForm.pricesIncludeVat ? 'bg-[#228B22] text-white' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Tax-Exclusive (+VAT)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Session Security & Auto-Logout */}
        <div className="p-4 rounded-xl border border-[#DCE8DC] bg-[#F6FAF6] space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#228B22]" />
            <h4 className="font-bold text-xs text-[#14391A]">Session Security &amp; Auto-Logout</h4>
          </div>
          <p className="text-[11px] text-slate-500">
            For security at checkout counters, cashiers and admins are automatically signed out after a period of user inactivity.
          </p>
          <div className="max-w-xs">
            <label className="block text-xs font-semibold text-[#14391A] mb-1">
              Inactivity Auto-Logout (Minutes)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="5"
                max="240"
                value={settingsForm.inactivityTimeoutMinutes || 30}
                onChange={(e) => setSettingsForm({ 
                  ...settingsForm, 
                  inactivityTimeoutMinutes: Math.max(5, parseInt(e.target.value) || 30) 
                })}
                className="w-24 px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl font-mono-numbers bg-white"
              />
              <span className="text-xs text-slate-500">minutes (default 30)</span>
            </div>
          </div>
        </div>

        {/* Regional & Localization Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#14391A] mb-1">Interface Language / ቋንቋ</label>
            <div className="flex rounded-xl border border-[#DCE8DC] overflow-hidden bg-[#F6FAF6]">
              <button
                type="button"
                onClick={() => setSettingsForm({ ...settingsForm, language: 'en' })}
                className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                  settingsForm.language === 'en' ? 'bg-[#228B22] text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setSettingsForm({ ...settingsForm, language: 'am' })}
                className={`flex-1 py-2 text-xs font-semibold font-ethiopic transition-colors ${
                  settingsForm.language === 'am' ? 'bg-[#228B22] text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                አማርኛ (Amharic)
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-[#DCE8DC] bg-[#F6FAF6]">
            <div>
              <p className="text-xs font-semibold text-[#14391A]">Ethiopian Calendar (ቀን መቁጠሪያ)</p>
              <p className="text-[10px] text-slate-500">Display dates in Meskerem–Pagume</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settingsForm.useEthiopianCalendar}
                onChange={(e) => setSettingsForm({ ...settingsForm, useEthiopianCalendar: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#228B22]"></div>
            </label>
          </div>
        </div>

        {/* Receipt Footer */}
        <div>
          <label className="block text-xs font-semibold text-[#14391A] mb-1">Receipt Footer Disclaimer</label>
          <textarea
            rows={2}
            value={settingsForm.receiptFooter}
            onChange={(e) => setSettingsForm({ ...settingsForm, receiptFooter: e.target.value })}
            className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl font-ethiopic"
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="enableSoundBeep"
            checked={settingsForm.enableSoundBeep}
            onChange={(e) => setSettingsForm({ ...settingsForm, enableSoundBeep: e.target.checked })}
            className="rounded text-[#228B22] focus:ring-[#228B22]"
          />
          <label htmlFor="enableSoundBeep" className="text-xs text-[#14391A] font-medium cursor-pointer">
            Play positive audio beep on barcode scan and cart add
          </label>
        </div>

        <div className="pt-3 border-t border-[#DCE8DC] flex justify-end">
          <button
            type="submit"
            disabled={isSavingSettings}
            className="px-5 py-2.5 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Check className="w-4 h-4" />
            {isSavingSettings ? 'Saving...' : 'Save Settings to Firestore'}
          </button>
        </div>
      </form>

      {/* ADMIN MASTER PASSCODE & ACCESS SECURITY SECTION */}
      {isAdmin && (
        <div className="bg-white p-6 rounded-2xl border border-[#DCE8DC] shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#DCE8DC]">
            <div>
              <h3 className="font-bold text-sm text-[#14391A] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#228B22]" />
                Security &amp; Master Passcode
              </h3>
              <p className="text-xs text-slate-500">
                The Master Passcode authorizes staff cashier self-signup and guards sensitive administrative operations.
              </p>
            </div>
            <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#228B22]" />
              Admin Only
            </span>
          </div>

          {passcodeError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{passcodeError}</span>
            </div>
          )}

          <form onSubmit={handleUpdateMasterPasscode} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#14391A] mb-1">
                  Current Master Passcode *
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPasscode ? 'text' : 'password'}
                    required
                    placeholder="Current passcode"
                    value={currentPasscode}
                    onChange={(e) => setCurrentPasscode(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 text-xs border border-[#DCE8DC] rounded-xl font-mono-numbers focus:ring-1 focus:ring-[#228B22]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPasscode(!showCurrentPasscode)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showCurrentPasscode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14391A] mb-1">
                  New Master Passcode (min 6) *
                </label>
                <div className="relative">
                  <input
                    type={showNewPasscode ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="New secure passcode"
                    value={newPasscode}
                    onChange={(e) => setNewPasscode(e.target.value)}
                    className="w-full pl-3 pr-9 py-2 text-xs border border-[#DCE8DC] rounded-xl font-mono-numbers focus:ring-1 focus:ring-[#228B22]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPasscode(!showNewPasscode)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showNewPasscode ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14391A] mb-1">
                  Confirm New Passcode *
                </label>
                <input
                  type={showNewPasscode ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Repeat new passcode"
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl font-mono-numbers focus:ring-1 focus:ring-[#228B22]"
                />
              </div>
            </div>

            <div className="p-3 bg-[#F6FAF6] rounded-xl border border-[#DCE8DC] text-[11px] text-slate-600 leading-relaxed space-y-1">
              <p>
                <strong>Security Rules:</strong> Cannot equal <code className="bg-white px-1.5 py-0.5 rounded border border-[#DCE8DC] text-slate-800">Default</code>. Must be at least 6 characters.
              </p>
              <p>
                The master passcode is requested before voiding sales, deleting catalog items, bulk importing data, or promoting staff to admins.
              </p>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#DCE8DC]">
              <button
                type="submit"
                disabled={isUpdatingPasscode || !currentPasscode || !newPasscode}
                className="px-5 py-2.5 bg-[#228B22] hover:bg-[#1B6E1B] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                {isUpdatingPasscode ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating Passcode...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Update Master Passcode</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
