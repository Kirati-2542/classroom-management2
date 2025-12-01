import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Classroom } from '../types';

interface AttendanceProps {
  onSelectClass: (cls: Classroom) => void;
  onAddClass: () => void;
  setLoading: (l: boolean) => void;
}

const Attendance: React.FC<AttendanceProps> = ({ onSelectClass, onAddClass, setLoading }) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);

  useEffect(() => {
    setLoading(true);
    api.getClassrooms()
      .then(setClassrooms)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [setLoading]);

  return (
    <div className="animate-fadeIn">
      <div className="bg-gradient-to-r from-pink-500 to-rose-400 rounded-3xl p-8 text-white shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
        <div className="relative z-10">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <i className="fa-solid fa-school-circle-check opacity-80"></i> ห้องเรียนทั้งหมด
          </h2>
          <p className="text-pink-100 mt-1 text-sm">จัดการและเข้าดูห้องเรียนของคุณเพื่อเช็คชื่อนักเรียน</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classrooms.map((c) => (
          <div
            key={c.id}
            onClick={() => onSelectClass(c)}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md cursor-pointer transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-3xl shadow-sm group-hover:scale-110 transition-transform">
                {c.emoji}
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-1">{c.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{c.level} · {c.subject}</p>
            <div className="flex items-center text-xs text-gray-400 font-medium bg-gray-50 w-fit px-3 py-1 rounded-full">
              <i className="fa-solid fa-user-group mr-2"></i> นักเรียน {c.studentCount} คน
            </div>
          </div>
        ))}

        <div
          onClick={onAddClass}
          className="border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center text-gray-400 hover:border-pink-300 hover:text-pink-500 hover:bg-pink-50/30 transition-all cursor-pointer h-full min-h-[180px]"
        >
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3 group-hover:bg-white">
            <i className="fa-solid fa-plus text-lg"></i>
          </div>
          <span className="font-medium text-sm">เพิ่มห้องเรียนใหม่</span>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
