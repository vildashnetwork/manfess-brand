import { useState, useEffect, useCallback, useRef } from "react";
import {
  Calendar, Clock, Users, Search, X, CalendarDays,
  User, BookOpen, ChevronLeft, ChevronRight,
  AlertCircle, Check, Home, LogOut, Menu,
  Sun, Moon, Settings, Bell, Award, DollarSign, Download, Printer,
  ChevronDown, ChevronUp, Plus, Trash2, Edit, Save, Filter,
  CheckCircle, XCircle, Clock as ClockIcon, UserCheck, UserX,
  FileText, CreditCard, Receipt, TrendingUp, TrendingDown, RefreshCw,
  Loader2
} from "lucide-react";
import { CompactPageLoader } from "@/components/CompactPageLoader";
import { toast } from "sonner";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";

const formatAttendanceDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getAttendanceWeekdays = (dateValue: string) => {
  const [year, month, day] = dateValue.split('-').map(Number);
  const monday = new Date(year, month - 1, day);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  return Array.from({ length: 5 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      value: formatAttendanceDate(date),
      dayName: date.toLocaleDateString(undefined, { weekday: 'long' }),
      shortDate: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    };
  });
};

// ============================================
// TYPES
// ============================================

interface Teacher {
  _id: string;
  name: string;
  email: string;
  phone: string;
  qualification: string;
  role: string;
  monthlySalary?: number;
}

interface AttendanceRecord {
  id: string;
  teacherId: string;
  teacherName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: "present" | "absent" | "late" | "excused";
  hoursWorked: number;
  periodsTaught: number;
  notes?: string;
}

interface SalaryRecord {
  id: string;
  teacherId: string;
  teacherName: string;
  month: string;
  year: string;
  periodCounts: {
    firstCycle: number;
    secondCycle: number;
    total: number;
  };
  rates: {
    firstCycle: number;
    secondCycle: number;
  };
  paymentMode?: "hourly" | "monthly";
  monthlyAmount?: number;
  classBreakdown?: Array<{
    classId: string;
    className: string;
    periods: number;
    ratePerPeriod: number;
    amount: number;
  }>;
  grossSalary: number;
  deductions: {
    total: number;
    details: Array<{
      type: string;
      amount: number;
      description: string;
    }>;
  };
  netSalary: number;
  attendance: {
    present: number;
    absent: number;
    late: number;
    excused: number;
  };
  status: "pending" | "paid" | "partially_paid";
  paymentDate?: string;
  paymentMethod?: "cash" | "bank_transfer" | "mobile_money" | "check";
  transactionId?: string;
}

// ============================================
// TEACHER ATTENDANCE MANAGEMENT
// ============================================

