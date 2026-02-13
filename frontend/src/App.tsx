import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TeacherUpload from './pages/TeacherUpload';
import StudentReading from './pages/StudentReading';
import QuizInterface from './pages/QuizInterface';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [userRole, setUserRole] = React.useState<'teacher' | 'student' | null>(null);

  React.useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole') as 'teacher' | 'student';
    if (token) {
      setIsAuthenticated(true);
      setUserRole(role);
    }
  }, []);

  if (!isAuthenticated) {
    return <LoginPage onLogin={(role) => {
      setIsAuthenticated(true);
      setUserRole(role);
    }} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        {userRole === 'teacher' ? (
          <>
            <Route path="/" element={<TeacherUpload />} />
            <Route path="/analytics" element={<div>Analytics Dashboard</div>} />
          </>
        ) : (
          <>
            <Route path="/" element={<StudentReading />} />
            <Route path="/quiz/:literatureId" element={<QuizInterface />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
};

const LoginPage: React.FC<{ onLogin: (role: 'teacher' | 'student') => void }> = ({ onLogin }) => {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('userRole', data.user.role);
        onLogin(data.user.role);
      } else {
        alert(data.error || 'Login failed');
      }
    } catch (error) {
      alert('Login error: ' + error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{
        background: 'white',
        padding: '3rem',
        borderRadius: '1rem',
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
        width: '400px'
      }}>
        <h1 style={{ marginBottom: '2rem', textAlign: 'center', color: '#333' }}>
          📚 IncludEd Literature
        </h1>
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e2e8f0',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
              placeholder="your.email@example.com"
            />
          </div>
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '2px solid #e2e8f0',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '1rem',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p style={{ marginTop: '1.5rem', textAlign: 'center', color: '#666', fontSize: '0.875rem' }}>
          Demo: teacher@included.rw / Teacher123!<br />
          Or: student@included.rw / Student123!
        </p>
      </div>
    </div>
  );
};

export default App;