import React, { createContext, useState, useContext, useEffect } from 'react';

type AccessibilitySettings = {
  fontFamily: string;
  fontSize: string;
  letterSpacing: string;
  highContrast: boolean;
};

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (newSettings: Partial<AccessibilitySettings>) => void;
}

const defaultSettings: AccessibilitySettings = {
  fontFamily: 'font-sans',
  fontSize: 'text-base',
  letterSpacing: 'tracking-normal',
  highContrast: false,
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    const saved = localStorage.getItem('a11y-settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('a11y-settings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (newSettings: Partial<AccessibilitySettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  return (
    <AccessibilityContext.Provider value={{ settings, updateSettings }}>
      <div className={`${settings.fontFamily} ${settings.fontSize} ${settings.letterSpacing} ${settings.highContrast ? 'bg-black text-yellow-400' : 'bg-white text-gray-900'} min-h-screen`}>
        {children}
      </div>
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) throw new Error('useAccessibility must be used within AccessibilityProvider');
  return context;
};