export function TeacherAttendancePage() {
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(formatAttendanceDate(new Date()));
  const [selectedMonth, setSelectedMonth] = useState<string>(
    String(new Date().getMonth() + 1).padStart(2, '0')
  );
  const [selectedYear, setSelectedYear] = useState<string>(
    String(new Date().getFullYear())
  );
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly");
  const [weeklyOverrides, setWeeklyOverrides] = useState<Record<string, AttendanceRecord['status']>>({});
  const [savingWeek, setSavingWeek] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState({
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    total: 0
  });

  // ============================================
  // FETCH DATA
  // ============================================

  const fetchTeachers = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/users?role=teacher`);
      if (response.data.success) {
        const teacherAccounts = response.data.data.filter(
          (user: Teacher) => user.role?.trim().toLowerCase() === 'teacher'
        );
        setTeachers(teacherAccounts);
        return teacherAccounts;
      }
    } catch (error) {
      console.error('Error fetching teachers:', error);
      // Mock data fallback
      const mockTeachers = [
        { _id: 't1', name: 'John Doe', email: 'john@school.com', phone: '699123456', qualification: 'BSc Math', role: 'teacher' },
        { _id: 't2', name: 'Jane Smith', email: 'jane@school.com', phone: '699234567', qualification: 'BEd English', role: 'teacher' },
        { _id: 't3', name: 'Michael Brown', email: 'michael@school.com', phone: '699345678', qualification: 'PhD Physics', role: 'teacher' },
        { _id: 't4', name: 'Sarah Wilson', email: 'sarah@school.com', phone: '699456789', qualification: 'MSc Chemistry', role: 'teacher' },
        { _id: 't5', name: 'David Kim', email: 'david@school.com', phone: '699567890', qualification: 'BEd History', role: 'teacher' },
      ];
      setTeachers(mockTeachers);
      return mockTeachers;
    }
  }, []);

  const fetchAttendance = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedTeacher) params.append('teacherId', selectedTeacher);

      let records: any[];
      if (viewMode === 'weekly' && selectedDate) {
        const weekdays = getAttendanceWeekdays(selectedDate);
        const dayResponses = await Promise.all(weekdays.map((weekday) =>
          axios.get(`${API_BASE}/attendance?${new URLSearchParams({
            ...(selectedTeacher ? { teacherId: selectedTeacher } : {}),
            date: weekday.value,
          }).toString()}`)
        ));
        records = dayResponses.flatMap((response) => response.data.success ? response.data.data : []);
      } else {
        if (selectedMonth && selectedYear) {
          params.append('month', selectedMonth);
          params.append('year', selectedYear);
        }
        const response = await axios.get(`${API_BASE}/attendance?${params.toString()}`);
        records = response.data.data || [];
      }

      const normalized = records.map((record) => {
        const populatedTeacher = record.teacherId && typeof record.teacherId === 'object' ? record.teacherId : null;
        const teacherId = String(populatedTeacher?._id || record.teacherId || '');
        const teacher = teachers.find((item) => item._id === teacherId);
        return {
          ...record,
          id: String(record._id || record.id),
          teacherId,
          teacherName: record.teacherName || populatedTeacher?.name || teacher?.name || 'Unknown teacher',
          date: new Date(record.date).toISOString().slice(0, 10),
          checkIn: record.checkIn || '',
          checkOut: record.checkOut || '',
          status: record.status || 'present',
          hoursWorked: record.hoursWorked || 0,
          periodsTaught: record.periodsTaught || 0,
        } as AttendanceRecord;
      });
      setAttendance(normalized);
      setWeeklyOverrides({});
      calculateStats(normalized);
      return normalized;
    } catch (error) {
      console.error('Error fetching attendance:', error);
      // Generate mock attendance
      const mockAttendance = generateMockAttendance(teachers);
      setAttendance(mockAttendance);
      calculateStats(mockAttendance);
      return mockAttendance;
    }
  }, [selectedTeacher, selectedDate, selectedMonth, selectedYear, viewMode, teachers]);

  const attendanceWeekdays = getAttendanceWeekdays(selectedDate);
  const today = formatAttendanceDate(new Date());

  const getWeeklyStatus = (teacherId: string, date: string) => {
    const key = `${teacherId}:${date}`;
    return weeklyOverrides[key]
      || attendance.find((record) => record.teacherId === teacherId && record.date === date)?.status
      || 'absent';
  };

  const saveWeeklyAttendance = async () => {
    const daysToSave = attendanceWeekdays.filter((weekday) => weekday.value <= today);
    const teachersToSave = teachers.filter((teacher) =>
      (!selectedTeacher || teacher._id === selectedTeacher)
      && (!searchTerm || teacher.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    if (!daysToSave.length || !teachersToSave.length) {
      toast.error('No teachers or current weekdays are available to save');
      return;
    }

    setSavingWeek(true);
    try {
      const creates: Record<string, unknown>[] = [];
      const updates: AttendanceRecord[] = [];
      for (const teacher of teachersToSave) {
        for (const weekday of daysToSave) {
          const existing = attendance.find((record) => record.teacherId === teacher._id && record.date === weekday.value);
          const status = getWeeklyStatus(teacher._id, weekday.value);
          const date = new Date(`${weekday.value}T00:00:00`);
          const month = date.getMonth();
          const year = date.getFullYear();
          const details = {
            teacherId: teacher._id,
            date: weekday.value,
            checkIn: status === 'absent' ? '' : existing?.checkIn || '',
            checkOut: status === 'absent' ? '' : existing?.checkOut || '',
            status,
            hoursWorked: status === 'absent' ? 0 : existing?.hoursWorked || 0,
            periodsTaught: status === 'absent' ? 0 : existing?.periodsTaught || 0,
            academicYear: month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`,
            term: month >= 8 ? 'first' : month <= 3 ? 'second' : 'third',
          };

          if (existing) updates.push({ ...existing, ...details });
          else creates.push(details);
        }
      }

      await Promise.all([
        ...(creates.length ? [axios.post(`${API_BASE}/attendance/bulk`, { records: creates })] : []),
        ...updates.map((record) => axios.put(`${API_BASE}/attendance/${record.id}`, record)),
      ]);
      await fetchAttendance();
      toast.success('Teacher attendance saved for the selected weekdays');
    } catch (error: any) {
      console.error('Error saving weekly teacher attendance:', error);
      toast.error(error.response?.data?.message || 'Could not save teacher attendance');
    } finally {
      setSavingWeek(false);
    }
  };

  const generateMockAttendance = (teachersList: Teacher[]) => {
    const mockAttendance: AttendanceRecord[] = [];
    const statuses: ("present" | "absent" | "late" | "excused")[] = ['present', 'present', 'present', 'late', 'absent'];
    const now = new Date();
    const date = now.toISOString().split('T')[0];

    teachersList.forEach((teacher, i) => {
      const status = statuses[i % statuses.length];
      const checkIn = status === 'absent' ? '' : `${8 + Math.floor(Math.random() * 2)}:${Math.random() > 0.5 ? '00' : '30'}`;
      const checkOut = checkIn ? `${parseInt(checkIn) + 8}:${checkIn.split(':')[1]}` : '';

      mockAttendance.push({
        id: `att_${i}`,
        teacherId: teacher._id,
        teacherName: teacher.name,
        date: date,
        checkIn: checkIn,
        checkOut: checkOut,
        status: status,
        hoursWorked: status === 'present' ? 8 : status === 'late' ? 7 : 0,
        periodsTaught: status === 'present' ? 6 : status === 'late' ? 4 : 0,
        notes: status === 'absent' ? 'Sick leave' : status === 'late' ? 'Traffic delay' : ''
      });
    });

    return mockAttendance;
  };

  const calculateStats = (attendanceList: AttendanceRecord[]) => {
    const stats = {
      present: attendanceList.filter(a => a.status === 'present').length,
      absent: attendanceList.filter(a => a.status === 'absent').length,
      late: attendanceList.filter(a => a.status === 'late').length,
      excused: attendanceList.filter(a => a.status === 'excused').length,
      total: attendanceList.length
    };
    setStats(stats);
  };

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  const handleSaveAttendance = async (record: AttendanceRecord) => {
    try {
      if (!record.teacherId || !record.status) {
        toast.error('Please fill in all required fields');
        return;
      }

      const isExisting = attendance.some(a => a.id === record.id);
      let updatedAttendance;

      if (isExisting) {
        updatedAttendance = attendance.map(a => a.id === record.id ? record : a);
        await axios.put(`${API_BASE}/attendance/${record.id}`, record);
        toast.success('Attendance updated');
      } else {
        const newRecord = { ...record, id: `att_${Date.now()}` };
        updatedAttendance = [...attendance, newRecord];
        await axios.post(`${API_BASE}/attendance`, newRecord);
        toast.success('Attendance recorded');
      }

      setAttendance(updatedAttendance);
      calculateStats(updatedAttendance);
      setShowAddModal(false);
      setEditingRecord(null);
    } catch (error) {
      console.error('Error saving attendance:', error);
      toast.error('Failed to save attendance');
    }
  };

  const handleDeleteAttendance = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this attendance record?')) return;

    try {
      await axios.delete(`${API_BASE}/attendance/${id}`);
      const updatedAttendance = attendance.filter(a => a.id !== id);
      setAttendance(updatedAttendance);
      calculateStats(updatedAttendance);
      toast.success('Attendance record deleted');
    } catch (error) {
      console.error('Error deleting attendance:', error);
      toast.error('Failed to delete attendance');
    }
  };

  // ============================================
  // FILTERED DATA
  // ============================================

  const filteredAttendance = attendance.filter(record => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return record.teacherName.toLowerCase().includes(term) ||
      record.status.toLowerCase().includes(term);
  });

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const teachersData = await fetchTeachers();
      await fetchAttendance();
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (teachers.length > 0) {
      fetchAttendance();
    }
  }, [selectedTeacher, selectedDate, selectedMonth, selectedYear, viewMode, teachers]);

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return <CompactPageLoader label="Loading attendance..." />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-4 md:px-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2 sm:gap-3">
            <Calendar className="size-6 sm:size-8 text-brand" />
            Teacher Attendance
          </h1>
          <p className="text-xs sm:text-sm text-black/60 mt-0.5 sm:mt-1">
            {attendance.length} records • {stats.present} present • {stats.absent} absent
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-brand text-white text-xs sm:text-sm font-semibold hover:bg-brand/90 transition-all shadow-lg shadow-brand/20"
        >
          <Plus className="size-4 sm:size-5" />
          <span>Mark Attendance</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-green-50 rounded-2xl border border-green-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-green-700 font-medium uppercase tracking-wider">Present</p>
          <p className="text-xl sm:text-2xl font-bold text-green-700 mt-0.5 sm:mt-1">{stats.present}</p>
        </div>
        <div className="bg-red-50 rounded-2xl border border-red-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-red-700 font-medium uppercase tracking-wider">Absent</p>
          <p className="text-xl sm:text-2xl font-bold text-red-700 mt-0.5 sm:mt-1">{stats.absent}</p>
        </div>
        <div className="bg-yellow-50 rounded-2xl border border-yellow-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-yellow-700 font-medium uppercase tracking-wider">Late</p>
          <p className="text-xl sm:text-2xl font-bold text-yellow-700 mt-0.5 sm:mt-1">{stats.late}</p>
        </div>
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-blue-700 font-medium uppercase tracking-wider">Excused</p>
          <p className="text-xl sm:text-2xl font-bold text-blue-700 mt-0.5 sm:mt-1">{stats.excused}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-3 items-end">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 size-3 sm:size-4 text-black/40" />
          <input
            type="text"
            placeholder="Search teacher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-7 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2.5 rounded-xl border border-stone-200 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
        </div>

        <select
          value={selectedTeacher}
          onChange={(e) => setSelectedTeacher(e.target.value)}
          className="px-2 sm:px-4 py-1.5 sm:py-2.5 rounded-xl border border-stone-200 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand min-w-[100px] sm:min-w-[150px]"
        >
          <option value="">All Teachers</option>
          {teachers.map(t => (
            <option key={t._id} value={t._id}>{t.name}</option>
          ))}
        </select>

        <div className="flex gap-1 border border-stone-200 rounded-xl p-0.5 sm:p-1">
          <button
            onClick={() => setViewMode('weekly')}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition ${viewMode === 'weekly' ? 'bg-brand text-white' : 'hover:bg-stone-100'}`}
          >
            Week
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition ${viewMode === 'monthly' ? 'bg-brand text-white' : 'hover:bg-stone-100'}`}
          >
            Monthly
          </button>
        </div>

        {viewMode === 'weekly' ? (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-2 sm:px-4 py-1.5 sm:py-2.5 rounded-xl border border-stone-200 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            aria-label="Choose a date in the attendance week"
          />
        ) : (
          <>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2 sm:px-4 py-1.5 sm:py-2.5 rounded-xl border border-stone-200 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand min-w-[80px] sm:min-w-[100px]"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={String(m).padStart(2, '0')}>
                  {new Date(2024, m - 1).toLocaleString('default', { month: 'short' })}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-2 sm:px-4 py-1.5 sm:py-2.5 rounded-xl border border-stone-200 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand min-w-[70px] sm:min-w-[90px]"
            >
              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
          </>
        )}
        {viewMode === 'weekly' && (
          <button
            onClick={saveWeeklyAttendance}
            disabled={savingWeek || teachers.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-[#121212] px-4 py-2.5 text-xs sm:text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
          >
            {savingWeek ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
            {savingWeek ? 'Saving...' : 'Save Week'}
          </button>
        )}
      </div>

      {/* Attendance Table */}
      {viewMode === 'weekly' ? (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[minmax(200px,2fr)_repeat(5,minmax(96px,1fr))] border-b border-stone-200 bg-stone-50 text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">
                <div className="px-3 py-3">Teacher</div>
                {attendanceWeekdays.map((weekday) => (
                  <div key={weekday.value} className="px-2 py-3 text-center">
                    <div>{weekday.dayName}</div>
                    <div className="mt-1 font-medium normal-case tracking-normal text-black/45">{weekday.shortDate}</div>
                  </div>
                ))}
              </div>
              {teachers
                .filter((teacher) => (!selectedTeacher || teacher._id === selectedTeacher)
                  && (!searchTerm || teacher.name.toLowerCase().includes(searchTerm.toLowerCase())))
                .map((teacher) => (
                  <div key={teacher._id} className="grid grid-cols-[minmax(200px,2fr)_repeat(5,minmax(96px,1fr))] min-h-14 border-b border-stone-100 last:border-b-0">
                    <div className="flex items-center px-3 py-3 text-sm font-medium text-[#121212]">{teacher.name}</div>
                    {attendanceWeekdays.map((weekday) => {
                      const status = getWeeklyStatus(teacher._id, weekday.value);
                      const isFuture = weekday.value > today;
                      return (
                        <label key={weekday.value} className={`flex items-center justify-center border-l border-stone-100 ${isFuture ? 'bg-stone-50' : ''}`}>
                          <input
                            type="checkbox"
                            checked={status === 'present' || status === 'late'}
                            disabled={isFuture || savingWeek}
                            aria-label={`${weekday.dayName} ${weekday.shortDate}: ${teacher.name} present`}
                            onChange={(event) => setWeeklyOverrides((previous) => ({
                              ...previous,
                              [`${teacher._id}:${weekday.value}`]: event.target.checked ? 'present' : 'absent',
                            }))}
                            className="size-5 cursor-pointer accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-30"
                          />
                        </label>
                      );
                    })}
                  </div>
                ))}
              {teachers.length === 0 && (
                <div className="px-4 py-10 text-center text-sm text-black/50">No teachers found.</div>
              )}
            </div>
          </div>
          <div className="border-t border-stone-200 px-4 py-3 text-xs text-black/50">
            Check a weekday to mark the teacher present. Unchecked past or current weekdays are saved as absent; future dates are disabled.
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] sm:min-w-full">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Teacher</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Date</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Check In</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Check Out</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Status</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Hours</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Periods</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Notes</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-center text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-black/40">
                      <CalendarDays className="size-10 sm:size-12 mx-auto text-black/20 mb-2" />
                      <p className="text-sm">No attendance records found</p>
                    </td>
                  </tr>
                ) : (
                  filteredAttendance.map((record) => (
                    <tr key={record.id} className="border-b border-stone-100 hover:bg-stone-50 transition">
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm font-medium">{record.teacherName}</td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm">{new Date(record.date).toLocaleDateString()}</td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm">{record.checkIn || '-'}</td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm">{record.checkOut || '-'}</td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2.5">
                        <span className={`badge ${record.status === 'present' ? 'badge-success' : record.status === 'late' ? 'badge-warning' : record.status === 'excused' ? 'badge-blue' : 'badge-danger'} text-[8px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1`}>
                          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm">{record.hoursWorked || '-'}</td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm">{record.periodsTaught || '-'}</td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm max-w-[100px] truncate">{record.notes || '-'}</td>
                      <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-center">
                        <div className="flex justify-center gap-1">
                          <button
                            onClick={() => setEditingRecord(record)}
                            className="p-1 rounded-lg hover:bg-stone-100 text-black/60 transition"
                          >
                            <Edit className="size-3 sm:size-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAttendance(record.id)}
                            className="p-1 rounded-lg hover:bg-red-50 text-red-500 transition"
                          >
                            <Trash2 className="size-3 sm:size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="px-3 sm:px-4 py-2 sm:py-3 border-t border-stone-200 text-xs sm:text-sm text-black/40 flex justify-between">
            <span>Total: {filteredAttendance.length} records</span>
            <span>Attendance Rate: {stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0}%</span>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingRecord) && (
        <AttendanceModal
          initial={editingRecord || {
            id: `att_${Date.now()}`,
            teacherId: "",
            teacherName: "",
            date: new Date().toISOString().split('T')[0],
            checkIn: "",
            checkOut: "",
            status: "present",
            hoursWorked: 0,
            periodsTaught: 0,
            notes: ""
          }}
          teachers={teachers}
          onSave={handleSaveAttendance}
          onCancel={() => {
            setShowAddModal(false);
            setEditingRecord(null);
          }}
        />
      )}
    </div>
  );
}

// ============================================
// ATTENDANCE MODAL
// ============================================

function AttendanceModal({
  initial,
  teachers,
  onSave,
  onCancel
}: {
  initial: AttendanceRecord;
  teachers: Teacher[];
  onSave: (record: AttendanceRecord) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<AttendanceRecord>(initial);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof AttendanceRecord>(k: K, v: AttendanceRecord[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h3 className="font-display font-bold text-lg sm:text-xl flex items-center gap-2">
            <UserCheck className="size-5 sm:size-6 text-brand" />
            {initial.teacherName ? "Edit Attendance" : "Mark Attendance"}
          </h3>
          <button onClick={onCancel} className="text-black/40 hover:text-black/70">
            <X className="size-4 sm:size-5" />
          </button>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50">Teacher*</label>
            <select
              value={form.teacherId}
              onChange={(e) => {
                const teacher = teachers.find(t => t._id === e.target.value);
                set("teacherId", e.target.value);
                set("teacherName", teacher?.name || "");
              }}
              className={inputCls}
            >
              <option value="">Select Teacher</option>
              {teachers.map(t => (
                <option key={t._id} value={t._id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50">Date*</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50">Check In</label>
              <input
                type="time"
                value={form.checkIn}
                onChange={(e) => set("checkIn", e.target.value)}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50">Check Out</label>
              <input
                type="time"
                value={form.checkOut}
                onChange={(e) => set("checkOut", e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50">Status*</label>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as any)}
              className={inputCls}
            >
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
              <option value="excused">Excused</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50">Hours Worked</label>
              <input
                type="number"
                value={form.hoursWorked}
                onChange={(e) => set("hoursWorked", parseFloat(e.target.value))}
                className={inputCls}
                min="0"
                step="0.5"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50">Periods Taught</label>
              <input
                type="number"
                value={form.periodsTaught}
                onChange={(e) => set("periodsTaught", parseInt(e.target.value))}
                className={inputCls}
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-black/50">Notes</label>
            <input
              type="text"
              value={form.notes || ""}
              onChange={(e) => set("notes", e.target.value)}
              className={inputCls}
              placeholder="Additional notes..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4 sm:mt-6 pt-3 sm:pt-4 border-t border-stone-100">
          <button
            onClick={onCancel}
            className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm font-semibold hover:bg-stone-50 transition"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-brand text-white text-xs sm:text-sm font-semibold hover:bg-brand/90 transition disabled:opacity-50 shadow-lg shadow-brand/20"
            disabled={saving}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              "Save Record"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// TEACHER SALARY MANAGEMENT
// ============================================

export function TeacherSalaryPage() {
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>(
    String(new Date().getMonth() + 1).padStart(2, '0')
  );
  const [selectedYear, setSelectedYear] = useState<string>(
    String(new Date().getFullYear())
  );
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [stats, setStats] = useState({
    totalGrossSalary: 0,
    totalNetSalary: 0,
    totalDeductions: 0,
    totalTeachers: 0,
    averageSalary: 0
  });

  // ============================================
  // FETCH SALARIES
  // ============================================

  const fetchSalaries = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedTeacher) params.append('teacherId', selectedTeacher);
      if (selectedMonth) params.append('month', selectedMonth);
      if (selectedYear) params.append('year', selectedYear);
      if (selectedStatus) params.append('status', selectedStatus);

      const response = await axios.get(`${API_BASE}/salary?${params.toString()}`);
      if (response.data.success) {
        const normalized = response.data.data.map((salary: any) => {
          const teacherId = typeof salary.teacherId === "object" ? salary.teacherId?._id : salary.teacherId;
          return {
            ...salary,
            id: String(salary._id || salary.id),
            teacherId: String(teacherId || ""),
            teacherName: salary.teacherName || salary.teacherId?.name || teachers.find((teacher) => teacher._id === String(teacherId))?.name || "Unknown teacher",
          };
        });
        setSalaries(normalized);
        calculateSalaryStats(normalized);
        return normalized;
      }
    } catch (error) {
      console.error('Error fetching salaries:', error);
      // Generate mock salaries
      const mockSalaries = generateMockSalaries(teachers);
      setSalaries(mockSalaries);
      calculateSalaryStats(mockSalaries);
      return mockSalaries;
    }
  }, [selectedTeacher, selectedMonth, selectedYear, selectedStatus, teachers]);

  const generateMockSalaries = (teachersList: Teacher[]) => {
    const mockSalaries: SalaryRecord[] = [];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    teachersList.forEach((teacher, i) => {
      const firstCycle = Math.floor(Math.random() * 20) + 10;
      const secondCycle = Math.floor(Math.random() * 15) + 5;
      const grossSalary = (firstCycle * 500) + (secondCycle * 700);
      const absentDays = Math.floor(Math.random() * 3);
      const deductions = absentDays * 5000;

      mockSalaries.push({
        id: `salary_${i}`,
        teacherId: teacher._id,
        teacherName: teacher.name,
        month: monthNames[parseInt(selectedMonth) - 1],
        year: selectedYear,
        periodCounts: {
          firstCycle: firstCycle,
          secondCycle: secondCycle,
          total: firstCycle + secondCycle
        },
        rates: {
          firstCycle: 500,
          secondCycle: 700
        },
        grossSalary: grossSalary,
        deductions: {
          total: deductions,
          details: absentDays > 0 ? [{
            type: 'absence',
            amount: deductions,
            description: `${absentDays} absence(s) × 5,000 FRS`
          }] : []
        },
        netSalary: grossSalary - deductions,
        attendance: {
          present: 20 - absentDays,
          absent: absentDays,
          late: Math.floor(Math.random() * 2),
          excused: Math.floor(Math.random() * 2)
        },
        status: i % 3 === 0 ? 'paid' : i % 3 === 1 ? 'partially_paid' : 'pending',
        paymentDate: i % 3 === 0 ? new Date().toISOString() : undefined,
        paymentMethod: i % 3 === 0 ? 'cash' : undefined
      });
    });

    return mockSalaries;
  };

  const calculateSalaryStats = (salaryList: SalaryRecord[]) => {
    const stats = {
      totalGrossSalary: salaryList.reduce((sum, s) => sum + s.grossSalary, 0),
      totalNetSalary: salaryList.reduce((sum, s) => sum + s.netSalary, 0),
      totalDeductions: salaryList.reduce((sum, s) => sum + s.deductions.total, 0),
      totalTeachers: salaryList.length,
      averageSalary: salaryList.length > 0 ? salaryList.reduce((sum, s) => sum + s.netSalary, 0) / salaryList.length : 0
    };
    setStats(stats);
  };

  // ============================================
  // PRINT SALARY
  // ============================================

  const printSalary = (salary: SalaryRecord) => {
    const printContent = document.createElement('div');
    printContent.className = 'print-content';
    printContent.style.cssText = `
      padding: 30px;
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      background: white;
    `;

    const earningsRows = salary.paymentMode === 'monthly'
      ? `<tr><td style="padding: 8px; border: 1px solid #ddd;">Monthly salary</td><td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${(salary.monthlyAmount ?? salary.grossSalary).toLocaleString()}</td></tr>`
      : salary.classBreakdown?.length
        ? salary.classBreakdown.map((item) => `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">${item.className}: ${item.periods} periods × ${item.ratePerPeriod.toLocaleString()} FRS</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${item.amount.toLocaleString()}</td>
            </tr>
          `).join('')
        : `
            <tr><td style="padding: 8px; border: 1px solid #ddd;">1st Cycle Periods (${salary.periodCounts.firstCycle} × ${salary.rates.firstCycle} FRS)</td><td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${(salary.periodCounts.firstCycle * salary.rates.firstCycle).toLocaleString()}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd;">2nd Cycle Periods (${salary.periodCounts.secondCycle} × ${salary.rates.secondCycle} FRS)</td><td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${(salary.periodCounts.secondCycle * salary.rates.secondCycle).toLocaleString()}</td></tr>
          `;

    let html = `
      <div style="text-align: center; margin-bottom: 25px;">
        <h1 style="color: #155DAA; font-size: 24px; margin-bottom: 5px;">BCHS DOUALA</h1>
        <h2 style="color: #333; font-size: 18px;">Teacher Salary Statement</h2>
        <p style="color: #666; font-size: 14px; margin-top: 5px;">${salary.teacherName}</p>
        <p style="color: #999; font-size: 12px;">${salary.month} ${salary.year}</p>
        <hr style="border: 1px solid #155DAA; margin: 15px 0;">
      </div>
    `;

    html += `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
        <div style="background: #f5f5f5; padding: 12px; border-radius: 8px;">
          <p style="font-size: 11px; color: #666; margin-bottom: 2px;">Total Periods</p>
          <p style="font-size: 20px; font-weight: bold; color: #155DAA;">${salary.periodCounts.total}</p>
          <p style="font-size: 10px; color: #999;">1st Cycle: ${salary.periodCounts.firstCycle} | 2nd Cycle: ${salary.periodCounts.secondCycle}</p>
        </div>
        <div style="background: #f5f5f5; padding: 12px; border-radius: 8px;">
          <p style="font-size: 11px; color: #666; margin-bottom: 2px;">Status</p>
          <p style="font-size: 16px; font-weight: bold; color: ${salary.status === 'paid' ? '#22C55E' : salary.status === 'partially_paid' ? '#EAB308' : '#EF4444'};">
            ${salary.status.charAt(0).toUpperCase() + salary.status.slice(1)}
          </p>
          ${salary.paymentDate ? `<p style="font-size: 10px; color: #999;">Paid: ${new Date(salary.paymentDate).toLocaleDateString()}</p>` : ''}
        </div>
      </div>
    `;

    html += `
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #155DAA; color: white;">
            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Description</th>
            <th style="padding: 10px; border: 1px solid #ddd; text-align: right;">Amount (FRS)</th>
          </tr>
        </thead>
        <tbody>
          ${earningsRows}
          <tr style="background: #f5f5f5; font-weight: bold;">
            <td style="padding: 8px; border: 1px solid #ddd;">Gross Salary</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${salary.grossSalary.toLocaleString()}</td>
          </tr>
          ${salary.deductions.details.map(d => `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">${d.description}</td>
              <td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: #EF4444;">-${d.amount.toLocaleString()}</td>
            </tr>
          `).join('')}
          <tr style="background: #f5f5f5; font-weight: bold;">
            <td style="padding: 8px; border: 1px solid #ddd;">Net Salary</td>
            <td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: #155DAA;">${salary.netSalary.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    `;

    html += `
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px;">
        <div style="background: #f5f5f5; padding: 10px; text-align: center; border-radius: 8px;">
          <p style="font-size: 10px; color: #666;">Present</p>
          <p style="font-size: 18px; font-weight: bold; color: #22C55E;">${salary.attendance.present}</p>
        </div>
        <div style="background: #f5f5f5; padding: 10px; text-align: center; border-radius: 8px;">
          <p style="font-size: 10px; color: #666;">Absent</p>
          <p style="font-size: 18px; font-weight: bold; color: #EF4444;">${salary.attendance.absent}</p>
        </div>
        <div style="background: #f5f5f5; padding: 10px; text-align: center; border-radius: 8px;">
          <p style="font-size: 10px; color: #666;">Late</p>
          <p style="font-size: 18px; font-weight: bold; color: #EAB308;">${salary.attendance.late}</p>
        </div>
      </div>
    `;

    html += `
      <div style="margin-top: 20px; text-align: center; color: #999; font-size: 11px; border-top: 1px solid #ddd; padding-top: 15px;">
        <p>Generated on ${new Date().toLocaleString()} • BCHS DOUALA</p>
        <div style="display: flex; justify-content: space-between; margin-top: 10px;">
          <div style="text-align: center;">
            <div style="border-bottom: 1px solid #333; width: 150px; margin: 0 auto;"></div>
            <p style="font-size: 10px; margin-top: 5px;">Accountant Signature</p>
          </div>
          <div style="text-align: center;">
            <div style="border-bottom: 1px solid #333; width: 150px; margin: 0 auto;"></div>
            <p style="font-size: 10px; margin-top: 5px;">Teacher Signature</p>
          </div>
        </div>
      </div>
    `;

    printContent.innerHTML = html;

    const style = document.createElement('style');
    style.textContent = `
      @media print {
        body * { visibility: hidden; }
        .print-content, .print-content * { visibility: visible; }
        .print-content { position: absolute; left: 0; top: 0; width: 100%; background: white; }
        @page { margin: 10mm; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(printContent);

    setTimeout(() => {
      window.print();
      document.body.removeChild(printContent);
      document.head.removeChild(style);
      toast.success('Salary statement printed');
    }, 500);
  };

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const teachersRes = await axios.get(`${API_BASE}/users?role=teacher`);
        if (teachersRes.data.success) {
          const teacherAccounts = teachersRes.data.data.filter(
            (user: Teacher) => user.role?.trim().toLowerCase() === "teacher"
          );
          setTeachers(teacherAccounts);
        }
      } catch (error) {
        console.error('Error fetching teachers:', error);
        const mockTeachers = [
          { _id: 't1', name: 'John Doe', email: 'john@school.com', phone: '699123456', qualification: 'BSc Math', role: 'teacher' },
          { _id: 't2', name: 'Jane Smith', email: 'jane@school.com', phone: '699234567', qualification: 'BEd English', role: 'teacher' },
          { _id: 't3', name: 'Michael Brown', email: 'michael@school.com', phone: '699345678', qualification: 'PhD Physics', role: 'teacher' },
          { _id: 't4', name: 'Sarah Wilson', email: 'sarah@school.com', phone: '699456789', qualification: 'MSc Chemistry', role: 'teacher' },
          { _id: 't5', name: 'David Kim', email: 'david@school.com', phone: '699567890', qualification: 'BEd History', role: 'teacher' },
        ];
        setTeachers(mockTeachers);
      }
      await fetchSalaries();
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    if (teachers.length > 0) {
      fetchSalaries();
    }
  }, [selectedTeacher, selectedMonth, selectedYear, selectedStatus, teachers]);

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return <CompactPageLoader label="Loading salaries..." />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-4 md:px-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-2 sm:gap-3">
            <DollarSign className="size-6 sm:size-8 text-brand" />
            Teacher Salaries
          </h1>
          <p className="text-xs sm:text-sm text-black/60 mt-0.5 sm:mt-1">
            {salaries.length} records • {stats.totalNetSalary.toLocaleString()} FRS total paid
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const params = new URLSearchParams();
              params.append('month', selectedMonth);
              params.append('year', selectedYear);
              // Trigger salary generation
              axios.post(`${API_BASE}/salary/generate`, {
                month: parseInt(selectedMonth),
                year: selectedYear
              }).then((response) => {
                const result = response.data.data || {};
                if (result.errors > 0) {
                  toast.error(`${result.created || 0} salaries generated; ${result.errors} need attention`);
                } else {
                  toast.success(`${result.created || 0} salaries generated`);
                }
                fetchSalaries();
              }).catch(() => {
                toast.error('Failed to generate salaries');
              });
            }}
            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-semibold hover:bg-blue-700 transition"
          >
            <RefreshCw className="size-4" />
            Generate
          </button>
          <button
            onClick={() => {
              // Export to PDF all salaries
              salaries.forEach(s => printSalary(s));
            }}
            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-brand text-white text-xs sm:text-sm font-semibold hover:bg-brand/90 transition"
          >
            <Printer className="size-4" />
            Print All
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-black/40 font-medium uppercase tracking-wider">Total Gross</p>
          <p className="text-lg sm:text-xl font-bold text-brand mt-0.5 sm:mt-1 truncate">{stats.totalGrossSalary.toLocaleString()} FRS</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-black/40 font-medium uppercase tracking-wider">Total Net</p>
          <p className="text-lg sm:text-xl font-bold text-green-600 mt-0.5 sm:mt-1 truncate">{stats.totalNetSalary.toLocaleString()} FRS</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-black/40 font-medium uppercase tracking-wider">Deductions</p>
          <p className="text-lg sm:text-xl font-bold text-red-500 mt-0.5 sm:mt-1 truncate">{stats.totalDeductions.toLocaleString()} FRS</p>
        </div>
        <div className="bg-white rounded-2xl border border-brand/20 bg-brand/5 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-brand/60 font-medium uppercase tracking-wider">Average Salary</p>
          <p className="text-lg sm:text-xl font-bold text-brand mt-0.5 sm:mt-1 truncate">{Math.round(stats.averageSalary).toLocaleString()} FRS</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-3 items-end">
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 size-3 sm:size-4 text-black/40" />
          <input
            type="text"
            placeholder="Search teacher..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-7 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2.5 rounded-xl border border-stone-200 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
        </div>

        <select
          value={selectedTeacher}
          onChange={(e) => setSelectedTeacher(e.target.value)}
          className="px-2 sm:px-4 py-1.5 sm:py-2.5 rounded-xl border border-stone-200 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand min-w-[100px] sm:min-w-[150px]"
        >
          <option value="">All Teachers</option>
          {teachers.map(t => (
            <option key={t._id} value={t._id}>{t.name}</option>
          ))}
        </select>

        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="px-2 sm:px-4 py-1.5 sm:py-2.5 rounded-xl border border-stone-200 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand min-w-[80px] sm:min-w-[100px]"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
            <option key={m} value={String(m).padStart(2, '0')}>
              {new Date(2024, m - 1).toLocaleString('default', { month: 'short' })}
            </option>
          ))}
        </select>

        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value)}
          className="px-2 sm:px-4 py-1.5 sm:py-2.5 rounded-xl border border-stone-200 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand min-w-[70px] sm:min-w-[90px]"
        >
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
            <option key={y} value={String(y)}>{y}</option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-2 sm:px-4 py-1.5 sm:py-2.5 rounded-xl border border-stone-200 bg-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand min-w-[80px] sm:min-w-[100px]"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="partially_paid">Partial</option>
        </select>
      </div>

      {/* Salary Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] sm:min-w-full">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Teacher</th>
                <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Month</th>
                <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Periods</th>
                <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Gross</th>
                <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Deductions</th>
                <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Net</th>
                <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Status</th>
                <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-center text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {salaries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-black/40">
                    <DollarSign className="size-10 sm:size-12 mx-auto text-black/20 mb-2" />
                    <p className="text-sm">No salary records found</p>
                  </td>
                </tr>
              ) : (
                salaries.map((salary) => (
                  <tr key={salary.id} className="border-b border-stone-100 hover:bg-stone-50 transition">
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm font-medium">{salary.teacherName}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm">{salary.month} {salary.year}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm">
                      {salary.periodCounts.total}
                      <span className="text-[8px] sm:text-[10px] text-black/40 block">
                        1st: {salary.periodCounts.firstCycle} | 2nd: {salary.periodCounts.secondCycle}
                      </span>
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm font-medium">
                      {salary.grossSalary.toLocaleString()} FRS
                      <span className="block text-[9px] sm:text-[10px] font-normal text-black/40">
                        {salary.paymentMode === "monthly" ? "Monthly rate" : "Per-period rates"}
                      </span>
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm text-red-500">{salary.deductions.total.toLocaleString()} FRS</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm font-bold text-brand">{salary.netSalary.toLocaleString()} FRS</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5">
                      <span className={`badge ${salary.status === 'paid' ? 'badge-success' : salary.status === 'partially_paid' ? 'badge-warning' : 'badge-danger'} text-[8px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1`}>
                        {salary.status.charAt(0).toUpperCase() + salary.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-center">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => printSalary(salary)}
                          className="p-1 rounded-lg hover:bg-stone-100 text-black/60 transition"
                          title="Print Salary"
                        >
                          <Printer className="size-3 sm:size-4" />
                        </button>
                        {salary.status !== 'paid' && (
                          <button
                            onClick={async () => {
                              try {
                                await axios.put(`${API_BASE}/salary/pay/${salary.id}`, {
                                  paymentMethod: 'cash'
                                });
                                toast.success('Salary marked as paid');
                                fetchSalaries();
                              } catch (error) {
                                toast.error('Failed to update salary');
                              }
                            }}
                            className="p-1 rounded-lg hover:bg-green-50 text-green-500 transition"
                            title="Mark as Paid"
                          >
                            <Check className="size-3 sm:size-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-3 sm:px-4 py-2 sm:py-3 border-t border-stone-200 text-xs sm:text-sm text-black/40 flex justify-between">
          <span>Total: {salaries.length} records</span>
          <span>Total Net: {stats.totalNetSalary.toLocaleString()} FRS</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

const inputCls = "w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition";

// Add to your main component exports
export function TeacherManagementPages() {
  return {
    TeacherAttendancePage,
    TeacherSalaryPage
  };
}