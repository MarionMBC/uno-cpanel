'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, googleProvider, db } from '@/lib/firebase';
import { AppUser } from '@/types';

const SUPER_ADMIN_EMAIL = 'melchisedec.bustamante@gmail.com';

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  authError: string;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u && u.email) {
        // Look up user in Firestore
        const userDoc = await getDoc(doc(db, 'users', u.email));
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as AppUser;
          if (userData.status === 'activo') {
            setUser(u);
            setAppUser({ ...userData, uid: u.uid });
            setLoading(false);
            return;
          }
        } else if (u.email === SUPER_ADMIN_EMAIL) {
           // Fallback if superadmin document is missing but they logged in
           setUser(u);
           setAppUser({
             email: SUPER_ADMIN_EMAIL,
             name: 'SuperAdmin',
             roleId: 'admin',
             status: 'activo',
             uid: u.uid
           });
           setLoading(false);
           return;
        }

        // If not found or inactive, reject
        await signOut(auth);
        setUser(null);
        setAppUser(null);
      } else {
        setUser(null);
        setAppUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    setAuthError('');
    const result = await signInWithPopup(auth, googleProvider);
    if (!result.user.email) {
      await signOut(auth);
      setAuthError('Error: no se pudo obtener el correo.');
      throw new Error('Sin correo');
    }

    const userDoc = await getDoc(doc(db, 'users', result.user.email));
    if (!userDoc.exists() && result.user.email !== SUPER_ADMIN_EMAIL) {
      await signOut(auth);
      setAuthError('Tu cuenta no tiene acceso a este sistema. Contacta al administrador.');
      throw new Error('Acceso denegado');
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setAuthError('');
    const userDoc = await getDoc(doc(db, 'users', email));
    
    if (!userDoc.exists() && email !== SUPER_ADMIN_EMAIL) {
      setAuthError('Tu cuenta no tiene acceso a este sistema. Contacta al administrador.');
      throw new Error('Acceso denegado');
    }
    
    if (userDoc.exists()) {
       const data = userDoc.data() as AppUser;
       if (data.status === 'inactivo') {
         setAuthError('Tu cuenta ha sido desactivada. Contacta al administrador.');
         throw new Error('Cuenta inactiva');
       }
    }

    const { signInWithEmailAndPassword } = await import('firebase/auth');
    await signInWithEmailAndPassword(auth, email, password);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, appUser, loading, authError, signInWithGoogle, signInWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
