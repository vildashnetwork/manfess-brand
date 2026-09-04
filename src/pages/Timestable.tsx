import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import {
  Calendar, Clock, Users, Plus, Pencil, Trash2, Search, X,
  CalendarDays, User, BookOpen, Printer, Download,
  Filter, ChevronLeft, ChevronRight, Grid, List,
  AlertCircle, Check, Copy, RefreshCw, Upload, FileSpreadsheet,
  Eye, EyeOff, LayoutGrid, Table as TableIcon, User as UserIcon,
  School, ChevronDown, Settings
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import html2canvas from "html2canvas-pro";

const API_BASE = import.meta.env.VITE_API_URL ?? "https://manfess-back.onrender.com/api";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const CYCLE_RATES = { first: 500, second: 700 } as const;

// Default school schedule (mirrors the backend defaults). This is ONLY a
// fallback — the live schedule is always rebuilt from the SchoolSettings
// stored in the database, so time frames can change at any time.
const DEFAULT_SCHOOL_SETTINGS = {
  schoolStartTime: "08:00",
  schoolEndTime: "14:00",
  breakStart: "10:15",
  breakEnd: "10:30",
  periodDurationMinutes: 45,
  schoolDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  periodsPerDay: 6,
};

type ScheduleSlot = {
  type: "period";
  label: string;
  start: string;
  end: string;
};

const minutesToTimeString = (m: number): string => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

function formatEnglishTime(time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

// Build continuous teaching periods from the school settings in the database.
function buildScheduleFromSettings(settings: {
  schoolStartTime: string;
  schoolEndTime: string;
  breakStart: string;
  breakEnd: string;
  periodDurationMinutes: number;
  periodsPerDay: number;
}): ScheduleSlot[] {
  const start = timeStringToMinutes(settings.schoolStartTime);
  const end = timeStringToMinutes(settings.schoolEndTime);
  const dur = settings.periodDurationMinutes || 45;
  const maxPeriods = settings.periodsPerDay || 12;

  const slots: ScheduleSlot[] = [];
  let cursor = start;
  let periodNum = 1;

  while (cursor + dur <= end && periodNum <= maxPeriods) {
    const slotStart = cursor;
    const slotEnd = cursor + dur;
    slots.push({
      type: "period",
      label: String(periodNum),
      start: minutesToTimeString(slotStart),
      end: minutesToTimeString(slotEnd),
    });
    periodNum += 1;
    cursor = slotEnd;
  }
  return slots;
}

// Split the configured school days into two PDF page groups (e.g. Mon-Wed / Thu-Fri).
function splitDaysForPages(days: string[]): { days: string[]; label: string }[] {
  const short = (d: string) => d.slice(0, 3);
  const mid = Math.ceil(days.length / 2);
  const groups: { days: string[]; label: string }[] = [];
  const first = days.slice(0, mid);
  const second = days.slice(mid);
  if (first.length) groups.push({ days: first, label: first.map(short).join("-") });
  if (second.length) groups.push({ days: second, label: second.map(short).join("-") });
  return groups;
}

// ============================================
// TYPES
// ============================================

interface TimetableEntry {
  id: string;
  _id?: string;
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
  _id: string;
  name: string;
  fullName?: string;
  email: string;
  phone: string;
  qualification: string;
  subjectIds: string[];
  classIds: string[];
  isPermanent?: boolean;
  availableDays?: string[];
}

interface Class {
  _id: string;
  className: string;
  department?: string;
  cycle?: string;
  displayName?: string;
}

interface Subject {
  _id: string;
  name: string;
  code: string;
  department?: string;
  coefficient?: number;
  cycle?: string;
  periodsPerWeek?: number;
  periodsByClass?: Record<string, number>;
  // Returned by GET /api/subjects — used by the generator readiness check.
  classIds?: string[];
  teacherIds?: string[];
}

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

interface TimetableStats {
  totalPeriods: number;
  totalTeachers: number;
  totalClasses: number;
  totalPotential: number;
  firstCyclePeriods: number;
  secondCyclePeriods: number;
}

interface PdfGridCell {
  subjectName: string;
  teacherName: string;
  room?: string;
}

interface PdfGridRow {
  day: string;
  period: string;
  duration: string;
  isBreak: boolean;
  cells: Record<string, PdfGridCell | null>;
}

// ============================================
// TIME SANITIZATION HELPERS
// ============================================

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

// Matches real MongoDB ObjectIds — used to exclude mock/demo teacher IDs (e.g. "t1").
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

function isValidTimeString(t: any): t is string {
  return typeof t === "string" && TIME_RE.test(t);
}

function addOneHourCapped(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const endHour = Math.min(h + 1, 23);
  return `${String(endHour).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function sanitizeTimes(startTimeRaw: any, endTimeRaw: any): { startTime: string; endTime: string } {
  const startTime = isValidTimeString(startTimeRaw) ? startTimeRaw : "08:00";
  const endCandidate = isValidTimeString(endTimeRaw) ? endTimeRaw : null;
  const isPlaceholder = endCandidate === null || endCandidate === "00:00";

  const endTime = isPlaceholder ? addOneHourCapped(startTime) : endCandidate!;
  return { startTime, endTime };
}

function sanitizeEntry(entry: TimetableEntry): TimetableEntry {
  const { startTime, endTime } = sanitizeTimes(entry.startTime, entry.endTime);
  return { ...entry, startTime, endTime };
}

// ============================================
// MODULE-LEVEL HELPERS
// ============================================

function saveToLocalStorage(key: string, data: any) {
  try {
    localStorage.setItem(`timetable_${key}`, JSON.stringify(data));
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }
}

function loadFromLocalStorage(key: string) {
  try {
    const data = localStorage.getItem(`timetable_${key}`);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("Error loading from localStorage:", error);
    return null;
  }
}

function mapApiEntry(entry: any): TimetableEntry {
  const teacherObj = entry.teacherId || {};
  const classObj = entry.classId || {};
  const subjectObj = entry.subjectId || {};

  const { startTime, endTime } = sanitizeTimes(entry.startTime, entry.endTime);

  return {
    id: entry._id || entry.id || `temp_${Date.now()}`,
    _id: entry._id || entry.id,
    teacherId: teacherObj._id || entry.teacherId || "",
    teacherName: teacherObj.name || entry.teacherName || "Unknown",
    classId: classObj._id || entry.classId || "",
    className: classObj.className || entry.className || "Unknown",
    subjectId: subjectObj._id || entry.subjectId || "",
    subjectName: subjectObj.name || entry.subjectName || "Unknown",
    subjectCode: subjectObj.code || entry.subjectCode || "",
    day: entry.day || "",
    startTime,
    endTime,
    periodNumber: entry.periodNumber || 1,
    cycle: entry.cycle || "first",
    ratePerPeriod: entry.ratePerPeriod || CYCLE_RATES.first,
    room: entry.room || "",
    academicYear: entry.academicYear || "2026-2027",
    isActive: entry.isActive !== undefined ? entry.isActive : true,
  };
}

function mapForApi(entry: TimetableEntry) {
  const { startTime, endTime } = sanitizeTimes(entry.startTime, entry.endTime);
  return {
    teacherId: entry.teacherId,
    classId: entry.classId,
    subjectId: entry.subjectId,
    day: entry.day,
    startTime,
    endTime,
    periodNumber: entry.periodNumber || 1,
    cycle: entry.cycle || 'first',
    ratePerPeriod: entry.ratePerPeriod || CYCLE_RATES[entry.cycle || 'first'],
    room: entry.room || '',
    academicYear: entry.academicYear || '2026-2027',
    isActive: entry.isActive !== undefined ? entry.isActive : true,
  };
}

function mergeBulkApiResults(
  baseEntries: TimetableEntry[],
  submittedEntries: TimetableEntry[],
  apiEntries?: any[]
): TimetableEntry[] {
  if (!apiEntries) return [...baseEntries, ...submittedEntries];

  const merged = [...baseEntries];
  submittedEntries.forEach((entry, index) => {
    const apiEntry = apiEntries[index];
    merged.push(apiEntry?._id ? { ...entry, _id: apiEntry._id, id: apiEntry._id } : entry);
  });
  return merged;
}

function calculateStats(entries: TimetableEntry[]): TimetableStats {
  const firstCycle = entries.filter((e) => e.cycle === "first").length;
  const secondCycle = entries.filter((e) => e.cycle === "second").length;
  const totalPotential = entries.reduce((sum, e) => sum + e.ratePerPeriod, 0);

  return {
    totalPeriods: entries.length,
    totalTeachers: new Set(entries.map((e) => e.teacherId)).size,
    totalClasses: new Set(entries.map((e) => e.classId)).size,
    totalPotential,
    firstCyclePeriods: firstCycle,
    secondCyclePeriods: secondCycle,
  };
}

function csvField(value: string | number | undefined | null): string {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function normalizeColor(color: string): string {
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return color;
    ctx.fillStyle = color;
    return ctx.fillStyle;
  } catch {
    return color;
  }
}

function flattenUnsupportedColors(root: HTMLElement) {
  const props = ["color", "backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"] as const;
  const all = root.querySelectorAll<HTMLElement>("*");
  [root, ...Array.from(all)].forEach((el) => {
    const computed = window.getComputedStyle(el);
    props.forEach((prop) => {
      const value = computed[prop];
      if (value && (value.includes("oklch") || value.includes("lab(") || value.includes("color("))) {
        el.style[prop] = normalizeColor(value);
      }
    });
  });
}

// ============================================
// MULTI-SUBJECT HELPERS
// ============================================

function groupEntriesByClassAndTime(entries: TimetableEntry[]): Map<string, TimetableEntry[]> {
  const grouped = new Map<string, TimetableEntry[]>();

  entries.forEach(entry => {
    const key = `${entry.classId}|${entry.day}|${entry.startTime}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(entry);
  });

  return grouped;
}

function combineMultiSubjectEntries(entries: TimetableEntry[]): TimetableEntry[] {
  const grouped = groupEntriesByClassAndTime(entries);
  const combined: TimetableEntry[] = [];

  grouped.forEach((group) => {
    if (group.length === 1) {
      combined.push(group[0]);
    } else {
      const first = group[0];
      const subjectNames = group.map(e => e.subjectName).join('/');
      const teacherNames = group.map(e => e.teacherName).join('/');
      const subjectCodes = group.map(e => e.subjectCode || '').filter(Boolean).join('/');

      combined.push({
        ...first,
        subjectName: subjectNames,
        subjectCode: subjectCodes || undefined,
        teacherName: teacherNames,
        room: group.every(e => e.room === group[0].room) ? group[0].room : group.map(e => e.room || '?').join('/'),
        id: first.id,
        _id: first._id,
      });
    }
  });

  return combined;
}

function buildPdfGrid(entries: TimetableEntry[], classList: Class[], schedule: ScheduleSlot[], days: string[]): PdfGridRow[] {
  const combinedEntries = combineMultiSubjectEntries(entries);
  const classIds = classList.map((c) => c._id);

  const index = new Map<string, TimetableEntry>();
  combinedEntries.forEach((e) => {
    index.set(`${e.day}|${e.startTime}|${e.classId}`, e);
  });

  const rows: PdfGridRow[] = [];
  days.forEach((day) => {
    schedule.forEach((slot) => {
      const cells: Record<string, PdfGridCell | null> = {};
      classIds.forEach((classId) => {
        const entry = index.get(`${day}|${slot.start}|${classId}`);
        cells[classId] = entry ? {
          subjectName: entry.subjectName,
          teacherName: entry.teacherName,
          room: entry.room
        } : null;
      });
      rows.push({ day, period: slot.label, duration: `${slot.start} - ${slot.end}`, isBreak: false, cells });
    });
  });

  return rows;
}

function buildPaginatedPdfGrids(entries: TimetableEntry[], schedule: ScheduleSlot[], days: string[]): { label: string; rows: PdfGridRow[] }[] {
  const combinedEntries = combineMultiSubjectEntries(entries);

  const classIds = Array.from(new Set(combinedEntries.map((e) => e.classId))).sort();

  const index = new Map<string, TimetableEntry>();
  combinedEntries.forEach((e) => {
    const key = `${e.day}|${e.startTime}|${e.classId}`;
    index.set(key, e);
  });

  const pageGroups = splitDaysForPages(days);

  return pageGroups.map((group) => {
    const rows: PdfGridRow[] = [];
    group.days.forEach((day) => {
      schedule.forEach((slot) => {
        const cells: Record<string, PdfGridCell | null> = {};
        classIds.forEach((classId) => {
          const entry = index.get(`${day}|${slot.start}|${classId}`);
          cells[classId] = entry ? {
            subjectName: entry.subjectName,
            teacherName: entry.teacherName,
            room: entry.room
          } : null;
        });
        rows.push({
          day,
          period: slot.label,
          duration: `${slot.start} - ${slot.end}`,
          isBreak: false,
          cells
        });
      });
    });
    return { label: group.label, rows };
  });
}

// ============================================
// BUILD MATRIX TIMETABLE FROM THE LIVE DB SCHEDULE
// ============================================

function buildMatrixTimetable(entries: TimetableEntry[], classList: Class[], schedule: ScheduleSlot[], schoolDays: string[]): any {
  const combinedEntries = combineMultiSubjectEntries(entries);
  const uniqueClasses = dedupeClassesByName(classList);

  // Time slots come from the live schedule built from the database settings.
  const timeSlots = schedule.map(slot => ({
    start: slot.start,
    end: slot.end,
    label: slot.label,
    isBreak: false
  }));

  const days = schoolDays;

  const matrix: any = {};
  days.forEach(day => {
    matrix[day] = {};
    timeSlots.forEach((slot) => {
      matrix[day][slot.start] = {
        label: slot.label,
        isBreak: slot.isBreak,
        startTime: slot.start,
        endTime: slot.end,
        entries: []
      };
    });
  });

  combinedEntries.forEach(entry => {
    let entryStart = entry.startTime;
    if (entryStart && entryStart.length === 4) {
      entryStart = `0${entryStart}`;
    }

    let matchedSlot = timeSlots.find(slot => {
      return entryStart >= slot.start && entryStart < slot.end;
    });

    if (!matchedSlot) {
      matchedSlot = timeSlots.find(slot => slot.start === entryStart);
    }

    if (!matchedSlot) {
      matchedSlot = timeSlots.find(slot => {
        return parseInt(slot.label) === entry.periodNumber;
      });
    }

    if (!matchedSlot) {
      matchedSlot = timeSlots.find(slot => {
        return entryStart >= slot.start && entry.endTime <= slot.end;
      });
    }

    if (matchedSlot) {
      if (matrix[entry.day] && matrix[entry.day][matchedSlot.start]) {
        matrix[entry.day][matchedSlot.start].entries.push(entry);
      }
    } else {
      const entryHour = parseInt(entryStart.split(':')[0]);
      const closestSlot = timeSlots.find(slot => {
        const slotHour = parseInt(slot.start.split(':')[0]);
        return slotHour === entryHour;
      });

      if (closestSlot && matrix[entry.day] && matrix[entry.day][closestSlot.start]) {
        matrix[entry.day][closestSlot.start].entries.push(entry);
      } else {
        const firstSlot = timeSlots[0];
        if (matrix[entry.day] && matrix[entry.day][firstSlot.start]) {
          matrix[entry.day][firstSlot.start].entries.push(entry);
        }
      }
    }
  });

  const displayTimeSlots = timeSlots.map(slot => ({
    start: slot.start,
    end: slot.end,
    label: slot.label,
    isBreak: false,
    display: `${slot.start} - ${slot.end}`
  }));

  return {
    matrix,
    days,
    timeSlots: displayTimeSlots,
    rawTimeSlots: timeSlots,
    labels: timeSlots.map(s => s.label),
    isBreak: timeSlots.map(() => false),
    classes: uniqueClasses
  };
}

function dedupeClassesByName(classList: Class[]): Class[] {
  const seen = new Set<string>();
  const result: Class[] = [];
  classList.forEach((c) => {
    const fullName = c.department ? `${c.className} ${c.department}` : c.className;
    const key = fullName.trim().toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push({
        ...c,
        displayName: fullName
      });
    }
  });
  return result;
}

function getClassDisplayName(classItem?: Class, fallback = "Unknown Class") {
  if (!classItem) return fallback;
  return classItem.department ? `${classItem.className} ${classItem.department}` : classItem.className;
}

