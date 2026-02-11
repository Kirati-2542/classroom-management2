import { supabase } from '../supabase';
import {
    setClassrooms, setStudents, setAssignments, setGrades, setAttendance,
    systemSettings, setSystemSettings,
    setInitPromise
} from './state';
import {
    validateList,
    StudentSchema,
    AssignmentSchema,
    ClassroomSchema,
    GradeSchema,
    StudentAttendanceSchema
} from '../validation/schemas';

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to refresh data
export const refreshData = async () => {
    try {
        const [
            { data: rawClassrooms },
            { data: rawStudents },
            { data: rawAssignments },
            { data: rawGrades },
            { data: rawAttendance }
        ] = await Promise.all([
            supabase.from('classrooms').select('*'),
            supabase.from('students').select('*'),
            supabase.from('assignments').select('*'),
            supabase.from('grades').select('*'),
            supabase.from('attendance').select('*')
        ]);

        // Map Raw Data (snake_case -> camelCase)
        const mappedStudents = (rawStudents || []).map((s: any) => ({
            id: s.id,
            name: s.name,
            nickname: s.nickname,
            studentId: s.student_id,
            classId: s.class_id,
            dob: s.dob,
            parentName: s.parent_name,
            parentPhone: s.parent_phone
        }));

        const mappedAssignments = (rawAssignments || []).map((a: any) => ({
            id: a.id,
            classId: a.class_id,
            subject: a.subject,
            title: a.title,
            maxScore: a.max_score,
            dueDate: a.due_date || a.assigned_date, // Fallback if due_date missing
            assignedDate: a.assigned_date,
            description: a.description
        }));

        const mappedGrades = (rawGrades || []).map((g: any) => ({
            studentId: g.student_id,
            assignmentId: g.assignment_id,
            score: g.score,
            submittedDate: g.submitted_date
        }));

        // Group Attendance records by studentId
        const attendanceMap = (rawAttendance || []).reduce((acc: any, curr: any) => {
            if (!acc[curr.student_id]) {
                acc[curr.student_id] = { studentId: curr.student_id, records: [] };
            }
            acc[curr.student_id].records.push({
                date: curr.date,
                status: curr.status,
                subject: curr.subject // If we add subject to attendance
            });
            return acc;
        }, {} as any);
        const mappedAttendance = Object.values(attendanceMap);

        // Validate Data
        const validStudents = validateList(StudentSchema, mappedStudents, 'Students');
        const validAssignments = validateList(AssignmentSchema, mappedAssignments, 'Assignments');
        const validGrades = validateList(GradeSchema, mappedGrades, 'Grades');
        const validAttendance = validateList(StudentAttendanceSchema, mappedAttendance, 'Attendance');
        const validClassrooms = validateList(ClassroomSchema, rawClassrooms || [], 'Classrooms');

        // Recalculate student counts based on valid students
        const finalClassrooms = validClassrooms.map(c => ({
            ...c,
            studentCount: validStudents.filter(s => s.classId === c.id).length
        }));

        // Update State
        setClassrooms(finalClassrooms);
        setStudents(validStudents);
        setAssignments(validAssignments);
        setGrades(validGrades);
        setAttendance(validAttendance);

        console.log("Data refreshed successfully from Supabase");
    } catch (e) {
        console.error("Failed to load data from Supabase", e);
    }
};

// Initial load
setInitPromise(refreshData());

export const initPromise = () => import('./state').then(m => m.initPromise);

// Settings API
export const getSettings = async () => {
    const { initPromise: promise } = await import('./state');
    if (promise) await promise;

    await delay(300);
    try {
        const { data: supabaseSettings, error } = await supabase
            .from('settings')
            .select('key, value');

        if (!error && supabaseSettings) {
            const settingsMap = supabaseSettings.reduce((acc: any, curr: any) => {
                acc[curr.key] = curr.value;
                return acc;
            }, {});
            setSystemSettings({ ...systemSettings, ...settingsMap });
        }
    } catch (e) {
        console.error("Failed to load settings from Supabase", e);
    }
    return { ...systemSettings };
};

export const updateSettings = async (data: any) => {
    const { initPromise: promise } = await import('./state');
    if (promise) await promise;

    await delay(500);
    const newSettings = { ...systemSettings, ...data };

    // Upsert settings in Supabase
    for (const [key, value] of Object.entries(data)) {
        await supabase
            .from('settings')
            .upsert({ key, value: String(value) }, { onConflict: 'key' });
    }

    setSystemSettings(newSettings);
    return newSettings;
};
