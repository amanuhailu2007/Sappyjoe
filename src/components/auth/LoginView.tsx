/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  User, 
  KeyRound, 
  ShieldCheck 
} from 'lucide-react';
import { useAuth } from './AuthContext';
import { ShopSettings, UserProfile } from '../../types';

interface LoginViewProps {
  shopSettings: ShopSettings;
  onLoginSuccess: (profile: UserProfile) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ shopSettings, onLoginSuccess }) => {
  const { 
    signInWithEmail, 
    signUpWithMasterPasscode, 
    sendPasswordReset, 
    authError, 
    setAuthError 
  } = useAuth();

  // Mode: sign in or sign up
  const [isSignUp, setIsSignUp] = useState<boolean>(() => {
    return window.location.pathname === '/signup';
  });

  // Sign In State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(authError);

  // Sign Up State
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [masterPasscode, setMasterPasscode] = useState('');
  const [showMasterPasscode, setShowMasterPasscode] = useState(false);

  // Forgot Password Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    setErrorMessage(authError);
  }, [authError]);

  const handleToggleMode = (signUp: boolean) => {
    setIsSignUp(signUp);
    setErrorMessage(null);
    setAuthError(null);
    try {
      window.history.replaceState(null, '', signUp ? '/signup' : '/login');
    } catch {
      // ignore
    }
  };

  // Sign In Submission
  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);
      setAuthError(null);
      const profile = await signInWithEmail(email.trim(), password);
      onLoginSuccess(profile);
    } catch (err: unknown) {
      setIsLoading(false);
      const raw = err instanceof Error ? err.message : String(err);
      console.error("Sign in failed:", raw);

      if (raw.includes('Account not authorized')) {
        setErrorMessage("Account not authorized. You must be an active admin or cashier registered in Firestore.");
      } else if (raw.includes('auth/invalid-credential') || raw.includes('auth/user-not-found') || raw.includes('auth/wrong-password')) {
        setErrorMessage("Invalid email or password. Please verify your credentials.");
      } else if (raw.includes('auth/user-disabled')) {
        setErrorMessage("This account has been disabled. Contact an administrator.");
      } else if (raw.includes('auth/network-request-failed')) {
        setErrorMessage("Network connection error. Please check your internet connectivity.");
      } else if (raw.includes('auth/too-many-requests')) {
        setErrorMessage("Access temporarily blocked due to too many failed attempts. Try again later or reset password.");
      } else {
        setErrorMessage(raw.replace('Firebase: ', ''));
      }
    }
  };

  // Sign Up Submission (Protected by Master Passcode)
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword || !masterPasscode) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      setAuthError(null);

      const profile = await signUpWithMasterPasscode(
        fullName.trim(),
        email.trim(),
        password,
        masterPasscode.trim()
      );

      onLoginSuccess(profile);
    } catch (err: unknown) {
      setIsLoading(false);
      const raw = err instanceof Error ? err.message : String(err);
      console.error("Signup failed:", raw);

      if (raw.includes("Invalid master passcode") || raw.includes("PERMISSION_DENIED") || raw.includes("Missing or insufficient permissions")) {
        setErrorMessage("Invalid master passcode. Account registration was rejected.");
      } else if (raw.includes("auth/email-already-in-use")) {
        setErrorMessage("An account with this email already exists. Please sign in instead.");
      } else if (raw.includes("auth/invalid-email")) {
        setErrorMessage("Please enter a valid email address.");
      } else if (raw.includes("auth/weak-password")) {
        setErrorMessage("Password is too weak. Please use at least 8 characters.");
      } else {
        setErrorMessage(raw.replace('Firebase: ', ''));
      }
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;

    try {
      setIsResetting(true);
      setResetError(null);
      await sendPasswordReset(resetEmail.trim());
      setResetSuccess(true);
      setIsResetting(false);
    } catch (err: unknown) {
      setIsResetting(false);
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes('auth/user-not-found')) {
        setResetError("No account found with this email address.");
      } else if (raw.includes('auth/invalid-email')) {
        setResetError("Please enter a valid email address.");
      } else {
        setResetError("Could not send password reset email. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      {/* Centered Login/Signup Card */}
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#DCE8DC] shadow-xl p-8 space-y-6">
        
        {/* Header & Wordmark in Forest Green #228B22 */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#228B22] text-white flex items-center justify-center mx-auto shadow-md font-extrabold text-xl">
            SS
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#228B22] tracking-tight">
              {shopSettings.shopName || 'Sappy Stationary'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isSignUp ? 'Cashier Self-Registration' : (shopSettings.tagline || 'Staff Point-of-Sale & Inventory Terminal')}
            </p>
          </div>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              {errorMessage}
            </div>
          </div>
        )}

        {/* SIGN IN FORM */}
        {!isSignUp ? (
          <form onSubmit={handleSignInSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#14391A] mb-1.5">
                Staff Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="staff@sappystationary.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs border border-[#DCE8DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#228B22]/30 focus:border-[#228B22] font-mono-numbers"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-[#14391A]">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setResetSuccess(false);
                    setResetError(null);
                    setIsResetModalOpen(true);
                  }}
                  className="text-[11px] text-[#228B22] hover:underline font-semibold"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 text-xs border border-[#DCE8DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#228B22]/30 focus:border-[#228B22] font-mono-numbers"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Sign in button with loading state */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md ${
                isLoading
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-[#228B22] hover:bg-[#1B6E1B] active:scale-[0.99]'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Link to Sign Up */}
            <div className="pt-2 text-center text-xs text-slate-600">
              New cashier?{' '}
              <button
                type="button"
                onClick={() => handleToggleMode(true)}
                className="font-bold text-[#228B22] hover:underline"
              >
                Create account
              </button>
            </div>
          </form>
        ) : (
          /* SIGN UP FORM (Protected by Master Passcode) */
          <form onSubmit={handleSignUpSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#14391A] mb-1">
                Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Abebe Bikila"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs border border-[#DCE8DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#228B22]/30 focus:border-[#228B22]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#14391A] mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="cashier@sappystationary.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs border border-[#DCE8DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#228B22]/30 focus:border-[#228B22] font-mono-numbers"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-[#14391A] mb-1">
                  Password (min 8) *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 text-xs border border-[#DCE8DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#228B22]/30 focus:border-[#228B22] font-mono-numbers"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#14391A] mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 text-xs border border-[#DCE8DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#228B22]/30 focus:border-[#228B22] font-mono-numbers"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Master Passcode field */}
            <div className="p-3 bg-[#F6FAF6] rounded-2xl border border-[#DCE8DC] space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-[#14391A] flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#228B22]" />
                  Master Passcode *
                </label>
                <span className="text-[10px] text-slate-500">Provided by Admin</span>
              </div>
              <div className="relative">
                <input
                  type={showMasterPasscode ? 'text' : 'password'}
                  required
                  placeholder="Enter shop master passcode"
                  value={masterPasscode}
                  onChange={(e) => setMasterPasscode(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 text-xs bg-white border border-[#DCE8DC] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#228B22]/30 focus:border-[#228B22] font-mono-numbers"
                />
                <button
                  type="button"
                  onClick={() => setShowMasterPasscode(!showMasterPasscode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  title={showMasterPasscode ? "Hide passcode" : "Show passcode"}
                >
                  {showMasterPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 leading-tight">
                Self-signup registers a <strong className="text-[#14391A]">Cashier</strong> account. Incorrect passcode immediately voids the request.
              </p>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3 px-4 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md ${
                isLoading
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'bg-[#228B22] hover:bg-[#1B6E1B] active:scale-[0.99]'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registering cashier account...</span>
                </>
              ) : (
                <>
                  <span>Create Cashier Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Link back to Sign In */}
            <div className="pt-2 text-center text-xs text-slate-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => handleToggleMode(false)}
                className="font-bold text-[#228B22] hover:underline"
              >
                Sign in
              </button>
            </div>
          </form>
        )}

        <div className="pt-1 text-center text-[10px] text-slate-400">
          Sappy Stationary POS · Addis Ababa, Ethiopia
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 border border-[#DCE8DC] shadow-2xl space-y-4">
            <div>
              <h3 className="font-bold text-sm text-[#14391A]">Reset Staff Password</h3>
              <p className="text-xs text-slate-500 mt-1">
                Enter your staff email and we will send you a password reset link.
              </p>
            </div>

            {resetSuccess ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[#14391A] text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#228B22] shrink-0" />
                <span>Password reset link sent! Check your email inbox.</span>
              </div>
            ) : (
              <form onSubmit={handlePasswordResetSubmit} className="space-y-3">
                {resetError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                    {resetError}
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-semibold text-[#14391A] mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-[#DCE8DC] rounded-xl focus:ring-1 focus:ring-[#228B22]"
                    placeholder="staff@sappystationary.com"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(false)}
                    className="flex-1 py-2 text-xs font-semibold rounded-xl border border-[#DCE8DC] text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isResetting}
                    className="flex-1 py-2 text-xs font-bold rounded-xl bg-[#228B22] hover:bg-[#1B6E1B] text-white flex items-center justify-center gap-1.5"
                  >
                    {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            )}

            {resetSuccess && (
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="w-full py-2 text-xs font-bold rounded-xl bg-[#228B22] text-white"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
