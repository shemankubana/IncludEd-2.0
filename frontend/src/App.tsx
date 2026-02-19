import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { AccessibilityProvider } from './context/AccessibilityContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useBackgroundSync } from './hooks/useBackgroundSync';

import Layout from './components/Layout';
import StudentDashboard from './components/StudentDashboard';
import ReadingSession from './components/ReadingSession';
import TeacherDashboard from './components/TeacherDashboard';
import AdminDashboard from './components/AdminDashboard';

// Simple Login Screen for Demonstration
const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = (role: 'student' | 'teacher' | 'admin') => {
    login(role);
    navigate(`/${role}/dashboard`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <h1 className="text-5xl font-bold text-blue-600 mb-8">Welcome to IncludEd</h1>
      <p className="mb-8 text-gray-600 text-lg">Select your role to continue:</p>
      <div className="space-x-4">
        <button onClick={() => handleLogin('student')} className="px-6 py-3 bg-yellow-400 text-yellow-900 font-bold rounded-lg hover:bg-yellow-500 shadow">Student</button>
        <button onClick={() => handleLogin('teacher')} className="px-6 py-3 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600 shadow">Teacher</button>
        <button onClick={() => handleLogin('admin')} className="px-6 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 shadow">Admin</button>
      </div>
    </div>
  );
};

// Main App Wrapper
function AppContent() {
  useBackgroundSync(); // Activates offline syncing globally

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route element={<Layout />}>
        {/* Student Routes */}
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/student/read/:literatureId" element={<ReadingSession />} />
        
        {/* Teacher Routes */}
        <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
        
        {/* Admin Routes */}
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
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