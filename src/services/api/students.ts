import { Student } from '../../types';
import { supabase } from '../supabase';
import { students, setStudents, classrooms, initPromise } from './state';


export const getStudentsByClass = async (classId: string, forceRefresh: boolean = false): Promise<Student[]> => {
    if (initPromise) await initPromise;
    if (forceRefresh) {
        const { data: freshStudents, error } = await supabase
            .from('students')
            .select('id, name, nickname, student_id, class_id, dob, parent_name, parent_phone');

        if (!error && freshStudents) {
            const mappedStudents: Student[] = freshStudents.map((s: any) => ({
                id: s.id,
                name: s.name,
                nickname: s.nickname,
                studentId: s.student_id,
                classId: s.class_id,
                dob: s.dob,
                parentName: s.parent_name,
                parentPhone: s.parent_phone
            }));
            setStudents(mappedStudents); // Update cache

            // Also update student counts for all classrooms based on fresh data
            classrooms.forEach(c => {
                c.studentCount = mappedStudents.filter(s => s.classId === c.id).length;
            });
        }
    }

    if (!classId) return students;
    return students.filter(s => s.classId === classId);
};

export const addStudent = async (student: Student): Promise<Student> => {
    if (initPromise) await initPromise;

    // Ensure unique ID if not provided or conflict
    if (students.some(s => s.id === student.id)) {
        throw new Error("Student ID already exists");
    }

    const dbData = {
        id: student.id,
        name: student.name,
        nickname: student.nickname,
        student_id: student.studentId,
        class_id: student.classId,
        dob: student.dob,
        parent_name: student.parentName,
        parent_phone: student.parentPhone
    };

    const { error } = await supabase
        .from('students')
        .insert(dbData);

    if (error) {
        console.error("Add student error:", error);
        throw error;
    }

    students.push(student);

    // Update student count in class (local only, no DB column)
    const cls = classrooms.find(c => c.id === student.classId);
    if (cls) {
        cls.studentCount++;
    }

    return student;
};

export const updateStudent = async (id: string, data: Partial<Student>): Promise<void> => {
    if (initPromise) await initPromise;


    // 1. Prevent Duplicate ID
    if (data.id && data.id !== id) {
        const exists = students.some(s => s.id === data.id);
        if (exists) {
            throw new Error(`รหัสนักเรียน ${data.id} มีอยู่ในระบบแล้ว กรุณาใช้รหัสอื่น`);
        }
    }

    const oldStudent = students.find(s => s.id === id);
    if (oldStudent && data.classId && oldStudent.classId !== data.classId) {
        // Handle class change
        const oldClass = classrooms.find(c => c.id === oldStudent.classId);
        if (oldClass) {
            oldClass.studentCount--;
        }
        const newClass = classrooms.find(c => c.id === data.classId);
        if (newClass) {
            newClass.studentCount++;
        }
    }

    if (oldStudent) {
        const updatedStudent = { ...oldStudent, ...data };

        const dbData: any = {};
        if (data.id !== undefined) dbData.id = data.id;
        if (data.name !== undefined) dbData.name = data.name;
        if (data.nickname !== undefined) dbData.nickname = data.nickname;
        if (data.studentId !== undefined) dbData.student_id = data.studentId;
        if (data.classId !== undefined) dbData.class_id = data.classId;
        if (data.dob !== undefined) dbData.dob = data.dob;
        if (data.parentName !== undefined) dbData.parent_name = data.parentName;
        if (data.parentPhone !== undefined) dbData.parent_phone = data.parentPhone;

        const { error } = await supabase
            .from('students')
            .update(dbData)
            .eq('id', id);

        if (error) {
            console.error("Update student error:", error);
            throw error;
        }

        setStudents(students.map(s => s.id === id ? updatedStudent : s));
    }
};

export const deleteStudent = async (id: string): Promise<void> => {
    if (initPromise) await initPromise;

    const student = students.find(s => s.id === id);
    if (student) {
        const cls = classrooms.find(c => c.id === student.classId);
        if (cls) {
            cls.studentCount--;
        }
    }

    const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', id);

    if (error) {
        console.error("Delete student error:", error);
        throw error;
    }

    setStudents(students.filter(s => s.id !== id));

    // Grades cleanup
    const { grades, setGrades } = await import('./state');
    setGrades(grades.filter(g => g.studentId !== id));
    await supabase.from('grades').delete().eq('student_id', id);
};

export const updateStudentsBatch = async (updates: Student[], targetClassId?: string) => {
    if (initPromise) await initPromise;

    // Safety: If targetClassId is provided, ensure all updates are for that classroom only
    const safeUpdates = targetClassId
        ? updates.filter(u => u.classId === targetClassId)
        : updates;

    if (safeUpdates.length === 0) return;

    const dbData = safeUpdates.map(u => ({
        id: u.id,
        name: u.name,
        nickname: u.nickname,
        student_id: u.studentId,
        class_id: u.classId,
        dob: u.dob,
        parent_name: u.parentName,
        parent_phone: u.parentPhone
    }));

    const { error } = await supabase
        .from('students')
        .upsert(dbData, { onConflict: 'id' });

    if (error) {
        console.error("Batch update students error:", error);
        throw error;
    }

    // Update local cache
    safeUpdates.forEach(u => {
        const idx = students.findIndex(s => s.id === u.id);
        if (idx !== -1) {
            students[idx] = u;
        } else {
            students.push(u);
        }
    });

    // Recalculate counts for all affected classrooms
    const affectedClassIds = new Set(safeUpdates.map(u => u.classId));
    for (const cid of affectedClassIds) {
        const cls = classrooms.find(c => c.id === cid);
        if (cls) {
            cls.studentCount = students.filter(s => s.classId === cid).length;
        }
    }
};
