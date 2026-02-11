import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Classroom } from '../types';
import { normalizeDate, formatDisplayDate } from '../utils/dateUtils';
import { SuccessModal } from './ui/SuccessModal';

const Dashboard: React.FC = () => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Daily Report State
  const [dailyReport, setDailyReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Export Modal State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportClassId, setExportClassId] = useState('');

  // Notifications
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');

  // Summary Subject State
  const [selectedSummarySubject, setSelectedSummarySubject] = useState('');

  useEffect(() => {
    api.getClassrooms().then(data => {
      setClassrooms(data);
      if (data.length > 0) {
        // Optional: Auto select first class? 
        // Let's force user to select to be explicit
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedClassId || !selectedDate) {
      setDailyReport(null);
      return;
    }

    const fetchReport = async () => {
      setLoading(true);
      try {
        // Assuming 'General' subject for dashboard overview for now, or we could add subject selector
        // Using first subject or General
        const cls = classrooms.find(c => c.id === selectedClassId);
        const subject = cls?.subjects?.[0] || 'General';

        const report = await api.getClassroomDailyReport(selectedClassId, selectedDate, subject);
        setDailyReport(report);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
    fetchReport();
  }, [selectedClassId, selectedDate, classrooms]);

  // Update selectedSummarySubject when report changes
  useEffect(() => {
    if (dailyReport?.subjects?.length > 0) {
      setSelectedSummarySubject(dailyReport.subjects[0]);
    }
  }, [dailyReport]);

  const currentStats = React.useMemo(() => {
    if (!dailyReport || !selectedSummarySubject) return { present: 0, absent: 0, late: 0, sick: 0, leave: 0 };

    const stats = { present: 0, absent: 0, late: 0, sick: 0, leave: 0 };

    dailyReport.students.forEach((s: any) => {
      const status = s.attendance[selectedSummarySubject];
      if (status === 'present') stats.present++;
      else if (status === 'absent') stats.absent++;
      else if (status === 'late') stats.late++;
      else if (status === 'sick') stats.sick++;
      else if (status === 'leave') stats.leave++;
    });

    return stats;
  }, [dailyReport, selectedSummarySubject]);

  const handleExport = async () => {
    if (!exportClassId || !exportStartDate || !exportEndDate) {
      setModalMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
      setModalType('error');
      setShowModal(true);
      return;
    }

    setLoading(true);
    try {
      const cls = classrooms.find(c => c.id === exportClassId);
      const subject = cls?.subjects?.[0] || 'General';

      const data = await api.getAttendanceRange(exportClassId, exportStartDate, exportEndDate, subject);

      if (data.dates.length === 0) {
        setModalMessage('ไม่พบข้อมูลในช่วงเวลาที่เลือก');
        setModalType('error');
        setShowModal(true);
        return;
      }

      // Calculate statistics for each student
      const calculateStats = (statuses: string[]) => {
        const stats = { present: 0, absent: 0, late: 0, sick: 0, leave: 0 };
        statuses.forEach(s => {
          if (s === 'present') stats.present++;
          else if (s === 'absent') stats.absent++;
          else if (s === 'late') stats.late++;
          else if (s === 'sick') stats.sick++;
          else if (s === 'leave') stats.leave++;
        });
        return stats;
      };

      // Generate CSV with complete data
      // Header Info Section
      const infoSection = [
        [`รายงานการเข้าเรียน`],
        [`ห้องเรียน: ${cls?.name || 'N/A'}`],
        [`วิชา: ${subject}`],
        [`ช่วงวันที่: ${formatDisplayDate(exportStartDate)} ถึง ${formatDisplayDate(exportEndDate)}`],
        [`วันที่ส่งออก: ${formatDisplayDate(new Date().toISOString().split('T')[0])}`],
        [] // Empty row for separation
      ];

      // Data Headers
      const headers = [
        "ลำดับ",
        "รหัสนักเรียน",
        "ชื่อ-นามสกุล",
        ...data.dates.map((d: string) => formatDisplayDate(d)),
        "มาเรียน",
        "ขาด",
        "สาย",
        "ป่วย",
        "ลา",
        "อัตราการมาเรียน (%)"
      ];

      // Data Rows with statistics
      const rows = data.students.map((s: any, index: number) => {
        const stats = calculateStats(s.statuses);
        const totalDays = s.statuses.length;
        const attendanceRate = totalDays > 0 ? ((stats.present + stats.late) / totalDays * 100).toFixed(1) : '0.0';

        return [
          index + 1,
          s.id,
          s.name,
          ...s.statuses.map((st: string) => {
            if (st === 'present') return 'มา';
            if (st === 'absent') return 'ขาด';
            if (st === 'late') return 'สาย';
            if (st === 'sick') return 'ป่วย';
            if (st === 'leave') return 'ลา';
            return '-';
          }),
          stats.present,
          stats.absent,
          stats.late,
          stats.sick,
          stats.leave,
          attendanceRate
        ];
      });

      // Summary Row
      const totalStats = {
        present: 0,
        absent: 0,
        late: 0,
        sick: 0,
        leave: 0
      };
      data.students.forEach((s: any) => {
        const stats = calculateStats(s.statuses);
        totalStats.present += stats.present;
        totalStats.absent += stats.absent;
        totalStats.late += stats.late;
        totalStats.sick += stats.sick;
        totalStats.leave += stats.leave;
      });
      const totalDaysAll = data.students.length * data.dates.length;
      const overallRate = totalDaysAll > 0 ? ((totalStats.present + totalStats.late) / totalDaysAll * 100).toFixed(1) : '0.0';

      const summaryRow = [
        '',
        '',
        'รวมทั้งหมด',
        ...data.dates.map(() => ''),
        totalStats.present,
        totalStats.absent,
        totalStats.late,
        totalStats.sick,
        totalStats.leave,
        overallRate
      ];

      // Build CSV content
      const csvContent = [
        ...infoSection.map(row => row.join(',')),
        headers.map(h => `"${h}"`).join(','),
        ...rows.map(r => r.map((c: any) => `"${c}"`).join(',')),
        [], // Empty row before summary
        summaryRow.map((c: any) => `"${c}"`).join(',')
      ].join("\n");

      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `รายงานการเข้าเรียน_${cls?.name}_${exportStartDate}_ถึง_${exportEndDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setShowExportModal(false);
      setModalMessage('ดาวน์โหลดข้อมูลสำเร็จ');
      setModalType('success');
      setShowModal(true);

    } catch (error) {
      console.error(error);
      setModalMessage('เกิดข้อผิดพลาดในการส่งออกข้อมูล');
      setModalType('error');
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fadeIn pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 flex items-center gap-3 drop-shadow-sm">
            <i className="fa-solid fa-chart-pie text-pink-500"></i> แดชบอร์ด
          </h1>
          <p className="text-gray-500 font-medium mt-2 flex items-center gap-2">
            <span className="w-8 h-1 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full"></span>
            รายงานสรุปข้อมูลการเข้าเรียนรายวัน
          </p>
        </div>
        <button
          onClick={() => {
            setExportStartDate(new Date().toISOString().split('T')[0]);
            setExportEndDate(new Date().toISOString().split('T')[0]);
            setExportClassId(selectedClassId || (classrooms[0]?.id || ''));
            setShowExportModal(true);
          }}
          className="group bg-white border border-pink-100 text-pink-600 hover:bg-pink-50 hover:border-pink-200 px-6 py-3 rounded-2xl shadow-sm hover:shadow-md transition-all flex items-center gap-3 font-bold"
        >
          <div className="bg-pink-100 p-2 rounded-lg group-hover:scale-110 transition-transform">
            <i className="fa-solid fa-download text-pink-500"></i>
          </div>
          ส่งออกรายงาน
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-6 shadow-xl shadow-pink-50/50 border border-pink-100/50 mb-8 flex flex-col md:flex-row gap-6 items-end backdrop-blur-sm relative overflow-hidden">
        {/* Decorative background element for filters */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-pink-50/50 to-purple-50/50 rounded-full blur-3xl -translate-y-32 translate-x-32 pointer-events-none"></div>

        <div className="flex-1 w-full relative z-10">
          <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
            <i className="fa-solid fa-school text-pink-400"></i> เลือกห้องเรียน
          </label>
          <div className="relative">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full bg-gray-50 border-2 border-transparent hover:bg-white hover:border-pink-200 focus:bg-white focus:border-pink-500 rounded-xl px-4 py-3 text-gray-700 focus:outline-none focus:ring-4 focus:ring-pink-500/10 transition-all appearance-none cursor-pointer"
            >
              <option value="">-- กรุณาเลือกห้องเรียน --</option>
              {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-pink-400 pointer-events-none">
              <i className="fa-solid fa-chevron-down"></i>
            </div>
          </div>
        </div>
        <div className="flex-1 w-full relative z-10">
          <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
            <i className="fa-regular fa-calendar text-pink-400"></i> เลือกวันที่
          </label>
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-gray-50 border-2 border-transparent hover:bg-white hover:border-pink-200 focus:bg-white focus:border-pink-500 rounded-xl px-4 py-3 text-gray-700 focus:outline-none focus:ring-4 focus:ring-pink-500/10 transition-all cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Daily Report Content */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500"></div>
        </div>
      ) : dailyReport ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          {/* Summary Cards */}
          {/* Summary Section Container */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            {/* Subject Selector */}
            {dailyReport.subjects && dailyReport.subjects.length > 0 && (
              <div className="bg-gray-50/80 p-1.5 rounded-xl mb-6 overflow-x-auto border border-gray-100">
                <div className="flex gap-1">
                  {dailyReport.subjects.map((subj: string) => (
                    <button
                      key={subj}
                      onClick={() => setSelectedSummarySubject(subj)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2
                            ${selectedSummarySubject === subj
                          ? 'bg-white text-pink-600 shadow-sm ring-1 ring-black/5'
                          : 'text-gray-500 hover:bg-white/50 hover:text-pink-500'}`}
                    >
                      {selectedSummarySubject === subj && <i className="fa-solid fa-check text-xs"></i>}
                      {subj}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className={`bg-emerald-50 text-emerald-700 p-4 rounded-xl border border-emerald-100 transition-all ${selectedSummarySubject ? 'transform hover:scale-105' : ''}`}>
                <div className="text-xs font-bold uppercase mb-1 opacity-70">มาเรียน</div>
                <div className="text-2xl font-bold">{currentStats.present}</div>
              </div>
              <div className={`bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 transition-all ${selectedSummarySubject ? 'transform hover:scale-105' : ''}`}>
                <div className="text-xs font-bold uppercase mb-1 opacity-70">ขาดเรียน</div>
                <div className="text-2xl font-bold">{currentStats.absent}</div>
              </div>
              <div className={`bg-orange-50 text-orange-700 p-4 rounded-xl border border-orange-100 transition-all ${selectedSummarySubject ? 'transform hover:scale-105' : ''}`}>
                <div className="text-xs font-bold uppercase mb-1 opacity-70">สาย</div>
                <div className="text-2xl font-bold">{currentStats.late}</div>
              </div>
              <div className={`bg-purple-50 text-purple-700 p-4 rounded-xl border border-purple-100 transition-all ${selectedSummarySubject ? 'transform hover:scale-105' : ''}`}>
                <div className="text-xs font-bold uppercase mb-1 opacity-70">ป่วย</div>
                <div className="text-2xl font-bold">{currentStats.sick}</div>
              </div>
              <div className={`bg-blue-50 text-blue-700 p-4 rounded-xl border border-blue-100 transition-all ${selectedSummarySubject ? 'transform hover:scale-105' : ''}`}>
                <div className="text-xs font-bold uppercase mb-1 opacity-70">ลา</div>
                <div className="text-2xl font-bold">{currentStats.leave}</div>
              </div>
            </div>
          </div>

          {/* Assignment Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-indigo-50 text-indigo-700 p-4 rounded-xl border border-indigo-100">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <div className="text-xs font-bold uppercase mb-1 opacity-70">งานที่มอบหมายวันนี้</div>
                  <div className="text-2xl font-bold">{dailyReport.assigned}</div>
                </div>
                <div className="bg-white p-3 rounded-full shadow-sm text-indigo-500">
                  <i className="fa-solid fa-book-open"></i>
                </div>
              </div>
              {dailyReport.assignedDetails && dailyReport.assignedDetails.length > 0 && (
                <div className="mt-2 pt-2 border-t border-indigo-100">
                  <div className="text-xs font-semibold mb-1 opacity-80">รายละเอียดงาน:</div>
                  <ul className="space-y-1">
                    {dailyReport.assignedDetails.map((a: any) => (
                      <li key={a.id} className="text-xs bg-white/50 px-2 py-1 rounded">
                        <span className="font-bold">[{a.subject}]</span> {a.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="bg-teal-50 text-teal-700 p-4 rounded-xl border border-teal-100">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <div className="text-xs font-bold uppercase mb-1 opacity-70">งานที่ตรวจแล้ววันนี้</div>
                  <div className="text-2xl font-bold">{dailyReport.submitted}</div>
                </div>
                <div className="bg-white p-3 rounded-full shadow-sm text-teal-500">
                  <i className="fa-solid fa-clipboard-check"></i>
                </div>
              </div>
              {dailyReport.submittedDetails && dailyReport.submittedDetails.length > 0 && (
                <div className="mt-2 pt-2 border-t border-teal-100 max-h-32 overflow-y-auto">
                  <div className="text-xs font-semibold mb-1 opacity-80">รายการที่ตรวจ:</div>
                  <ul className="space-y-1">
                    {dailyReport.submittedDetails.map((g: any, idx: number) => (
                      <li key={idx} className="text-xs bg-white/50 px-2 py-1 rounded">
                        <span className="font-bold">{g.studentName}</span> - [{g.subject}] {g.assignmentTitle}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Report Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-lg text-gray-800">
                รายละเอียดการเข้าเรียน
                <span className="ml-2 text-sm font-normal text-gray-500">({formatDisplayDate(selectedDate)})</span>
              </h3>
              <span className="text-sm text-gray-500">
                ทั้งหมด {dailyReport.total} คน
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
                  <tr>
                    <th className="p-4 rounded-tl-lg">ชื่อ-สกุล</th>
                    {/* Dynamic Subject Headers */}
                    {dailyReport.subjects && dailyReport.subjects.map((subj: string, idx: number) => (
                      <th key={subj} className={`p-4 text-center ${idx === dailyReport.subjects.length - 1 ? 'rounded-tr-lg' : ''}`}>
                        {subj}
                      </th>
                    ))}
                    {!dailyReport.subjects && <th className="p-4 rounded-tr-lg text-center">สถานะ</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dailyReport.students.map((s: any) => (
                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 font-medium text-gray-800">{s.name}</td>

                      {/* Dynamic Subject Statuses */}
                      {dailyReport.subjects ? dailyReport.subjects.map((subj: string) => {
                        const status = s.attendance[subj];
                        return (
                          <td key={subj} className="p-4 text-center">
                            {renderStatusBadge(status)}
                          </td>
                        );
                      }) : (
                        // Fallback for old structure if any
                        <td className="p-4 text-center">
                          {renderStatusBadge(s.status)}
                        </td>
                      )}
                    </tr>
                  ))}
                  {dailyReport.students.length === 0 && (
                    <tr>
                      <td colSpan={dailyReport.subjects ? dailyReport.subjects.length + 1 : 2} className="p-8 text-center text-gray-400">
                        ไม่พบข้อมูลนักเรียน
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          กรุณาเลือกห้องเรียนและวันที่เพื่อดูรายงาน
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-800">ส่งออกรายงาน (CSV)</h3>
              <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <i className="fa-solid fa-xmark text-xl"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เลือกห้องเรียน</label>
                <select
                  value={exportClassId}
                  onChange={(e) => setExportClassId(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none"
                >
                  {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ตั้งแต่วันที่</label>
                  <input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ถึงวันที่</label>
                  <input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleExport}
                className="flex-1 py-2.5 rounded-xl bg-pink-500 text-white font-bold hover:bg-pink-600 shadow-lg shadow-pink-200 transition-colors flex justify-center items-center gap-2"
              >
                <i className="fa-solid fa-file-export"></i> ส่งออกข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}

      <SuccessModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalType === 'success' ? "เรียบร้อย" : "แจ้งเตือน"}
        message={modalMessage}
        type={modalType}
      />
    </div>
  );
};

export default Dashboard;

function renderStatusBadge(status: string) {
  let badgeClass = 'bg-gray-100 text-gray-500';
  let icon = null;
  let label = '-';

  switch (status) {
    case 'present':
      badgeClass = 'bg-emerald-100 text-emerald-700';
      icon = <i className="fa-solid fa-check"></i>;
      label = 'มา';
      break;
    case 'absent':
      badgeClass = 'bg-red-100 text-red-700';
      icon = <i className="fa-solid fa-xmark"></i>;
      label = 'ขาด';
      break;
    case 'late':
      badgeClass = 'bg-orange-100 text-orange-700';
      icon = <i className="fa-regular fa-clock"></i>;
      label = 'สาย';
      break;
    case 'sick':
      badgeClass = 'bg-purple-100 text-purple-700';
      icon = <i className="fa-solid fa-bed"></i>;
      label = 'ป่วย';
      break;
    case 'leave':
      badgeClass = 'bg-blue-100 text-blue-700';
      icon = <i className="fa-regular fa-file-lines"></i>;
      label = 'ลา';
      break;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${badgeClass}`}>
      {icon}
      {label}
    </span>
  );
}

