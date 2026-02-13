import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Users, BookOpen, TrendingUp, BarChart3 } from 'lucide-react';
import axios from 'axios';

interface Literature {
  id: string;
  title: string;
  author: string;
  wordCount: number;
  questionsGenerated: number;
  createdAt: string;
}

const TeacherDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [literature, setLiterature] = useState<Literature[]>([]);
  const [stats, setStats] = useState({
    totalLiterature: 0,
    totalStudents: 0,
    totalQuestions: 0,
    avgProgress: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get('/api/literature', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setLiterature(response.data);
      
      // Calculate stats
      const totalQuestions = response.data.reduce((sum: number, lit: Literature) => 
        sum + lit.questionsGenerated, 0
      );
      
      setStats({
        totalLiterature: response.data.length,
        totalStudents: 25, // Mock data
        totalQuestions,
        avgProgress: 68 // Mock data
      });
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
          <StatCard
            icon={<BookOpen size={32} />}
            label="Total Literature"
            value={stats.totalLiterature}
            color="#667eea"
          />
          <StatCard
            icon={<Users size={32} />}
            label="Active Students"
            value={stats.totalStudents}
            color="#10b981"
          />
          <StatCard
            icon={<TrendingUp size={32} />}
            label="Questions Generated"
            value={stats.totalQuestions}
            color="#f59e0b"
          />
          <StatCard
            icon={<BarChart3 size={32} />}
            label="Avg Progress"
            value={`${stats.avgProgress}%`}
            color="#8b5cf6"
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button
            onClick={() => navigate('/upload')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 2rem',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '0.75rem',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
          >
            <Upload size={20} />
            Upload Literature
          </button>
          
          <button
            onClick={() => alert('Student management coming soon!')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 2rem',
              background: 'white',
              color: '#667eea',
              border: '2px solid #667eea',
              borderRadius: '0.75rem',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Users size={20} />
            Manage Students
          </button>
        </div>

        {/* Literature List */}
        <div style={{ background: 'white', borderRadius: '1rem', padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
            Uploaded Literature
          </h2>
          
          {literature.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
              <BookOpen size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              <p>No literature uploaded yet.</p>
              <button
                onClick={() => navigate('/upload')}
                style={{
                  marginTop: '1rem',
                  padding: '0.75rem 1.5rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Upload Your First Document
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {literature.map((lit) => (
                <div
                  key={lit.id}
                  style={{
                    padding: '1.5rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '0.75rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
                      {lit.title}
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      by {lit.author} • {lit.wordCount} words • {lit.questionsGenerated} questions
                    </p>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    {new Date(lit.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: number | string; color: string }> = 
({ icon, label, value, color }) => {
  return (
    <div style={{
      background: 'white',
      padding: '2rem',
      borderRadius: '1rem',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      display: 'flex',
      alignItems: 'center',
      gap: '1.5rem'
    }}>
      <div style={{
        background: `${color}15`,
        padding: '1rem',
        borderRadius: '0.75rem',
        color: color
      }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>
          {label}
        </p>
        <p style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b' }}>
          {value}
        </p>
      </div>
    </div>
  );
};

export default TeacherDashboard;