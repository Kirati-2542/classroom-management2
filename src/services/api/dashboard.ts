import { supabase } from '../supabase';
import {
    attendance, students, classrooms,
    setAttendance, setStudents, setClassrooms,
    initPromise
} from './state';
import { delay } from './core';

export const getDashboardStats = async () => {
    if (initPromise) await initPromise;
    await delay(800);

    // Refresh data and update cache from Supabase
    const [
        { data: _attendance },
        { data: _students },
        { data: _classrooms }
    ] = await Promise.all([
        supabase.from('attendance').select('*'),
        supabase.from('students').select('*'),
        supabase.from('classrooms').select('*')
    ]);

    if (_attendance) setAttendance(_attendance);
    if (_students) setStudents(_students);
    if (_classrooms) setClassrooms(_classrooms);

    const attRef = _attendance || attendance;
    const stuRef = _students || students;
    const clsRef = _classrooms || classrooms;

    // 1. Overall Stats
    const totalRecords = attRef.length;
    if (totalRecords === 0) {
        return {
            attendanceRate: 0,
            lateRate: 0,
            absentRate: 0,
            chartData: [],
            followUpStudents: []
        };
    }

    const presentCount = attRef.filter(a => a.status === 'present').length;
    const lateCount = attRef.filter(a => a.status === 'late').length;
    const absentCount = attRef.filter(a => a.status === 'absent').length;

    const attendanceRate = Math.round(((presentCount + lateCount) / totalRecords) * 100);
    const lateRate = Math.round((lateCount / totalRecords) * 100);
    const absentRate = Math.round((absentCount / totalRecords) * 100);

    // 2. Chart Data (Last 5 days with data)
    const dateGroups = attRef.reduce((acc, curr) => {
        if (!acc[curr.date]) acc[curr.date] = { total: 0, present: 0 };
        acc[curr.date].total++;
        if (curr.status === 'present' || curr.status === 'late') acc[curr.date].present++;
        return acc;
    }, {} as Record<string, { total: number, present: number }>);

    const sortedDates = Object.keys(dateGroups).sort();
    const last5Dates = sortedDates.slice(-5);

    const chartData = last5Dates.map(date => {
        const dayName = new Date(date).toLocaleDateString('th-TH', { weekday: 'short' });
        return {
            name: dayName,
            present: dateGroups[date].present,
        };
    });

    // 3. Follow Up Students
    const studentStats = stuRef.map(s => {
        const sRecords = attRef.filter(a => a.studentId === s.id);
        const sAbsent = sRecords.filter(a => a.status === 'absent').length;
        const sLate = sRecords.filter(a => a.status === 'late').length;
        return { ...s, sAbsent, sLate };
    });

    const followUpStudents = studentStats
        .filter(s => s.sAbsent >= 2 || s.sLate >= 2)
        .map(s => {
            let status = '';
            if (s.sAbsent >= 2) status = `ขาดเรียน ${s.sAbsent} ครั้ง`;
            else if (s.sLate >= 2) status = `มาสาย ${s.sLate} ครั้ง`;

            const cls = clsRef.find(c => c.id === s.classId);

            return {
                id: s.id,
                name: s.name,
                room: cls ? cls.name : '-',
                status,
                type: s.sAbsent >= 2 ? 'absent' : 'late'
            };
        })
        .slice(0, 5);

    return {
        attendanceRate,
        lateRate,
        absentRate,
        chartData,
        followUpStudents
    };
};
