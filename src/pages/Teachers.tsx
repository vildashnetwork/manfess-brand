








import { useState, useEffect, useMemo } from "react";
import { Mail, Phone, BookOpen, Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { CompactPageLoader } from "@/components/CompactPageLoader";
import { getStoredSchoolSection } from "@/lib/schoolSystem";
import { toast } from "sonner";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL ?? "https://manfess-back.onrender.com/api";



interface Teacher {
  id: string;
  fullName: string;
  qualification: string;
  phone: string;
  email: string;
  section: "englophone";
  subjectIds: string[];
  classIds: string[];
  role?: string;
  username?: string;
  acedemicYear?: string;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  section: "englophone";
}

interface Class {
  id: string;
  className: string;
  department?: string;
  cycle?: string;
  schoolSection: "englophone";
  acedemicYear?: string;
}

export function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const role: string = "admin";
  const canEdit = role === "super_admin" || role === "admin";

  const isDatabaseId = (id: string) => {
    return /^[0-9a-fA-F]{24}$/.test(id);
  };

  const filteredTeachers = useMemo(() => {
    if (!searchTerm.trim()) return teachers;
    const term = searchTerm.toLowerCase().trim();
    return teachers.filter(teacher =>
      teacher.fullName.toLowerCase().includes(term) ||
      teacher.email.toLowerCase().includes(term) ||
      teacher.phone.includes(term) ||
      teacher.qualification?.toLowerCase().includes(term)
    );
  }, [teachers, searchTerm]);

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const activeSection = getStoredSchoolSection();
      const response = await axios.get(`${API_BASE}/users`, { params: { section: activeSection } });
      if (response.data.success) {
        const mappedTeachers = response.data.data.map((user: any) => ({
          id: user._id,
          fullName: user.name,
          qualification: user.qualification || "",
          phone: user.phone,
          email: user.username,
          section: user.section || "englophone",
          subjectIds: user.subjectIds || [],
          classIds: user.classIds || [],
          role: user.role,
          username: user.username,
          acedemicYear: user.acedemicYear
        }));
        setTeachers(mappedTeachers);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to fetch teachers");
      console.error("Error fetching teachers:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const activeSection = getStoredSchoolSection();
      const response = await axios.get(`${import.meta.env.VITE_API_URL ?? "https://manfess-back.onrender.com/api"}/subjects`, { params: { section: activeSection } });
      if (response.data.success) {
        const mappedSubjects = response.data.data.map((subj: any) => ({
          id: subj._id || subj.id,
          name: subj.name,
          code: subj.code,
          section: subj.section || "englophone"
        }));
        setSubjects(mappedSubjects);
        console.log("📚 Subjects loaded:", mappedSubjects);
      }
    } catch (error) {
      console.error("Error fetching subjects:", error);
    }
  };

  const fetchClasses = async () => {
    try {
      const activeSection = getStoredSchoolSection();
      const response = await axios.get(`${import.meta.env.VITE_API_URL ?? "https://manfess-back.onrender.com/api"}/classes`, { params: { section: activeSection } });
      if (response.data.success) {

        console.log("📚 Raw classes from API:", response.data.data);

        // Map classes with all available fields
        const mappedClasses = response.data.data.map((cls: any) => {
          // Log each class to see what fields are available
          console.log("Class data:", cls);

          return {
            id: cls._id || cls.id,
            className: cls.className || cls.name || "Unknown",
            department: cls.department || cls.section || "",
            cycle: cls.cycle || "",
            schoolSection: cls.schoolSection || cls.section || "englophone",
            acedemicYear: cls.acedemicYear || cls.academicYear || ""
          };
        });

        setClasses(mappedClasses);
        console.log("📚 Mapped classes:", mappedClasses);
      }
    } catch (error) {
      console.error("Error fetching classes:", error);
      toast.error("Failed to fetch classes");
    }
  };

  useEffect(() => {
    fetchTeachers();
    fetchSubjects();
    fetchClasses();
  }, []);

  const upsert = async (teacher: Teacher) => {
    try {
      if (!teacher.fullName.trim()) {
        toast.error("Full name is required");
        return;
      }
      if (!teacher.email.trim()) {
        toast.error("Username is required");
        return;
      }
      if (!teacher.phone.trim()) {
        toast.error("Phone number is required");
        return;
      }
      if (!teacher.acedemicYear) {
        toast.error("Academic year is required");
        return;
      }

      const userData = {
        name: teacher.fullName.trim(),
        username: teacher.email.trim(),
        phone: teacher.phone.trim(),
        role: teacher.role || "teacher",
        section: teacher.section || "englophone",
        qualification: teacher.qualification || "",
        subjectIds: teacher.subjectIds || [],
        classIds: teacher.classIds || [],
        acedemicYear: teacher.acedemicYear
      };

      const isExisting = teacher.id && isDatabaseId(teacher.id);

      let response;
      if (isExisting) {
        response = await axios.put(`${API_BASE}/users/${teacher.id}`, userData);
        if (response.data.success) {
          toast.success("Teacher updated successfully");
          await fetchTeachers();
        }
      } else {
        response = await axios.post(`${API_BASE}/users`, userData);
        if (response.data.success) {
          toast.success("Teacher added successfully");
          await fetchTeachers();
        }
      }

      setEditing(null);
      setShowNew(false);
    } catch (error: any) {
      console.error("Error saving teacher:", error);
      if (error.response) {
        const errorMessage = error.response.data?.message || "Operation failed";
        if (error.response.status === 500) {
          toast.error("Server error. Please try again later.");
        } else if (error.response.status === 400) {
          if (errorMessage.toLowerCase().includes("username") || errorMessage.toLowerCase().includes("duplicate")) {
            toast.error("Username already exists. Please use a different one.");
          } else if (errorMessage.toLowerCase().includes("phone")) {
            toast.error("Phone number already exists. Please use a different one.");
          } else {
            toast.error(`Validation error: ${errorMessage}`);
          }
        } else {
          toast.error(`Error: ${errorMessage}`);
        }
      } else if (error.request) {
        toast.error("No response from server. Please check your connection.");
      } else {
        toast.error(`Error: ${error.message}`);
      }
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this teacher?")) return;
    try {
      const response = await axios.delete(`${API_BASE}/users/${id}`);
      if (response.data.success) {
        toast.success("Teacher deleted successfully");
        await fetchTeachers();
      }
    } catch (error: any) {
      console.error("Error deleting teacher:", error);
      toast.error(error.response?.data?.message || "Failed to delete teacher");
    }
  };

  if (loading) {
    return <CompactPageLoader label="Loading teachers..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Teachers</h1>
          <p className="text-sm text-black/60 mt-1">{teachers.length} active faculty members</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90"
          >
            <Plus className="size-4" /> Add Teacher
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/40" />
        <input
          type="text"
          placeholder="Search teachers by name, email, phone..."
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

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTeachers.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-black/40">
              {searchTerm ? `No teachers found matching "${searchTerm}"` : "No teachers found"}
            </p>
          </div>
        ) : (
          filteredTeachers.map((t) => {
            const teacherSubjects = subjects.filter((s) => t.subjectIds.includes(s.id));
            const teacherClasses = classes.filter((c) => t.classIds.includes(c.id));
            return (
              <div key={t.id} className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4 transition-shadow hover:shadow-md sm:p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-12 bg-brand/10 text-brand grid place-items-center rounded-xl font-bold font-display">
                    {t.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display font-bold truncate">{t.fullName}</div>
                    <div className="text-xs text-black/50">{t.qualification || "No qualification"}</div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditing(t)}
                        className="grid size-10 place-items-center rounded-lg text-black/60 hover:bg-stone-100 sm:size-8"
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        onClick={() => remove(t.id)}
                        className="grid size-10 place-items-center rounded-lg text-red-600 hover:bg-red-50 sm:size-8"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-xs text-black/60">
                  <div className="flex min-w-0 items-start gap-2">
                    <Mail className="mt-0.5 size-3.5 shrink-0" />
                    <span className="min-w-0 break-all">{t.email}</span>
                  </div>
                  <div className="flex min-w-0 items-start gap-2">
                    <Phone className="mt-0.5 size-3.5 shrink-0" />
                    <span className="min-w-0 break-words">{t.phone}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <BookOpen className="size-3.5 mt-0.5" />
                    <div className="flex flex-wrap gap-1">
                      {teacherSubjects.map((s) => (
                        <span key={s.id} className="text-[10px] bg-brand/10 text-brand px-2 py-0.5 rounded-full font-bold">
                          {s.code}
                        </span>
                      ))}
                      {teacherSubjects.length === 0 && (
                        <span className="text-[10px] text-black/40">No subjects assigned</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-stone-100">
                  <div className="text-[10px] uppercase tracking-widest font-bold text-black/40 mb-2">Assigned Classes</div>
                  <div className="flex flex-wrap gap-1">
                    {teacherClasses.map((c) => (
                      <span key={c.id} className="max-w-full break-words rounded-full bg-stone-100 px-2 py-1 text-[10px] font-medium">
                        {c.className}  {c?.department}
                      </span>
                    ))}
                    {teacherClasses.length === 0 && (
                      <span className="text-[10px] text-black/40">No classes assigned</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {(editing || showNew) && (
        <TeacherDialog
          mode={editing ? "edit" : "create"}
          initial={editing ?? {
            id: "t_" + Math.random().toString(36).slice(2, 9),
            fullName: "",
            qualification: "",
            phone: "",
            email: "",
            section: classes[0]?.schoolSection || getStoredSchoolSection(),
            subjectIds: [],
            classIds: [],
            role: "teacher",
            acedemicYear: "2024-2025"
          }}
          subjects={subjects}
          classes={classes}
          onSave={upsert}
          onCancel={() => {
            setEditing(null);
            setShowNew(false);
          }}
        />
      )}
    </div>
  );
}

// Teacher Dialog Component
function TeacherDialog({
  initial,
  subjects,
  classes,
  mode,
  onSave,
  onCancel
}: {
  initial: Teacher;
  subjects: Subject[];
  classes: Class[];
  mode: "create" | "edit";
  onSave: (t: Teacher) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Teacher>(initial);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(0);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [classSearch, setClassSearch] = useState("");
  const steps = ["Profile", "Account", "Assignments", "Review"];
  const isEditing = mode === "edit";

  const set = <K extends keyof Teacher>(k: K, v: Teacher[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const toggleSubject = (id: string) => {
    const updated = form.subjectIds.includes(id)
      ? form.subjectIds.filter((subjectId) => subjectId !== id)
      : [...form.subjectIds, id];
    set("subjectIds", updated);
  };

  const toggleClass = (id: string) => {
    const current = form.classIds;
    const updated = current.includes(id)
      ? current.filter((x: string) => x !== id)
      : [...current, id];
    set("classIds", updated);
  };

  const filteredSubjects = subjects.filter(s =>
    s.section === form.section && (
      s.name.toLowerCase().includes(subjectSearch.toLowerCase()) ||
      s.code.toLowerCase().includes(subjectSearch.toLowerCase())
    )
  );

  const filteredClasses = classes.filter(c =>
    c.schoolSection === form.section && c.className.toLowerCase().includes(classSearch.toLowerCase())
  );

  const handleSave = async () => {
    if (!form.fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!isEditing && step < steps.length - 1) {
      if (step === 1) {
        if (!form.email.trim()) {
          toast.error("Username is required");
          return;
        }
        if (!form.phone.trim()) {
          toast.error("Phone number is required");
          return;
        }
        if (!form.acedemicYear?.trim()) {
          toast.error("Academic year is required");
          return;
        }
      }
      setStep((current) => current + 1);
      return;
    }
    if (!form.email.trim()) {
      toast.error("Username is required");
      return;
    }
    if (!form.phone.trim()) {
      toast.error("Phone number is required");
      return;
    }
    if (!form.acedemicYear) {
      toast.error("Academic year is required");
      return;
    }

    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display font-bold text-xl mb-1">
          {isEditing ? "Edit Teacher" : "Add Teacher"}
        </h3>
        <p className="mb-5 text-xs text-black/50">
          {isEditing ? "Update teacher details below." : `Step ${step + 1} of ${steps.length} · ${steps[step]}`}
        </p>

        {!isEditing && (
          <div className="mb-6">
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
            </div>
            <ol className="grid grid-cols-4 gap-2">
              {steps.map((label, index) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => index < step && setStep(index)}
                    disabled={index >= step || saving}
                    className={`flex w-full items-center gap-1.5 text-left text-[10px] font-semibold sm:text-xs ${index === step ? "text-brand" : index < step ? "text-black/60" : "text-black/30"}`}
                  >
                    <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] ${index <= step ? "bg-brand text-white" : "bg-stone-100 text-black/40"}`}>{index + 1}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}

        {(isEditing || step === 0) && (
          <section className="space-y-4">
            {!isEditing && <h4 className="font-display font-bold">Teacher profile</h4>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full Name*">
                <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} className={inputCls} required autoFocus={!isEditing} />
              </Field>
              <Field label="Qualification">
                <input value={form.qualification} onChange={(e) => set("qualification", e.target.value)} className={inputCls} placeholder="e.g. BEd, MSc" />
              </Field>
            </div>
          </section>
        )}

        {(isEditing || step === 1) && (
          <section className="space-y-4">
            {!isEditing && <h4 className="font-display font-bold">Account and school year</h4>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Username*">
                <input value={form.email} onChange={(e) => set("email", e.target.value)} className={inputCls} required type="text" placeholder="Unique username" />
              </Field>
              <Field label="Phone*">
                <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inputCls} required placeholder="Phone number" />
              </Field>
              <Field label="Academic Year*">
                <input value={form.acedemicYear || "2024-2025"} onChange={(e) => set("acedemicYear", e.target.value)} className={inputCls} placeholder="2024-2025" />
              </Field>
              <Field label="Role">
                <select value={form.role || "teacher"} onChange={(e) => set("role", e.target.value)} className={inputCls}>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                  <option value="bursar">Bursar</option>
                </select>
              </Field>
            </div>
          </section>
        )}

        {(isEditing || step === 2) && (
          <section className="mt-4 space-y-5">
            {!isEditing && <h4 className="font-display font-bold">Subject and class assignments</h4>}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-widest font-bold text-black/50">Subjects (Select Multiple)</div>
                <div className="text-xs text-brand font-bold">
                  {form.subjectIds.length} selected
                </div>
              </div>

              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-black/40" />
                <input
                  type="text"
                  placeholder="Search subjects..."
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
              </div>

              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                {filteredSubjects.length === 0 ? (
                  <span className="text-xs text-black/40">No subjects available</span>
                ) : (
                  filteredSubjects.map((s) => {
                    const isSelected = form.subjectIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSubject(s.id)}
                        className={`text-xs px-3 py-1.5 rounded-full font-bold border transition-all duration-200 ${isSelected
                          ? "bg-brand text-white border-brand shadow-md shadow-brand/20 scale-105"
                          : "border-stone-200 text-black/60 hover:bg-stone-50 hover:border-brand/50"
                          }`}
                      >
                        {s.code} · {s.name}
                        {isSelected && (
                          <span className="ml-1 inline-block">✓</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
              <div className="text-xs text-black/40 mt-1">
                {form.subjectIds.length === 0
                  ? 'Click subjects to select them'
                  : `${form.subjectIds.length} subject${form.subjectIds.length !== 1 ? 's' : ''} selected`}
              </div>
            </div>

            {/* Classes Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] uppercase tracking-widest font-bold text-black/50">Classes (Select Multiple)</div>
                <div className="text-xs text-brand font-bold">
                  {form.classIds.length} selected
                </div>
              </div>

              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-black/40" />
                <input
                  type="text"
                  placeholder="Search classes..."
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                />
              </div>

              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                {filteredClasses.length === 0 ? (
                  <span className="text-xs text-black/40">No classes available</span>
                ) : (
                  filteredClasses.map((c) => {
                    const isSelected = form.classIds.includes(c.id);
                    // Display class with department if available
                    // alert(c.id)
                    let displayName = c.className;
                    if (c.department) {
                      displayName = `${c.className} (${c.department})`;
                    }
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleClass(c.id)}
                        className={`text-xs px-3 py-1.5 rounded-full font-bold border transition-all duration-200 ${isSelected
                          ? "bg-brand text-white border-brand shadow-md shadow-brand/20"
                          : "border-stone-200 text-black/60 hover:bg-stone-50 hover:border-brand/50"
                          }`}
                      >
                        {displayName}
                        {isSelected && (
                          <span className="ml-1 inline-block">✓</span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
              <div className="text-xs text-black/40 mt-1">
                {form.classIds.length === 0
                  ? 'Click classes to select them'
                  : `${form.classIds.length} class${form.classIds.length !== 1 ? 'es' : ''} selected`}
              </div>
            </div>
          </section>
        )}

        {!isEditing && step === 3 && (
          <section className="space-y-4">
            <h4 className="font-display font-bold">Review teacher information</h4>
            <div className="grid gap-3 rounded-xl border border-stone-200 p-4 sm:grid-cols-2">
              <ReviewItem label="Full name" value={form.fullName} />
              <ReviewItem label="Qualification" value={form.qualification || "Not provided"} />
              <ReviewItem label="Username" value={form.email} />
              <ReviewItem label="Phone" value={form.phone} />
              <ReviewItem label="Academic year" value={form.acedemicYear || "Not provided"} />
              <ReviewItem label="Role" value={form.role || "teacher"} />
              <ReviewItem label="Subjects" value={form.subjectIds.map((id) => subjects.find((subject) => subject.id === id)?.name).filter(Boolean).join(", ") || "None assigned"} />
              <ReviewItem label="Classes" value={form.classIds.map((id) => {
                const assignedClass = classes.find((item) => item.id === id);
                return assignedClass ? `${assignedClass.className}${assignedClass.department ? ` ${assignedClass.department}` : ""}` : "";
              }).filter(Boolean).join(", ") || "None assigned"} />
            </div>
          </section>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold hover:bg-stone-50"
            disabled={saving}
          >
            Cancel
          </button>
          {!isEditing && step > 0 && (
            <button
              type="button"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              className="px-4 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold hover:bg-stone-50"
              disabled={saving}
            >
              Back
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving}
          >
            {saving ? "Saving..." : isEditing ? "Update Teacher" : step < steps.length - 1 ? "Continue" : "Add Teacher"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 rounded-lg border border-stone-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[#121212]">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest font-bold text-black/50">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}