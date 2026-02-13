import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Pause, Play, Settings, Palette, Type } from 'lucide-react';
import axios from 'axios';

interface AccessibilitySettings {
  fontSize: number;
  fontFamily: 'OpenDyslexic' | 'Arial' | 'Georgia';
  lineSpacing: number;
  backgroundColor: string;
  textColor: string;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  ttsEnabled: boolean;
  ttsVoice: 'en-GB' | 'en-US' | 'fr-FR';
  ttsSpeed: number;
}

interface Literature {
  id: string;
  title: string;
  author: string;
  adaptedContent: string;
  originalContent: string;
  language: 'english' | 'french';
}

const StudentReading: React.FC = () => {
  const [literature, setLiterature] = useState<Literature | null>(null);
  const [settings, setSettings] = useState<AccessibilitySettings>({
    fontSize: 18,
    fontFamily: 'OpenDyslexic',
    lineSpacing: 1.8,
    backgroundColor: '#FFF8E1',
    textColor: '#2C3E50',
    colorBlindMode: 'none',
    ttsEnabled: false,
    ttsVoice: 'en-GB',
    ttsSpeed: 1.0
  });
  const [isReading, setIsReading] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [showSettings, setShowSettings] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    fetchLiterature();
  }, []);

  const fetchLiterature = async () => {
    try {
      const response = await axios.get('/api/literature/current', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setLiterature(response.data);
    } catch (error) {
      console.error('Error fetching literature:', error);
    }
  };

  const applyColorBlindFilter = (mode: string) => {
    const filters = {
      protanopia: 'url(#protanopia)',
      deuteranopia: 'url(#deuteranopia)',
      tritanopia: 'url(#tritanopia)',
      none: 'none'
    };
    return filters[mode as keyof typeof filters] || 'none';
  };

  const speakText = () => {
    if (!literature) return;

    if (isReading) {
      speechSynthesis.cancel();
      setIsReading(false);
      setCurrentWordIndex(-1);
      return;
    }

    const words = literature.adaptedContent.split(' ');
    let index = 0;

    const speakNextWord = () => {
      if (index >= words.length) {
        setIsReading(false);
        setCurrentWordIndex(-1);
        return;
      }

      setCurrentWordIndex(index);
      const utterance = new SpeechSynthesisUtterance(words[index]);
      
      // Set voice based on selection
      const voices = speechSynthesis.getVoices();
      const selectedVoice = voices.find(voice => 
        voice.lang.startsWith(settings.ttsVoice.substring(0, 2))
      );
      if (selectedVoice) utterance.voice = selectedVoice;
      
      utterance.rate = settings.ttsSpeed;
      utterance.onend = () => {
        index++;
        speakNextWord();
      };
      
      speechSynthesis.speak(utterance);
    };

    setIsReading(true);
    speakNextWord();
  };

  if (!literature) {
    return <div style={{ padding: '2rem' }}>Loading literature...</div>;
  }

  const words = literature.adaptedContent.split(' ');

  return (
    <div style={{
      minHeight: '100vh',
      background: settings.backgroundColor,
      color: settings.textColor,
      transition: 'all 0.3s',
      filter: applyColorBlindFilter(settings.colorBlindMode)
    }}>
      {/* Color Blind SVG Filters */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <filter id="protanopia">
            <feColorMatrix type="matrix" values="0.567, 0.433, 0, 0, 0 0.558, 0.442, 0, 0, 0 0, 0.242, 0.758, 0, 0 0, 0, 0, 1, 0"/>
          </filter>
          <filter id="deuteranopia">
            <feColorMatrix type="matrix" values="0.625, 0.375, 0, 0, 0 0.7, 0.3, 0, 0, 0 0, 0.3, 0.7, 0, 0 0, 0, 0, 1, 0"/>
          </filter>
          <filter id="tritanopia">
            <feColorMatrix type="matrix" values="0.95, 0.05, 0, 0, 0 0, 0.433, 0.567, 0, 0 0, 0.475, 0.525, 0, 0 0, 0, 0, 1, 0"/>
          </filter>
        </defs>
      </svg>

      {/* Header Controls */}
      <div style={{
        padding: '1.5rem',
        background: 'rgba(255,255,255,0.95)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
            {literature.title}
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            by {literature.author}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={speakText}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            {isReading ? <Pause size={20} /> : <Play size={20} />}
            {isReading ? 'Pause' : 'Read Aloud'}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              padding: '0.75rem',
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer'
            }}
          >
            <Settings size={24} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div style={{
          position: 'fixed',
          top: '6rem',
          right: '1rem',
          width: '350px',
          background: 'white',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          zIndex: 1000
        }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Accessibility Settings</h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              <Type size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
              Font Size: {settings.fontSize}px
            </label>
            <input
              type="range"
              min="14"
              max="32"
              value={settings.fontSize}
              onChange={(e) => setSettings(s => ({ ...s, fontSize: parseInt(e.target.value) }))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Font Family
            </label>
            <select
              value={settings.fontFamily}
              onChange={(e) => setSettings(s => ({ ...s, fontFamily: e.target.value as any }))}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #cbd5e1'
              }}
            >
              <option value="OpenDyslexic">OpenDyslexic (Recommended)</option>
              <option value="Arial">Arial</option>
              <option value="Georgia">Georgia</option>
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              <Palette size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
              Color Blind Mode
            </label>
            <select
              value={settings.colorBlindMode}
              onChange={(e) => setSettings(s => ({ ...s, colorBlindMode: e.target.value as any }))}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #cbd5e1'
              }}
            >
              <option value="none">None</option>
              <option value="protanopia">Protanopia (Red-Blind)</option>
              <option value="deuteranopia">Deuteranopia (Green-Blind)</option>
              <option value="tritanopia">Tritanopia (Blue-Blind)</option>
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              <Volume2 size={16} style={{ display: 'inline', marginRight: '0.5rem' }} />
              TTS Voice
            </label>
            <select
              value={settings.ttsVoice}
              onChange={(e) => setSettings(s => ({ ...s, ttsVoice: e.target.value as any }))}
              style={{
                width: '100%',
                padding: '0.5rem',
                borderRadius: '0.375rem',
                border: '1px solid #cbd5e1'
              }}
            >
              <option value="en-GB">British English</option>
              <option value="en-US">American English</option>
              <option value="fr-FR">French</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              TTS Speed: {settings.ttsSpeed}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.ttsSpeed}
              onChange={(e) => setSettings(s => ({ ...s, ttsSpeed: parseFloat(e.target.value) }))}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}

      {/* Reading Content */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '3rem 2rem'
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          padding: '3rem',
          borderRadius: '1rem',
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
          fontSize: `${settings.fontSize}px`,
          fontFamily: settings.fontFamily,
          lineHeight: settings.lineSpacing
        }}>
          {words.map((word, index) => (
            <span
              key={index}
              style={{
                display: 'inline',
                margin: '0 4px',
                padding: '2px 4px',
                borderRadius: '3px',
                background: index === currentWordIndex ? '#ffd700' : 'transparent',
                fontWeight: index === currentWordIndex ? 700 : 400,
                transition: 'all 0.2s'
              }}
            >
              {word}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StudentReading;