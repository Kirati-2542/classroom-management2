import React, { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { api } from '../services/api';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    attendanceRate: 0,
    lateRate: 0,
    absentRate: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [followUpStudents, setFollowUpStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await api.getDashboardStats();
        setStats({
          attendanceRate: data.attendanceRate,
          lateRate: data.lateRate,
          absentRate: data.absentRate
        });
        setChartData(data.chartData);
        setFollowUpStudents(data.followUpStudents);
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="bg-gradient-to-r from-pink-500 to-rose-400 rounded-3xl p-8 text-white shadow-lg mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 bg-white opacity-10 rounded-full blur-2xl"></div>
        <div className="relative z-10">
          <h2 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <i className="fa-solid fa-table-cells-large opacity-80"></i> ภาพรวมสถิติ
          </h2>
          <p className="text-pink-100 mt-1">สรุปผลการเข้าเรียนทั้งหมดในภาพรวม</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="text-gray-500 mb-2">มาเรียนเฉลี่ย</div>
          <div className="text-4xl font-bold text-emerald-500 mb-2">{stats.attendanceRate}%</div>
          <div className="text-xs text-gray-400 font-medium flex items-center gap-1">
            จากข้อมูลทั้งหมด
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="text-gray-500 mb-2">มาสายเฉลี่ย</div>
          <div className="text-4xl font-bold text-blue-500 mb-2">{stats.lateRate}%</div>
          <div className="text-xs text-gray-400 font-medium flex items-center gap-1">
            จากข้อมูลทั้งหมด
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="text-gray-500 mb-2">ขาดเรียนเฉลี่ย</div>
          <div className="text-4xl font-bold text-red-500 mb-2">{stats.absentRate}%</div>
          <div className="text-xs text-gray-400 font-medium flex items-center gap-1">
            จากข้อมูลทั้งหมด
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <div><h3 className="font-bold text-lg">แนวโน้มการเข้าเรียน (5 วันล่าสุด)</h3></div>
          </div>
          <div className="h-64 w-full">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="present" stroke="#ec4899" fillOpacity={1} fill="url(#colorPresent)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                ยังไม่มีข้อมูลเพียงพอ
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-lg mb-6">รายงานรายวัน</h3>
          <div className="h-64 flex flex-col items-center justify-center text-gray-400 gap-2">
            <i className="fa-solid fa-clipboard-list text-4xl text-gray-200"></i>
            <p className="text-sm">เลือกห้องเรียนเพื่อดูรายงานละเอียด</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-user-clock text-red-500"></i> นักเรียนที่ต้องติดตาม (ขาด/สาย บ่อย)
        </h3>
        <table className="w-full text-left border-collapse">
          <thead className="text-sm text-gray-500 border-b border-gray-100">
            <tr>
              <th className="py-3 font-medium">ชื่อ-สกุล</th>
              <th className="py-3 font-medium">ห้อง</th>
              <th className="py-3 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-gray-100">
            {followUpStudents.length > 0 ? (
              followUpStudents.map((s, idx) => (
                <tr key={idx}>
                  <td className="py-3">{s.name}</td>
                  <td>{s.room}</td>
                  <td>
                    <span className={`px-2 py-1 rounded-full text-xs border ${s.type === 'absent'
                        ? 'bg-red-50 text-red-600 border-red-100'
                        : 'bg-orange-50 text-orange-600 border-orange-100'
                      }`}>
                      {s.status}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="py-8 text-center text-gray-400">
                  ไม่พบนักเรียนที่มีความเสี่ยง
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Dashboard;
