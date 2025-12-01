
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { User } from '../types';

interface SettingsProps {
    user: User;
    setUser: (user: User) => void;
    setLoading: (l: boolean) => void;
    schoolSettings: { schoolName: string; academicYear: string; semester: string };
    setSchoolSettings: (settings: { schoolName: string; academicYear: string; semester: string }) => void;
}

const Settings: React.FC<SettingsProps> = ({ user, setUser, setLoading, schoolSettings, setSchoolSettings }) => {
    const [schoolName, setSchoolName] = useState(schoolSettings.schoolName);
    const [academicYear, setAcademicYear] = useState(schoolSettings.academicYear);
    const [semester, setSemester] = useState(schoolSettings.semester);

    const [profileName, setProfileName] = useState(user.name);
    const [activeTab, setActiveTab] = useState<'general' | 'profile'>('general');

    // Sync local state with props if they change (e.g. initial load)
    useEffect(() => {
        setSchoolName(schoolSettings.schoolName);
        setAcademicYear(schoolSettings.academicYear);
        setSemester(schoolSettings.semester);
    }, [schoolSettings]);

    const handleSaveGeneral = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const newSettings = { schoolName, academicYear, semester };
            await api.updateSettings(newSettings);
            setSchoolSettings(newSettings); // Update global state
            alert('บันทึกการตั้งค่าเรียบร้อยแล้ว');
        } catch (err) {
            alert('เกิดข้อผิดพลาดในการบันทึก');
        } finally {
            setLoading(false);
        }
    };

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState(user.avatar || user.username);

    const avatarSeeds = ['Felix', 'Aneka', 'Zoe', 'Jack', 'Sam', 'Molly', 'Coco', 'Bubba', 'Misty', 'Willow', 'Bear', 'Tiger'];

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const updates: Partial<User> = {
                name: profileName,
                avatar: selectedAvatar
            };

            // Handle password change
            if (newPassword) {
                if (currentPassword !== user.password) {
                    alert('รหัสผ่านปัจจุบันไม่ถูกต้อง');
                    setLoading(false);
                    return;
                }
                updates.password = newPassword;
            }

            await api.updateUser(user.username, updates);

            // Update local user state
            setUser({ ...user, ...updates });

            alert('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว');

            // Clear password fields
            setCurrentPassword('');
            setNewPassword('');
        } catch (err: any) {
            alert('เกิดข้อผิดพลาด: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fadeIn">
            <div className="bg-gradient-to-r from-pink-500 to-rose-400 rounded-3xl p-8 text-white shadow-lg mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
                <div className="relative z-10">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        <i className="fa-solid fa-gear opacity-80"></i> ตั้งค่าระบบ
                    </h2>
                    <p className="text-pink-100 mt-1 text-sm">จัดการข้อมูลโรงเรียนและข้อมูลส่วนตัว</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar Navigation */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 h-fit">
                    <button
                        onClick={() => setActiveTab('general')}
                        className={`w-full text-left px-4 py-3 rounded-xl mb-1 font-medium transition-colors flex items-center gap-3 ${activeTab === 'general' ? 'bg-pink-50 text-pink-600' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <i className="fa-solid fa-school-flag w-6 text-center"></i> ตั้งค่าทั่วไป
                    </button>
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-colors flex items-center gap-3 ${activeTab === 'profile' ? 'bg-pink-50 text-pink-600' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <i className="fa-solid fa-user-gear w-6 text-center"></i> ข้อมูลส่วนตัว
                    </button>
                </div>

                {/* Content Area */}
                <div className="lg:col-span-3">
                    {activeTab === 'general' ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                            <h3 className="text-xl font-bold text-gray-800 mb-6 pb-4 border-b border-gray-100">ข้อมูลโรงเรียนและปีการศึกษา</h3>
                            <form onSubmit={handleSaveGeneral} className="space-y-6 max-w-lg">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อโรงเรียน</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-3 text-gray-400"><i className="fa-solid fa-school"></i></span>
                                        <input
                                            type="text"
                                            value={schoolName}
                                            onChange={(e) => setSchoolName(e.target.value)}
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                                            placeholder="ระบุชื่อโรงเรียน"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">ปีการศึกษาปัจจุบัน</label>
                                        <select
                                            value={academicYear}
                                            onChange={(e) => setAcademicYear(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none bg-white"
                                        >
                                            <option value="2567">2567</option>
                                            <option value="2568">2568</option>
                                            <option value="2569">2569</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">ภาคเรียนปัจจุบัน</label>
                                        <select
                                            value={semester}
                                            onChange={(e) => setSemester(e.target.value)}
                                            className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none bg-white"
                                        >
                                            <option value="1">ภาคเรียนที่ 1</option>
                                            <option value="2">ภาคเรียนที่ 2</option>
                                            <option value="3">ภาคฤดูร้อน</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <button type="submit" className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-pink-200 transition-all">
                                        บันทึกการเปลี่ยนแปลง
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
                            <h3 className="text-xl font-bold text-gray-800 mb-6 pb-4 border-b border-gray-100">ข้อมูลบัญชีผู้ใช้</h3>
                            <form onSubmit={handleSaveProfile} className="space-y-6 max-w-lg">
                                <div className="mb-6">
                                    <div className="text-sm font-medium text-gray-700 mb-3">เลือกรูปโปรไฟล์</div>
                                    <div className="flex flex-wrap gap-3">
                                        {avatarSeeds.map(seed => (
                                            <button
                                                key={seed}
                                                type="button"
                                                onClick={() => setSelectedAvatar(seed)}
                                                className={`p-1 rounded-full border-2 transition-all ${selectedAvatar === seed ? 'border-pink-500 scale-110 shadow-md' : 'border-transparent hover:border-pink-200'}`}
                                            >
                                                <img
                                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`}
                                                    alt={seed}
                                                    className="w-12 h-12 rounded-full bg-gray-50"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                    <div className="mt-4 flex items-center gap-4">
                                        <img
                                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedAvatar}`}
                                            alt="Selected Avatar"
                                            className="w-20 h-20 rounded-full border-2 border-pink-100 bg-gray-50 shadow-sm"
                                        />
                                        <div className="text-sm text-gray-500">
                                            รูปโปรไฟล์ที่เลือก
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อที่แสดง (Display Name)</label>
                                    <input
                                        type="text"
                                        value={profileName}
                                        onChange={(e) => setProfileName(e.target.value)}
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อผู้ใช้ (Username)</label>
                                    <input
                                        type="text"
                                        value={user.username}
                                        disabled
                                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed outline-none"
                                    />
                                </div>

                                <div className="pt-4 border-t border-gray-100 mt-6">
                                    <h4 className="font-bold text-gray-800 mb-4">เปลี่ยนรหัสผ่าน</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่านปัจจุบัน</label>
                                            <input
                                                type="password"
                                                value={currentPassword}
                                                onChange={(e) => setCurrentPassword(e.target.value)}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-pink-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่านใหม่</label>
                                            <input
                                                type="password"
                                                value={newPassword}
                                                onChange={(e) => setNewPassword(e.target.value)}
                                                className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-pink-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <button type="submit" className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg transition-all">
                                        บันทึกข้อมูล
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Settings;
