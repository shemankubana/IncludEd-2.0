import React, { useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import axios from 'axios';

const TeacherDashboard: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // Assuming backend is running locally for now
      await axios.post('http://localhost:5000/api/literature/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('File uploaded successfully! The AI is processing it.');
      setFile(null);
    } catch (error) {
      console.error('Upload failed', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Teacher Dashboard</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mb-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <Upload className="mr-2" /> Upload New Literature
        </h2>
        <form onSubmit={handleUpload} className="flex flex-col space-y-4">
          <input 
            type="file" 
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="border p-2 rounded"
          />
          <button 
            type="submit" 
            disabled={!file || uploading}
            className="bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {uploading ? 'Processing AI Adaptation...' : 'Upload & Adapt PDF'}
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <FileText className="mr-2" /> Class Materials
        </h2>
        <p className="text-gray-500 italic">No materials processed yet.</p>
      </div>
    </div>
  );
};

export default TeacherDashboard;