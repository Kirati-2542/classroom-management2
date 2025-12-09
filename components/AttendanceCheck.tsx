import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Classroom, Student } from '../types';

import { SuccessModal } from './ui/SuccessModal';

interface AttendanceCheckProps {
  classroom: Classroom;
  onBack: () => void;
  setLoading: (l: boolean) => void;
}

const AttendanceCheck: React.FC<AttendanceCheckProps> = ({ classroom, onBack, setLoading }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSubject, setSelectedSubject] = useState(classroom.subjects?.[0] || 'General'); // Default to first or 'General'
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getStudentsByClass(classroom.id)
      .then(data => {
        setStudents(data);
        // Initialize attendance to 'present'
        const initialStatus: Record<string, string> = {};
        data.forEach(s => initialStatus[s.id] = 'present');
        setAttendance(initialStatus);
      })
      .finally(() => setLoading(false));
  }, [classroom.id, setLoading]);

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const submitAttendance = async () => {
    setLoading(true);
    await api.submitAttendance(classroom.id, date, attendance, selectedSubject);
    setLoading(false);
    setShowSuccessModal(true);
  };

  return (
    <div className="animate-fadeIn">
      <div className="bg-gradient-to-r from-pink-500 to-rose-400 rounded-3xl p-6 text-white shadow-lg mb-6 flex flex-col md:flex-row justify-between items-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl backdrop-blur-sm">
            {classroom.emoji}
          </div>
          <div>
            <h2 className="text-3xl font-bold">{classroom.name}</h2>
            <div className="flex flex-wrap gap-2 mt-1">
              {classroom.subjects?.map(sub => (
                <button
                  key={sub}
                  onClick={() => setSelectedSubject(sub)}
                  className={`px-3 py-1 rounded-full text-xs transition-all border ${selectedSubject === sub
                      ? 'bg-white text-pink-600 font-bold border-white'
                      : 'bg-white/20 text-white hover:bg-white/30 border-transparent'
                    }`}
                >
                  {sub}
                </button>
              ))}
            </div>
            {/* Show Current Subject Context */}
            <div className="mt-2 text-sm text-pink-100 font-medium bg-pink-600/20 inline-block px-3 py-1 rounded-lg">
              กำลังเช็คชื่อวิชา: {selectedSubject}
            </div>
          </div>
        </div>
        <div className="relative z-10 text-right">
          <label className="block text-xs text-pink-100 mb-1 font-medium">เลือกวันที่เช็คชื่อ</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-white/90 border-none text-sm rounded-lg px-4 py-2 font-medium text-gray-700 cursor-pointer outline-none focus:ring-2 focus:ring-pink-300"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-6">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-500">
            <i className="fa-regular fa-circle-check"></i>
          </div>
          <h3 className="text-lg font-bold text-gray-800">รายชื่อนักเรียน</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">รหัส</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">ชื่อ-สกุล</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-500 w-[400px]">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map(s => (
                <tr key={s.id} className="hover:bg-pink-50/30 transition-colors">
                  <td className="px-4 py-4 text-sm text-gray-600">{s.id}</td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-800">{s.name}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="bg-gray-100 rounded-full p-1 inline-flex w-full max-w-md">
                      {['present', 'absent', 'late', 'sick', 'leave'].map(status => (
                        <label key={status} className="flex-1 cursor-pointer">
                          <input
                            type="radio"
                            name={`status_${s.id}`}
                            value={status}
                            className="hidden peer"
                            checked={attendance[s.id] === status}
                            onChange={() => handleStatusChange(s.id, status)}
                          />
                          <span className={`block py-1.5 rounded-full text-xs text-center transition-all ${attendance[s.id] === status
                            ? (status === 'present' ? 'bg-emerald-500 text-white' :
                              status === 'absent' ? 'bg-red-500 text-white' :
                                status === 'late' ? 'bg-orange-400 text-white' : 'bg-blue-500 text-white')
                            : 'text-gray-500 hover:bg-gray-200'
                            }`}>
                            {status === 'present' ? 'มา' :
                              status === 'absent' ? 'ขาด' :
                                status === 'late' ? 'สาย' :
                                  status === 'sick' ? 'ป่วย' : 'ลา'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-gray-400">ไม่พบนักเรียนในห้องเรียนนี้</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-8">
          <button
            onClick={submitAttendance}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-lg font-bold py-3 rounded-xl shadow-md shadow-emerald-200 transition-all"
          >
            บันทึกการเช็คชื่อ
          </button>
        </div>
      </div>

      <button onClick={onBack} className="mt-4 text-gray-400 hover:text-gray-600 text-sm flex items-center gap-2">
        <i className="fa-solid fa-arrow-left"></i> ย้อนกลับไปหน้ารวมห้องเรียน
      </button>

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          // onBack(); // Optional: Go back after success
        }}
        message="บันทึกการเช็คชื่อเรียบร้อยแล้ว"
      />
    </div>
  );
};

export default AttendanceCheck;
