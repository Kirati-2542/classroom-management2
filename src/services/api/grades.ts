import { Assignment, Grade } from '../../types';
import { googleSheetsService } from '../googleSheets';
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
    await googleSheetsService.addAssignment(newAssignment);
    assignments.push(newAssignment);
    return newAssignment;
};

export const updateAssignment = async (id: string, data: Partial<Assignment>): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(400);
    const index = assignments.findIndex(a => a.id === id);
    if (index !== -1) {
        const updated = { ...assignments[index], ...data };
        await googleSheetsService.updateAssignment(updated);
        // update mutable array in place
        assignments[index] = updated;
    }
};

export const deleteAssignment = async (id: string): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(400);
    await googleSheetsService.deleteAssignment(id);
    // Reassign to filter
    setAssignments(assignments.filter(a => a.id !== id));
    // Also cleanup grades
    setGrades(grades.filter(g => g.assignmentId !== id));
};

export const getGrades = async (classId: string): Promise<Grade[]> => {
    if (initPromise) await initPromise;
    await delay(400);
    // Filter grades for assignments belonging to this class
    const classAssignmentIds = assignments.filter(a => a.classId === classId).map(a => a.id);
    return grades.filter(g => classAssignmentIds.includes(g.assignmentId));
};

export const updateGrade = async (studentId: string, assignmentId: string, score: number): Promise<void> => {
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
};

export const updateGradesBatch = async (newGrades: Grade[]): Promise<void> => {
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
};
