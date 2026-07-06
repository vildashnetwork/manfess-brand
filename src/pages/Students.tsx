import { useMemo, useState, useEffect } from "react";
import { Search, Plus, Trash2, Pencil, Filter, Download, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import jsPDF from "jspdf";
import "jspdf-autotable";

const API_BASE = "https://manfess-back.onrender.com/api";

// Types
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

interface Class {
  id: string;
  className: string;
  department: string;
  cycle: string;
  acedemicYear: string;
  classMasterId: string;
}

// Helper function to get fee by class name
function getFeeByClass(className: string): number {
  const feeMap: { [key: string]: number } = {
    "Form 1": 80000,
    "Form 2": 80000,
    "Form 3": 80000,
    "Form 4": 80000,
    "Form 5": 90000,
    "Lower 6th": 100000,
    "Upper 6th": 100000,
    "Graduated": 0
  };
  return feeMap[className] || 80000;
}

// Helper to check if ID is a MongoDB ObjectId
const isMongoDBId = (id: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

export function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [feeStatusFilter, setFeeStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Student | null>(null);
  const [showNew, setShowNew] = useState(false);

  const role = "admin";
  const canEdit = role === "super_admin" || role === "admin";

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [studentsRes, classesRes] = await Promise.all([
        axios.get(`${API_BASE}/students`),
        axios.get(`${API_BASE}/classes`)
      ]);

      if (studentsRes.data.success) {
        // FIXED: Map _id to id
        const mappedStudents = studentsRes.data.data.map((student: any) => ({
          ...student,
          id: student._id || student.id // Use _id from MongoDB
        }));
        setStudents(mappedStudents);
        console.log("📚 Students loaded:", mappedStudents);
      }
      if (classesRes.data.success) {
        const mappedClasses = classesRes.data.data.map((cls: any) => ({
          ...cls,
          id: cls._id || cls.id
        }));
        setClasses(mappedClasses);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to fetch data");
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter students
  const filtered = useMemo(() => {
    return students.filter((s) => {
      if (q && !`${s.fullName} ${s.parentName}`.toLowerCase().includes(q.toLowerCase())) {
        return false;
      }
      if (classFilter !== "all" && s.classId !== classFilter) {
        return false;
      }
      if (feeStatusFilter === "paid" && s.feesDue > 0) return false;
      if (feeStatusFilter === "owing" && s.feesDue === 0) return false;
      if (feeStatusFilter === "partial" && (s.feesDue === 0 || s.feesDue >= getFeeByClass(classes.find(c => c.id === s.classId)?.className || ""))) return false;
      return true;
    });
  }, [students, q, classFilter, feeStatusFilter, classes]);

  // CREATE - Add new student
  const createStudent = async (student: Student) => {
    try {
      if (!student.fullName.trim()) {
        toast.error("Full name is required");
        return;
      }
      if (!student.parentPhone.trim()) {
        toast.error("Parent phone is required");
        return;
      }
      if (!student.classId) {
        toast.error("Class is required");
        return;
      }

      const classObj = classes.find(c => c.id === student.classId);
      const totalFee = getFeeByClass(classObj?.className || "");
      const feesDue = student.feesPaid === 0 ? totalFee : Math.max(0, totalFee - student.feesPaid);

      const studentData = {
        fullName: student.fullName.trim(),
        gender: student.gender,
        dob: student.dob,
        classId: student.classId,
        department: student.department,
        parentName: student.parentName.trim(),
        parentPhone: student.parentPhone.trim(),
        address: student.address.trim(),
        photoUrl: student.photoUrl || "",
        registrationDate: student.registrationDate || new Date().toISOString().slice(0, 10),
        feesPaid: student.feesPaid,
        feesDue: feesDue
      };

      console.log("➕ Creating new student");
      const response = await axios.post(`${API_BASE}/students`, studentData);
      if (response.data.success) {
        toast.success("Student added successfully");
        await fetchData();
        setShowNew(false);
      }
    } catch (error: any) {
      console.error("Error creating student:", error);
      handleApiError(error);
    }
  };

  // UPDATE - Update existing student
  const updateStudent = async (student: Student) => {
    try {
      if (!student.fullName.trim()) {
        toast.error("Full name is required");
        return;
      }
      if (!student.parentPhone.trim()) {
        toast.error("Parent phone is required");
        return;
      }
      if (!student.classId) {
        toast.error("Class is required");
        return;
      }

      // Make sure we have a valid ID
      if (!student.id || !isMongoDBId(student.id)) {
        toast.error("Invalid student ID. Cannot update.");
        console.error("Invalid ID for update:", student.id);
        return;
      }

      const classObj = classes.find(c => c.id === student.classId);
      const totalFee = getFeeByClass(classObj?.className || "");
      const feesDue = student.feesPaid === 0 ? totalFee : Math.max(0, totalFee - student.feesPaid);

      const studentData = {
        fullName: student.fullName.trim(),
        gender: student.gender,
        dob: student.dob,
        classId: student.classId,
        department: student.department,
        parentName: student.parentName.trim(),
        parentPhone: student.parentPhone.trim(),
        address: student.address.trim(),
        photoUrl: student.photoUrl || "",
        registrationDate: student.registrationDate || new Date().toISOString().slice(0, 10),
        feesPaid: student.feesPaid,
        feesDue: feesDue
      };

      console.log("🔄 Updating student with ID:", student.id);

      const response = await axios.put(`${API_BASE}/students/${student.id}`, studentData);
      if (response.data.success) {
        toast.success("Student updated successfully");
        await fetchData();
        setEditing(null);
      }
    } catch (error: any) {
      console.error("Error updating student:", error);
      handleApiError(error);
    }
  };

  // Handle API errors
  const handleApiError = (error: any) => {
    if (error.response) {
      const errorMessage = error.response.data?.message || "Operation failed";
      if (error.response.status === 409) {
        toast.error("Duplicate entry. This student may already exist.");
      } else if (error.response.status === 400) {
        toast.error(`Validation error: ${errorMessage}`);
      } else if (error.response.status === 404) {
        toast.error("Student not found. It may have been deleted.");
      } else if (error.response.status === 500) {
        toast.error("Server error. Please try again later.");
      } else {
        toast.error(errorMessage);
      }
    } else if (error.request) {
      toast.error("No response from server. Please check your connection.");
    } else {
      toast.error(`Error: ${error.message}`);
    }
  };

  // DELETE - Delete a student
  const deleteStudent = async (id: string) => {
    // Check if id exists and is valid
    if (!id) {
      toast.error("Student ID is missing. Cannot delete.");
      console.error("Missing ID for delete");
      return;
    }

    if (!isMongoDBId(id)) {
      toast.error("Invalid student ID format. Cannot delete.");
      console.error("Invalid ID for delete:", id);
      return;
    }

    if (!window.confirm("Are you sure you want to delete this student?")) return;

    try {
      console.log("🗑️ Deleting student with ID:", id);
      const response = await axios.delete(`${API_BASE}/students/${id}`);
      if (response.data.success) {
        toast.success("Student deleted successfully");
        await fetchData();
      }
    } catch (error: any) {
      console.error("Error deleting student:", error);
      handleApiError(error);
    }
  };

  // Export to CSV
  const exportCSV = () => {
    const headers = ["Full Name", "Gender", "Class", "Department", "Parent Name", "Parent Phone", "Fees Paid", "Fees Due", "Status"];

    const rows = filtered.map((s) => {
      const classObj = classes.find(c => c.id === s.classId);
      const totalFee = getFeeByClass(classObj?.className || "");
      const status = s.feesDue === 0 ? "Fully Paid" : s.feesDue < totalFee ? "Partial" : "Owing";
      return [
        s.fullName,
        s.gender,
        classObj?.className || "",
        s.department,
        s.parentName,
        s.parentPhone,
        s.feesPaid.toString(),
        s.feesDue.toString(),
        status
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `students_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("CSV exported successfully");
  };

  // Export to PDF
  const exportPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("Students Report", 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);

    let filterInfo = "All Students";
    if (classFilter !== "all") {
      const classObj = classes.find(c => c.id === classFilter);
      filterInfo = `Class: ${classObj?.className || ""}`;
    }
    if (feeStatusFilter === "paid") filterInfo += " - Fully Paid";
    else if (feeStatusFilter === "owing") filterInfo += " - Owing";
    else if (feeStatusFilter === "partial") filterInfo += " - Partial Payment";
    doc.text(`Filter: ${filterInfo}`, 14, 36);
    doc.text(`Total: ${filtered.length} students`, 14, 42);

    const tableData = filtered.map((s) => {
      const classObj = classes.find(c => c.id === s.classId);
      const totalFee = getFeeByClass(classObj?.className || "");
      const status = s.feesDue === 0 ? "Paid" : s.feesDue < totalFee ? "Partial" : "Owing";
      return [
        s.fullName,
        classObj?.className || "",
        s.department,
        s.parentName,
        s.parentPhone,
        `${s.feesPaid.toLocaleString()}`,
        `${s.feesDue.toLocaleString()}`,
        status
      ];
    });

    (doc as any).autoTable({
      startY: 48,
      head: [["Name", "Class", "Dept", "Parent", "Phone", "Paid", "Due", "Status"]],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [0, 0, 0], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 20 },
        2: { cellWidth: 20 },
        3: { cellWidth: 25 },
        4: { cellWidth: 25 },
        5: { cellWidth: 20 },
        6: { cellWidth: 20 },
        7: { cellWidth: 20 }
      }
    });

    const totalPaid = filtered.reduce((sum, s) => sum + s.feesPaid, 0);
    const totalDue = filtered.reduce((sum, s) => sum + s.feesDue, 0);
    const owingCount = filtered.filter(s => s.feesDue > 0).length;

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(`Summary:`, 14, finalY);
    doc.text(`Total Students: ${filtered.length}`, 14, finalY + 6);
    doc.text(`Total Fees Paid: ${totalPaid.toLocaleString()} XAF`, 14, finalY + 12);
    doc.text(`Total Fees Due: ${totalDue.toLocaleString()} XAF`, 14, finalY + 18);
    doc.text(`Students Owing: ${owingCount}`, 14, finalY + 24);

    doc.save(`students_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF exported successfully");
  };

  // Print owing students
  const printOwingStudents = () => {
    const owingStudents = filtered.filter(s => s.feesDue > 0);

    if (owingStudents.length === 0) {
      toast.error("No students with outstanding fees");
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast.error("Please allow popups for printing");
      return;
    }

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Students with Outstanding Fees</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; border-bottom: 2px solid #ccc; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #f5f5f5; padding: 10px; text-align: left; border: 1px solid #ddd; }
          td { padding: 8px 10px; border: 1px solid #ddd; }
          .total { margin-top: 20px; font-weight: bold; }
          .fee-due { color: #dc3545; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Students with Outstanding Fees</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <p>Total: ${owingStudents.length} students</p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Student Name</th>
              <th>Class</th>
              <th>Parent</th>
              <th>Phone</th>
              <th>Fees Paid</th>
              <th>Fees Due</th>
            </tr>
          </thead>
          <tbody>
    `;

    owingStudents.forEach((s, index) => {
      const classObj = classes.find(c => c.id === s.classId);
      html += `
        <tr>
          <td>${index + 1}</td>
          <td>${s.fullName}</td>
          <td>${classObj?.className || ""}</td>
          <td>${s.parentName}</td>
          <td>${s.parentPhone}</td>
          <td>${s.feesPaid.toLocaleString()}</td>
          <td class="fee-due">${s.feesDue.toLocaleString()}</td>
        </tr>
      `;
    });

    const totalDue = owingStudents.reduce((sum, s) => sum + s.feesDue, 0);

    html += `
          </tbody>
        </table>
        <div class="total">
          <p>Total Fees Due: ${totalDue.toLocaleString()} XAF</p>
        </div>
        <script>
          window.onload = function() { window.print(); }
        <\/script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-black/60">Loading students...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Students</h1>
          <p className="text-sm text-black/60 mt-1">{students.length} total · {filtered.length} shown</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={printOwingStudents} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm font-semibold hover:bg-stone-50">
            <Printer className="size-4" /> Print Owing
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm font-semibold hover:bg-stone-50">
            <Download className="size-4" /> CSV
          </button>
          {/* <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm font-semibold hover:bg-stone-50">
            <FileText className="size-4" /> PDF
          </button> */}
          {canEdit && (
            <button onClick={() => setShowNew(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90">
              <Plus className="size-4" /> Add Student
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or parent..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-sm"
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Filter className="size-4 text-black/40" />
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-stone-200 bg-white text-sm font-medium">
            <option value="all">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.className}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <select value={feeStatusFilter} onChange={(e) => setFeeStatusFilter(e.target.value)} className="px-3 py-2 rounded-xl border border-stone-200 bg-white text-sm font-medium">
            <option value="all">All Fees</option>
            <option value="paid">Fully Paid</option>
            <option value="partial">Partial Payment</option>
            <option value="owing">Owing</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-[10px] uppercase tracking-widest text-black/50 font-bold">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Class</th>
                <th className="px-5 py-3">Department</th>
                <th className="px-5 py-3">Parent</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3">Fees Paid</th>
                <th className="px-5 py-3">Fees Due</th>
                <th className="px-5 py-3">Status</th>
                {canEdit && <th className="px-5 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filtered.map((s) => {
                const classObj = classes.find(c => c.id === s.classId);
                const totalFee = getFeeByClass(classObj?.className || "");
                const status = s.feesDue === 0 ? "Fully Paid" : s.feesDue < totalFee ? "Partial" : "Owing";
                const statusColor = s.feesDue === 0 ? "bg-brand/10 text-brand" : s.feesDue < totalFee ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";

                return (
                  <tr key={s.id} className="hover:bg-stone-50">
                    <td className="px-5 py-3 font-semibold">{s.fullName}</td>
                    <td className="px-5 py-3">{classObj?.className || "—"}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-stone-100 font-medium">{s.department}</span>
                    </td>
                    <td className="px-5 py-3 text-xs">{s.parentName}</td>
                    <td className="px-5 py-3 text-xs">{s.parentPhone}</td>
                    <td className="px-5 py-3">{s.feesPaid.toLocaleString()}</td>
                    <td className="px-5 py-3 font-bold">{s.feesDue.toLocaleString()}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-bold ${statusColor}`}>
                        {status}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => {
                              console.log("📝 Editing student:", s);
                              setEditing(s);
                            }}
                            className="size-8 grid place-items-center rounded-lg hover:bg-stone-100 text-black/60"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              console.log("🗑️ Deleting student ID:", s.id);
                              deleteStudent(s.id);
                            }}
                            className="size-8 grid place-items-center rounded-lg hover:bg-red-50 text-red-600"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 9 : 8} className="text-center py-12 text-black/40 text-sm">
                    No students match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Student Dialog */}
      {showNew && (
        <StudentDialog
          initial={{
            id: "st_" + Math.random().toString(36).slice(2, 9),
            fullName: "",
            gender: "male",
            dob: new Date().toISOString().slice(0, 10),
            classId: classes[0]?.id || "",
            department: classes[0]?.department || "Science",
            parentName: "",
            parentPhone: "",
            address: "",
            photoUrl: "",
            registrationDate: new Date().toISOString().slice(0, 10),
            feesPaid: 0,
            feesDue: 0
          }}
          classes={classes}
          mode="create"
          onSave={createStudent}
          onCancel={() => { setShowNew(false); }}
        />
      )}

      {/* Edit Student Dialog */}
      {editing && (
        <StudentDialog
          initial={editing}
          classes={classes}
          mode="edit"
          onSave={updateStudent}
          onCancel={() => { setEditing(null); }}
        />
      )}
    </div>
  );
}

// Student Dialog Component
function StudentDialog({
  initial,
  classes,
  mode,
  onSave,
  onCancel
}: {
  initial: Student;
  classes: Class[];
  mode: 'create' | 'edit';
  onSave: (s: Student) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Student>(initial);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Student>(k: K, v: Student[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleClassChange = (classId: string) => {
    const classObj = classes.find(c => c.id === classId);
    const totalFee = getFeeByClass(classObj?.className || "");
    const remaining = Math.max(0, totalFee - form.feesPaid);

    set("classId", classId);
    if (classObj) set("department", classObj.department);
    set("feesDue", remaining);
  };

  const handleFeesPaidChange = (amount: number) => {
    const classObj = classes.find(c => c.id === form.classId);
    const totalFee = getFeeByClass(classObj?.className || "");
    const remaining = Math.max(0, totalFee - amount);

    set("feesPaid", amount);
    set("feesDue", remaining);
  };

  const handleSave = async () => {
    if (!form.fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!form.parentPhone.trim()) {
      toast.error("Parent phone is required");
      return;
    }
    if (!form.classId) {
      toast.error("Class is required");
      return;
    }

    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const isEditing = mode === 'edit';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display font-bold text-xl mb-1">
          {isEditing ? "Edit Student" : "Add Student"}
        </h3>
        <p className="text-xs text-black/50 mb-5">
          {isEditing ? "Update student details below." : "Fill in the student details below."}
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Full Name*">
            <input
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              className={inputCls}
              required
            />
          </Field>
          <Field label="Gender">
            <select
              value={form.gender}
              onChange={(e) => set("gender", e.target.value)}
              className={inputCls}
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field label="Date of Birth">
            <input
              type="date"
              value={form.dob}
              onChange={(e) => set("dob", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Class*">
            <select
              value={form.classId}
              onChange={(e) => handleClassChange(e.target.value)}
              className={inputCls}
              required
            >
              <option value="">Select class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.className} - {c.department}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Parent Name">
            <input
              value={form.parentName}
              onChange={(e) => set("parentName", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Parent Phone*">
            <input
              value={form.parentPhone}
              onChange={(e) => set("parentPhone", e.target.value)}
              className={inputCls}
              required
            />
          </Field>
          <Field label="Address">
            <input
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Registration Date">
            <input
              type="date"
              value={form.registrationDate}
              onChange={(e) => set("registrationDate", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Fees Paid (XAF)">
            <input
              type="number"
              min="0"
              value={form.feesPaid}
              onChange={(e) => handleFeesPaidChange(Number(e.target.value))}
              className={inputCls}
            />
          </Field>
          <Field label="Fees Due (XAF)">
            <input
              type="number"
              value={form.feesDue}
              disabled
              className={`${inputCls} bg-stone-50`}
            />
          </Field>
        </div>

        <div className="mt-4 p-3 bg-stone-50 rounded-xl text-xs">
          <p className="font-bold">Fee Structure:</p>
          <ul className="mt-1 space-y-0.5 text-black/60">
            <li>Form 1 - 4: 80,000 XAF</li>
            <li>Form 5: 90,000 XAF</li>
            <li>Lower 6th - Upper 6th: 100,000 XAF</li>
          </ul>
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
            {saving ? "Saving..." : isEditing ? "Update Student" : "Save Student"}
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