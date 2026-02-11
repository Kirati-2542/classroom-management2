import { googleSheetsService } from '../googleSheets';
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
        const [rawClassrooms, rawStudents, rawAssignments, rawGrades, rawAttendance] = await Promise.all([
            googleSheetsService.getClassrooms(),
            googleSheetsService.getStudents(),
            googleSheetsService.getAssignments(),
            googleSheetsService.getGrades(),
            googleSheetsService.getAttendance()
        ]);

        // Validate Data
        const validStudents = validateList(StudentSchema, rawStudents, 'Students');
        const validAssignments = validateList(AssignmentSchema, rawAssignments, 'Assignments');
        const validGrades = validateList(GradeSchema, rawGrades, 'Grades');
        // Attendance uses a simpler schema or might need looser validation as it's complex
        // For now, let's validate it if we have a schema, or trust it if it's too dynamic.
        // We have StudentAttendanceSchema.
        const validAttendance = validateList(StudentAttendanceSchema, rawAttendance, 'Attendance');

        // Classrooms need validation too
        const validClassrooms = validateList(ClassroomSchema, rawClassrooms, 'Classrooms');

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

        console.log("Data refreshed successfully with validation");
    } catch (e) {
        console.error("Failed to load data from Sheets", e);
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
        const sheetsSettings = await googleSheetsService.getSettings();
        // Merge with defaults if keys missing
        setSystemSettings({ ...systemSettings, ...sheetsSettings });
    } catch (e) {
        console.error("Failed to load settings from sheets", e);
    }
    return { ...systemSettings };
};

export const updateSettings = async (data: any) => {
    const { initPromise: promise } = await import('./state');
    if (promise) await promise;

    await delay(500);
    const newSettings = { ...systemSettings, ...data };
    setSystemSettings(newSettings);
    await googleSheetsService.saveSettings(newSettings);
    return newSettings;
};
