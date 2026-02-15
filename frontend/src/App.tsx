import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import TeacherUpload from './pages/TeacherUpload';
import StudentReading from './pages/StudentReading';
import QuizInterface from './pages/QuizInterface';
import TeacherDashboard from "./pages/TeacherUpload";

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [userRole, setUserRole] = React.useState<'teacher' | 'student' | null>(null);
  const [userInfo, setUserInfo] = React.useState<any>(null);

  React.useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole') as 'teacher' | 'student';
    const info = localStorage.getItem('userInfo');
    
    if (token && role) {
      setIsAuthenticated(true);
      setUserRole(role);
      if (info) {
        try {
          setUserInfo(JSON.parse(info));
        } catch (e) {
          // Ignore parse error
        }
      }
    }
  }, []);

  const handleLogin = (role: 'teacher' | 'student', user: any) => {
    setIsAuthenticated(true);
    setUserRole(role);
    setUserInfo(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userInfo');
    setIsAuthenticated(false);
    setUserRole(null);
    setUserInfo(null);
    window.location.href = '/';
  };

  // Placeholder for onComplete in StudentReading
  const handleStudentReadingComplete = () => {
    console.log('student reading complete!');
    // in a real app, you might navigate to the quiz here
    // e.g., navigate('/quiz/:literatureId');
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <BrowserRouter>
      <div>
        {/* Header with Logout */}
        <Header userInfo={userInfo} userRole={userRole} onLogout={handleLogout} />
        
        <Routes>
          {userRole === 'teacher' ? (
            <>
              <Route path="/" element={<TeacherDashboard />} />
              <Route path="/upload" element={<TeacherUpload />} />
            </>
          ) : (
            <>
              <Route path="/" element={<StudentReading onComplete={handleStudentReadingComplete} />} />
              <Route path="/quiz/:literatureId" element={<QuizInterface />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

// Header Component with Logout
const Header: React.FC<{ 
  userInfo: any; 
  userRole: string | null; 
  onLogout: () => void 
}> = ({ userInfo, userRole, onLogout }) => {
  return (
    <div style={{
      background: '#667eea',
      color: 'white',
      padding: '1rem 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>
          📚 IncludEd Literature
        </h1>
        <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>
          {userRole === 'teacher' ? 'Teacher Dashboard' : 'Student Portal'}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontWeight: 600 }}>
            {userInfo?.firstName} {userInfo?.lastName}
          </p>
          <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>
            {userInfo?.email}
          </p>
        </div>
        <button
          onClick={onLogout}
          style={{
            padding: '0.5rem 1.5rem',
            background: 'rgba(255,255,255,0.2)',
            border: '2px solid white',
            borderRadius: '0.5rem',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.875rem'
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

// Login Page Component
const LoginPage: React.FC<{ onLogin: (role: 'teacher' | 'student', user: any) => void }> = ({ onLogin }) => {
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
        localStorage.setItem('userInfo', JSON.stringify(data.user));
        onLogin(data.user.role, data.user);
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
          Demo Accounts:<br />
          Teacher: teacher@included.rw / Teacher123!<br />
          Student: student@included.rw / Student123!
        </p>
      </div>
    </div>
  );
};

export default App;