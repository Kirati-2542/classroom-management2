import { z } from 'zod';
import { UserRole } from '../../types';

export const UserSchema = z.object({
    username: z.string(),
    name: z.string(),
    role: z.enum(['teacher', 'parent'] as [UserRole, ...UserRole[]]),
    studentName: z.string().optional(),
    password: z.string().optional(),
    avatar: z.string().optional(),
});

export const StudentSchema = z.object({
    id: z.string(),
    name: z.string(),
    classId: z.string(),
    dob: z.string(), // ISO date string or similar
    parentName: z.string().optional(),
    parentPhone: z.string().optional(),
});

export const ClassroomSchema = z.object({
    id: z.string(),
    name: z.string(),
    subjects: z.array(z.string()),
    level: z.string(),
    studentCount: z.coerce.number().optional().default(0),
    emoji: z.string(),
    teacher: z.string(),
});

export const AttendanceRecordSchema = z.object({
    date: z.string(),
    status: z.enum(['present', 'late', 'absent', 'leave', 'sick']),
    subject: z.string().optional(),
});

export const StudentAttendanceSchema = z.object({
    studentId: z.string(),
    records: z.array(AttendanceRecordSchema),
});

export const AssignmentSchema = z.object({
    id: z.string(),
    classId: z.string(),
    subject: z.string(),
    title: z.string(),
    maxScore: z.coerce.number(),
    dueDate: z.string(),
    type: z.enum(['score', 'checklist']).optional().default('score'),
    assignedDate: z.string().optional(),
});

export const GradeSchema = z.object({
    studentId: z.string(),
    assignmentId: z.string(),
    score: z.coerce.number(),
    submittedDate: z.string().optional(),
});

// Arrays for batch validation
export const StudentsArraySchema = z.array(StudentSchema);
export const ClassroomsArraySchema = z.array(ClassroomSchema);
export const AssignmentsArraySchema = z.array(AssignmentSchema);
// Helper for validating lists and filtering out invalid items
export const validateList = <T>(schema: z.ZodSchema<T>, list: any[], label: string): T[] => {
    if (!Array.isArray(list)) {
        console.error(`Validation Failed: ${label} is not an array`);
        return [];
    }
    const validItems: T[] = [];
    let errorCount = 0;
    list.forEach((item, index) => {
        const result = schema.safeParse(item);
        if (result.success) {
            validItems.push(result.data);
        } else {
            errorCount++;
            if (errorCount <= 5) { // Only log first 5 errors to avoid spam
                console.warn(`Validation Error in ${label} at index ${index}:`, result.error.flatten());
            }
        }
    });
    if (errorCount > 0) {
        console.warn(`Total ${errorCount} invalid items skipped in ${label}`);
    }
    return validItems;
};
