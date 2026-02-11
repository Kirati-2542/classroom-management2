import { Classroom } from '../../types';
import { supabase } from '../supabase';
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
    const newId = `c${Date.now()}`;
    const newClass = { ...classroom, id: newId };
    const { studentCount, ...dbData } = newClass;

    const { error } = await supabase
        .from('classrooms')
        .insert(dbData);

    if (error) {
        console.error("Add classroom error:", error);
        throw error;
    }

    classrooms.push(newClass as Classroom);
    return newClass as Classroom;
};

export const updateClassroom = async (id: string, data: Partial<Classroom>): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(500);
    const existing = classrooms.find(c => c.id === id);
    if (existing) {
        const { studentCount: _, ...dbData } = data;
        const updated = { ...existing, ...data };

        const { error } = await supabase
            .from('classrooms')
            .update(dbData)
            .eq('id', id);

        if (error) {
            console.error("Update classroom error:", error);
            throw error;
        }

        setClassrooms(classrooms.map(c => c.id === id ? updated : c));
    }
};

export const deleteClassroom = async (id: string): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(500);

    const { error } = await supabase
        .from('classrooms')
        .delete()
        .eq('id', id);

    if (error) {
        console.error("Delete classroom error:", error);
        throw error;
    }

    setClassrooms(classrooms.filter(c => c.id !== id));
};
