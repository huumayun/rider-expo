import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/database';
import 'firebase/compat/storage';
import { initializeAuth } from 'firebase/auth';
// Using the explicit react-native sub-path to satisfy TypeScript/IDE if needed
// import { getReactNativePersistence } from 'firebase/auth/react-native'; 
// Actually, standard firebase/auth should work, but if your IDE complains:
// Try checking if your firebase version is up to date.
// Let's use a more robust import.
import * as authSub from 'firebase/auth';
const getRNPersistence = (authSub as any).getReactNativePersistence;
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBFCLwDXR2XPRVaY1qI-J6UQFpbtyKx0kU',
  authDomain: 'gram-bazaar-144b6.firebaseapp.com',
  databaseURL: 'https://gram-bazaar-144b6-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'gram-bazaar-144b6',
  storageBucket: 'gram-bazaar-144b6.firebasestorage.app',
  messagingSenderId: '1008765777858',
  appId: '1:1008765777858:web:122b7c65736e241220c85b',
};

// ─── Initialize App ──────────────────────────────────────────────────────────
const app = !firebase.apps.length ? firebase.initializeApp(firebaseConfig) : firebase.app();

// ─── Initialize Auth with Persistence ─────────────────────────────────────────
// This ensures the login state survives app restarts in React Native
export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getRNPersistence ? getRNPersistence(AsyncStorage) : undefined
    });
  } catch (e) {
    return firebase.auth();
  }
})() as any;

export const db = firebase.firestore();
export const rtdb = firebase.database();
export const storage = firebase.storage();

// ─── Re-export Modular Auth Functions (for compatibility) ─────────────────────
export const signInWithEmailAndPassword = (a: any, e: string, p: string) => 
  authSub.signInWithEmailAndPassword(a, e, p);

export const signOut = (a: any) => authSub.signOut(a);

export const onAuthStateChanged = (a: any, callback: any) => 
  authSub.onAuthStateChanged(a, callback);

// ─── Re-export Modular Firestore Functions ────────────────────────────────────
// Translates modular functional calls back to Compat method chaining
export const collection = (d: any, path: string) => d.collection(path);
export const where = (f: string, op: any, v: any) => ({ type: 'where', f, op, v });
export const orderBy = (f: string, d: string = 'asc') => ({ type: 'orderBy', f, d });
export const limit = (n: number) => ({ type: 'limit', n });

export const query = (ref: any, ...constraints: any[]) => {
  let q = ref;
  for (const c of constraints) {
    if (c.type === 'where') q = q.where(c.f, c.op, c.v);
    if (c.type === 'orderBy') q = q.orderBy(c.f, c.d);
    if (c.type === 'limit') q = q.limit(c.n);
  }
  return q;
};

// Helper to bridge Compat vs Modular snapshot API
const wrapSnapshot = (snap: any) => {
  if (!snap) return snap;

  return new Proxy(snap, {
    get(target, prop) {
      if (prop === 'exists') {
        // If it's a function call like exists(), return a function
        return () => !!target.exists;
      }
      
      const value = target[prop];
      
      // If the property is a function (like data()), bind it to the target
      if (typeof value === 'function') {
        return value.bind(target);
      }
      
      // For arrays like 'docs' in QuerySnapshot
      if (prop === 'docs' && Array.isArray(value)) {
        return value.map(wrapSnapshot);
      }

      return value;
    }
  });
};

export const onSnapshot = (q: any, cb: any) => q.onSnapshot((s: any) => cb(wrapSnapshot(s)));
export const getDoc = async (ref: any) => wrapSnapshot(await ref.get());
export const doc = (db: any, col: string, id: string) => db.collection(col).doc(id);

export const GOOGLE_MAPS_API_KEY = 'AIzaSyCOAksn-Wl4MHYa3WRu5kGPf_h1uLIb60U';