import { User } from '../../types';
import { googleSheetsService } from '../googleSheets';
import { students, initPromise } from './state';
import { delay } from './core';

export const login = async (type: 'teacher' | 'parent', credentials: any): Promise<{ success: boolean; user?: User; message?: string }> => {
    if (initPromise) await initPromise;
    await delay(800);
    try {
        const users = await googleSheetsService.getUsers();
        if (type === 'teacher') {
            const user = users.find(u => u.username === credentials.username && u.role === 'teacher');
            // Check password from sheet
            if (user && user.password === credentials.password) {
                return { success: true, user };
            }
            return { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านผิด' };
        } else {
            // Parent login by Student ID
            const student = students.find(s => s.id === credentials.studentId);
            if (student && student.dob === credentials.birthDate) {
                return { success: true, user: { username: 'parent', name: student.parentName || 'ผู้ปกครอง', role: 'parent', studentName: student.name } };
            }
            return { success: false, message: 'ไม่พบข้อมูลนักเรียน' };
        }
    } catch (e: any) {
        console.error("Login error:", e);
        return { success: false, message: e.message || 'Connection error' };
    }
};

export const updateUser = async (username: string, data: Partial<User>): Promise<void> => {
    if (initPromise) await initPromise;
    await delay(500);
    await googleSheetsService.updateUser(username, data);
};
