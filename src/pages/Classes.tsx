import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, BookOpen, Search, X } from "lucide-react";
import { CompactPageLoader } from "@/components/CompactPageLoader";
import { getStoredSchoolSection } from "@/lib/schoolSystem";
import { toast } from "sonner";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "https://manfess-back.onrender.com/api";

// Types
interface Subject {
  id: string;
  name: string;
  code: string;
  section: "englophone";
  coefficient: number;
  cycle: string;
  periodsPerWeek: number;
  periodsByClass: Record<string, number>;
  classIds: string[];
  teacherIds: string[];
}

interface SchoolClass {
  id: string;
  className: string;
  department: string;
  cycle: string;
  schoolSection: "englophone";
  acedemicYear: string;
  classMasterId: string;
  ratePerPeriod: number;
  tuitionFee: number;
  tuitionInstallments: number;
  registrationFeeRequired: boolean;
  registrationFeeAmount: number;
}

interface Teacher {
  id: string;
  fullName: string;
  section: "englophone";
  subjectIds: string[];
}

export function ClassesPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [showNewClass, setShowNewClass] = useState(false);

  // Filters — Classes table
  const [classSearch, setClassSearch] = useState("");
  const [classDepartment, setClassDepartment] = useState("");
  const [classCycle, setClassCycle] = useState("");
  const [classYear, setClassYear] = useState("");

  // Filters — Subjects table
  const [subjectSearch, setSubjectSearch] = useState("");
  const [subjectCycle, setSubjectCycle] = useState("");
  const [subjectClassId, setSubjectClassId] = useState("");
  const [subjectTeacherId, setSubjectTeacherId] = useState("");

  const role: string = "admin";
  const canEdit = role === "super_admin" || role === "admin";

  // Unique filter options derived from the data
  const uniqueDepartments = useMemo(
    () => Array.from(new Set(classes.map((c) => c.department).filter(Boolean))).sort(),
    [classes]
  );
  const uniqueCycles = useMemo(
    () => Array.from(new Set(classes.map((c) => c.cycle).filter(Boolean))).sort(),
    [classes]
  );
  const uniqueYears = useMemo(
    () => Array.from(new Set(classes.map((c) => c.acedemicYear).filter(Boolean))).sort().reverse(),
    [classes]
  );
  const uniqueSubjectCycles = useMemo(
    () => Array.from(new Set(subjects.map((s) => s.cycle).filter(Boolean))).sort(),
    [subjects]
  );

  const filteredClasses = useMemo(() => {
    const q = classSearch.trim().toLowerCase();
    return classes.filter((c) => {
      if (q && !`${c.className} ${c.department}`.toLowerCase().includes(q) && !c.acedemicYear.toLowerCase().includes(q)) return false;
      if (classDepartment && c.department !== classDepartment) return false;
      if (classCycle && c.cycle !== classCycle) return false;
      if (classYear && c.acedemicYear !== classYear) return false;
      return true;
    });
  }, [classes, classSearch, classDepartment, classCycle, classYear]);

  const filteredSubjects = useMemo(() => {
    const q = subjectSearch.trim().toLowerCase();
    return subjects.filter((s) => {
      if (q && !s.name.toLowerCase().includes(q) && !s.code.toLowerCase().includes(q)) return false;
      if (subjectCycle && s.cycle !== subjectCycle) return false;
      if (subjectClassId && !s.classIds.includes(subjectClassId)) return false;
      if (subjectTeacherId && !s.teacherIds.includes(subjectTeacherId)) return false;
      return true;
    });
  }, [subjects, subjectSearch, subjectCycle, subjectClassId, subjectTeacherId]);

  const hasClassFilters = Boolean(classSearch || classDepartment || classCycle || classYear);
  const hasSubjectFilters = Boolean(subjectSearch || subjectCycle || subjectClassId || subjectTeacherId);

  const clearClassFilters = () => {
    setClassSearch("");
    setClassDepartment("");
    setClassCycle("");
    setClassYear("");
  };

  const clearSubjectFilters = () => {
    setSubjectSearch("");
    setSubjectCycle("");
    setSubjectClassId("");
    setSubjectTeacherId("");
  };

  // Helper to check if ID is a MongoDB ObjectId
  const isDatabaseId = (id: string) => {
    return /^[0-9a-fA-F]{24}$/.test(id);
  };

  // Fetch all data
  const fetchData = async () => {
    try {
      setLoading(true);
      console.log("Fetching data...");

      const activeSection = getStoredSchoolSection();
      const [subjectsRes, classesRes, teachersRes] = await Promise.all([
        axios.get(`${API_BASE}/subjects`, { params: { section: activeSection } }),
        axios.get(`${API_BASE}/classes`, { params: { section: activeSection } }),
        axios.get(`${API_BASE}/users`, { params: { section: activeSection } })
      ]);

      console.log("Subjects response:", subjectsRes.data);
      console.log("Classes response:", classesRes.data);
      console.log("Teachers response:", teachersRes.data);



      if (subjectsRes.data.success) {
        const mappedSubjects = subjectsRes.data.data.map((s: any) => ({
          id: s._id,
          name: s.name,
          code: s.code,
          section: s.section || "englophone",
          coefficient: s.coefficient,
          cycle: s.cycle,
          periodsPerWeek: s.periodsPerWeek ?? 4,
          periodsByClass: s.periodsByClass || {},
          classIds: s.classIds || [],
          teacherIds: s.teacherIds || []
        }));
        setSubjects(mappedSubjects);
      }

      if (classesRes.data.success) {
        const mappedClasses = classesRes.data.data.map((c: any) => ({
          id: c._id,
          className: c.className,
          department: c.department,
          cycle: c.cycle,
          schoolSection: c.schoolSection || c.section || "englophone",
          acedemicYear: c.acedemicYear,
          classMasterId: c.classMasterId || "",
          ratePerPeriod: c.ratePerPeriod ?? (c.cycle === "1st Cycle" ? 500 : 700),
          tuitionFee: Number(c.tuitionFee) || 0,
          tuitionInstallments: Number(c.tuitionInstallments) || 1,
          registrationFeeRequired: Boolean(c.registrationFeeRequired),
          registrationFeeAmount: Number(c.registrationFeeAmount) || 0,
        }));
        setClasses(mappedClasses);
      }

      if (teachersRes.data.success) {
        const mappedTeachers = teachersRes.data.data
          .filter((user: any) => user.role === "teacher")
          .map((user: any) => ({
            id: user._id,
            fullName: user.name,
            section: user.section || "englophone",
            subjectIds: user.subjectIds || []
          }));
        setTeachers(mappedTeachers);
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast.error(error.response?.data?.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Subject CRUD Operations
  const upsertSubject = async (subject: Subject) => {
    try {
      console.log("Upserting subject:", subject);

      // Validate
      if (!subject.name.trim()) {
        toast.error("Subject name is required");
        return;
      }
      if (!subject.code.trim()) {
        toast.error("Subject code is required");
        return;
      }
      if (!subject.coefficient || subject.coefficient < 1) {
        toast.error("Coefficient must be at least 1");
        return;
      }
      if (!subject.cycle) {
        toast.error("Cycle is required");
        return;
      }
      if (!subject.periodsPerWeek || subject.periodsPerWeek < 1) {
        toast.error("Periods per week must be at least 1");
        return;
      }

      // Only keep per-class overrides for classes the subject is assigned to.
      const periodsByClass: Record<string, number> = {};
      (subject.classIds || []).forEach((cid) => {
        const override = Number(subject.periodsByClass?.[cid]);
        if (Number.isFinite(override) && override >= 1) {
          periodsByClass[cid] = Math.max(1, Math.min(20, Math.floor(override)));
        }
      });

      const subjectData = {
        name: subject.name.trim(),
        code: subject.code.trim().toUpperCase(),
        section: subject.section || "englophone",
        coefficient: subject.coefficient,
        cycle: subject.cycle,
        periodsPerWeek: Math.max(1, Math.min(20, Number(subject.periodsPerWeek) || 4)),
        periodsByClass,
        classIds: subject.classIds || [],
        teacherIds: subject.teacherIds || []
      };

      console.log("Subject data to save:", subjectData);

      const isExisting = subject.id && isDatabaseId(subject.id);

      let response;
      if (isExisting) {
        response = await axios.put(`${API_BASE}/subjects/${subject.id}`, subjectData);
      } else {
        response = await axios.post(`${API_BASE}/subjects`, subjectData);
      }

      console.log("Response:", response.data);

      if (response.data.success) {
        toast.success(isExisting ? "Subject updated successfully" : "Subject added successfully");
        await fetchData();
        setEditingSubject(null);
        setShowNewSubject(false);
      }
    } catch (error: any) {
      console.error("Error saving subject:", error);
      console.error("Error response:", error.response?.data);

      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to save subject");
      }
    }
  };

  const removeSubject = async (id: string) => {
    if (!id || !isDatabaseId(id)) {
      toast.error("Cannot delete: Invalid subject ID");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this subject?")) return;

    try {
      const response = await axios.delete(`${API_BASE}/subjects/${id}`);
      if (response.data.success) {
        toast.success("Subject deleted successfully");
        await fetchData();
      }
    } catch (error: any) {
      console.error("Error deleting subject:", error);
      toast.error(error.response?.data?.message || "Failed to delete subject");
    }
  };

  // Class CRUD Operations
  const upsertClass = async (schoolClass: SchoolClass) => {
    try {
      console.log("Upserting class:", schoolClass);

      // Validate
      if (!schoolClass.className) {
        toast.error("Class name is required");
        return;
      }
      if (!schoolClass.department) {
        toast.error("Department is required");
        return;
      }
      if (!schoolClass.cycle) {
        toast.error("Cycle is required");
        return;
      }
      if (!schoolClass.acedemicYear) {
        toast.error("Academic year is required");
        return;
      }


      const classData = {
        className: schoolClass.className,
        department: schoolClass.department,
        cycle: schoolClass.cycle,
        schoolSection: schoolClass.schoolSection || "englophone",
        acedemicYear: schoolClass.acedemicYear,
        classMasterId: schoolClass.classMasterId,
        ratePerPeriod: Number(schoolClass.ratePerPeriod) || 0,
        tuitionFee: Number(schoolClass.tuitionFee),
        tuitionInstallments: Number(schoolClass.tuitionInstallments),
        registrationFeeRequired: schoolClass.registrationFeeRequired,
        registrationFeeAmount: schoolClass.registrationFeeRequired ? Number(schoolClass.registrationFeeAmount) : 0,
      };

      console.log("Class data to save:", classData);

      const isExisting = schoolClass.id && isDatabaseId(schoolClass.id);

      let response;
      if (isExisting) {
        response = await axios.put(`${API_BASE}/classes/${schoolClass.id}`, classData);
      } else {
        response = await axios.post(`${API_BASE}/classes`, classData);
      }

      console.log("Response:", response.data);

      if (response.data.success) {
        toast.success(isExisting ? "Class updated successfully" : "Class added successfully");
        await fetchData();
        setEditingClass(null);
        setShowNewClass(false);
      }
    } catch (error: any) {
      console.error("Error saving class:", error);
      console.error("Error response:", error.response?.data);

      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to save class");
      }
    }
  };

  const removeClass = async (id: string) => {
    if (!id || !isDatabaseId(id)) {
      toast.error("Cannot delete: Invalid class ID");
      return;
    }

    if (!window.confirm("Are you sure you want to delete this class?")) return;

    try {
      const response = await axios.delete(`${API_BASE}/classes/${id}`);
      if (response.data.success) {
        toast.success("Class deleted successfully");
        await fetchData();
      }
    } catch (error: any) {
      console.error("Error deleting class:", error);
      toast.error(error.response?.data?.message || "Failed to delete class");
    }
  };

  if (loading) {
    return <CompactPageLoader label="Loading classes and subjects..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Classes & Subjects</h1>
        <p className="text-sm text-black/60 mt-1">Cameroonian secondary structure · Forms 1–Upper 6th · Arts / Science / Commercial</p>
      </div>

      <div className="grid min-w-0 gap-6 items-start lg:grid-cols-2">
        {/* Classes Table */}
        <div className="flex min-w-0 max-h-[620px] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3 sm:px-5 sm:py-4">
            <h3 className="min-w-0 flex-1 font-display font-bold">
              Classes ({filteredClasses.length}{hasClassFilters ? ` of ${classes.length}` : ""})
            </h3>
            {canEdit && (
              <button
                onClick={() => {
                  setEditingClass(null);
                  setShowNewClass(true);
                }}
                className="flex min-h-10 shrink-0 items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand/90"
              >
                <Plus className="size-3.5" /> Class
              </button>
            )}
          </div>

          <div className="space-y-2 border-b border-stone-200 px-3 py-3 sm:px-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/40" />
              <input
                type="text"
                placeholder="Search class or academic year..."
                value={classSearch}
                onChange={(e) => setClassSearch(e.target.value)}
                className="w-full pl-10 pr-8 py-2 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              />
              {classSearch && (
                <button
                  onClick={() => setClassSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black/70"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={classDepartment}
                onChange={(e) => setClassDepartment(e.target.value)}
                className="min-w-0 max-w-full flex-1 basis-[calc(50%-0.5rem)] rounded-xl border border-stone-200 bg-white px-2 py-2 text-xs font-medium sm:flex-none sm:basis-auto sm:px-3 sm:py-1.5"
              >
                <option value="">All Departments</option>
                {uniqueDepartments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <select
                value={classCycle}
                onChange={(e) => setClassCycle(e.target.value)}
                className="min-w-0 max-w-full flex-1 basis-[calc(50%-0.5rem)] rounded-xl border border-stone-200 bg-white px-2 py-2 text-xs font-medium sm:flex-none sm:basis-auto sm:px-3 sm:py-1.5"
              >
                <option value="">All Cycles</option>
                {uniqueCycles.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={classYear}
                onChange={(e) => setClassYear(e.target.value)}
                className="min-w-0 max-w-full flex-1 basis-[calc(50%-0.5rem)] rounded-xl border border-stone-200 bg-white px-2 py-2 text-xs font-medium sm:flex-none sm:basis-auto sm:px-3 sm:py-1.5"
              >
                <option value="">All Years</option>
                {uniqueYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              {hasClassFilters && (
                <button
                  onClick={clearClassFilters}
                  className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-semibold hover:bg-stone-50"
                >
                  <X className="size-3.5" /> Clear
                </button>
              )}
            </div>
          </div>
          <div className="min-h-0 min-w-0 max-h-[470px] overflow-auto overscroll-contain">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-stone-50 text-left text-[10px] uppercase tracking-widest text-black/50 font-bold sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-3">Class</th>
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Cycle</th>
                  <th className="px-5 py-3">Rate / Period</th>
                  <th className="px-5 py-3">Tuition</th>
                  <th className="px-5 py-3">Installments</th>
                  <th className="px-5 py-3">Registration</th>
                  <th className="px-5 py-3">Academic Year</th>
                  {canEdit && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredClasses.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50">
                    <td className="px-5 py-3 font-semibold">{c.className}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-stone-100 font-medium">
                        {c.department}
                      </span>
                    </td>
                    <td className="px-5 py-3">{c.cycle}</td>
                    <td className="px-5 py-3 text-sm font-semibold">{c.ratePerPeriod.toLocaleString()} FRS</td>
                    <td className="px-5 py-3 text-sm font-semibold">{c.tuitionFee.toLocaleString()} XAF</td>
                    <td className="px-5 py-3 text-sm">{c.tuitionInstallments}</td>
                    <td className="px-5 py-3 text-xs">{c.registrationFeeRequired ? `${c.registrationFeeAmount.toLocaleString()} XAF required` : "Not required"}</td>
                    <td className="px-5 py-3 text-xs">{c.acedemicYear}</td>
                    {canEdit && (
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setShowNewClass(false);
                              setEditingClass(c);
                            }}
                            className="grid size-10 place-items-center rounded-lg text-black/60 hover:bg-stone-100 sm:size-8"
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            onClick={() => removeClass(c.id)}
                            className="grid size-10 place-items-center rounded-lg text-red-600 hover:bg-red-50 sm:size-8"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {filteredClasses.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 9 : 8} className="px-5 py-8 text-center text-black/40">
                      {classes.length === 0
                        ? 'No classes found. Click "Add Class" to create one.'
                        : "No classes match your filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Subjects Table */}
        <div className="flex min-w-0 max-h-[620px] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 px-4 py-3 sm:px-5 sm:py-4">
            <h3 className="min-w-0 flex-1 font-display font-bold">
              Subjects ({filteredSubjects.length}{hasSubjectFilters ? ` of ${subjects.length}` : ""})
            </h3>
            {canEdit && (
              <button
                onClick={() => {
                  setEditingSubject(null);
                  setShowNewSubject(true);
                }}
                className="flex min-h-10 shrink-0 items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand/90"
              >
                <Plus className="size-3.5" /> Subject
              </button>
            )}
          </div>

          <div className="space-y-2 border-b border-stone-200 px-3 py-3 sm:px-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/40" />
              <input
                type="text"
                placeholder="Search subject or code..."
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                className="w-full pl-10 pr-8 py-2 rounded-xl border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
              />
              {subjectSearch && (
                <button
                  onClick={() => setSubjectSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black/70"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={subjectCycle}
                onChange={(e) => setSubjectCycle(e.target.value)}
                className="min-w-0 max-w-full flex-1 basis-[calc(50%-0.5rem)] rounded-xl border border-stone-200 bg-white px-2 py-2 text-xs font-medium sm:flex-none sm:basis-auto sm:px-3 sm:py-1.5"
              >
                <option value="">All Cycles</option>
                {uniqueSubjectCycles.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={subjectClassId}
                onChange={(e) => setSubjectClassId(e.target.value)}
                className="min-w-0 max-w-full flex-1 basis-[calc(50%-0.5rem)] rounded-xl border border-stone-200 bg-white px-2 py-2 text-xs font-medium sm:flex-none sm:basis-auto sm:px-3 sm:py-1.5"
              >
                <option value="">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.className + " " + c.department}</option>
                ))}
              </select>
              <select
                value={subjectTeacherId}
                onChange={(e) => setSubjectTeacherId(e.target.value)}
                className="min-w-0 max-w-full flex-1 basis-[calc(50%-0.5rem)] rounded-xl border border-stone-200 bg-white px-2 py-2 text-xs font-medium sm:flex-none sm:basis-auto sm:px-3 sm:py-1.5"
              >
                <option value="">All Teachers</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.fullName}</option>
                ))}
              </select>
              {hasSubjectFilters && (
                <button
                  onClick={clearSubjectFilters}
                  className="flex min-h-10 shrink-0 items-center gap-1 rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-semibold hover:bg-stone-50"
                >
                  <X className="size-3.5" /> Clear
                </button>
              )}
            </div>
          </div>
          <div className="min-h-0 min-w-0 max-h-[470px] overflow-auto overscroll-contain">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-stone-50 text-left text-[10px] uppercase tracking-widest text-black/50 font-bold sticky top-0 z-10">
                <tr>
                  <th className="px-5 py-3">Subject</th>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3 text-center">Coef</th>
                  <th className="px-5 py-3 text-center">Periods/Wk</th>
                  <th className="px-5 py-3">Cycle</th>
                  <th className="px-5 py-3">Teachers</th>
                  {canEdit && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredSubjects.map((s) => {
                  const subjectTeachers = teachers.filter((t) => s.teacherIds.includes(t.id));
                  return (
                    <tr key={s.id} className="hover:bg-stone-50">
                      <td className="px-5 py-3 font-semibold">{s.name}</td>
                      <td className="px-5 py-3 font-mono text-xs">{s.code}</td>
                      <td className="px-5 py-3 text-center">
                        <span className="size-7 inline-grid place-items-center rounded-full bg-brand/10 text-brand font-bold text-xs">
                          {s.coefficient}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span
                          className="text-xs font-bold text-brand"
                          title={Object.keys(s.periodsByClass || {}).length > 0 ? "Some classes have custom period counts" : undefined}
                        >
                          {s.periodsPerWeek ?? 4}{Object.keys(s.periodsByClass || {}).length > 0 ? "*" : ""}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs">{s.cycle}</td>
                      <td className="px-5 py-3 text-xs text-black/60">
                        {subjectTeachers.length
                          ? subjectTeachers.map((t) => t.fullName.split(" ").slice(-1)[0]).join(", ")
                          : <span className="text-black/30 italic">Unassigned</span>
                        }
                      </td>
                      {canEdit && (
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => {
                                setShowNewSubject(false);
                                setEditingSubject(s);
                              }}
                              className="grid size-10 place-items-center rounded-lg text-black/60 hover:bg-stone-100 sm:size-8"
                            >
                              <Pencil className="size-3" />
                            </button>
                            <button
                              onClick={() => removeSubject(s.id)}
                              className="grid size-10 place-items-center rounded-lg text-red-600 hover:bg-red-50 sm:size-8"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filteredSubjects.length === 0 && (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6} className="px-5 py-8 text-center text-black/40">
                      {subjects.length === 0
                        ? 'No subjects found. Click "Add Subject" to create one.'
                        : "No subjects match your filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Subject Dialog */}
      {(editingSubject || showNewSubject) && (
        <SubjectDialog
          initial={editingSubject ?? {
            id: "s_" + Math.random().toString(36).slice(2, 9),
            name: "",
            code: "",
            section: getStoredSchoolSection(),
            coefficient: 1,
            cycle: "1st Cycle",
            periodsPerWeek: 4,
            periodsByClass: {},
            classIds: [],
            teacherIds: []
          }}
          classes={classes}
          teachers={teachers}
          onSave={upsertSubject}
          onCancel={() => { setEditingSubject(null); setShowNewSubject(false); }}
        />
      )}

      {/* Class Dialog */}
      {(editingClass || showNewClass) && (
        <ClassDialog
          initial={editingClass ?? {
            id: "c_" + Math.random().toString(36).slice(2, 9),
            className: "",
            department: "Science",
            cycle: "1st Cycle",
            schoolSection: getStoredSchoolSection(),
            acedemicYear: "2024-2025",
            classMasterId: "",
            ratePerPeriod: 500,
            tuitionFee: 0,
            tuitionInstallments: 1,
            registrationFeeRequired: false,
            registrationFeeAmount: 0,
          }}
          teachers={teachers}
          onSave={upsertClass}
          onCancel={() => { setEditingClass(null); setShowNewClass(false); }}
        />
      )}
    </div>
  );
}

// Subject Dialog Component
function SubjectDialog({
  initial,
  classes,
  teachers,
  onSave,
  onCancel
}: {
  initial: Subject;
  classes: SchoolClass[];
  teachers: Teacher[];
  onSave: (s: Subject) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Subject>(initial);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Subject>(k: K, v: Subject[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const sectionClasses = classes.filter((schoolClass) => schoolClass.schoolSection === form.section);
  const sectionTeachers = teachers.filter((teacher) => teacher.section === form.section);

  const toggleClass = (id: string) => {
    if (form.classIds.includes(id)) {
      set("classIds", form.classIds.filter((x) => x !== id));
      // Drop the override so unassigned classes never carry stale data.
      const next = { ...form.periodsByClass };
      delete next[id];
      set("periodsByClass", next);
    } else {
      set("classIds", [...form.classIds, id]);
    }
  };

  const setClassPeriods = (classId: string, value: number) =>
    set("periodsByClass", {
      ...form.periodsByClass,
      [classId]: Math.max(1, Math.min(20, Number(value) || 1)),
    });

  const toggleTeacher = (id: string) =>
    set("teacherIds", form.teacherIds.includes(id)
      ? form.teacherIds.filter((x) => x !== id)
      : [...form.teacherIds, id]
    );

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setSaving(false);
    }
  };

  const cycles = ["1st Cycle", "2nd Cycle"];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display font-bold text-xl mb-5 flex items-center gap-2">
          <BookOpen className="size-5 text-brand" />
          {initial.name ? "Edit Subject" : "Add Subject"}
        </h3>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Name*">
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={inputCls}
              required
              placeholder="e.g., Mathematics"
            />
          </Field>
          <Field label="Code*">
            <input
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              className={inputCls}
              required
              placeholder="e.g., MATH101"
            />
          </Field>
          <Field label="Coefficient*">
            <input
              type="number"
              min={1}
              max={10}
              value={form.coefficient}
              onChange={(e) => set("coefficient", Number(e.target.value))}
              className={inputCls}
              required
            />
          </Field>
          <Field label="Cycle*">
            <select
              value={form.cycle}
              onChange={(e) => set("cycle", e.target.value)}
              className={inputCls}
            >
              <option value="">Select cycle</option>
              {cycles.map((cycle) => (
                <option key={cycle} value={cycle}>{cycle}</option>
              ))}
            </select>
          </Field>
          <Field label="Default Periods / Week*">
            <input
              type="number"
              min={1}
              max={20}
              value={form.periodsPerWeek}
              onChange={(e) => set("periodsPerWeek", Number(e.target.value) || 1)}
              className={inputCls}
              required
            />
          </Field>
        </div>

        <p className="text-[11px] text-black/40 mt-1">
          The default is used for every assigned class during timetable auto-generation. Set class-specific values under "Assigned to Classes" below (e.g. Physics: 4 in OLevel 3, 5 in OLevel 5).
        </p>

        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-widest font-bold text-black/50 mb-2">Assigned to Classes</div>
          <div className="flex flex-wrap gap-2">
            {sectionClasses.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleClass(c.id)}
                className={`text-xs px-3 py-1.5 rounded-full font-bold border ${form.classIds.includes(c.id)
                  ? "bg-brand text-white border-brand"
                  : "border-stone-200 text-black/60 hover:bg-stone-50"
                  }`}
              >
                {c.className + " " + c.department}
              </button>
            ))}
            {sectionClasses.length === 0 && (
              <span className="text-xs text-black/40">No classes available</span>
            )}
          </div>

          {form.classIds.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-[10px] uppercase tracking-widest font-bold text-black/50">Periods per week by class</div>
              {sectionClasses
                .filter((c) => form.classIds.includes(c.id))
                .map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 bg-stone-50 rounded-lg px-3 py-2">
                    <span className="text-xs font-semibold text-black/70">{c.className + " " + c.department}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={form.periodsByClass[c.id] ?? form.periodsPerWeek ?? 4}
                        onChange={(e) => setClassPeriods(c.id, Number(e.target.value))}
                        className="w-16 px-2 py-1 rounded-lg border border-stone-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand/30"
                      />
                      <span className="text-[10px] text-black/40">/ week</span>
                    </div>
                  </div>
                ))}
              <p className="text-[11px] text-black/40">Leave a class untouched to use the default periods per week.</p>
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-widest font-bold text-black/50 mb-2">Assigned Teachers</div>
          <div className="flex flex-wrap gap-2">
            {sectionTeachers.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTeacher(t.id)}
                className={`text-xs px-3 py-1.5 rounded-full font-bold border ${form.teacherIds.includes(t.id)
                  ? "bg-brand text-white border-brand"
                  : "border-stone-200 text-black/60 hover:bg-stone-50"
                  }`}
              >
                {t.fullName}
              </button>
            ))}
            {sectionTeachers.length === 0 && (
              <span className="text-xs text-black/40">No teachers available</span>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold hover:bg-stone-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Subject"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Class Dialog Component
function ClassDialog({
  initial,
  teachers,
  onSave,
  onCancel
}: {
  initial: SchoolClass;
  teachers: Teacher[];
  onSave: (c: SchoolClass) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<SchoolClass>(initial);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof SchoolClass>(k: K, v: SchoolClass[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const classNames = ["Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Lower 6th", "Upper 6th", "Graduated"];
  const departments = [
    "General", "Science", "Arts", "Commercial", "Electrical & Electronics",
    "Civil Engineering & Woodwork", "Mechanical", "Home Economics & Social",
    "Accounting", "Marketing & Sales", "Secretarial Administration & Communication",
    "Home Economics & Social Care"
  ];
  const cycles = ["1st Cycle", "2nd Cycle"];
  const academicYears = ["2026-2027", "2027-2028", "2028-2029"];
  const sectionTeachers = teachers.filter((teacher) => teacher.section === "englophone");

  const handleSave = async () => {
    // Validate before saving
    if (!form.className) {
      toast.error("Please select a class name");
      return;
    }
    if (!form.department) {
      toast.error("Please select a department");
      return;
    }
    if (!form.cycle) {
      toast.error("Please select a cycle");
      return;
    }
    if (!form.acedemicYear) {
      toast.error("Please select an academic year");
      return;
    }
    if (form.className !== "Graduated" && form.tuitionFee <= 0) {
      toast.error("Set a tuition amount greater than zero");
      return;
    }
    if (!Number.isInteger(form.tuitionInstallments) || form.tuitionInstallments < 1 || form.tuitionInstallments > 12) {
      toast.error("Choose between 1 and 12 tuition installments");
      return;
    }
    if (form.registrationFeeRequired && form.registrationFeeAmount <= 0) {
      toast.error("Set the registration fee amount or turn off the registration fee requirement");
      return;
    }


    setSaving(true);
    try {
      await onSave(form);
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display font-bold text-xl mb-5">
          {initial.className ? "Edit Class" : "Add Class"}
        </h3>

        <div className="space-y-4">
          <Field label="Class Name*">
            <select
              value={form.className}
              onChange={(e) => set("className", e.target.value)}
              className={inputCls}
              required
            >
              <option value="">Select class</option>
              {classNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </Field>

          <Field label="Department*">
            <select
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
              className={inputCls}
              required
            >
              <option value="">Select department</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </Field>

          <Field label="Cycle*">
            <select
              value={form.cycle}
              onChange={(e) => {
                const nextCycle = e.target.value;
                setForm((current) => ({
                  ...current,
                  cycle: nextCycle,
                  ratePerPeriod: current.ratePerPeriod === (current.cycle === "1st Cycle" ? 500 : 700)
                    ? nextCycle === "1st Cycle" ? 500 : 700
                    : current.ratePerPeriod,
                }));
              }}
              className={inputCls}
              required
            >
              <option value="">Select cycle</option>
              {cycles.map((cycle) => (
                <option key={cycle} value={cycle}>{cycle}</option>
              ))}
            </select>
          </Field>

          <Field label="Academic Year*">
            <select
              value={form.acedemicYear}
              onChange={(e) => set("acedemicYear", e.target.value)}
              className={inputCls}
              required
            >
              <option value="">Select academic year</option>
              {academicYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </Field>

          <Field label="Class Master*">
            <select
              value={form.classMasterId}
              onChange={(e) => set("classMasterId", e.target.value)}
              className={inputCls}
              required
            >
              <option value="">Select class master</option>
              {sectionTeachers.map((t) => (
                <option key={t.id} value={t.id}>{t.fullName}</option>
              ))}
            </select>
          </Field>

          <Field label="Teacher Pay Per Period (FRS)*">
            <input
              type="number"
              min={0}
              step={50}
              value={form.ratePerPeriod}
              onChange={(e) => set("ratePerPeriod", Math.max(0, Number(e.target.value) || 0))}
              className={inputCls}
              required
            />
          </Field>
          <Field label="Student Tuition (XAF)*">
            <input
              type="number"
              min={form.className === "Graduated" ? 0 : 1}
              step={1000}
              value={form.tuitionFee}
              onChange={(e) => set("tuitionFee", Math.max(0, Number(e.target.value) || 0))}
              className={inputCls}
              required={form.className !== "Graduated"}
            />
          </Field>
          <Field label="Tuition Installments (1–12)*">
            <input
              type="number"
              min={1}
              max={12}
              step={1}
              value={form.tuitionInstallments}
              onChange={(e) => set("tuitionInstallments", Number(e.target.value) || 1)}
              className={inputCls}
              required
            />
          </Field>
          <label className="flex items-center gap-3 rounded-lg border border-stone-200 px-3 py-2.5 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.registrationFeeRequired}
              onChange={(e) => setForm((current) => ({
                ...current,
                registrationFeeRequired: e.target.checked,
                registrationFeeAmount: e.target.checked ? current.registrationFeeAmount : 0,
              }))}
              className="size-4 accent-blue-700"
            />
            <span className="text-sm font-semibold">Require a separate registration fee</span>
          </label>
          {form.registrationFeeRequired && (
            <Field label="Registration Fee (XAF)*">
              <input
                type="number"
                min={1}
                step={500}
                value={form.registrationFeeAmount}
                onChange={(e) => set("registrationFeeAmount", Math.max(0, Number(e.target.value) || 0))}
                className={inputCls}
                required
              />
            </Field>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold hover:bg-stone-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Class"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest font-bold text-black/50">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}