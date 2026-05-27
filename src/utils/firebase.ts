/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, collection, onSnapshot, setDoc, deleteDoc, getDoc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Initialize Firestore targeting the specific provisioned Firestore Database Instance ID
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

/**
 * Handle Auth State subscription and trigger automatic anonymous sign-in
 * to allow secure reading/writing under firestore.rules rulesets.
 */
export function initializeAuthSync(onUserReady: (user: User) => void, onLocalFallback?: (err?: any) => void) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      onUserReady(user);
    } else {
      try {
        const credential = await signInAnonymously(auth);
        if (credential.user) {
          onUserReady(credential.user);
        }
      } catch (error: any) {
        if (error && error.code === 'auth/admin-restricted-operation') {
          console.warn(
            "===========================================================\n" +
            "📢 Firebase Anonymous Authentication is disabled:\n" +
            "  - To enable real-time database synchronization:\n" +
            "    1. Open the Firebase Console.\n" +
            "    2. Go to 'Authentication' -> 'Sign-in method'.\n" +
            "    3. Click 'Add new provider' and choose 'Anonymous'.\n" +
            "    4. Enable it and press 'Save'.\n" +
            "  - Reverting automatically to highly secure offline local storage mode.\n" +
            "==========================================================="
          );
        } else {
          console.warn("Firebase auto-anonymous sign-in has bypassed or failed gracefully:", error);
        }
        if (onLocalFallback) {
          onLocalFallback(error);
        }
      }
    }
  });
}

/**
 * Error categorizer wrapper following the SDK specification standard
 * for precise diagnostic capture.
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
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Insufficient Permissions or Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Check connectivity on startup
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration on offline status.");
    }
  }
}

testConnection();
