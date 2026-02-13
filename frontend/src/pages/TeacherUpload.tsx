import React, { useState, useCallback } from 'react';
import { Upload, FileText, Loader, Check, X } from 'lucide-react';
import axios from 'axios';

interface UploadedFile {
  id: string;
  title: string;
  author: string;
  language: 'english' | 'french';
  status: 'processing' | 'ready' | 'error';
  wordCount: number;
  questionsGenerated: number;
}

const TeacherUpload: React.FC = () => {
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    await uploadFiles(droppedFiles);
  }, []);

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await uploadFiles(Array.from(e.target.files));
    }
  };

  const uploadFiles = async (filesToUpload: File[]) => {
    setUploading(true);

    for (const file of filesToUpload) {
      if (file.type !== 'application/pdf') {
        alert(`${file.name} is not a PDF. Only PDFs are supported.`);
        continue;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name.replace('.pdf', ''));
      formData.append('author', 'Unknown'); // Would be filled by teacher
      formData.append('language', 'english');

      try {
        const response = await axios.post('/api/literature/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / (progressEvent.total || 1)
            );
            console.log(`Upload progress: ${percentCompleted}%`);
          }
        });

        setFiles(prev => [...prev, response.data]);
      } catch (error) {
        console.error('Upload error:', error);
        alert(`Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
            📚 Upload Literature Resources
          </h1>
          <p style={{ color: '#64748b' }}>
            Upload PDF files of novels, plays, and poetry. The AI will adapt the content for students with learning differences.
          </p>
        </header>

        {/* Upload Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          style={{
            border: `3px dashed ${dragActive ? '#667eea' : '#cbd5e1'}`,
            borderRadius: '1rem',
            padding: '4rem 2rem',
            textAlign: 'center',
            background: dragActive ? '#f1f5f9' : 'white',
            marginBottom: '3rem',
            cursor: 'pointer',
            transition: 'all 0.3s'
          }}
        >
          <Upload size={48} style={{ margin: '0 auto 1rem', color: '#667eea' }} />
          <h3 style={{ marginBottom: '0.5rem', fontSize: '1.25rem' }}>
            Drag & Drop PDF Files Here
          </h3>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
            or click to browse your computer
          </p>
          <input
            type="file"
            multiple
            accept=".pdf"
            onChange={handleFileInput}
            style={{ display: 'none' }}
            id="fileInput"
          />
          <label
            htmlFor="fileInput"
            style={{
              display: 'inline-block',
              padding: '0.75rem 2rem',
              background: '#667eea',
              color: 'white',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Select PDF Files
          </label>
          <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#94a3b8' }}>
            Supported: Romeo & Juliet, Hamlet, Macbeth, novels, poetry collections
          </p>
        </div>

        {/* Uploaded Files List */}
        {files.length > 0 && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '1.5rem' }}>
              Uploaded Literature ({files.length})
            </h2>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {files.map((file) => (
                <div
                  key={file.id}
                  style={{
                    background: 'white',
                    padding: '1.5rem',
                    borderRadius: '0.75rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}
                >
                  <FileText size={40} style={{ color: '#667eea', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                      {file.title}
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      {file.author} • {file.language} • {file.wordCount.toLocaleString()} words
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {file.status === 'processing' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b' }}>
                        <Loader size={20} className="spin" />
                        <span>Processing...</span>
                      </div>
                    )}
                    {file.status === 'ready' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981' }}>
                        <Check size={20} />
                        <span>{file.questionsGenerated} questions generated</span>
                      </div>
                    )}
                    {file.status === 'error' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
                        <X size={20} />
                        <span>Processing failed</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {uploading && (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#667eea' }}>
            <Loader size={32} className="spin" style={{ margin: '0 auto 1rem' }} />
            <p>Uploading and processing files...</p>
          </div>
        )}
      </div>

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default TeacherUpload;