import React, { useState } from 'react';
import { Upload, FileText, Users, BarChart3, TrendingUp, Clock, CheckCircle, Loader, AlertCircle, CloudUpload } from 'lucide-react';

/* ─── Mock data ─── */
const overviewStats = [
  { label: 'Active Students', value: '32', change: '+4 this week', icon: Users, color: 'text-sky', bg: 'bg-sky-light', border: 'border-sky/20' },
  { label: 'Materials', value: '18', change: '3 processing', icon: FileText, color: 'text-grape', bg: 'bg-grape-light', border: 'border-grape/20' },
  { label: 'Avg. Score', value: '78%', change: '+5% vs last month', icon: TrendingUp, color: 'text-mint', bg: 'bg-mint-light', border: 'border-mint/20' },
  { label: 'Total Sessions', value: '1,247', change: '+89 this week', icon: Clock, color: 'text-sunny-dark', bg: 'bg-sunny-light', border: 'border-sunny/20' },
];

const recentUploads = [
  { name: 'Romeo & Juliet - Act 1.pdf', status: 'published', date: 'Feb 18, 2026', students: 28 },
  { name: 'The Little Prince - Ch 1-5.pdf', status: 'adapted', date: 'Feb 17, 2026', students: 15 },
  { name: 'Le Petit Nicolas.pdf', status: 'processing', date: 'Feb 19, 2026', students: 0 },
  { name: 'Charlotte\'s Web - Full.pdf', status: 'published', date: 'Feb 15, 2026', students: 32 },
];

const statusConfig = {
  published: { icon: CheckCircle, color: 'text-mint', bg: 'bg-mint-light', label: 'Published' },
  adapted: { icon: AlertCircle, color: 'text-sky', bg: 'bg-sky-light', label: 'Adapted' },
  processing: { icon: Loader, color: 'text-sunny-dark', bg: 'bg-sunny-light', label: 'Processing' },
};

/* ─── Mini performance chart ─── */
const MiniChart: React.FC = () => {
  const data = [45, 52, 68, 72, 65, 78, 82];
  const width = 200;
  const height = 60;
  const max = Math.max(...data);

  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - (v / max) * height * 0.8 - 5,
  }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16">
      <defs>
        <linearGradient id="miniGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ECDC4" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#4ECDC4" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill="url(#miniGrad)" />
      <path d={path} fill="none" stroke="#4ECDC4" strokeWidth="2" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#4ECDC4" stroke="white" strokeWidth="1.5" />
      ))}
    </svg>
  );
};

const TeacherDashboard: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragOut = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile?.type === 'application/pdf') {
      setFile(droppedFile);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="animate-slide-up">
        <h1 className="text-2xl font-bold text-text">Teacher Dashboard</h1>
        <p className="text-sm text-text-soft">Manage your classroom and track student progress</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up delay-100" style={{ opacity: 0 }}>
        {overviewStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`bg-white rounded-xl p-5 border ${stat.border} shadow-soft hover:shadow-card transition-shadow`}>
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center`}>
                  <Icon size={20} className={stat.color} />
                </div>
              </div>
              <p className="text-2xl font-bold text-text">{stat.value}</p>
              <p className="text-xs text-text-muted mt-1">{stat.label}</p>
              <p className="text-[11px] text-mint font-medium mt-1">{stat.change}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Area */}
        <div className="lg:col-span-1 animate-slide-up delay-200" style={{ opacity: 0 }}>
          <h2 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
            <Upload size={18} className="text-grape" />
            Upload Material
          </h2>
          <div
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`
              relative bg-white rounded-2xl p-8 border-2 border-dashed
              transition-all duration-300 text-center
              ${isDragging ? 'border-sky bg-sky-light/30 scale-[1.02]' : 'border-border hover:border-sky/50'}
            `}
          >
            <div className="flex flex-col items-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all ${isDragging ? 'bg-sky/20 scale-110' : 'bg-grape-light'}`}>
                <CloudUpload size={28} className={isDragging ? 'text-sky' : 'text-grape'} />
              </div>
              <p className="text-sm font-semibold text-text mb-1">
                {file ? file.name : 'Drop your PDF here'}
              </p>
              <p className="text-xs text-text-muted mb-4">
                {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB — ready to upload` : 'or click to browse files'}
              </p>
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            {file && (
              <button className="mt-3 px-6 py-2.5 bg-gradient-to-r from-grape to-grape-dark text-white font-semibold rounded-xl hover:opacity-90 transition-opacity text-sm shadow-sm">
                Upload & Adapt PDF
              </button>
            )}
          </div>
        </div>

        {/* Recent Uploads */}
        <div className="lg:col-span-2 animate-slide-up delay-300" style={{ opacity: 0 }}>
          <h2 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
            <FileText size={18} className="text-sky" />
            Recent Materials
          </h2>
          <div className="bg-white rounded-2xl border border-border-light shadow-soft overflow-hidden">
            <div className="divide-y divide-border-light">
              {recentUploads.map((item, i) => {
                const config = statusConfig[item.status as keyof typeof statusConfig];
                const StatusIcon = config.icon;
                return (
                  <div key={i} className="flex items-center justify-between p-4 hover:bg-surface transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center flex-shrink-0">
                        <FileText size={18} className="text-text-muted" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text truncate">{item.name}</p>
                        <p className="text-xs text-text-muted">{item.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {item.students > 0 && (
                        <span className="text-xs text-text-muted hidden sm:block">
                          {item.students} students
                        </span>
                      )}
                      <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                        <StatusIcon size={12} className={item.status === 'processing' ? 'animate-spin' : ''} />
                        {config.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Class Performance Preview */}
      <div className="bg-white rounded-2xl p-6 border border-border-light shadow-soft animate-slide-up delay-400" style={{ opacity: 0 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className="text-mint" />
            <h3 className="font-semibold text-text">Class Performance Trend</h3>
          </div>
          <span className="text-xs text-text-muted">Last 7 days</span>
        </div>
        <MiniChart />
      </div>
    </div>
  );
};

export default TeacherDashboard;