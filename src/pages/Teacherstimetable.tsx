import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Calendar, Clock, Users, Search, X, CalendarDays, 
  User, BookOpen, ChevronLeft, ChevronRight, 
  AlertCircle, Check, Home, LogOut, Menu, 
  Sun, Moon, Settings, Bell, Award, DollarSign, Download, Printer,
  ChevronDown, ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const API_BASE = "https://manfess-back.onrender.com/api";

// ============================================
// TYPES
// ============================================

interface TimetableEntry {
  id: string;
  teacherId: string;
  teacherName: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  subjectCode?: string;
  day: string;
  startTime: string;
  endTime: string;
  periodNumber: number;
  cycle: "first" | "second";
  ratePerPeriod: number;
  room?: string;
  academicYear: string;
  isActive: boolean;
}

interface Teacher {
  id: string;
  name: string;
  email: string;
  username: string;
  qualification: string;
  role: string;
}

interface TeacherStats {
  totalPeriods: number;
  firstCyclePeriods: number;
  secondCyclePeriods: number;
  totalPotentialEarnings: number;
  days: string[];
}

interface TimetableData {
  teacher: Teacher;
  stats: TeacherStats;
  timetable: TimetableEntry[];
  groupedByDay: Record<string, TimetableEntry[]>;
  totalEntries: number;
}

interface WeeklyData {
  teacher: Teacher;
  currentDay: string;
  todaySchedule: TimetableEntry[];
  upcomingToday: TimetableEntry[];
  nextPeriod: TimetableEntry | null;
  weeklySchedule: TimetableEntry[];
  stats: {
    totalPeriods: number;
    todayPeriods: number;
    remainingToday: number;
  };
}

// ============================================
// SUBJECT AND CLASS DATA
// ============================================

const SUBJECTS = [
  { id: 's1', name: 'Mathematics', code: 'MATH' },
  { id: 's2', name: 'English Language', code: 'ENG' },
  { id: 's3', name: 'Physics', code: 'PHY' },
  { id: 's4', name: 'Chemistry', code: 'CHEM' },
  { id: 's5', name: 'Biology', code: 'BIO' },
  { id: 's6', name: 'History', code: 'HIST' },
  { id: 's7', name: 'Geography', code: 'GEOG' },
  { id: 's8', name: 'French', code: 'FRENCH' },
  { id: 's9', name: 'Information Technology', code: 'ICT' },
  { id: 's10', name: 'Economics', code: 'ECON' },
  { id: 's11', name: 'Literature', code: 'LIT' },
  { id: 's12', name: 'Further Mathematics', code: 'F MATH' },
];

const CLASSES = [
  { id: 'c1', name: 'Form 1 Science A', department: 'Science' },
  { id: 'c2', name: 'Form 1 Science B', department: 'Science' },
  { id: 'c3', name: 'Form 2 Science A', department: 'Science' },
  { id: 'c4', name: 'Form 2 Science B', department: 'Science' },
  { id: 'c5', name: 'Form 3 Science A', department: 'Science' },
  { id: 'c6', name: 'Form 3 Science B', department: 'Science' },
  { id: 'c7', name: 'Form 4 Science A', department: 'Science' },
  { id: 'c8', name: 'Form 4 Science B', department: 'Science' },
  { id: 'c9', name: 'Form 5 Science A', department: 'Science' },
  { id: 'c10', name: 'Form 5 Science B', department: 'Science' },
  { id: 'c11', name: 'Form 3 Arts', department: 'Arts' },
  { id: 'c12', name: 'Form 4 Arts', department: 'Arts' },
  { id: 'c13', name: 'Form 5 Arts', department: 'Arts' },
  { id: 'c14', name: 'Form 4 Commercial', department: 'Commercial' },
  { id: 'c15', name: 'Form 5 Commercial', department: 'Commercial' },
];

// ============================================
// TEACHER TIMETABLE VIEW
// ============================================

