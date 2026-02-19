import React from 'react';
import { BarChart3, Users, School } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">System Analytics Overview</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-100 p-6 rounded-lg flex items-center shadow">
          <Users size={40} className="text-blue-600 mr-4" />
          <div>
            <p className="text-gray-600 font-semibold">Total Students</p>
            <p className="text-3xl font-bold text-blue-900">1,245</p>
          </div>
        </div>
        <div className="bg-green-100 p-6 rounded-lg flex items-center shadow">
          <School size={40} className="text-green-600 mr-4" />
          <div>
            <p className="text-gray-600 font-semibold">Active Schools</p>
            <p className="text-3xl font-bold text-green-900">12</p>
          </div>
        </div>
        <div className="bg-purple-100 p-6 rounded-lg flex items-center shadow">
          <BarChart3 size={40} className="text-purple-600 mr-4" />
          <div>
            <p className="text-gray-600 font-semibold">Reading Sessions</p>
            <p className="text-3xl font-bold text-purple-900">8,932</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;