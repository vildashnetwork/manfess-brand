import { useEffect, useMemo, useRef, useState } from "react";
import { Save, Wand2, Copy, Sparkles, Pencil, Loader2, CheckCircle, AlertCircle, CloudOff, Search, X } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { currentUser } from "@/lib/auth";

const API_BASE = "https://manfess-back.onrender.com/api";

interface Student {
  id: string;
  fullName: string;
  gender: string;
  dob: string;
  classId: string;
  department: string;
  parentName: string;
  parentPhone: string;
  address: string;
  photoUrl?: string;
  registrationDate: string;
  feesPaid: number;
  feesDue: number;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  coefficient: number;
  cycle: string;
  classIds: string[];
  teacherIds: string[];
}

interface Class {
  id: string;
  className: string;
  department: string;
  cycle: string;
  acedemicYear: string;
  classMasterId: string;
}

interface Mark {
  id?: string;
  studentId: string;
  subjectId: string;
  classId: string;
  sequence: string;
  academicyear: string;
  score: number;
  recordedBy: string;
}

interface Teacher {
  id: string;
  name: string;
  username: string;
  phone: string;
  role: string;
  qualification: string;
  subjectIds: string[];
  classIds: string[];
  acedemicYear: string;
}

// Grade function
function gradeFor(score: number): { grade: string; remark: string } {
  if (score >= 16) return { grade: "A", remark: "Excellent" };
  if (score >= 14) return { grade: "B", remark: "Very Good" };
  if (score >= 12) return { grade: "C", remark: "Good" };
  if (score >= 10) return { grade: "D", remark: "Average" };
  if (score >= 8) return { grade: "E", remark: "Below Average" };
  return { grade: "F", remark: "Fail" };
}

// Helper to format sequence
const formatSequence = (seq: number): string => {
  const suffixes = ["st", "nd", "rd", "th", "th", "th"];
  return `${seq}${suffixes[seq - 1] || "th"} seq`;
};

// Local storage keys
const MARKS_STORAGE_KEY = "mams-draft-marks";
const LAST_SAVED_KEY = "mams-last-saved";

