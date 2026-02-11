import { Classroom } from '../../types';
import { googleSheetsService } from '../googleSheets';
import { classrooms, students, setClassrooms, initPromise } from './state';
import { delay } from './core';

export const getClassrooms = async (): Promise<Classroom[]> => {
    if (initPromise) await initPromise;
    await delay(500);
    // Calculate student count dynamically to ensure accuracy
    return classrooms.map(c => ({
        ...c,
        studentCount: students.filter(s => s.classId === c.id).length
    }));
};

export const addClassroom = async (classroom: Omit<Classroom, 'id'>): Promise<Classroom> => {
    if (initPromise) await initPromise;
    await delay(500);
    const newClass = { ...classroom, id: `c${Date.now()}` };
    await googleSheetsService.addClassroom(newClass);
    // classrooms is mutable array, push works if we don't reassign
    classrooms.push(newClass);
    return newClass;
};

export const updateClassroom = async (id: string, data: Partial<Classroom>): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(500);
    const existing = classrooms.find(c => c.id === id);
    if (existing) {
        const updated = { ...existing, ...data };
        await googleSheetsService.updateClassroom(updated);
        // Reassign using setter because .map creates new array
        setClassrooms(classrooms.map(c => c.id === id ? updated : c));
    }
};

export const deleteClassroom = async (id: string): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(500);
    await googleSheetsService.deleteClassroom(id);
    // Reassign using setter
    setClassrooms(classrooms.filter(c => c.id !== id));
};
