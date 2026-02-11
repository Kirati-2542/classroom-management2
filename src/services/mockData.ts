
import { Classroom, Student, User, Assignment, Grade } from '../types';

export const MOCK_USERS: User[] = [
  { username: 'admin', name: 'Admin User', role: 'teacher' },
  { username: 'parent', name: 'Parent User', role: 'parent', studentName: 'เด็กชายสมชาย ใจดี' }
];

export const MOCK_CLASSROOMS: Classroom[] = [
  { id: 'c1', name: 'ป.1/1', subjects: ['คณิตศาสตร์'], level: 'ป.1', studentCount: 2, emoji: '📚', teacher: 'ครูสมศรี' },
  { id: 'c2', name: 'ป.2/2', subjects: ['วิทยาศาสตร์'], level: 'ป.2', studentCount: 1, emoji: '🧪', teacher: 'ครูสมชาย' }
];

export const MOCK_STUDENTS: Student[] = [
  { id: '1111', name: 'เด็กชายสมชาย ใจดี', classId: 'c1', dob: '2015-01-01', parentName: 'นายสมศักดิ์ -', parentPhone: '081-111-1111' },
  { id: '2222', name: 'ด.ญ.ใจดี', classId: 'c1', dob: '2015-02-02', parentName: 'นางใจงาม', parentPhone: '082-222-2222' },
  { id: '3333', name: 'ด.ช.เก่ง', classId: 'c2', dob: '2015-03-03', parentName: 'นายเก่งกาจ', parentPhone: '083-333-3333' }
];

const today = new Date();
const pastDate = new Date();
pastDate.setDate(today.getDate() - 5);
const futureDate = new Date();
futureDate.setDate(today.getDate() + 7);

export const MOCK_ASSIGNMENTS: Assignment[] = [
  { id: 'a1', classId: 'c1', title: 'การบ้าน #1: การบวกเลข', maxScore: 10, dueDate: pastDate.toISOString().split('T')[0], subject: 'คณิตศาสตร์' },
  { id: 'a2', classId: 'c1', title: 'สอบกลางภาค', maxScore: 50, dueDate: futureDate.toISOString().split('T')[0], subject: 'คณิตศาสตร์' },
  { id: 'a3', classId: 'c1', title: 'แบบฝึกหัดท้ายบท', maxScore: 20, dueDate: pastDate.toISOString().split('T')[0], subject: 'คณิตศาสตร์' },
];

export const MOCK_GRADES: Grade[] = [
  { studentId: '1111', assignmentId: 'a1', score: 9 },
  { studentId: '2222', assignmentId: 'a1', score: 10 },
  { studentId: '1111', assignmentId: 'a2', score: 45 },
  // a3 missing for 1111 (Overdue)
];

export const SCHOOL_EMOJIS = ['🏫', '📚', '✏️', '📏', '🎒', '🎓', '💻', '🧪', '🎨', '🎵', '⚽', '🏀', '🏆', '🌟', '🍎', '🚌', '🔔', '📅'];
