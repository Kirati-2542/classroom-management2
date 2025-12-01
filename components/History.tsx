
import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { Classroom } from '../types';

interface HistoryProps {
  setLoading: (l: boolean) => void;
}

const History: React.FC<HistoryProps> = ({ setLoading }) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [historyData, setHistoryData] = useState<{ dates: string[], students: any[] } | null>(null);

  // Edit State
  const [activeCell, setActiveCell] = useState<{ studentIndex: number, dateIndex: number, x: number, y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getClassrooms().then(setClassrooms);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveCell(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClassChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const classId = e.target.value;
    setSelectedClassId(classId);
    if (classId) {
      setLoading(true);
      try {
        const data = await api.getAttendanceHistory(classId);
        setHistoryData(data);
      } finally {
        setLoading(false);
      }
    } else {
      setHistoryData(null);
    }
  };

  const calculateStats = (statuses: string[]) => {
    const stats = { present: 0, late: 0, absent: 0, sick: 0, leave: 0 };
    statuses.forEach(s => {
      if (s === 'present') stats.present++;
      else if (s === 'late') stats.late++;
      else if (s === 'absent') stats.absent++;
      else if (s === 'sick') stats.sick++;
      else if (s === 'leave') stats.leave++;
    });
    return stats;
  };

  const handleDownload = () => {
    if (!historyData || !selectedClassId) {
      alert("กรุณาเลือกห้องเรียนก่อนดาวน์โหลด");
      return;
    }

    const { dates, students } = historyData;

    // Headers
    const headers = [
      "No",
      "Student ID",
      "Name",
      ...dates,
      "Present",
      "Absent",
      "Late",
      "Sick",
      "Leave"
    ];

    // Rows
    const rows = students.map((s, index) => {
      const stats = calculateStats(s.statuses);
      return [
        index + 1,
        s.id,
        s.name,
        ...s.statuses,
        stats.present,
        stats.absent,
        stats.late,
        stats.sick,
        stats.leave
      ];
    });

    // Combine
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(c => `"${c}"`).join(","))
    ].join("\n");

    // Download with BOM for Excel UTF-8 support
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const className = classrooms.find(c => c.id === selectedClassId)?.name || "attendance";
    link.setAttribute("download", `attendance_history_${className}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCellClick = (e: React.MouseEvent, studentIndex: number, dateIndex: number) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setActiveCell({
      studentIndex,
      dateIndex,
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY
    });
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!activeCell || !historyData) return;
    const { studentIndex, dateIndex } = activeCell;
    const student = historyData.students[studentIndex];

    // Optimistic Update
    const updatedStudents = [...historyData.students];
    updatedStudents[studentIndex].statuses[dateIndex] = newStatus;
    setHistoryData({ ...historyData, students: updatedStudents });
    setActiveCell(null);

    try {
      await api.updateAttendanceHistory(selectedClassId, student.id, dateIndex, newStatus);
    } catch (error) {
      console.error("Failed to update status", error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <i className="fa-solid fa-check text-emerald-500"></i>;
      case 'absent': return <i className="fa-solid fa-xmark text-red-500"></i>;
      case 'late': return <i className="fa-regular fa-clock text-orange-400"></i>;
      case 'sick': return <i className="fa-solid fa-bed text-purple-500"></i>;
      case 'leave': return <i className="fa-regular fa-file-lines text-blue-500"></i>;
      default: return <span className="text-gray-300">-</span>;
    }
  };

  return (
    <div className="animate-fadeIn relative">
      <div className="bg-gradient-to-r from-pink-500 to-rose-400 rounded-3xl p-8 text-white shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <i className="fa-solid fa-clock-rotate-left opacity-80"></i> ประวัติการเช็คชื่อ
            </h2>
            <p className="text-pink-100 mt-1 text-sm">แสดง แก้ไข และดาวน์โหลดข้อมูลการเข้าเรียนย้อนหลัง</p>
          </div>
        </div>
        <div className="relative z-10 flex flex-wrap items-center gap-3 mt-6">
          <select className="bg-white/90 border-none text-sm rounded-lg px-4 py-2 font-medium text-gray-700 cursor-pointer outline-none">
            <option>ปีการศึกษา 2568</option>
          </select>
          <select className="bg-white/90 border-none text-sm rounded-lg px-4 py-2 font-medium text-gray-700 cursor-pointer outline-none">
            <option>ภาคเรียนที่ 2</option>
          </select>
          <select
            value={selectedClassId}
            onChange={handleClassChange}
            className="bg-white/90 border-none text-sm rounded-lg px-4 py-2 font-medium text-gray-700 cursor-pointer outline-none"
          >
            <option value="">เลือกห้องเรียน</option>
            {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            onClick={handleDownload}
            className="bg-white/20 border border-white/40 text-white rounded-lg px-4 py-2 text-sm transition-all hover:bg-white/30 flex items-center gap-2"
          >
            <i className="fa-solid fa-download"></i> ดาวน์โหลด
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden p-4">
        <div className="overflow-x-auto pb-12">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 border-b text-left text-sm font-bold text-gray-600 min-w-[150px] sticky left-0 bg-gray-50 z-20">ชื่อ-สกุล</th>
                {historyData?.dates.map((d, i) => (
                  <th key={i} className="p-2 border-b vertical-text h-24 text-xs font-medium text-gray-500 w-8">{d}</th>
                ))}
                {/* Summary Headers */}
                <th className="p-2 border-b h-24 vertical-text text-xs font-bold text-emerald-600 bg-emerald-50/50 w-10">มา</th>
                <th className="p-2 border-b h-24 vertical-text text-xs font-bold text-red-600 bg-red-50/50 w-10">ขาด</th>
                <th className="p-2 border-b h-24 vertical-text text-xs font-bold text-orange-500 bg-orange-50/50 w-10">สาย</th>
                <th className="p-2 border-b h-24 vertical-text text-xs font-bold text-purple-600 bg-purple-50/50 w-10">ป่วย</th>
                <th className="p-2 border-b h-24 vertical-text text-xs font-bold text-blue-600 bg-blue-50/50 w-10">ลา</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {historyData ? historyData.students.map((s, idx) => {
                const stats = calculateStats(s.statuses);
                return (
                  <tr key={idx} className="hover:bg-gray-50/50">
                    <td className="p-3 font-medium text-sm text-gray-800 sticky left-0 bg-white border-r z-10 whitespace-nowrap">{s.name}</td>
                    {s.statuses.map((st: string, dateIdx: number) => (
                      <td
                        key={dateIdx}
                        onClick={(e) => handleCellClick(e, idx, dateIdx)}
                        className="p-2 text-center text-xs cursor-pointer hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center justify-center h-full w-full">
                          {getStatusIcon(st)}
                        </div>
                      </td>
                    ))}
                    {/* Summary Columns */}
                    <td className="p-2 text-center text-sm font-bold text-emerald-600 bg-emerald-50/30 border-l border-emerald-50">{stats.present}</td>
                    <td className="p-2 text-center text-sm font-bold text-red-600 bg-red-50/30 border-l border-red-50">{stats.absent}</td>
                    <td className="p-2 text-center text-sm font-bold text-orange-500 bg-orange-50/30 border-l border-orange-50">{stats.late}</td>
                    <td className="p-2 text-center text-sm font-bold text-purple-600 bg-purple-50/30 border-l border-purple-50">{stats.sick}</td>
                    <td className="p-2 text-center text-sm font-bold text-blue-600 bg-blue-50/30 border-l border-blue-50">{stats.leave}</td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={10} className="p-8 text-center text-gray-400">กรุณาเลือกห้องเรียน</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Status Menu */}
      {activeCell && (
        <div
          ref={menuRef}
          className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-100 py-1 w-32 animate-fadeIn flex flex-col"
          style={{ top: activeCell.y + 5, left: Math.min(activeCell.x - 64, window.innerWidth - 150) }}
        >
          <button onClick={() => handleStatusUpdate('present')} className="px-4 py-2 text-left hover:bg-emerald-50 text-sm flex items-center gap-3 text-gray-700">
            <div className="w-5 h-5 rounded flex items-center justify-center text-emerald-500"><i className="fa-solid fa-check"></i></div> มา
          </button>
          <button onClick={() => handleStatusUpdate('late')} className="px-4 py-2 text-left hover:bg-orange-50 text-sm flex items-center gap-3 text-gray-700">
            <div className="w-5 h-5 rounded flex items-center justify-center text-orange-400"><i className="fa-regular fa-clock"></i></div> สาย
          </button>
          <button onClick={() => handleStatusUpdate('absent')} className="px-4 py-2 text-left hover:bg-red-50 text-sm flex items-center gap-3 text-gray-700">
            <div className="w-5 h-5 rounded flex items-center justify-center text-red-500"><i className="fa-solid fa-xmark"></i></div> ขาด
          </button>
          <button onClick={() => handleStatusUpdate('sick')} className="px-4 py-2 text-left hover:bg-purple-50 text-sm flex items-center gap-3 text-gray-700">
            <div className="w-5 h-5 rounded flex items-center justify-center text-purple-500"><i className="fa-solid fa-bed"></i></div> ป่วย
          </button>
          <button onClick={() => handleStatusUpdate('leave')} className="px-4 py-2 text-left hover:bg-blue-50 text-sm flex items-center gap-3 text-gray-700">
            <div className="w-5 h-5 rounded flex items-center justify-center text-blue-500"><i className="fa-regular fa-file-lines"></i></div> ลา
          </button>
        </div>
      )}
    </div>
  );
};

export default History;
