import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LogOut, Menu, X, Home, BookOpen, TrendingUp, Award,
  Upload, BarChart3, Users, School, Settings, FileText, ChevronLeft
} from 'lucide-react';
import { useState } from 'react';

const studentMenu = [
  { label: 'Dashboard', icon: Home, path: '/student/dashboard' },
  { label: 'My Library', icon: BookOpen, path: '/student/library' },
  { label: 'My Progress', icon: TrendingUp, path: '/student/progress' },
  { label: 'Achievements', icon: Award, path: '/student/achievements' },
];

const teacherMenu = [
  { label: 'Dashboard', icon: Home, path: '/teacher/dashboard' },
  { label: 'Upload Material', icon: Upload, path: '/teacher/upload' },
  { label: 'Analytics', icon: BarChart3, path: '/teacher/analytics' },
  { label: 'Class Materials', icon: FileText, path: '/teacher/materials' },
];

const adminMenu = [
  { label: 'Overview', icon: Home, path: '/admin/dashboard' },
  { label: 'Schools', icon: School, path: '/admin/schools' },
  { label: 'Users', icon: Users, path: '/admin/users' },
  { label: 'Settings', icon: Settings, path: '/admin/settings' },
];

const roleConfig = {
  student: { menu: studentMenu, color: 'bg-sunny', accent: '#FFD93D', label: '🎒 Student', gradient: 'from-sunny/20 to-sunny-light' },
  teacher: { menu: teacherMenu, color: 'bg-mint', accent: '#4ECDC4', label: '📚 Teacher', gradient: 'from-mint/20 to-mint-light' },
  admin: { menu: adminMenu, color: 'bg-grape', accent: '#A66DD4', label: '⚙️ Admin', gradient: 'from-grape/20 to-grape-light' },
};

const Layout: React.FC = () => {
  const { userRole, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const config = roleConfig[userRole as keyof typeof roleConfig] || roleConfig.student;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen flex bg-surface">
      {/* ─── Mobile overlay ─── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden animate-fade-in"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ─── Sidebar ─── */}
      <aside
        className={`
          fixed md:sticky top-0 left-0 h-screen z-50
          bg-white border-r border-border
          flex flex-col
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-64' : 'w-20'}
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Logo area */}
        <div className="p-4 flex items-center justify-between border-b border-border-light">
          <Link to={`/${userRole}/dashboard`} className="flex items-center gap-3 no-underline">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky to-ocean flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0">
              I
            </div>
            {sidebarOpen && (
              <span className="font-bold text-xl text-text tracking-tight animate-fade-in">
                Includ<span className="text-sky">Ed</span>
              </span>
            )}
          </Link>
          {/* Collapse button — desktop only */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-surface transition-colors text-text-soft"
          >
            <ChevronLeft size={18} className={`transition-transform duration-300 ${!sidebarOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Role badge */}
        <div className={`mx-3 mt-4 mb-2 px-3 py-2 rounded-xl bg-gradient-to-r ${config.gradient} ${sidebarOpen ? '' : 'flex justify-center'}`}>
          {sidebarOpen ? (
            <span className="text-sm font-semibold text-text">{config.label}</span>
          ) : (
            <span className="text-lg">{config.label.split(' ')[0]}</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {config.menu.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl no-underline
                  transition-all duration-200
                  ${active
                    ? 'bg-sky/10 text-sky-dark font-semibold shadow-sm'
                    : 'text-text-soft hover:bg-surface hover:text-text'
                  }
                  ${!sidebarOpen ? 'justify-center' : ''}
                `}
              >
                <Icon size={20} className={`flex-shrink-0 ${active ? 'text-sky' : ''}`} />
                {sidebarOpen && <span className="text-sm">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-3 border-t border-border-light">
          <button
            onClick={handleLogout}
            className={`
              flex items-center gap-3 w-full px-3 py-2.5 rounded-xl
              text-text-soft hover:text-coral hover:bg-coral-light/30
              transition-all duration-200
              ${!sidebarOpen ? 'justify-center' : ''}
            `}
          >
            <LogOut size={20} className="flex-shrink-0" />
            {sidebarOpen && <span className="text-sm font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* ─── Main content area ─── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-border-light px-6 py-3 flex items-center justify-between">
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-surface transition-colors text-text-soft"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          {/* Page breadcrumb */}
          <div className="hidden md:flex items-center gap-2 text-sm text-text-soft">
            <span className="capitalize">{userRole}</span>
            <span>›</span>
            <span className="text-text font-medium">
              {config.menu.find(m => isActive(m.path))?.label || 'Dashboard'}
            </span>
          </div>

          {/* User area */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
                style={{ background: config.accent }}
              >
                {(userRole || 'U')[0].toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-text leading-tight capitalize">{userRole} User</p>
                <p className="text-xs text-text-muted leading-tight">IncludEd Platform</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;