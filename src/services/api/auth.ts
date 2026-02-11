import { User } from '../../types';
import { supabase } from '../supabase';
import { students, initPromise } from './state';
import { delay } from './core';

export const login = async (type: 'teacher' | 'parent', credentials: any): Promise<{ success: boolean; user?: User; message?: string }> => {
    if (initPromise) await initPromise;
    await delay(800);
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
            // Parent login by Student ID
            const { data: student, error } = await supabase
                .from('students')
                .select('*')
                .eq('id', credentials.studentId)
                .single();

            if (error || !student) {
                return { success: false, message: 'ไม่พบข้อมูลนักเรียน' };
            }

            if (student.dob === credentials.birthDate) {
                return { success: true, user: { username: 'parent', name: student.parentName || 'ผู้ปกครอง', role: 'parent', studentName: student.name } };
            }
            return { success: false, message: 'วันเกิดไม่ถูกต้อง' };
        }
    } catch (e: any) {
        console.error("Login error:", e);
        return { success: false, message: e.message || 'Connection error' };
    }
};

export const updateUser = async (username: string, data: Partial<User>): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(500);

    const { error } = await supabase
        .from('profiles')
        .update(data)
        .eq('username', username);

    if (error) {
        console.error("Update user error:", error);
        throw error;
    }
};
