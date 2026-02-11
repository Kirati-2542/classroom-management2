import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Classroom } from '../types';
import { SCHOOL_EMOJIS } from '../services/mockData';

interface ManageClassroomsProps {
  setLoading: (l: boolean) => void;
}

const ManageClassrooms: React.FC<ManageClassroomsProps> = ({ setLoading }) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectInput, setSubjectInput] = useState('');
  const [level, setLevel] = useState('');
  const [teacher, setTeacher] = useState('');
  const [emoji, setEmoji] = useState('🏫');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const fetchClassrooms = async () => {
    setLoading(true);
    try {
      const data = await api.getClassrooms();
      setClassrooms(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassrooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddModal = () => {
    setIsEdit(false);
    setEditingId(null);
    setName('');
    setSubjects([]);
    setSubjectInput('');
    setLevel('');
    setTeacher('');
    setEmoji('🏫');
    setIsModalOpen(true);
  };

  const openEditModal = (c: Classroom) => {
    setIsEdit(true);
    setEditingId(c.id);
    setName(c.name);
    setSubjects(c.subjects || []);
    setSubjectInput('');
    setLevel(c.level);
    setTeacher(c.teacher);
    setEmoji(c.emoji);
    setIsModalOpen(true);
  };

  const handleAddSubject = () => {
    if (subjectInput.trim() && !subjects.includes(subjectInput.trim())) {
      setSubjects([...subjects, subjectInput.trim()]);
      setSubjectInput('');
    }
  };

  const handleRemoveSubject = (subj: string) => {
    setSubjects(subjects.filter(s => s !== subj));
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    setLoading(true);
    try {
      await api.deleteClassroom(deleteId);
      await fetchClassrooms();
      setIsDeleteModalOpen(false);
      setDeleteId(null);
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
      if (isEdit && editingId) {
        await api.updateClassroom(editingId, { name, subjects, level, teacher, emoji });
      } else {
        await api.addClassroom({ name, subjects, level, teacher, emoji, studentCount: 0 });
      }
      await fetchClassrooms();
      setIsModalOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fadeIn">
      <div className="bg-gradient-to-r from-pink-500 to-rose-400 rounded-3xl p-8 text-white shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-3">
              <i className="fa-solid fa-school-flag opacity-80"></i> จัดการห้องเรียน
            </h2>
            <p className="text-pink-100 mt-1 text-sm">เพิ่ม แก้ไข หรือลบห้องเรียนของคุณได้อย่างง่ายดาย</p>
          </div>
          <button
            onClick={openAddModal}
            className="bg-white text-pink-600 font-bold px-6 py-2.5 rounded-xl text-sm shadow-lg transition-transform hover:-translate-y-0.5 flex items-center gap-2"
          >
            <i className="fa-solid fa-plus"></i> เพิ่มห้องเรียนใหม่
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left">
                <th className="px-6 py-4 text-sm font-bold text-gray-900">ชื่อห้องเรียน</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-900">ระดับชั้น</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-900">วิชา</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-900">จำนวนนักเรียน</th>
                <th className="px-6 py-4 text-right text-sm font-bold text-gray-900">การดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {classrooms.map(c => (
                <tr key={c.id} className="hover:bg-pink-50/30 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-gray-800 flex items-center gap-2">
                    <span className="text-xl">{c.emoji}</span> {c.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.level}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="flex flex-wrap gap-1">
                      {c.subjects.map((s, idx) => (
                        <span key={idx} className="bg-pink-50 text-pink-700 px-2 py-0.5 rounded-md text-xs border border-pink-100">
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.studentCount} คน</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openEditModal(c)} className="hover:text-blue-500 px-2 transition-colors">
                      <i className="fa-regular fa-pen-to-square"></i>
                    </button>
                    <button onClick={() => handleDelete(c.id)} className="hover:text-red-500 px-2 transition-colors">
                      <i className="fa-regular fa-trash-can"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
            <div className="px-6 py-4 flex justify-between items-center border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800">{isEdit ? 'แก้ไขห้องเรียน' : 'เพิ่มห้องเรียนใหม่'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อห้องเรียน</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 p-2.5 outline-none"
                  placeholder="เช่น ป.1/1"
                />
              </div>

              {/* Subjects Management */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รายวิชา</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    list="subjectPresets"
                    value={subjectInput}
                    onChange={e => setSubjectInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubject();
                      }
                    }}
                    className="flex-1 rounded-xl border border-gray-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 p-2.5 outline-none"
                    placeholder="พิมพ์ชื่อวิชาแล้วกดเพิ่ม"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubject}
                    className="bg-pink-100 text-pink-600 px-4 rounded-xl hover:bg-pink-200 transition-colors font-bold"
                  >
                    เพิ่ม
                  </button>
                  <datalist id="subjectPresets">
                    <option value="คณิตศาสตร์" />
                    <option value="วิทยาศาสตร์" />
                    <option value="ภาษาไทย" />
                    <option value="ภาษาอังกฤษ" />
                    <option value="สังคมศึกษา" />
                    <option value="ศิลปะ" />
                    <option value="พลศึกษา" />
                    <option value="การงานอาชีพ" />
                  </datalist>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-gray-50 rounded-xl border border-gray-200">
                  {subjects.length === 0 && <span className="text-gray-400 text-sm">ยังไม่มีวิชาที่เลือก</span>}
                  {subjects.map((subj, idx) => (
                    <span key={idx} className="bg-white border border-pink-200 text-pink-700 px-3 py-1 rounded-full text-sm flex items-center gap-2 shadow-sm">
                      {subj}
                      <button type="button" onClick={() => handleRemoveSubject(subj)} className="text-pink-400 hover:text-red-500">
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ระดับชั้น</label>
                  <select
                    value={level}
                    onChange={e => setLevel(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 p-2.5 outline-none bg-white"
                  >
                    <option value="">เลือกระดับ</option>
                    <option>ป.1</option><option>ป.2</option><option>ป.3</option><option>ป.4</option><option>ป.5</option><option>ป.6</option><option>ม.1</option><option>ม.2</option><option>ม.3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ครูประจำชั้น</label>
                  <input
                    type="text"
                    value={teacher}
                    onChange={e => setTeacher(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 p-2.5 outline-none"
                    placeholder="ชื่อครู"
                  />
                </div>
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">สัญลักษณ์</label>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="w-full bg-gray-50 border border-gray-200 hover:bg-gray-100 rounded-xl py-3 flex items-center justify-center gap-2 text-2xl transition-colors"
                >
                  {emoji}
                </button>
                {showEmojiPicker && (
                  <div className="mt-2 p-3 bg-white rounded-xl border border-gray-200 grid grid-cols-6 gap-2 w-full">
                    {SCHOOL_EMOJIS.map(em => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => { setEmoji(em); setShowEmojiPicker(false); }}
                        className="text-2xl p-2 hover:bg-pink-50 rounded-lg transition-colors"
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="pt-4 flex justify-end gap-3">
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
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">ยืนยันการลบ</h3>
              <p className="text-gray-600 mb-6">คุณแน่ใจหรือไม่ที่จะลบห้องเรียนนี้? <br />การกระทำนี้ไม่สามารถย้อนกลับได้</p>

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 transition-all"
                >
                  ลบห้องเรียน
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageClassrooms;