export function MarkEntry() {
  const user = currentUser();
  const role = user?.role;
  const isTeacher = role === "teacher";

  // State
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Filter states
  const [classId, setClassId] = useState<string>("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [sequence, setSequence] = useState<number>(1);
  const [searchTerm, setSearchTerm] = useState("");

  // Scores state
  const [scores, setScores] = useState<Record<string, string>>({});

  // Auto-save timer ref
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get teacher profile from localStorage
  useEffect(() => {
    if (user && isTeacher) {
      const fetchTeacher = async () => {
        try {
          const response = await axios.get(`${API_BASE}/users`);
          if (response.data.success) {
            const teacherData = response.data.data.find((u: any) => u.username === user.username);
            if (teacherData) {
              setTeacher({
                id: teacherData._id,
                name: teacherData.name,
                username: teacherData.username,
                phone: teacherData.phone,
                role: teacherData.role,
                qualification: teacherData.qualification || "",
                subjectIds: teacherData.subjectIds || [],
                classIds: teacherData.classIds || [],
                acedemicYear: teacherData.acedemicYear || ""
              });
            }
          }
        } catch (error) {
          console.error("Error fetching teacher:", error);
        }
      };
      fetchTeacher();
    }
  }, [user, isTeacher]);

  // Fetch all data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [studentsRes, subjectsRes, classesRes, marksRes] = await Promise.all([
        axios.get(`${API_BASE}/students`),
        axios.get(`${API_BASE}/subjects`),
        axios.get(`${API_BASE}/classes`),
        axios.get(`${API_BASE}/marks`)
      ]);

      if (studentsRes.data.success) {
        const mappedStudents = studentsRes.data.data.map((s: any) => ({
          ...s,
          id: s._id || s.id
        }));
        setStudents(mappedStudents);
      }

      if (subjectsRes.data.success) {
        const mappedSubjects = subjectsRes.data.data.map((s: any) => ({
          ...s,
          id: s._id || s.id
        }));
        setSubjects(mappedSubjects);
      }

      if (classesRes.data.success) {
        const mappedClasses = classesRes.data.data.map((c: any) => ({
          ...c,
          id: c._id || c.id,
          className: c.className || c.name,
          acedemicYear: c.acedemicYear || c.academicYear || ""
        }));
        setClasses(mappedClasses);
      }

      if (marksRes.data.success) {
        const mappedMarks = marksRes.data.data.map((m: any) => ({
          ...m,
          id: m._id || m.id,
          academicyear: m.academicyear || m.academicYear || ""
        }));
        setMarks(mappedMarks);
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error(error.response?.data?.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter classes for teacher
  const allowedClasses = useMemo(() => {
    if (!isTeacher) return classes;
    if (!teacher) return [];
    return classes.filter((c) => teacher.classIds.includes(c.id));
  }, [isTeacher, teacher, classes]);

  // Filter subjects for teacher
  const allowedSubjects = useMemo(() => {
    let subs = subjects;
    if (isTeacher && teacher) {
      subs = subs.filter((s) => teacher.subjectIds.includes(s.id));
    }
    if (classId) {
      subs = subs.filter((s) => s.classIds.includes(classId));
    }
    return subs;
  }, [subjects, isTeacher, teacher, classId]);

  // Get students for selected class with search
  const classStudents = useMemo(() => {
    let filtered = students
      .filter((s) => s.classId === classId)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

    // Apply search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter((s) =>
        s.fullName.toLowerCase().includes(term) ||
        s.parentName?.toLowerCase().includes(term) ||
        s.admissionNumber?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [students, classId, searchTerm]);

  // Set default class and subject
  useEffect(() => {
    if (allowedClasses.length > 0 && !classId) {
      setClassId(allowedClasses[0].id);
    }
  }, [allowedClasses, classId]);

  useEffect(() => {
    if (allowedSubjects.length > 0 && !subjectId) {
      setSubjectId(allowedSubjects[0].id);
    }
  }, [allowedSubjects, subjectId]);

  // Load marks for current selection
  useEffect(() => {
    if (!classId || !subjectId || !sequence) return;

    const draftKey = `${classId}_${subjectId}_${sequence}`;
    const savedDrafts = JSON.parse(localStorage.getItem(MARKS_STORAGE_KEY) || "{}");
    const draftData = savedDrafts[draftKey];

    if (draftData) {
      setScores(draftData);
      setHasUnsavedChanges(true);
      setAutoSaveStatus("saved");
      const lastSavedTime = localStorage.getItem(LAST_SAVED_KEY);
      if (lastSavedTime) {
        setLastSaved(lastSavedTime);
      }
    } else {
      const nextScores: Record<string, string> = {};
      for (const student of classStudents) {
        const existingMark = marks.find(
          (m) =>
            m.studentId === student.id &&
            m.subjectId === subjectId &&
            m.sequence === formatSequence(sequence)
        );
        nextScores[student.id] = existingMark ? String(existingMark.score) : "";
      }
      setScores(nextScores);
      setHasUnsavedChanges(false);
      setAutoSaveStatus("idle");
    }
  }, [classStudents, subjectId, sequence, marks, classId]);

  // Auto-save effect
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    if (Object.values(scores).some(v => v !== "") && !saving && classId && subjectId) {
      setHasUnsavedChanges(true);
      setAutoSaveStatus("saving");

      autoSaveTimerRef.current = setTimeout(() => {
        autoSaveToLocal();
      }, 3000);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [scores, saving, classId, subjectId]);

  // Auto-save to localStorage
  const autoSaveToLocal = () => {
    try {
      const draftKey = `${classId}_${subjectId}_${sequence}`;
      const savedDrafts = JSON.parse(localStorage.getItem(MARKS_STORAGE_KEY) || "{}");

      const hasMarks = Object.values(scores).some(v => v !== "");
      if (!hasMarks) {
        delete savedDrafts[draftKey];
        localStorage.setItem(MARKS_STORAGE_KEY, JSON.stringify(savedDrafts));
        setAutoSaveStatus("idle");
        setHasUnsavedChanges(false);
        return;
      }

      savedDrafts[draftKey] = scores;
      localStorage.setItem(MARKS_STORAGE_KEY, JSON.stringify(savedDrafts));

      const now = new Date().toLocaleTimeString();
      localStorage.setItem(LAST_SAVED_KEY, now);
      setLastSaved(now);
      setAutoSaveStatus("saved");
      setHasUnsavedChanges(true);

      console.log("📝 Auto-saved marks to localStorage");
    } catch (error) {
      console.error("Error auto-saving to localStorage:", error);
      setAutoSaveStatus("error");
    }
  };

  // Stats
  const numericScores = useMemo(
    () =>
      Object.values(scores)
        .map((x) => Number(x))
        .filter((n) => !isNaN(n)),
    [scores]
  );
  const avg = numericScores.length
    ? numericScores.reduce((a, b) => a + b, 0) / numericScores.length
    : 0;
  const highest = numericScores.length ? Math.max(...numericScores) : 0;
  const lowest = numericScores.length ? Math.min(...numericScores) : 0;
  const submitted = numericScores.length;

  // Input refs for keyboard navigation
  const inputsRef = useRef<HTMLInputElement[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      inputsRef.current[idx + 1]?.focus();
      inputsRef.current[idx + 1]?.select();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      inputsRef.current[idx - 1]?.focus();
      inputsRef.current[idx - 1]?.select();
    }
  };

  const updateScore = (studentId: string, raw: string) => {
    if (raw !== "") {
      const n = Number(raw);
      if (isNaN(n) || n < 0 || n > 20) {
        toast.error("Marks must be 0–20");
        return;
      }
    }
    setScores((s) => ({ ...s, [studentId]: raw }));
    setHasUnsavedChanges(true);
  };

  const saveAll = async () => {
    if (!subjectId) {
      toast.error("Pick a subject first");
      return;
    }
    if (!classId) {
      toast.error("Pick a class first");
      return;
    }

    setSaving(true);

    try {
      const recordedBy = teacher?.name || user?.name || "Unknown";
      const selectedClass = classes.find(c => c.id === classId);
      const academicYear = selectedClass?.acedemicYear || teacher?.acedemicYear || new Date().getFullYear() + "-" + (new Date().getFullYear() + 1);

      // Format sequence correctly
      const formattedSequence = formatSequence(sequence);
      console.log("📤 Saving with sequence:", formattedSequence);

      const marksToSave = Object.entries(scores)
        .filter(([, v]) => v !== "" && !isNaN(Number(v)))
        .map(([studentId, score]) => ({
          studentId,
          subjectId,
          classId,
          sequence: formattedSequence,
          academicyear: academicYear,
          score: Number(score),
          recordedBy
        }));

      console.log("📤 Marks to save:", marksToSave);

      if (marksToSave.length === 0) {
        toast.error("No marks to save");
        setSaving(false);
        return;
      }

      // Delete existing marks for this subject/class/sequence
      const existingMarks = marks.filter(
        (m) =>
          m.subjectId === subjectId &&
          m.classId === classId &&
          m.sequence === formattedSequence
      );

      for (const mark of existingMarks) {
        if (mark.id) {
          try {
            await axios.delete(`${API_BASE}/marks/${mark.id}`);
          } catch (error) {
            console.error("Error deleting mark:", error);
          }
        }
      }

      // Save new marks
      const response = await axios.post(`${API_BASE}/marks/bulk`, marksToSave);

      console.log("📥 Save response:", response.data);

      if (response.data.success) {
        toast.success(`✅ Saved ${marksToSave.length} marks successfully`);

        // Clear local storage draft for this selection
        const draftKey = `${classId}_${subjectId}_${sequence}`;
        const savedDrafts = JSON.parse(localStorage.getItem(MARKS_STORAGE_KEY) || "{}");
        delete savedDrafts[draftKey];
        localStorage.setItem(MARKS_STORAGE_KEY, JSON.stringify(savedDrafts));

        // Refresh marks
        const marksRes = await axios.get(`${API_BASE}/marks`);
        if (marksRes.data.success) {
          const mappedMarks = marksRes.data.data.map((m: any) => ({
            ...m,
            id: m._id || m.id
          }));
          setMarks(mappedMarks);
        }

        setHasUnsavedChanges(false);
        setAutoSaveStatus("idle");
        setLastSaved(null);
      }
    } catch (error: any) {
      console.error("Error saving marks:", error);
      console.error("Error response:", error.response?.data);

      const errorMessage = error.response?.data?.message || "Failed to save marks";
      const errorDetails = error.response?.data?.error || "";

      toast.error(`${errorMessage}${errorDetails ? `: ${errorDetails}` : ""}`);
      setAutoSaveStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const copyFromPrevious = () => {
    if (sequence === 1) {
      toast.info("No previous sequence");
      return;
    }
    const prev = sequence - 1;
    const nextScores: Record<string, string> = { ...scores };
    let count = 0;
    for (const student of classStudents) {
      const existingMark = marks.find(
        (m) =>
          m.studentId === student.id &&
          m.subjectId === subjectId &&
          m.sequence === formatSequence(prev)
      );
      if (existingMark) {
        nextScores[student.id] = String(existingMark.score);
        count++;
      }
    }
    setScores(nextScores);
    setHasUnsavedChanges(true);
    toast.success(`Copied ${count} marks from Sequence ${prev}`);
  };

  const fillRandom = () => {
    const nextScores: Record<string, string> = { ...scores };
    for (const student of classStudents) {
      nextScores[student.id] = (Math.round((7 + Math.random() * 12) * 100) / 100).toString();
    }
    setScores(nextScores);
    setHasUnsavedChanges(true);
    toast.success("Filled draft marks");
  };

  // Get status icon
  const getStatusIcon = () => {
    if (saving) return <Loader2 className="size-4 animate-spin text-brand" />;
    if (autoSaveStatus === "saved") return <CheckCircle className="size-4 text-green-500" />;
    if (autoSaveStatus === "error") return <AlertCircle className="size-4 text-red-500" />;
    if (autoSaveStatus === "saving") return <Loader2 className="size-4 animate-spin text-yellow-500" />;
    return null;
  };

  // Get status text
  const getStatusText = () => {
    if (saving) return "Saving to server...";
    if (autoSaveStatus === "saved") return `Draft saved ${lastSaved ? `at ${lastSaved}` : ""}`;
    if (autoSaveStatus === "error") return "Auto-save failed";
    if (autoSaveStatus === "saving") return "Auto-saving...";
    if (hasUnsavedChanges) return "Unsaved changes";
    return "No changes";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-black/60">Loading data...</p>
        </div>
      </div>
    );
  }

  if (isTeacher && allowedClasses.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-6 sm:p-10 text-center">
        <h2 className="font-display font-bold text-xl">No classes assigned</h2>
        <p className="text-sm text-black/60 mt-2">Ask an admin to assign you to subjects and classes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5 px-2 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2">
            Mark Entry <Pencil className="size-5 text-brand" />
          </h1>
          <p className="text-sm text-black/60 mt-1">
            {isTeacher && teacher ? `Welcome ${teacher.name}` : "Record & edit student marks"}
          </p>
        </div>

        {/* Status and buttons - mobile friendly */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-xs text-black/60 order-2 sm:order-1">
            {getStatusIcon()}
            <span className="hidden sm:inline">{getStatusText()}</span>
          </div>

          <div className="flex flex-wrap gap-2 order-1 sm:order-2 w-full sm:w-auto">
            <button
              onClick={copyFromPrevious}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-stone-200 bg-white text-xs sm:text-sm font-semibold hover:bg-stone-50 flex-1 sm:flex-none justify-center"
            >
              <Copy className="size-3.5 sm:size-4" /> <span className="hidden xs:inline">Copy prev.</span>
            </button>
            {!isTeacher && (
              <button
                onClick={fillRandom}
                className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-stone-200 bg-white text-xs sm:text-sm font-semibold hover:bg-stone-50 flex-1 sm:flex-none justify-center"
              >
                <Wand2 className="size-3.5 sm:size-4" /> <span className="hidden xs:inline">Demo fill</span>
              </button>
            )}
            <button
              onClick={saveAll}
              disabled={saving || !hasUnsavedChanges}
              className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-brand text-white text-xs sm:text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed flex-1 sm:flex-none justify-center"
            >
              {saving ? <Loader2 className="size-3.5 sm:size-4 animate-spin" /> : <Save className="size-3.5 sm:size-4" />}
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Status messages */}
      {hasUnsavedChanges && autoSaveStatus !== "saved" && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 sm:px-4 py-2 text-xs text-yellow-700 flex items-center gap-2">
          <CloudOff className="size-3.5 shrink-0" />
          <span className="truncate">Unsaved changes. Auto-saving locally.</span>
        </div>
      )}

      {autoSaveStatus === "saved" && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-3 sm:px-4 py-2 text-xs text-green-700 flex items-center gap-2">
          <CheckCircle className="size-3.5 shrink-0" />
          <span className="truncate">Draft saved. Click "Save all" to push to server.</span>
        </div>
      )}

      {/* Filters - responsive grid */}
      <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select
          label="Class"
          value={classId}
          onChange={setClassId}
          options={allowedClasses.map((c) => ({ value: c.id, label: c.className + " " + c?.department }))}
        />
        <Select
          label="Subject"
          value={subjectId}
          onChange={setSubjectId}
          options={allowedSubjects.map((s) => ({
            value: s.id,
            label: `${s.name} (coef ${s.coefficient})`
          }))}
        />
        <Select
          label="Sequence"
          value={String(sequence)}
          onChange={(v) => setSequence(Number(v))}
          options={[1, 2, 3, 4, 5, 6].map((n) => ({
            value: String(n),
            label: `Sequence ${n}`
          }))}
        />
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/40" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search students by name, parent, or admission number..."
          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
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

      {/* Stats - responsive grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <Stat label="Submitted" value={`${submitted}/${classStudents.length}`} />
        <Stat
          label="Class Average"
          value={avg ? avg.toFixed(2) : "—"}
          tone={avg >= 10 ? "good" : avg ? "warn" : undefined}
        />
        <Stat label="Highest" value={highest ? highest.toFixed(2) : "—"} />
        <Stat label="Lowest" value={lowest ? lowest.toFixed(2) : "—"} />
      </div>

      {/* Table - responsive */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-stone-200 flex flex-wrap items-center gap-2 text-xs text-black/60">
          <Sparkles className="size-3.5 text-brand shrink-0" />
          <span>Press <kbd className="px-1.5 py-0.5 bg-stone-100 rounded font-mono text-[10px] border border-stone-200">Enter</kbd> to jump to next student</span>
          {searchTerm && (
            <span className="ml-auto text-brand font-medium">
              {classStudents.length} result{classStudents.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-stone-50 text-left text-[10px] uppercase tracking-widest text-black/50 font-bold">
              <tr>
                <th className="px-2 sm:px-5 py-2 sm:py-3 w-8 sm:w-12">#</th>
                <th className="px-2 sm:px-5 py-2 sm:py-3">Student</th>
                <th className="px-2 sm:px-5 py-2 sm:py-3 w-24 sm:w-32">Mark</th>
                <th className="px-2 sm:px-5 py-2 sm:py-3 w-16 sm:w-24">Grade</th>
                <th className="px-2 sm:px-5 py-2 sm:py-3 hidden sm:table-cell">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {classStudents.map((student, i) => {
                const raw = scores[student.id] ?? "";
                const n = Number(raw);
                const has = raw !== "" && !isNaN(n);
                const g = has ? gradeFor(n) : null;
                return (
                  <tr key={student.id} className="hover:bg-stone-50">
                    <td className="px-2 sm:px-5 py-2 text-black/40 font-mono text-[10px] sm:text-xs">{i + 1}</td>
                    <td className="px-2 sm:px-5 py-2 font-semibold text-xs sm:text-sm">{student.fullName}</td>
                    <td className="px-2 sm:px-5 py-2">
                      <input
                        ref={(el) => {
                          if (el) inputsRef.current[i] = el;
                        }}
                        value={raw}
                        onChange={(e) => updateScore(student.id, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, i)}
                        onFocus={(e) => e.currentTarget.select()}
                        type="number"
                        step="0.25"
                        min={0}
                        max={20}
                        className="w-16 sm:w-24 px-2 sm:px-3 py-1 sm:py-1.5 text-center font-display font-bold rounded-lg border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-xs sm:text-sm"
                        placeholder="—"
                      />
                    </td>
                    <td className="px-2 sm:px-5 py-2">
                      {g && (
                        <span
                          className={`inline-grid place-items-center size-6 sm:size-7 rounded-full font-bold text-[10px] sm:text-xs ${g.grade === "F"
                            ? "bg-red-100 text-red-700"
                            : "bg-brand/10 text-brand"
                            }`}
                        >
                          {g.grade}
                        </span>
                      )}
                    </td>
                    <td className="px-2 sm:px-5 py-2 text-[10px] sm:text-xs text-black/60 hidden sm:table-cell">
                      {g?.remark ?? ""}
                    </td>
                  </tr>
                );
              })}
              {classStudents.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 sm:py-12 text-black/40 text-xs sm:text-sm">
                    {searchTerm ? `No students found matching "${searchTerm}"` : "No students in this class."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Select component - responsive
function Select({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest font-bold text-black/50">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl border border-stone-200 bg-white text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
      >
        {options.length === 0 && <option value="">— none —</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// Stat component - responsive
function Stat({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  const color =
    tone === "good"
      ? "text-brand"
      : tone === "warn"
        ? "text-red-600"
        : "text-[#121212]";
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-2 sm:p-4">
      <div className="text-[8px] sm:text-[10px] uppercase tracking-widest font-bold text-black/40">
        {label}
      </div>
      <div className={`font-display text-base sm:text-2xl font-extrabold mt-0.5 sm:mt-1 ${color}`}>
        {value}
      </div>
    </div>
  );
}