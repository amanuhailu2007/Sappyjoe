/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  deleteUser,
  sendPasswordResetEmail,
  signOut as firebaseSignOut 
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '../../config/firebase';
import { UserProfile, UserRole } from '../../types';
import { bootstrapSettingsIfMissing, bootstrapSecurityIfMissing } from '../../services/dataService';

interface AuthContextType {
  firebaseUser: User | null;
  currentUserProfile: UserProfile | null;
  isAuthReady: boolean;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  signInWithEmail: (email: string, pass: string) => Promise<UserProfile>;
  signUpWithMasterPasscode: (name: string, email: string, pass: string, passcode: string) => Promise<UserProfile>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateInactivityTimeout: (minutes: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [timeoutMinutes, setTimeoutMinutes] = useState<number>(30);

  const lastActivityRef = useRef<number>(Date.now());

  // Listen to auth state
  useEffect(() => {
    if (!isFirebaseConfigured() || !auth) {
      setIsAuthReady(true);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user && db) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const snap = await getDoc(userDocRef);

          if (!snap.exists()) {
            console.warn("No Firestore profile exists for authenticated user:", user.uid);
            if (auth) await firebaseSignOut(auth);
            setAuthError("Account not authorized.");
            setCurrentUserProfile(null);
            setIsAuthReady(true);
            return;
          }

          const data = snap.data();
          if (data.active !== true) {
            console.warn("User account is inactive / disabled:", user.uid);
            if (auth) await firebaseSignOut(auth);
            setAuthError("Account not authorized. Your account has been deactivated.");
            setCurrentUserProfile(null);
            setIsAuthReady(true);
            return;
          }

          const profile: UserProfile = {
            id: user.uid,
            email: user.email || data.email || '',
            displayName: data.displayName || user.email?.split('@')[0] || 'Staff User',
            role: (data.role as UserRole) || 'cashier',
            active: true,
            createdAt: data.createdAt || new Date().toISOString(),
            lastLogin: new Date().toISOString(),
            avatarUrl: data.avatarUrl
          };

          // Update lastLogin in Firestore
          try {
            await updateDoc(userDocRef, { lastLogin: new Date().toISOString() });
          } catch {
            // Ignore if permission issue
          }

          // If admin, ensure default settings & security documents exist
          if (profile.role === 'admin') {
            await bootstrapSettingsIfMissing(profile);
            await bootstrapSecurityIfMissing(profile);
          }

          setCurrentUserProfile(profile);
          setAuthError(null);
          lastActivityRef.current = Date.now();
        } catch (err) {
          console.error("Error verifying user authorization:", err);
          if (auth) await firebaseSignOut(auth);
          setAuthError("Account not authorized.");
          setCurrentUserProfile(null);
        }
      } else {
        setCurrentUserProfile(null);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  // Inactivity Auto-Logout Tracker (30 minutes default, configurable)
  useEffect(() => {
    if (!currentUserProfile || !auth) return;

    const resetActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(evt => window.addEventListener(evt, resetActivity, { passive: true }));

    const checkInterval = setInterval(() => {
      const maxIdleMs = timeoutMinutes * 60 * 1000;
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed > maxIdleMs) {
        console.info(`Auto-logout triggered due to ${timeoutMinutes}m inactivity.`);
        if (auth) firebaseSignOut(auth);
        setCurrentUserProfile(null);
        setAuthError("Session expired due to 30 minutes of inactivity. Please sign in again.");
      }
    }, 15000); // Check every 15s

    return () => {
      events.forEach(evt => window.removeEventListener(evt, resetActivity));
      clearInterval(checkInterval);
    };
  }, [currentUserProfile, timeoutMinutes]);

  const signInWithEmail = async (email: string, pass: string): Promise<UserProfile> => {
    if (!auth || !db) throw new Error("Firebase Auth is not initialized");
    setAuthError(null);

    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const snap = await getDoc(doc(db, 'users', cred.user.uid));

    if (!snap.exists()) {
      await firebaseSignOut(auth);
      const errMsg = "Account not authorized.";
      setAuthError(errMsg);
      throw new Error(errMsg);
    }

    const data = snap.data();
    if (data.active !== true) {
      await firebaseSignOut(auth);
      const errMsg = "Account not authorized. Your account has been deactivated.";
      setAuthError(errMsg);
      throw new Error(errMsg);
    }

    const profile: UserProfile = {
      id: cred.user.uid,
      email: cred.user.email || data.email,
      displayName: data.displayName || cred.user.email?.split('@')[0],
      role: (data.role as UserRole) || 'cashier',
      active: true,
      createdAt: data.createdAt,
      lastLogin: new Date().toISOString()
    };

    if (profile.role === 'admin') {
      await bootstrapSettingsIfMissing(profile);
      await bootstrapSecurityIfMissing(profile);
    }

    setCurrentUserProfile(profile);
    return profile;
  };

  const signUpWithMasterPasscode = async (
    name: string,
    email: string,
    pass: string,
    passcode: string
  ): Promise<UserProfile> => {
    if (!auth || !db) throw new Error("Firebase Auth is not initialized");
    setAuthError(null);

    // 1. Create Auth user
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);

    // 2. Prepare user document for cashier role (enforced)
    const userDoc: UserProfile = {
      id: cred.user.uid,
      displayName: name.trim(),
      email: cred.user.email || email.trim(),
      role: 'cashier',
      active: true,
      signupCode: passcode.trim(),
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };

    // 3. Write user profile to Firestore (Firestore rules check signupCode == settings/security.passcode)
    try {
      await setDoc(doc(db, 'users', cred.user.uid), userDoc);
    } catch (err: unknown) {
      console.error("Firestore user creation rejected (invalid master passcode or permissions):", err);
      // Rollback: delete auth user and sign out
      try {
        await deleteUser(cred.user);
      } catch (delErr) {
        console.warn("Could not delete auth user during rollback:", delErr);
      }
      if (auth) {
        await firebaseSignOut(auth);
      }
      setFirebaseUser(null);
      setCurrentUserProfile(null);
      const errMsg = "Invalid master passcode.";
      setAuthError(errMsg);
      throw new Error(errMsg);
    }

    setCurrentUserProfile(userDoc);
    lastActivityRef.current = Date.now();
    return userDoc;
  };

  const sendPasswordReset = async (email: string) => {
    if (!auth) throw new Error("Firebase Auth not initialized");
    await sendPasswordResetEmail(auth, email);
  };

  const signOut = async () => {
    if (auth) {
      await firebaseSignOut(auth);
    }
    setFirebaseUser(null);
    setCurrentUserProfile(null);
  };

  const updateInactivityTimeout = useCallback((minutes: number) => {
    if (minutes > 0) {
      setTimeoutMinutes(minutes);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        currentUserProfile,
        isAuthReady,
        authError,
        setAuthError,
        signInWithEmail,
        signUpWithMasterPasscode,
        sendPasswordReset,
        signOut,
        updateInactivityTimeout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
