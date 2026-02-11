import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { User, UserRole } from '../types';
import ErrorBoundary from './ErrorBoundary';
import logo from '../assets/logo.png';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
  schoolSettings?: { schoolName: string; academicYear: string; semester: string };
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout, children, schoolSettings }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  const isActive = (path: string) => {
    // Exact match or sub-paths
    if (path === '/') return location.pathname === '/' || location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  const NavItem = ({ path, icon, label }: { path: string; icon: string; label: string }) => (
    <Link
      to={path}
      onClick={() => {
        if (window.innerWidth < 1024) setSidebarOpen(false);
      }}
      className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-2 font-medium ${isActive(path)
        ? 'bg-pink-100 text-pink-600'
        : 'text-gray-500 hover:bg-pink-50 hover:text-pink-500'
        }`}
    >
      <i className={`${icon} w-5 text-center`}></i>
      <span>{label}</span>
    </Link>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar Overlay for Mobile */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-20 lg:hidden backdrop-blur-sm"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 z-30 w-72 h-screen bg-white border-r border-gray-100 shadow-sm flex flex-col transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
      >
        <div className="p-6 pb-2">
          <div className="flex items-center gap-3 mb-8">
            <img src={logo} alt="Logo" className="w-12 h-12 object-contain shrink-0 drop-shadow-sm" />
            <div>
              <h1 className="font-bold text-lg leading-tight text-gray-800">Classroom<br />Management</h1>
              {schoolSettings && (
                <div className="text-xs text-gray-400 mt-1">
                  {schoolSettings.schoolName} <br />
                  ปีการศึกษา {schoolSettings.academicYear}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 mb-6 px-2">
            <img
              src={user.avatar?.startsWith('http') ? user.avatar : `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.avatar || user.username}`}
              alt="Avatar"
              className="w-10 h-10 rounded-full border border-gray-200 bg-gray-50"
            />
            <div>
              <div className="font-bold text-sm text-gray-800 truncate max-w-[140px]">{user.name}</div>
              <div className="text-xs text-gray-400 capitalize">{user.role}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 overflow-y-auto scrollbar-hide">
          {user.role === 'teacher' ? (
            <>
              <NavItem path="/" icon="fa-solid fa-border-all" label="แดชบอร์ด" />
              <NavItem path="/attendance" icon="fa-solid fa-clipboard-check" label="เช็คชื่อ" />
              <NavItem path="/history" icon="fa-solid fa-clock-rotate-left" label="ประวัติการเช็คชื่อ" />
              <NavItem path="/grading" icon="fa-solid fa-graduation-cap" label="การมอบหมายงาน" />
              <NavItem path="/manage-class" icon="fa-solid fa-chalkboard-user" label="จัดการห้องเรียน" />
              <NavItem path="/manage-students" icon="fa-solid fa-users" label="นักเรียน" />
              <NavItem path="/settings" icon="fa-solid fa-gear" label="ตั้งค่า" />
            </>
          ) : (
            <NavItem path="/parent-dashboard" icon="fa-solid fa-child-reaching" label="ข้อมูลบุตรหลาน" />
          )}
        </nav>

        <div className="p-4 border-t border-gray-50">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
          >
            <div className="w-8 h-8 bg-gray-800 rounded-full text-white flex items-center justify-center text-xs">LOG</div>
            <span className="font-medium">ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen relative">
        <header className="bg-white p-4 flex items-center gap-4 lg:hidden shadow-sm z-10 sticky top-0">
          <button onClick={toggleSidebar} className="text-gray-600 hover:text-pink-500 focus:outline-none">
            <i className="fa-solid fa-bars text-xl"></i>
          </button>
          <div className="flex items-center gap-2">
            <img src={logo} alt="Logo" className="w-8 h-8 object-contain" />
            <span className="font-bold text-lg">Classroom</span>
          </div>
        </header>

        <div className="flex-1 p-4 md:p-8">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
};

export default Layout;



