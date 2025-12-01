
import { Classroom, Student, User, Assignment, Grade } from '../types';
import { googleSheetsService } from './googleSheets';

// Cache for performance (optional, but good for reducing API calls)
let classrooms: Classroom[] = [];
let students: Student[] = [];
let assignments: Assignment[] = [];
let grades: Grade[] = [];
let attendance: any[] = [];

let systemSettings = {
  schoolName: 'โรงเรียนตัวอย่างวิทยา',
  academicYear: '2568',
  semester: '2'
};

let initPromise: Promise<void> | null = null;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to refresh data
const refreshData = async () => {
  try {
    const _classrooms = await googleSheetsService.getClassrooms();
    const _students = await googleSheetsService.getStudents();
    const _assignments = await googleSheetsService.getAssignments();
    const _grades = await googleSheetsService.getGrades();
    const _attendance = await googleSheetsService.getAttendance();

    // Recalculate student counts
    const finalClassrooms = _classrooms.map(c => ({
      ...c,
      studentCount: _students.filter(s => s.classId === c.id).length
    }));

    // Assign to module variables
    classrooms = finalClassrooms;
    students = _students;
    assignments = _assignments;
    grades = _grades;
    attendance = _attendance;
  } catch (e) {
    console.error("Failed to load data from Sheets", e);
  }
};

// Initial load
initPromise = refreshData();

