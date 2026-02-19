import React, { createContext, useState, useContext } from 'react';

type Role = 'student' | 'teacher' | 'admin' | null;

interface AuthContextType {
  userRole: Role;
  login: (role: Role) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userRole, setUserRole] = useState<Role>(() => {
    return (localStorage.getItem('userRole') as Role) || null;
  });

  const login = (role: Role) => {
    setUserRole(role);
    localStorage.setItem('userRole', role || '');
  };

  const logout = () => {
    setUserRole(null);
    localStorage.removeItem('userRole');
  };

  return (
    <AuthContext.Provider value={{ userRole, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};