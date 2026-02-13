import React, { useState } from 'react';
import axios from 'axios';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface DisabilityProfile {
  disabilities: string[];
  severity: { [key: string]: number };
  preferences: {
    font_size: number;
    tts_enabled: boolean;
    color_blind_mode: string;
  };
}

const StudentOnboarding: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<DisabilityProfile>({
    disabilities: [],
    severity: {},
    preferences: {
      font_size: 18,
      tts_enabled: false,
      color_blind_mode: 'none'
    }
  });

  const disabilities = [
    { id: 'dyslexia', name: 'Dyslexia', description: 'Difficulty reading words' },
    { id: 'adhd', name: 'ADHD', description: 'Trouble focusing for long periods' },
    { id: 'visual_impairment', name: 'Visual Impairment', description: 'Difficulty seeing text' },
    { id: 'color_blindness', name: 'Color Blindness', description: 'Difficulty distinguishing colors' },
    { id: 'none', name: 'None of the above', description: 'I don\'t have these challenges' }
  ];

  const toggleDisability = (id: string) => {
    if (id === 'none') {
      setProfile(p => ({ ...p, disabilities: ['none'] }));
    } else {
      setProfile(p => ({
        ...p,
        disabilities: p.disabilities.includes(id)
          ? p.disabilities.filter(d => d !== id && d !== 'none')
          : [...p.disabilities.filter(d => d !== 'none'), id]
      }));
    }
  };

  const setSeverity = (disability: string, value: number) => {
    setProfile(p => ({
      ...p,
      severity: { ...p.severity, [disability]: value }
    }));
  };

  const saveProfile = async () => {
    try {
      await axios.post('/api/users/profile', profile, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      onComplete();
    } catch (error) {
      alert('Error saving profile');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '1rem',
        padding: '3rem',
        maxWidth: '600px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '1rem', textAlign: 'center' }}>
          📚 Let's Personalize Your Learning
        </h1>
        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '2rem' }}>
          Help us understand how to best support your reading journey
        </p>

        {step === 1 && (
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
              Do you experience any of these challenges?
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
              (Select all that apply - your information is private)
            </p>

            <div style={{ display: 'grid', gap: '1rem' }}>
              {disabilities.map(disability => (
                <button
                  key={disability.id}
                  onClick={() => toggleDisability(disability.id)}
                  style={{
                    padding: '1.5rem',
                    border: `3px solid ${profile.disabilities.includes(disability.id) ? '#667eea' : '#e2e8f0'}`,
                    borderRadius: '0.75rem',
                    background: profile.disabilities.includes(disability.id) ? '#f0f4ff' : 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'start', gap: '1rem' }}>
                    {profile.disabilities.includes(disability.id) ? (
                      <CheckCircle size={24} style={{ color: '#667eea', flexShrink: 0 }} />
                    ) : (
                      <div style={{
                        width: 24,
                        height: 24,
                        border: '2px solid #cbd5e1',
                        borderRadius: '50%',
                        flexShrink: 0
                      }} />
                    )}
                    <div>
                      <h3 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                        {disability.name}
                      </h3>
                      <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        {disability.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={profile.disabilities.length === 0}
              style={{
                marginTop: '2rem',
                width: '100%',
                padding: '1rem',
                background: profile.disabilities.length > 0 ? '#667eea' : '#cbd5e1',
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: profile.disabilities.length > 0 ? 'pointer' : 'not-allowed'
              }}
            >
              Next: Preferences →
            </button>
          </div>
        )}

        {step === 2 && !profile.disabilities.includes('none') && (
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
              How severe are these challenges for you?
            </h2>

            {profile.disabilities.map(disability => (
              <div key={disability} style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                  {disabilities.find(d => d.id === disability)?.name}
                </label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Mild</span>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={profile.severity[disability] || 3}
                    onChange={(e) => setSeverity(disability, parseInt(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Severe</span>
                  <span style={{
                    background: '#f1f5f9',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    fontWeight: 600,
                    minWidth: '2rem',
                    textAlign: 'center'
                  }}>
                    {profile.severity[disability] || 3}
                  </span>
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1,
                  padding: '1rem',
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                style={{
                  flex: 1,
                  padding: '1rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Next: Preferences →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>
              Initial Preferences
            </h2>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
                Text Size
              </label>
              <input
                type="range"
                min="14"
                max="32"
                value={profile.preferences.font_size}
                onChange={(e) => setProfile(p => ({
                  ...p,
                  preferences: { ...p.preferences, font_size: parseInt(e.target.value) }
                }))}
                style={{ width: '100%' }}
              />
              <p style={{ fontSize: `${profile.preferences.font_size}px`, marginTop: '0.5rem' }}>
                Sample text at {profile.preferences.font_size}px
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={profile.preferences.tts_enabled}
                  onChange={(e) => setProfile(p => ({
                    ...p,
                    preferences: { ...p.preferences, tts_enabled: e.target.checked }
                  }))}
                  style={{ width: 20, height: 20 }}
                />
                <span style={{ fontWeight: 600 }}>
                  Enable Text-to-Speech (read text aloud)
                </span>
              </label>
            </div>

            <div style={{
              padding: '1rem',
              background: '#f0f9ff',
              borderRadius: '0.5rem',
              marginBottom: '1.5rem',
              display: 'flex',
              gap: '0.75rem'
            }}>
              <AlertCircle size={20} style={{ color: '#0ea5e9', flexShrink: 0 }} />
              <p style={{ fontSize: '0.875rem', color: '#0c4a6e' }}>
                Don't worry! You can change all these settings anytime while reading.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  flex: 1,
                  padding: '1rem',
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                ← Back
              </button>
              <button
                onClick={saveProfile}
                style={{
                  flex: 1,
                  padding: '1rem',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Start Learning! ✨
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentOnboarding;