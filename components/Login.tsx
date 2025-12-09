import React, { useState } from 'react';
import { api } from '../services/api';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
  setLoading: (loading: boolean) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, setLoading }) => {
  const [activeTab, setActiveTab] = useState<'teacher' | 'parent'>('teacher');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [studentId, setStudentId] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = activeTab === 'teacher' ? { username, password } : { studentId, birthDate };
      const res = await api.login(activeTab, payload);
      if (res.success && res.user) {
        onLogin(res.user);
      } else {
        setError(res.message || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-pink-100 to-indigo-100 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-auto md:h-[600px]">
        {/* Left Side */}
        <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-pink-500 to-rose-400 p-12 flex-col justify-between text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-10 rounded-full -ml-10 -mb-10"></div>
          <div className="relative z-10">
            <h1 className="text-4xl font-bold mb-2">Classroom<br />Management</h1>
            <p className="text-pink-100">ระบบบริหารจัดการชั้นเรียน</p>
          </div>
          <div className="relative z-10 flex justify-center mb-6">
            <img src="/favicon.png" alt="School Icon" className="w-32 h-32 object-contain drop-shadow-xl" />
          </div>
          <div className="relative z-10 text-xs text-pink-200 text-center">&copy; 2025 School System</div>
        </div>

        {/* Right Side */}
        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-white">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-800">เข้าสู่ระบบ</h2>
            <p className="text-gray-500 text-sm mt-1">เลือกประเภทผู้ใช้งาน</p>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-xl mb-8">
            <button
              onClick={() => setActiveTab('teacher')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'teacher' ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              สำหรับครู
            </button>
            <button
              onClick={() => setActiveTab('parent')}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'parent' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              สำหรับผู้ปกครอง
            </button>
          </div>

          {activeTab === 'teacher' ? (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อผู้ใช้</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-4 pr-4 py-3 rounded-xl border border-gray-200 focus:border-pink-500 outline-none transition-colors"
                  placeholder="Username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-4 pr-4 py-3 rounded-xl border border-gray-200 focus:border-pink-500 outline-none transition-colors"
                  placeholder="Password"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-pink-200 transition-all transform hover:-translate-y-0.5"
              >
                เข้าสู่ระบบ (ครู)
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รหัสนักเรียน</label>
                <input
                  type="text"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  className="w-full pl-4 pr-4 py-3 rounded-xl border border-gray-200 focus:border-pink-500 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">วันเดือนปีเกิด (ค.ศ.)</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full pl-4 pr-4 py-3 rounded-xl border border-gray-200 focus:border-pink-500 outline-none transition-colors"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5"
              >
                เข้าสู่ระบบ (ผู้ปกครอง)
              </button>
            </form>
          )}

          <div className="text-center mt-4 text-sm text-red-500 font-bold min-h-[24px]">
            {error}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
