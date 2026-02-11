/// <reference types="vite/client" />
import { KJUR } from 'jsrsasign';
import { Classroom, Student, Assignment, Grade, User } from '../types';
import { normalizeDate } from '../utils/dateUtils';

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
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
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
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
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
        await ensureSheet('Classrooms', ['id', 'name', 'subjects', 'level', 'studentCount', 'emoji', 'teacher']);
        await ensureSheet('Students', ['id', 'name', 'classId', 'dob', 'parentName', 'parentPhone']);
        await ensureSheet('Assignments', ['id', 'classId', 'title', 'maxScore', 'dueDate', 'subject', 'type']);
        await ensureSheet('Grades', ['studentId', 'assignmentId', 'score']);
        await ensureSheet('Attendance', ['classId', 'date', 'studentId', 'status', 'subject']);
        await ensureSheet('Settings', ['key', 'value']);
        await this.fixUsersSheet();
        await this.migrateClassrooms(); // Helper to migrate old single subject to JSON array string
    },

    async migrateClassrooms() {
        // One-time migration: Check if Classrooms need subjects update
        // (Optional: Implement if strictly needed, but logic below handles reading both)
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
        const rows = mapRows(data.values, ['id', 'name', 'subjects', 'level', 'studentCount', 'emoji', 'teacher']);
        return rows.map(r => {
            let subjects: string[] = [];
            try {
                // Try parsing as JSON array
                if (r.subjects && r.subjects.startsWith('[')) {
                    subjects = JSON.parse(r.subjects);
                } else if (r.subjects) {
                    // Legacy: treat as single item array
                    subjects = [r.subjects];
                }
            } catch (e) {
                subjects = [r.subjects || 'General'];
            }

            return {
                ...r,
                subjects,
                studentCount: parseInt(r.studentCount || '0')
            };
        });
    },

    async addClassroom(c: Classroom) {
        // Store subjects as JSON string
        const subjectsStr = JSON.stringify(c.subjects);
        await appendRow('Classrooms!A:G', [c.id, c.name, subjectsStr, c.level, c.studentCount, c.emoji, c.teacher]);
    },

    async updateClassroom(c: Classroom) {
        const data = await fetchSheet('Classrooms!A2:G');
        const rows = data.values || [];
        const index = rows.findIndex((r: any[]) => r[0] === c.id);

        if (index !== -1) {
            const range = `Classrooms!A${index + 2}:G${index + 2}`;
            const subjectsStr = JSON.stringify(c.subjects);
            await updateRow(range, [c.id, c.name, subjectsStr, c.level, c.studentCount, c.emoji, c.teacher]);
        }
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

    async saveStudentsBatch(students: Student[]) {
        const data = await fetchSheet('Students!A2:F');
        const rows = data.values || [];

        const updates: { range: string, values: any[] }[] = [];
        const newRows: any[] = [];

        for (const s of students) {
            const index = rows.findIndex((r: any[]) => r[0] && String(r[0]).trim() === String(s.id).trim());
            if (index !== -1) {
                // Update
                updates.push({
                    range: `Students!A${index + 2}:F${index + 2}`,
                    values: [s.id, s.name, s.classId, s.dob, s.parentName, s.parentPhone]
                });
            } else {
                // Insert
                newRows.push([s.id, s.name, s.classId, s.dob, s.parentName, s.parentPhone]);
            }
        }

        // Execute updates
        for (const update of updates) {
            await updateRow(update.range, update.values);
        }

        // Execute inserts
        if (newRows.length > 0) {
            await appendRows('Students!A:F', newRows);
        }
    },

    async getAssignments(): Promise<Assignment[]> {
        const data = await fetchSheet('Assignments!A2:H');
        // New Schema: id, classId, subject, title, maxScore, dueDate
        // Map carefully since old rows might not have subject in 3rd col
        // Actually mapRows is positional. If sheet has new col inserted, old rows shift? No, appendRow adds to end.
        // We defined schema as: ['id', 'classId', 'subject', 'title', 'maxScore', 'dueDate']
        // If old data was [id, classId, title, maxScore, dueDate], then 'subject' index is problematic if we just shift headers.
        // Strategy: New assignments will use new schema. For old ones, we might need migration or robust reading.
        // Given 'ensureSheet' creates if not exists, existing sheet won't change columns automatically.
        // **CRITICAL**: We are adding a column. If we insert 'subject' at index 2, old rows will have 'title' at index 2.
        // For simplicity in this text-based modification without full DB migration tools:
        // We will APPEND 'subject' to the END for existing sheets, but the 'ensureSheet' above put it in middle.
        // Let's adjust 'ensureSheet' to put 'subject' at the END for safety? No, user wants clean structure.
        // We will assume we might need to handle mixed data or just accept that 'title' might be in 'subject' slot for old rows? 
        // Better: Let's assume user starts fresh or we handle it.
        // Wait, 'ensureSheet' only adds headers if NEW sheet. If existing, it does nothing.
        // So Real Data in user sheet is consistent [id, classId, title, maxScore, dueDate].
        // We must append 'subject' at end to not break existing rows.
        // Let's change ensureSheet in the first chunk to: ['id', 'classId', 'title', 'maxScore', 'dueDate', 'subject']
        // BUT Typescript edit in chunk 1 is already made. Let's fix logic here.
        // If we read 6 cols:
        const rows = data.values || [];
        return rows.map((r: any[]) => {
            // Check if we have 6 cols. 
            // If 6 cols, assuming [id, classId, subject, title, maxScore, dueDate] OR [id, classId, title, maxScore, dueDate, subject]
            // This is risky. Let's stick to appending subject at the END for backward compatibility.
            // I will override the ensureSheet columns in my mind: use [..., subject] at end.
            // But let's check what I wrote in chunk 1... I wrote 'subject' at index 2. 
            // That's bad for existing data.
            // I will fix `ensureSheet` call in chunk 1 to be safe? No, I can't edit previous chunk now.
            // I will write robust reader here.

            // Actually, let's assume standard order: id, classId, title, maxScore, dueDate, subject (new col)
            // This is safest.
            const legacy = r.length < 6;
            // If legacy (5 cols), subject is undefined/default.
            return {
                id: r[0],
                classId: r[1],
                subject: r[5] || 'General',
                title: r[2],
                maxScore: parseInt(r[3]),
                dueDate: r[4],
                type: r[6] || 'score',
                assignedDate: r[7] || ''
            };
        }).filter((a: Assignment) => a.id && a.classId); // Filter out empty or invalid rows
    },

    async addAssignment(a: Assignment) {
        // Manual append to ensure starting at Column A
        const data = await fetchSheet('Assignments!A:A');
        const rows = data.values || [];
        const nextRow = rows.length + 1;

        const range = `Assignments!A${nextRow}:H${nextRow}`;
        await updateRow(range, [a.id, a.classId, a.title, a.maxScore, a.dueDate, a.subject, a.type || 'score', a.assignedDate || '']);
    },

    async updateAssignment(a: Assignment) {
        const data = await fetchSheet('Assignments!A2:A');
        const rows = data.values || [];
        const index = rows.findIndex((r: any[]) => r[0] === a.id);

        if (index !== -1) {
            // Update row with new schema (subject at end)
            const range = `Assignments!A${index + 2}:H${index + 2}`;
            await updateRow(range, [a.id, a.classId, a.title, a.maxScore, a.dueDate, a.subject, a.type || 'score', a.assignedDate || '']);
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
        const data = await fetchSheet('Grades!A2:D');
        const rows = mapRows(data.values, ['studentId', 'assignmentId', 'score', 'submittedDate']);
        return rows.map(r => ({ ...r, score: parseFloat(r.score) }));
    },

    async updateGrade(studentId: string, assignmentId: string, score: number, submittedDate?: string) {
        // Find row index to update (inefficient but works for small data)
        const data = await fetchSheet('Grades!A2:C');
        const rows = data.values || [];
        const index = rows.findIndex((r: any[]) => r[0] === studentId && r[1] === assignmentId);

        if (index !== -1) {
            // Update (A2 is index 0, so row is index + 2)
            // Update score (C) and submittedDate (D)
            const range = `Grades!C${index + 2}:D${index + 2}`;
            await updateRow(range, [score, submittedDate || '']);
        } else {
            await appendRow('Grades!A:D', [studentId, assignmentId, score, submittedDate || '']);
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
                    range: `Grades!C${index + 2}:D${index + 2}`,
                    values: [g.score, g.submittedDate || '']
                });
            } else {
                newRows.push([g.studentId, g.assignmentId, g.score, g.submittedDate || '']);
            }
        });

        for (const update of updates) {
            await updateRow(update.range, update.values);
        }

        if (newRows.length > 0) {
            await appendRows('Grades!A:D', newRows);
        }
    },

    async getAttendance(): Promise<any[]> {
        const data = await fetchSheet('Attendance!A2:E');
        // Schema: classId, date, studentId, status, subject (new col at end)
        const rows = data.values || [];
        return rows.map((r: any[]) => ({
            classId: r[0],
            date: r[1],
            studentId: r[2],
            status: r[3],
            subject: r[4] || 'General'
        }));
    },

    async updateAttendance(classId: string, date: string, studentId: string, status: string, subject: string = 'General') {
        const data = await fetchSheet('Attendance!A2:E');
        const rows = data.values || [];
        const targetDate = normalizeDate(date);
        // Match subject too
        const index = rows.findIndex((r: any[]) =>
            r[0] === classId &&
            normalizeDate(r[1]) === targetDate &&
            r[2] === studentId &&
            (r[4] || 'General') === subject
        );

        if (index !== -1) {
            const range = `Attendance!D${index + 2}`;
            await updateRow(range, [status]);
        } else {
            // Append with subject
            await appendRow('Attendance!A:E', [classId, date, studentId, status, subject]);
        }
    },

    async saveAttendanceBatch(classId: string, date: string, attendanceData: Record<string, string>, subject: string = 'General') {
        const data = await fetchSheet('Attendance!A2:E');
        const rows = data.values || [];
        const targetDate = normalizeDate(date);

        const updates: { range: string, values: any[] }[] = [];
        const newRows: any[] = [];

        Object.entries(attendanceData).forEach(([studentId, status]) => {
            const index = rows.findIndex((r: any[]) =>
                r[0] === classId &&
                normalizeDate(r[1]) === targetDate &&
                r[2] === studentId &&
                (r[4] || 'General') === subject
            );

            if (index !== -1) {
                // Update
                updates.push({
                    range: `Attendance!D${index + 2}`,
                    values: [status]
                });
            } else {
                // Insert
                newRows.push([classId, date, studentId, status, subject]);
            }
        });

        for (const update of updates) {
            await updateRow(update.range, update.values);
        }

        if (newRows.length > 0) {
            await appendRows('Attendance!A:E', newRows);
        }
    },

    async deleteAttendance(classId: string, date: string) {
        const token = await getAccessToken();
        const data = await fetchSheet('Attendance!A2:D');
        const rows = data.values || [];

        // Find all row indices to delete (0-based from rows array, so +2 for sheet index)
        // We need to delete from bottom up to avoid index shifting issues if we were doing one by one,
        // but batchUpdate handles this if we are careful.
        // Actually, for batchUpdate deleteDimension, it's best to group contiguous ranges or just send all requests.
        // The API applies them; however, indices shift if we delete one by one.
        // But if we send a single batch request with multiple deleteDimension, the documentation says:
        // "The requests will be applied in the order they are specified."
        // So we MUST sort descending by index to avoid shifting affecting subsequent deletes in the same batch.

        const indicesToDelete: number[] = [];
        const targetDate = normalizeDate(date);
        rows.forEach((r: any[], i: number) => {
            if (r[0] === classId && normalizeDate(r[1]) === targetDate) {
                indicesToDelete.push(i + 2); // Sheet row index (1-based)
            }
        });

        if (indicesToDelete.length === 0) return;

        indicesToDelete.sort((a, b) => b - a); // Descending

        const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;
        const metaRes = await fetch(metaUrl, { headers: { Authorization: `Bearer ${token}` } });
        const meta = await metaRes.json();
        const sheet = meta.sheets.find((s: any) => s.properties.title === 'Attendance');
        if (!sheet) return;
        const sheetId = sheet.properties.sheetId;

        const requests = indicesToDelete.map(rowIndex => ({
            deleteDimension: {
                range: {
                    sheetId: sheetId,
                    dimension: "ROWS",
                    startIndex: rowIndex - 1, // API uses 0-based index
                    endIndex: rowIndex
                }
            }
        }));

        const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`;
        await fetch(batchUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ requests })
        });
    },

    async getSettings(): Promise<Record<string, string>> {
        await this.init();
        const data = await fetchSheet('Settings!A2:B');
        const rows = data.values || [];
        const settings: Record<string, string> = {};
        rows.forEach((r: any[]) => {
            if (r[0]) settings[r[0]] = r[1] || '';
        });
        return settings;
    },

    async saveSettings(settings: Record<string, string>) {
        const data = await fetchSheet('Settings!A2:B');
        const rows = data.values || [];

        for (const [key, value] of Object.entries(settings)) {
            const index = rows.findIndex((r: any[]) => r[0] === key);
            if (index !== -1) {
                // Update
                await updateRow(`Settings!B${index + 2}`, [value]);
            } else {
                // Append
                await appendRow('Settings!A:B', [key, value]);
            }
        }
    }
};
