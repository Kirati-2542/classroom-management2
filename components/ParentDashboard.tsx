
import React, { useEffect, useState } from 'react';
import { User, Student, Classroom, Assignment, Grade } from '../types';
import { api } from '../services/api';
import { isDateBeforeToday } from '../utils/dateUtils';

interface ParentDashboardProps {
    user?: User;
    student?: Student;
    onBack?: () => void;
}

const ParentDashboard: React.FC<ParentDashboardProps> = ({ user, student: propStudent, onBack }) => {
    const [student, setStudent] = useState<Student | null>(propStudent || null);
    const [classroom, setClassroom] = useState<Classroom | null>(null);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [grades, setGrades] = useState<Grade[]>([]);
    const [loading, setLoading] = useState(false);

    // 1. Resolve Student (if user is parent)
    useEffect(() => {
        if (propStudent) {
            setStudent(propStudent);
            return;
        }
        if (user && user.role === 'parent') {
            const findStudent = async () => {
                setLoading(true);
                try {
                    const classes = await api.getClassrooms();
                    for (const c of classes) {
                        const studs = await api.getStudentsByClass(c.id);
                        const found = studs.find(s => s.name === user.studentName);
                        if (found) {
                            setStudent(found);
                            break;
                        }
                    }
                } finally {
                    setLoading(false);
                }
            };
            findStudent();
        }
    }, [user, propStudent]);

    // 2. Fetch Class Data
    useEffect(() => {
        if (!student) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const classes = await api.getClassrooms();
                const cls = classes.find(c => c.id === student.classId);
                setClassroom(cls || null);

                if (cls) {
                    const asgs = await api.getAssignments(cls.id);
                    setAssignments(asgs);
                    const grds = await api.getGrades(cls.id);
                    setGrades(grds.filter(g => g.studentId === student.id));

                    // Fetch attendance stats
                    const stats = await api.getStudentAttendanceStats(student.id, cls.id);
                    setAttendanceStats(stats);
                }
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [student]);

    const [attendanceStats, setAttendanceStats] = useState<any>(null);

    const displayName = student?.name || user?.studentName || 'บุตรหลานของคุณ';

    const isOverdue = (date: string) => {
        return isDateBeforeToday(date);
    };

    const getStatus = (assignment: Assignment, score: number | null) => {
        if (score !== null) return { label: 'ตรวจแล้ว', color: 'bg-emerald-100 text-emerald-700' };
        if (isOverdue(assignment.dueDate)) return { label: 'ค้างส่ง', color: 'bg-red-100 text-red-700' };
        return { label: 'รอดำเนินการ', color: 'bg-gray-100 text-gray-600' };
    };

    const getTodayStatusLabel = (status: string) => {
        switch (status) {
            case 'present': return { text: 'เข้าเรียนปกติ', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: 'fa-check-circle' };
            case 'absent': return { text: 'ขาดเรียน', color: 'bg-red-50 text-red-600 border-red-100', icon: 'fa-times-circle' };
            case 'late': return { text: 'มาสาย', color: 'bg-orange-50 text-orange-600 border-orange-100', icon: 'fa-clock' };
            case 'sick': return { text: 'ลาป่วย', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: 'fa-bed' };
            case 'leave': return { text: 'ลากิจ', color: 'bg-yellow-50 text-yellow-600 border-yellow-100', icon: 'fa-envelope' };
            default: return { text: 'ยังไม่มีการเช็คชื่อ', color: 'bg-gray-50 text-gray-500 border-gray-100', icon: 'fa-minus-circle' };
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
            </div>
        );
    }

    const todayStatus = attendanceStats ? getTodayStatusLabel(attendanceStats.todayStatus) : getTodayStatusLabel('unknown');

    return (
        <div className="animate-fadeIn">
            {onBack && (
                <button
                    onClick={onBack}
                    className="mb-4 text-gray-500 hover:text-pink-600 font-medium flex items-center gap-2 transition-colors"
                >
                    <i className="fa-solid fa-arrow-left"></i> ย้อนกลับไปหน้ารายชื่อ
                </button>
            )}

            <div className="bg-gradient-to-r from-indigo-500 to-blue-400 rounded-3xl p-8 text-white shadow-lg mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl backdrop-blur-sm border-2 border-white/30">
                            {student ? '🎓' : '👶'}
                        </div>
                        <div>
                            <h2 className="text-2xl md:text-3xl font-bold">{displayName}</h2>
                            <p className="text-indigo-100 mt-1">
                                {classroom ? `ห้อง ${classroom.name} (${classroom.subjects?.join(', ') || ''})` : 'รายงานผลการเรียน'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Status Card */}
                <div className="md:col-span-1 space-y-6">
                    {/* Status Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <i className="fa-regular fa-calendar-check text-pink-500"></i> สถานะวันนี้
                        </h3>
                        <div className={`${todayStatus.color} p-4 rounded-xl flex items-center justify-between mb-4 border`}>
                            <span className="font-medium">{todayStatus.text}</span>
                            <i className={`fa-solid ${todayStatus.icon} text-2xl`}></i>
                        </div>
                        <div className="text-sm text-gray-500 space-y-2">
                            <div className="flex justify-between">
                                <span>มาเรียน</span>
                                <span className="font-bold text-gray-800">{attendanceStats ? attendanceStats.percent : 0}%</span>
                            </div>
                            <div className="flex justify-between">
                                <span>ขาด</span>
                                <span className="font-bold text-gray-800">{attendanceStats ? attendanceStats.absent : 0} ครั้ง</span>
                            </div>
                            <div className="flex justify-between">
                                <span>สาย</span>
                                <span className="font-bold text-gray-800">{attendanceStats ? attendanceStats.late : 0} ครั้ง</span>
                            </div>
                            <div className="flex justify-between">
                                <span>ลา</span>
                                <span className="font-bold text-gray-800">{attendanceStats ? (attendanceStats.sick + attendanceStats.leave) : 0} ครั้ง</span>
                            </div>
                        </div>
                    </div>

                    {/* Today's Assignments Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <i className="fa-solid fa-bullhorn text-orange-500"></i> งานที่ได้รับวันนี้
                        </h3>
                        {assignments.filter(a => a.assignedDate === new Date().toISOString().split('T')[0]).length > 0 ? (
                            <div className="space-y-3">
                                {assignments
                                    .filter(a => a.assignedDate === new Date().toISOString().split('T')[0])
                                    .map(a => (
                                        <div key={a.id} className="bg-orange-50 border border-orange-100 p-3 rounded-xl flex items-start gap-3">
                                            <div className="bg-white p-2 rounded-lg text-orange-500 shadow-sm shrink-0">
                                                <i className="fa-solid fa-book-open"></i>
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold text-orange-600 mb-0.5">{a.subject}</div>
                                                <div className="text-sm font-bold text-gray-800">{a.title}</div>
                                                <div className="text-xs text-gray-500 mt-1">ส่งภายใน: {new Date(a.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-xl border-dashed border-2 border-gray-100">
                                <i className="fa-solid fa-clipboard-check text-2xl mb-2 opacity-50"></i>
                                <p className="text-sm">ไม่มีงานที่มอบหมายวันนี้</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Assignments Card */}
                <div className="md:col-span-2">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <i className="fa-solid fa-book text-indigo-500"></i> งานและการบ้าน
                            </h3>
                            {/* Subject List removed from header */}
                        </div>

                        {assignments.length > 0 ? (
                            <div className="space-y-8">
                                {(classroom?.subjects?.length ? classroom.subjects : ['General']).map(subject => {
                                    const subjectAssignments = assignments.filter(a => (a.subject || 'General') === subject);
                                    if (subjectAssignments.length === 0) return null;

                                    return (
                                        <div key={subject} className="animate-fadeIn">
                                            <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                                {subject}
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                {subjectAssignments.map(a => {
                                                    const grade = grades.find(g => g.assignmentId === a.id);
                                                    const score = grade?.score !== undefined && grade.score !== -1 ? grade.score : null;
                                                    const status = getStatus(a, score);
                                                    const percent = score !== null ? (score / a.maxScore) * 100 : 0;
                                                    const isChecklist = a.type === 'checklist';

                                                    return (
                                                        <div key={a.id} className="border border-gray-100 rounded-xl p-3 hover:shadow-md transition-shadow bg-gray-50/30 flex flex-col justify-between h-full">
                                                            {/* Card Content */}
                                                            <div>
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <h4 className="font-bold text-gray-800 text-sm line-clamp-2">{a.title}</h4>
                                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border whitespace-nowrap ml-2 ${status.color.replace('text', 'border-opacity-20 border')}`}>
                                                                        {status.label}
                                                                    </span>
                                                                </div>

                                                                <div className="text-[10px] text-gray-500 mb-3 flex items-center gap-1">
                                                                    <i className="fa-regular fa-calendar"></i> {a.dueDate ? new Date(a.dueDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <div className="flex justify-between items-end mb-1.5">
                                                                    {isChecklist ? (
                                                                        <div className="text-xs font-medium text-gray-600">สถานะ:</div>
                                                                    ) : (
                                                                        <div className="text-xs font-medium text-gray-600">คะแนน:</div>
                                                                    )}

                                                                    {score !== null && !isChecklist && (
                                                                        <div className="text-sm font-bold text-gray-800">
                                                                            {score} <span className="text-[10px] text-gray-400 font-normal">/ {a.maxScore}</span>
                                                                        </div>
                                                                    )}
                                                                    {isChecklist && (
                                                                        <div className={`text-xs font-bold flex items-center gap-1 ${score === 1 ? 'text-emerald-500' : 'text-gray-400'}`}>
                                                                            {score === 1 ? <><i className="fa-solid fa-check-circle"></i> ส่งแล้ว</> : 'ยังไม่ส่ง'}
                                                                        </div>
                                                                    )}
                                                                    {score === null && (
                                                                        <span className="text-xs text-gray-400">-</span>
                                                                    )}
                                                                </div>

                                                                {score !== null && !isChecklist && (
                                                                    <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                                                                        <div
                                                                            className={`h-1 rounded-full ${percent >= 80 ? 'bg-emerald-500' : percent >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                                                            style={{ width: `${percent}%` }}
                                                                        ></div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Handle assignments that don't match any listed subject */}
                                {(() => {
                                    const listedSubjects = classroom?.subjects || ['General'];
                                    const otherAssignments = assignments.filter(a => !listedSubjects.includes(a.subject || 'General'));

                                    if (otherAssignments.length === 0) return null;

                                    return (
                                        <div className="animate-fadeIn">
                                            <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                                                อื่นๆ
                                            </h4>
                                            <div className="space-y-3">
                                                {otherAssignments.map(a => {
                                                    const grade = grades.find(g => g.assignmentId === a.id);
                                                    const score = grade?.score !== undefined && grade.score !== -1 ? grade.score : null;
                                                    const status = getStatus(a, score);
                                                    const percent = score !== null ? (score / a.maxScore) * 100 : 0;

                                                    return (
                                                        <div key={a.id} className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow bg-gray-50/30">
                                                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-2">
                                                                <div>
                                                                    <h4 className="font-bold text-gray-800">{a.title}</h4>
                                                                    <div className="text-xs text-gray-500 mt-1 flex gap-2">
                                                                        <span><i className="fa-regular fa-calendar mr-1"></i> กำหนดส่ง: {a.dueDate ? new Date(a.dueDate).toLocaleDateString('th-TH') : '-'}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    {score !== null && (
                                                                        <div className="text-right">
                                                                            <div className="text-lg font-bold text-gray-800">
                                                                                {score} <span className="text-sm text-gray-400 font-normal">/ {a.maxScore}</span>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${status.color.replace('text', 'border-opacity-20 border')}`}>
                                                                        {status.label}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {score !== null && (
                                                                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                                                                    <div
                                                                        className={`h-1.5 rounded-full ${percent >= 80 ? 'bg-emerald-500' : percent >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                                                        style={{ width: `${percent}%` }}
                                                                    ></div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )
                                })()}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-400">
                                ไม่มีงานที่ได้รับมอบหมาย
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ParentDashboard;