function generateMockData() {
  const mockTeachers: Teacher[] = [
    { _id: "t1", name: "John Doe", email: "john@school.com", phone: "699123456", qualification: "BSc Math", subjectIds: ["s1"], classIds: ["c1"] },
    { _id: "t2", name: "Jane Smith", email: "jane@school.com", phone: "699234567", qualification: "BEd English", subjectIds: ["s2"], classIds: ["c2"] },
    { _id: "t3", name: "Michael Brown", email: "michael@school.com", phone: "699345678", qualification: "PhD Physics", subjectIds: ["s3"], classIds: ["c3"] },
    { _id: "t4", name: "Sarah Wilson", email: "sarah@school.com", phone: "699456789", qualification: "MSc Chemistry", subjectIds: ["s4"], classIds: ["c1"] },
    { _id: "t5", name: "David Kim", email: "david@school.com", phone: "699567890", qualification: "BEd History", subjectIds: ["s5"], classIds: ["c3"] },
  ];

  const mockClasses: Class[] = [
    { _id: "c1", className: "Form 4", department: "Science A", cycle: "First Cycle" },
    { _id: "c2", className: "Form 5", department: "Science A", cycle: "Second Cycle" },
    { _id: "c3", className: "Form 3", department: "Arts", cycle: "First Cycle" },
    { _id: "c4", className: "Form 4", department: "Commercial", cycle: "First Cycle" },
    { _id: "c5", className: "Form 5", department: "Arts", cycle: "Second Cycle" },
  ];

  const mockSubjects: Subject[] = [
    { _id: "s1", name: "Mathematics", code: "MATH" },
    { _id: "s2", name: "English", code: "ENG" },
    { _id: "s3", name: "Physics", code: "PHY" },
    { _id: "s4", name: "Chemistry", code: "CHEM" },
    { _id: "s5", name: "History", code: "HIST" },
    { _id: "s6", name: "Geography", code: "GEOG" },
  ];

  const mockEntries: TimetableEntry[] = [];
  const schedule = buildScheduleFromSettings(DEFAULT_SCHOOL_SETTINGS);
  const days = DEFAULT_SCHOOL_SETTINGS.schoolDays;

  const timeSlots = schedule.filter(s => s.type === "period").map(s => s.start);
  const endSlots = schedule.filter(s => s.type === "period").map(s => s.end);
  const periods = schedule.filter(s => s.type === "period").map(s => Number(s.label));

  mockTeachers.forEach((teacher, ti) => {
    days.forEach((day, di) => {
      periods.forEach((period, pi) => {
        if (Math.random() > 0.5) {
          const cls = mockClasses[(ti + di + pi) % mockClasses.length];
          const subj = mockSubjects[(ti + di) % mockSubjects.length];
          const cycle: "first" | "second" = ti % 2 === 0 ? "first" : "second";
          const timeIndex = pi % timeSlots.length;

          mockEntries.push({
            id: `entry_${ti}_${di}_${pi}`,
            teacherId: teacher._id,
            teacherName: teacher.name,
            classId: cls._id,
            className: cls.className,
            subjectId: subj._id,
            subjectName: subj.name,
            subjectCode: subj.code,
            day,
            startTime: timeSlots[timeIndex],
            endTime: endSlots[timeIndex],
            periodNumber: period,
            cycle,
            ratePerPeriod: CYCLE_RATES[cycle],
            room: `Room ${Math.floor(Math.random() * 10) + 1}`,
            academicYear: "2026-2027",
            isActive: true,
          });
        }
      });
    });
  });

  return { teachers: mockTeachers, classes: mockClasses, subjects: mockSubjects, entries: mockEntries };
}

// ============================================
// STAT CARD COMPONENT
// ============================================

const StatCard = memo(function StatCard({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: number;
  valueClassName?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4">
      <p className="text-xs text-black/40 font-medium uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${valueClassName}`}>{value}</p>
    </div>
  );
});

const CycleBadge = memo(function CycleBadge({ cycle }: { cycle: "first" | "second" }) {
  return (
    <span
      className={`text-xs px-2 py-1 rounded-full font-bold ${cycle === "first" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
        }`}
    >
      {cycle === "first" ? "1st Cycle" : "2nd Cycle"}
    </span>
  );
});

// ============================================
// MAIN TIMETABLE ADMIN PAGE
// ============================================

