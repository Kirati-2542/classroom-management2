import { Assignment, Grade } from '../../types';
import { supabase } from '../supabase';
import { assignments, grades, setAssignments, setGrades, initPromise } from './state';
import { delay } from './core';

export const getAssignments = async (classId: string, subject?: string): Promise<Assignment[]> => {
    if (initPromise) await initPromise;
    await delay(400);
    return assignments.filter(a =>
        a.classId === classId &&
        (!subject || a.subject === subject)
    );
};

export const addAssignment = async (assignment: Omit<Assignment, 'id'>): Promise<Assignment> => {
    if (initPromise) await initPromise;
    await delay(500);
    const today = new Date().toISOString().split('T')[0];
    const newAssignment = {
        ...assignment,
        id: `a${Date.now()}`,
        assignedDate: assignment.assignedDate || today
    };

    const dbData = {
        id: newAssignment.id,
        class_id: newAssignment.classId,
        subject: newAssignment.subject,
        title: newAssignment.title,
        max_score: newAssignment.maxScore,
        assigned_date: newAssignment.assignedDate,
        due_date: newAssignment.dueDate
    };

    const { error } = await supabase
        .from('assignments')
        .insert(dbData);

    if (error) {
        console.error("Add assignment error:", error);
        throw error;
    }

    assignments.push(newAssignment as Assignment);
    return newAssignment as Assignment;
};

export const updateAssignment = async (id: string, data: Partial<Assignment>): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(400);
    const index = assignments.findIndex(a => a.id === id);
    if (index !== -1) {
        const updated = { ...assignments[index], ...data };

        const dbData: any = {};
        if (data.classId) dbData.class_id = data.classId;
        if (data.subject) dbData.subject = data.subject;
        if (data.title) dbData.title = data.title;
        if (data.maxScore) dbData.max_score = data.maxScore;
        if (data.assignedDate) dbData.assigned_date = data.assignedDate;
        if (data.dueDate) dbData.due_date = data.dueDate;

        const { error } = await supabase
            .from('assignments')
            .update(dbData)
            .eq('id', id);

        if (error) {
            console.error("Update assignment error:", error);
            throw error;
        }

        assignments[index] = updated;
    }
};

export const deleteAssignment = async (id: string): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(400);

    const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', id);

    if (error) {
        console.error("Delete assignment error:", error);
        throw error;
    }

    setAssignments(assignments.filter(a => a.id !== id));
    setGrades(grades.filter(g => g.assignmentId !== id));
    await supabase.from('grades').delete().eq('assignmentId', id);
};

export const getGrades = async (classId: string): Promise<Grade[]> => {
    if (initPromise) await initPromise;
    await delay(400);
    const classAssignmentIds = assignments.filter(a => a.classId === classId).map(a => a.id);
    return grades.filter(g => classAssignmentIds.includes(g.assignmentId));
};

export const updateGrade = async (studentId: string, assignmentId: string, score: number): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(200);
    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabase
        .from('grades')
        .upsert({
            student_id: studentId,
            assignment_id: assignmentId,
            score,
            submitted_date: today
        }, { onConflict: 'student_id,assignment_id' });

    if (error) {
        console.error("Update grade error:", error);
        throw error;
    }

    const existingIndex = grades.findIndex(g => g.studentId === studentId && g.assignmentId === assignmentId);
    if (existingIndex >= 0) {
        grades[existingIndex].score = score;
        grades[existingIndex].submittedDate = today;
    } else {
        grades.push({ studentId, assignmentId, score, submittedDate: today });
    }
};

export const updateGradesBatch = async (newGrades: Grade[]): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(500);
    const today = new Date().toISOString().split('T')[0];
    const gradesWithDate = newGrades.map(g => ({ ...g, submittedDate: today }));

    const dbData = gradesWithDate.map(g => ({
        student_id: g.studentId,
        assignment_id: g.assignmentId,
        score: g.score,
        submitted_date: g.submittedDate
    }));

    const { error } = await supabase
        .from('grades')
        .upsert(dbData, { onConflict: 'student_id,assignment_id' });

    if (error) {
        console.error("Batch update grades error:", error);
        throw error;
    }

    gradesWithDate.forEach(ng => {
        const existingIndex = grades.findIndex(g => g.studentId === ng.studentId && g.assignmentId === ng.assignmentId);
        if (existingIndex >= 0) {
            grades[existingIndex].score = ng.score;
            grades[existingIndex].submittedDate = ng.submittedDate;
        } else {
            grades.push(ng);
        }
    });
};
