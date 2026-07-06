import { useState, useEffect, useMemo } from "react";
import { Mail, Phone, BookOpen, Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const API_BASE = "https://manfess-back.onrender.com/api/users";

// Types
interface Teacher {
  id: string;
  fullName: string;
  qualification: string;
  phone: string;
  email: string;
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
}

interface Class {
  id: string;
  className: string;
}

export function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const role = "admin";
  const canEdit = role === "super_admin" || role === "admin";

  // Check if a teacher ID is from the database
  const isDatabaseId = (id: string) => {
    return /^[0-9a-fA-F]{24}$/.test(id);
  };

  // Filter teachers based on search term
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
      const response = await axios.get(API_BASE);
      if (response.data.success) {
        const mappedTeachers = response.data.data.map((user: any) => ({
          id: user._id,
          fullName: user.name,
          qualification: user.qualification || "",
          phone: user.phone,
          email: user.username,
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
      const response = await axios.get("https://manfess-back.onrender.com/api/subjects");
      if (response.data.success) {
        // Map _id to id for subjects
        const mappedSubjects = response.data.data.map((subj: any) => ({
          id: subj._id || subj.id,
          name: subj.name,
          code: subj.code
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
      const response = await axios.get("https://manfess-back.onrender.com/api/classes");
      if (response.data.success) {
        // Map _id to id for classes
        const mappedClasses = response.data.data.map((cls: any) => ({
          id: cls._id || cls.id,
          className: cls.className || cls.name
        }));
        setClasses(mappedClasses);
        console.log("📚 Classes loaded:", mappedClasses);
      }
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  };

  useEffect(() => {
    fetchTeachers();
    fetchSubjects();
    fetchClasses();
  }, []);

  const upsert = async (teacher: Teacher) => {
    try {
      // Validate required fields
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

      // Map Teacher to User model format
      const userData = {
        name: teacher.fullName.trim(),
        username: teacher.email.trim(),
        phone: teacher.phone.trim(),
        role: teacher.role || "teacher",
        qualification: teacher.qualification || "",
        subjectIds: teacher.subjectIds || [],
        classIds: teacher.classIds || [],
        acedemicYear: teacher.acedemicYear
      };

      console.log("📤 Sending data to API:", JSON.stringify(userData, null, 2));

      const isExisting = teacher.id && isDatabaseId(teacher.id);

      let response;
      if (isExisting) {
        console.log("🔄 Updating teacher:", teacher.id);
        response = await axios.put(`${API_BASE}/${teacher.id}`, userData);
        if (response.data.success) {
          toast.success("Teacher updated successfully");
          await fetchTeachers();
        }
      } else {
        console.log("➕ Creating new teacher");
        response = await axios.post(API_BASE, userData);
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
        console.error("Response data:", error.response.data);
        console.error("Response status:", error.response.status);

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
      const response = await axios.delete(`${API_BASE}/${id}`);
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-black/60">Loading teachers...</p>
        </div>
      </div>
    );
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

      {/* Search Field */}
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

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <div key={t.id} className="bg-white rounded-2xl border border-stone-200 p-5 hover:shadow-md transition-shadow">
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
                        className="size-7 grid place-items-center rounded-lg hover:bg-stone-100 text-black/60"
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        onClick={() => remove(t.id)}
                        className="size-7 grid place-items-center rounded-lg hover:bg-red-50 text-red-600"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  )}
                </div>
                <div className="space-y-2 text-xs text-black/60">
                  <div className="flex items-center gap-2">
                    <Mail className="size-3.5" /> {t.email}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="size-3.5" /> {t.phone}
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
                      <span key={c.id} className="text-[10px] bg-stone-100 px-2 py-1 rounded-full font-medium">
                        {c.className}
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
          initial={editing ?? {
            id: "t_" + Math.random().toString(36).slice(2, 9),
            fullName: "",
            qualification: "",
            phone: "",
            email: "",
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
  onSave,
  onCancel
}: {
  initial: Teacher;
  subjects: Subject[];
  classes: Class[];
  onSave: (t: Teacher) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Teacher>(initial);
  const [saving, setSaving] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [classSearch, setClassSearch] = useState("");

  const set = <K extends keyof Teacher>(k: K, v: Teacher[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Toggle subject selection - UNIQUE SELECTION (only one subject at a time)
  const toggleSubject = (id: string) => {
    // If the subject is already selected, deselect it
    if (form.subjectIds.includes(id)) {
      set("subjectIds", []);
    } else {
      // Otherwise, select only this subject (replace all others)
      set("subjectIds", [id]);
    }
  };

  // Toggle class selection - MULTIPLE SELECTION
  const toggleClass = (id: string) => {
    const current = form.classIds;
    const updated = current.includes(id)
      ? current.filter((x: string) => x !== id)
      : [...current, id];
    set("classIds", updated);
  };

  // Filter subjects based on search
  const filteredSubjects = subjects.filter(s =>
    s.name.toLowerCase().includes(subjectSearch.toLowerCase()) ||
    s.code.toLowerCase().includes(subjectSearch.toLowerCase())
  );

  // Filter classes based on search
  const filteredClasses = classes.filter(c =>
    c.className.toLowerCase().includes(classSearch.toLowerCase())
  );

  const handleSave = async () => {
    // Validate required fields
    if (!form.fullName.trim()) {
      toast.error("Full name is required");
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

    // Log what we're saving
    console.log("💾 Saving teacher data:", {
      fullName: form.fullName,
      email: form.email,
      phone: form.phone,
      subjectIds: form.subjectIds,
      classIds: form.classIds,
      role: form.role,
      acedemicYear: form.acedemicYear
    });

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
        <h3 className="font-display font-bold text-xl mb-5">
          {initial.fullName ? "Edit Teacher" : "Add Teacher"}
        </h3>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Full Name*">
            <input
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              className={inputCls}
              required
            />
          </Field>
          <Field label="Qualification">
            <input
              value={form.qualification}
              onChange={(e) => set("qualification", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Username*">
            <input
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              className={inputCls}
              required
              type="text"
              placeholder="Unique username"
            />
          </Field>
          <Field label="Phone*">
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              className={inputCls}
              required
              placeholder="Phone number"
            />
          </Field>
          <Field label="Academic Year*">
            <input
              value={form.acedemicYear || "2024-2025"}
              onChange={(e) => set("acedemicYear", e.target.value)}
              className={inputCls}
              placeholder="2024-2025"
            />
          </Field>
          <Field label="Role">
            <select
              value={form.role || "teacher"}
              onChange={(e) => set("role", e.target.value)}
              className={inputCls}
            >
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
              <option value="bursar">Bursar</option>
            </select>
          </Field>
        </div>

        {/* Subjects Section - UNIQUE SELECTION */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-widest font-bold text-black/50">Subjects (Select One)</div>
            <div className="text-xs text-brand font-bold">
              {form.subjectIds.length === 1 ? '1 selected' : 'None selected'}
            </div>
          </div>

          {/* Subject Search */}
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
            {form.subjectIds.length === 1
              ? `Selected: ${subjects.find(s => s.id === form.subjectIds[0])?.name || ''}`
              : 'Click a subject to select it'}
          </div>
        </div>

        {/* Classes Section - MULTIPLE SELECTION */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-widest font-bold text-black/50">Classes (Select Multiple)</div>
            <div className="text-xs text-brand font-bold">
              {form.classIds.length} selected
            </div>
          </div>

          {/* Class Search */}
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
                    {c.className}
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
            {saving ? "Saving..." : "Save Teacher"}
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