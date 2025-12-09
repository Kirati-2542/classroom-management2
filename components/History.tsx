
import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { Classroom } from '../types';
import { SuccessModal } from './ui/SuccessModal';

import { ConfirmModal } from './ui/ConfirmModal';
import { normalizeDate, formatDisplayDate } from '../utils/dateUtils';

interface HistoryProps {
  setLoading: (l: boolean) => void;
}

const History: React.FC<HistoryProps> = ({ setLoading }) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [historyData, setHistoryData] = useState<{ dates: string[], students: any[] } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('บันทึกข้อมูลเรียบร้อยแล้ว');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');

  // Delete Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [dateToDelete, setDateToDelete] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit State
  const [activeCell, setActiveCell] = useState<{ studentIndex: number, dateIndex: number, x: number, y: number } | null>(null);

  // Pending updates for batch save
  const [pendingUpdates, setPendingUpdates] = useState<{ studentId: string, dateIndex: number, status: string, date: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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

    // Default to first subject of new class
    const cls = classrooms.find(c => c.id === classId);
    const defaultSubject = cls?.subjects?.[0] || 'General';
    setSelectedSubject(defaultSubject);

    if (classId) {
      setLoading(true);
      try {
        const data = await api.getAttendanceHistory(classId, defaultSubject);
        setHistoryData(data);
        setPendingUpdates([]); // Clear pending when reloading
      } finally {
        setLoading(false);
      }
    } else {
      setHistoryData(null);
    }
  };

  const handleSubjectChange = async (subject: string) => {
    setSelectedSubject(subject);
    if (selectedClassId) {
      setLoading(true);
      try {
        const data = await api.getAttendanceHistory(selectedClassId, subject);
        setHistoryData(data);
        setPendingUpdates([]); // Clear pending when reloading
      } finally {
        setLoading(false);
      }
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



  const handleImportClick = () => {
    if (!selectedClassId) {
      setSuccessMessage("กรุณาเลือกห้องเรียนก่อนนำเข้าข้อมูล");
      setModalType('error');
      setShowSuccessModal(true);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);

    const readFile = (f: File, encoding: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = (e) => reject(e);
        reader.readAsText(f, encoding);
      });
    };

    try {
      let text = await readFile(file, 'UTF-8');
      if (text.includes('\uFFFD')) {
        text = await readFile(file, 'TIS-620');
      }

      const lines = text.split(/\r\n|\n/);
      const parseLine = (line: string) => {
        const result = [];
        let current = '';
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') { inQuote = !inQuote; }
          else if (char === ',' && !inQuote) { result.push(current); current = ''; }
          else { current += char; }
        }
        result.push(current);
        return result.map(s => s.trim());
      };

      const headers = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());

      // Identify Date Columns
      const fixedCols = ["No", "Student ID", "Name", "Present", "Absent", "Late", "Sick", "Leave", "มา", "ขาด", "สาย", "ป่วย", "ลา"];
      const dateCols = headers.map((h, i) => ({ name: h, index: i }))
        .filter(h => !fixedCols.includes(h.name) && h.index > 2);

      const updatesByDate: Record<string, Record<string, string>> = {};

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = parseLine(lines[i]);
        const studentId = cols[1]?.replace(/^"|"$/g, ''); // Index 1 is Student ID

        if (studentId) {
          dateCols.forEach(dc => {
            const rawStatus = cols[dc.index]?.replace(/^"|"$/g, '').trim().toLowerCase();
            if (rawStatus) {
              let status = '';
              if (['present', 'มา', '1', '/', 'check', 'p', 'true'].includes(rawStatus)) status = 'present';
              else if (['absent', 'ขาด', '0', 'x', 'a', 'false'].includes(rawStatus)) status = 'absent';
              else if (['late', 'สาย', 'l'].includes(rawStatus)) status = 'late';
              else if (['sick', 'ป่วย', 's'].includes(rawStatus)) status = 'sick';
              else if (['leave', 'ลา'].includes(rawStatus)) status = 'leave';

              if (status) {
                const normalizedDate = normalizeDate(dc.name);
                if (!updatesByDate[normalizedDate]) updatesByDate[normalizedDate] = {};
                updatesByDate[normalizedDate][studentId] = status;
              }
            }
          });
        }
      }

      // Submit updates
      for (const [date, data] of Object.entries(updatesByDate)) {
        await api.submitAttendance(selectedClassId, date, data, selectedSubject);
      }

      // Refresh
      const data = await api.getAttendanceHistory(selectedClassId);
      setHistoryData(data);
      setSuccessMessage('นำเข้าข้อมูลการเช็คชื่อเรียบร้อยแล้ว');
      setModalType('success');
      setShowSuccessModal(true);

    } catch (err) {
      console.error(err);
      setSuccessMessage("เกิดข้อผิดพลาดในการนำเข้าไฟล์ CSV");
      setModalType('error');
      setShowSuccessModal(true);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportCSV = () => {
    if (!historyData || !selectedClassId) {
      setSuccessMessage("กรุณาเลือกห้องเรียนก่อนดาวน์โหลด");
      setModalType('error');
      setShowSuccessModal(true);
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

  const handleDeleteClick = (date: string) => {
    setDateToDelete(date);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedClassId || !dateToDelete) return;
    setLoading(true);
    try {
      await api.deleteAttendanceDate(selectedClassId, dateToDelete);
      // Refresh
      const data = await api.getAttendanceHistory(selectedClassId);
      setSuccessMessage(`ลบข้อมูลวันที่ ${dateToDelete} เรียบร้อยแล้ว`);
      setModalType('success');
      setShowSuccessModal(true);
    } catch (err) {
      console.error(err);
      setSuccessMessage("เกิดข้อผิดพลาดในการลบข้อมูล");
      setModalType('error');
      setShowSuccessModal(true);
    } finally {
      setLoading(false);
      setDeleteModalOpen(false);
      setDateToDelete(null);
    }
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

  const handleStatusUpdate = async (status: string) => {
    if (!activeCell || !historyData) return;
    const { studentIndex, dateIndex } = activeCell;
    const student = historyData.students[studentIndex];
    const date = historyData.dates[dateIndex];

    // Optimistic update locally
    const newData = { ...historyData };
    // Create shallow copy of students array and the specific student object to avoid mutation
    newData.students = [...historyData.students];
    newData.students[studentIndex] = {
      ...newData.students[studentIndex],
      statuses: [...newData.students[studentIndex].statuses]
    };
    newData.students[studentIndex].statuses[dateIndex] = status;
    setHistoryData(newData);

    // Add to pending updates
    setPendingUpdates(prev => {
      // Remove existing update for same cell if any
      const filtered = prev.filter(p => !(p.studentId === student.id && p.dateIndex === dateIndex));
      return [...filtered, { studentId: student.id, dateIndex, status, date }];
    });

    setActiveCell(null);
  };

  const handleSaveChanges = async () => {
    if (pendingUpdates.length === 0) return;

    setIsSaving(true);
    try {
      // Convert pending updates to API format
      const updates = pendingUpdates.map(p => ({
        classId: selectedClassId,
        studentId: p.studentId,
        date: p.date,
        status: p.status,
        subject: selectedSubject
      }));

      await api.updateAttendanceHistoryBatch(updates);

      setPendingUpdates([]);
      setSuccessMessage('บันทึกข้อมูลเรียบร้อยแล้ว');
      setModalType('success');
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error saving changes:', error);
      setSuccessMessage('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      setModalType('error');
      setShowSuccessModal(true);
    } finally {
      setIsSaving(false);
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
          {/* Subject Tabs */}
          {selectedClassId && (
            <div className="flex bg-white/20 rounded-lg p-1 gap-1">
              {classrooms.find(c => c.id === selectedClassId)?.subjects?.map(sub => (
                <button
                  key={sub}
                  onClick={() => handleSubjectChange(sub)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${selectedSubject === sub
                    ? 'bg-white text-pink-600 shadow-sm'
                    : 'text-white hover:bg-white/10'
                    }`}
                >
                  {sub}
                </button>
              ))}
              {/* Fallback if no subjects */}
              {(!classrooms.find(c => c.id === selectedClassId)?.subjects?.length) && (
                <span className="px-3 py-1.5 text-sm text-white opacity-80">ไม่มีวิชา</span>
              )}
            </div>
          )}
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={handleImportClick}
            className="bg-pink-400/20 hover:bg-pink-400/30 border border-pink-200/50 text-white rounded-xl px-4 py-2 text-sm transition-all flex items-center gap-2 backdrop-blur-sm"
          >
            <i className="fa-solid fa-file-import"></i> นำเข้า CSV
          </button>
          <button
            onClick={handleExportCSV}
            className="bg-pink-400/20 hover:bg-pink-400/30 border border-pink-200/50 text-white rounded-xl px-4 py-2 text-sm transition-all flex items-center gap-2 backdrop-blur-sm"
          >
            <i className="fa-solid fa-file-export"></i> ส่งออก CSV
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
                  <th key={i} className="p-2 border-b vertical-text h-24 text-xs font-medium text-gray-500 w-8 group relative">
                    {formatDisplayDate(d)}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteClick(d); }}
                      className="absolute -top-1 left-1/2 -translate-x-1/2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      title="ลบวันนี้"
                    >
                      <i className="fa-solid fa-trash-can text-xs rotate-180"></i>
                    </button>
                  </th>
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
                        className={`p-2 text-center text-xs cursor-pointer transition-colors relative
                                    ${pendingUpdates.some(p => p.studentId === s.id && p.dateIndex === dateIdx) ? 'bg-yellow-50 shadow-inner' : 'hover:bg-gray-100'}
                                  `}
                      >
                        {/* Changed indicator */}
                        {pendingUpdates.some(p => p.studentId === s.id && p.dateIndex === dateIdx) && (
                          <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>
                        )}
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

      {/* Save Button */}
      {pendingUpdates.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-bounce-in">
          <button
            onClick={handleSaveChanges}
            disabled={isSaving}
            className={`shadow-lg shadow-pink-200 bg-pink-500 hover:bg-pink-600 text-white px-8 py-3 rounded-full font-bold text-lg flex items-center gap-3 transition-all transform hover:scale-105 ${isSaving ? 'opacity-75 cursor-not-allowed' : ''}`}
          >
            {isSaving ? (
              <><i className="fa-solid fa-circle-notch fa-spin"></i> กำลังบันทึก...</>
            ) : (
              <><i className="fa-solid fa-save"></i> บันทึกการเปลี่ยนแปลง ({pendingUpdates.length})</>
            )}
          </button>
        </div>
      )}

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

      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={modalType === 'success' ? 'บันทึกเรียบร้อย' : 'ข้อผิดพลาด'}
        message={successMessage}
        type={modalType}
      />

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="ยืนยันการลบ"
        message={`คุณต้องการลบข้อมูลการเช็คชื่อของวันที่ ${dateToDelete ? formatDisplayDate(dateToDelete) : ''} หรือไม่?`}
        confirmText="ลบข้อมูล"
        cancelText="ยกเลิก"
      />
    </div>
  );
};

export default History;
