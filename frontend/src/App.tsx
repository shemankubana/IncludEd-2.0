import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { AccessibilityProvider } from './context/AccessibilityContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useBackgroundSync } from './hooks/useBackgroundSync';
import './App.css';

import Layout from './components/Layout';
import StudentDashboard from './components/StudentDashboard';
import StudentProgress from './components/StudentProgress';
import Achievements from './components/Achievements';
import ReadingSession from './components/ReadingSession';
import TeacherDashboard from './components/TeacherDashboard';
import TeacherAnalytics from './components/TeacherAnalytics';
import AdminDashboard from './components/AdminDashboard';

/* ─────────── Welcome / Login Screen ─────────── */
const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (role: 'student' | 'teacher' | 'admin') => {
    login(role);
    navigate(`/${role}/dashboard`);
  };

  const roles = [
    {
      role: 'student' as const,
      emoji: '🎒',
      label: 'I\'m a Student',
      desc: 'Read stories, earn badges, and track your progress!',
      colors: 'from-sunny to-sunny-dark',
      hoverBg: 'hover:shadow-[0_0_30px_rgba(255,217,61,0.4)]',
      bgLight: 'bg-sunny-light',
    },
    {
      role: 'teacher' as const,
      emoji: '📚',
      label: 'I\'m a Teacher',
      desc: 'Upload materials, monitor students, and view analytics.',
      colors: 'from-mint to-mint-dark',
      hoverBg: 'hover:shadow-[0_0_30px_rgba(78,205,196,0.4)]',
      bgLight: 'bg-mint-light',
    },
    {
      role: 'admin' as const,
      emoji: '⚙️',
      label: 'I\'m an Admin',
      desc: 'Oversee the platform, manage schools and users.',
      colors: 'from-grape to-grape-dark',
      hoverBg: 'hover:shadow-[0_0_30px_rgba(166,109,212,0.4)]',
      bgLight: 'bg-grape-light',
    },
  ];

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#f8f0ff] via-[#e8f4fd] to-[#fff8e1]">
      {/* ─── Floating decorative shapes ─── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] left-[5%] w-24 h-24 rounded-full bg-sunny/20 animate-float" />
        <div className="absolute top-[20%] right-[10%] w-32 h-32 rounded-3xl bg-sky/15 animate-float-reverse delay-200 rotate-12" />
        <div className="absolute bottom-[15%] left-[15%] w-20 h-20 rounded-2xl bg-mint/20 animate-float delay-500 rotate-45" />
        <div className="absolute bottom-[25%] right-[8%] w-28 h-28 rounded-full bg-grape/15 animate-float-slow delay-300" />
        <div className="absolute top-[50%] left-[50%] w-16 h-16 rounded-xl bg-coral/10 animate-float-reverse delay-700 -rotate-12" />
        <div className="absolute top-[5%] left-[40%] w-12 h-12 rounded-full bg-ocean/15 animate-float delay-400" />
        <div className="absolute bottom-[5%] left-[60%] w-20 h-20 rounded-3xl bg-sunny/10 animate-float-reverse delay-600 rotate-30" />
      </div>

      {/* ─── Main content ─── */}
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        {/* Logo */}
        <div className="mb-6 animate-slide-up">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-sky to-ocean shadow-lg mb-4">
            <span className="text-white text-4xl font-black">I</span>
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-5xl md:text-6xl font-black text-text mb-3 animate-slide-up delay-100" style={{ opacity: 0 }}>
          Welcome to <span className="bg-gradient-to-r from-sky via-ocean to-grape bg-clip-text text-transparent">IncludEd</span>
        </h1>
        <p className="text-xl md:text-2xl text-text-soft mb-2 animate-slide-up delay-200 font-comic" style={{ opacity: 0 }}>
          Ready to Learn Something Amazing? ✨
        </p>
        <p className="text-base text-text-muted mb-12 animate-slide-up delay-300" style={{ opacity: 0 }}>
          An inclusive platform where every learner belongs
        </p>

        {/* Role cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {roles.map((r, i) => (
            <button
              key={r.role}
              onClick={() => handleLogin(r.role)}
              className={`
                group relative bg-white rounded-2xl p-8 border-2 border-border-light
                shadow-card cursor-pointer
                transition-all duration-300 ease-out
                hover:-translate-y-2 hover:border-transparent ${r.hoverBg}
                animate-slide-up
              `}
              style={{ opacity: 0, animationDelay: `${300 + i * 150}ms` }}
            >
              {/* Emoji avatar */}
              <div className={`w-20 h-20 ${r.bgLight} rounded-2xl flex items-center justify-center text-5xl mx-auto mb-5 group-hover:scale-110 transition-transform duration-300`}>
                {r.emoji}
              </div>

              {/* Label */}
              <h3 className="text-xl font-bold text-text mb-2 font-comic">{r.label}</h3>
              <p className="text-sm text-text-soft leading-relaxed">{r.desc}</p>

              {/* Hover gradient bar */}
              <div className={`absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl bg-gradient-to-r ${r.colors} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
            </button>
          ))}
        </div>

        {/* Footer note */}
        <p className="mt-12 text-sm text-text-muted animate-fade-in delay-800" style={{ opacity: 0 }}>
          🌍 Designed for learners with dyslexia, ADHD, and all abilities
        </p>
      </div>
    </div>
  );
};

/* ─────────── Main App Wrapper ─────────── */
function AppContent() {
  useBackgroundSync();

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route element={<Layout />}>
        {/* Student Routes */}
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/student/library" element={<StudentDashboard />} />
        <Route path="/student/progress" element={<StudentProgress />} />
        <Route path="/student/achievements" element={<Achievements />} />
        <Route path="/student/read/:literatureId" element={<ReadingSession />} />

        {/* Teacher Routes */}
        <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
        <Route path="/teacher/upload" element={<TeacherDashboard />} />
        <Route path="/teacher/analytics" element={<TeacherAnalytics />} />
        <Route path="/teacher/materials" element={<TeacherDashboard />} />

        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/schools" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminDashboard />} />
        <Route path="/admin/settings" element={<AdminDashboard />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AccessibilityProvider>
        <Router>
          <AppContent />
        </Router>
      </AccessibilityProvider>
    </AuthProvider>
  );
}