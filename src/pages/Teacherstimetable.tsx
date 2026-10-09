import { useState, useEffect, useCallback, useRef } from "react";
import {
  Calendar, Clock, Users, Search, X, CalendarDays,
  User, BookOpen, ChevronLeft, ChevronRight,
  AlertCircle, Check, Home, LogOut, Menu,
  Sun, Moon, Settings, Bell, Award, DollarSign, Download, Printer,
  ChevronDown, ChevronUp, FileDown, LayoutGrid, RefreshCw
} from "lucide-react";
import { CompactPageLoader } from "@/components/CompactPageLoader";
import { getStoredSchoolSection } from "@/lib/schoolSystem";
import { toast } from "sonner";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "https://manfess-back.onrender.com/api";

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
// SCHOOL SCHEDULE (from the Auto-Generate wizard, Step 2)
// ============================================

interface SchoolSettings {
  _id?: string;
  schoolStartTime: string;
  schoolEndTime: string;
  breakStart: string;
  breakEnd: string;
  periodDurationMinutes: number;
  schoolDays: string[];
  periodsPerDay: number;
}

const ACADEMIC_YEAR = "2026-2027";

const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  schoolStartTime: "08:00",
  schoolEndTime: "14:00",
  breakStart: "10:15",
  breakEnd: "10:30",
  periodDurationMinutes: 45,
  schoolDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  periodsPerDay: 6,
};

