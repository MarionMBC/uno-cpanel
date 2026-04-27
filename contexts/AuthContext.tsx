'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

const ALLOWED_EMAILS = ['melchisedec.bustamante@gmail.com'];

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u && !ALLOWED_EMAILS.includes(u.email || '')) {
        signOut(auth);
        setUser(null);
      } else {
        setUser(u);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    setAuthError('');
    const result = await signInWithPopup(auth, googleProvider);
    if (!ALLOWED_EMAILS.includes(result.user.email || '')) {
      await signOut(auth);
      setAuthError('Tu cuenta no tiene acceso a este sistema. Contacta al administrador.');
      throw new Error('Acceso denegado');
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setAuthError('');
    if (!ALLOWED_EMAILS.includes(email)) {
      setAuthError('Tu cuenta no tiene acceso a este sistema. Contacta al administrador.');
      throw new Error('Acceso denegado');
    }
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, authError, signInWithGoogle, signInWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
