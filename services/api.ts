
import { Classroom, Student, User, Assignment, Grade } from '../types';
import { googleSheetsService } from './googleSheets';
import { normalizeDate } from '../utils/dateUtils';

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
    // Calculate student count dynamically to ensure accuracy
    return classrooms.map(c => ({
      ...c,
      studentCount: students.filter(s => s.classId === c.id).length
    }));
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
    const existing = classrooms.find(c => c.id === id);
    if (existing) {
      const updated = { ...existing, ...data };
      await googleSheetsService.updateClassroom(updated);
      classrooms = classrooms.map(c => c.id === id ? updated : c);
    }
  },

  deleteClassroom: async (id: string): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(500);
    await googleSheetsService.deleteClassroom(id);
    classrooms = classrooms.filter(c => c.id !== id);
  },

  getStudentsByClass: async (classId: string, forceRefresh: boolean = false): Promise<Student[]> => {
    if (initPromise) await initPromise;
    if (forceRefresh) {
      const freshStudents = await googleSheetsService.getStudents();
      students = freshStudents; // Update cache

      // Also update student counts for all classrooms based on fresh data
      classrooms = classrooms.map(c => ({
        ...c,
        studentCount: students.filter(s => s.classId === c.id).length
      }));
    }
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
    if (cls) {
      cls.studentCount++;
      await googleSheetsService.updateClassroom(cls);
    }

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
      if (oldClass) {
        oldClass.studentCount--;
        await googleSheetsService.updateClassroom(oldClass);
      }
      const newClass = classrooms.find(c => c.id === data.classId);
      if (newClass) {
        newClass.studentCount++;
        await googleSheetsService.updateClassroom(newClass);
      }
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
      if (cls) {
        cls.studentCount--;
        await googleSheetsService.updateClassroom(cls);
      }
    }
    await googleSheetsService.deleteStudent(id);
    students = students.filter(s => s.id !== id);
    // Also cleanup grades
    grades = grades.filter(g => g.studentId !== id);
  },

  updateStudentsBatch: async (updates: Student[]) => {
    if (initPromise) await initPromise;
    await googleSheetsService.saveStudentsBatch(updates);

    // Update local cache
    updates.forEach(u => {
      const idx = students.findIndex(s => s.id === u.id);
      if (idx !== -1) {
        students[idx] = u;
      } else {
        students.push(u);
      }
    });

    // Recalculate counts for all affected classrooms
    const affectedClassIds = new Set(updates.map(u => u.classId));
    for (const cid of affectedClassIds) {
      const cls = classrooms.find(c => c.id === cid);
      if (cls) {
        cls.studentCount = students.filter(s => s.classId === cid).length;
        await googleSheetsService.updateClassroom(cls);
      }
    }
  },

  submitAttendance: async (classId: string, date: string, data: any, subject: string): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(800);
    try {
      await googleSheetsService.saveAttendanceBatch(classId, date, data, subject);

      // Update local cache
      Object.entries(data).forEach(([studentId, status]) => {
        const existingIndex = attendance.findIndex(a =>
          a.classId === classId &&
          a.studentId === studentId &&
          a.date === date &&
          (a.subject || 'General') === subject
        );
        if (existingIndex >= 0) {
          attendance[existingIndex].status = status;
        } else {
          attendance.push({ classId, date, studentId, status: status as string, subject });
        }
      });

    } catch (e) {
      console.error("Failed to save attendance:", e);
      throw e;
    }
  },

  deleteAttendanceDate: async (classId: string, date: string): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(500);
    await googleSheetsService.deleteAttendance(classId, date);
    // Update local cache
    attendance = attendance.filter(a => !(a.classId === classId && a.date === date));
  },

  getAttendanceHistory: async (classId: string, subject: string = 'General') => {
    if (initPromise) await initPromise;
    await delay(600);

    // Refresh to get latest
    attendance = await googleSheetsService.getAttendance();

    const classStudents = students.filter(s => s.classId === classId);



    // Filter by subject matches or default 'General' if undefined in DB
    const subjectAttendance = attendance.filter(a =>
      a.classId === classId &&
      (a.subject || 'General') === subject
    );

    // Generate dates
    const rawDates = subjectAttendance.map(a => a.date);
    const normalizedDatesSet = new Set(rawDates.map(d => normalizeDate(d)));
    const existingDates = Array.from(normalizedDatesSet);

    // If no data, provide some default dates
    let dates = existingDates;

    // Sort dates
    dates.sort();

    const historyData = classStudents.map((s, i) => {
      const studentAttendance = subjectAttendance.filter(a => a.studentId === s.id);
      const studentStatuses = dates.map(d => {
        // Find record that matches this normalized date
        const record = studentAttendance.find(a => normalizeDate(a.date) === d);
        return record ? record.status : '-';
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



  updateAttendanceHistory: async (classId: string, studentId: string, dateIndex: number, status: string, subject: string = 'General') => {
    if (initPromise) await initPromise;
    await delay(200);

    const history = await api.getAttendanceHistory(classId, subject); // Pass subject
    const date = history.dates[dateIndex];

    if (date) {
      await googleSheetsService.updateAttendance(classId, date, studentId, status, subject);

      // Update local cache
      const existingIndex = attendance.findIndex(a =>
        a.classId === classId &&
        a.studentId === studentId &&
        a.date === date &&
        (a.subject || 'General') === subject
      );
      if (existingIndex >= 0) {
        attendance[existingIndex].status = status;
      } else {
        attendance.push({ classId, date, studentId, status, subject });
      }
    }

    return true;
  },

  updateAttendanceHistoryBatch: async (updates: { classId: string, studentId: string, date: string, status: string, subject: string }[]) => {
    if (initPromise) await initPromise;
    await delay(200);

    // Process updates
    for (const update of updates) {
      const { classId, studentId, date, status, subject } = update;

      // Update google sheets
      await googleSheetsService.updateAttendance(classId, date, studentId, status, subject);

      // Update local cache
      const existingIndex = attendance.findIndex(a =>
        a.classId === classId &&
        a.studentId === studentId &&
        a.date === date &&
        (a.subject || 'General') === subject
      );

      if (existingIndex >= 0) {
        attendance[existingIndex].status = status;
      } else {
        attendance.push({ classId, date, studentId, status, subject });
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

  getClassroomDailyReport: async (classId: string, date: string, subject: string = 'General') => {
    if (initPromise) await initPromise;
    await delay(300);

    // 1. Get all subjects for this class
    const classrooms = await api.getClassrooms();
    const cls = classrooms.find(c => c.id === classId);
    const allSubjects = cls?.subjects && cls.subjects.length > 0 ? cls.subjects : ['General'];

    // 2. Fetch history for ALL subjects in parallel
    const historyPromises = allSubjects.map(subj => api.getAttendanceHistory(classId, subj));
    const histories = await Promise.all(historyPromises);

    // 3. Normalize Date
    const normalizedTarget = normalizeDate(date);

    // 4. Build Student Map (using first history for student list, assuming sync)
    // If no history exists, use empty list.
    const baseHistory = histories[0] || { students: [], dates: [] };

    // Create a map of student ID -> { name, attendance: { [subject]: status } }
    const studentMap = new Map<string, { id: string, name: string, no: number, attendance: Record<string, string> }>();

    // Initialize map with students from the first available history (or all combined if needed, but usually consistent)
    baseHistory.students.forEach(s => {
      studentMap.set(s.id, { id: s.id, name: s.name, no: s.no, attendance: {} });
    });

    // Populate attendance for each subject
    histories.forEach((hist, index) => {
      const subj = allSubjects[index];
      const dateIdx = hist.dates.findIndex(d => normalizeDate(d) === normalizedTarget);

      hist.students.forEach(s => {
        const studentRec = studentMap.get(s.id);
        if (studentRec) {
          const status = dateIdx !== -1 ? (s.statuses[dateIdx] || '-') : '-';
          studentRec.attendance[subj] = status;
        }
      });
    });

    const studentsStatus = Array.from(studentMap.values()).map(s => ({
      id: s.id,
      name: s.name,
      no: s.no,
      attendance: s.attendance
    }));

    // 5. Calculate Stats (Backward Compatibility uses 'subject' param)
    // If 'subject' is not in list (e.g. 'General' but class has 'Math'), default to first subject stats?
    // Or just use the data we just fetched.
    const primarySubject = allSubjects.includes(subject) ? subject : allSubjects[0];
    const statsStudents = studentsStatus.map(s => ({
      status: s.attendance[primarySubject] || '-'
    }));

    const stats = {
      present: statsStudents.filter(s => s.status === 'present').length,
      late: statsStudents.filter(s => s.status === 'late').length,
      absent: statsStudents.filter(s => s.status === 'absent').length,
      sick: statsStudents.filter(s => s.status === 'sick').length,
      leave: statsStudents.filter(s => s.status === 'leave').length,
    };

    // Calculate Assignment Stats - Show ALL subjects for the daily report
    const classAssignments = assignments.filter(a => a.classId === classId);

    const assignedTodayList = classAssignments
      .filter(a => normalizeDate(a.assignedDate) === normalizedTarget)
      .map(a => ({
        id: a.id,
        title: a.title,
        subject: a.subject,
        maxScore: a.maxScore
      }));

    const classAssignmentIds = classAssignments.map(a => a.id);
    const submittedTodayList = grades
      .filter(g =>
        classAssignmentIds.includes(g.assignmentId) &&
        normalizeDate(g.submittedDate) === normalizedTarget
      )
      .map(g => {
        const student = students.find(s => s.id === g.studentId);
        const assignment = assignments.find(a => a.id === g.assignmentId);
        return {
          studentName: student?.name || 'Unknown',
          assignmentTitle: assignment?.title || 'Unknown',
          subject: assignment?.subject || 'General',
          score: g.score
        };
      });

    return {
      date,
      total: studentsStatus.length,
      ...stats,
      assigned: assignedTodayList.length,
      assignedDetails: assignedTodayList,
      submitted: submittedTodayList.length,
      submittedDetails: submittedTodayList,
      students: studentsStatus, // New structure: attendance is object
      subjects: allSubjects // Return list of subjects for UI columns
    };
  },

  getAttendanceRange: async (classId: string, startDate: string, endDate: string, subject: string = 'General') => {
    const history = await api.getAttendanceHistory(classId, subject); // Reuses existing logic

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const validIndices: number[] = [];
    const filteredDates: string[] = [];

    history.dates.forEach((d, i) => {
      const curr = new Date(d);
      if (curr >= start && curr <= end) {
        validIndices.push(i);
        filteredDates.push(d);
      }
    });

    const filteredStudents = history.students.map(s => ({
      no: s.no,
      id: s.id,
      name: s.name,
      statuses: validIndices.map(i => s.statuses[i])
    }));

    return { dates: filteredDates, students: filteredStudents };
  },

  // Grading API
  // Grading API
  getAssignments: async (classId: string, subject?: string): Promise<Assignment[]> => {
    if (initPromise) await initPromise;
    await delay(400);
    return assignments.filter(a =>
      a.classId === classId &&
      (!subject || a.subject === subject)
    );
  },

  addAssignment: async (assignment: Omit<Assignment, 'id'>): Promise<Assignment> => {
    if (initPromise) await initPromise;
    await delay(500);
    const today = new Date().toISOString().split('T')[0];
    const newAssignment = {
      ...assignment,
      id: `a${Date.now()}`,
      assignedDate: assignment.assignedDate || today
    };
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
    const today = new Date().toISOString().split('T')[0];
    await googleSheetsService.updateGrade(studentId, assignmentId, score, today);
    const existingIndex = grades.findIndex(g => g.studentId === studentId && g.assignmentId === assignmentId);
    if (existingIndex >= 0) {
      grades[existingIndex].score = score;
      grades[existingIndex].submittedDate = today;
    } else {
      grades.push({ studentId, assignmentId, score, submittedDate: today });
    }
  },

  updateGradesBatch: async (newGrades: Grade[]): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(500);
    const today = new Date().toISOString().split('T')[0];
    const gradesWithDate = newGrades.map(g => ({ ...g, submittedDate: today }));
    await googleSheetsService.saveGradesBatch(gradesWithDate);
    gradesWithDate.forEach(ng => {
      const existingIndex = grades.findIndex(g => g.studentId === ng.studentId && g.assignmentId === ng.assignmentId);
      if (existingIndex >= 0) {
        grades[existingIndex].score = ng.score;
        grades[existingIndex].submittedDate = ng.submittedDate;
      } else {
        grades.push(ng);
      }
    });
  },

  // Settings
  getSettings: async () => {
    if (initPromise) await initPromise;
    await delay(300);
    try {
      const sheetsSettings = await googleSheetsService.getSettings();
      // Merge with defaults if keys missing
      systemSettings = { ...systemSettings, ...sheetsSettings };
    } catch (e) {
      console.error("Failed to load settings from sheets", e);
    }
    return { ...systemSettings };
  },

  updateSettings: async (data: any) => {
    if (initPromise) await initPromise;
    await delay(500);
    systemSettings = { ...systemSettings, ...data };
    await googleSheetsService.saveSettings(systemSettings);
    return systemSettings;
  }
};

