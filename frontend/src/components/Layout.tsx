import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Settings } from 'lucide-react';
import { useAccessibility } from '../context/AccessibilityContext';

const Layout: React.FC = () => {
  const { userRole, logout } = useAuth();
  const { settings, updateSettings } = useAccessibility();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="p-4 bg-blue-600 text-white flex justify-between items-center shadow-md">
        <Link to={`/${userRole}/dashboard`} className="text-2xl font-bold tracking-wider">
          IncludEd
        </Link>
        
        {userRole && (
          <div className="flex items-center space-x-6">
            <span className="capitalize font-medium">Role: {userRole}</span>
            
            {/* Quick Accessibility Toggle for Students */}
            {userRole === 'student' && (
              <button 
                onClick={() => updateSettings({ highContrast: !settings.highContrast })}
                className="flex items-center space-x-2 bg-blue-700 px-3 py-1 rounded hover:bg-blue-800"
              >
                <Settings size={18} />
                <span>Toggle Contrast</span>
              </button>
            )}

            <button onClick={handleLogout} className="flex items-center space-x-1 hover:text-blue-200">
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        )}
      </nav>

      <main className="flex-grow p-6">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;