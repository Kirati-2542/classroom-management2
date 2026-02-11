import { googleSheetsService } from '../googleSheets';
import { attendance, setAttendance, students, classrooms, assignments, grades, initPromise } from './state';
import { delay } from './core'; // or util
import { normalizeDate } from '../../utils/dateUtils';
import { getClassrooms } from './classrooms'; // Cross-module import

export const submitAttendance = async (classId: string, date: string, data: any, subject: string): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(800);
    try {
        await googleSheetsService.saveAttendanceBatch(classId, date, data, subject);

        // Update local cache
        Object.entries(data).forEach(([studentId, status]) => {
            // Correct type casting for status
            const s = status as string;
            const existingIndex = attendance.findIndex(a =>
                a.classId === classId &&
                a.studentId === studentId &&
                a.date === date &&
                (a.subject || 'General') === subject
            );
            if (existingIndex >= 0) {
                attendance[existingIndex].status = s;
            } else {
                attendance.push({ classId, date, studentId, status: s, subject });
            }
        });

    } catch (e) {
        console.error("Failed to save attendance:", e);
        throw e;
    }
};

export const deleteAttendanceDate = async (classId: string, date: string): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(500);
    await googleSheetsService.deleteAttendance(classId, date);
    // Update local cache
    setAttendance(attendance.filter(a => !(a.classId === classId && a.date === date)));
};

export const getAttendanceHistory = async (classId: string, subject: string = 'General') => {
    if (initPromise) await initPromise;
    await delay(600);

    // Refresh to get latest - Note: Original called googleSheetsService.getAttendance() directly
    // This updates local variable 'attendance' in api.ts scope.
    // We should do the same here using setAttendance
    const freshAttendance = await googleSheetsService.getAttendance();
    setAttendance(freshAttendance);

    const classStudents = students.filter(s => s.classId === classId);

    // Filter by subject matches or default 'General' if undefined in DB
    const subjectAttendance = freshAttendance.filter(a =>
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
};

export const updateAttendanceHistory = async (classId: string, studentId: string, dateIndex: number, status: string, subject: string = 'General') => {
    if (initPromise) await initPromise;
    await delay(200);

    const history = await getAttendanceHistory(classId, subject); // Pass subject
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
};

export const updateAttendanceHistoryBatch = async (updates: { classId: string, studentId: string, date: string, status: string, subject: string }[]) => {
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
};

export const getStudentAttendanceStats = async (studentId: string, classId: string) => {
    if (initPromise) await initPromise;
    await delay(500);

    // Ensure we have latest data
    const freshAttendance = await googleSheetsService.getAttendance();
    setAttendance(freshAttendance);

    const studentRecords = freshAttendance.filter(a => a.classId === classId && a.studentId === studentId);

    const total = studentRecords.length;
    const present = studentRecords.filter(a => a.status === 'present').length;
    const absent = studentRecords.filter(a => a.status === 'absent').length;
    const late = studentRecords.filter(a => a.status === 'late').length;
    const sick = studentRecords.filter(a => a.status === 'sick').length;
    const leave = studentRecords.filter(a => a.status === 'leave').length;

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
};

export const getClassroomDailyReport = async (classId: string, date: string, subject: string = 'General') => {
    if (initPromise) await initPromise;
    await delay(300);

    // 1. Get all subjects for this class
    const _classrooms = await getClassrooms();
    const cls = _classrooms.find(c => c.id === classId);
    const allSubjects = cls?.subjects && cls.subjects.length > 0 ? cls.subjects : ['General'];

    // 2. Fetch history for ALL subjects in parallel
    const historyPromises = allSubjects.map(subj => getAttendanceHistory(classId, subj));
    const histories = await Promise.all(historyPromises);

    // 3. Normalize Date
    const normalizedTarget = normalizeDate(date);

    // 4. Build Student Map
    const baseHistory = histories[0] || { students: [], dates: [] };

    const studentMap = new Map<string, { id: string, name: string, no: number, attendance: Record<string, string> }>();

    baseHistory.students.forEach(s => {
        studentMap.set(s.id, { id: s.id, name: s.name, no: s.no || 0, attendance: {} }); // no: 0 fallback
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

    // 5. Calculate Stats
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

    // Calculate Assignment Stats
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
        students: studentsStatus,
        subjects: allSubjects
    };
};

export const getAttendanceRange = async (classId: string, startDate: string, endDate: string, subject: string = 'General') => {
    const history = await getAttendanceHistory(classId, subject);

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
};
