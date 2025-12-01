
export type UserRole = 'teacher' | 'parent';

export interface User {
  username: string;
  name: string;
  role: UserRole;
  studentName?: string; // For parents
  password?: string;
  avatar?: string;
}

export interface Student {
  id: string;
  name: string;
  classId: string;
  dob: string;
  parentName?: string;
  parentPhone?: string;
}

export interface Classroom {
  id: string;
  name: string;
  subject: string;
  level: string;
  studentCount: number;
  emoji: string;
  teacher: string;
}

export interface AttendanceRecord {
  date: string;
  status: 'present' | 'late' | 'absent' | 'leave' | 'sick';
}

export interface StudentAttendance {
  studentId: string;
  records: AttendanceRecord[];
}

export interface Assignment {
  id: string;
  classId: string;
  title: string;
  maxScore: number;
  dueDate: string;
}

export interface Grade {
  studentId: string;
  assignmentId: string;
  score: number;
}
