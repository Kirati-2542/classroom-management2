
import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { Classroom, Assignment, Student, Grade } from '../types';

interface GradingProps {
  setLoading: (l: boolean) => void;
}

const Grading: React.FC<GradingProps> = ({ setLoading }) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');

  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newMaxScore, setNewMaxScore] = useState(10);
  const [newDueDate, setNewDueDate] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial Data Load
  useEffect(() => {
    api.getClassrooms().then(setClassrooms);
  }, []);

  // Fetch Class Data
  const fetchClassData = async (classId: string) => {
    if (!classId) return;
    setLoading(true);
    try {
      const [sts, asgs, grds] = await Promise.all([
        api.getStudentsByClass(classId),
        api.getAssignments(classId),
        api.getGrades(classId)
      ]);
      setStudents(sts);
      setAssignments(asgs);
      setGrades(grds);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cid = e.target.value;
    setSelectedClassId(cid);
    if (cid) {
      fetchClassData(cid);
    } else {
      setStudents([]);
      setAssignments([]);
      setGrades([]);
    }
  };

  // Open Modals
  const openAddModal = () => {
    setEditingAssignmentId(null);
    setNewTitle('');
    setNewMaxScore(10);
    setNewDueDate('');
    setIsModalOpen(true);
  };

  const openEditModal = (a: Assignment) => {
    setEditingAssignmentId(a.id);
    setNewTitle(a.title);
    setNewMaxScore(a.maxScore);
    setNewDueDate(a.dueDate);
    setIsModalOpen(true);
  };

  // Submit Form (Add or Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClassId) return;
    setLoading(true);
    try {
      if (editingAssignmentId) {
        // Update existing
        await api.updateAssignment(editingAssignmentId, {
          title: newTitle,
          maxScore: Number(newMaxScore),
          dueDate: newDueDate
        });
      } else {
        // Create new
        await api.addAssignment({
          classId: selectedClassId,
          title: newTitle,
          maxScore: Number(newMaxScore),
          dueDate: newDueDate
        });
      }

      await fetchClassData(selectedClassId);
      setIsModalOpen(false);
      // Reset form
      setNewTitle('');
      setNewMaxScore(10);
      setNewDueDate('');
      setEditingAssignmentId(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm("ต้องการลบงานนี้ใช่หรือไม่? คะแนนทั้งหมดจะหายไป")) return;
    setLoading(true);
    await api.deleteAssignment(id);
    await fetchClassData(selectedClassId);
    setLoading(false);
  }

  // Handle Grade Change (Direct Input)
  const handleGradeChange = async (studentId: string, assignmentId: string, value: string) => {
    const numValue = value === '' ? -1 : Number(value);

    // Optimistic Update
    setGrades(prev => {
      const existing = prev.find(g => g.studentId === studentId && g.assignmentId === assignmentId);
      if (existing) {
        return prev.map(g => g.studentId === studentId && g.assignmentId === assignmentId ? { ...g, score: numValue } : g);
      } else {
        return [...prev, { studentId, assignmentId, score: numValue }];
      }
    });

    if (numValue !== -1) {
      // Silent save - DISABLED as per user request
      /*
      try {
          await api.updateGrade(studentId, assignmentId, numValue);
      } catch (error) {
          console.error("Failed to save grade", error);
      }
      */
    }
  };

  // Helper to get score
  const getScore = (studentId: string, assignmentId: string) => {
    const g = grades.find(g => g.studentId === studentId && g.assignmentId === assignmentId);
    return (g && g.score !== -1) ? g.score : '';
  };

  const getTotalScore = (studentId: string) => {
    return assignments.reduce((sum, assignment) => {
      const score = getScore(studentId, assignment.id);
      return sum + (typeof score === 'number' ? score : 0);
    }, 0);
  };

  const isOverdue = (dueDate: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date(new Date().toDateString());
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!students.length) return;

    // 1. Headers
    const headers = ['Student ID', 'Name', ...assignments.map(a => a.title)];

    // 2. Rows
    const rows = students.map(s => {
      const studentGrades = assignments.map(a => {
        const score = getScore(s.id, a.id);
        return score === '' ? '' : score;
      });
      return [s.id, s.name, ...studentGrades];
    });

    // 3. Convert to CSV string (simple join)
    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(r => r.map(c => `"${c}"`).join(',')) // Wrap in quotes to handle commas
    ].join('\n');

    // 4. Download
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); // Add BOM
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `grades_${classrooms.find(c => c.id === selectedClassId)?.name || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Import
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r\n|\n/);

        // Parse Header helper
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

        const headers = parseLine(lines[0]);
        // Map headers to assignment IDs
        const assignmentMap: { index: number, id: string }[] = [];

        assignments.forEach(a => {
          const index = headers.findIndex(h => h.replace(/^"|"$/g, '') === a.title);
          if (index > 1) { // Skip ID and Name cols
            assignmentMap.push({ index, id: a.id });
          }
        });

        const updates: Grade[] = [];

        // Parse Rows
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const cols = parseLine(lines[i]);
          const studentId = cols[0].replace(/^"|"$/g, '');

          // Check if student exists in this class
          if (students.some(s => s.id === studentId)) {
            assignmentMap.forEach(map => {
              if (cols[map.index] !== undefined && cols[map.index] !== '') {
                const score = Number(cols[map.index].replace(/^"|"$/g, ''));
                if (!isNaN(score)) {
                  updates.push({
                    studentId,
                    assignmentId: map.id,
                    score
                  });
                }
              }
            });
          }
        }

        if (updates.length > 0) {
          await api.updateGradesBatch(updates);
          await fetchClassData(selectedClassId);
          alert(`Imported ${updates.length} scores successfully.`);
        } else {
          alert("No matching columns or data found.");
        }

      } catch (err) {
        console.error(err);
        alert("Failed to import CSV");
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-rose-400 rounded-3xl p-8 text-white shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
        <div className="relative z-10">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <i className="fa-solid fa-graduation-cap opacity-80"></i> การเก็บคะแนน
          </h2>
          <p className="text-pink-100 mt-1 text-sm">บันทึกคะแนนเก็บและติดตามงานของนักเรียน</p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3 mt-6">
          <select
            value={selectedClassId}
            onChange={handleClassChange}
            className="bg-white/90 border-none text-sm rounded-lg px-4 py-2 font-medium text-gray-700 cursor-pointer outline-none focus:ring-2 focus:ring-pink-300 min-w-[200px]"
          >
            <option value="">เลือกห้องเรียน</option>
            {classrooms.map(c => <option key={c.id} value={c.id}>{c.name} ({c.subject})</option>)}
          </select>

          {selectedClassId && (
            <>
              <button
                onClick={openAddModal}
                className="bg-white/20 border border-white/40 text-white rounded-lg px-4 py-2 text-sm transition-all hover:bg-white/30 flex items-center gap-2"
              >
                <i className="fa-solid fa-plus"></i> เพิ่มงาน
              </button>

              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={handleImportClick}
                className="bg-white/20 border border-white/40 text-white rounded-lg px-4 py-2 text-sm transition-all hover:bg-white/30 flex items-center gap-2"
              >
                <i className="fa-solid fa-file-import"></i> นำเข้า CSV
              </button>
              <button
                onClick={handleExportCSV}
                className="bg-white/20 border border-white/40 text-white rounded-lg px-4 py-2 text-sm transition-all hover:bg-white/30 flex items-center gap-2"
              >
                <i className="fa-solid fa-file-export"></i> ส่งออก CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        {!selectedClassId ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <i className="fa-solid fa-chalkboard text-4xl mb-4 text-gray-200"></i>
            <p>กรุณาเลือกห้องเรียนเพื่อเริ่มเก็บคะแนน</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto pb-4">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-600 w-16 sticky left-0 bg-gray-50 z-20">#</th>
                    <th className="px-6 py-4 text-left text-sm font-bold text-gray-600 min-w-[200px] sticky left-16 bg-gray-50 z-20 border-r border-gray-100 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">ชื่อ-สกุล</th>
                    {assignments.map(a => (
                      <th key={a.id} className="px-4 py-4 text-center text-sm font-bold text-gray-600 min-w-[140px] group relative">
                        <div className="flex flex-col items-center">
                          <span>{a.title}</span>
                          <span className={`text-xs font-normal mt-1 px-2 py-0.5 rounded ${isOverdue(a.dueDate) ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'}`}>
                            เต็ม {a.maxScore}
                          </span>
                          <span className="text-[10px] text-gray-400 font-normal mt-0.5">{a.dueDate ? `ครบกำหนด ${new Date(a.dueDate).toLocaleDateString('th-TH')}` : '-'}</span>
                        </div>
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditModal(a)}
                            className="text-gray-400 hover:text-blue-500 bg-white border border-gray-100 rounded-md w-6 h-6 flex items-center justify-center shadow-sm"
                            title="แก้ไข"
                          >
                            <i className="fa-solid fa-pen text-[10px]"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteAssignment(a.id)}
                            className="text-gray-400 hover:text-red-500 bg-white border border-gray-100 rounded-md w-6 h-6 flex items-center justify-center shadow-sm"
                            title="ลบ"
                          >
                            <i className="fa-solid fa-trash-can text-[10px]"></i>
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="px-6 py-4 text-center text-sm font-bold text-gray-600 min-w-[100px] bg-emerald-50 text-emerald-700 border-l border-emerald-100">คะแนนรวม</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.map((s, idx) => (
                    <tr key={s.id} className="group hover:bg-pink-50/10 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-500 sticky left-0 bg-white group-hover:bg-pink-50/10 z-10">{idx + 1}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-800 sticky left-16 bg-white group-hover:bg-pink-50/10 z-10 border-r border-gray-100 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">{s.name}</td>
                      {assignments.map(a => {
                        const score = getScore(s.id, a.id);
                        const isMissing = score === '';
                        const overdue = isOverdue(a.dueDate);
                        const isWarning = isMissing && overdue;

                        return (
                          <td key={a.id} className="px-4 py-3 text-center">
                            <input
                              type="number"
                              min="0"
                              max={a.maxScore}
                              value={score}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                if (val > a.maxScore) return; // Prevent > max
                                handleGradeChange(s.id, a.id, e.target.value)
                              }}
                              className={`w-20 text-center border rounded-lg py-1.5 outline-none transition-all focus:ring-2 focus:ring-pink-300
                                                    ${isWarning
                                  ? 'border-red-300 bg-red-50 text-red-600 placeholder-red-300'
                                  : 'border-gray-200 focus:border-pink-500 text-gray-700'
                                }
                                                `}
                              placeholder={isWarning ? 'ขาดส่ง' : '-'}
                            />
                          </td>
                        );
                      })}
                      <td className="px-6 py-4 text-center font-bold text-emerald-600 bg-emerald-50/30 border-l border-emerald-50">
                        {getTotalScore(s.id)}
                      </td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                    <tr><td colSpan={assignments.length + 3} className="text-center py-8 text-gray-400">ไม่พบข้อมูลนักเรียน</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-t border-gray-100 bg-gray-50">
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    await api.updateGradesBatch(grades);
                    alert('บันทึกคะแนนเรียบร้อย');
                  } catch (e) {
                    console.error(e);
                    alert('บันทึกไม่สำเร็จ');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white text-lg font-bold py-3 rounded-xl shadow-md shadow-emerald-200 transition-all"
              >
                บันทึกคะแนน
              </button>
            </div>
          </>
        )}
      </div>

      {/* Add/Edit Assignment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
            <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800">{editingAssignmentId ? 'แก้ไขงาน' : 'เพิ่มงานใหม่'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่องาน</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 p-2.5 outline-none"
                  placeholder="เช่น สอบย่อยบทที่ 1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">คะแนนเต็ม</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newMaxScore}
                    onChange={e => setNewMaxScore(Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 p-2.5 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">กำหนดส่ง</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={e => setNewDueDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 p-2.5 outline-none"
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">ยกเลิก</button>
                <button type="submit" className="px-6 py-2 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-xl shadow-lg shadow-pink-200 transition-all">บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Grading;
