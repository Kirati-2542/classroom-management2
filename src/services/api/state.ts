import { Classroom, Student, Assignment, Grade } from '../../types';

// Cache State
export let classrooms: Classroom[] = [];
export let students: Student[] = [];
export let assignments: Assignment[] = [];
export let grades: Grade[] = [];
export let attendance: any[] = [];

export let systemSettings = {
    schoolName: 'โรงเรียนตัวอย่างวิทยา',
    academicYear: '2568',
    semester: '2'
};

export let initPromise: Promise<void> | null = null;

// Setters for updating state from other modules (e.g. core.ts)
export const setClassrooms = (v: Classroom[]) => { classrooms = v; };
export const setStudents = (v: Student[]) => { students = v; };
export const setAssignments = (v: Assignment[]) => { assignments = v; };
export const setGrades = (v: Grade[]) => { grades = v; };
export const setAttendance = (v: any[]) => { attendance = v; };
export const setSystemSettings = (v: any) => { systemSettings = v; };
export const setInitPromise = (v: Promise<void> | null) => { initPromise = v; };
