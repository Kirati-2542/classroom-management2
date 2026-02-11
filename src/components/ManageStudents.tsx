
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Classroom, Student } from '../types';
import { SuccessModal } from './ui/SuccessModal';
import { parseInputDate } from '../utils/dateUtils';
import { useNavigate } from 'react-router-dom';

interface ManageStudentsProps {
  setLoading: (l: boolean) => void;
}

const ManageStudents: React.FC<ManageStudentsProps> = ({ setLoading }) => {
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [currentId, setCurrentId] = useState(''); // Primary key for edit lookup

  // Form Fields
  const [studentId, setStudentId] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [classId, setClassId] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');

  // Success Modal State
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successModalMessage, setSuccessModalMessage] = useState('');

  useEffect(() => {
    setLoading(true);
    api.getClassrooms()
      .then(data => {
        setClassrooms(data);
        // Auto select first class if available
        if (data.length > 0) setSelectedClassId(data[0].id);
      })
      .finally(() => setLoading(false));
  }, [setLoading]);

  useEffect(() => {
    if (selectedClassId) {
      setLoading(true);
      api.getStudentsByClass(selectedClassId)
        .then(setStudents)
        .finally(() => setLoading(false));
    } else {
      setStudents([]);
    }
  }, [selectedClassId, setLoading]);

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedClassId(e.target.value);
  };

  const openAddModal = () => {
    setEditMode(false);
    setStudentId('');
    setName('');
    setDob('');
    setParentName('');
    setParentPhone('');
    // Default to currently selected class, or first available
    setClassId(selectedClassId || (classrooms[0]?.id || ''));
    setIsModalOpen(true);
  };

  const openEditModal = (s: Student) => {
    setEditMode(true);
    setCurrentId(s.id);
    setStudentId(s.id);
    setName(s.name);
    setDob(s.dob);
    setClassId(s.classId);
    setParentName(s.parentName || '');
    setParentPhone(s.parentPhone || '');
    setIsModalOpen(true);
  };

  // Delete Confirmation State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  const handleDelete = (student: Student) => {
    setStudentToDelete(student);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!studentToDelete) return;

    setLoading(true);
    try {
      await api.deleteStudent(studentToDelete.id);

      // Refresh list
      if (selectedClassId) {
        const updated = await api.getStudentsByClass(selectedClassId);
        setStudents(updated);
      }

      setIsDeleteModalOpen(false);
      setStudentToDelete(null);
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการลบ: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const studentData = {
        id: studentId,
        name,
        dob,
        classId,
        parentName,
        parentPhone
      };

      if (editMode) {
        await api.updateStudent(currentId, studentData);
      } else {
        await api.addStudent(studentData);
      }

      // Close and Refresh
      setIsModalOpen(false);
      if (selectedClassId) {
        const updated = await api.getStudentsByClass(selectedClassId);
        setStudents(updated);
      } else if (classId) {
        // If we added a student to a class while "All" or a different class was selected, switch to that class to show them
        setSelectedClassId(classId);
      }
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImportClick = () => {
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

      // Check for replacement character () which indicates encoding issues
      // Common in Thai CSVs saved from Excel (TIS-620)
      if (text.includes('\uFFFD')) {
        console.log('Detected encoding issues with UTF-8, retrying with TIS-620');
        text = await readFile(file, 'TIS-620');
      }

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
        return result.map(s => s.trim().replace(/^"|"$/g, ''));
      };



      const headers = parseLine(lines[0]);
      // Expected headers: id, name, dob, parentName, parentPhone
      // Optional: classId (if not present, use selectedClassId)

      const updates: Student[] = [];
      const targetClassId = selectedClassId || classrooms[0]?.id;

      if (!targetClassId) {
        alert("กรุณาเลือกห้องเรียนก่อนนำเข้าข้อมูล หรือระบุคอลัมน์ classId ในไฟล์ CSV");
        setLoading(false);
        return;
      }

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = parseLine(lines[i]);

        // Map columns based on header index
        const getCol = (name: string) => {
          const idx = headers.findIndex(h => h.toLowerCase() === name.toLowerCase());
          return idx !== -1 ? cols[idx] : '';
        };

        const id = getCol('id') || getCol('studentId') || getCol('รหัส');
        const name = getCol('name') || getCol('ชื่อ');

        if (id && name) {
          updates.push({
            id,
            name,
            classId: getCol('classId') || targetClassId,
            dob: parseInputDate(getCol('dob') || ''),
            parentName: getCol('parentName') || getCol('ผู้ปกครอง') || '',
            parentPhone: getCol('parentPhone') || getCol('เบอร์โทร') || ''
          });
        }
      }

      if (updates.length > 0) {
        await api.updateStudentsBatch(updates);
        if (selectedClassId) {
          const updated = await api.getStudentsByClass(selectedClassId);
          setStudents(updated);
        }
        setSuccessModalMessage(`นำเข้าข้อมูลสำเร็จ ${updates.length} รายการ`);
        setSuccessModalOpen(true);
      } else {
        alert("ไม่พบข้อมูลที่สามารถนำเข้าได้ กรุณาตรวจสอบไฟล์ CSV");
      }

    } catch (err) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการนำเข้าไฟล์ CSV");
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleExportCSV = async () => {
    setLoading(true);
    try {
      // Fetch fresh data from Google Sheets
      const freshStudents = await api.getStudentsByClass(selectedClassId, true);

      if (!freshStudents.length) {
        alert("ไม่มีข้อมูลนักเรียนที่จะส่งออก");
        return;
      }

      // 1. Headers
      const headers = ['id', 'name', 'classId', 'dob', 'parentName', 'parentPhone'];

      // 2. Rows
      const rows = freshStudents.map(s => [
        s.id,
        s.name,
        selectedClassId || s.classId, // Ensure classId matches selection if filtered
        s.dob,
        s.parentName || '',
        s.parentPhone || ''
      ]);

      // 3. Convert to CSV string
      const csvContent = [
        headers.join(','),
        ...rows.map(r => r.map(c => `"${c}"`).join(','))
      ].join('\n');

      // 4. Download
      // Use standard MIME type without extra parameters to ensure browser compatibility
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Use a strictly safe filename with timestamp to ensure the .csv extension is respected
      // We avoid using the class name for the filename to prevent encoding issues for now
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `students_export_${timestamp}.csv`;

      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการส่งออก: " + err.message);
    } finally {
      setLoading(false);
    }
  };




  const getClassName = (cid: string) => classrooms.find(c => c.id === cid)?.name || cid;

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-rose-400 rounded-3xl p-8 text-white shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
        <div className="relative z-10">
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <i className="fa-solid fa-users-gear opacity-80"></i> จัดการข้อมูลนักเรียน
          </h2>
          <p className="text-pink-100 mt-1 text-sm">เพิ่ม แก้ไข ลบ และจัดการข้อมูลรายชื่อนักเรียนในแต่ละห้อง</p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3 mt-6">
          <select
            value={selectedClassId}
            onChange={handleClassChange}
            className="bg-white/90 border-none text-sm rounded-lg px-4 py-2 font-medium text-gray-700 cursor-pointer outline-none focus:ring-2 focus:ring-pink-300 min-w-[200px]"
          >
            <option value="">เลือกห้องเรียน...</option>
            {classrooms.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>

          {selectedClassId && (
            <>
              <button
                onClick={openAddModal}
                className="bg-white/20 border border-white/40 text-white rounded-lg px-4 py-2 text-sm transition-all hover:bg-white/30 flex items-center gap-2"
              >
                <i className="fa-solid fa-plus"></i> เพิ่มนักเรียน
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

      {/* Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
        {!selectedClassId ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <i className="fa-solid fa-chalkboard-user text-4xl mb-4 text-gray-200"></i>
            <p>กรุณาเลือกห้องเรียนเพื่อดูรายชื่อนักเรียน</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left">
                  <th className="px-6 py-4 text-sm font-bold text-gray-900 w-32">รหัสนักเรียน</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-900">ชื่อ-สกุล</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-900">วันเกิด</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-900">ผู้ปกครอง</th>
                  <th className="px-6 py-4 text-sm font-bold text-gray-900">ห้องเรียน</th>
                  <th className="px-6 py-4 text-right text-sm font-bold text-gray-900 min-w-[140px]">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map(s => (
                  <tr key={s.id} className="hover:bg-pink-50/10 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-600">{s.id}</td>
                    <td className="px-6 py-4 text-sm font-bold text-gray-800">{s.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {s.dob ? new Date(s.dob).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div className="font-medium text-gray-800">{s.parentName || '-'}</div>
                      <div className="text-xs text-gray-400">{s.parentPhone || '-'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">{getClassName(s.classId)}</span></td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-1">
                      <button
                        onClick={() => navigate(`/students/${s.id}`)}
                        className="text-gray-400 hover:text-indigo-500 p-2 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="ดูสรุปผลการเรียน"
                      >
                        <i className="fa-solid fa-chart-pie"></i>
                      </button>
                      <div className="w-px h-4 bg-gray-200 mx-1"></div>
                      <button onClick={() => openEditModal(s)} className="text-gray-400 hover:text-blue-500 p-2 hover:bg-blue-50 rounded-lg transition-colors">
                        <i className="fa-regular fa-pen-to-square"></i>
                      </button>
                      <button onClick={() => handleDelete(s)} className="text-gray-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors">
                        <i className="fa-regular fa-trash-can"></i>
                      </button>
                    </td>
                  </tr>
                ))}
                {students.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">ยังไม่มีนักเรียนในห้องนี้</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-fadeIn max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100 sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold text-gray-800">{editMode ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียนใหม่'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">รหัสนักเรียน <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={studentId}
                    onChange={e => setStudentId(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 p-2.5 outline-none"
                    placeholder="เช่น 12345"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ห้องเรียน <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={classId}
                    onChange={e => setClassId(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 p-2.5 outline-none bg-white"
                  >
                    <option value="">เลือกห้องเรียน</option>
                    {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 p-2.5 outline-none"
                  placeholder="เช่น เด็กชายรักเรียน ขยันหมั่นเพียร"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">วันเดือนปีเกิด</label>
                <input
                  type="date"
                  value={dob}
                  onChange={e => setDob(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 p-2.5 outline-none"
                />
              </div>

              <div className="pt-2 border-t border-gray-100 mt-2">
                <p className="text-sm font-bold text-gray-700 mb-3">ข้อมูลผู้ปกครอง</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อผู้ปกครอง</label>
                    <input
                      type="text"
                      value={parentName}
                      onChange={e => setParentName(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 p-2.5 outline-none"
                      placeholder="ชื่อ-สกุล"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์</label>
                    <input
                      type="tel"
                      value={parentPhone}
                      onChange={e => setParentPhone(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 p-2.5 outline-none"
                      placeholder="08x-xxx-xxxx"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 sticky bottom-0 bg-white z-10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-xl shadow-lg shadow-pink-200 transition-all"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && studentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-triangle-exclamation text-3xl text-red-500"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">ยืนยันการลบข้อมูล</h3>
              <p className="text-gray-600 mb-6">
                คุณต้องการลบข้อมูลของ <span className="font-bold text-gray-800">{studentToDelete.name}</span> ใช่หรือไม่?
                <br />
                <span className="text-sm text-red-500 mt-2 block">ข้อมูลการเข้าเรียนและคะแนนทั้งหมดจะถูกลบด้วย</span>
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => {
                    setIsDeleteModalOpen(false);
                    setStudentToDelete(null);
                  }}
                  className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 transition-all"
                >
                  ลบข้อมูล
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Success Modal */}
      <SuccessModal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title="นำเข้าข้อมูลสำเร็จ"
        message={successModalMessage}
      />
    </div>
  );
};

export default ManageStudents;
