/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore,
  type Firestore
} from 'firebase/firestore';

export interface FirebaseConfigParams {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

/**
 * Validates and extracts Firebase credentials from environment variables.
 */
export function getFirebaseEnvConfig(): { config: Partial<FirebaseConfigParams>; missing: string[]; isConfigured: boolean } {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
  const appId = import.meta.env.VITE_FIREBASE_APP_ID;
  const firestoreDatabaseId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;

  const missing: string[] = [];
  if (!apiKey || apiKey.includes('PLACEHOLDER') || apiKey === 'AIzaSy...') missing.push('VITE_FIREBASE_API_KEY');
  if (!authDomain || authDomain.includes('your-project')) missing.push('VITE_FIREBASE_AUTH_DOMAIN');
  if (!projectId || projectId.includes('your-project') || projectId === 'remixed-project-id') missing.push('VITE_FIREBASE_PROJECT_ID');
  if (!storageBucket || storageBucket.includes('your-project')) missing.push('VITE_FIREBASE_STORAGE_BUCKET');
  if (!messagingSenderId || messagingSenderId === '123456789012') missing.push('VITE_FIREBASE_MESSAGING_SENDER_ID');
  if (!appId || appId.includes('abcdef123456')) missing.push('VITE_FIREBASE_APP_ID');
  if (!firestoreDatabaseId) missing.push('VITE_FIREBASE_FIRESTORE_DATABASE_ID');

  const isConfigured = missing.length === 0;

  return {
    config: {
      apiKey: apiKey || '',
      authDomain: authDomain || '',
      projectId: projectId || '',
      storageBucket: storageBucket || '',
      messagingSenderId: messagingSenderId || '',
      appId: appId || '',
      firestoreDatabaseId: firestoreDatabaseId || '(default)'
    },
    missing,
    isConfigured
  };
}

const envCheck = getFirebaseEnvConfig();
export const firebaseConfig = envCheck.config as FirebaseConfigParams;
export const missingFirebaseEnvVars = envCheck.missing;
export const isFirebaseConfigured = (): boolean => envCheck.isConfigured;

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

if (envCheck.isConfigured) {
  try {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApp();
    }

    const dbId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || '(default)';

    // Initialize Firestore with offline persistence
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      }, dbId);
    } catch {
      db = getFirestore(app, dbId);
    }

    auth = getAuth(app);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
  }
}

/**
 * Returns a secondary Auth instance to allow admins to create new users without signing out of their own session.
 */
export function getSecondaryAuth(): Auth {
  if (!envCheck.isConfigured) {
    throw new Error("Firebase is not configured with environment variables.");
  }
  const secondaryAppName = 'SecondaryAdminAuthApp';
  let secondaryApp = getApps().find(a => a.name === secondaryAppName);
  if (!secondaryApp) {
    secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  }
  return getAuth(secondaryApp);
}

export { app, db, auth };

/**
 * Standard Firestore Error Handler conforming to system guidelines
 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