export function TimetableAdminPage() {
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "grid" | "calendar">("table");
  const [selectedTeacher, setSelectedTeacher] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [selectedCycle, setSelectedCycle] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [stats, setStats] = useState<TimetableStats>({
    totalPeriods: 0,
    totalTeachers: 0,
    totalClasses: 0,
    totalPotential: 0,
    firstCyclePeriods: 0,
    secondCyclePeriods: 0,
  });
  const [filterClass, setFilterClass] = useState<string>("");
  const [filterTeacher, setFilterTeacher] = useState<string>("");

  // School schedule settings (used by the auto-generate wizard).
  const [schoolSettings, setSchoolSettings] = useState<SchoolSettings>({
    schoolStartTime: "08:00",
    schoolEndTime: "14:00",
    breakStart: "10:15",
    breakEnd: "10:30",
    periodDurationMinutes: 45,
    schoolDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    periodsPerDay: 6,
  });
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateConflicts, setGenerateConflicts] = useState<GenerateConflict[]>([]);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSubjectsModal, setShowSubjectsModal] = useState(false);

  const currentYear = new Date().getFullYear();
  const academicYear = "2026-2027";

  // Live schedule + school days built from the settings stored in the database.
  const schedule = useMemo(() => buildScheduleFromSettings(schoolSettings), [schoolSettings]);
  const scheduleDays = useMemo(() => {
    const configured = schoolSettings.schoolDays?.length ? schoolSettings.schoolDays : DEFAULT_SCHOOL_SETTINGS.schoolDays;
    return DAYS.filter((day) => configured.includes(day));
  }, [schoolSettings]);

  // ============================================
  // FETCH DATA
  // ============================================

  const applyMockDataFallback = useCallback(() => {
    const mockData = generateMockData();
    setEntries(mockData.entries);
    setTeachers(mockData.teachers);
    setClasses(mockData.classes);
    setSubjects(mockData.subjects);
    setStats(calculateStats(mockData.entries));
    saveToLocalStorage("entries", mockData.entries);
    saveToLocalStorage("teachers", mockData.teachers);
    saveToLocalStorage("classes", mockData.classes);
    saveToLocalStorage("subjects", mockData.subjects);
  }, []);

  const fetchAllData = useCallback(async () => {
    try {
      setLoading(true);
      setApiError(null);

      const cachedEntries = loadFromLocalStorage("entries");
      const cachedTeachers = loadFromLocalStorage("teachers");
      const cachedClasses = loadFromLocalStorage("classes");
      const cachedSubjects = loadFromLocalStorage("subjects");
      const hasCache = cachedEntries && cachedEntries.length > 0;

      if (hasCache) {
        const sanitizedCached: TimetableEntry[] = (cachedEntries as TimetableEntry[]).map(sanitizeEntry);
        setEntries(sanitizedCached);
        setTeachers(cachedTeachers || []);
        setClasses(cachedClasses || []);
        setSubjects(cachedSubjects || []);
        setStats(calculateStats(sanitizedCached));
        saveToLocalStorage("entries", sanitizedCached);
      }

      try {
        const [timetableRes, teachersRes, classesRes, subjectsRes] = await Promise.all([
          axios.get(`${API_BASE}/timetable`).catch(() => ({ data: { success: false } })),
          axios.get(`${API_BASE}/users?role=teacher`).catch(() => ({ data: { success: false } })),
          axios.get(`${API_BASE}/classes`).catch(() => ({ data: { success: false } })),
          axios.get(`${API_BASE}/subjects`).catch(() => ({ data: { success: false } })),
        ]);

        const apiSuccess =
          timetableRes.data.success || teachersRes.data.success || classesRes.data.success || subjectsRes.data.success;

        if (apiSuccess) {
          setIsOnline(true);
          setApiError(null);

          if (timetableRes.data.success && timetableRes.data.data.length > 0) {
            const mappedEntries = timetableRes.data.data.map(mapApiEntry);
            setEntries(mappedEntries);
            saveToLocalStorage("entries", mappedEntries);
            setStats(calculateStats(mappedEntries));
          }
          if (teachersRes.data.success && teachersRes.data.data.length > 0) {
            setTeachers(teachersRes.data.data);
            saveToLocalStorage("teachers", teachersRes.data.data);
          }
          if (classesRes.data.success && classesRes.data.data.length > 0) {
            setClasses(classesRes.data.data);
            saveToLocalStorage("classes", classesRes.data.data);
          }
          if (subjectsRes.data.success && subjectsRes.data.data.length > 0) {
            setSubjects(subjectsRes.data.data);
            saveToLocalStorage("subjects", subjectsRes.data.data);
          }
        } else if (!hasCache) {
          applyMockDataFallback();
          toast.info("Using demo data");
        } else {
          toast.info("Using cached data");
        }
      } catch (apiErr) {
        console.error("API Error:", apiErr);
        setApiError("API server error. Using local data.");
        setIsOnline(false);
        if (!hasCache) {
          applyMockDataFallback();
          toast.info("Using demo data (offline mode)");
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      setIsOnline(false);
    } finally {
      setLoading(false);
    }
  }, [applyMockDataFallback]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // ============================================
  // AUTO-GENERATION: School settings + teacher availability
  // ============================================

  // Load saved school schedule settings for the active academic year.
  const loadSchoolSettings = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/settings?academicYear=${academicYear}`);
      if (res.data.success && res.data.data) {
        const s = res.data.data;
        setSchoolSettings({
          _id: s._id,
          schoolStartTime: s.schoolStartTime || "08:00",
          schoolEndTime: s.schoolEndTime || "14:00",
          breakStart: s.breakStart || "10:15",
          breakEnd: s.breakEnd || "10:30",
          periodDurationMinutes: s.periodDurationMinutes || 45,
          schoolDays: s.schoolDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
          periodsPerDay: s.periodsPerDay || 6,
        });
      }
    } catch (err) {
      // No saved settings yet — keep defaults.
    }
  }, [academicYear]);

  useEffect(() => {
    loadSchoolSettings();
  }, [loadSchoolSettings]);

  // Restore the conflict report of the last generation so the dashboard
  // banner (and its "Fix All Conflicts" button) survives page reloads.
  useEffect(() => {
    const cached = loadFromLocalStorage("conflicts");
    if (Array.isArray(cached) && cached.length > 0) {
      setGenerateConflicts(cached);
    }
  }, []);

  // Re-fetch subjects after the Subjects & Periods manager saves changes.
  const refreshSubjects = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/subjects`);
      if (res.data.success && Array.isArray(res.data.data)) {
        setSubjects(res.data.data);
        saveToLocalStorage("subjects", res.data.data);
      }
    } catch (err) {
      console.error("Failed to refresh subjects:", err);
    }
  }, []);

  const activeTeachers = useMemo(
    () => teachers.filter((t) => OBJECT_ID_RE.test(t._id || "")),
    [teachers]
  );

  // Group the conflict report by subject so the red banner can give one
  // clear diagnosis + numbered action list per subject instead of repeating
  // one row per class.
  const conflictGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        subjectName: string;
        classNames: string[];
        missing: number;
        suggestions: string[];
        qualifiedTeacherNames: string[];
        qualifiedTeacherSlots?: number;
        subjectWeeklyDemand?: number;
      }
    >();
    const missingOf = (c: GenerateConflict) =>
      c.missingPeriods ??
      Math.max(0, (c.requestedPeriods ?? 0) - (c.placedPeriods ?? 0));
    for (const c of generateConflicts) {
      const key = c.subjectId || c.subjectName || "unknown";
      const group = map.get(key) ?? {
        key,
        subjectName: c.subjectName || "Unknown subject",
        classNames: [],
        missing: 0,
        suggestions: [],
        qualifiedTeacherNames:
          c.qualifiedTeacherNames ?? (c.teacherName ? [c.teacherName] : []),
        qualifiedTeacherSlots: c.qualifiedTeacherSlots,
        subjectWeeklyDemand: c.subjectWeeklyDemand,
      };
      group.missing += missingOf(c);
      if (c.className && !group.classNames.includes(c.className)) {
        group.classNames.push(c.className);
      }
      if (group.suggestions.length === 0 && c.suggestions?.length) {
        group.suggestions = c.suggestions;
      }
      map.set(key, group);
    }
    return [...map.values()].sort((a, b) => b.missing - a.missing);
  }, [generateConflicts]);

  const totalMissingPeriods = useMemo(
    () =>
      generateConflicts.reduce(
        (sum, c) =>
          sum +
          (c.missingPeriods ??
            Math.max(0, (c.requestedPeriods ?? 0) - (c.placedPeriods ?? 0))),
        0
      ),
    [generateConflicts]
  );

  // Save a single teacher's availability (used by the setup wizard).
  const saveTeacherAvailability = useCallback(
    async (teacherId: string, isPermanent: boolean, availableDays: string[]) => {
      try {
        await axios.patch(`${API_BASE}/users/${teacherId}`, {
          isPermanent,
          availableDays,
        });
        // Optimistically update local state.
        setTeachers((prev) =>
          prev.map((t) =>
            t._id === teacherId
              ? { ...t, isPermanent, availableDays }
              : t
          )
        );
        return true;
      } catch (err: any) {
        toast.error(err?.response?.data?.message || "Failed to save teacher availability");
        return false;
      }
    },
    []
  );

  // Persist the school schedule settings.
  const saveSchoolSettings = useCallback(
    async (settings: Omit<SchoolSettings, "_id">) => {
      try {
        const res = await axios.post(`${API_BASE}/settings`, {
          academicYear,
          ...settings,
        });
        if (res.data.success) {
          setSchoolSettings(res.data.data);
          return true;
        }
        return false;
      } catch (err: any) {
        toast.error(err?.response?.data?.message || "Failed to save school settings");
        return false;
      }
    },
    [academicYear]
  );

  // Trigger auto-generation of the timetable from settings + availability.
  const handleGenerateTimetable = useCallback(async (repair: unknown = false) => {
    // Only a literal `true` enables repair mode. React invokes onClick
    // handlers with the click event as the first argument, so a handler
    // attached directly as `onClick={handleGenerateTimetable}` receives the
    // SyntheticEvent here. That event previously leaked into the POST body
    // and axios crashed with "Converting circular structure to JSON" before
    // the request ever left the browser.
    const repairMode = typeof repair === "boolean" ? repair : false;
    if (!repairMode && !window.confirm(
      "This will replace the current timetable for the selected academic year. Continue?"
    )) {
      return;
    }

    setIsGenerating(true);
    try {
      // Ensure every active teacher has explicit availability before generating.
      // The backend generator (routes/timetable.js isTeacherAvailable) excludes
      // any teacher whose saved config is isPermanent=false with an empty
      // availableDays list — and the User schema defaults never-edited teachers
      // to exactly that, so teachers the admin never configured would silently
      // receive zero periods. Persist the wizard's default ("available all
      // days") for anyone still unconfigured; teachers with an explicit config
      // are left untouched.
      const unconfigured = activeTeachers.filter(
        (t) =>
          !t.isPermanent &&
          (!Array.isArray(t.availableDays) || t.availableDays.length === 0)
      );
      if (unconfigured.length > 0) {
        try {
          await Promise.all(
            unconfigured.map((t) =>
              axios.patch(`${API_BASE}/users/${t._id}`, {
                isPermanent: true,
                availableDays: [...DAYS],
              })
            )
          );
          setTeachers((prev) =>
            prev.map((t) =>
              unconfigured.some((u) => u._id === t._id)
                ? { ...t, isPermanent: true, availableDays: [...DAYS] }
                : t
            )
          );
          toast.info(
            `Applied default availability (all days) to ${unconfigured.length} teacher(s) with no saved availability.`
          );
        } catch (patchErr) {
          console.error("Failed to apply default availability:", patchErr);
          toast.warning(
            "Could not save default availability for some teachers — they may be excluded from generation. Open Step 1 and save availability manually."
          );
        }
      }

      const res = await axios.post(
        `${API_BASE}/timetable/generate`,
        { academicYear, repair: repairMode },
        // Guard against the request hanging forever when the backend is
        // restarting or its database is unreachable; 90s is far above the
        // generation time of a healthy server.
        { timeout: 90_000 }
      );

      if (res.data.success) {
        const { entries: generated, conflicts } = res.data.data;
        const mappedEntries = (generated || []).map(mapApiEntry);
        setEntries(mappedEntries);
        saveToLocalStorage("entries", mappedEntries);
        setStats(calculateStats(mappedEntries));
        setGenerateConflicts(Array.isArray(conflicts) ? conflicts : []);
        saveToLocalStorage("conflicts", Array.isArray(conflicts) ? conflicts : []);

        if (conflicts && conflicts.length > 0) {
          // Keep the wizard open so the conflict report stays visible in Step 3
          // (previously these were only logged to the console via console.table).
          toast.warning(`${mappedEntries.length} periods generated, but ${conflicts.length} conflict(s) remain.`);
        } else {
          toast.success(`${mappedEntries.length} periods scheduled successfully${repairMode ? " after automatic repair" : ""}!`);
          setShowSetupWizard(false);
        }
        fetchAllData();
      } else {
        toast.error(res.data.message || "Generation failed");
        setShowSetupWizard(false);
      }
    } catch (err: any) {
      console.error("Timetable generation failed:", err);
      const serverMessage = err?.response?.data?.message;
      if (serverMessage) {
        // The backend answered with a JSON error (validation, missing
        // settings, capacity problems...) — surface its exact message.
        toast.error(serverMessage);
      } else if (err?.response) {
        // Non-JSON response (e.g. a proxy 502/504 page) or an error body
        // without a message field.
        toast.error(
          `Timetable server error (HTTP ${err.response.status}). Please try again.`
        );
      } else if (err?.request) {
        // No HTTP response at all: the backend is unreachable, restarting,
        // or the connection was dropped mid-flight.
        toast.error(
          `Cannot reach the timetable server (${err?.code || "network error"}). Check that the backend is running and try again.`
        );
      } else {
        toast.error(
          `Failed to generate timetable: ${err?.message || "unknown error"}`
        );
      }
      setShowSetupWizard(false);
    } finally {
      setIsGenerating(false);
    }
  }, [academicYear, fetchAllData, activeTeachers]);

  const handleRepairTimetable = useCallback(async () => {
    await handleGenerateTimetable(true);
  }, [handleGenerateTimetable]);

  // ============================================
  // FILTERED DATA
  // ============================================

  const filteredEntries = useMemo(() => {
    let filtered = entries;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.teacherName.toLowerCase().includes(term) ||
          e.className.toLowerCase().includes(term) ||
          e.subjectName.toLowerCase().includes(term) ||
          (e.subjectCode && e.subjectCode.toLowerCase().includes(term))
      );
    }
    if (selectedTeacher) filtered = filtered.filter((e) => e.teacherId === selectedTeacher);
    if (selectedClass) filtered = filtered.filter((e) => e.classId === selectedClass);
    if (selectedDay) filtered = filtered.filter((e) => e.day === selectedDay);
    if (selectedCycle) filtered = filtered.filter((e) => e.cycle === selectedCycle);

    if (filterClass) filtered = filtered.filter((e) => e.classId === filterClass);
    if (filterTeacher) filtered = filtered.filter((e) => e.teacherId === filterTeacher);

    return filtered;
  }, [entries, searchTerm, selectedTeacher, selectedClass, selectedDay, selectedCycle, filterClass, filterTeacher]);

  const hasActiveFilters = Boolean(selectedTeacher || selectedClass || selectedDay || selectedCycle || searchTerm || filterClass || filterTeacher);

  const clearFilters = useCallback(() => {
    setSelectedTeacher("");
    setSelectedClass("");
    setSelectedDay("");
    setSelectedCycle("");
    setSearchTerm("");
    setFilterClass("");
    setFilterTeacher("");
  }, []);

  const uniqueClasses = useMemo(() => classes, [classes]);

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  const syncToAPI = useCallback(async (method: string, url: string, data?: any) => {
    try {
      const response = await axios({
        method,
        url,
        data,
        headers: {
          'Content-Type': 'application/json',
        }
      });
      return response.data;
    } catch (error: any) {
      console.error("API sync failed:", error);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);

        const errorMsg = error.response.data?.message || `Server error: ${error.response.status}`;

        if (errorMsg.includes('already assigned to')) {
          throw new Error(errorMsg);
        }

        throw new Error(errorMsg);
      } else if (error.request) {
        console.error('No response received');
        throw new Error('No response from server');
      } else {
        throw new Error(error.message);
      }
    }
  }, []);

  const handleSaveEntry = useCallback(
    async (entry: TimetableEntry) => {
      if (isSaving) return;

      if (!entry.teacherId || !entry.classId || !entry.subjectId) {
        toast.error("Please fill in all required fields");
        return;
      }

      const { startTime, endTime } = sanitizeTimes(entry.startTime, entry.endTime);
      const sanitizedEntry: TimetableEntry = { ...entry, startTime, endTime };

      if (sanitizedEntry.startTime >= sanitizedEntry.endTime) {
        toast.error("Start time must be before end time");
        return;
      }

      setIsSaving(true);
      try {
        const isNew = !sanitizedEntry._id &&
          (!sanitizedEntry.id || sanitizedEntry.id.startsWith('entry_'));

        const isExisting = !isNew && entries.some((e) => {
          const matchById =
            e.id === sanitizedEntry.id ||
            e._id === sanitizedEntry.id ||
            e.id === sanitizedEntry._id ||
            e._id === sanitizedEntry._id ||
            (e._id && sanitizedEntry._id && e._id.toString() === sanitizedEntry._id.toString());
          return matchById;
        });

        const apiData = mapForApi(sanitizedEntry);
        let updatedEntries: TimetableEntry[];

        if (isExisting) {
          const existingEntry = entries.find((e) => {
            const matchById =
              e.id === sanitizedEntry.id ||
              e._id === sanitizedEntry.id ||
              e.id === sanitizedEntry._id ||
              e._id === sanitizedEntry._id ||
              (e._id && sanitizedEntry._id && e._id.toString() === sanitizedEntry._id.toString());
            return matchById;
          });

          const apiId = existingEntry?._id || existingEntry?.id || sanitizedEntry._id || sanitizedEntry.id;

          if (!apiId) {
            toast.error("Invalid entry ID");
            setIsSaving(false);
            return;
          }

          const result = await syncToAPI("PUT", `${API_BASE}/timetable/${apiId}`, apiData);

          if (result?.success) {
            updatedEntries = entries.map((e) => {
              const isMatching =
                e.id === sanitizedEntry.id ||
                e._id === sanitizedEntry.id ||
                e.id === sanitizedEntry._id ||
                e._id === sanitizedEntry._id ||
                (e._id && sanitizedEntry._id && e._id.toString() === sanitizedEntry._id.toString());

              if (isMatching) {
                return {
                  ...sanitizedEntry,
                  _id: e._id || sanitizedEntry._id,
                  id: e.id || sanitizedEntry.id
                };
              }
              return e;
            });

            setEntries(updatedEntries);
            setStats(calculateStats(updatedEntries));
            saveToLocalStorage("entries", updatedEntries);
            toast.success("Timetable entry updated");
          } else {
            throw new Error(result?.message || "Failed to update");
          }
        } else {
          try {
            const teacherConflict = entries.find((e) =>
              e.teacherId === sanitizedEntry.teacherId &&
              e.day === sanitizedEntry.day &&
              e.startTime === sanitizedEntry.startTime &&
              e.academicYear === sanitizedEntry.academicYear &&
              e.id !== sanitizedEntry.id &&
              e._id !== sanitizedEntry._id
            );

            if (teacherConflict) {
              const conflictTeacher = teachers.find(t => t._id === teacherConflict.teacherId);
              toast.error(
                `⚠️ Teacher "${conflictTeacher?.name || teacherConflict.teacherName}" is already assigned to ${teacherConflict.className} at this time on ${sanitizedEntry.day}.\n\n` +
                `To add multiple subjects to the same class at the same time, use a different teacher.`
              );
              setIsSaving(false);
              return;
            }

            const result = await syncToAPI("POST", `${API_BASE}/timetable`, apiData);

            if (result?.success && result?.data) {
              const savedData = result.data;
              const savedEntry = {
                ...sanitizedEntry,
                id: savedData._id || savedData.id || `entry_${Date.now()}`,
                _id: savedData._id || savedData.id,
                ratePerPeriod: savedData.ratePerPeriod || sanitizedEntry.ratePerPeriod,
              };

              updatedEntries = [...entries, savedEntry];
              setEntries(updatedEntries);
              setStats(calculateStats(updatedEntries));
              saveToLocalStorage("entries", updatedEntries);
              toast.success("Timetable entry added successfully");
            } else {
              throw new Error(result?.message || "Failed to create entry");
            }
          } catch (error: any) {
            if (error.message?.includes("already has a period") ||
              error.message?.includes("already assigned")) {
              toast.error(
                `⚠️ ${error.message}\n\n` +
                `This teacher already has a period at this time.\n` +
                `To add multiple subjects to the same class at the same time,\n` +
                `please use a different teacher for each subject.`
              );
            } else {
              throw error;
            }
            setIsSaving(false);
            return;
          }
        }

        setEditingEntry(null);
        setShowAddModal(false);
      } catch (error: any) {
        console.error("Error saving timetable:", error);
        toast.error(error instanceof Error ? error.message : "Failed to save entry");
        if (error.message?.includes('already assigned to')) {
          toast.error(`⚠️ ${error.message}`);
        } else {
          toast.error(error instanceof Error ? error.message : "Failed to save entry");
        }
        setIsSaving(false);
        return;
      } finally {
        setIsSaving(false);
      }
    },
    [entries, isSaving, syncToAPI, teachers]
  );

  const handleDeleteEntry = useCallback(
    async (id: string) => {
      if (!window.confirm("Are you sure you want to delete this timetable entry?")) return;
      if (isSaving) return;

      setIsSaving(true);
      try {
        const entryToDelete = entries.find((e) => e.id === id || e._id === id);
        const apiId = entryToDelete?._id || entryToDelete?.id || id;

        if (apiId) {
          const result = await syncToAPI("DELETE", `${API_BASE}/timetable/${apiId}`);
          if (result) {
            toast.success("Timetable entry deleted");
          } else {
            toast.warning("Entry may have already been deleted");
          }
        }

        const updatedEntries = entries.filter((e) => e.id !== id && e._id !== id);
        setEntries(updatedEntries);
        setStats(calculateStats(updatedEntries));
        saveToLocalStorage("entries", updatedEntries);

        if (editingEntry && (editingEntry.id === id || editingEntry._id === id)) {
          setEditingEntry(null);
        }
      } catch (error) {
        console.error("Error deleting timetable:", error);
        const updatedEntries = entries.filter((e) => e.id !== id && e._id !== id);
        setEntries(updatedEntries);
        setStats(calculateStats(updatedEntries));
        saveToLocalStorage("entries", updatedEntries);
        toast.warning("Deleted locally (API sync failed)");
      } finally {
        setIsSaving(false);
      }
    },
    [entries, isSaving, syncToAPI, editingEntry]
  );

  const handleBulkAdd = useCallback(
    async (newEntries: TimetableEntry[]) => {
      if (isSaving) return;

      const sanitizedNewEntries = newEntries.map(sanitizeEntry);
      const validEntries = sanitizedNewEntries.filter((e) => e.teacherId && e.classId && e.subjectId);
      if (validEntries.length === 0) {
        toast.error("No valid entries to add");
        return;
      }

      setIsSaving(true);
      try {
        const apiData = validEntries.map(mapForApi);
        const result = await syncToAPI("POST", `${API_BASE}/timetable/bulk`, { entries: apiData });
        const updatedEntries = mergeBulkApiResults(entries, validEntries, result?.data?.entries);

        setEntries(updatedEntries);
        setStats(calculateStats(updatedEntries));
        saveToLocalStorage("entries", updatedEntries);
        toast.success(`${validEntries.length} entries added successfully`);
        setShowBulkModal(false);
      } catch (error) {
        console.error("Error bulk adding timetable:", error);
        toast.error("Failed to add entries");
      } finally {
        setIsSaving(false);
      }
    },
    [entries, isSaving, syncToAPI]
  );

  const handleCopyFromPrevious = useCallback(
    async (sourceYear: string, targetYear: string) => {
      if (isSaving) return;

      const sourceEntries = entries.filter((e) => e.academicYear === sourceYear);
      if (sourceEntries.length === 0) {
        toast.error("No entries found for the source year");
        return;
      }

      setIsSaving(true);
      try {
        const copiedEntries = sourceEntries.map((e) => ({
          ...sanitizeEntry(e),
          id: `entry_${Date.now()}_${Math.random()}`,
          academicYear: targetYear,
          isActive: true,
        }));

        const apiData = copiedEntries.map(mapForApi);
        const result = await syncToAPI("POST", `${API_BASE}/timetable/bulk`, { entries: apiData });
        const updatedEntries = mergeBulkApiResults(entries, copiedEntries, result?.data?.entries);

        setEntries(updatedEntries);
        setStats(calculateStats(updatedEntries));
        saveToLocalStorage("entries", updatedEntries);
        toast.success(`${copiedEntries.length} entries copied to ${targetYear}`);
        setShowCopyModal(false);
      } catch (error) {
        console.error("Error copying timetable:", error);
        toast.error("Failed to copy entries");
      } finally {
        setIsSaving(false);
      }
    },
    [entries, isSaving, syncToAPI]
  );

  const handleEditRequest = useCallback((entry: TimetableEntry) => {
    const existingEntry = entries.find(e =>
      e.id === entry.id ||
      e._id === entry.id ||
      e.id === entry._id ||
      e._id === entry._id
    );

    if (existingEntry) {
      setEditingEntry(sanitizeEntry({
        ...existingEntry,
        id: existingEntry.id || existingEntry._id || `entry_${Date.now()}`,
        _id: existingEntry._id || existingEntry.id,
      }));
    } else {
      setEditingEntry(sanitizeEntry({
        ...entry,
        id: entry.id || entry._id || `entry_${Date.now()}`,
        _id: entry._id || entry.id,
      }));
    }
  }, [entries]);

  const closeEntryModal = useCallback(() => {
    setEditingEntry(null);
    setShowAddModal(false);
  }, []);

  // ============================================
  // EXPORT FUNCTIONS
  // ============================================

  const exportToCSV = useCallback(() => {
    const combinedEntries = combineMultiSubjectEntries(filteredEntries);
    const headers = ["Day", "Start Time", "End Time", "Teacher", "Class", "Subject", "Cycle", "Rate", "Room"];
    const rows = combinedEntries.map((e) => [
      e.day,
      e.startTime,
      e.endTime,
      e.teacherName,
      e.className,
      e.subjectName,
      e.cycle === "first" ? "1st Cycle" : "2nd Cycle",
      e.ratePerPeriod,
      e.room || "",
    ]);

    const csv = [headers, ...rows].map((row) => row.map(csvField).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timetable_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Timetable exported as CSV");
  }, [filteredEntries]);

  const exportToPDF = useCallback(() => window.print(), []);

  // ============================================
  // PDF DOWNLOAD - STANDARD FORMAT
  // ============================================

  const downloadStandardPDF = useCallback(async () => {
    setIsDownloadingPdf(true);
    try {
      const res = await axios.get(`${API_BASE}/timetable`).catch(() => null);
      const rawEntries = res?.data?.success ? res.data.data : null;
      const freshEntries: TimetableEntry[] = rawEntries ? rawEntries.map(mapApiEntry) : entries;

      if (freshEntries.length === 0) {
        toast.error("No timetable entries to export");
        return;
      }

      let filteredForExport = freshEntries;
      if (filterClass) filteredForExport = filteredForExport.filter(e => e.classId === filterClass);
      if (filterTeacher) filteredForExport = filteredForExport.filter(e => e.teacherId === filterTeacher);

      const uniqueClasses = dedupeClassesByName(classes);
      const grid = buildPdfGrid(filteredForExport, uniqueClasses, schedule, scheduleDays);

      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '-9999px';
      container.style.width = '1100px';
      container.style.backgroundColor = 'white';
      container.style.padding = '20px';
      container.style.zIndex = '9999';
      document.body.appendChild(container);

      let filterLabel = "";
      if (filterClass) {
        const cls = classes.find(c => c._id === filterClass);
        filterLabel = cls ? ` - ${cls.department ? `${cls.className} ${cls.department}` : cls.className}` : "";
      } else if (filterTeacher) {
        const teacher = teachers.find(t => t._id === filterTeacher);
        filterLabel = teacher ? ` - ${teacher.name}` : "";
      }

      let htmlContent = `
        <div style="font-family: Arial, sans-serif; background: white; padding: 10px;">
          <div style="text-align: center; margin-bottom: 10px; border-bottom: 2px solid #0b5321; padding-bottom: 8px;">
            <h2 style="font-size: 18px; margin: 0; color: #0b5321; font-weight: 800;">MA NDUM FAVOURED EVENING SECONDARY SCHOOL</h2>
            <p style="font-size: 11px; color: #666; margin: 3px 0;">Timetable • ${academicYear}${filterLabel}</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background: #0b5321; color: white;">
                <th style="padding: 6px 8px; text-align: left; border: 1px solid #0b5321; font-size: 10px; text-transform: uppercase; font-weight: 700;">Day</th>
                <th style="padding: 6px 8px; text-align: left; border: 1px solid #0b5321; font-size: 10px; text-transform: uppercase; font-weight: 700;">Period</th>
                ${uniqueClasses.map((c) => `
                  <th style="padding: 6px 8px; text-align: center; border: 1px solid #0b5321; font-size: 10px; text-transform: uppercase; font-weight: 700;">${c.department ? `${c.className} ${c.department}` : c.className}</th>
                `).join('')}
                <th style="padding: 6px 8px; text-align: left; border: 1px solid #0b5321; font-size: 10px; text-transform: uppercase; font-weight: 700;">Time</th>
              </tr>
            </thead>
            <tbody>
      `;

      grid.forEach((row, index) => {
        const isFirstOfDay = index === 0 || grid[index - 1].day !== row.day;
        const dayRowspan = grid.filter((r) => r.day === row.day).length;

        htmlContent += `
          <tr>
            ${isFirstOfDay ? `
              <td style="padding: 6px 8px; font-weight: 600; text-align: center; vertical-align: middle; border: 1px solid #ddd; background: #faf5e8;" rowspan="${dayRowspan}">
                ${row.day}
              </td>
            ` : ''}
            <td style="padding: 6px 8px; text-align: center; font-weight: 600; font-family: monospace; border: 1px solid #000000;">
              ${row.period}
            </td>
            ${uniqueClasses.map((c) => {
          const cell = row.cells[c._id];
          return `
                <td style="padding: 6px 8px; text-align: center; border: 1px solid #000000;">
                  ${cell ? `
                    <div style="font-weight: 500; font-size: ${cell.subjectName.includes('/') ? '10px' : '11px'};">${cell.subjectName}</div>
                    <div style="font-size: 9px; color: #666;">${cell.teacherName}</div>
                    ${cell.room ? `<div style="font-size: 8px; color: #999;">${cell.room}</div>` : ''}
                  ` : '<span style="color: #ccc;">—</span>'}
                </td>
              `;
        }).join('')}
            <td style="padding: 6px 8px; text-align: center; font-size: 10px; border: 1px solid #ddd; white-space: nowrap;">
              ${row.duration.split(" - ").map(formatEnglishTime).join(" - ")}
            </td>
          </tr>
        `;
      });

      htmlContent += `
            </tbody>
          </table>
          <div style="text-align: center; margin-top: 8px; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 6px;">
            Generated: ${new Date().toLocaleString()}
          </div>
        </div>
      `;

      container.innerHTML = htmlContent;
      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: container.scrollWidth,
        height: container.scrollHeight,
        onclone: (_doc, element) => flattenUnsupportedColors(element),
      });

      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const imgWidth = usableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight <= usableHeight) {
        pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, imgHeight);
      } else {
        let remainingHeight = imgHeight;
        let offset = 0;
        let isFirstPage = true;
        while (remainingHeight > 0) {
          if (!isFirstPage) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', margin, margin - offset, imgWidth, imgHeight);
          remainingHeight -= usableHeight;
          offset += usableHeight;
          isFirstPage = false;
        }
      }

      document.body.removeChild(container);
      pdf.save(`timetable_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("Timetable PDF downloaded");
    } catch (error) {
      console.error("Error downloading timetable PDF:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to download PDF: ${message}`);
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [entries, classes, teachers, filterClass, filterTeacher, academicYear, schedule, scheduleDays]);

  // ============================================
  // PDF DOWNLOAD - MATRIX FORMAT
  // ============================================

  const downloadMatrixPDF = useCallback(async () => {
    setIsDownloadingPdf(true);
    try {
      const res = await axios.get(`${API_BASE}/timetable`).catch(() => null);
      const rawEntries = res?.data?.success ? res.data.data : null;
      const freshEntries: TimetableEntry[] = rawEntries ? rawEntries.map(mapApiEntry) : entries;

      if (freshEntries.length === 0) {
        toast.error("No timetable entries to export");
        return;
      }

      let filteredForExport = freshEntries;
      if (filterClass) filteredForExport = filteredForExport.filter(e => e.classId === filterClass);
      if (filterTeacher) filteredForExport = filteredForExport.filter(e => e.teacherId === filterTeacher);

      const classIds = new Set(filteredForExport.map(e => e.classId));
      const uniqueClasses = classes.filter(c => classIds.has(c._id));

      const { matrix, days, timeSlots, labels } = buildMatrixTimetable(filteredForExport, uniqueClasses, schedule, scheduleDays);

      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '-9999px';
      container.style.width = '1100px';
      container.style.backgroundColor = 'white';
      container.style.padding = '30px 20px';
      container.style.zIndex = '9999';
      document.body.appendChild(container);

      const classNames = uniqueClasses.map(c =>
        c.department ? `${c.className} ${c.department}` : c.className
      ).join(', ');

      let filterLabel = "";
      if (filterClass) {
        const cls = classes.find(c => c._id === filterClass);
        filterLabel = cls ? ` - ${cls.department ? `${cls.className} ${cls.department}` : cls.className}` : "";
      } else if (filterTeacher) {
        const teacher = teachers.find(t => t._id === filterTeacher);
        filterLabel = teacher ? ` - ${teacher.name}` : "";
      } else {
        filterLabel = classNames ? ` - ${classNames}` : "";
      }

      let htmlContent = `
        <div style="font-family: Arial, sans-serif; background: white; padding: 10px;">
          <div style="text-align: center; margin-bottom: 15px; border-bottom: 3px solid #000000; padding-bottom: 12px;">
            <h1 style="font-size: 20px; margin: 0; color: #000000; font-weight: 800; letter-spacing: 1px;">MA NDUM FAVOURED EVENING SECONDARY SCHOOL</h1>
            <p style="font-size: 13px; color: #666; margin: 4px 0 0 0;">TIMETABLE • ${academicYear}</p>
            <p style="font-size: 12px; color: #888; margin: 2px 0 0 0;">Classes: ${classNames || 'All Classes'}</p>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 2px solid #000000;">
            <thead>
              <tr style="background: #000000; color: white;">
                <th style="padding: 10px 12px; text-align: center; border: 1px solid #ccc; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; min-width: 100px;">
                  TIME
                </th>
                ${days.map((day: string) => `
                  <th style="padding: 10px 12px; text-align: center; border: 1px solid #25231e; font-size: 11px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; min-width: 100px;">
                    ${day}
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
      `;

      const matrixLabels = labels;

      timeSlots.forEach((slot: any, idx: number) => {
        const label = matrixLabels[idx] || slot.label;
        const rowBg = idx % 2 === 0 ? 'background: #fafafa;' : 'background: white;';

        htmlContent += `
          <tr style="${rowBg}">
            <td style="padding: 10px 12px; text-align: center; border: 1px solid #000000; font-weight: 700; font-size: 12px;">
              <div style="font-size: 13px; font-weight: 800;">${label}</div>
              <div style="font-size: 9px; color: #000000; font-weight: 400;">${formatEnglishTime(slot.start)} - ${formatEnglishTime(slot.end)}</div>
            </td>
            ${days.map((day: string) => {
          const slotData = matrix[day]?.[slot.start];
          if (!slotData || slotData.entries.length === 0) {
            return `<td style="padding: 10px 12px; text-align: center; border: 1px solid #000000;">
                  <span style="color: #000000; font-size: 14px;">-</span>
                </td>`;
          }

          const entriesHtml = slotData.entries.map((entry: any) => {
            const classObj = classes.find(c => c._id === entry.classId);
            const fullClassName = classObj?.department ? `${classObj.className} ${classObj.department}` : entry.className;

            return `
                  <div style="padding: 4px 0; last-child: border-bottom: none;">
                    <div style="font-weight: 600; font-size: ${entry.subjectName.includes('/') ? '11px' : '12px'}; color: #1a1a1a;">${entry.subjectName}</div>
                    <div style="font-size: 9px; color: #000000; margin-top: 1px;">${entry.teacherName}</div>
                  </div>
                `;
          }).join('');

          return `<td style="padding: 6px 8px; text-align: center; border: 1px solid #000000; vertical-align: middle;">
                ${entriesHtml}
              </td>`;
        }).join('')}
          </tr>
        `;
      });

      htmlContent += `
            </tbody>
          </table>

          <div style="text-align: center; margin-top: 12px; font-size: 9px; color: #000000; border-top: 1px solid #000000; padding-top: 10px;">
            <span>Generated: ${new Date().toLocaleString()}</span>
            <span style="margin: 0 15px;">|</span>
            <span>MA NDUM FAVOURED EVENING SECONDARY SCHOOL</span>
            <span style="margin: 0 15px;">|</span>
            <span>Page 1 of 1</span>
          </div>
        </div>
      `;

      container.innerHTML = htmlContent;
      await new Promise(resolve => setTimeout(resolve, 400));

      const canvas = await html2canvas(container, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: container.scrollWidth,
        height: container.scrollHeight,
        onclone: (_doc, element) => flattenUnsupportedColors(element),
      });

      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const imgWidth = usableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      if (imgHeight <= usableHeight) {
        const yOffset = (usableHeight - imgHeight) / 2;
        pdf.addImage(imgData, 'JPEG', margin, margin + yOffset, imgWidth, imgHeight);
      } else {
        let remainingHeight = imgHeight;
        let offset = 0;
        let isFirstPage = true;
        while (remainingHeight > 0) {
          if (!isFirstPage) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', margin, margin - offset, imgWidth, imgHeight);
          remainingHeight -= usableHeight;
          offset += usableHeight;
          isFirstPage = false;
        }
      }

      document.body.removeChild(container);
      pdf.save(`timetable_matrix_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("Matrix timetable PDF downloaded");
    } catch (error) {
      console.error("Error downloading matrix PDF:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to download PDF: ${message}`);
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [entries, classes, teachers, filterClass, filterTeacher, academicYear, schedule, scheduleDays]);

  const downloadClassReportsPDF = useCallback(async () => {
    setIsDownloadingPdf(true);
    let container: HTMLDivElement | null = null;
    try {
      const res = await axios.get(`${API_BASE}/timetable`).catch(() => null);
      const rawEntries = res?.data?.success ? res.data.data : null;
      const freshEntries: TimetableEntry[] = rawEntries ? rawEntries.map(mapApiEntry) : entries;
      const filteredEntries = freshEntries.filter((entry) =>
        (!filterClass || entry.classId === filterClass) &&
        (!filterTeacher || entry.teacherId === filterTeacher)
      );

      if (filteredEntries.length === 0) {
        toast.error("No timetable entries to export");
        return;
      }

      const classMap = new Map<string, { className: string; entries: TimetableEntry[] }>();
      filteredEntries.forEach((entry) => {
        const classItem = classes.find((item) => item._id === entry.classId);
        const className = getClassDisplayName(classItem, entry.className);
        const current = classMap.get(entry.classId) || { className, entries: [] };
        current.entries.push(entry);
        classMap.set(entry.classId, current);
      });

      container = document.createElement("div");
      container.style.position = "fixed";
      container.style.top = "0";
      container.style.left = "-9999px";
      container.style.width = "1100px";
      container.style.backgroundColor = "white";
      container.style.padding = "20px";
      document.body.appendChild(container);

      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;

      let pageIndex = 0;
      for (const report of classMap.values()) {
        const combinedEntries = combineMultiSubjectEntries(report.entries);
        const cells = new Map<string, TimetableEntry>();
        combinedEntries.forEach((entry) => cells.set(`${entry.day}|${entry.startTime}`, entry));

        container.innerHTML = `
          <div style="font-family: Arial, sans-serif; background: white; padding: 10px;">
            <div style="text-align: center; margin-bottom: 10px; border-bottom: 2px solid #000; padding-bottom: 8px;">
              <h2 style="font-size: 18px; margin: 0; color: #000; font-weight: 800;">MA NDUM FAVOURED EVENING SECONDARY SCHOOL</h2>
              <p style="font-size: 14px; font-weight: 700; color: #000; margin: 4px 0;">CLASS TIMETABLE: ${report.className}</p>
              <p style="font-size: 11px; color: #000; margin: 3px 0;">Academic Year ${academicYear}</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; border: 2px solid #000;">
              <thead><tr style="background: #000; color: white;">
                <th style="padding: 7px; border: 1px solid #000;">Period</th>
                <th style="padding: 7px; border: 1px solid #000;">Time</th>
                ${scheduleDays.map((day) => `<th style="padding: 7px; border: 1px solid #000;">${day}</th>`).join("")}
              </tr></thead>
              <tbody>
                ${schedule.map((slot) =>
          `<tr><td style="padding:7px; text-align:center; border:1px solid #000; font-weight:700;">${slot.label}</td><td style="padding:7px; text-align:center; border:1px solid #000; white-space:nowrap;">${formatEnglishTime(slot.start)} - ${formatEnglishTime(slot.end)}</td>${scheduleDays.map((day) => {
            const entry = cells.get(`${day}|${slot.start}`);
            return `<td style="padding:7px; text-align:center; border:1px solid #000;">${entry ? `<strong>${entry.subjectName}</strong><br><small>${entry.teacherName}</small>` : "-"}</td>`;
          }).join("")}</tr>`
        ).join("")}
              </tbody>
            </table>
            <div style="text-align:center; margin-top:8px; font-size:9px; color:#666;">Generated: ${new Date().toLocaleString()} | Report ${pageIndex + 1} of ${classMap.size}</div>
          </div>`;

        await new Promise((resolve) => setTimeout(resolve, 100));
        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          width: container.scrollWidth,
          height: container.scrollHeight,
          onclone: (_doc, element) => flattenUnsupportedColors(element),
        });
        if (pageIndex > 0) pdf.addPage();
        const imgWidth = pageWidth - margin * 2;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", margin, margin, imgWidth, Math.min(imgHeight, pageHeight - margin * 2));
        pageIndex += 1;
      }

      pdf.save(`class_timetables_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success(`${classMap.size} class timetable report(s) downloaded`);
    } catch (error) {
      console.error("Error downloading class timetable reports:", error);
      toast.error(`Failed to download class reports: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      if (container?.parentNode) container.parentNode.removeChild(container);
      setIsDownloadingPdf(false);
    }
  }, [entries, classes, filterClass, filterTeacher, academicYear, schedule, scheduleDays]);

  // ============================================
  // PDF DOWNLOAD - PAGINATED
  // ============================================

  const downloadPaginatedPDF = useCallback(async () => {
    setIsDownloadingPdf(true);
    try {
      const res = await axios.get(`${API_BASE}/timetable`).catch(() => null);
      const rawEntries = res?.data?.success ? res.data.data : null;
      const freshEntries: TimetableEntry[] = rawEntries ? rawEntries.map(mapApiEntry) : entries;

      if (freshEntries.length === 0) {
        toast.error("No timetable entries to export");
        return;
      }

      let filteredForExport = freshEntries;
      if (filterClass) filteredForExport = filteredForExport.filter(e => e.classId === filterClass);
      if (filterTeacher) filteredForExport = filteredForExport.filter(e => e.teacherId === filterTeacher);

      if (filteredForExport.length === 0) {
        toast.error("No entries found for the selected filter");
        return;
      }

      const classNamesSet = new Set<string>();
      filteredForExport.forEach(e => {
        classNamesSet.add(e.className);
      });
      const uniqueClassNames = Array.from(classNamesSet).sort();

      const pageGrids = buildPaginatedPdfGrids(filteredForExport, schedule, scheduleDays);

      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '-9999px';
      container.style.width = '1100px';
      container.style.backgroundColor = 'white';
      container.style.padding = '20px';
      container.style.zIndex = '9999';
      document.body.appendChild(container);

      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;

      const classNamesHeader = uniqueClassNames.join(', ');

      let filterLabel = "";
      if (filterClass) {
        const cls = classes.find(c => c._id === filterClass);
        filterLabel = cls ? ` - ${cls.className}` : "";
      } else if (filterTeacher) {
        const teacher = teachers.find(t => t._id === filterTeacher);
        filterLabel = teacher ? ` - ${teacher.name}` : "";
      } else {
        filterLabel = classNamesHeader ? ` - ${classNamesHeader}` : "";
      }

      for (let pageIndex = 0; pageIndex < pageGrids.length; pageIndex++) {
        const gridRows = pageGrids[pageIndex].rows;
        const pageLabel = pageGrids[pageIndex].label;

        const pageClassNames = new Set<string>();
        gridRows.forEach(row => {
          Object.keys(row.cells).forEach(cls => pageClassNames.add(cls));
        });
        const pageClassList = Array.from(pageClassNames).sort();

        let htmlContent = `
          <div style="font-family: Arial, sans-serif; background: white; padding: 10px;">
            <div style="text-align: center; margin-bottom: 10px; border-bottom: 2px solid #000000; padding-bottom: 8px;">
              <h2 style="font-size: 18px; margin: 0; color: #000000; font-weight: 800;">MA NDUM FAVOURED EVENING SECONDARY SCHOOL</h2>
              <p style="font-size: 11px; font-weight:bold; color: #000000; margin: 3px 0;">Timetable • ${academicYear}${filterLabel} • ${pageLabel}</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <thead>
                <tr style="background: #000000; color: white;">
                  <th style="padding: 6px 8px; text-align: left; border: 1px solid #000000; font-size: 10px; text-transform: uppercase; font-weight: 700;">Day</th>
                    ${pageClassList.map((classId) => `
                    <th style="padding: 6px 8px; text-align: center; border: 1px solid #000000; font-size: 10px; text-transform: uppercase; font-weight: 700;">${getClassDisplayName(classes.find((classItem) => classItem._id === classId), classId)}</th>
                  `).join('')}
                  <th style="padding: 6px 8px; text-align: left; border: 1px solid #000000; font-size: 10px; text-transform: uppercase; font-weight: 700;">Time</th>
                </tr>
              </thead>
              <tbody>
        `;

        gridRows.forEach((row, index) => {
          const isFirstOfDay = index === 0 || gridRows[index - 1].day !== row.day;
          const dayRowspan = gridRows.filter((r) => r.day === row.day).length;

          htmlContent += `
            <tr>
              ${isFirstOfDay ? `
                <td style="padding: 6px 8px; font-weight: 600; text-align: center; vertical-align: middle; font-weight:bold; border: 1px solid #000000; background: #faf5e8;" rowspan="${dayRowspan}">
                  ${row.day}
                </td>
              ` : ''}

              ${pageClassList.map((classId) => {
            const cell = row.cells[classId];
            return `
                  <td style="padding: 6px 8px; text-align: center; border: 1px solid #000000;">
                    ${cell ? `
                      <div style="font-weight: 500; font-size: ${cell.subjectName.includes('/') ? '10px' : '11px'};">${cell.subjectName}</div>
                      <div style="font-size: 9px; color: #000000; font-weight: bold;">${cell.teacherName}</div>
                    ` : '<span style="color: #000000;">—</span>'}
                  </td>
                `;
          }).join('')}
              <td style="padding: 6px 8px; text-align: center; font-size: 10px; border: 1px solid #000000; white-space: nowrap;">
                ${row.duration.split(" - ").map(formatEnglishTime).join(" - ")}
              </td>
            </tr>
          `;
        });

        htmlContent += `
              </tbody>
            </table>
            <div style="text-align: center; margin-top: 8px; font-size: 9px; color: #999; border-top: 1px solid #eee; padding-top: 6px;">
              Generated: ${new Date().toLocaleString()} • Page ${pageIndex + 1} of ${pageGrids.length}
            </div>
          </div>
        `;

        container.innerHTML = htmlContent;
        await new Promise(resolve => setTimeout(resolve, 300));

        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          width: container.scrollWidth,
          height: container.scrollHeight,
          onclone: (_doc, element) => flattenUnsupportedColors(element),
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgWidth = usableWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (pageIndex > 0) pdf.addPage();
        pdf.addImage(imgData, 'JPEG', margin, margin, imgWidth, Math.min(imgHeight, usableHeight));
      }

      document.body.removeChild(container);
      pdf.save(`timetable_paginated_${new Date().toISOString().split('T')[0]}.pdf`);
      toast.success("Paginated timetable PDF downloaded");
    } catch (error) {
      console.error("Error downloading paginated PDF:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to download PDF: ${message}`);
    } finally {
      setIsDownloadingPdf(false);
    }
  }, [entries, classes, teachers, filterClass, filterTeacher, academicYear, schedule, scheduleDays]);

  // ============================================
  // RENDER
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[600px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-black/60 font-medium">Loading timetable...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {apiError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800 flex items-center gap-2">
          <AlertCircle className="size-4" />
          {apiError}
        </div>
      )}
      {!isOnline && !apiError && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800 flex items-center gap-2">
          <AlertCircle className="size-4" />
          Offline mode - Changes are saved locally
        </div>
      )}
      {isSaving && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800 flex items-center gap-2">
          <RefreshCw className="size-4 animate-spin" />
          Saving...
        </div>
      )}

      {/* Conflict report from the last auto-generation, with one-click repair */}
      {generateConflicts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-800">
                  {totalMissingPeriods} period{totalMissingPeriods === 1 ? "" : "s"} could not be scheduled
                </p>
                <p className="text-xs text-red-700 mt-0.5">
                  Fix All Conflicts regenerates the week and fills every slot a qualified teacher can cover — never
                  putting a teacher in a subject they don't teach. The gaps below tell you exactly what to change.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleRepairTimetable}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-all shadow-sm"
              >
                <RefreshCw className={`size-4 ${isGenerating ? "animate-spin" : ""}`} />
                {isGenerating ? "Fixing conflicts..." : "Fix All Conflicts"}
              </button>
              <button
                onClick={() => {
                  setGenerateConflicts([]);
                  saveToLocalStorage("conflicts", []);
                }}
                disabled={isGenerating}
                className="px-3 py-2 rounded-lg border border-red-200 text-red-700 text-sm font-medium hover:bg-red-100 disabled:opacity-50 transition-all"
              >
                Dismiss
              </button>
            </div>
          </div>

          {conflictGroups.map((group) => (
            <div key={group.key} className="bg-white/80 border border-red-100 rounded-lg p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-bold text-red-800">
                  {group.subjectName}: {group.missing} period{group.missing === 1 ? "" : "s"} missing
                </p>
                <p className="text-[11px] text-red-600">
                  {group.classNames.length} class{group.classNames.length === 1 ? "" : "es"} —{" "}
                  {group.classNames.join(", ")}
                </p>
              </div>
              <p className="text-xs text-red-700 mt-1">
                Taught by:{" "}
                {group.qualifiedTeacherNames.length > 0
                  ? group.qualifiedTeacherNames.join(", ")
                  : "nobody yet"}
                {typeof group.qualifiedTeacherSlots === "number" &&
                typeof group.subjectWeeklyDemand === "number"
                  ? ` · ${group.qualifiedTeacherSlots} qualified slots/week vs ${group.subjectWeeklyDemand} requested`
                  : ""}
              </p>
              {group.suggestions.length > 0 && (
                <ol className="mt-2 space-y-1">
                  {group.suggestions.map((s, i) => (
                    <li
                      key={i}
                      className="text-xs font-medium text-red-800 bg-red-50 border border-red-100 rounded-md px-2 py-1.5"
                    >
                      <span className="font-bold">{i + 1}.</span> {s}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight flex items-center gap-3">
            <Calendar className="size-8 text-brand" />
            Timetable Management
          </h1>
          <p className="text-sm text-black/60 mt-1">
            {entries.length} periods scheduled • {stats.totalTeachers} teachers • {stats.totalClasses} classes
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={filterClass}
            onChange={(e) => {
              setFilterClass(e.target.value);
              setFilterTeacher("");
            }}
            className="px-3 py-2 rounded-xl border border-stone-200 bg-white text-sm font-medium min-w-[140px]"
          >
            <option value="">All Classes</option>
            {uniqueClasses.map((c) => (
              <option key={c._id} value={c._id}>
                {c.department ? `${c.className} ${c.department}` : c.className}
              </option>
            ))}
          </select>

          <select
            value={filterTeacher}
            onChange={(e) => {
              setFilterTeacher(e.target.value);
              setFilterClass("");
            }}
            className="px-3 py-2 rounded-xl border border-stone-200 bg-white text-sm font-medium min-w-[140px]"
          >
            <option value="">All Teachers</option>
            {teachers.map((t) => (
              <option key={t._id} value={t._id}>{t.name}</option>
            ))}
          </select>

          <button
            onClick={() => setShowBulkModal(true)}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-brand/20 text-brand text-sm font-semibold hover:bg-brand/5 transition-all disabled:opacity-50"
          >
            <Upload className="size-4" /> Bulk Add
          </button>
          <button
            onClick={() => setShowCopyModal(true)}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-brand/20 text-brand text-sm font-semibold hover:bg-brand/5 transition-all disabled:opacity-50"
          >
            <Copy className="size-4" /> Copy Year
          </button>
          <button
            onClick={() => setShowSetupWizard(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-50 transition-all"
          >
            <Calendar className="size-4" /> Auto-Generate
          </button>
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-brand/20 text-brand text-sm font-semibold hover:bg-brand/5 transition-all"
          >
            <Settings className="size-4" /> School Settings
          </button>
          <button
            onClick={() => setShowSubjectsModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-brand/20 text-brand text-sm font-semibold hover:bg-brand/5 transition-all"
          >
            <BookOpen className="size-4" /> Subjects & Periods
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-stone-200 text-sm font-semibold hover:bg-stone-50 transition-all"
          >
            <FileSpreadsheet className="size-4" /> Export CSV
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-stone-200 text-sm font-semibold hover:bg-stone-50 transition-all"
          >
            <Printer className="size-4" /> Print
          </button>

          <div className="relative group">
            <button
              onClick={downloadStandardPDF}
              disabled={isDownloadingPdf}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-all disabled:opacity-50 shadow-lg shadow-brand/20"
            >
              {isDownloadingPdf ? <span className="animate-spin"><Download className="size-4" /></span> : <Download className="size-4" />}
              {isDownloadingPdf ? "Generating..." : "Download PDF"}
            </button>
            <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl border border-stone-200 shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={downloadStandardPDF}
                disabled={isDownloadingPdf}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-stone-50 rounded-t-xl flex items-center gap-2"
              >
                <FileSpreadsheet className="size-4" />
                Standard Format (Day x Class)
              </button>
              <button
                onClick={downloadMatrixPDF}
                disabled={isDownloadingPdf}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-stone-50 flex items-center gap-2"
              >
                <LayoutGrid className="size-4" />
                Matrix Format (Time x Day)
              </button>
              <button
                onClick={downloadPaginatedPDF}
                disabled={isDownloadingPdf}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-stone-50 rounded-b-xl flex items-center gap-2"
              >
                <CalendarDays className="size-4" />
                Paginated (Mon-Wed / Thu-Fri)
              </button>
              <button
                onClick={downloadClassReportsPDF}
                disabled={isDownloadingPdf}
                className="w-full px-4 py-2.5 text-left text-sm hover:bg-stone-50 rounded-b-xl flex items-center gap-2"
              >
                <FileSpreadsheet className="size-4" />
                One Report Per Class
              </button>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-all shadow-lg shadow-brand/20 disabled:opacity-50"
          >
            <Plus className="size-4" /> Add Period
          </button>
        </div>
      </div>

      {(filterClass || filterTeacher) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800 flex items-center justify-between">
          <span>
            {filterClass && `Viewing: ${classes.find(c => c._id === filterClass)?.department ? `${classes.find(c => c._id === filterClass)?.className} ${classes.find(c => c._id === filterClass)?.department}` : classes.find(c => c._id === filterClass)?.className || 'Class'}`}
            {filterTeacher && `Viewing: ${teachers.find(t => t._id === filterTeacher)?.name || 'Teacher'}`}
          </span>
          <button onClick={clearFilters} className="text-blue-600 hover:text-blue-800 font-medium">
            <X className="size-4 inline" /> Clear Filter
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total Periods" value={filteredEntries.length} />
        <StatCard label="Teachers" value={stats.totalTeachers} />
        <StatCard label="Classes" value={stats.totalClasses} />
        <StatCard label="1st Cycle" value={stats.firstCyclePeriods} valueClassName="text-blue-600" />
        <StatCard label="2nd Cycle" value={stats.secondCyclePeriods} valueClassName="text-purple-600" />
        <div className="bg-white rounded-2xl border border-brand/20 p-4 bg-brand/5">
          <p className="text-xs text-brand/60 font-medium uppercase tracking-wider">Potential Revenue</p>
          <p className="text-2xl font-bold text-brand mt-1">{stats.totalPotential.toLocaleString()} FRS</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/40" />
          <input
            type="text"
            placeholder="Search by teacher, class, subject..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black/70"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <select
          value={selectedTeacher}
          onChange={(e) => setSelectedTeacher(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand min-w-[150px]"
        >
          <option value="">All Teachers</option>
          {teachers.map((t) => (
            <option key={t._id} value={t._id}>{t.name}</option>
          ))}
        </select>

        <select
          value={selectedClass}
          onChange={(e) => setSelectedClass(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand min-w-[150px]"
        >
          <option value="">All Classes</option>
          {uniqueClasses.map((c) => (
            <option key={c._id} value={c._id}>
              {c.department ? `${c.className} ${c.department}` : c.className}
            </option>
          ))}
        </select>

        <select
          value={selectedDay}
          onChange={(e) => setSelectedDay(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand min-w-[130px]"
        >
          <option value="">All Days</option>
          {DAYS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <select
          value={selectedCycle}
          onChange={(e) => setSelectedCycle(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand min-w-[130px]"
        >
          <option value="">All Cycles</option>
          <option value="first">1st Cycle</option>
          <option value="second">2nd Cycle</option>
        </select>

        <div className="flex gap-1 border border-stone-200 rounded-xl p-1">
          <button
            onClick={() => setViewMode("table")}
            className={`p-2 rounded-lg transition ${viewMode === "table" ? "bg-brand text-white" : "hover:bg-stone-100"}`}
          >
            <List className="size-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 rounded-lg transition ${viewMode === "grid" ? "bg-brand text-white" : "hover:bg-stone-100"}`}
          >
            <Grid className="size-4" />
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`p-2 rounded-lg transition ${viewMode === "calendar" ? "bg-brand text-white" : "hover:bg-stone-100"}`}
          >
            <CalendarDays className="size-4" />
          </button>
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm hover:bg-stone-50 transition whitespace-nowrap"
          >
            <X className="size-4 inline mr-1" /> Clear
          </button>
        )}
      </div>

      {viewMode === "table" && (
        <TableView
          entries={combineMultiSubjectEntries(filteredEntries)}
          onEdit={handleEditRequest}
          onDelete={handleDeleteEntry}
          canEdit={true}
        />
      )}
      {viewMode === "grid" && (
        <GridView
          entries={combineMultiSubjectEntries(filteredEntries)}
          onEdit={handleEditRequest}
          onDelete={handleDeleteEntry}
        />
      )}
      {viewMode === "calendar" && (
        <CalendarView
          entries={combineMultiSubjectEntries(filteredEntries)}
          onEdit={handleEditRequest}
          schedule={schedule}
          days={scheduleDays}
        />
      )}

      {(showAddModal || editingEntry) && (
        <TimetableEntryModal
          initial={
            editingEntry || {
              id: `entry_${Date.now()}`,
              teacherId: "",
              teacherName: "",
              classId: "",
              className: "",
              subjectId: "",
              subjectName: "",
              subjectCode: "",
              day: "Monday",
              startTime: "08:00",
              endTime: "09:00",
              periodNumber: 1,
              cycle: "first",
              ratePerPeriod: CYCLE_RATES.first,
              room: "",
              academicYear: academicYear,
              isActive: true,
            }
          }
          teachers={teachers}
          classes={classes}
          subjects={subjects}
          onSave={handleSaveEntry}
          onCancel={closeEntryModal}
        />
      )}

      {showBulkModal && (
        <BulkAddModal
          teachers={teachers}
          classes={classes}
          subjects={subjects}
          onSave={handleBulkAdd}
          onCancel={() => setShowBulkModal(false)}
        />
      )}

      {showCopyModal && (
        <CopyYearModal currentYear={academicYear} onCopy={handleCopyFromPrevious} onCancel={() => setShowCopyModal(false)} />
      )}

      {showSetupWizard && (
        <SetupWizard
          teachers={activeTeachers}
          subjects={subjects}
          classes={classes}
          schoolSettings={schoolSettings}
          isGenerating={isGenerating}
          generateConflicts={generateConflicts}
          onSaveTeacherAvailability={saveTeacherAvailability}
          onSaveSchoolSettings={saveSchoolSettings}
          onGenerate={handleGenerateTimetable}
          onRepair={handleRepairTimetable}
          onCancel={() => setShowSetupWizard(false)}
        />
      )}

      {showSettingsModal && (
        <SchoolSettingsModal
          settings={schoolSettings}
          academicYear={academicYear}
          onSave={saveSchoolSettings}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {showSubjectsModal && (
        <SubjectsManagerModal
          subjects={subjects}
          classes={classes}
          teachers={activeTeachers}
          onSaved={refreshSubjects}
          onClose={() => setShowSubjectsModal(false)}
        />
      )}
    </div>
  );
}

// ============================================
// TABLE VIEW
// ============================================

const TableView = memo(function TableView({
  entries,
  onEdit,
  onDelete,
  canEdit,
}: {
  entries: TimetableEntry[];
  onEdit: (entry: TimetableEntry) => void;
  onDelete: (id: string) => void;
  canEdit: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="px-4 py-3 text-left text-xs font-bold text-black/50 uppercase tracking-wider">#</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-black/50 uppercase tracking-wider">Day</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-black/50 uppercase tracking-wider">Time</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-black/50 uppercase tracking-wider">Teacher</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-black/50 uppercase tracking-wider">Class</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-black/50 uppercase tracking-wider">Subject</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-black/50 uppercase tracking-wider">Cycle</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-black/50 uppercase tracking-wider">Rate</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-black/50 uppercase tracking-wider">Room</th>
              {canEdit && <th className="px-4 py-3 text-right text-xs font-bold text-black/50 uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 10 : 9} className="px-4 py-12 text-center text-black/40">
                  <CalendarDays className="size-12 mx-auto text-black/20 mb-3" />
                  <p>No timetable entries found</p>
                  <p className="text-sm">Try adjusting your filters or add a new entry</p>
                </td>
              </tr>
            ) : (
              entries.map((entry, index) => (
                <tr key={entry.id} className="border-b border-stone-100 hover:bg-stone-50 transition">
                  <td className="px-4 py-3 text-sm text-black/40">{index + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium">{entry.day}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-1">
                      <Clock className="size-3 text-black/40" />
                      {entry.startTime} - {entry.endTime}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{entry.teacherName}</td>
                  <td className="px-4 py-3 text-sm">{entry.className}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-1">
                      {entry.subjectCode && (
                        <span className="text-xs bg-stone-100 px-1.5 py-0.5 rounded font-mono">{entry.subjectCode}</span>
                      )}
                      <span className={entry.subjectName.includes('/') ? 'text-amber-700 font-semibold' : ''}>
                        {entry.subjectName}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <CycleBadge cycle={entry.cycle} />
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-brand">{entry.ratePerPeriod} FRS</td>
                  <td className="px-4 py-3 text-sm">{entry.room || "-"}</td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => onEdit(entry)} className="p-1.5 rounded-lg hover:bg-stone-100 text-black/60 transition">
                          <Pencil className="size-4" />
                        </button>
                        <button onClick={() => onDelete(entry.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {entries.length > 0 && (
        <div className="px-4 py-3 border-t border-stone-200 text-sm text-black/40 flex justify-between items-center">
          <span>Showing {entries.length} entries</span>
          <span>Academic Year: {entries[0]?.academicYear || "2026-2027"}</span>
        </div>
      )}
    </div>
  );
});

// ============================================
// GRID VIEW
// ============================================

const GridView = memo(function GridView({
  entries,
  onEdit,
  onDelete,
}: {
  entries: TimetableEntry[];
  onEdit: (entry: TimetableEntry) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {entries.length === 0 ? (
        <div className="col-span-full text-center py-12">
          <CalendarDays className="size-12 mx-auto text-black/20 mb-3" />
          <p className="text-black/40">No entries found</p>
        </div>
      ) : (
        entries.map((entry) => (
          <div key={entry.id} className="bg-white rounded-2xl border border-stone-200 p-5 hover:shadow-lg transition-all hover:-translate-y-1">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl ${entry.cycle === "first" ? "bg-blue-50" : "bg-purple-50"}`}>
                  <Calendar className={`size-4 ${entry.cycle === "first" ? "text-blue-600" : "text-purple-600"}`} />
                </div>
                <div>
                  <p className="font-bold text-lg">{entry.day}</p>
                  <p className="text-xs text-black/40">{entry.startTime} - {entry.endTime}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => onEdit(entry)} className="p-1.5 rounded-lg hover:bg-stone-100 text-black/60 transition">
                  <Pencil className="size-4" />
                </button>
                <button onClick={() => onDelete(entry.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="size-4 text-black/40" />
                <span className="font-medium">{entry.teacherName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Users className="size-4 text-black/40" />
                <span>{entry.className}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <BookOpen className="size-4 text-black/40" />
                <span className={entry.subjectName.includes('/') ? 'text-amber-700 font-semibold' : ''}>
                  {entry.subjectName}
                </span>
              </div>
              {entry.room && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-black/40">Room:</span>
                  <span>{entry.room}</span>
                </div>
              )}
            </div>

            <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between">
              <CycleBadge cycle={entry.cycle} />
              <span className="font-bold text-brand">{entry.ratePerPeriod} FRS/period</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
});

// ============================================
// Auto-Generate Setup Wizard
// ============================================

// Shape of one entry in the conflict report returned by POST /api/timetable/generate
interface GenerateConflict {
  className?: string;
  subjectName?: string;
  subjectId?: string;
  teacherName?: string | null;
  requestedPeriods?: number;
  placedPeriods?: number;
  missingPeriods?: number;
  reason?: string;
  suggestions?: string[];
  qualifiedTeacherNames?: string[];
  qualifiedTeacherSlots?: number;
  subjectWeeklyDemand?: number;
  subjectShortfall?: number;
}

interface SetupWizardProps {
  teachers: {
    _id: string;
    name: string;
    email?: string;
    qualification?: string;
    subjectIds?: string[];
    classIds?: string[];
    isPermanent?: boolean;
    availableDays?: string[];
  }[];
  subjects: Subject[];
  classes: Class[];
  schoolSettings: SchoolSettings;
  isGenerating: boolean;
  generateConflicts: GenerateConflict[];
  onSaveTeacherAvailability: (teacherId: string, isPermanent: boolean, availableDays: string[]) => Promise<boolean>;
  onSaveSchoolSettings: (settings: Omit<SchoolSettings, "_id">) => Promise<boolean>;
  onGenerate: () => Promise<void>;
  onRepair: () => Promise<void>;
  onCancel: () => void;
}

interface LocalSettings {
  schoolStartTime: string;
  schoolEndTime: string;
  breakStart: string;
  breakEnd: string;
  periodDurationMinutes: number;
  schoolDays: string[];
  periodsPerDay: number;
}

const timeStringToMinutes = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export function SetupWizard({
  teachers,
  subjects,
  classes,
  schoolSettings,
  isGenerating,
  generateConflicts,
  onSaveTeacherAvailability,
  onSaveSchoolSettings,
  onGenerate,
  onRepair,
  onCancel,
}: SetupWizardProps) {
  const [activeTab, setActiveTab] = useState<"teachers" | "schedule" | "generate">("teachers");
  const [teacherState, setTeacherState] = useState<Record<string, { isPermanent: boolean; availableDays: string[] }>>({});
  const [settings, setSettings] = useState<LocalSettings>({
    schoolStartTime: schoolSettings.schoolStartTime || "08:00",
    schoolEndTime: schoolSettings.schoolEndTime || "14:00",
    breakStart: schoolSettings.breakStart || "10:15",
    breakEnd: schoolSettings.breakEnd || "10:30",
    periodDurationMinutes: schoolSettings.periodDurationMinutes || 45,
    schoolDays: (schoolSettings.schoolDays as string[])?.length
      ? (schoolSettings.schoolDays as string[])
      : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    periodsPerDay: schoolSettings.periodsPerDay || 6,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Merge-init: only fill in teachers that have no local state yet, so the
    // optimistic parent update (after each save) never wipes in-progress edits.
    // Teachers with no saved availability config default to "available all
    // days" — otherwise the backend generator (isTeacherAvailable) silently
    // excludes them from every slot.
    setTeacherState((prev) => {
      const next = { ...prev };
      teachers.forEach((t) => {
        if (next[t._id]) return;
        const hasConfig =
          !!t.isPermanent ||
          (Array.isArray(t.availableDays) && t.availableDays.length > 0);
        next[t._id] = hasConfig
          ? {
            isPermanent: !!t.isPermanent,
            availableDays: t.isPermanent ? [...DAYS] : [...(t.availableDays || [])],
          }
          : { isPermanent: true, availableDays: [...DAYS] };
      });
      return next;
    });
  }, [teachers]);

  const set = <K extends keyof LocalSettings>(k: K, v: LocalSettings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  const computedPeriods = useMemo(() => {
    const start = timeStringToMinutes(settings.schoolStartTime);
    const end = timeStringToMinutes(settings.schoolEndTime);
    const dur = settings.periodDurationMinutes;
    let count = 0, cursor = start, periodNum = 1;
    while (cursor + dur <= end && periodNum <= (settings.periodsPerDay || 20)) {
      count += 1;
      periodNum += 1;
      cursor += dur;
    }
    return count;
  }, [settings]);

  // ---- Save handlers ----
  const handleSaveTeacherAvailability = async () => {
    setSaving(true);
    let ok = true;
    // Compare with a stable day order so chip-toggle ordering never causes
    // spurious saves, and genuinely unconfigured teachers always diff.
    const sortDays = (days: string[]) => [...days].sort();
    for (const t of teachers) {
      // Fall back to the wizard default (permanent, all days) instead of
      // skipping — a missing entry must never silently exclude the teacher.
      const ts = teacherState[t._id] || { isPermanent: true, availableDays: [...DAYS] };
      const original = {
        isPermanent: !!t.isPermanent,
        availableDays: Array.isArray(t.availableDays) ? sortDays(t.availableDays) : [],
      };
      const changed =
        ts.isPermanent !== original.isPermanent ||
        JSON.stringify(sortDays(ts.availableDays)) !== JSON.stringify(original.availableDays);
      if (changed) {
        const result = await onSaveTeacherAvailability(t._id, ts.isPermanent, ts.availableDays);
        if (!result) ok = false;
      }
    }
    setSaving(false);
    if (ok) {
      toast.success("Teacher availability saved");
      setActiveTab("schedule");
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    const ok = await onSaveSchoolSettings({
      schoolStartTime: settings.schoolStartTime,
      schoolEndTime: settings.schoolEndTime,
      breakStart: settings.breakStart,
      breakEnd: settings.breakEnd,
      periodDurationMinutes: settings.periodDurationMinutes,
      schoolDays: settings.schoolDays,
      periodsPerDay: settings.periodsPerDay,
    });
    setSaving(false);
    if (ok) {
      toast.success("Schedule settings saved");
      setActiveTab("generate");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-stone-200">
          <h2 className="font-display text-2xl font-bold text-[#121212]">
            Auto-Generate Timetable
          </h2>
          <p className="text-sm text-black/60 mt-1">
            Step 1: Teacher availability. Step 2: School schedule. Step 3: Generate.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-200 px-6 bg-stone-50">
          {(["teachers", "schedule", "generate"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => tab !== "teachers" && setActiveTab(tab)}
              disabled={tab === "teachers" ? false : activeTab === "teachers"}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab
                ? "border-brand text-brand"
                : "border-transparent text-black/40 hover:text-black cursor-pointer"
                }`}
            >
              {tab === "teachers" ? "Teacher Availability" : tab === "schedule" ? "School Schedule" : "Generate"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "teachers" && (
            <TeacherAvailabilityTab
              teachers={teachers}
              teacherState={teacherState}
              setTeacherState={setTeacherState}
              onSave={handleSaveTeacherAvailability}
              saving={saving}
            />
          )}
          {activeTab === "schedule" && (
            <ScheduleSettingsTab
              settings={settings}
              set={set}
              computedPeriods={computedPeriods}
              onSave={handleSaveSettings}
              onBack={() => setActiveTab("teachers")}
              saving={saving}
            />
          )}
          {activeTab === "generate" && (
            <GenerateTab
              teachers={teachers}
              subjects={subjects}
              classes={classes}
              computedPeriods={computedPeriods}
              isGenerating={isGenerating}
              conflicts={generateConflicts}
              onGenerate={onGenerate}
              onRepair={onRepair}
              onBack={() => setActiveTab("schedule")}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 flex justify-end rounded-b-2xl">
          <button
            onClick={onCancel}
            disabled={isGenerating}
            className="px-4 py-2 rounded-xl border border-stone-200 text-sm font-semibold hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Sub-components for the Setup Wizard
// ============================================

function TeacherAvailabilityTab({
  teachers,
  teacherState,
  setTeacherState,
  onSave,
  saving,
}: {
  teachers: SetupWizardProps["teachers"];
  teacherState: Record<string, { isPermanent: boolean; availableDays: string[] }>;
  setTeacherState: React.Dispatch<React.SetStateAction<Record<string, { isPermanent: boolean; availableDays: string[] }>>>;
  onSave: () => void;
  saving: boolean;
}) {
  const toggleDay = (teacherId: string, day: string) => {
    setTeacherState((prev) => {
      // Create the entry if missing so toggles always work, even if the init
      // effect has not run yet — this default matches the row/counter fallback.
      const current = prev[teacherId] || { isPermanent: false, availableDays: [...DAYS] };
      const newAvailable = current.availableDays.includes(day)
        ? current.availableDays.filter((d) => d !== day)
        : [...current.availableDays, day];
      return { ...prev, [teacherId]: { ...current, availableDays: newAvailable } };
    });
  };

  const togglePermanent = (teacherId: string) => {
    setTeacherState((prev) => {
      const current = prev[teacherId] || { isPermanent: true, availableDays: [...DAYS] };
      const makingPermanent = !current.isPermanent;
      return {
        ...prev,
        [teacherId]: {
          isPermanent: makingPermanent,
          // Unticking Permanent pre-checks Mon–Fri so a teacher is never left
          // with zero available days (which reads as "unconfigured" downstream).
          availableDays: makingPermanent ? [...DAYS] : [...DAYS].slice(0, 5),
        },
      };
    });
  };

  // Same fallback as the row rendering below, so the counter can never disagree
  // with what the rows show when teacherState has not been populated yet.
  const permanentCount = teachers.filter(
    (t) => (teacherState[t._id] || { isPermanent: true }).isPermanent
  ).length;
  const customCount = teachers.length - permanentCount;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs text-black/50 font-bold uppercase">
          {teachers.length} teachers found
        </div>
        <div className="text-xs text-black/40 font-medium">
          {permanentCount} permanent • {customCount} custom days
        </div>
      </div>
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
        Teachers with no availability set default to <strong>available all days</strong> so they
        are included in generation. Untick "Permanent" to pick specific days for a teacher.
      </div>
      {teachers.length === 0 ? (
        <p className="text-sm text-black/50">No active teachers found. Add teachers first.</p>
      ) : (
        <div className="space-y-3">
          {teachers.map((teacher) => {
            const ts = teacherState[teacher._id] || { isPermanent: true, availableDays: [...DAYS] };
            const isPerm = ts.isPermanent;
            return (
              <div key={teacher._id} className="border border-stone-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-bold text-sm">{teacher.name}</div>
                    <div className="text-xs text-black/50">{teacher.email}</div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPerm}
                      onChange={() => togglePermanent(teacher._id)}
                      className="w-4 h-4 rounded text-brand focus:ring-brand"
                    />
                    <span className="text-sm font-medium">Permanent (available all days)</span>
                  </label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map((day) => {
                    const checked = isPerm || ts.availableDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => !isPerm && toggleDay(teacher._id, day)}
                        disabled={isPerm}
                        className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${checked ? "bg-brand text-white" : "bg-stone-100 text-black/40 cursor-pointer hover:bg-stone-200"
                          }`}
                      >
                        {day.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="flex justify-end pt-4 border-t border-stone-200">
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save & Continue"}
        </button>
      </div>
    </div>
  );
}

// ============================================
// Sub-component: Schedule settings tab
// ============================================

function ScheduleSettingsTab({
  settings,
  set,
  computedPeriods,
  onSave,
  onBack,
  saving,
}: {
  settings: LocalSettings;
  set: <K extends keyof LocalSettings>(k: K, v: LocalSettings[K]) => void;
  computedPeriods: number;
  onSave: () => void;
  onBack: () => void;
  saving: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <Field label="School Start Time*">
          <input type="time" value={settings.schoolStartTime}
            onChange={(e) => set("schoolStartTime", e.target.value)} className={inputCls} required />
        </Field>
        <Field label="School End Time*">
          <input type="time" value={settings.schoolEndTime}
            onChange={(e) => set("schoolEndTime", e.target.value)} className={inputCls} required />
        </Field>
      </div>
      <div className="space-y-4">
        <Field label="Period Duration (minutes)*">
          <input type="number" min={10} max={120}
            value={settings.periodDurationMinutes}
            onChange={(e) => set("periodDurationMinutes", Math.max(10, Math.min(120, Number(e.target.value))))}
            className={inputCls} required />
        </Field>
        <Field label="Periods Per Day (max 12)*">
          <input type="number" min={1} max={12}
            value={settings.periodsPerDay}
            onChange={(e) => set("periodsPerDay", Math.max(1, Math.min(12, Number(e.target.value))))}
            className={inputCls} required />
        </Field>
        <Field label="School Days*">
          <div className="flex flex-wrap gap-2">
            {DAYS.map((day) => {
              const checked = settings.schoolDays.includes(day);
              return (
                <button key={day} type="button"
                  onClick={() => {
                    const newDays = checked
                      ? settings.schoolDays.filter((d) => d !== day)
                      : [...settings.schoolDays, day];
                    set("schoolDays", newDays);
                  }}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${checked ? "bg-brand text-white" : "bg-stone-100 text-black/40 hover:bg-stone-200"
                    }`}>
                  {day.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Preview">
          <div className="p-3 bg-stone-50 rounded-lg text-sm">
            <div>Periods per day: <strong>{computedPeriods}</strong></div>
            <div className="text-xs text-black/50 mt-1">
              Based on {settings.schoolStartTime}–{settings.schoolEndTime} with {settings.periodDurationMinutes}min periods.
            </div>
          </div>
        </Field>
      </div>
      <div className="md:col-span-2 flex justify-between items-center pt-4 border-t border-stone-200">
        <button
          onClick={onBack}
          className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold hover:bg-stone-50"
        >
          Back
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save & Continue"}
        </button>
      </div>
    </div>
  );
}

// ============================================
// Sub-component: Generate tab
// ============================================

function GenerateTab({
  teachers,
  subjects,
  classes,
  computedPeriods,
  isGenerating,
  conflicts,
  onGenerate,
  onRepair,
  onBack,
}: {
  teachers: SetupWizardProps["teachers"];
  subjects: Subject[];
  classes: Class[];
  computedPeriods: number;
  isGenerating: boolean;
  conflicts: GenerateConflict[];
  onGenerate: () => void;
  onRepair: () => void;
  onBack: () => void;
}) {
  const [showPlan, setShowPlan] = useState(false);

  // Pre-flight check — mirrors the backend generator's eligibility rule
  // (routes/timetable.js): a teacher only gets periods for a (subject, class)
  // pair when the Subject lists that class AND the teacher's subjectIds AND
  // classIds both include the pair. Being "permanent" (Step 1) only makes a
  // teacher AVAILABLE — it never creates assignments.
  const readiness = useMemo(() => {
    return teachers.map((t) => {
      let assignments = 0;
      let weeklyPeriods = 0;
      const tClassIds = (t.classIds || []).map(String);
      const tSubjectIds = (t.subjectIds || []).map(String);
      subjects.forEach((s) => {
        const subjClassIds = (s.classIds || []).map(String);
        classes.forEach((c) => {
          const classId = String(c._id);
          if (!subjClassIds.includes(classId)) return;
          if (!tClassIds.includes(classId)) return;
          if (!tSubjectIds.includes(String(s._id))) return;
          assignments += 1;
          weeklyPeriods += s.periodsByClass?.[classId] ?? s.periodsPerWeek ?? 4;
        });
      });
      return { teacher: t, assignments, weeklyPeriods };
    });
  }, [teachers, subjects, classes]);

  const readyCount = readiness.filter((r) => r.assignments > 0).length;
  const notReady = readiness.filter((r) => r.assignments === 0);

  return (
    <div className="space-y-5 py-4">
      <div className="text-center">
        <div className="size-16 bg-brand/10 rounded-full grid place-items-center mx-auto mb-4">
          <Calendar className="size-8 text-brand" />
        </div>
        <h3 className="font-display text-xl font-bold mb-2">Ready to Generate</h3>
        <p className="text-sm text-black/60 max-w-md mx-auto">
          {readyCount} of {teachers.length} teachers will receive periods, based on their
          subject &amp; class assignments, availability (Step 1) and the school schedule
          (Step 2 — {computedPeriods} periods/day).
        </p>
      </div>

      {notReady.length > 0 && (
        <div className="max-w-2xl mx-auto bg-amber-50 border border-amber-300 rounded-xl p-4">
          <p className="text-sm font-bold text-amber-800 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            {notReady.length} teacher(s) will NOT receive any periods:
          </p>
          <ul className="mt-2 space-y-1.5">
            {notReady.map((r) => (
              <li key={r.teacher._id} className="text-sm text-amber-800">
                <span className="font-semibold">{r.teacher.name}</span> — marked available,
                but no subject/class assignment matches, so the generator has nothing to
                schedule for them. Assign subjects &amp; classes to them first, then regenerate.
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => setShowPlan((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-stone-200 text-sm font-semibold hover:bg-stone-50 transition"
        >
          <span className="flex items-center gap-2">
            <Eye className="size-4 text-brand" />
            View generation plan (periods per teacher)
          </span>
          <ChevronDown className={`size-4 transition-transform ${showPlan ? "rotate-180" : ""}`} />
        </button>
        {showPlan && (
          <div className="mt-2 rounded-xl border border-stone-200 divide-y divide-stone-100 max-h-64 overflow-y-auto">
            {readiness.map((r) => (
              <div key={r.teacher._id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-medium">{r.teacher.name}</span>
                {r.assignments > 0 ? (
                  <span className="text-black/60">
                    {r.assignments} assignment{r.assignments === 1 ? "" : "s"} · ≈{r.weeklyPeriods} periods/week
                  </span>
                ) : (
                  <span className="text-amber-700 font-semibold">No assignments</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {conflicts.length > 0 && (
        <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-xl p-4 text-left">
          <p className="text-sm font-bold text-red-800 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            Last generation saved the timetable but could not place {conflicts.length}{" "}
            subject/class slot{conflicts.length === 1 ? "" : "s"}:
          </p>
          <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {conflicts.map((c, i) => (
              <li key={`${c.className}-${c.subjectName}-${i}`} className="text-xs text-red-700">
                {c.className} — {c.subjectName}
                {c.reason ? `: ${c.reason}` : ""}
              </li>
            ))}
          </ul>
          <div className="mt-3 rounded-lg bg-white/70 border border-red-200 p-3">
            <p className="text-xs font-bold text-red-800">Suggested fixes</p>
            <p className="text-xs text-red-700 mt-1">
              Automatic repair will use other available teachers who teach each subject and fill every free class period.
              Remaining conflicts mean the timetable has more requested periods than available teaching slots or missing subject assignments.
            </p>
            <button
              onClick={() => onRepair()}
              disabled={isGenerating}
              className="mt-3 px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-semibold hover:bg-red-800 disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`size-4 ${isGenerating ? "animate-spin" : ""}`} />
              {isGenerating ? "Fixing timetable..." : "Fix Everything Automatically"}
            </button>
          </div>
          <p className="text-xs text-red-600 mt-2">
            If repair cannot place everything, increase periods/day, reduce subject periods per week, or add the missing teacher assignments.
          </p>
        </div>
      )}

      <ul className="text-left max-w-md mx-auto space-y-2 text-sm text-black/70">
        <li className="flex items-center gap-2">
          <Check className="size-4 text-brand" /> {readyCount} teachers with subject/class
          assignments, scheduled per their availability (Step 1)
        </li>
        <li className="flex items-center gap-2">
          <Check className="size-4 text-brand" /> School schedule — {computedPeriods} periods/day (set in Step 2)
        </li>
        <li className="flex items-center gap-2">
          <Check className="size-4 text-brand" /> Subject-to-class assignments and teacher mappings
        </li>
      </ul>

      <div className="flex gap-3 justify-center pt-2">
        <button
          onClick={onBack}
          className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold hover:bg-stone-50"
        >
          Back
        </button>
        <button
          onClick={() => onGenerate()}
          disabled={isGenerating}
          className="px-6 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="size-4 animate-spin" />
              Generating...
            </>
          ) : (
            "Generate Timetable"
          )}
        </button>
      </div>
    </div>
  );
}

// ============================================
// CALENDAR VIEW
// ============================================

const CalendarView = memo(function CalendarView({
  entries,
  onEdit,
  schedule,
  days,
}: {
  entries: TimetableEntry[];
  onEdit: (entry: TimetableEntry) => void;
  schedule: ScheduleSlot[];
  days: string[];
}) {
  const entriesByDayTime = useMemo(() => {
    const map = new Map<string, TimetableEntry[]>();
    entries.forEach((e) => {
      const key = `${e.day}|${e.startTime}`;
      const bucket = map.get(key);
      if (bucket) bucket.push(e);
      else map.set(key, [e]);
    });
    return map;
  }, [entries]);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-stone-200">
        <h3 className="font-semibold flex items-center gap-2">
          <CalendarDays className="size-5 text-brand" />
          Weekly Calendar View
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="px-2 py-2 text-xs font-bold text-black/40 uppercase tracking-wider w-16">Time</th>
              {days.map((day) => (
                <th key={day} className="px-2 py-2 text-xs font-bold text-black/50 uppercase tracking-wider min-w-[120px]">
                  {day.substring(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {schedule.map((slot) => {
              return (
                <tr key={slot.start} className="border-t border-stone-100">
                  <td className="px-2 py-2 text-xs text-black/40 font-medium text-center">
                    {formatEnglishTime(slot.start)} - {formatEnglishTime(slot.end)}
                  </td>
                  {days.map((day) => {
                    const dayEntries = entries.filter(e =>
                      e.day === day &&
                      e.startTime >= slot.start &&
                      e.endTime <= slot.end
                    );

                    return (
                      <td key={`${day}-${slot.start}`} className="px-1 py-1 min-h-[60px]">
                        {dayEntries.map((entry) => (
                          <div
                            key={entry.id}
                            onClick={() => onEdit(entry)}
                            className={`text-xs p-1.5 rounded-lg cursor-pointer hover:opacity-80 transition ${entry.cycle === "first" ? "bg-blue-50 border border-blue-200" : "bg-purple-50 border border-purple-200"
                              }`}
                          >
                            <div className="font-semibold truncate">{entry.teacherName}</div>
                            <div className={`truncate ${entry.subjectName.includes('/') ? 'text-amber-700 font-bold' : 'text-black/60'}`}>
                              {entry.subjectName}
                            </div>
                            <div className="truncate text-black/40 text-[10px]">{entry.className}</div>
                            <div className="text-[10px] font-bold text-brand mt-0.5">{entry.ratePerPeriod} FRS</div>
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
      <div className="p-3 border-t border-stone-200 flex gap-4 text-xs flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200"></div>
          <span className="text-black/60">1st Cycle</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-100 border border-purple-200"></div>
          <span className="text-black/60">2nd Cycle</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-black/40">Click on any period to edit</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-amber-700 font-semibold">Multi-subject</span>
        </div>
      </div>
    </div>
  );
});

// ============================================
// TIMETABLE ENTRY MODAL
// ============================================

function TimetableEntryModal({
  initial,
  teachers,
  classes,
  subjects,
  onSave,
  onCancel,
}: {
  initial: TimetableEntry;
  teachers: Teacher[];
  classes: Class[];
  subjects: Subject[];
  onSave: (entry: TimetableEntry) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<TimetableEntry>(() => sanitizeEntry(initial));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(sanitizeEntry(initial));
  }, [initial]);

  const set = <K extends keyof TimetableEntry>(k: K, v: TimetableEntry[K]) => setForm((f) => ({ ...f, [k]: v }));

  const isNewEntry = !initial._id && !initial.id?.startsWith('6a') || initial.id?.startsWith('entry_');

  const handleSubmit = () => {
    const { startTime, endTime } = sanitizeTimes(form.startTime, form.endTime);

    if (startTime >= endTime) {
      toast.error("Start time must be before end time");
      return;
    }

    const finalEntry: TimetableEntry = { ...form, startTime, endTime };

    setSaving(true);
    try {
      onSave(finalEntry);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-xl flex items-center gap-3">
            <Calendar className="size-6 text-brand" />
            {isNewEntry ? "Add New Period" : "Edit Timetable Entry"}
          </h3>
          <button onClick={onCancel} className="text-black/40 hover:text-black/70">
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full min-w-[1100px] text-left">
            <thead className="bg-stone-50">
              <tr>
                {['Day', 'Period', 'Start', 'End', 'Teacher', 'Class', 'Subject', 'Cycle', 'Room', 'Academic Year'].map((label) => (
                  <th key={label} className="px-3 py-3 text-[10px] uppercase tracking-wider font-bold text-black/50 whitespace-nowrap">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="align-top">
                <td className="p-2"><select value={form.day} onChange={(e) => set("day", e.target.value)} className={inputCls}>{DAYS.map((d) => <option key={d} value={d}>{d}</option>)}</select></td>
                <td className="p-2"><input type="number" value={form.periodNumber} onChange={(e) => set("periodNumber", parseInt(e.target.value) || 1)} className={inputCls} min="1" /></td>
                <td className="p-2"><input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} className={inputCls} /></td>
                <td className="p-2"><input type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} className={inputCls} /></td>
                <td className="p-2"><select value={form.teacherId} onChange={(e) => { const teacher = teachers.find((t) => t._id === e.target.value); set("teacherId", e.target.value); set("teacherName", teacher?.name || ""); }} className={inputCls}><option value="">Select Teacher</option>{teachers.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}</select></td>
                <td className="p-2"><select value={form.classId} onChange={(e) => { const cls = classes.find((c) => c._id === e.target.value); set("classId", e.target.value); set("className", getClassDisplayName(cls, "")); }} className={inputCls}><option value="">Select Class</option>{classes.map((c) => <option key={c._id} value={c._id}>{getClassDisplayName(c)}</option>)}</select></td>
                <td className="p-2"><select value={form.subjectId} onChange={(e) => { const subj = subjects.find((s) => s._id === e.target.value); set("subjectId", e.target.value); set("subjectName", subj?.name || ""); set("subjectCode", subj?.code || ""); }} className={inputCls}><option value="">Select Subject</option>{subjects.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.code})</option>)}</select></td>
                <td className="p-2"><select value={form.cycle} onChange={(e) => { const cycle = e.target.value as "first" | "second"; set("cycle", cycle); set("ratePerPeriod", CYCLE_RATES[cycle]); }} className={inputCls}><option value="first">1st</option><option value="second">2nd</option></select></td>
                <td className="p-2"><input type="text" value={form.room || ""} onChange={(e) => set("room", e.target.value)} className={inputCls} placeholder="Room" /></td>
                <td className="p-2"><input type="text" value={form.academicYear} onChange={(e) => set("academicYear", e.target.value)} className={inputCls} /></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between rounded-xl bg-stone-50 px-4 py-3 text-sm">
          <span className="font-medium">Rate per period</span>
          <span className="font-bold text-brand">{form.ratePerPeriod} FRS</span>
        </div>

        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm text-amber-800">
            <span className="font-bold">💡 Multi-Subject Support:</span>
            <br />
            You can add multiple subjects to the same class at the same time.
            Just make sure each subject has a <span className="font-bold">different teacher</span>.
            <br />
            <span className="text-xs text-amber-600 mt-1 block">
              Example: Form 4A can have both Math (Teacher A) and Physics (Teacher B) at 08:00-09:00
            </span>
          </p>
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-stone-100">
          <button onClick={onCancel} className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold hover:bg-stone-50 transition" disabled={saving}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand/20"
            disabled={saving}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              isNewEntry ? "Add Period" : "Update Entry"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// BULK ADD MODAL
// ============================================

function BulkAddModal({
  teachers,
  classes,
  subjects,
  onSave,
  onCancel,
}: {
  teachers: Teacher[];
  classes: Class[];
  subjects: Subject[];
  onSave: (entries: TimetableEntry[]) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<Partial<TimetableEntry>[]>([
    { day: "Monday", periodNumber: 1, cycle: "first", ratePerPeriod: CYCLE_RATES.first },
  ]);
  const [saving, setSaving] = useState(false);

  const addRow = () => {
    setRows([...rows, { day: "Monday", periodNumber: rows.length + 1, cycle: "first", ratePerPeriod: CYCLE_RATES.first }]);
  };

  const removeRow = (index: number) => setRows(rows.filter((_, i) => i !== index));

  const updateRow = (index: number, field: string, value: any) => {
    const updated = [...rows];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "cycle") {
      updated[index].ratePerPeriod = CYCLE_RATES[value as "first" | "second"];
    }
    setRows(updated);
  };

  const validRowCount = rows.filter((e) => e.teacherId && e.classId && e.subjectId).length;

  const handleSubmit = () => {
    const validEntries = rows.filter((e) => e.teacherId && e.classId && e.subjectId);
    if (validEntries.length === 0) {
      toast.error("Please fill in all required fields for at least one row");
      return;
    }

    const formattedEntries = validEntries.map((e) => {
      const { startTime, endTime } = sanitizeTimes(e.startTime, e.endTime);
      return {
        ...e,
        startTime,
        endTime,
        id: `entry_${Date.now()}_${Math.random()}`,
        teacherName: teachers.find((t) => t._id === e.teacherId)?.name || "",
        className: classes.find((c) => c._id === e.classId)?.className || "",
        subjectName: subjects.find((s) => s._id === e.subjectId)?.name || "",
        academicYear: "2026-2027",
        isActive: true,
      };
    }) as TimetableEntry[];

    setSaving(true);
    try {
      onSave(formattedEntries);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-display font-bold text-xl flex items-center gap-3">
            <Upload className="size-6 text-brand" />
            Bulk Add Timetable Entries
          </h3>
          <button onClick={onCancel} className="text-black/40 hover:text-black/70">
            <X className="size-5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50">
                <th className="px-2 py-2 text-left text-xs font-bold text-black/50">#</th>
                <th className="px-2 py-2 text-left text-xs font-bold text-black/50">Day*</th>
                <th className="px-2 py-2 text-left text-xs font-bold text-black/50">Period</th>
                <th className="px-2 py-2 text-left text-xs font-bold text-black/50">Teacher*</th>
                <th className="px-2 py-2 text-left text-xs font-bold text-black/50">Class*</th>
                <th className="px-2 py-2 text-left text-xs font-bold text-black/50">Subject*</th>
                <th className="px-2 py-2 text-left text-xs font-bold text-black/50">Cycle</th>
                <th className="px-2 py-2 text-left text-xs font-bold text-black/50">Rate</th>
                <th className="px-2 py-2 text-center text-xs font-bold text-black/50">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((entry, index) => (
                <tr key={index} className="border-b border-stone-100">
                  <td className="px-2 py-2 text-center text-black/40">{index + 1}</td>
                  <td className="px-2 py-2">
                    <select value={entry.day || "Monday"} onChange={(e) => updateRow(index, "day", e.target.value)} className="w-full px-2 py-1 rounded border border-stone-200 text-sm">
                      {DAYS.map((d) => (
                        <option key={d} value={d}>{d.substring(0, 3)}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={entry.periodNumber || 1}
                      onChange={(e) => updateRow(index, "periodNumber", parseInt(e.target.value))}
                      className="w-full px-2 py-1 rounded border border-stone-200 text-sm"
                      min="1"
                      max="8"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select value={entry.teacherId || ""} onChange={(e) => updateRow(index, "teacherId", e.target.value)} className="w-full px-2 py-1 rounded border border-stone-200 text-sm">
                      <option value="">Select</option>
                      {teachers.map((t) => (
                        <option key={t._id} value={t._id}>{t.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select value={entry.classId || ""} onChange={(e) => updateRow(index, "classId", e.target.value)} className="w-full px-2 py-1 rounded border border-stone-200 text-sm">
                      <option value="">Select</option>
                      {classes.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.department ? `${c.className} ${c.department}` : c.className}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select value={entry.subjectId || ""} onChange={(e) => updateRow(index, "subjectId", e.target.value)} className="w-full px-2 py-1 rounded border border-stone-200 text-sm">
                      <option value="">Select</option>
                      {subjects.map((s) => (
                        <option key={s._id} value={s._id}>{s.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select value={entry.cycle || "first"} onChange={(e) => updateRow(index, "cycle", e.target.value)} className="w-full px-2 py-1 rounded border border-stone-200 text-sm">
                      <option value="first">1st</option>
                      <option value="second">2nd</option>
                    </select>
                  </td>
                  <td className="px-2 py-2 text-center font-bold text-brand">
                    {entry.cycle === "first" ? CYCLE_RATES.first : CYCLE_RATES.second} FRS
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => removeRow(index)} className="p-1 rounded-lg hover:bg-red-50 text-red-500 transition">
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4">
          <button onClick={addRow} className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-stone-300 text-sm font-semibold hover:border-brand/50 hover:text-brand transition">
            <Plus className="size-4" /> Add Row
          </button>
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold hover:bg-stone-50 transition" disabled={saving}>
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition disabled:opacity-50"
              disabled={saving}
            >
              {saving ? "Adding..." : `Add ${validRowCount} Entries`}
            </button>
          </div>
        </div>
        <p className="text-xs text-amber-600 mt-3">
          💡 Multiple subjects can be assigned to the same class at the same time. They will appear as "Subject1/Subject2" in the timetable.
        </p>
      </div>
    </div>
  );
}

// ============================================
// COPY YEAR MODAL
// ============================================

function CopyYearModal({
  currentYear,
  onCopy,
  onCancel,
}: {
  currentYear: string;
  onCopy: (sourceYear: string, targetYear: string) => void;
  onCancel: () => void;
}) {
  const [sourceYear, setSourceYear] = useState("2025-2026");
  const [targetYear, setTargetYear] = useState(currentYear);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display font-bold text-xl flex items-center gap-3 mb-5">
          <Copy className="size-6 text-brand" />
          Copy Timetable from Previous Year
        </h3>

        <div className="space-y-4">
          <Field label="Source Academic Year">
            <input type="text" value={sourceYear} onChange={(e) => setSourceYear(e.target.value)} className={inputCls} placeholder="2025-2026" />
          </Field>

          <Field label="Target Academic Year">
            <input type="text" value={targetYear} onChange={(e) => setTargetYear(e.target.value)} className={inputCls} placeholder={currentYear} />
          </Field>

          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
            <AlertCircle className="size-4 inline mr-2" />
            This will copy all timetable entries from the source year to the target year.
            Existing entries in the target year will not be overwritten.
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-stone-100">
          <button onClick={onCancel} className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold hover:bg-stone-50 transition">
            Cancel
          </button>
          <button
            onClick={() => onCopy(sourceYear, targetYear)}
            className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition shadow-lg shadow-brand/20"
          >
            <Copy className="size-4 inline mr-2" />
            Copy Timetable
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// HELPER COMPONENTS
// ============================================

const inputCls = "w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest font-bold text-black/50">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

// ============================================
// SCHOOL SETTINGS MODAL (standalone editor)
// ============================================

function SchoolSettingsModal({
  settings,
  academicYear,
  onSave,
  onClose,
}: {
  settings: SchoolSettings;
  academicYear: string;
  onSave: (settings: Omit<SchoolSettings, "_id">) => Promise<boolean>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<LocalSettings>({
    schoolStartTime: settings.schoolStartTime || "08:00",
    schoolEndTime: settings.schoolEndTime || "14:00",
    breakStart: settings.breakStart || "10:15",
    breakEnd: settings.breakEnd || "10:30",
    periodDurationMinutes: settings.periodDurationMinutes || 45,
    schoolDays: settings.schoolDays?.length
      ? [...settings.schoolDays]
      : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    periodsPerDay: settings.periodsPerDay || 6,
  });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof LocalSettings>(k: K, v: LocalSettings[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const computedPeriods = useMemo(() => {
    const start = timeStringToMinutes(form.schoolStartTime);
    const end = timeStringToMinutes(form.schoolEndTime);
    const dur = form.periodDurationMinutes;
    let count = 0, cursor = start, periodNum = 1;
    while (cursor + dur <= end && periodNum <= (form.periodsPerDay || 20)) {
      count += 1;
      periodNum += 1;
      cursor += dur;
    }
    return count;
  }, [form]);

  const handleSave = async () => {
    if (timeStringToMinutes(form.schoolStartTime) >= timeStringToMinutes(form.schoolEndTime)) {
      toast.error("School start time must be before end time");
      return;
    }
    if (form.schoolDays.length === 0) {
      toast.error("Select at least one school day");
      return;
    }
    setSaving(true);
    const ok = await onSave({
      schoolStartTime: form.schoolStartTime,
      schoolEndTime: form.schoolEndTime,
      breakStart: settings.breakStart,
      breakEnd: settings.breakEnd,
      periodDurationMinutes: form.periodDurationMinutes,
      schoolDays: form.schoolDays,
      periodsPerDay: form.periodsPerDay,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-display font-bold text-xl flex items-center gap-3">
              <School className="size-6 text-brand" />
              School Schedule Settings
            </h3>
            <p className="text-xs text-black/50 mt-1">
              Academic year {academicYear} — these times drive the timetable auto-generator.
            </p>
          </div>
          <button onClick={onClose} className="text-black/40 hover:text-black/70">
            <X className="size-5" />
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="School Start Time*">
            <input type="time" value={form.schoolStartTime} onChange={(e) => set("schoolStartTime", e.target.value)} className={inputCls} />
          </Field>
          <Field label="School End Time*">
            <input type="time" value={form.schoolEndTime} onChange={(e) => set("schoolEndTime", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Period Duration (minutes)*">
            <input type="number" min={10} max={120} value={form.periodDurationMinutes}
              onChange={(e) => set("periodDurationMinutes", Math.max(10, Math.min(120, Number(e.target.value) || 45)))}
              className={inputCls} />
          </Field>
          <Field label="Periods Per Day (max 12)*">
            <input type="number" min={1} max={12} value={form.periodsPerDay}
              onChange={(e) => set("periodsPerDay", Math.max(1, Math.min(12, Number(e.target.value) || 6)))}
              className={inputCls} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="School Days*">
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => {
                  const checked = form.schoolDays.includes(day);
                  return (
                    <button key={day} type="button"
                      onClick={() => set("schoolDays", checked ? form.schoolDays.filter((d) => d !== day) : [...form.schoolDays, day])}
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${checked ? "bg-brand text-white" : "bg-stone-100 text-black/40 hover:bg-stone-200"}`}>
                      {day.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
          <div className="sm:col-span-2 p-3 bg-stone-50 rounded-xl text-sm">
            <div>Periods per day: <strong>{computedPeriods}</strong></div>
            <div className="text-xs text-black/50 mt-1">
              Based on {form.schoolStartTime}–{form.schoolEndTime} with {form.periodDurationMinutes}-minute periods.
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-stone-100">
          <button onClick={onClose} disabled={saving} className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold hover:bg-stone-50 transition">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition disabled:opacity-50">
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// SUBJECTS & PERIODS MANAGER MODAL
// ============================================

interface SubjectFormState {
  _id?: string;
  name: string;
  code: string;
  coefficient: number;
  cycle: string;
  periodsPerWeek: number;
  periodsByClass: Record<string, number>;
  classIds: string[];
  teacherIds: string[];
}

const emptySubjectForm = (): SubjectFormState => ({
  name: "", code: "", coefficient: 1, cycle: "1st Cycle", periodsPerWeek: 4, periodsByClass: {}, classIds: [], teacherIds: [],
});

function SubjectsManagerModal({
  subjects,
  classes,
  teachers,
  onSaved,
  onClose,
}: {
  subjects: Subject[];
  classes: Class[];
  teachers: Teacher[];
  onSaved: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<SubjectFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const classLabel = (c: Class) => (c.department ? `${c.className} ${c.department}` : c.className);

  const classNamesOf = (s: Subject) => {
    const ids = (s.classIds || []).map(String);
    return classes.filter((c) => ids.includes(String(c._id))).map(classLabel);
  };

  const filtered = subjects.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
  });

  const toggleClass = (classId: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const has = prev.classIds.includes(classId);
      // Drop the override when unassigning so stale values never persist.
      const periodsByClass = { ...prev.periodsByClass };
      if (has) {
        delete periodsByClass[classId];
      }
      return {
        ...prev,
        classIds: has ? prev.classIds.filter((c) => c !== classId) : [...prev.classIds, classId],
        periodsByClass,
      };
    });
  };

  const setClassPeriods = (classId: string, value: number) => {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        periodsByClass: {
          ...prev.periodsByClass,
          [classId]: Math.max(1, Math.min(20, Number(value) || 1)),
        },
      };
    });
  };

  const startEdit = (s: Subject) => {
    setForm({
      _id: s._id,
      name: s.name,
      code: s.code,
      coefficient: s.coefficient ?? 1,
      cycle: s.cycle || "1st Cycle",
      periodsPerWeek: s.periodsPerWeek ?? 4,
      periodsByClass: { ...(s.periodsByClass || {}) },
      classIds: (s.classIds || []).map(String),
      teacherIds: (s.teacherIds || []).map(String),
    });
  };

  const handleSave = async () => {
    if (!form) return;
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Subject name and code are required");
      return;
    }
    setSaving(true);
    try {
      // Only keep per-class overrides for classes the subject is assigned to.
      const periodsByClass: Record<string, number> = {};
      form.classIds.forEach((cid) => {
        const override = Number(form.periodsByClass?.[cid]);
        if (Number.isFinite(override) && override >= 1) {
          periodsByClass[cid] = Math.max(1, Math.min(20, Math.floor(override)));
        }
      });
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        coefficient: Math.max(1, Number(form.coefficient) || 1),
        cycle: form.cycle,
        periodsPerWeek: Math.max(1, Math.min(20, Number(form.periodsPerWeek) || 4)),
        periodsByClass,
        classIds: form.classIds,
        teacherIds: form.teacherIds,
      };
      const res = form._id
        ? await axios.put(`${API_BASE}/subjects/${form._id}`, payload)
        : await axios.post(`${API_BASE}/subjects`, payload);
      if (res.data.success) {
        toast.success(form._id ? "Subject updated" : "Subject created");
        setForm(null);
        await onSaved();
      } else {
        toast.error(res.data.message || "Failed to save subject");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save subject");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display font-bold text-xl flex items-center gap-3">
              <BookOpen className="size-6 text-brand" />
              Subjects & Periods
            </h3>
            <p className="text-xs text-black/50 mt-1">
              Set a default periods/week, then override per class (e.g. Physics: 4 in OLevel 3, 5 in OLevel 5).
            </p>
          </div>
          <button onClick={onClose} className="text-black/40 hover:text-black/70">
            <X className="size-5" />
          </button>
        </div>
        {form ? (
          <div className="border border-stone-200 rounded-xl p-4">
            <h4 className="font-bold text-sm mb-3">{form._id ? "Edit Subject" : "New Subject"}</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Subject Name*">
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="e.g. Mathematics" />
              </Field>
              <Field label="Subject Code*">
                <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputCls} placeholder="e.g. MATH" />
              </Field>
              <Field label="Coefficient*">
                <input type="number" min={1} value={form.coefficient} onChange={(e) => setForm({ ...form, coefficient: Number(e.target.value) || 1 })} className={inputCls} />
              </Field>
              <Field label="Cycle*">
                <select value={form.cycle} onChange={(e) => setForm({ ...form, cycle: e.target.value })} className={inputCls}>
                  <option value="1st Cycle">1st Cycle</option>
                  <option value="2nd Cycle">2nd Cycle</option>
                </select>
              </Field>
              <Field label="Default Periods / Week*">
                <input type="number" min={1} max={20} value={form.periodsPerWeek} onChange={(e) => setForm({ ...form, periodsPerWeek: Number(e.target.value) || 1 })} className={inputCls} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Assigned Classes">
                  <div className="flex flex-wrap gap-2">
                    {classes.map((c) => {
                      const checked = form.classIds.includes(String(c._id));
                      return (
                        <button key={c._id} type="button" onClick={() => toggleClass(String(c._id))}
                          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${checked ? "bg-brand text-white" : "bg-stone-100 text-black/40 hover:bg-stone-200"}`}>
                          {classLabel(c)}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>
              {form.classIds.length > 0 && (
                <div className="sm:col-span-2 space-y-2">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-black/50">Periods per week by class (overrides the default)</div>
                  {classes
                    .filter((c) => form.classIds.includes(String(c._id)))
                    .map((c) => {
                      const cid = String(c._id);
                      return (
                        <div key={cid} className="flex items-center justify-between gap-3 bg-stone-50 rounded-lg px-3 py-2">
                          <span className="text-xs font-semibold text-black/70">{classLabel(c)}</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={form.periodsByClass[cid] ?? form.periodsPerWeek ?? 4}
                              onChange={(e) => setClassPeriods(cid, Number(e.target.value))}
                              className="w-16 px-2 py-1 rounded-lg border border-stone-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand/30"
                            />
                            <span className="text-[10px] text-black/40">/ week</span>
                          </div>
                        </div>
                      );
                    })}
                  <p className="text-[11px] text-black/40">Leave a class untouched to use the default periods per week.</p>
                </div>
              )}
              <div className="sm:col-span-2">
                <Field label="Assigned Teachers">
                  <div className="flex flex-wrap gap-2">
                    {teachers.map((teacher) => {
                      const teacherId = String(teacher._id);
                      const checked = form.teacherIds.includes(teacherId);
                      return (
                        <button
                          key={teacherId}
                          type="button"
                          onClick={() => setForm({
                            ...form,
                            teacherIds: checked
                              ? form.teacherIds.filter((id) => id !== teacherId)
                              : [...form.teacherIds, teacherId],
                          })}
                          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${checked ? "bg-brand text-white" : "bg-stone-100 text-black/40 hover:bg-stone-200"}`}
                        >
                          {teacher.name || teacher.fullName || "Unnamed teacher"}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-stone-100">
              <button onClick={() => setForm(null)} disabled={saving} className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold hover:bg-stone-50 transition">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition disabled:opacity-50">
                {saving ? "Saving..." : form._id ? "Update Subject" : "Create Subject"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-3 items-center mb-4">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/40" />
                <input type="text" placeholder="Search subjects..." value={search} onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
              </div>
              <button onClick={() => setForm(emptySubjectForm())} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition">
                <Plus className="size-4" /> Add Subject
              </button>
            </div>

            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <th className="px-3 py-2 text-left text-xs font-bold text-black/50 uppercase">Subject</th>
                    <th className="px-3 py-2 text-center text-xs font-bold text-black/50 uppercase">Coeff</th>
                    <th className="px-3 py-2 text-center text-xs font-bold text-black/50 uppercase">Cycle</th>
                    <th className="px-3 py-2 text-center text-xs font-bold text-black/50 uppercase">Periods/Week</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-black/50 uppercase">Classes</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-black/50 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-black/40">No subjects found. Click "Add Subject" to create one.</td>
                    </tr>
                  ) : filtered.map((s) => {
                    const names = classNamesOf(s);
                    return (
                      <tr key={s._id} className="border-b border-stone-100 hover:bg-stone-50 transition">
                        <td className="px-3 py-2.5">
                          <div className="font-semibold">{s.name}</div>
                          <div className="text-xs text-black/40 font-mono">{s.code}</div>
                        </td>
                        <td className="px-3 py-2.5 text-center">{s.coefficient ?? "-"}</td>
                        <td className="px-3 py-2.5 text-center text-xs">{s.cycle || "-"}</td>
                        <td className="px-3 py-2.5 text-center font-bold text-brand" title={Object.keys(s.periodsByClass || {}).length > 0 ? "Some classes have custom period counts" : undefined}>
                          {s.periodsPerWeek ?? 4}{Object.keys(s.periodsByClass || {}).length > 0 ? "*" : ""}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-black/60">
                          {names.length ? names.join(", ") : <span className="text-amber-600">None assigned</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button onClick={() => startEdit(s)} className="p-1.5 rounded-lg hover:bg-stone-100 text-black/60 transition" title="Edit subject">
                            <Pencil className="size-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-amber-600 mt-3">
              💡 Teachers also need matching subject & class assignments (Teachers page) to be scheduled for these periods by the auto-generator.
            </p>
          </>
        )}
      </div>
    </div>
  );
}