/// <reference types="vite/client" />
import { KJUR } from 'jsrsasign';
import { Classroom, Student, Assignment, Grade, User } from '../types';

const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID;
const CLIENT_EMAIL = import.meta.env.VITE_GOOGLE_SERVICE_ACCOUNT_EMAIL;

const cleanKey = (key: string | undefined) => {
    if (!key) return '';
    let cleaned = key.replace(/\\n/g, '\n');
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        cleaned = cleaned.slice(1, -1);
    }
    return cleaned;
};

const PRIVATE_KEY = cleanKey(import.meta.env.VITE_GOOGLE_PRIVATE_KEY);

let accessToken: string | null = null;
let tokenExpiry: number = 0;

const getAccessToken = async () => {
    if (accessToken && Date.now() < tokenExpiry) {
        return accessToken;
    }

    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const claim = {
        iss: CLIENT_EMAIL,
        scope: 'https://www.googleapis.com/auth/spreadsheets',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
    };

    const sHeader = JSON.stringify(header);
    const sClaim = JSON.stringify(claim);

    if (!PRIVATE_KEY) throw new Error('Missing Private Key');

    let sJWS;
    try {
        sJWS = KJUR.jws.JWS.sign(null, header, claim, PRIVATE_KEY);
    } catch (e: any) {
        console.error('Signing failed:', e);
        throw new Error(`Signing failed: ${e.message || e}`);
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${sJWS}`,
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error_description || data.error);

    accessToken = data.access_token;
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Buffer 1 min
    return accessToken;
};

const fetchSheet = async (range: string) => {
    const token = await getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Failed to fetch ${range}`);
    return res.json();
};

const appendRow = async (range: string, values: any[]) => {
    const token = await getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [values] }),
    });
    if (!res.ok) throw new Error(`Failed to append to ${range}`);
};

const appendRows = async (range: string, values: any[][]) => {
    const token = await getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: values }),
    });
    if (!res.ok) throw new Error(`Failed to append rows to ${range}`);
};

