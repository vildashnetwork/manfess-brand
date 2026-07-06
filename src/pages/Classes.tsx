import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const API_BASE = "https://manfess-back.onrender.com/api";

// Types
interface Subject {
  id: string;
  name: string;
  code: string;
  coefficient: number;
  cycle: string;
  classIds: string[];
  teacherIds: string[];
}

interface SchoolClass {
  id: string;
  className: string;
  department: string;
  cycle: string;
  acedemicYear: string;
  classMasterId: string;
}

interface Teacher {
  id: string;
  fullName: string;
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

  const role = "admin";
  const canEdit = role === "super_admin" || role === "admin";

  // Helper to check if ID is a MongoDB ObjectId
  const isDatabaseId = (id: string) => {
    return /^[0-9a-fA-F]{24}$/.test(id);
  };

  // Fetch all data
  const fetchData = async () => {
    try {
      setLoading(true);
      console.log("Fetching data...");

      const [subjectsRes, classesRes, teachersRes] = await Promise.all([
        axios.get(`${API_BASE}/subjects`),
        axios.get(`${API_BASE}/classes`),
        axios.get(`${API_BASE}/users`)
      ]);

      console.log("Subjects response:", subjectsRes.data);
      console.log("Classes response:", classesRes.data);
      console.log("Teachers response:", teachersRes.data);



      if (subjectsRes.data.success) {
        const mappedSubjects = subjectsRes.data.data.map((s: any) => ({
          id: s._id,
          name: s.name,
          code: s.code,
          coefficient: s.coefficient,
          cycle: s.cycle,
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
          acedemicYear: c.acedemicYear,
          classMasterId: c.classMasterId || ""
        }));
        setClasses(mappedClasses);
      }

      if (teachersRes.data.success) {
        const mappedTeachers = teachersRes.data.data
          .filter((user: any) => user.role === "teacher")
          .map((user: any) => ({
            id: user._id,
            fullName: user.name,
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

      const subjectData = {
        name: subject.name.trim(),
        code: subject.code.trim().toUpperCase(),
        coefficient: subject.coefficient,
        cycle: subject.cycle,
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
        acedemicYear: schoolClass.acedemicYear,
        classMasterId: schoolClass.classMasterId
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-black/60">Loading data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Classes & Subjects</h1>
        <p className="text-sm text-black/60 mt-1">Cameroonian secondary structure · Forms 1–Upper 6th · Arts / Science / Commercial</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Classes Table */}
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
            <h3 className="font-display font-bold">Classes ({classes.length})</h3>
            {canEdit && (
              <button
                onClick={() => {
                  setEditingClass(null);
                  setShowNewClass(true);
                }}
                className="flex items-center gap-1 text-xs px-3 py-1.5 bg-brand text-white rounded-lg font-bold hover:bg-brand/90"
              >
                <Plus className="size-3.5" /> Class
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-[10px] uppercase tracking-widest text-black/50 font-bold">
                <tr>
                  <th className="px-5 py-3">Class</th>
                  <th className="px-5 py-3">Department</th>
                  <th className="px-5 py-3">Cycle</th>
                  <th className="px-5 py-3">Academic Year</th>
                  {canEdit && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {classes.map((c) => (
                  <tr key={c.id} className="hover:bg-stone-50">
                    <td className="px-5 py-3 font-semibold">{c.className}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-stone-100 font-medium">
                        {c.department}
                      </span>
                    </td>
                    <td className="px-5 py-3">{c.cycle}</td>
                    <td className="px-5 py-3 text-xs">{c.acedemicYear}</td>
                    {canEdit && (
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              setShowNewClass(false);
                              setEditingClass(c);
                            }}
                            className="size-7 grid place-items-center rounded-lg hover:bg-stone-100 text-black/60"
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            onClick={() => removeClass(c.id)}
                            className="size-7 grid place-items-center rounded-lg hover:bg-red-50 text-red-600"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {classes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-black/40">
                      No classes found. Click "Add Class" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Subjects Table */}
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
            <h3 className="font-display font-bold">Subjects ({subjects.length})</h3>
            {canEdit && (
              <button
                onClick={() => {
                  setEditingSubject(null);
                  setShowNewSubject(true);
                }}
                className="flex items-center gap-1 text-xs px-3 py-1.5 bg-brand text-white rounded-lg font-bold hover:bg-brand/90"
              >
                <Plus className="size-3.5" /> Subject
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 text-left text-[10px] uppercase tracking-widest text-black/50 font-bold">
                <tr>
                  <th className="px-5 py-3">Subject</th>
                  <th className="px-5 py-3">Code</th>
                  <th className="px-5 py-3 text-center">Coef</th>
                  <th className="px-5 py-3">Cycle</th>
                  <th className="px-5 py-3">Teachers</th>
                  {canEdit && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {subjects.map((s) => {
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
                              className="size-7 grid place-items-center rounded-lg hover:bg-stone-100 text-black/60"
                            >
                              <Pencil className="size-3" />
                            </button>
                            <button
                              onClick={() => removeSubject(s.id)}
                              className="size-7 grid place-items-center rounded-lg hover:bg-red-50 text-red-600"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {subjects.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-black/40">
                      No subjects found. Click "Add Subject" to create one.
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
            coefficient: 1,
            cycle: "1st Cycle",
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
            acedemicYear: "2024-2025",
            classMasterId: ""
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

  const toggleClass = (id: string) =>
    set("classIds", form.classIds.includes(id)
      ? form.classIds.filter((x) => x !== id)
      : [...form.classIds, id]
    );

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
        </div>

        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-widest font-bold text-black/50 mb-2">Assigned to Classes</div>
          <div className="flex flex-wrap gap-2">
            {classes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleClass(c.id)}
                className={`text-xs px-3 py-1.5 rounded-full font-bold border ${form.classIds.includes(c.id)
                    ? "bg-brand text-white border-brand"
                    : "border-stone-200 text-black/60 hover:bg-stone-50"
                  }`}
              >
                {c.className}
              </button>
            ))}
            {classes.length === 0 && (
              <span className="text-xs text-black/40">No classes available</span>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-widest font-bold text-black/50 mb-2">Assigned Teachers</div>
          <div className="flex flex-wrap gap-2">
            {teachers.map((t) => (
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
            {teachers.length === 0 && (
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
  const departments = ["Science", "Arts", "Commercial"];
  const cycles = ["1st Cycle", "2nd Cycle"];
  const academicYears = ["2026-2027", "2027-2028", "2028-2029"];

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
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
              onChange={(e) => set("cycle", e.target.value)}
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
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.fullName}</option>
              ))}
            </select>
          </Field>
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