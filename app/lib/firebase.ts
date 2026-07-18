'use client';
// Firebase client-side singleton. Comparte el mismo Firebase project que
// Lafayette Market, Rudewear y Toolhome (lafayette-market-d64ff). Las
// colecciones van prefijadas `notaryjose_*` para no chocar con las de
// los otros subs.
//
// Init directo (no Proxy) — Firestore SDK hace instanceof checks
// internos sobre el argument de collection() y otros; un Proxy los
// rompe. Guard con apiKey check para que el build no crashee si algún
// prerender corre sin env vars inyectados.

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app: FirebaseApp | null = firebaseConfig.apiKey
  ? (getApps()[0] ?? initializeApp(firebaseConfig))
  : null;

/* eslint-disable @typescript-eslint/no-explicit-any */
export const auth: Auth = (app ? getAuth(app) : null) as any;
export const db: Firestore = (app ? getFirestore(app) : null) as any;
export const storage: FirebaseStorage = (app ? getStorage(app) : null) as any;
/* eslint-enable @typescript-eslint/no-explicit-any */
