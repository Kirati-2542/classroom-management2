-- =============================================
-- Classroom Management System - Supabase SQL Setup
-- พร้อมใช้งานทุกฟังก์ชัน + Mock Data
-- =============================================

-- =============================================
-- 1. DROP EXISTING TABLES (ถ้ามี)
-- =============================================
DROP TABLE IF EXISTS grades CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS classrooms CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS settings CASCADE;

-- =============================================
-- 2. CREATE TABLES
-- =============================================

-- 2.1 Profiles (ข้อมูลผู้ใช้งาน - ครู/ผู้ปกครอง)
CREATE TABLE profiles (
    username TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('teacher', 'parent')),
    password TEXT,
    avatar TEXT,
    student_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 Classrooms (ห้องเรียน)
CREATE TABLE classrooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    subjects TEXT[] NOT NULL DEFAULT '{}',
    level TEXT NOT NULL DEFAULT '',
    emoji TEXT NOT NULL DEFAULT '📚',
    teacher TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 Students (นักเรียน)
CREATE TABLE students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nickname TEXT,
    student_id TEXT,
    class_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    dob TEXT,
    parent_name TEXT,
    parent_phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.4 Attendance (การเช็คชื่อ)
CREATE TABLE attendance (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('present', 'late', 'absent', 'leave', 'sick')),
    subject TEXT DEFAULT 'General',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.5 Assignments (งานที่มอบหมาย)
