/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ShieldAlert, KeyRound, Eye, EyeOff, Loader2, X, AlertTriangle, Lock } from 'lucide-react';
import { verifyMasterPasscode } from '../../services/dataService';

interface MasterPasscodeModalProps {
  isOpen: boolean;
  title: string;
  actionDescription?: string;
  description?: string;
  confirmButtonText?: string;
  isDangerous?: boolean;
  onConfirm?: () => Promise<void> | void;
  onSuccess?: () => Promise<void> | void;
  onClose: () => void;
}

export const MasterPasscodeModal: React.FC<MasterPasscodeModalProps> = ({
  isOpen,
  title,
  actionDescription,
  description,
  confirmButtonText = "Confirm Action",
  isDangerous = false,
  onConfirm,
  onSuccess,
  onClose
}) => {
  const displayDescription = actionDescription || description || "Please authorize this action with the master passcode.";
  const handleSuccessAction = onConfirm || onSuccess;
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Rate-limiting state
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutSecondsRemaining, setLockoutSecondsRemaining] = useState<number>(0);

  // Countdown timer for lockout
  useEffect(() => {
    if (lockoutSecondsRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSecondsRemaining]);

  useEffect(() => {
    if (isOpen) {
      setPasscode('');
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isLocked = lockoutSecondsRemaining > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    if (!passcode.trim()) {
      setErrorMessage("Please enter the master passcode.");
      return;
    }

    try {
      setIsVerifying(true);
      setErrorMessage(null);

      const isValid = await verifyMasterPasscode(passcode.trim());

      if (!isValid) {
        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);
        setIsVerifying(false);

        if (nextFailed >= 5) {
          setLockoutSecondsRemaining(60);
          setFailedAttempts(0);
          setErrorMessage("Too many incorrect attempts. Form locked for 60 seconds.");
        } else {
          setErrorMessage(`Incorrect master passcode. ${5 - nextFailed} attempts remaining.`);
        }
        return;
      }

      // Success
      setFailedAttempts(0);
      setErrorMessage(null);
      if (handleSuccessAction) await handleSuccessAction();
      setIsVerifying(false);
      onClose();
    } catch (err: unknown) {
      setIsVerifying(false);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-[#DCE8DC] p-6 space-y-4">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              isDangerous ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-[#228B22]/10 text-[#228B22] border border-[#228B22]/20'
            }`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-[#14391A]">{title}</h3>
              <p className="text-[11px] text-slate-500">Master Passcode Required</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action summary */}
        <div className="p-3 bg-[#F6FAF6] rounded-xl border border-[#DCE8DC] text-xs text-slate-600 leading-relaxed">
          {displayDescription}
        </div>

        {/* Error / Lockout Banner */}
        {errorMessage && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {isLocked && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2 font-medium">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Locked for security. Try again in <strong>{lockoutSecondsRemaining}s</strong>.</span>
          </div>
        )}

        {/* Passcode input form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#14391A] mb-1.5 flex items-center justify-between">
              <span>Admin Master Passcode</span>
              {failedAttempts > 0 && !isLocked && (
                <span className="text-[10px] text-amber-600 font-normal">
                  {5 - failedAttempts} tries left
                </span>
              )}
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPasscode ? 'text' : 'password'}
                autoFocus
                disabled={isLocked || isVerifying}
                required
                placeholder="Enter master passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className={`w-full pl-9 pr-10 py-2.5 text-xs bg-white border rounded-xl focus:outline-none focus:ring-2 font-mono-numbers ${
                  isLocked 
                    ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                    : 'border-[#DCE8DC] focus:ring-[#228B22]/30 focus:border-[#228B22]'
                }`}
              />
              <button
                type="button"
                disabled={isLocked}
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-xs font-semibold rounded-xl border border-[#DCE8DC] text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLocked || isVerifying || !passcode}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl text-white flex items-center justify-center gap-1.5 shadow-sm transition-all ${
                isLocked || !passcode
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : isDangerous
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-[#228B22] hover:bg-[#1B6E1B]'
              }`}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                confirmButtonText
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