const updateRow = async (range: string, values: any[]) => {
    const token = await getAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?valueInputOption=USER_ENTERED`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [values] }),
    });
    if (!res.ok) throw new Error(`Failed to update ${range}`);
};

// Helper to map array to object based on headers
const mapRows = (rows: any[][], headers: string[]) => {
    if (!rows || rows.length === 0) return [];
    return rows.map(row => {
        const obj: any = {};
        headers.forEach((h, i) => {
            obj[h] = row[i];
        });
        return obj;
    });
};

// Auto-init sheets (simplified)
const ensureSheet = async (title: string, headers: string[]) => {
    // Check if sheet exists
    const token = await getAccessToken();
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;
    const metaRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${token}` } });
    const meta = await metaRes.json();

    const sheetExists = meta.sheets?.some((s: any) => s.properties.title === title);
    if (!sheetExists) {
        // Create sheet
        const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`;
        await fetch(batchUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                requests: [{ addSheet: { properties: { title } } }]
            })
        });
        // Add headers
        await appendRow(`${title}!A1`, headers);

        // Seed Users if creating Users sheet
        if (title === 'Users') {
            await appendRow('Users!A:E', ['admin', 'Admin User', 'teacher', '', '1234']);
            await appendRow('Users!A:E', ['parent', 'Parent User', 'parent', 'เด็กชายสมชาย ใจดี', '1234']);
        }
    }
};

export const googleSheetsService = {
    async init() {
        await ensureSheet('Users', ['username', 'name', 'role', 'studentName', 'password', 'avatar']);
        await ensureSheet('Classrooms', ['id', 'name', 'subject', 'level', 'studentCount', 'emoji', 'teacher']);
        await ensureSheet('Students', ['id', 'name', 'classId', 'dob', 'parentName', 'parentPhone']);
        await ensureSheet('Assignments', ['id', 'classId', 'title', 'maxScore', 'dueDate']);
        await ensureSheet('Grades', ['studentId', 'assignmentId', 'score']);
        await ensureSheet('Attendance', ['classId', 'date', 'studentId', 'status']);
        await this.fixUsersSheet();
    },

    async fixUsersSheet() {
        // Migration: Ensure all users have a password and avatar
        const data = await fetchSheet('Users!A:F');
        const rows = data.values || [];
        if (rows.length > 1) { // Has data
            // Check header for password (col 4) and avatar (col 5)
            // Note: If password exists but avatar doesn't, we need to handle that

            // Simple check: if header length < 6, add avatar
            if (rows[0].length < 6) {
                await updateRow('Users!F1', ['avatar']);
            }

            // Check rows
            for (let i = 1; i < rows.length; i++) {
                // Fix password if missing
                if (!rows[i][4]) {
                    await updateRow(`Users!E${i + 1}`, ['1234']);
                }
                // Fix avatar if missing (optional, can be empty)
            }
        }
    },

    async getUsers(): Promise<User[]> {
        await this.init(); // Ensure sheets exist
        const data = await fetchSheet('Users!A2:F');
        return mapRows(data.values, ['username', 'name', 'role', 'studentName', 'password', 'avatar']);
    },

    async updateUser(username: string, data: Partial<User>) {
        const sheetData = await fetchSheet('Users!A2:F');
        const rows = sheetData.values || [];
        const index = rows.findIndex((r: any[]) => r[0] === username);

        if (index !== -1) {
            const currentRow = rows[index];
            // Map current row to object to merge
            const currentUser = {
                username: currentRow[0],
                name: currentRow[1],
                role: currentRow[2],
                studentName: currentRow[3],
                password: currentRow[4],
                avatar: currentRow[5]
            };

            const updated = { ...currentUser, ...data };
            const range = `Users!A${index + 2}:F${index + 2}`;
            await updateRow(range, [updated.username, updated.name, updated.role, updated.studentName, updated.password, updated.avatar]);
        }
    },

    async getClassrooms(): Promise<Classroom[]> {
        const data = await fetchSheet('Classrooms!A2:G');
        const rows = mapRows(data.values, ['id', 'name', 'subject', 'level', 'studentCount', 'emoji', 'teacher']);
        return rows.map(r => ({ ...r, studentCount: parseInt(r.studentCount || '0') }));
    },

    async addClassroom(c: Classroom) {
        await appendRow('Classrooms!A:G', [c.id, c.name, c.subject, c.level, c.studentCount, c.emoji, c.teacher]);
    },

    async getStudents(): Promise<Student[]> {
        const data = await fetchSheet('Students!A2:F');
        return mapRows(data.values, ['id', 'name', 'classId', 'dob', 'parentName', 'parentPhone']);
    },

    async addStudent(s: Student) {
        await appendRow('Students!A:F', [s.id, s.name, s.classId, s.dob, s.parentName, s.parentPhone]);
    },

    async updateStudent(oldId: string, s: Student) {
        const data = await fetchSheet('Students!A2:F');
        const rows = data.values || [];
        const targetId = String(oldId).trim();
        const index = rows.findIndex((r: any[]) => r[0] && String(r[0]).trim() === targetId);

        if (index !== -1) {
            const range = `Students!A${index + 2}:F${index + 2}`;
            await updateRow(range, [s.id, s.name, s.classId, s.dob, s.parentName, s.parentPhone]);
        }
    },

    async getAssignments(): Promise<Assignment[]> {
        const data = await fetchSheet('Assignments!A2:E');
        const rows = mapRows(data.values, ['id', 'classId', 'title', 'maxScore', 'dueDate']);
        return rows.map(r => ({ ...r, maxScore: parseInt(r.maxScore) }));
    },

    async addAssignment(a: Assignment) {
        await appendRow('Assignments!A:E', [a.id, a.classId, a.title, a.maxScore, a.dueDate]);
    },

    async updateAssignment(a: Assignment) {
        const data = await fetchSheet('Assignments!A2:E');
        const rows = data.values || [];
        const index = rows.findIndex((r: any[]) => r[0] === a.id);

        if (index !== -1) {
            const range = `Assignments!A${index + 2}:E${index + 2}`;
            await updateRow(range, [a.id, a.classId, a.title, a.maxScore, a.dueDate]);
        }
    },

    async deleteRow(sheetTitle: string, id: string) {
        const token = await getAccessToken();

        // 1. Find the row index
        const data = await fetchSheet(`${sheetTitle}!A2:A`); // Just get IDs
        const rows = data.values || [];
        const targetId = String(id).trim();
        const index = rows.findIndex((r: any[]) => r[0] && String(r[0]).trim() === targetId);

        if (index !== -1) {
            // 2. Get Sheet ID
            const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;
            const metaRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${token}` } });
            const meta = await metaRes.json();
            const sheet = meta.sheets.find((s: any) => s.properties.title === sheetTitle);

            if (sheet) {
                const sheetId = sheet.properties.sheetId;
                const rowIndex = index + 1; // 0-based index in sheet (A2 is index 1)

                // 3. Delete Dimension
                const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`;
                await fetch(batchUrl, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        requests: [{
                            deleteDimension: {
                                range: {
                                    sheetId: sheetId,
                                    dimension: "ROWS",
                                    startIndex: rowIndex,
                                    endIndex: rowIndex + 1
                                }
                            }
                        }]
                    })
                });
            }
        }
    },

    async deleteAssignment(id: string) {
        await this.deleteRow('Assignments', id);
    },

    async deleteClassroom(id: string) {
        await this.deleteRow('Classrooms', id);
    },

    async deleteStudent(id: string) {
        await this.deleteRow('Students', id);
    },

    async getGrades(): Promise<Grade[]> {
        const data = await fetchSheet('Grades!A2:C');
        const rows = mapRows(data.values, ['studentId', 'assignmentId', 'score']);
        return rows.map(r => ({ ...r, score: parseFloat(r.score) }));
    },

    async updateGrade(studentId: string, assignmentId: string, score: number) {
        // Find row index to update (inefficient but works for small data)
        const data = await fetchSheet('Grades!A2:C');
        const rows = data.values || [];
        const index = rows.findIndex((r: any[]) => r[0] === studentId && r[1] === assignmentId);

        if (index !== -1) {
            // Update (A2 is index 0, so row is index + 2)
            const range = `Grades!C${index + 2}`;
            await updateRow(range, [score]);
        } else {
            await appendRow('Grades!A:C', [studentId, assignmentId, score]);
        }
    },

    async saveGradesBatch(grades: Grade[]) {
        const data = await fetchSheet('Grades!A2:C');
        const rows = data.values || [];

        const updates: { range: string, values: any[] }[] = [];
        const newRows: any[] = [];

        grades.forEach(g => {
            const index = rows.findIndex((r: any[]) => r[0] === g.studentId && r[1] === g.assignmentId);
            if (index !== -1) {
                updates.push({
                    range: `Grades!C${index + 2}`,
                    values: [g.score]
                });
            } else {
                newRows.push([g.studentId, g.assignmentId, g.score]);
            }
        });

        for (const update of updates) {
            await updateRow(update.range, update.values);
        }

        if (newRows.length > 0) {
            await appendRows('Grades!A:C', newRows);
        }
    },

    async getAttendance(): Promise<any[]> {
        const data = await fetchSheet('Attendance!A2:D');
        return mapRows(data.values, ['classId', 'date', 'studentId', 'status']);
    },

    async updateAttendance(classId: string, date: string, studentId: string, status: string) {
        const data = await fetchSheet('Attendance!A2:D');
        const rows = data.values || [];
        const index = rows.findIndex((r: any[]) => r[0] === classId && r[1] === date && r[2] === studentId);

        if (index !== -1) {
            const range = `Attendance!D${index + 2}`;
            await updateRow(range, [status]);
        } else {
            await appendRow('Attendance!A:D', [classId, date, studentId, status]);
        }
    },

    async saveAttendanceBatch(classId: string, date: string, attendanceData: Record<string, string>) {
        // 1. Get existing attendance to check for updates vs inserts
        const data = await fetchSheet('Attendance!A2:D');
        const rows = data.values || [];

        const updates: { range: string, values: any[] }[] = [];
        const newRows: any[] = [];

        Object.entries(attendanceData).forEach(([studentId, status]) => {
            const index = rows.findIndex((r: any[]) => r[0] === classId && r[1] === date && r[2] === studentId);
            if (index !== -1) {
                // Update existing
                updates.push({
                    range: `Attendance!D${index + 2}`,
                    values: [status]
                });
            } else {
                // Insert new
                newRows.push([classId, date, studentId, status]);
            }
        });

        for (const update of updates) {
            await updateRow(update.range, update.values);
        }

        if (newRows.length > 0) {
            await appendRows('Attendance!A:D', newRows);
        }
    }
};
