import React, { createContext, useState, useContext, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../config/firebase';

type Role = 'student' | 'teacher' | 'admin' | null;

interface AuthContextType {
  userRole: Role;
  firebaseUser: FirebaseUser | null;
  login: (role: Role) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Still using localStorage for UI mockup role until real backend role mapping is ready
  const [userRole, setUserRole] = useState<Role>(() => {
    return (localStorage.getItem('userRole') as Role) || null;
  });

  useEffect(() => {
    try {
      // Listen to Firebase Auth state changes
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setFirebaseUser(user);
        setLoading(false);
        // TODO: Fetch real user role from Firestore here based on user.uid
      }, (error) => {
        console.warn("Firebase Auth error (Keys might be missing):", error);
        setLoading(false); // Fallback for UI mockup without keys
      });
      return unsubscribe;
    } catch {
      // Fallback if auth initialization failed due to dummy keys
      setLoading(false);
    }
  }, []);

  const login = (role: Role) => {
    setUserRole(role);
    localStorage.setItem('userRole', role || '');
  };

  const logout = async () => {
    try {
      if (auth.app.options.apiKey !== "YOUR_API_KEY") {
        await signOut(auth);
      }
    } catch (e) {
      console.warn("Logout error:", e);
    }
    setUserRole(null);
    localStorage.removeItem('userRole');
  };

  return (
    <AuthContext.Provider value={{ userRole, firebaseUser, login, logout, loading }}>
      {!loading ? children : (
        <div className="min-h-screen flex items-center justify-center bg-surface text-text-soft font-medium">
          Loading IncludEd...
        </div>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};