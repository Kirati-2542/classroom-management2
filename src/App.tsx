
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Attendance from './components/Attendance';
import AttendanceCheck from './components/AttendanceCheck';
import History from './components/History';
import ManageClassrooms from './components/ManageClassrooms';
import ManageStudents from './components/ManageStudents';
import Grading from './components/Grading';
import Settings from './components/Settings';
import ParentDashboard from './components/ParentDashboard';
import { LoadingOverlay } from './components/ui/LoadingOverlay';
import { User } from './types';

const SESSION_KEY = 'classroom_management_session';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [schoolSettings, setSchoolSettings] = useState({ schoolName: '', academicYear: '', semester: '' });

  // Note: useNavigate must be used inside BrowserRouter. 
  // Since App is not yet inside BrowserRouter in index.tsx (we assume we will wrap it),
  // we might get an error if we try to use useNavigate at top level here if App is the root.
  // But typically we wrap <App> in index.tsx.

  // Load session from localStorage on mount
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(SESSION_KEY);
      if (savedSession) {
        const sessionData = JSON.parse(savedSession);
        if (sessionData.user) {
          setUser(sessionData.user);
        }
      }
    } catch (e) {
      console.error('Failed to load session:', e);
      localStorage.removeItem(SESSION_KEY);
    }
    setSessionLoaded(true);
  }, []);

  // Save session to localStorage when user changes
  useEffect(() => {
    if (!sessionLoaded) return;

    if (user) {
      const sessionData = {
        user,
        // currentPage is managed by router now
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [user, sessionLoaded]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await import('./services/api').then(m => m.api.getSettings());
        setSchoolSettings(settings);
      } catch (e) {
        console.error("Failed to fetch settings", e);
      }
    };
    fetchSettings();
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
    // Navigation to dashboard will happen automatically via protected routes or we can enforce it
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  // Show loading while checking session
  if (!sessionLoaded) {
    return <LoadingOverlay />;
  }

  // Not strictly necessary if we rely on Routes, but good for simple auth guard
  if (!user) {
    return (
      <>
        {loading && <LoadingOverlay />}
        {/* If we are not logged in, we render Login. 
            Ideally Login should be a route too, but for simplicity we can just render it. 
            Or to support deep linking to login, we should use Routes.
        */}
        <Routes>
          <Route path="*" element={<Login onLogin={handleLogin} setLoading={setLoading} />} />
        </Routes>
      </>
    );
  }

  // Protected Routes
  return (
    <>
      {loading && <LoadingOverlay />}
      <Layout user={user} onLogout={handleLogout} schoolSettings={schoolSettings}>
        <Routes>
          {user.role === 'teacher' ? (
            <>
              <Route path="/" element={<Dashboard />} />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />

              <Route path="/attendance" element={<Attendance setLoading={setLoading} />} />
              <Route path="/attendance/:classId" element={<AttendanceCheck setLoading={setLoading} />} />

              <Route path="/history" element={<History setLoading={setLoading} />} />
              <Route path="/grading" element={<Grading setLoading={setLoading} />} />
              <Route path="/manage-class" element={<ManageClassrooms setLoading={setLoading} />} />

              <Route path="/manage-students" element={<ManageStudents setLoading={setLoading} />} />
              <Route path="/students/:studentId" element={<ParentDashboard onBack={() => window.history.back()} />} />

              <Route path="/settings" element={<Settings user={user} setUser={setUser} setLoading={setLoading} schoolSettings={schoolSettings} setSchoolSettings={setSchoolSettings} />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/parent-dashboard" element={<ParentDashboard user={user} />} />
              {/* Fallback for parent */}
              <Route path="*" element={<Navigate to="/parent-dashboard" replace />} />
            </>
          )}
        </Routes>
      </Layout>
    </>
  );
};

export default App;
