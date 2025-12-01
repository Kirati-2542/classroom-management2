
import React, { useState } from 'react';
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
import { User, Classroom, Student } from './types';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);

  const [schoolSettings, setSchoolSettings] = useState({ schoolName: '', academicYear: '', semester: '' });

  React.useEffect(() => {
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
    setCurrentPage(loggedInUser.role === 'teacher' ? 'dashboard' : 'parent-dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage('dashboard');
    setSelectedClassroom(null);
    setViewingStudent(null);
  };

  if (!user) {
    return (
      <>
        {loading && <LoadingOverlay />}
        <Login onLogin={handleLogin} setLoading={setLoading} />
      </>
    );
  }

  const renderContent = () => {
    if (user.role === 'parent') {
      return <ParentDashboard user={user} />;
    }

    // Special Check for Student Summary View
    if (currentPage === 'student-summary' && viewingStudent) {
      return (
        <ParentDashboard
          student={viewingStudent}
          onBack={() => {
            setViewingStudent(null);
            setCurrentPage('manage-students');
          }}
        />
      );
    }

    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'attendance':
        if (selectedClassroom) {
          return (
            <AttendanceCheck
              classroom={selectedClassroom}
              onBack={() => setSelectedClassroom(null)}
              setLoading={setLoading}
            />
          );
        }
        return (
          <Attendance
            onSelectClass={setSelectedClassroom}
            onAddClass={() => setCurrentPage('manage-class')}
            setLoading={setLoading}
          />
        );
      case 'history':
        return <History setLoading={setLoading} />;
      case 'manage-class':
        return <ManageClassrooms setLoading={setLoading} />;
      case 'grading':
        return <Grading setLoading={setLoading} />;
      case 'manage-students':
        return <ManageStudents
          setLoading={setLoading}
          onViewSummary={(s) => {
            setViewingStudent(s);
            setCurrentPage('student-summary');
          }}
        />;
      case 'settings':
        return <Settings user={user} setUser={setUser} setLoading={setLoading} schoolSettings={schoolSettings} setSchoolSettings={setSchoolSettings} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <>
      {loading && <LoadingOverlay />}
      <Layout user={user} onLogout={handleLogout} currentPage={currentPage} setPage={setCurrentPage} schoolSettings={schoolSettings}>
        {renderContent()}
      </Layout>
    </>
  );
};

export default App;