// Master day order (used to keep schoolDays in Monday → Saturday order)
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function orderSchoolDays(days: string[]): string[] {
  const unique = Array.from(new Set(days.filter(Boolean)));
  return unique.sort((a, b) => {
    const ia = DAYS.indexOf(a);
    const ib = DAYS.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

// Convert a "HH:mm" string to minutes since midnight (mirrors backend).
function timeStringToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Convert minutes since midnight back to a "HH:mm" string (mirrors backend).
function minutesToTimeString(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface DaySlot {
  type: "period" | "break";
  label: string;
  start: string;
  end: string;
  isBreak: boolean;
}

/**
 * Build the day's display slots from the saved school schedule using the
 * EXACT same math as the backend generator (routes/timetable.js buildPeriodSlots):
 * periods stride `periodDurationMinutes` from `schoolStartTime`, capped by
 * `periodsPerDay` and `schoolEndTime`.
 */
function buildDaySlots(settings: SchoolSettings): DaySlot[] {
  const slots: DaySlot[] = [];
  const startMin = timeStringToMinutes(settings.schoolStartTime);
  const endMin = timeStringToMinutes(settings.schoolEndTime);
  const duration = settings.periodDurationMinutes || 45;
  const maxPeriods = settings.periodsPerDay || 20;

  let cursor = startMin;
  let periodNumber = 1;

  while (cursor + duration <= endMin && periodNumber <= maxPeriods) {
    const slotStart = cursor;
    const slotEnd = cursor + duration;

    slots.push({
      type: 'period',
      label: String(periodNumber),
      start: minutesToTimeString(slotStart),
      end: minutesToTimeString(slotEnd),
      isBreak: false,
    });
    periodNumber += 1;

    cursor = slotEnd;
  }

  return slots;
}

// ============================================
// BUILD MATRIX TIMETABLE WITH TIME RANGES
// ============================================

interface MatrixCell {
  label: string;
  isBreak: boolean;
  startTime: string;
  endTime: string;
  entries: TimetableEntry[];
}

interface MatrixTimetable {
  matrix: Record<string, Record<string, MatrixCell>>;
  days: string[];
  timeSlots: DaySlot[];
}

function buildMatrixTimetable(entries: TimetableEntry[], settings: SchoolSettings): MatrixTimetable {
  const timeSlots = buildDaySlots(settings);
  const days = orderSchoolDays(settings.schoolDays);
  const matrix: Record<string, Record<string, MatrixCell>> = {};
  const dynamicSlots: Record<string, DaySlot[]> = {};

  days.forEach(day => {
    matrix[day] = {};
    dynamicSlots[day] = [];
    timeSlots.forEach(slot => {
      const key = `${slot.start}|${slot.end}`;
      matrix[day][key] = {
        label: slot.label,
        isBreak: slot.isBreak,
        startTime: slot.start,
        endTime: slot.end,
        entries: []
      };
    });
  });

  const periodSlots = timeSlots.filter(slot => !slot.isBreak);

  // Map entries to time slots (layered matching so manually-created entries
  // with slightly different times still land in the right period).
  entries.forEach(entry => {
    if (!matrix[entry.day]) return;

    // 1. Exact start-time match (what the auto-generator produces).
    let matchedSlot = periodSlots.find(slot => slot.start === entry.startTime);

    // 2. Entry fully contained within a period.
    if (!matchedSlot) {
      matchedSlot = periodSlots.find(slot =>
        entry.startTime >= slot.start && entry.endTime <= slot.end
      );
    }

    // 3. Same starting hour (handles duration mismatches).
    if (!matchedSlot) {
      const entryHour = (entry.startTime || '').split(':')[0];
      matchedSlot = periodSlots.find(slot => slot.start.split(':')[0] === entryHour);
    }

    // 4. Check if there's already a dynamic slot for this entry's time
    if (!matchedSlot) {
      const existingDynamicSlot = dynamicSlots[entry.day]?.find(slot => slot.start === entry.startTime);
      if (existingDynamicSlot) {
        matchedSlot = existingDynamicSlot;
      }
    }

    // 5. If still no match, create a new dynamic slot for this entry's time
    if (!matchedSlot) {
      const newSlot: DaySlot = {
        type: 'period',
        label: String(periodSlots.length + dynamicSlots[entry.day].length + 1),
        start: entry.startTime,
        end: entry.endTime,
        isBreak: false,
      };
      dynamicSlots[entry.day].push(newSlot);
      matchedSlot = newSlot;

      // Add the new slot to the matrix
      const key = `${entry.startTime}|${entry.endTime}`;
      matrix[entry.day][key] = {
        label: matchedSlot.label,
        isBreak: false,
        startTime: entry.startTime,
        endTime: entry.endTime,
        entries: []
      };

      // Add the new slot to timeSlots for proper row ordering
      timeSlots.push(matchedSlot);
    }

    if (matchedSlot) {
      const key = `${matchedSlot.start}|${matchedSlot.end}`;
      if (matrix[entry.day][key]) {
        matrix[entry.day][key].entries.push(entry);
      }
    }
  });

  // Sort time slots by start time for proper row ordering
  timeSlots.sort((a, b) => {
    if (a.isBreak && !b.isBreak) return 1;
    if (!a.isBreak && b.isBreak) return -1;
    const aMin = timeStringToMinutes(a.start);
    const bMin = timeStringToMinutes(b.start);
    return aMin - bMin;
  });

  return { matrix, days, timeSlots };
}

// A-Level classes (Lower/Upper Sixth, "U6", "L6", "A Level", etc.) are printed
// simply as "Alevel" on the paper timetable instead of the full class name.
const A_LEVEL_PATTERN = /\b(upper sixth|lower sixth|u\.?6|l\.?6|a[\s-]?level|sixth form)\b/i;

function toPrintClassLabel(className: string): string {
  return A_LEVEL_PATTERN.test(className || '') ? 'Alevel' : className;
}

// Strip the department suffix: "Olevel 4 (Arts)" -> "Olevel 4",
// "Olevel 4 Arts" -> "Olevel 4", "Alevel (Science)" -> "Alevel".
// Used to collapse joint classes. Case/spacing tolerant so entries stored
// with slightly different formats still collapse to one label.
function baseClassLabel(className: string): string {
  const raw = (className || '').trim();
  if (/a\s*-?\s*level/i.test(raw)) return 'Alevel';
  const olevel = raw.match(/o\s*-?\s*level\s*(\d+)/i);
  if (olevel) return `Olevel ${olevel[1]}`;
  const beginners = raw.match(/beginers?\s*(\d+)?/i);
  if (beginners) return beginners[1] ? `Beginers${beginners[1]}` : 'Beginers';
  const collapsed = toPrintClassLabel(raw);
  return collapsed.replace(/\s*\([^)]*\)\s*$/, '').trim() || collapsed;
}

interface MergedCellGroup {
  key: string;
  subject: string;
  teacher: string;
  classText: string;
  room: string;
}

// A general subject taught jointly to several departments of the same level
// (e.g. Commerce to Olevel 4 Arts + Commercial + Science at the same time)
// is stored as one entry per class. Merge those into a single display row so
// the timetable shows the subject once with just "Olevel 4" instead of
// repeating every department. Entries with different subjects (or different
// teachers) in the same slot are kept separate.
function mergeCellGroups(cellEntries: TimetableEntry[]): MergedCellGroup[] {
  const map = new Map<string, TimetableEntry[]>();
  cellEntries.forEach((e) => {
    // Normalise so "Commerce" vs "commerce " (or teacher name casing) still merges.
    const key = `${(e.subjectName || '').trim().toLowerCase()}||${(e.teacherName || '').trim().toLowerCase()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  });
  return Array.from(map.entries()).map(([key, list]) => {
    const names = Array.from(new Set(list.map((e) => e.className).filter(Boolean)));
    const bases = Array.from(new Set(names.map(baseClassLabel)));
    const classText = names.length > 1 && bases.length === 1
      ? bases[0]
      : names.join(', ');
    const rooms = Array.from(new Set(list.map((e) => e.room).filter(Boolean)));
    return {
      key,
      subject: list[0].subjectName,
      teacher: list[0].teacherName,
      classText: classText || '-',
      room: rooms.join(', '),
    };
  });
}

// ============================================
// TEACHER TIMETABLE VIEW
// ============================================

export function TeacherTimetableView() {
  const [loading, setLoading] = useState(true);
  const [timetableData, setTimetableData] = useState<TimetableData | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [daySchedule, setDaySchedule] = useState<TimetableEntry[]>([]);
  const [viewMode, setViewMode] = useState<"weekly" | "daily" | "today" | "matrix">("weekly");
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [pdfOptions, setPdfOptions] = useState({
    showTeacherNames: true,
    showRoomNumbers: true,
    includeHeader: true,
  });
  const [showPdfOptions, setShowPdfOptions] = useState(false);
  const hasFetched = useRef(false);
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>(DEFAULT_SCHOOL_SETTINGS);
  const [availabilityForm, setAvailabilityForm] = useState<{ isPermanent: boolean; availableDays: string[] }>({
    isPermanent: true,
    availableDays: [...DAYS],
  });
  const [availabilitySaved, setAvailabilitySaved] = useState(false);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);

  // Days from the Auto-Generate wizard (Step 2), kept in Monday → Saturday order.
  const schoolDays = orderSchoolDays(schoolSettings.schoolDays);

  // Get logged in user from localStorage (stable identity across renders)
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

  const [user] = useState(() => getLoggedInUser());

  const hydrateTeacherAvailability = useCallback(async () => {
    if (!user) return;

    const teacherId = user.id || user._id;
    if (!teacherId) return;

    try {
      const res = await axios.get(`${API_BASE}/users/${teacherId}`);
      const loadedUser = res.data?.data || {};
      const hasSavedConfig =
        !!loadedUser.isPermanent ||
        (Array.isArray(loadedUser.availableDays) && loadedUser.availableDays.length > 0);
      const availableDays: string[] = Array.isArray(loadedUser.availableDays)
        ? loadedUser.availableDays.filter((day: unknown): day is string => typeof day === 'string')
        : [...DAYS];

      const nextForm = {
        isPermanent: !!loadedUser.isPermanent,
        availableDays: [...new Set(availableDays.filter(Boolean))],
      };

      setAvailabilityForm(nextForm);
      setAvailabilitySaved(hasSavedConfig);
    } catch (error) {
      console.warn('Could not load teacher availability:', error);
      setAvailabilityForm({ isPermanent: true, availableDays: [...DAYS] });
      setAvailabilitySaved(false);
    }
  }, [user]);

  const handleToggleDay = (day: string) => {
    if (availabilitySaved) return;
    setAvailabilityForm((prev: { isPermanent: boolean; availableDays: string[] }): { isPermanent: boolean; availableDays: string[] } => {
      const nextDays: string[] = prev.availableDays.includes(day)
        ? prev.availableDays.filter((item) => item !== day)
        : [...prev.availableDays, day];
      return { ...prev, availableDays: nextDays };
    });
  };

  const handleAvailabilitySubmit = async () => {
    if (!user) {
      toast.error('Please log in to submit your availability');
      return;
    }

    const teacherId = user.id || user._id;
    if (!teacherId) {
      toast.error('Teacher ID not found');
      return;
    }

    if (!availabilityForm.isPermanent && availabilityForm.availableDays.length === 0) {
      toast.error('Please choose at least one available day');
      return;
    }

    try {
      setIsSavingAvailability(true);
      const payload = {
        isPermanent: availabilityForm.isPermanent,
        availableDays: availabilityForm.isPermanent ? [...DAYS] : [...availabilityForm.availableDays],
      };

      await axios.patch(`${API_BASE}/users/${teacherId}`, payload);
      setAvailabilitySaved(true);
      toast.success('Your availability has been saved. Only the admin can edit it from the timetable dashboard.');
    } catch (error: any) {
      console.error('Failed to save availability:', error);
      toast.error(error?.response?.data?.message || 'Failed to save your availability');
    } finally {
      setIsSavingAvailability(false);
    }
  };

  // ============================================
  // GENERATE MOCK DATA
  // ============================================

  const generateMockData = (userData?: any, settings: SchoolSettings = schoolSettings) => {
    const mockClasses = CLASSES;
    const mockSubjects = SUBJECTS;
    const mockTeacher: Teacher = {
      id: 't1',
      name: userData?.name || 'John Doe',
      email: userData?.email || 'john@school.com',
      username: userData?.username || 'john_doe',
      qualification: 'BSc Mathematics',
      role: 'teacher'
    };

    // Demo data uses the same schedule configured in the Auto-Generate wizard.
    const mockDays = orderSchoolDays(settings.schoolDays);
    const periodSlots = buildDaySlots(settings).filter(slot => !slot.isBreak);

    const mockEntries: TimetableEntry[] = [];

    mockDays.forEach((day, di) => {
      periodSlots.forEach((timeSlot, pi) => {
        if (Math.random() > 0.35) {
          const cycle = pi % 2 === 0 ? 'first' : 'second';
          const classIdx = (di + pi * 2) % mockClasses.length;
          const subjectIdx = (di + pi * 3) % mockSubjects.length;

          const cls = mockClasses[classIdx];
          const subj = mockSubjects[subjectIdx];

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
            startTime: timeSlot.start,
            endTime: timeSlot.end,
            periodNumber: pi + 1,
            cycle: cycle as 'first' | 'second',
            ratePerPeriod: cycle === 'first' ? 500 : 700,
            room: `Room ${Math.floor(Math.random() * 10) + 1}`,
            academicYear: ACADEMIC_YEAR,
            isActive: true
          });
        }
      });
    });

    const groupedByDay: Record<string, TimetableEntry[]> = {};
    mockDays.forEach(day => {
      groupedByDay[day] = mockEntries
        .filter(e => e.day === day)
        .sort((a, b) => parseInt(a.startTime) - parseInt(b.startTime));
    });

    const stats: TeacherStats = {
      totalPeriods: mockEntries.length,
      firstCyclePeriods: mockEntries.filter(e => e.cycle === 'first').length,
      secondCyclePeriods: mockEntries.filter(e => e.cycle === 'second').length,
      totalPotentialEarnings: mockEntries.reduce((sum, e) => sum + e.ratePerPeriod, 0),
      days: mockDays
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

  const fetchTeacherTimetable = useCallback(async (settingsOverride?: SchoolSettings) => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    // Use the settings snapshot captured by the caller so the very first fetch
    // (which runs before React state updates land) still sees the DB schedule.
    const activeSettings = settingsOverride || schoolSettings;

    if (!user) {
      const mockData = generateMockData(undefined, activeSettings);
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

      // The backend exposes the teacher's timetable at
      // GET /timetable/teacher/:teacherId — it returns a FLAT array of
      // populated entries (classId -> {className, department},
      // subjectId -> {name, code}), grouped client-side below.
      const response = await axios.get(`${API_BASE}/timetable/teacher/${teacherId}`, {
        params: { academicYear: ACADEMIC_YEAR }
      });

      if (response.data.success) {
        const rawEntries: any[] = Array.isArray(response.data.data) ? response.data.data : [];

        const mapEntry = (entry: any): TimetableEntry => {
          const className = entry.classId?.className || entry.className || 'Unknown Class';
          const department = entry.classId?.department || '';
          const fullClassName = department ? `${className} (${department})` : className;
          const subjectName = entry.subjectId?.name || entry.subjectName || 'Unknown Subject';
          const subjectCode = entry.subjectId?.code || entry.subjectCode || '';

          return {
            ...entry,
            id: entry._id || entry.id,
            className: fullClassName,
            subjectName: subjectName,
            subjectCode: subjectCode,
            teacherName: entry.teacherId?.name || entry.teacherName || (user as any)?.name || 'Teacher',
            classData: entry.classId,
            subjectData: entry.subjectId
          };
        };

        const mappedTimetable = rawEntries.map(mapEntry);

        // Group by day locally (backend returns a flat array), keeping every
        // configured school day as a key so Weekly/Daily views render correctly.
        const orderedDays = orderSchoolDays(activeSettings.schoolDays);
        const groupedByDay: Record<string, TimetableEntry[]> = {};
        orderedDays.forEach(day => { groupedByDay[day] = []; });
        mappedTimetable.forEach((entry) => {
          if (!groupedByDay[entry.day]) groupedByDay[entry.day] = [];
          groupedByDay[entry.day].push(entry);
        });
        Object.values(groupedByDay).forEach(list =>
          list.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
        );

        const stats: TeacherStats = {
          totalPeriods: mappedTimetable.length,
          firstCyclePeriods: mappedTimetable.filter(e => e.cycle === 'first').length,
          secondCyclePeriods: mappedTimetable.filter(e => e.cycle === 'second').length,
          totalPotentialEarnings: mappedTimetable.reduce((sum, e) => sum + (e.ratePerPeriod || 0), 0),
          days: orderedDays
        };

        const mappedData: TimetableData = {
          teacher: {
            id: String(teacherId),
            name: (user as any)?.name || 'Teacher',
            email: (user as any)?.email || '',
            username: (user as any)?.username || '',
            qualification: (user as any)?.qualification || 'Teacher',
            role: (user as any)?.role || 'teacher'
          },
          stats: stats,
          timetable: mappedTimetable,
          groupedByDay: groupedByDay,
          totalEntries: mappedTimetable.length
        };

        setTimetableData(mappedData);
        setSelectedDay('');
        setDaySchedule([]);
        if (mappedTimetable.length > 0) {
          toast.success(`Timetable loaded — ${mappedTimetable.length} periods`);
        } else {
          toast.info(`No periods assigned to you yet for ${ACADEMIC_YEAR}`);
        }
      } else {
        throw new Error(response.data.message || 'Failed to load timetable');
      }
    } catch (error: any) {
      console.error('Error fetching timetable:', error);
      setError(error.message || 'Failed to load timetable');

      // If teacher not found (404), the localStorage user ID is stale
      if (error.response?.status === 404) {
        toast.error('Teacher not found. Please log in again.', {
          action: {
            label: 'Log out',
            onClick: () => {
              localStorage.clear();
              window.location.href = '/login';
            }
          }
        });
      } else {
        toast.error('Failed to load timetable. Using demo data...');
      }

      const mockData = generateMockData(user, activeSettings);
      setTimetableData(mockData);
    } finally {
      setLoading(false);
    }
  }, [user, schoolSettings]);

  // ============================================
  // EXPORT TO PDF - Using window.print for simplicity
  // ============================================

  const exportMatrixPDF = useCallback(() => {
    if (!timetableData) {
      toast.error('No timetable data to export');
      return;
    }

    setIsExporting(true);

    try {
      const { matrix, days, timeSlots } = buildMatrixTimetable(timetableData.timetable, schoolSettings);
      // MANFESS has no break period in its schedule — only real periods are rendered as rows.
      const periodSlots = timeSlots.filter(slot => !slot.isBreak);
      const { teacher, stats } = timetableData;

      // Create a new window for printing
      const printWindow = window.open('', '_blank', 'width=1200,height=800');
      if (!printWindow) {
        toast.error('Please allow popups for this site');
        setIsExporting(false);
        return;
      }

      const teachingDaysLabel = days.length ? `${days[0]} – ${days[days.length - 1]}` : '';

      let htmlContent = `
<!DOCTYPE html>
<html>
<head>
<title>Teacher Timetable - ${teacher.name}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; padding: 24px; background: white; color: #000; }
  .sheet { max-width: 1100px; margin: 0 auto; }
  .school-header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 8px; margin-bottom: 0; }
  .school-header h1 { font-size: 22px; letter-spacing: 2px; margin: 0; font-weight: 800; }
  .school-header p { font-size: 11px; margin: 3px 0 0 0; }
  .title-bar { text-align: center; border: 2px solid #000; border-top: none; padding: 6px; font-weight: 700; font-size: 14px; letter-spacing: 1px; }
  .info-row { display: flex; flex-wrap: wrap; border-left: 2px solid #000; border-right: 2px solid #000; padding: 5px 12px; font-size: 12px; gap: 24px; }
  .info-row.last { border-bottom: 2px solid #000; }
  .info-row .fill { border-bottom: 1px solid #000; padding: 0 6px; display: inline-block; min-width: 90px; }
  table.grid { width: 100%; border-collapse: collapse; border: 2px solid #000; font-size: 11px; }
  table.grid th, table.grid td { border: 1px solid #000; padding: 5px 6px; text-align: center; }
  table.grid thead th { background: #f2f2f2; font-weight: 700; font-size: 11px; }
  .period-col { width: 92px; font-weight: 700; background: #fafafa; white-space: nowrap; }
  .empty-cell { color: #999; }
  .signatures { display: flex; justify-content: space-between; margin-top: 55px; padding: 0 30px; font-size: 12px; }
  .signature-line { display: inline-block; width: 220px; border-top: 1px solid #000; margin-top: 45px; text-align: center; padding-top: 4px; font-weight: 600; }
  .footer-note { text-align: right; font-size: 9px; color: #666; margin-top: 12px; }
  @media print {
    body { padding: 0; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
<div class="sheet">
`;

      if (pdfOptions.includeHeader) {
        htmlContent += `
<div class="school-header">
  <h1>BCHS DOUALA</h1>
  <p>MOTTO: EDUCATION IS LIGHT</p>
  <p>TEL: +237 677517606 &nbsp;&nbsp;|&nbsp;&nbsp;
   AUT. N°: TECH - 035/24/MINESEC/SG/DESTP/SDSPETP/SSEPTP/07/FEB/2024
   <br>
  AUT.Nº:  GEN- 430/23/MINESEC/SG/DESG/SDSGEPESG/SSGEPES/27/SEPT/2023</p>
</div>
`;
      }

      htmlContent += `
<div class="title-bar">TEACHER'S TIME TABLE &nbsp; ACADEMIC YEAR: ${ACADEMIC_YEAR}</div>
<div class="info-row">
  <span>TEACHER'S NAME: <span class="fill">${teacher.name}</span></span>
  <span>HIGHEST QUALIFICATION: <span class="fill">${teacher.qualification || '&nbsp;'}</span></span>
</div>
<div class="info-row">
  <span>FULL-TIME OR PART-TIME: <span class="fill">&nbsp;</span></span>
  <span>N° OF PERIODS: <span class="fill">${stats.totalPeriods}</span></span>
  <span>SECTION: <span class="fill">&nbsp;</span></span>
  <span>SPECIALTY: <span class="fill">&nbsp;</span></span>
  <span>TEL: <span class="fill">&nbsp;</span></span>
</div>
<div class="info-row last">
  <span>TEACHING DAYS IN SCHOOL: <span class="fill">${teachingDaysLabel}</span></span>
</div>

<table class="grid">
  <thead>
    <tr>
      <th class="period-col" rowspan="2">Periods</th>
      ${days.map(day => `<th colspan="2">${day}</th>`).join('')}
    </tr>
    <tr>
      ${days.map(() => `<th>Subject</th><th>Class</th>`).join('')}
    </tr>
  </thead>
  <tbody>
`;

      periodSlots.forEach(slot => {
        const key = `${slot.start}|${slot.end}`;
        htmlContent += `
    <tr>
      <td class="period-col">${slot.start}-${slot.end}</td>
`;
        days.forEach(day => {
          const cell = matrix[day]?.[key];
          const cellEntries = cell?.entries || [];

          // A general subject taught jointly to several departments of the same
          // level (e.g. Commerce to Olevel 4 Arts + Commercial + Science at the
          // same time) is stored as one entry per class. Merge those so the
          // subject prints once with just "Olevel 4" instead of repeating.
          const cellGroups = mergeCellGroups(cellEntries);

          const subjectText = cellGroups.length
            ? cellGroups.map((g) => g.subject).join('<br/>')
            : '<span class="empty-cell">-</span>';
          const classText = cellGroups.length
            ? cellGroups.map((g) => g.classText).join('<br/>')
            : '<span class="empty-cell">-</span>';

          htmlContent += `      <td>${subjectText}</td><td>${classText}</td>\n`;
        });
        htmlContent += `    </tr>\n`;
      });

      htmlContent += `
  </tbody>
</table>

<div class="signatures">
  <div class="signature-line">VICE PRINCIPAL</div>
  <div class="signature-line">PRINCIPAL</div>
</div>
<div class="footer-note">Generated: ${new Date().toLocaleString()}</div>
</div>

<script>
  window.onload = function() {
    setTimeout(function() {
      window.print();
    }, 500);
  };
</script>
</body>
</html>
`;

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      toast.success('Timetable PDF opened for download. Please print to save as PDF.');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
      setShowPdfOptions(false);
    }
  }, [timetableData, pdfOptions, schoolSettings]);

  // ============================================
  // EFFECTS
  // ============================================

  // Load the school schedule saved by the admin Auto-Generate wizard FIRST,
  // then fetch the timetable — so the very first render (including the demo
  // fallback) already uses the periods/days stored in the database instead
  // of hardcoded defaults.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let active = DEFAULT_SCHOOL_SETTINGS;
      try {
        const res = await axios.get(`${API_BASE}/settings?academicYear=${ACADEMIC_YEAR}`);
        if (!cancelled && res.data?.success && res.data?.data) {
          const s = res.data.data;
          active = {
            _id: s._id,
            schoolStartTime: s.schoolStartTime || DEFAULT_SCHOOL_SETTINGS.schoolStartTime,
            schoolEndTime: s.schoolEndTime || DEFAULT_SCHOOL_SETTINGS.schoolEndTime,
            breakStart: s.breakStart || DEFAULT_SCHOOL_SETTINGS.breakStart,
            breakEnd: s.breakEnd || DEFAULT_SCHOOL_SETTINGS.breakEnd,
            periodDurationMinutes: s.periodDurationMinutes || DEFAULT_SCHOOL_SETTINGS.periodDurationMinutes,
            schoolDays: (s.schoolDays && s.schoolDays.length) ? s.schoolDays : DEFAULT_SCHOOL_SETTINGS.schoolDays,
            periodsPerDay: s.periodsPerDay || DEFAULT_SCHOOL_SETTINGS.periodsPerDay,
          };
          setSchoolSettings(active);
        }
      } catch {
        // No saved settings yet — keep defaults (same as the backend generator's assumption).
      }
      if (!cancelled) {
        hydrateTeacherAvailability();
        fetchTeacherTimetable(active);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchTeacherTimetable, hydrateTeacherAvailability]);

  // ============================================
  // RENDER FUNCTIONS
  // ============================================

  if (loading) {
    return <CompactPageLoader label="Loading your timetable..." />;
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

      {/* Teacher Profile Header */}
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
                onClick={() => setViewMode('today')}
                className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition ${viewMode === 'today' ? 'bg-brand text-white' : 'bg-stone-100 hover:bg-stone-200'}`}
              >
                Today
              </button>
              <button
                onClick={() => setViewMode('weekly')}
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
              <button
                onClick={() => setViewMode('matrix')}
                className={`flex-1 sm:flex-none px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition ${viewMode === 'matrix' ? 'bg-brand text-white' : 'bg-stone-100 hover:bg-stone-200'}`}
              >
                <LayoutGrid className="size-3 sm:size-4 inline" />
              </button>
            </div>

            {/* Download My Timetable Button */}
            <div className="relative">
              <button
                onClick={exportMatrixPDF}
                disabled={isExporting}
                className="flex-1 sm:flex-none px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold bg-brand text-white hover:bg-brand/90 transition flex items-center justify-center gap-2 shadow-lg shadow-brand/30 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? (
                  <span className="animate-spin"><RefreshCw className="size-4 sm:size-5" /></span>
                ) : (
                  <Download className="size-4 sm:size-5" />
                )}
                <span className="text-xs sm:text-sm font-semibold">Download My Timetable</span>
              </button>

              <button
                onClick={() => setShowPdfOptions(!showPdfOptions)}
                className="ml-0.5 sm:ml-1 p-1.5 sm:p-2 rounded-lg bg-brand/80 text-white hover:bg-brand transition"
              >
                <ChevronDown className="size-3 sm:size-4" />
              </button>

              {showPdfOptions && (
                <div className="absolute right-0 mt-1 w-64 bg-white rounded-xl border border-stone-200 shadow-lg z-20 p-4">
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-black/50 uppercase tracking-wider">PDF Options</p>

                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pdfOptions.showTeacherNames}
                        onChange={(e) => setPdfOptions(prev => ({ ...prev, showTeacherNames: e.target.checked }))}
                        className="rounded border-stone-300 text-brand focus:ring-brand"
                      />
                      Show Teacher Names
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pdfOptions.showRoomNumbers}
                        onChange={(e) => setPdfOptions(prev => ({ ...prev, showRoomNumbers: e.target.checked }))}
                        className="rounded border-stone-300 text-brand focus:ring-brand"
                      />
                      Show Room Numbers
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pdfOptions.includeHeader}
                        onChange={(e) => setPdfOptions(prev => ({ ...prev, includeHeader: e.target.checked }))}
                        className="rounded border-stone-300 text-brand focus:ring-brand"
                      />
                      Include School Header
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Teacher Details */}
        <div className="flex flex-wrap gap-2 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-stone-100 text-xs sm:text-sm text-black/60">
          <span className="flex items-center gap-1"><User className="size-3 sm:size-4" /> {teacher.username || teacher.email}</span>
          <span className="flex items-center gap-1"><BookOpen className="size-3 sm:size-4" /> {stats.totalPeriods} periods</span>
          <span className="flex items-center gap-1 text-brand"><DollarSign className="size-3 sm:size-4" /> {stats.totalPotentialEarnings.toLocaleString()} FRS</span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-black/50">Availability submission</p>
            <h3 className="mt-1 text-base sm:text-lg font-semibold text-stone-900">Your teaching availability</h3>
          </div>
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] sm:text-xs font-semibold ${availabilitySaved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {availabilitySaved ? 'Submitted' : 'Not submitted'}
          </span>
        </div>

        {!availabilitySaved ? (
          <div className="mt-4 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={availabilityForm.isPermanent}
                onChange={(e) => setAvailabilityForm((prev) => ({ ...prev, isPermanent: e.target.checked, availableDays: e.target.checked ? [...DAYS] : prev.availableDays.length ? prev.availableDays : [...DAYS].slice(0, 5) }))}
                className="h-4 w-4 rounded border-stone-300 text-brand focus:ring-brand"
              />
              <span className="text-sm font-medium text-stone-700">Permanent — available all days</span>
            </label>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-black/45">Available days</p>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => {
                  const isSelected = availabilityForm.isPermanent || availabilityForm.availableDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => !availabilityForm.isPermanent && handleToggleDay(day)}
                      disabled={availabilityForm.isPermanent}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${isSelected ? 'bg-brand text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'} ${availabilityForm.isPermanent ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                    >
                      {day.substring(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAvailabilitySubmit}
                disabled={isSavingAvailability}
                className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSavingAvailability ? 'Saving...' : 'Submit availability'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <p className="font-semibold">Your availability has already been submitted.</p>
            <p className="mt-1 text-emerald-700">
              {availabilityForm.isPermanent
                ? 'You are available all days.'
                : `Available days: ${availabilityForm.availableDays.join(', ') || 'none'}`}
            </p>
            <p className="mt-2 text-xs text-emerald-700">
              Only the admin can edit this from the timetable dashboard modal.
            </p>
          </div>
        )}
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

      {/* View Content */}
      {viewMode === 'today' && (
        <TodayView
          groupedByDay={groupedByDay}
          currentDay={new Date().toLocaleString('en-US', { weekday: 'long' })}
        />
      )}

      {viewMode === 'weekly' && (
        <WeeklyView
          groupedByDay={groupedByDay}
          onDayClick={(day) => { setSelectedDay(day); }}
          timetableData={timetableData}
          days={schoolDays}
        />
      )}

      {viewMode === 'daily' && (
        <DailyView
          selectedDay={selectedDay}
          daySchedule={daySchedule}
          groupedByDay={groupedByDay}
          days={schoolDays}
          onDaySelect={(day) => {
            setSelectedDay(day);
            const dayEntries = groupedByDay[day] || [];
            setDaySchedule(dayEntries);
          }}
        />
      )}

      {viewMode === 'matrix' && (
        <MatrixView
          entries={timetableData.timetable}
          teacherName={teacher.name}
          settings={schoolSettings}
        />
      )}
    </div>
  );
}

// ============================================
// TODAY VIEW
// ============================================

function TodayView({ groupedByDay, currentDay }: {
  groupedByDay: Record<string, TimetableEntry[]>;
  currentDay: string;
}) {
  const todaySchedule = groupedByDay[currentDay] || [];
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
// WEEKLY VIEW
// ============================================

function WeeklyView({ groupedByDay, onDayClick, timetableData, days }: {
  groupedByDay: Record<string, TimetableEntry[]>;
  onDayClick: (day: string) => void;
  timetableData: TimetableData;
  days: string[];
}) {
  const [selectedDay, setSelectedDay] = useState<string>('');

  const displayEntries = selectedDay
    ? groupedByDay[selectedDay] || []
    : days.flatMap(day => groupedByDay[day] || []);

  const totalEarnings = displayEntries.reduce((sum, entry) => sum + entry.ratePerPeriod, 0);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2">
          <CalendarDays className="size-4 sm:size-5 text-brand" />
          <span className="text-sm sm:text-base">Weekly Schedule {selectedDay ? `- ${selectedDay}` : ''}</span>
        </h3>
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
// DAILY VIEW
// ============================================

function DailyView({
  selectedDay,
  daySchedule,
  groupedByDay,
  days,
  onDaySelect
}: {
  selectedDay: string;
  daySchedule: TimetableEntry[];
  groupedByDay: Record<string, TimetableEntry[]>;
  days: string[];
  onDaySelect: (day: string) => void;
}) {
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

// ============================================
// MATRIX VIEW - Time x Days Grid
// ============================================

function MatrixView({ entries, teacherName, settings }: { entries: TimetableEntry[]; teacherName: string; settings: SchoolSettings }) {
  const { matrix, days, timeSlots } = buildMatrixTimetable(entries, settings);

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold text-base sm:text-lg flex items-center gap-2">
          <LayoutGrid className="size-4 sm:size-5 text-brand" />
          <span className="text-sm sm:text-base">Matrix View - {teacherName}</span>
        </h3>
        <span className="text-xs sm:text-sm text-black/60">{entries.length} periods</span>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] sm:min-w-full" style={{ borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr className="bg-black text-white">
                <th className="px-2 sm:px-3 py-2 sm:py-2.5 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-black" style={{ minWidth: '100px', width: '100px' }}>
                  TIME
                </th>
                {days.map((day) => (
                  <th key={day} className="px-2 sm:px-3 py-2 sm:py-2.5 text-center text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-black" style={{ width: `${Math.floor(100 / (days.length + 1))}%` }}>
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map((slot, idx) => {
                const isBreak = slot.isBreak;
                const rowBg = isBreak ? 'bg-amber-50' : (idx % 2 === 0 ? 'bg-stone-50/50' : '');
                const key = `${slot.start}|${slot.end}`;

                return (
                  <tr key={key} className={rowBg}>
                    <td className={`px-2 sm:px-3 py-2 sm:py-2.5 text-center text-xs sm:text-sm font-bold border border-black ${isBreak ? 'text-amber-600' : ''}`}>
                      <div>{slot.label}</div>
                      {!isBreak && <div className="text-[8px] sm:text-[10px] font-normal text-black/60">{slot.start} - {slot.end}</div>}
                    </td>
                    {days.map((day) => {
                      const cell = matrix[day]?.[key];

                      if (!cell || cell.entries.length === 0) {
                        return (
                          <td key={`${day}-${key}`} className="px-2 sm:px-3 py-2 sm:py-2.5 text-center border border-black" style={{ verticalAlign: 'top' }}>
                            <span className="text-black/40">-</span>
                          </td>
                        );
                      }

                      if (isBreak) {
                        return (
                          <td key={`${day}-${key}`} className="px-2 sm:px-3 py-2 sm:py-2.5 text-center border border-black bg-amber-100" style={{ verticalAlign: 'top' }}>
                            <span className="text-xs font-bold text-amber-700">BREAK</span>
                          </td>
                        );
                      }

                      return (
                        <td key={`${day}-${key}`} className="px-1 sm:px-2 py-1 sm:py-1.5 text-center border border-black" style={{ verticalAlign: 'top' }}>
                          {mergeCellGroups(cell.entries).map((g) => (
                            <div key={g.key} className="mb-1 last:mb-0 p-1 rounded bg-white/80 border border-stone-200">
                              <div className="font-semibold text-xs sm:text-sm">{g.subject}</div>
                              <div className="text-[8px] sm:text-[10px] text-black/60">{g.teacher}</div>
                              <div className="text-[8px] sm:text-[10px] text-black/40">{g.classText}</div>
                              {g.room && <div className="text-[8px] sm:text-[10px] text-black/40">Room: {g.room}</div>}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-3 sm:px-4 py-2 sm:py-3 border-t border-stone-200 text-xs sm:text-sm text-black/40 flex flex-wrap justify-between">
          <span>Total: {entries.length} periods</span>
          <span>Teacher: {teacherName}</span>
        </div>
      </div>
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