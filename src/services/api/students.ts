import { Student } from '../../types';
import { googleSheetsService } from '../googleSheets';
import { students, setStudents, classrooms, initPromise } from './state';
import { delay } from './core';

export const getStudentsByClass = async (classId: string, forceRefresh: boolean = false): Promise<Student[]> => {
    if (initPromise) await initPromise;
    if (forceRefresh) {
        const freshStudents = await googleSheetsService.getStudents();
        setStudents(freshStudents); // Update cache

        // Also update student counts for all classrooms based on fresh data
        // modifying objects in place is fine for cache
        classrooms.forEach(c => {
            c.studentCount = freshStudents.filter(s => s.classId === c.id).length;
        });
    }
    await delay(500);
    if (!classId) return students;
    return students.filter(s => s.classId === classId);
};

export const addStudent = async (student: Student): Promise<Student> => {
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
};

export const updateStudent = async (id: string, data: Partial<Student>): Promise<void> => {
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
        // Use setter to ensure reactivity if we were using a reactive store, but here just updating the array ref
        setStudents(students.map(s => s.id === id ? updatedStudent : s));
    }
};

export const deleteStudent = async (id: string): Promise<void> => {
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
    setStudents(students.filter(s => s.id !== id));
    // Note: Grades cleanup is handled in grades service or needs to be coordinated?
    // Original api.ts did: grades = grades.filter(g => g.studentId !== id);
    // We need to handle this. Ideally grades service exports a `removeStudentGrades` function?
    // Or accessing grades directly from state?
    // Let's import grades/setGrades from state for now to match original behavior logic.
    import('./state').then(({ grades, setGrades }) => {
        setGrades(grades.filter(g => g.studentId !== id));
    });
};

export const updateStudentsBatch = async (updates: Student[]) => {
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
};