export function TeacherTimetableView() {
  const [loading, setLoading] = useState(true);
  const [timetableData, setTimetableData] = useState<TimetableData | null>(null);
  const [weeklyData, setWeeklyData] = useState<WeeklyData | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [daySchedule, setDaySchedule] = useState<TimetableEntry[]>([]);
  const [viewMode, setViewMode] = useState<"weekly" | "daily" | "today">("weekly");
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hasFetched = useRef(false);

  // Get logged in user from localStorage
  const getLoggedInUser = () => {
    try {
      const userStr = localStorage.getItem('mams-user') || localStorage.getItem('belmon-user') || localStorage.getItem('user');
      if (userStr) {
        return JSON.parse(userStr);
      }
      return null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  };

  const user = getLoggedInUser();

  // ============================================
  // GENERATE MOCK DATA
  // ============================================

  const generateMockData = (userData?: any) => {
    const mockTeacher: Teacher = {
      id: 't1',
      name: userData?.name || 'John Doe',
      email: userData?.email || 'john@school.com',
      username: userData?.username || 'john_doe',
      qualification: 'BSc Mathematics',
      role: 'teacher'
    };

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const mockEntries: TimetableEntry[] = [];
    const periods = [1, 2, 3, 4, 5, 6];

    days.forEach((day, di) => {
      periods.forEach((period, pi) => {
        if (Math.random() > 0.35) {
          const cycle = pi % 2 === 0 ? 'first' : 'second';
          const classIdx = (di + pi * 2) % CLASSES.length;
          const subjectIdx = (di + pi * 3) % SUBJECTS.length;
          
          const cls = CLASSES[classIdx];
          const subj = SUBJECTS[subjectIdx];
          
          mockEntries.push({
            id: `mock_${di}_${pi}_${Date.now()}`,
            teacherId: mockTeacher.id,
            teacherName: mockTeacher.name,
            classId: cls.id,
            className: cls.name,
            subjectId: subj.id,
            subjectName: subj.name,
            subjectCode: subj.code,
            day: day,
            startTime: `${8 + Math.floor(period / 2)}:${period % 2 === 0 ? '00' : '30'}`,
            endTime: `${8 + Math.floor(period / 2) + 1}:${period % 2 === 0 ? '00' : '30'}`,
            periodNumber: period,
            cycle: cycle as 'first' | 'second',
            ratePerPeriod: cycle === 'first' ? 500 : 700,
            room: `Room ${Math.floor(Math.random() * 10) + 1}`,
            academicYear: '2024-2025',
            isActive: true
          });
        }
      });
    });

    if (mockEntries.length === 0) {
      days.forEach((day, di) => {
        const cls = CLASSES[di % CLASSES.length];
        const subj = SUBJECTS[di % SUBJECTS.length];
        mockEntries.push({
          id: `fallback_${di}`,
          teacherId: mockTeacher.id,
          teacherName: mockTeacher.name,
          classId: cls.id,
          className: cls.name,
          subjectId: subj.id,
          subjectName: subj.name,
          subjectCode: subj.code,
          day: day,
          startTime: '09:00',
          endTime: '10:00',
          periodNumber: 2,
          cycle: 'first',
          ratePerPeriod: 500,
          room: 'Room 1',
          academicYear: '2024-2025',
          isActive: true
        });
      });
    }

    const groupedByDay: Record<string, TimetableEntry[]> = {};
    days.forEach(day => {
      groupedByDay[day] = mockEntries
        .filter(e => e.day === day)
        .sort((a, b) => parseInt(a.startTime) - parseInt(b.startTime));
    });

    const stats: TeacherStats = {
      totalPeriods: mockEntries.length,
      firstCyclePeriods: mockEntries.filter(e => e.cycle === 'first').length,
      secondCyclePeriods: mockEntries.filter(e => e.cycle === 'second').length,
      totalPotentialEarnings: mockEntries.reduce((sum, e) => sum + e.ratePerPeriod, 0),
      days: days
    };

    return {
      teacher: mockTeacher,
      stats: stats,
      timetable: mockEntries,
      groupedByDay: groupedByDay,
      totalEntries: mockEntries.length
    };
  };

  // ============================================
  // FETCH TIMETABLE
  // ============================================

  const fetchTeacherTimetable = useCallback(async () => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    if (!user) {
      const mockData = generateMockData();
      setTimetableData(mockData);
      setError(null);
      setLoading(false);
      toast.info('Using demo data (no user logged in)');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const teacherId = user.id || user._id;
      
      if (!teacherId) {
        throw new Error('No teacher ID found');
      }

      const response = await axios.get(`${API_BASE}/teacher/timetable`, {
        params: { teacherId }
      });
      
      if (response.data.success) {
        const data = response.data.data;
        
        const mappedTimetable = data.timetable.map((entry: any) => {
          const className = entry.classId?.className || entry.className || 'Unknown Class';
          const department = entry.classId?.department || '';
          const fullClassName = department ? `${className} (${department})` : className;
          const subjectName = entry.subjectId?.name || entry.subjectName || 'Unknown Subject';
          const subjectCode = entry.subjectId?.code || entry.subjectCode || '';
          
          return {
            ...entry,
            className: fullClassName,
            subjectName: subjectName,
            subjectCode: subjectCode,
            teacherName: entry.teacherId?.name || entry.teacherName || 'Unknown Teacher',
            classData: entry.classId,
            subjectData: entry.subjectId
          };
        });

        const groupedByDay: Record<string, TimetableEntry[]> = {};
        Object.keys(data.groupedByDay || {}).forEach(day => {
          groupedByDay[day] = (data.groupedByDay[day] || []).map((entry: any) => {
            const className = entry.classId?.className || entry.className || 'Unknown Class';
            const department = entry.classId?.department || '';
            const fullClassName = department ? `${className} (${department})` : className;
            const subjectName = entry.subjectId?.name || entry.subjectName || 'Unknown Subject';
            const subjectCode = entry.subjectId?.code || entry.subjectCode || '';
            
            return {
              ...entry,
              className: fullClassName,
              subjectName: subjectName,
              subjectCode: subjectCode,
              teacherName: entry.teacherId?.name || entry.teacherName || 'Unknown Teacher'
            };
          });
        });

        const mappedData = {
          ...data,
          timetable: mappedTimetable,
          groupedByDay: groupedByDay
        };

        setTimetableData(mappedData);
        setWeeklyData(null);
        setSelectedDay('');
        setDaySchedule([]);
        toast.success('Timetable loaded successfully');
      } else {
        throw new Error(response.data.message || 'Failed to load timetable');
      }
    } catch (error: any) {
      console.error('Error fetching timetable:', error);
      setError(error.message || 'Failed to load timetable');
      toast.error('Failed to load timetable. Using demo data...');
      
      const mockData = generateMockData(user);
      setTimetableData(mockData);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch weekly schedule
  const fetchWeeklySchedule = useCallback(async () => {
    if (!user || !timetableData) return;

    try {
      const teacherId = user.id || user._id;
      const response = await axios.get(`${API_BASE}/teacher/weekly`, {
        params: { teacherId }
      });
      
      if (response.data.success) {
        const data = response.data.data;
        const mappedTodaySchedule = data.todaySchedule.map((entry: any) => ({
          ...entry,
          subjectName: entry.subjectId?.name || entry.subjectName || 'Unknown Subject',
          subjectCode: entry.subjectId?.code || entry.subjectCode || '',
          className: entry.classId?.className || entry.className || 'Unknown Class'
        }));
        setWeeklyData({
          ...data,
          todaySchedule: mappedTodaySchedule,
          upcomingToday: mappedTodaySchedule,
          nextPeriod: mappedTodaySchedule.length > 0 ? mappedTodaySchedule[0] : null
        });
      }
    } catch (error) {
      console.error('Error fetching weekly schedule:', error);
      const currentDay = new Date().toLocaleString('en-US', { weekday: 'long' });
      const todaySchedule = timetableData.groupedByDay[currentDay] || [];
      setWeeklyData({
        teacher: timetableData.teacher,
        currentDay: currentDay,
        todaySchedule: todaySchedule,
        upcomingToday: todaySchedule,
        nextPeriod: todaySchedule.length > 0 ? todaySchedule[0] : null,
        weeklySchedule: timetableData.timetable,
        stats: {
          totalPeriods: timetableData.timetable.length,
          todayPeriods: todaySchedule.length,
          remainingToday: todaySchedule.length
        }
      });
    }
  }, [user, timetableData]);

  // ============================================
  // EXPORT TO PDF
  // ============================================

  const exportToPDF = () => {
    if (!timetableData) {
      toast.error('No timetable data to export');
      return;
    }

    setIsExporting(true);
    
    const printContent = document.createElement('div');
    printContent.className = 'print-content';
    printContent.style.cssText = `
      padding: 20px;
      font-family: Arial, sans-serif;
      max-width: 100%;
      background: white;
    `;

    let html = `
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #D4AF37; font-size: 20px; margin-bottom: 5px;">BELMON BILINGUAL HIGH SCHOOL</h1>
        <p style="color: #666; font-size: 12px;">Teacher Timetable Report</p>
        <p style="color: #999; font-size: 11px;">${timetableData.teacher.name} - ${timetableData.teacher.qualification || 'Teacher'}</p>
        <hr style="border: 1px solid #D4AF37; margin: 10px 0;">
      </div>
    `;

    html += `
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
        <div style="background: #f5f5f5; padding: 10px; border-radius: 8px; text-align: center;">
          <p style="font-size: 10px; color: #666;">Total Periods</p>
          <p style="font-size: 18px; font-weight: bold; color: #D4AF37;">${timetableData.stats.totalPeriods}</p>
        </div>
        <div style="background: #f5f5f5; padding: 10px; border-radius: 8px; text-align: center;">
          <p style="font-size: 10px; color: #666;">1st Cycle</p>
          <p style="font-size: 18px; font-weight: bold; color: #2563EB;">${timetableData.stats.firstCyclePeriods}</p>
        </div>
        <div style="background: #f5f5f5; padding: 10px; border-radius: 8px; text-align: center;">
          <p style="font-size: 10px; color: #666;">2nd Cycle</p>
          <p style="font-size: 18px; font-weight: bold; color: #7C3AED;">${timetableData.stats.secondCyclePeriods}</p>
        </div>
        <div style="background: #f5f5f5; padding: 10px; border-radius: 8px; text-align: center;">
          <p style="font-size: 10px; color: #666;">Potential Earnings</p>
          <p style="font-size: 18px; font-weight: bold; color: #D4AF37;">${timetableData.stats.totalPotentialEarnings.toLocaleString()} FRS</p>
        </div>
      </div>
    `;

    html += `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; min-width: 600px;">
          <thead>
            <tr style="background: #D4AF37; color: white;">
              <th style="padding: 4px; border: 1px solid #ddd; text-align: left;">Day</th>
              <th style="padding: 4px; border: 1px solid #ddd; text-align: left;">Period</th>
              <th style="padding: 4px; border: 1px solid #ddd; text-align: left;">Time</th>
              <th style="padding: 4px; border: 1px solid #ddd; text-align: left;">Subject</th>
              <th style="padding: 4px; border: 1px solid #ddd; text-align: left;">Class</th>
              <th style="padding: 4px; border: 1px solid #ddd; text-align: left;">Cycle</th>
              <th style="padding: 4px; border: 1px solid #ddd; text-align: left;">Rate</th>
              <th style="padding: 4px; border: 1px solid #ddd; text-align: left;">Room</th>
            </tr>
          </thead>
          <tbody>
    `;

    const entries = timetableData.timetable;

    entries.forEach((entry, index) => {
      html += `
        <tr style="${index % 2 === 0 ? 'background: #fafafa;' : ''}">
          <td style="padding: 4px; border: 1px solid #ddd;">${entry.day}</td>
          <td style="padding: 4px; border: 1px solid #ddd;">${entry.periodNumber || index + 1}</td>
          <td style="padding: 4px; border: 1px solid #ddd;">${entry.startTime} - ${entry.endTime}</td>
          <td style="padding: 4px; border: 1px solid #ddd;">${entry.subjectName} ${entry.subjectCode ? `(${entry.subjectCode})` : ''}</td>
          <td style="padding: 4px; border: 1px solid #ddd;">${entry.className}</td>
          <td style="padding: 4px; border: 1px solid #ddd;">${entry.cycle === 'first' ? '1st' : '2nd'}</td>
          <td style="padding: 4px; border: 1px solid #ddd;">${entry.ratePerPeriod} FRS</td>
          <td style="padding: 4px; border: 1px solid #ddd;">${entry.room || '-'}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
      <div style="margin-top: 15px; text-align: center; color: #999; font-size: 10px; border-top: 1px solid #ddd; padding-top: 10px;">
        <p>Generated on ${new Date().toLocaleString()} • BELMON BILINGUAL HIGH SCHOOL</p>
      </div>
    `;

    printContent.innerHTML = html;

    const style = document.createElement('style');
    style.textContent = `
      @media print {
        body * { visibility: hidden; }
        .print-content, .print-content * { visibility: visible; }
        .print-content { position: absolute; left: 0; top: 0; width: 100%; background: white; }
        table { page-break-inside: auto; }
        tr { page-break-inside: avoid; page-break-after: auto; }
        @page { margin: 10mm; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(printContent);

    setTimeout(() => {
      window.print();
      document.body.removeChild(printContent);
      document.head.removeChild(style);
      setIsExporting(false);
      toast.success('PDF export initiated');
    }, 500);
  };

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    fetchTeacherTimetable();
  }, [fetchTeacherTimetable]);

  useEffect(() => {
    if (timetableData && viewMode === 'weekly') {
      fetchWeeklySchedule();
    }
  }, [timetableData, viewMode]);

  // ============================================
  // RENDER FUNCTIONS
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] sm:min-h-[500px]">
        <div className="text-center px-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-black/60 font-medium">Loading your timetable...</p>
        </div>
      </div>
    );
  }

  if (error && !timetableData) {
    return (
      <div className="text-center py-8 sm:py-12 px-4">
        <AlertCircle className="size-12 sm:size-16 mx-auto text-red-500 mb-3 sm:mb-4" />
        <p className="text-red-600 font-medium text-sm sm:text-base">{error}</p>
        <button 
          onClick={() => {
            hasFetched.current = false;
            fetchTeacherTimetable();
          }}
          className="mt-3 sm:mt-4 px-4 sm:px-6 py-2 sm:py-3 rounded-xl bg-brand text-white font-semibold hover:bg-brand/90 text-sm sm:text-base"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!timetableData) {
    return (
      <div className="text-center py-8 sm:py-12 px-4">
        <Calendar className="size-12 sm:size-16 mx-auto text-black/20 mb-3 sm:mb-4" />
        <p className="text-black/60 text-sm sm:text-base">No timetable data available</p>
        <button 
          onClick={() => {
            hasFetched.current = false;
            fetchTeacherTimetable();
          }}
          className="mt-3 sm:mt-4 px-4 sm:px-6 py-2 sm:py-3 rounded-xl bg-brand text-white font-semibold hover:bg-brand/90 text-sm sm:text-base"
        >
          Refresh
        </button>
      </div>
    );
  }

  const { teacher, stats, groupedByDay } = timetableData;

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-4 md:px-6 max-w-full">
      {/* Error Banner */}
      {error && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800 flex items-center gap-2">
          <AlertCircle className="size-4 flex-shrink-0" />
          <span className="text-xs sm:text-sm">Using demo data - {error}</span>
        </div>
      )}

      {/* Teacher Profile Header - Mobile Optimized */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-brand/10 flex items-center justify-center text-xl sm:text-2xl font-bold text-brand flex-shrink-0">
              {teacher.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg sm:text-2xl font-bold truncate">{teacher.name}</h2>
              <p className="text-xs sm:text-sm text-black/60 truncate">{teacher.qualification || 'Teacher'}</p>
            </div>
          </div>
          
          {/* View Toggle Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
            <div className="flex gap-1 w-full sm:w-auto">
              <button 
                onClick={() => { setViewMode('today'); fetchWeeklySchedule(); }}
                className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition ${viewMode === 'today' ? 'bg-brand text-white' : 'bg-stone-100 hover:bg-stone-200'}`}
              >
                Today
              </button>
              <button 
                onClick={() => { setViewMode('weekly'); fetchWeeklySchedule(); }}
                className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition ${viewMode === 'weekly' ? 'bg-brand text-white' : 'bg-stone-100 hover:bg-stone-200'}`}
              >
                Weekly
              </button>
              <button 
                onClick={() => setViewMode('daily')}
                className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition ${viewMode === 'daily' ? 'bg-brand text-white' : 'bg-stone-100 hover:bg-stone-200'}`}
              >
                Daily
              </button>
            </div>
            <button 
              onClick={exportToPDF}
              disabled={isExporting}
              className="flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition flex items-center justify-center gap-1 sm:gap-2"
            >
              {isExporting ? (
                <span className="animate-spin"> <Download className="size-3 sm:size-4" /></span>
              ) : (
                <>
                  <Download className="size-3 sm:size-4" />
                  <span className="hidden xs:inline">PDF</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Teacher Details */}
        <div className="flex flex-wrap gap-2 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-stone-100 text-xs sm:text-sm text-black/60">
          <span className="flex items-center gap-1"><User className="size-3 sm:size-4" /> {teacher.username || teacher.email}</span>
          <span className="flex items-center gap-1"><BookOpen className="size-3 sm:size-4" /> {stats.totalPeriods} periods</span>
          <span className="flex items-center gap-1 text-brand"><DollarSign className="size-3 sm:size-4" /> {stats.totalPotentialEarnings.toLocaleString()} FRS</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-black/40 font-medium uppercase tracking-wider">Total Periods</p>
          <p className="text-lg sm:text-2xl font-bold mt-0.5 sm:mt-1">{stats.totalPeriods}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-black/40 font-medium uppercase tracking-wider">1st Cycle</p>
          <p className="text-lg sm:text-2xl font-bold text-blue-600 mt-0.5 sm:mt-1">{stats.firstCyclePeriods}</p>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-4">
          <p className="text-[10px] sm:text-xs text-black/40 font-medium uppercase tracking-wider">2nd Cycle</p>
          <p className="text-lg sm:text-2xl font-bold text-purple-600 mt-0.5 sm:mt-1">{stats.secondCyclePeriods}</p>
        </div>
        <div className="bg-white rounded-2xl border border-brand/20 bg-brand/5 p-3 sm:p-4 col-span-2 sm:col-span-1">
          <p className="text-[10px] sm:text-xs text-brand/60 font-medium uppercase tracking-wider">Potential Earnings</p>
          <p className="text-lg sm:text-2xl font-bold text-brand mt-0.5 sm:mt-1 truncate">{stats.totalPotentialEarnings.toLocaleString()} FRS</p>
        </div>
      </div>

      {/* View Content - Always Table Format */}
      {viewMode === 'today' && (
        <TodayView 
          weeklyData={weeklyData} 
          groupedByDay={groupedByDay}
          currentDay={weeklyData?.currentDay || new Date().toLocaleString('en-US', { weekday: 'long' })}
        />
      )}

      {viewMode === 'weekly' && (
        <WeeklyView 
          groupedByDay={groupedByDay} 
          onDayClick={(day) => { setSelectedDay(day); }}
          timetableData={timetableData}
        />
      )}

      {viewMode === 'daily' && (
        <DailyView 
          selectedDay={selectedDay}
          daySchedule={daySchedule}
          groupedByDay={groupedByDay}
          onDaySelect={(day) => {
            setSelectedDay(day);
            const dayEntries = groupedByDay[day] || [];
            setDaySchedule(dayEntries);
          }}
        />
      )}
    </div>
  );
}

// ============================================
// TODAY VIEW - Table Format on All Screens
// ============================================

function TodayView({ weeklyData, groupedByDay, currentDay }: { 
  weeklyData: WeeklyData | null; 
  groupedByDay: Record<string, TimetableEntry[]>;
  currentDay: string;
}) {
  const todaySchedule = weeklyData?.todaySchedule || groupedByDay[currentDay] || [];
  const totalEarnings = todaySchedule.reduce((sum, entry) => sum + entry.ratePerPeriod, 0);

  if (todaySchedule.length === 0) {
    return (
      <div className="text-center py-6 sm:py-8 text-black/40">
        <CalendarDays className="size-10 sm:size-12 mx-auto text-black/20 mb-2 sm:mb-3" />
        <p className="text-sm sm:text-base">No classes scheduled for today</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2">
          <Calendar className="size-4 sm:size-5 text-brand" />
          <span className="text-sm sm:text-base">Today's Schedule - {currentDay}</span>
        </h3>
        <span className="text-xs sm:text-sm text-black/60">{todaySchedule.length} periods</span>
      </div>

      {/* Table View - Responsive with horizontal scroll on mobile */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] sm:min-w-full">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Period</th>
                <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Time</th>
                <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Subject</th>
                <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Class</th>
                <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Cycle</th>
                <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Rate</th>
                <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Room</th>
              </tr>
            </thead>
            <tbody>
              {todaySchedule.map((entry, index) => (
                <tr key={entry.id} className="border-b border-stone-100 hover:bg-stone-50 transition">
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm font-medium">{entry.periodNumber || index + 1}</td>
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm">{entry.startTime} - {entry.endTime}</td>
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm font-medium">
                    <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap">
                      {entry.subjectCode && (
                        <span className="text-[8px] sm:text-[10px] bg-stone-100 px-1 sm:px-1.5 py-0.5 rounded font-mono">{entry.subjectCode}</span>
                      )}
                      <span>{entry.subjectName}</span>
                    </div>
                  </td>
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm">{entry.className}</td>
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2.5">
                    <span className={`badge ${entry.cycle === 'first' ? 'badge-blue' : 'badge-purple'} text-[8px] sm:text-xs px-1 sm:px-2 py-0.5 sm:py-1`}>
                      {entry.cycle === 'first' ? '1st' : '2nd'}
                    </span>
                  </td>
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm font-bold text-brand">{entry.ratePerPeriod} FRS</td>
                  <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm">{entry.room || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-3 sm:px-4 py-2 sm:py-3 border-t border-stone-200 text-xs sm:text-sm text-black/40 flex flex-wrap justify-between">
          <span>Total: {todaySchedule.length} periods</span>
          <span className="font-medium text-brand">Earnings: {totalEarnings.toLocaleString()} FRS</span>
        </div>
      </div>
    </div>
  );
}

// ============================================
// WEEKLY VIEW - Table Format on All Screens
// ============================================

function WeeklyView({ groupedByDay, onDayClick, timetableData }: { 
  groupedByDay: Record<string, TimetableEntry[]>;
  onDayClick: (day: string) => void;
  timetableData: TimetableData;
}) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const [selectedDay, setSelectedDay] = useState<string>('');

  const displayEntries = selectedDay 
    ? groupedByDay[selectedDay] || [] 
    : days.flatMap(day => groupedByDay[day] || []);

  const totalEarnings = displayEntries.reduce((sum, entry) => sum + entry.ratePerPeriod, 0);

  // Mobile Day Picker with horizontal scroll
  const DayPicker = () => (
    <div className="flex gap-1 overflow-x-auto pb-2 hide-scrollbar sm:hidden">
      <button
        onClick={() => setSelectedDay('')}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${!selectedDay ? 'bg-brand text-white' : 'bg-stone-100'}`}
      >
        All
      </button>
      {days.map(day => {
        const hasEntries = (groupedByDay[day] || []).length > 0;
        return (
          <button
            key={day}
            onClick={() => {
              setSelectedDay(day);
              onDayClick(day);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${selectedDay === day ? 'bg-brand text-white' : 'bg-stone-100'} ${!hasEntries ? 'opacity-40' : ''}`}
          >
            {day.substring(0, 3)}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2">
          <CalendarDays className="size-4 sm:size-5 text-brand" />
          <span className="text-sm sm:text-base">Weekly Schedule {selectedDay ? `- ${selectedDay}` : ''}</span>
        </h3>
        {/* Desktop Day Buttons */}
        <div className="hidden sm:flex gap-1.5">
          <button
            onClick={() => setSelectedDay('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${!selectedDay ? 'bg-brand text-white' : 'bg-stone-100 hover:bg-stone-200'}`}
          >
            All Days
          </button>
          {days.map(day => {
            const hasEntries = (groupedByDay[day] || []).length > 0;
            return (
              <button
                key={day}
                onClick={() => {
                  setSelectedDay(day);
                  onDayClick(day);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${selectedDay === day ? 'bg-brand text-white' : 'bg-stone-100 hover:bg-stone-200'} ${!hasEntries ? 'opacity-40' : ''}`}
              >
                {day.substring(0, 3)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Day Picker */}
      <DayPicker />

      {displayEntries.length === 0 ? (
        <div className="text-center py-6 sm:py-8 text-black/40">
          <CalendarDays className="size-10 sm:size-12 mx-auto text-black/20 mb-2 sm:mb-3" />
          <p className="text-sm sm:text-base">{selectedDay ? `No classes scheduled for ${selectedDay}` : 'No classes scheduled this week'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] sm:min-w-full">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Day</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Period</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Time</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Subject</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Class</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Cycle</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Rate</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Room</th>
                </tr>
              </thead>
              <tbody>
                {displayEntries.map((entry, index) => (
                  <tr key={entry.id} className="border-b border-stone-100 hover:bg-stone-50 transition">
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm font-medium">{entry.day}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm">{entry.periodNumber || index + 1}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm">{entry.startTime} - {entry.endTime}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm font-medium">
                      <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap">
                        {entry.subjectCode && (
                          <span className="text-[8px] sm:text-[10px] bg-stone-100 px-1 sm:px-1.5 py-0.5 rounded font-mono">{entry.subjectCode}</span>
                        )}
                        <span>{entry.subjectName}</span>
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm">{entry.className}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5">
                      <span className={`badge ${entry.cycle === 'first' ? 'badge-blue' : 'badge-purple'} text-[8px] sm:text-xs px-1 sm:px-2 py-0.5 sm:py-1`}>
                        {entry.cycle === 'first' ? '1st' : '2nd'}
                      </span>
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm font-bold text-brand">{entry.ratePerPeriod} FRS</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm">{entry.room || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 sm:px-4 py-2 sm:py-3 border-t border-stone-200 text-xs sm:text-sm text-black/40 flex flex-wrap justify-between">
            <span>Total: {displayEntries.length} periods</span>
            <span className="font-medium text-brand">Earnings: {totalEarnings.toLocaleString()} FRS</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// DAILY VIEW - Table Format on All Screens
// ============================================

function DailyView({ 
  selectedDay, 
  daySchedule, 
  groupedByDay,
  onDaySelect 
}: { 
  selectedDay: string;
  daySchedule: TimetableEntry[];
  groupedByDay: Record<string, TimetableEntry[]>;
  onDaySelect: (day: string) => void;
}) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const [currentDay, setCurrentDay] = useState(selectedDay || days[0]);

  const handleDaySelect = (day: string) => {
    setCurrentDay(day);
    onDaySelect(day);
  };

  const entries = daySchedule.length > 0 ? daySchedule : groupedByDay[currentDay] || [];
  const totalEarnings = entries.reduce((sum, entry) => sum + entry.ratePerPeriod, 0);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2">
          <Calendar className="size-4 sm:size-5 text-brand" />
          <span className="text-sm sm:text-base">Daily Schedule - {currentDay}</span>
        </h3>
        <div className="flex gap-1 overflow-x-auto w-full sm:w-auto pb-1 hide-scrollbar">
          {days.map(day => (
            <button
              key={day}
              onClick={() => handleDaySelect(day)}
              className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition ${currentDay === day ? 'bg-brand text-white' : 'bg-stone-100 hover:bg-stone-200'}`}
            >
              {day.substring(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-6 sm:py-12 text-black/40">
          <CalendarDays className="size-10 sm:size-12 mx-auto text-black/20 mb-2 sm:mb-3" />
          <p className="text-sm sm:text-base">No classes scheduled for {currentDay}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] sm:min-w-full">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Period</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Time</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Subject</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Class</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Cycle</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Rate</th>
                  <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-left text-[10px] sm:text-xs font-bold text-black/50 uppercase tracking-wider">Room</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <tr key={entry.id} className="border-b border-stone-100 hover:bg-stone-50 transition">
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm">{entry.periodNumber || index + 1}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm">{entry.startTime} - {entry.endTime}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm font-medium">
                      <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap">
                        {entry.subjectCode && (
                          <span className="text-[8px] sm:text-[10px] bg-stone-100 px-1 sm:px-1.5 py-0.5 rounded font-mono">{entry.subjectCode}</span>
                        )}
                        <span>{entry.subjectName}</span>
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm">{entry.className}</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5">
                      <span className={`badge ${entry.cycle === 'first' ? 'badge-blue' : 'badge-purple'} text-[8px] sm:text-xs px-1 sm:px-2 py-0.5 sm:py-1`}>
                        {entry.cycle === 'first' ? '1st' : '2nd'}
                      </span>
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm font-bold text-brand">{entry.ratePerPeriod} FRS</td>
                    <td className="px-2 sm:px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm">{entry.room || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-3 sm:px-4 py-2 sm:py-3 border-t border-stone-200 text-xs sm:text-sm text-black/40 flex flex-wrap justify-between">
            <span>Total: {entries.length} periods</span>
            <span className="font-medium text-brand">Earnings: {totalEarnings.toLocaleString()} FRS</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Add CSS for hiding scrollbar on mobile
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  @media (max-width: 640px) {
    .badge {
      font-size: 0.6rem !important;
      padding: 0.1rem 0.4rem !important;
    }
    table {
      font-size: 0.7rem !important;
    }
    th, td {
      padding: 0.3rem 0.5rem !important;
    }
  }
  @media (min-width: 641px) and (max-width: 768px) {
    table {
      font-size: 0.8rem !important;
    }
    th, td {
      padding: 0.4rem 0.6rem !important;
    }
  }
`;
document.head.appendChild(styleSheet);