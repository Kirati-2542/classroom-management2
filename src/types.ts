
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
  nickname?: string;
  studentId?: string;
  classId: string;
  dob: string;
  parentName?: string;
  parentPhone?: string;
}

export interface Classroom {
  id: string;
  name: string;
  subjects: string[]; // Changed from single subject to array
  level: string;
  studentCount: number;
  emoji: string;
  teacher: string;
}

export interface AttendanceRecord {
  date: string;
  status: 'present' | 'late' | 'absent' | 'leave' | 'sick';
  subject?: string; // Track which subject this attendance is for
}

export interface StudentAttendance {
  studentId: string;
  records: AttendanceRecord[];
}

export interface Assignment {
  id: string;
  classId: string;
  subject: string; // Add subject link
  title: string;
  maxScore: number;
  dueDate: string;
  type?: 'score' | 'checklist'; // 'score' is default
  assignedDate?: string; // Date when assignment was created
}

export interface Grade {
  studentId: string;
  assignmentId: string;
  score: number;
  submittedDate?: string; // Date of submission
}
