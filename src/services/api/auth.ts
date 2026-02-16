import { User } from '../../types';
import { supabase } from '../supabase';
import { students, initPromise } from './state';


export const login = async (type: 'teacher' | 'parent', credentials: any): Promise<{ success: boolean; user?: User; message?: string }> => {
    if (initPromise) await initPromise;

    try {
        if (type === 'teacher') {
            const { data: user, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('username', credentials.username)
                .eq('role', 'teacher')
                .single();

            if (error || !user) {
                return { success: false, message: 'ไม่พบผู้ใช้งาน' };
            }

            // Simple password check (In real apps, use Supabase Auth or hashed passwords)
            if (user.password === credentials.password) {
                return { success: true, user };
            }
            return { success: false, message: 'รหัสผ่านไม่ถูกต้อง' };
        } else {
            // Parent login by Student ID or system ID
            let { data: student, error } = await supabase
                .from('students')
                .select('*')
                .eq('student_id', credentials.studentId)
                .single();

            if (error || !student) {
                // Try finding by internal ID if student_id not found
                const { data: studentById, error: errorById } = await supabase
                    .from('students')
                    .select('*')
                    .eq('id', credentials.studentId)
                    .single();

                if (errorById || !studentById) {
                    return { success: false, message: 'ไม่พบข้อมูลนักเรียน' };
                }
                student = studentById;
            }

            // Check DOB (Handle both CE and BE formats)
            // DB stores BE (e.g., 2561-03-15), Input is CE (e.g., 2018-03-15)
            const inputDate = credentials.birthDate; // YYYY-MM-DD (CE)

            // Create BE version of input date
            let inputDateBE = '';
            if (inputDate) {
                const parts = inputDate.split('-');
                if (parts.length === 3) {
                    const yearBE = parseInt(parts[0]) + 543;
                    inputDateBE = `${yearBE}-${parts[1]}-${parts[2]}`;
                }
            }

            if (student.dob === inputDate || student.dob === inputDateBE) {
                return { success: true, user: { username: 'parent', name: student.parentName || 'ผู้ปกครอง', role: 'parent', studentName: student.name } };
            }
            return { success: false, message: 'วันเดือนปีเกิดไม่ถูกต้อง' };
        }
    } catch (e: any) {
        console.error("Login error:", e);
        return { success: false, message: e.message || 'Connection error' };
    }
};

export const updateUser = async (username: string, data: Partial<User>): Promise<void> => {
    if (initPromise) await initPromise;


    const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('username', username);

    if (error) {
        console.error("Update user error:", error);
        throw error;
    }
};