export const api = {
  login: async (type: 'teacher' | 'parent', credentials: any): Promise<{ success: boolean; user?: User; message?: string }> => {
    if (initPromise) await initPromise;
    await delay(800);
    try {
      const users = await googleSheetsService.getUsers();
      if (type === 'teacher') {
        const user = users.find(u => u.username === credentials.username && u.role === 'teacher');
        // Check password from sheet
        if (user && user.password === credentials.password) {
          return { success: true, user };
        }
        return { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านผิด' };
      } else {
        // Parent login by Student ID
        const student = students.find(s => s.id === credentials.studentId);
        if (student && student.dob === credentials.birthDate) {
          return { success: true, user: { username: 'parent', name: student.parentName || 'ผู้ปกครอง', role: 'parent', studentName: student.name } };
        }
        return { success: false, message: 'ไม่พบข้อมูลนักเรียน' };
      }
    } catch (e: any) {
      console.error("Login error:", e);
      return { success: false, message: e.message || 'Connection error' };
    }
  },

  updateUser: async (username: string, data: Partial<User>): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(500);
    await googleSheetsService.updateUser(username, data);
  },

  getClassrooms: async (): Promise<Classroom[]> => {
    if (initPromise) await initPromise;
    await delay(500);
    return classrooms;
  },

  addClassroom: async (classroom: Omit<Classroom, 'id'>): Promise<Classroom> => {
    if (initPromise) await initPromise;
    await delay(500);
    const newClass = { ...classroom, id: `c${Date.now()}` };
    await googleSheetsService.addClassroom(newClass);
    classrooms.push(newClass);
    return newClass;
  },

  updateClassroom: async (id: string, data: Partial<Classroom>): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(500);
    classrooms = classrooms.map(c => c.id === id ? { ...c, ...data } : c);
  },

  deleteClassroom: async (id: string): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(500);
    await googleSheetsService.deleteClassroom(id);
    classrooms = classrooms.filter(c => c.id !== id);
  },

  getStudentsByClass: async (classId: string): Promise<Student[]> => {
    if (initPromise) await initPromise;
    await delay(500);
    if (!classId) return students;
    return students.filter(s => s.classId === classId);
  },

  addStudent: async (student: Student): Promise<Student> => {
    if (initPromise) await initPromise;
    await delay(400);
    // Ensure unique ID if not provided or conflict
    if (students.some(s => s.id === student.id)) {
      throw new Error("Student ID already exists");
    }
    await googleSheetsService.addStudent(student);
    students.push(student);

    // Update student count in class
    const cls = classrooms.find(c => c.id === student.classId);
    if (cls) cls.studentCount++;

    return student;
  },

  updateStudent: async (id: string, data: Partial<Student>): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(400);

    // 1. Prevent Duplicate ID
    if (data.id && data.id !== id) {
      const exists = students.some(s => s.id === data.id);
      if (exists) {
        throw new Error(`รหัสนักเรียน ${data.id} มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น`);
      }
    }

    // Check if class changed to update counts
    const oldStudent = students.find(s => s.id === id);
    if (oldStudent && data.classId && oldStudent.classId !== data.classId) {
      const oldClass = classrooms.find(c => c.id === oldStudent.classId);
      if (oldClass) oldClass.studentCount--;
      const newClass = classrooms.find(c => c.id === data.classId);
      if (newClass) newClass.studentCount++;
    }

    if (oldStudent) {
      const updatedStudent = { ...oldStudent, ...data };
      await googleSheetsService.updateStudent(id, updatedStudent);
      students = students.map(s => s.id === id ? updatedStudent : s);
    }
  },

  deleteStudent: async (id: string): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(400);
    const student = students.find(s => s.id === id);
    if (student) {
      const cls = classrooms.find(c => c.id === student.classId);
      if (cls) cls.studentCount--;
    }
    await googleSheetsService.deleteStudent(id);
    students = students.filter(s => s.id !== id);
    // Also cleanup grades
    grades = grades.filter(g => g.studentId !== id);
  },

  submitAttendance: async (classId: string, date: string, data: any): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(800);
    try {
      await googleSheetsService.saveAttendanceBatch(classId, date, data);

      // Update local cache
      Object.entries(data).forEach(([studentId, status]) => {
        const existingIndex = attendance.findIndex(a => a.classId === classId && a.studentId === studentId && a.date === date);
        if (existingIndex >= 0) {
          attendance[existingIndex].status = status;
        } else {
          attendance.push({ classId, date, studentId, status: status as string });
        }
      });

    } catch (e) {
      console.error("Failed to save attendance:", e);
      throw e;
    }
  },

  getAttendanceHistory: async (classId: string) => {
    if (initPromise) await initPromise;
    await delay(600);

    // Refresh to get latest
    attendance = await googleSheetsService.getAttendance();

    const classStudents = students.filter(s => s.classId === classId);

    // Generate dates (last 10 weekdays for example, or based on actual data)
    // For now, let's look at what dates exist in the data for this class, plus some defaults if empty
    const existingDates = Array.from(new Set(attendance.filter(a => a.classId === classId).map(a => a.date)));

    // If no data, provide some default dates
    let dates = existingDates;
    if (dates.length === 0) {
      dates = ['10 พ.ย.', '11 พ.ย.', '12 พ.ย.', '13 พ.ย.', '14 พ.ย.', '17 พ.ย.', '18 พ.ย.', '19 พ.ย.', '20 พ.ย.', '21 พ.ย.'];
    }

    // Sort dates (simple string sort might not be enough, but assuming format DD M.M.)
    // For better sorting we might need a real date object, but let's stick to the string format for now
    // or just trust the order they come in or sort by simple string
    dates.sort();

    const historyData = classStudents.map((s, i) => {
      const studentAttendance = attendance.filter(a => a.studentId === s.id && a.classId === classId);
      const studentStatuses = dates.map(d => {
        const record = studentAttendance.find(a => a.date === d);
        return record ? record.status : '-'; // Default to '-' if no record
      });

      return {
        no: i + 1,
        id: s.id,
        name: s.name,
        statuses: studentStatuses
      };
    });

    return { dates, students: historyData };
  },

  updateAttendanceHistory: async (classId: string, studentId: string, dateIndex: number, status: string) => {
    if (initPromise) await initPromise;
    await delay(200);

    // We need to know the date string corresponding to the index. 
    // This is a bit tricky since the UI passes an index.
    // We should probably pass the date string from the UI, but let's reconstruct it for now
    // by calling getAttendanceHistory again or caching dates. 
    // Ideally, the UI should pass the date.

    // Let's fetch current view to get dates
    const history = await api.getAttendanceHistory(classId);
    const date = history.dates[dateIndex];

    if (date) {
      await googleSheetsService.updateAttendance(classId, date, studentId, status);

      // Update local cache
      const existingIndex = attendance.findIndex(a => a.classId === classId && a.studentId === studentId && a.date === date);
      if (existingIndex >= 0) {
        attendance[existingIndex].status = status;
      } else {
        attendance.push({ classId, date, studentId, status });
      }
    }

    return true;
  },

  getStudentAttendanceStats: async (studentId: string, classId: string) => {
    if (initPromise) await initPromise;
    await delay(500);
    // Ensure we have latest data
    attendance = await googleSheetsService.getAttendance();

    const studentRecords = attendance.filter(a => a.classId === classId && a.studentId === studentId);

    const total = studentRecords.length;
    const present = studentRecords.filter(a => a.status === 'present').length;
    const absent = studentRecords.filter(a => a.status === 'absent').length;
    const late = studentRecords.filter(a => a.status === 'late').length;
    const sick = studentRecords.filter(a => a.status === 'sick').length;
    const leave = studentRecords.filter(a => a.status === 'leave').length;

    // Calculate percentage based on present + late (assuming late counts as present for attendance % but maybe penalized, 
    // usually attendance % is (present + late) / total or just present / total. 
    // Let's go with (present + late) / total * 100 for "Coming to school" %
    const attendCount = present + late;
    const percent = total > 0 ? Math.round((attendCount / total) * 100) : 0;

    // Get today's status
    const today = new Date().toISOString().split('T')[0];
    const todayRecord = studentRecords.find(a => a.date === today);
    const todayStatus = todayRecord ? todayRecord.status : 'unknown';

    return {
      total,
      present,
      absent,
      late,
      sick,
      leave,
      percent,
      todayStatus
    };
  },

  getDashboardStats: async () => {
    if (initPromise) await initPromise;
    await delay(800);
    attendance = await googleSheetsService.getAttendance();
    students = await googleSheetsService.getStudents();
    classrooms = await googleSheetsService.getClassrooms();

    // 1. Overall Stats
    const totalRecords = attendance.length;
    if (totalRecords === 0) {
      return {
        attendanceRate: 0,
        lateRate: 0,
        absentRate: 0,
        chartData: [],
        followUpStudents: []
      };
    }

    const presentCount = attendance.filter(a => a.status === 'present').length;
    const lateCount = attendance.filter(a => a.status === 'late').length;
    const absentCount = attendance.filter(a => a.status === 'absent').length;

    const attendanceRate = Math.round(((presentCount + lateCount) / totalRecords) * 100);
    const lateRate = Math.round((lateCount / totalRecords) * 100);
    const absentRate = Math.round((absentCount / totalRecords) * 100);

    // 2. Chart Data (Last 5 days with data)
    // Group by date
    const dateGroups = attendance.reduce((acc, curr) => {
      if (!acc[curr.date]) acc[curr.date] = { total: 0, present: 0 };
      acc[curr.date].total++;
      if (curr.status === 'present' || curr.status === 'late') acc[curr.date].present++;
      return acc;
    }, {} as Record<string, { total: number, present: number }>);

    const sortedDates = Object.keys(dateGroups).sort();
    const last5Dates = sortedDates.slice(-5);

    const chartData = last5Dates.map(date => {
      const dayName = new Date(date).toLocaleDateString('th-TH', { weekday: 'short' });
      return {
        name: dayName,
        present: dateGroups[date].present, // Or percentage? Let's use count for now as per original mock, or maybe percentage is better for chart?
        // Original mock used count (10, 12, etc). Let's stick to count but maybe scale it if needed.
        // Actually, let's use percentage for the chart to be consistent across different class sizes?
        // But the mock had 'present: 10', implying count. Let's use count.
      };
    });

    // 3. Follow Up Students (More than 2 absences or lates)
    const studentStats = students.map(s => {
      const sRecords = attendance.filter(a => a.studentId === s.id);
      const sAbsent = sRecords.filter(a => a.status === 'absent').length;
      const sLate = sRecords.filter(a => a.status === 'late').length;
      return { ...s, sAbsent, sLate };
    });

    const followUpStudents = studentStats
      .filter(s => s.sAbsent >= 2 || s.sLate >= 2)
      .map(s => {
        let status = '';
        if (s.sAbsent >= 2) status = `ขาดเรียน ${s.sAbsent} ครั้ง`;
        else if (s.sLate >= 2) status = `มาสาย ${s.sLate} ครั้ง`;

        const cls = classrooms.find(c => c.id === s.classId);

        return {
          id: s.id,
          name: s.name,
          room: cls ? cls.name : '-',
          status,
          type: s.sAbsent >= 2 ? 'absent' : 'late'
        };
      })
      .slice(0, 5); // Top 5

    return {
      attendanceRate,
      lateRate,
      absentRate,
      chartData,
      followUpStudents
    };
  },

  // Grading API
  getAssignments: async (classId: string): Promise<Assignment[]> => {
    if (initPromise) await initPromise;
    await delay(400);
    return assignments.filter(a => a.classId === classId);
  },

  addAssignment: async (assignment: Omit<Assignment, 'id'>): Promise<Assignment> => {
    if (initPromise) await initPromise;
    await delay(500);
    const newAssignment = { ...assignment, id: `a${Date.now()}` };
    await googleSheetsService.addAssignment(newAssignment);
    assignments.push(newAssignment);
    return newAssignment;
  },

  updateAssignment: async (id: string, data: Partial<Assignment>): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(400);
    const index = assignments.findIndex(a => a.id === id);
    if (index !== -1) {
      const updated = { ...assignments[index], ...data };
      await googleSheetsService.updateAssignment(updated);
      assignments[index] = updated;
    }
  },

  deleteAssignment: async (id: string): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(400);
    await googleSheetsService.deleteAssignment(id);
    assignments = assignments.filter(a => a.id !== id);
    grades = grades.filter(g => g.assignmentId !== id);
  },

  getGrades: async (classId: string): Promise<Grade[]> => {
    if (initPromise) await initPromise;
    await delay(400);
    // Filter grades for assignments belonging to this class
    const classAssignmentIds = assignments.filter(a => a.classId === classId).map(a => a.id);
    return grades.filter(g => classAssignmentIds.includes(g.assignmentId));
  },

  updateGrade: async (studentId: string, assignmentId: string, score: number): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(200);
    await googleSheetsService.updateGrade(studentId, assignmentId, score);
    const existingIndex = grades.findIndex(g => g.studentId === studentId && g.assignmentId === assignmentId);
    if (existingIndex >= 0) {
      grades[existingIndex].score = score;
    } else {
      grades.push({ studentId, assignmentId, score });
    }
  },

  updateGradesBatch: async (newGrades: Grade[]): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(500);
    await googleSheetsService.saveGradesBatch(newGrades);
    newGrades.forEach(ng => {
      const existingIndex = grades.findIndex(g => g.studentId === ng.studentId && g.assignmentId === ng.assignmentId);
      if (existingIndex >= 0) {
        grades[existingIndex].score = ng.score;
      } else {
        grades.push(ng);
      }
    });
  },

  // Settings
  getSettings: async () => {
    if (initPromise) await initPromise;
    await delay(300);
    return { ...systemSettings };
  },

  updateSettings: async (data: any) => {
    if (initPromise) await initPromise;
    await delay(500);
    systemSettings = { ...systemSettings, ...data };
    return systemSettings;
  }
};