CREATE TABLE assignments (
    id TEXT PRIMARY KEY,
    class_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    title TEXT NOT NULL,
    max_score NUMERIC NOT NULL DEFAULT 0,
    due_date TEXT,
    assigned_date TEXT,
    type TEXT DEFAULT 'score' CHECK (type IN ('score', 'checklist')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.6 Grades (คะแนน)
CREATE TABLE grades (
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    score NUMERIC NOT NULL DEFAULT 0,
    submitted_date TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (student_id, assignment_id)
);

-- 2.7 Settings (ตั้งค่าระบบ)
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. CREATE INDEXES (เพิ่มประสิทธิภาพ)
-- =============================================
CREATE INDEX idx_students_class_id ON students(class_id);
CREATE INDEX idx_attendance_class_id ON attendance(class_id);
CREATE INDEX idx_attendance_student_id ON attendance(student_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_composite ON attendance(class_id, date, subject);
CREATE INDEX idx_assignments_class_id ON assignments(class_id);
CREATE INDEX idx_grades_student_id ON grades(student_id);
CREATE INDEX idx_grades_assignment_id ON grades(assignment_id);

-- =============================================
-- 4. ENABLE ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies: อนุญาตทุกการกระทำ (สำหรับ anon key)
-- ⚠️ ในโปรเจคจริง ควรจำกัดสิทธิ์ตาม role

CREATE POLICY "Allow all on profiles" ON profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on classrooms" ON classrooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on students" ON students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on attendance" ON attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on assignments" ON assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on grades" ON grades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on settings" ON settings FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- 5. MOCK DATA
-- =============================================

-- 5.1 ครูผู้สอน (Login: username=teacher, password=1234)
INSERT INTO profiles (username, name, role, password) VALUES
    ('teacher', 'คุณครูสมศรี', 'teacher', '1234');

-- 5.2 ห้องเรียน: ป.1/1 สอน 2 วิชา
INSERT INTO classrooms (id, name, subjects, level, emoji, teacher) VALUES
    ('c1', 'ป.1/1', ARRAY['คณิตศาสตร์', 'ภาษาไทย'], 'ป.1', '🌸', 'คุณครูสมศรี');

-- 5.3 นักเรียน 10 คน (วันเกิด format: YYYY-MM-DD ค.ศ.)
INSERT INTO students (id, name, nickname, student_id, class_id, dob, parent_name, parent_phone) VALUES
    ('s1',  'เด็กชายมารุต',   'มาร์ค',  '67001', 'c1', '2561-03-15', 'คุณแม่สมใจ',   '081-234-5678'),
    ('s2',  'เด็กหญิงปาริชาต', 'ปอ',    '67002', 'c1', '2561-05-22', 'คุณพ่อสมชาย',  '082-345-6789'),
    ('s3',  'เด็กชายณัฐพล',   'นัท',    '67003', 'c1', '2561-01-10', 'คุณแม่วิภา',   '083-456-7890'),
    ('s4',  'เด็กหญิงพิมพ์ชนก', 'พิมพ์', '67004', 'c1', '2561-07-08', 'คุณแม่สุภาพร', '084-567-8901'),
    ('s5',  'เด็กชายภูมิพัฒน์', 'ภูมิ',  '67005', 'c1', '2561-11-30', 'คุณพ่อวิชัย',  '085-678-9012'),
    ('s6',  'เด็กหญิงกัญญาณัฐ','แก้ม',  '67006', 'c1', '2561-09-14', 'คุณแม่นิดา',   '086-789-0123'),
    ('s7',  'เด็กชายธนกฤต',   'ต้น',    '67007', 'c1', '2561-04-25', 'คุณพ่อธนา',    '087-890-1234'),
    ('s8',  'เด็กหญิงอรวรรณ', 'แอน',    '67008', 'c1', '2561-08-03', 'คุณแม่อรุณ',   '088-901-2345'),
    ('s9',  'เด็กชายศุภกร',   'กร',     '67009', 'c1', '2561-12-19', 'คุณพ่อศุภชัย',  '089-012-3456'),
    ('s10', 'เด็กหญิงชนิดา',  'ชมพู่',  '67010', 'c1', '2561-06-07', 'คุณแม่ชนิตา',  '090-123-4567');

-- 5.4 การเช็คชื่อ (3 วัน ย้อนหลัง - วิชาคณิตศาสตร์)
INSERT INTO attendance (id, class_id, student_id, date, status, subject) VALUES
    -- วันที่ 1: 2026-02-12
    ('s1_2026-02-12_คณิตศาสตร์',  'c1', 's1',  '2026-02-12', 'present', 'คณิตศาสตร์'),
    ('s2_2026-02-12_คณิตศาสตร์',  'c1', 's2',  '2026-02-12', 'present', 'คณิตศาสตร์'),
    ('s3_2026-02-12_คณิตศาสตร์',  'c1', 's3',  '2026-02-12', 'late',    'คณิตศาสตร์'),
    ('s4_2026-02-12_คณิตศาสตร์',  'c1', 's4',  '2026-02-12', 'present', 'คณิตศาสตร์'),
    ('s5_2026-02-12_คณิตศาสตร์',  'c1', 's5',  '2026-02-12', 'absent',  'คณิตศาสตร์'),
    ('s6_2026-02-12_คณิตศาสตร์',  'c1', 's6',  '2026-02-12', 'present', 'คณิตศาสตร์'),
    ('s7_2026-02-12_คณิตศาสตร์',  'c1', 's7',  '2026-02-12', 'present', 'คณิตศาสตร์'),
    ('s8_2026-02-12_คณิตศาสตร์',  'c1', 's8',  '2026-02-12', 'present', 'คณิตศาสตร์'),
    ('s9_2026-02-12_คณิตศาสตร์',  'c1', 's9',  '2026-02-12', 'sick',    'คณิตศาสตร์'),
    ('s10_2026-02-12_คณิตศาสตร์', 'c1', 's10', '2026-02-12', 'present', 'คณิตศาสตร์'),

    -- วันที่ 2: 2026-02-13
    ('s1_2026-02-13_คณิตศาสตร์',  'c1', 's1',  '2026-02-13', 'present', 'คณิตศาสตร์'),
    ('s2_2026-02-13_คณิตศาสตร์',  'c1', 's2',  '2026-02-13', 'present', 'คณิตศาสตร์'),
    ('s3_2026-02-13_คณิตศาสตร์',  'c1', 's3',  '2026-02-13', 'present', 'คณิตศาสตร์'),
    ('s4_2026-02-13_คณิตศาสตร์',  'c1', 's4',  '2026-02-13', 'late',    'คณิตศาสตร์'),
    ('s5_2026-02-13_คณิตศาสตร์',  'c1', 's5',  '2026-02-13', 'absent',  'คณิตศาสตร์'),
    ('s6_2026-02-13_คณิตศาสตร์',  'c1', 's6',  '2026-02-13', 'present', 'คณิตศาสตร์'),
    ('s7_2026-02-13_คณิตศาสตร์',  'c1', 's7',  '2026-02-13', 'present', 'คณิตศาสตร์'),
    ('s8_2026-02-13_คณิตศาสตร์',  'c1', 's8',  '2026-02-13', 'leave',   'คณิตศาสตร์'),
    ('s9_2026-02-13_คณิตศาสตร์',  'c1', 's9',  '2026-02-13', 'present', 'คณิตศาสตร์'),
    ('s10_2026-02-13_คณิตศาสตร์', 'c1', 's10', '2026-02-13', 'present', 'คณิตศาสตร์'),

    -- วันที่ 3: 2026-02-14
    ('s1_2026-02-14_คณิตศาสตร์',  'c1', 's1',  '2026-02-14', 'present', 'คณิตศาสตร์'),
    ('s2_2026-02-14_คณิตศาสตร์',  'c1', 's2',  '2026-02-14', 'late',    'คณิตศาสตร์'),
    ('s3_2026-02-14_คณิตศาสตร์',  'c1', 's3',  '2026-02-14', 'present', 'คณิตศาสตร์'),
    ('s4_2026-02-14_คณิตศาสตร์',  'c1', 's4',  '2026-02-14', 'present', 'คณิตศาสตร์'),
    ('s5_2026-02-14_คณิตศาสตร์',  'c1', 's5',  '2026-02-14', 'absent',  'คณิตศาสตร์'),
    ('s6_2026-02-14_คณิตศาสตร์',  'c1', 's6',  '2026-02-14', 'present', 'คณิตศาสตร์'),
    ('s7_2026-02-14_คณิตศาสตร์',  'c1', 's7',  '2026-02-14', 'present', 'คณิตศาสตร์'),
    ('s8_2026-02-14_คณิตศาสตร์',  'c1', 's8',  '2026-02-14', 'present', 'คณิตศาสตร์'),
    ('s9_2026-02-14_คณิตศาสตร์',  'c1', 's9',  '2026-02-14', 'present', 'คณิตศาสตร์'),
    ('s10_2026-02-14_คณิตศาสตร์', 'c1', 's10', '2026-02-14', 'late',    'คณิตศาสตร์');

-- เช็คชื่อภาษาไทยด้วย (2 วัน)
INSERT INTO attendance (id, class_id, student_id, date, status, subject) VALUES
    ('s1_2026-02-12_ภาษาไทย',  'c1', 's1',  '2026-02-12', 'present', 'ภาษาไทย'),
    ('s2_2026-02-12_ภาษาไทย',  'c1', 's2',  '2026-02-12', 'present', 'ภาษาไทย'),
    ('s3_2026-02-12_ภาษาไทย',  'c1', 's3',  '2026-02-12', 'present', 'ภาษาไทย'),
    ('s4_2026-02-12_ภาษาไทย',  'c1', 's4',  '2026-02-12', 'present', 'ภาษาไทย'),
    ('s5_2026-02-12_ภาษาไทย',  'c1', 's5',  '2026-02-12', 'present', 'ภาษาไทย'),
    ('s6_2026-02-12_ภาษาไทย',  'c1', 's6',  '2026-02-12', 'late',    'ภาษาไทย'),
    ('s7_2026-02-12_ภาษาไทย',  'c1', 's7',  '2026-02-12', 'present', 'ภาษาไทย'),
    ('s8_2026-02-12_ภาษาไทย',  'c1', 's8',  '2026-02-12', 'present', 'ภาษาไทย'),
    ('s9_2026-02-12_ภาษาไทย',  'c1', 's9',  '2026-02-12', 'present', 'ภาษาไทย'),
    ('s10_2026-02-12_ภาษาไทย', 'c1', 's10', '2026-02-12', 'present', 'ภาษาไทย');

-- 5.5 งานที่มอบหมาย (3 ชิ้น)
INSERT INTO assignments (id, class_id, subject, title, max_score, due_date, assigned_date, type) VALUES
    ('a1', 'c1', 'คณิตศาสตร์', 'แบบฝึกหัดบวกลบเลข',     10, '2026-02-14', '2026-02-10', 'score'),
    ('a2', 'c1', 'คณิตศาสตร์', 'ทดสอบย่อย บทที่ 3',      20, '2026-02-20', '2026-02-13', 'score'),
    ('a3', 'c1', 'ภาษาไทย',    'เขียนเรียงความ เรื่องครอบครัว', 10, '2026-02-18', '2026-02-12', 'score');

-- 5.6 คะแนน (งานชิ้นแรก - ครบทุกคน)
INSERT INTO grades (student_id, assignment_id, score, submitted_date) VALUES
    ('s1',  'a1', 9,  '2026-02-13'),
    ('s2',  'a1', 8,  '2026-02-13'),
    ('s3',  'a1', 7,  '2026-02-14'),
    ('s4',  'a1', 10, '2026-02-12'),
    ('s5',  'a1', 5,  '2026-02-14'),
    ('s6',  'a1', 8,  '2026-02-13'),
    ('s7',  'a1', 6,  '2026-02-14'),
    ('s8',  'a1', 9,  '2026-02-13'),
    ('s9',  'a1', 7,  '2026-02-13'),
    ('s10', 'a1', 10, '2026-02-12');

-- คะแนนงานชิ้นที่ 3 (บางคน)
INSERT INTO grades (student_id, assignment_id, score, submitted_date) VALUES
    ('s1',  'a3', 8,  '2026-02-15'),
    ('s2',  'a3', 9,  '2026-02-15'),
    ('s4',  'a3', 7,  '2026-02-16'),
    ('s6',  'a3', 10, '2026-02-15'),
    ('s8',  'a3', 8,  '2026-02-16');

-- 5.7 ตั้งค่าระบบ
INSERT INTO settings (key, value) VALUES
    ('schoolName',   'โรงเรียนตัวอย่างวิทยา'),
    ('academicYear', '2568'),
    ('semester',     '2');

-- =============================================
-- 6. VERIFY DATA
-- =============================================
-- ตรวจสอบจำนวนข้อมูล
SELECT 'profiles'    AS table_name, COUNT(*) AS row_count FROM profiles
UNION ALL SELECT 'classrooms',  COUNT(*) FROM classrooms
UNION ALL SELECT 'students',    COUNT(*) FROM students
UNION ALL SELECT 'attendance',  COUNT(*) FROM attendance
UNION ALL SELECT 'assignments', COUNT(*) FROM assignments
UNION ALL SELECT 'grades',      COUNT(*) FROM grades
UNION ALL SELECT 'settings',    COUNT(*) FROM settings
ORDER BY table_name;

-- =============================================
-- สรุปข้อมูล Mock Data:
-- =============================================
-- 👤 ครู 1 คน: username=teacher, password=1234
-- 🏫 ห้องเรียน 1 ห้อง: ป.1/1 (คณิตศาสตร์, ภาษาไทย)
-- 👦👧 นักเรียน 10 คน (s1-s10)
-- 📋 เช็คชื่อ 40 รายการ (3 วัน คณิต + 1 วัน ไทย)
-- 📝 งาน 3 ชิ้น (2 คณิต, 1 ไทย)
-- 💯 คะแนน 15 รายการ
-- ⚙️ ตั้งค่า 3 รายการ
--
-- 🔐 Login ครู:
--    Username: teacher
--    Password: 1234
--
-- 👨‍👩‍👦 Login ผู้ปกครอง:
--    รหัสนักเรียน: s1
--    วันเกิด: 2561-03-15 (15 มี.ค. 2561)
-- =============================================
