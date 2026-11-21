import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo-project.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:123456789:web:abcdef',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Desarrollo local: NEXT_PUBLIC_USE_EMULATORS=true conecta Auth y Firestore a los
// emuladores (ver firebase.emulator.json). El guard evita reconectar en cada HMR.
// Doble guard: además del flag, nunca en un build de producción.
export const USING_EMULATORS =
  process.env.NEXT_PUBLIC_USE_EMULATORS === 'true' && process.env.NODE_ENV !== 'production';

if (USING_EMULATORS && typeof window !== 'undefined') {
  const w = window as unknown as { __unoEmulatorsConnected?: boolean };
  if (!w.__unoEmulatorsConnected) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    w.__unoEmulatorsConnected = true;
  }
}
