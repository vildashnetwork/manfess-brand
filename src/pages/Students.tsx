import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Plus, Trash2, Pencil, Filter, Download, FileText, Printer, Camera, ImagePlus, Upload, X, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { CompactPageLoader } from "@/components/CompactPageLoader";
import { getStoredSchoolSection } from "@/lib/schoolSystem";
import { toast } from "sonner";
import axios from "axios";
import jsPDF from "jspdf";
import "jspdf-autotable";

const API_BASE = import.meta.env.VITE_API_URL;

// Types
interface Student {
  id: string;
  fullName: string;
  gender: string;
  section: "englophone";
  dob: string;
  classId: string;
  department: string;
  parentName: string;
  parentPhone: string;
  address: string;
  photoUrl?: string;
  photoCloudinaryUrl?: string;
  photoLocalUrl?: string;
  registrationDate: string;
  feesPaid: number;
  feesDue: number;
  tuitionFee?: number;
  tuitionInstallments?: number;
  tuitionFeePaid?: number;
  tuitionInstallmentsPaid?: number;
  registrationFeeRequired?: boolean;
  registrationFeeAmount?: number;
  registrationFeePaid?: number;
  upfrontPayment?: number;
}

interface Class {
  id: string;
  className: string;
  department: string;
  cycle: string;
  schoolSection: "englophone";
  acedemicYear: string;
  classMasterId: string;
  tuitionFee: number;
  tuitionInstallments: number;
  registrationFeeRequired: boolean;
  registrationFeeAmount: number;
}

function getClassTotalFee(schoolClass?: Class): number {
  if (!schoolClass) return 0;
  return Number(schoolClass.tuitionFee || 0)
    + (schoolClass.registrationFeeRequired ? Number(schoolClass.registrationFeeAmount || 0) : 0);
}

// Helper to check if ID is a MongoDB ObjectId
const isMongoDBId = (id: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

// Normalize a student row coming from the API (_id -> id, default section).
const mapStudents = (rows: any[] = []): Student[] => rows.map((student: any) => ({
  ...student,
  id: student._id || student.id,
  section: student.section || "englophone",
}));

// The student list is paginated on the server: the browser only ever holds and
// renders one page of rows (50 by default), which keeps this screen fast even
// with 5,000+ students.
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];
const DEFAULT_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

export function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [feeStatusFilter, setFeeStatusFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Student | null>(null);
  const [showNew, setShowNew] = useState(false);
  // Server-driven list state (pagination + loading)
  const [listLoading, setListLoading] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [reloadToken, setReloadToken] = useState(0);
  const [classesLoaded, setClassesLoaded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const listRequestRef = useRef(0);

  const role: string = "admin";
  const canEdit = role === "super_admin" || role === "admin";

  // ---------------------------------------------------------------------
  // Server-side filtering + pagination: the API filters, counts and slices,
  // so the browser never has to store or render the whole school at once.
  // ---------------------------------------------------------------------
  const buildFilterParams = useCallback(() => ({
    section: getStoredSchoolSection(),
    classId: classFilter !== "all" ? classFilter : undefined,
    search: q || undefined,
    feeStatus: feeStatusFilter !== "all" ? feeStatusFilter : undefined,
  }), [classFilter, q, feeStatusFilter]);

  const fetchClasses = useCallback(async () => {
    const classesRes = await axios.get(`${API_BASE}/classes`, { params: { section: getStoredSchoolSection() } });
    if (!classesRes.data.success) return [];

    const mappedClasses = classesRes.data.data.map((cls: any) => ({
      ...cls,
      id: cls._id || cls.id,
      schoolSection: cls.schoolSection || cls.section || "englophone",
      tuitionFee: Number(cls.tuitionFee) || 0,
      tuitionInstallments: Number(cls.tuitionInstallments) || 1,
      registrationFeeRequired: Boolean(cls.registrationFeeRequired),
      registrationFeeAmount: Number(cls.registrationFeeAmount) || 0,
    }));
    setClasses(mappedClasses);
    return mappedClasses;
  }, []);

  // One page of students (the previous page stays visible while it loads).
  const loadStudents = useCallback(async (targetPage: number) => {
    const requestId = ++listRequestRef.current;
    setListLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/students`, {
        params: { ...buildFilterParams(), page: targetPage, limit: pageSize },
      });
      if (requestId !== listRequestRef.current) return; // a newer request won
      if (!res.data.success) return;

      const mappedStudents = mapStudents(res.data.data);
      const totalCount = Number(res.data.total ?? mappedStudents.length);
      const lastPage = Math.max(1, Number(res.data.pages ?? Math.ceil(totalCount / pageSize)));

      setTotal(totalCount);
      if (targetPage > lastPage) {
        // The requested page disappeared (deletion or filter change).
        setPage(lastPage);
        return;
      }
      setStudents(mappedStudents);
    } catch (error: any) {
      if (requestId !== listRequestRef.current) return;
      toast.error(error.response?.data?.message || "Failed to fetch students");
      console.error("Error fetching students:", error);
    } finally {
      if (requestId === listRequestRef.current) {
        setListLoading(false);
        setLoading(false);
      }
    }
  }, [buildFilterParams, pageSize]);

  // Exports and printing need every matching student, not just the visible page.
  const fetchAllMatching = useCallback(async () => {
    const res = await axios.get(`${API_BASE}/students`, { params: buildFilterParams() });
    return mapStudents(res.data?.data);
  }, [buildFilterParams]);

  // First paint: load the classes, then let the list effect below fetch the
  // first page. The historical "open on the first class" behaviour is kept.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mappedClasses = await fetchClasses();
        if (cancelled) return;
        if (mappedClasses.length) {
          setClassFilter((current) => (current === "all" ? mappedClasses[0].id : current));
        }
      } catch (error: any) {
        if (cancelled) return;
        toast.error(error.response?.data?.message || "Failed to fetch data");
        console.error("Error fetching data:", error);
        setLoading(false);
      } finally {
        if (!cancelled) setClassesLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [fetchClasses]);

  // Reload the visible page whenever the filters, the page or an edit change.
  useEffect(() => {
    if (!classesLoaded) return;
    void loadStudents(page);
  }, [classesLoaded, page, reloadToken, loadStudents]);

  // Re-read the list (and the class rosters) after create / update / delete.
  const refreshList = useCallback(async () => {
    try {
      await fetchClasses();
    } catch (error) {
      console.error("Error refreshing classes:", error);
    }
    setReloadToken((token) => token + 1);
  }, [fetchClasses]);

  // Typing in the search box triggers a single request once the user pauses.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      if (next === q) return;
      setQ(next);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput, q]);

  const changeClassFilter = (value: string) => {
    setClassFilter(value);
    setPage(1);
  };

  const changeFeeStatusFilter = (value: string) => {
    setFeeStatusFilter(value);
    setPage(1);
  };

  const changePageSize = (value: number) => {
    setPageSize(value);
    setPage(1);
  };

  // The API already applied the filters, so the loaded rows are the rows shown.
  const filtered = students;
  const pageCount = Math.max(1, Math.ceil((total || 0) / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

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
      const totalFee = getClassTotalFee(classObj);
      if (!classObj || (classObj.className !== "Graduated" && classObj.tuitionFee <= 0)) {
        toast.error("Configure this class's tuition in Classes & Subjects before enrolling students");
        return;
      }
      const tuitionPaid = Number(student.tuitionFeePaid) || 0;
      const registrationPaid = Number(student.registrationFeePaid) || 0;
      const upfrontPayment = Math.max(0, Number((student as any).upfrontPayment) || 0);
      const feesPaid = tuitionPaid + registrationPaid + upfrontPayment;
      const feesDue = Math.max(0, totalFee - feesPaid);

      const studentData = {
        fullName: student.fullName.trim(),
        gender: student.gender,
        section: classObj.schoolSection || student.section || "englophone",
        dob: student.dob,
        classId: student.classId,
        department: student.department,
        parentName: student.parentName.trim(),
        parentPhone: student.parentPhone.trim(),
        address: student.address.trim(),
        photoUrl: student.photoUrl || "",
        registrationDate: student.registrationDate || new Date().toISOString().slice(0, 10),
        feesPaid,
        feesDue,
        tuitionFee: classObj.tuitionFee,
        tuitionInstallments: classObj.tuitionInstallments,
        tuitionFeePaid: tuitionPaid + upfrontPayment,
        tuitionInstallmentsPaid: Number(student.tuitionInstallmentsPaid) || 0,
        registrationFeeRequired: classObj.registrationFeeRequired,
        registrationFeeAmount: classObj.registrationFeeRequired ? classObj.registrationFeeAmount : 0,
        registrationFeePaid: registrationPaid,
      };

      console.log("➕ Creating new student");
      const response = await axios.post(`${API_BASE}/students`, studentData);
      if (response.data.success) {
        toast.success("Student added successfully");
        await refreshList();
        setShowNew(false);
      }
    } catch (error: any) {
      console.error("Error creating student:", error.response?.data ?? error);
      // also useful in the UI:
      // toast.error(error.response?.data?.errors?.join(", ") || error.response?.data?.message);
      throw error;
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
      const totalFee = getClassTotalFee(classObj);
      if (!classObj || (classObj.className !== "Graduated" && classObj.tuitionFee <= 0)) {
        toast.error("Configure this class's tuition in Classes & Subjects before enrolling students");
        return;
      }
      const feesPaid = Number(student.feesPaid) || 0;
      const feesDue = Math.max(0, totalFee - feesPaid);

      const studentData = {
        fullName: student.fullName.trim(),
        gender: student.gender,
        section: classObj.schoolSection || student.section || "englophone",
        dob: student.dob,
        classId: student.classId,
        department: student.department,
        parentName: student.parentName.trim(),
        parentPhone: student.parentPhone.trim(),
        address: student.address.trim(),
        photoUrl: student.photoUrl || "",
        registrationDate: student.registrationDate || new Date().toISOString().slice(0, 10),
        feesPaid,
        feesDue,
        tuitionFee: classObj.tuitionFee,
        tuitionInstallments: classObj.tuitionInstallments,
        registrationFeeRequired: classObj.registrationFeeRequired,
        registrationFeeAmount: classObj.registrationFeeRequired ? classObj.registrationFeeAmount : 0,
      };

      console.log("🔄 Updating student with ID:", student.id);

      const response = await axios.put(`${API_BASE}/students/${student.id}`, studentData);
      if (response.data.success) {
        toast.success("Student updated successfully");
        await refreshList();
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
        await refreshList();
      }
    } catch (error: any) {
      console.error("Error deleting student:", error);
      handleApiError(error);
    }
  };

  // Exports and printing always work on every student matching the current
  // filters (not only the page on screen), so the downloads stay complete.
  const fetchExportRows = async (): Promise<Student[] | null> => {
    setExporting(true);
    const loadingToast = toast.loading("Preparing export...");
    try {
      const rows = await fetchAllMatching();
      if (!rows.length) {
        toast.error("No students match your filters");
        return null;
      }
      return rows;
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to load the students to export");
      console.error("Error loading students for export:", error);
      return null;
    } finally {
      toast.dismiss(loadingToast);
      setExporting(false);
    }
  };

  // Export to CSV
  const exportCSV = async () => {
    const headers = ["Full Name", "Gender", "Class", "Department", "Parent Name", "Parent Phone", "Fees Paid", "Fees Due", "Status"];

    const exportRows = await fetchExportRows();
    if (!exportRows) return;

    const rows = exportRows.map((s) => {
      const classObj = classes.find(c => c.id === s.classId);
      const totalFee = getClassTotalFee(classObj);
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
    toast.success(`CSV exported successfully (${exportRows.length} students)`);
  };

  // Export to PDF
  const exportPDF = async () => {
    const exportRows = await fetchExportRows();
    if (!exportRows) return;

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
    doc.text(`Total: ${exportRows.length} students`, 14, 42);

    const tableData = exportRows.map((s) => {
      const classObj = classes.find(c => c.id === s.classId);
      const totalFee = getClassTotalFee(classObj);
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

    const totalPaid = exportRows.reduce((sum, s) => sum + s.feesPaid, 0);
    const totalDue = exportRows.reduce((sum, s) => sum + s.feesDue, 0);
    const owingCount = exportRows.filter(s => s.feesDue > 0).length;

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(`Summary:`, 14, finalY);
    doc.text(`Total Students: ${exportRows.length}`, 14, finalY + 6);
    doc.text(`Total Fees Paid: ${totalPaid.toLocaleString()} XAF`, 14, finalY + 12);
    doc.text(`Total Fees Due: ${totalDue.toLocaleString()} XAF`, 14, finalY + 18);
    doc.text(`Students Owing: ${owingCount}`, 14, finalY + 24);

    doc.save(`students_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success(`PDF exported successfully (${exportRows.length} students)`);
  };

  // Print owing students
  const printOwingStudents = async () => {
    const exportRows = await fetchExportRows();
    if (!exportRows) return;

    const owingStudents = exportRows.filter(s => s.feesDue > 0);

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
    return <CompactPageLoader label="Loading students..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Students</h1>
          <p className="text-sm text-black/60 mt-1">
            {total.toLocaleString()} total · showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 xs:flex-row sm:w-auto">
          <div className="grid w-full grid-cols-2 gap-2 xs:flex xs:w-auto xs:flex-1 sm:flex-none">
            <button
              onClick={() => void printOwingStudents()}
              disabled={exporting}
              className="flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold whitespace-nowrap hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:px-4"
            >
              {exporting ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <Printer className="size-4 shrink-0" />}
              <span className="truncate">Print Owing</span>
            </button>
            <button
              onClick={() => void exportCSV()}
              disabled={exporting}
              className="flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold whitespace-nowrap hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:px-4"
            >
              {exporting ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <Download className="size-4 shrink-0" />}
              <span className="truncate">CSV</span>
            </button>
          </div>
          {canEdit && (
            <button
              onClick={() => setShowNew(true)}
              className="flex min-h-10 w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold whitespace-nowrap text-white hover:bg-brand/90 xs:w-auto xs:flex-1 sm:w-auto sm:flex-none sm:px-4"
            >
              <Plus className="size-4 shrink-0" />
              <span className="truncate">Add Student</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="grid min-w-0 gap-3 rounded-2xl border border-stone-200 bg-white p-3 sm:flex sm:flex-wrap sm:items-center sm:p-4">
        <div className="relative min-w-0 w-full sm:flex-1 sm:basis-[200px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name or parent..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-sm"
          />
        </div>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Filter className="size-4 text-black/40" />
          <select value={classFilter} onChange={(e) => changeClassFilter(e.target.value)} className="min-w-0 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium sm:w-auto sm:max-w-[220px]">
            <option value="all">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.className + " " + c.department}</option>)}
          </select>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <select value={feeStatusFilter} onChange={(e) => changeFeeStatusFilter(e.target.value)} className="min-w-0 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium sm:w-auto">
            <option value="all">All Fees</option>
            <option value="paid">Fully Paid</option>
            <option value="partial">Partial Payment</option>
            <option value="owing">Owing</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        {listLoading && (
          <div role="status" className="flex items-center gap-2 border-b border-blue-100 bg-blue-50 px-5 py-2 text-sm text-blue-800">
            <Loader2 className="size-4 animate-spin" />
            <span>Loading students…</span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className={`w-full min-w-[900px] text-sm transition-opacity ${listLoading ? "opacity-50" : "opacity-100"}`}>
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
                const totalFee = getClassTotalFee(classObj);
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
              {!listLoading && filtered.length === 0 && (
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

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-black/60">
          Showing <strong>{rangeStart.toLocaleString()}</strong>–<strong>{rangeEnd.toLocaleString()}</strong> of{" "}
          <strong>{total.toLocaleString()}</strong> {classFilter === "all" ? "students (all classes)" : "students in this class"}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-black/60">
            Rows
            <select
              value={pageSize}
              onChange={(e) => changePageSize(Number(e.target.value))}
              className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs font-semibold"
            >
              {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={page <= 1 || listLoading}
              title="First page"
              className="size-8 grid place-items-center rounded-lg border border-stone-200 bg-white text-black/70 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronsLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || listLoading}
              title="Previous page"
              className="size-8 grid place-items-center rounded-lg border border-stone-200 bg-white text-black/70 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-2 text-xs font-semibold text-black/60">Page {page} of {pageCount}</span>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={page >= pageCount || listLoading}
              title="Next page"
              className="size-8 grid place-items-center rounded-lg border border-stone-200 bg-white text-black/70 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setPage(pageCount)}
              disabled={page >= pageCount || listLoading}
              title="Last page"
              className="size-8 grid place-items-center rounded-lg border border-stone-200 bg-white text-black/70 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronsRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* New Student Dialog */}
      {showNew && (
        <StudentDialog
          initial={{
            id: "st_" + Math.random().toString(36).slice(2, 9),
            fullName: "",
            gender: "male",
            section: classes[0]?.schoolSection || getStoredSchoolSection(),
            dob: new Date().toISOString().slice(0, 10),
            classId: classes[0]?.id || "",
            department: classes[0]?.department || "Science",
            parentName: "",
            parentPhone: "",
            address: "",
            photoUrl: "",
            registrationDate: new Date().toISOString().slice(0, 10),
            feesPaid: 0,
            feesDue: 0,
            upfrontPayment: 0,
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
  const [step, setStep] = useState(0);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const steps = ["Student", "Class & fees", "Family", "Photo", "Review"];

  useEffect(() => {
    if (videoRef.current && cameraStream) videoRef.current.srcObject = cameraStream;
    return () => {
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [cameraStream]);

  useEffect(() => () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
  }, [cameraStream]);

  const set = <K extends keyof Student>(k: K, v: Student[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleClassChange = (classId: string) => {
    const classObj = classes.find(c => c.id === classId);
    const totalFee = getClassTotalFee(classObj);
    setForm((current) => ({
      ...current,
      classId,
      section: classObj?.schoolSection || current.section,
      department: classObj?.department || current.department,
      tuitionFee: classObj?.tuitionFee || 0,
      tuitionInstallments: classObj?.tuitionInstallments || 1,
      registrationFeeRequired: Boolean(classObj?.registrationFeeRequired),
      registrationFeeAmount: classObj?.registrationFeeRequired ? classObj.registrationFeeAmount : 0,
      feesDue: Math.max(0, totalFee - (Number(current.feesPaid) || 0)),
    }));
  };

  const stopCamera = () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
  };

  const startCamera = async () => {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is unavailable. Use HTTPS or localhost, or upload a photo instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      setCameraStream(stream);
    } catch (error) {
      console.error("Unable to open student photo camera:", error);
      setCameraError("Camera permission was denied or no camera was found. You can upload a photo instead.");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setCameraError("The camera is still starting. Try again in a moment.");
      return;
    }
    const scale = Math.min(1, 1280 / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Could not capture the photo. Please try again or upload an image.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    set("photoUrl", canvas.toDataURL("image/jpeg", 0.82));
    stopCamera();
    setCameraError("");
  };

  const uploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Choose an image smaller than 10 MB");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1280 / bitmap.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to process this image");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      set("photoUrl", canvas.toDataURL("image/jpeg", 0.82));
      stopCamera();
      setCameraError("");
    } catch (error) {
      console.error("Unable to process student photo:", error);
      toast.error("Could not load this image. Try another photo.");
    }
  };

  const handleSave = async () => {
    if (!form.fullName.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (!isEditing && step < steps.length - 1) {
      if (step === 1) {
        const selectedClass = classes.find((item) => item.id === form.classId);
        if (!selectedClass) {
          toast.error("Select a class to continue");
          return;
        }
        if (selectedClass.className !== "Graduated" && selectedClass.tuitionFee <= 0) {
          toast.error("This class needs a tuition amount configured before student enrollment");
          return;
        }
      }
      if (step === 2 && !form.parentPhone.trim()) {
        toast.error("Parent phone is required");
        return;
      }
      setStep((current) => current + 1);
      return;
    }

    if (!form.parentPhone.trim()) {
      toast.error("Parent phone is required");
      if (!isEditing) setStep(2);
      return;
    }
    if (!form.classId) {
      toast.error("Class is required");
      if (!isEditing) setStep(1);
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
  const selectedClass = classes.find((item) => item.id === form.classId);
  const tuitionFee = selectedClass?.tuitionFee ?? form.tuitionFee ?? 0;
  const installmentCount = selectedClass?.tuitionInstallments ?? form.tuitionInstallments ?? 1;
  const registrationRequired = selectedClass?.registrationFeeRequired ?? form.registrationFeeRequired ?? false;
  const registrationAmount = registrationRequired
    ? selectedClass?.registrationFeeAmount ?? form.registrationFeeAmount ?? 0
    : 0;

  const stepHeading = steps[step];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display font-bold text-xl mb-1">
          {isEditing ? "Edit Student" : "Add Student"}
        </h3>
        <p className="text-xs text-black/50 mb-5">
          {isEditing ? "Update student details below." : `Step ${step + 1} of ${steps.length} · ${stepHeading}`}
        </p>

        {!isEditing && (
          <div className="mb-6">
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
            </div>
            <ol className="grid grid-cols-5 gap-2">
              {steps.map((label, index) => (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => index < step && setStep(index)}
                    disabled={index >= step || saving}
                    className={`flex w-full items-center gap-1.5 text-left text-[10px] font-semibold sm:text-xs ${index === step ? "text-brand" : index < step ? "text-black/60" : "text-black/30"}`}
                  >
                    <span className={`grid size-6 shrink-0 place-items-center rounded-full text-[10px] ${index <= step ? "bg-brand text-white" : "bg-stone-100 text-black/40"}`}>
                      {index + 1}
                    </span>
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        )}

        {(isEditing || step === 0) && (
          <section className="space-y-4">
            {!isEditing && <h4 className="font-display font-bold">Student details</h4>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full Name*">
                <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} className={inputCls} required autoFocus={!isEditing} />
              </Field>
              <Field label="Gender">
                <select value={form.gender} onChange={(e) => set("gender", e.target.value)} className={inputCls}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </Field>
              <Field label="Date of Birth">
                <input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} className={inputCls} />
              </Field>
            </div>
          </section>
        )}

        {(isEditing || step === 1) && (
          <section className="space-y-4">
            {!isEditing && <h4 className="font-display font-bold">Class and fees</h4>}
            <Field label="Class*">
              <select value={form.classId} onChange={(e) => handleClassChange(e.target.value)} className={inputCls} required>
                <option value="">Select class</option>
                {classes.filter((schoolClass) => schoolClass.schoolSection === form.section).map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.className} - {schoolClass.department} · {schoolClass.tuitionFee.toLocaleString()} XAF
                  </option>
                ))}
              </select>
            </Field>
            {form.classId ? (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm">
                <p className="font-bold text-[#121212]">Fee plan · {selectedClass?.className} {selectedClass?.department}</p>
                <div className="mt-2 grid gap-2 text-xs text-black/65 sm:grid-cols-2">
                  <p>Tuition <strong className="block text-sm">{tuitionFee.toLocaleString()} XAF</strong></p>
                  <p>Installments <strong className="block text-sm">{installmentCount} equal payments · about {installmentCount ? Math.ceil(tuitionFee / installmentCount).toLocaleString() : 0} XAF each</strong></p>
                  <p>Registration fee <strong className="block text-sm">{registrationRequired ? `${registrationAmount.toLocaleString()} XAF required` : "Not required"}</strong></p>
                  <p>Total required <strong className="block text-sm">{(tuitionFee + registrationAmount).toLocaleString()} XAF</strong></p>
                </div>
                <div className="mt-3 border-t border-blue-200/60 pt-3">
                  <Field label="Amount the student pays now (XAF)">
                    <input
                      type="number"
                      min={0}
                      max={tuitionFee + registrationAmount}
                      step={500}
                      value={Number(form.upfrontPayment) || 0}
                      onChange={(e) => set("upfrontPayment", Math.max(0, Number(e.target.value) || 0) as any)}
                      className={inputCls}
                      placeholder="e.g. 25000"
                    />
                  </Field>
                  {(() => {
                    const totalRequired = tuitionFee + registrationAmount;
                    const paidNow = Math.max(0, Number(form.upfrontPayment) || 0);
                    const balance = Math.max(0, totalRequired - paidNow);
                    return (
                      <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                        <p className="rounded-lg bg-white/70 px-3 py-2">Paid now <strong className="block text-sm text-green-700">{paidNow.toLocaleString()} XAF</strong></p>
                        <p className="rounded-lg bg-white/70 px-3 py-2">Balance left <strong className={`block text-sm ${balance > 0 ? "text-red-600" : "text-green-700"}`}>{balance.toLocaleString()} XAF{balance === 0 && totalRequired > 0 ? " · Fully paid" : ""}</strong></p>
                      </div>
                    );
                  })()}
                  <p className="mt-2 text-xs text-black/55">Type what the student pays during registration — the balance updates live and is saved with the student.</p>
                </div>
              </div>
            ) : (
              <p className="rounded-lg bg-stone-50 p-4 text-sm text-black/50">Choose a class to see its tuition and registration requirements.</p>
            )}
          </section>
        )}

        {(isEditing || step === 2) && (
          <section className="space-y-4">
            {!isEditing && <h4 className="font-display font-bold">Parent and registration details</h4>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Parent Name">
                <input value={form.parentName} onChange={(e) => set("parentName", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Parent Phone*">
                <input value={form.parentPhone} onChange={(e) => set("parentPhone", e.target.value)} className={inputCls} required />
              </Field>
              <Field label="Address">
                <input value={form.address} onChange={(e) => set("address", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Registration Date">
                <input type="date" value={form.registrationDate} onChange={(e) => set("registrationDate", e.target.value)} className={inputCls} />
              </Field>
            </div>
          </section>
        )}

        {(isEditing || step === 3) && (
          <section className="space-y-4">
            {!isEditing && <h4 className="font-display font-bold">Student photo <span className="text-xs font-normal text-black/45">Optional</span></h4>}
            <input ref={uploadRef} type="file" accept="image/*" onChange={uploadPhoto} className="hidden" />
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
              <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                {cameraStream ? (
                  <video ref={videoRef} autoPlay playsInline muted className="aspect-[4/3] w-full object-cover" />
                ) : form.photoUrl ? (
                  <img src={form.photoUrl} alt="Student photo preview" className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div className="grid aspect-[4/3] place-items-center text-center text-black/40">
                    <div>
                      <ImagePlus className="mx-auto mb-2 size-8" />
                      <p className="text-sm font-semibold">No photo selected</p>
                      <p className="mt-1 text-xs">Capture with webcam or upload an image</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {cameraStream ? (
                  <>
                    <button type="button" onClick={capturePhoto} className="flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand/90">
                      <Camera className="size-4" /> Take photo
                    </button>
                    <button type="button" onClick={stopCamera} className="flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold hover:bg-stone-50">
                      <X className="size-4" /> Stop camera
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => void startCamera()} className="flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2.5 text-sm font-semibold text-white hover:bg-brand/90">
                    <Camera className="size-4" /> Use webcam
                  </button>
                )}
                <button type="button" onClick={() => uploadRef.current?.click()} className="flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold hover:bg-stone-50">
                  <Upload className="size-4" /> Upload photo
                </button>
                {form.photoUrl && (
                  <button type="button" onClick={() => set("photoUrl", "")} className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50">
                    <Trash2 className="size-4" /> Remove photo
                  </button>
                )}
                <p className="text-xs leading-5 text-black/45">Images are resized before saving. Maximum upload size: 10 MB.</p>
              </div>
            </div>
            {cameraError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{cameraError}</p>}
            {!isEditing && <p className="text-xs text-black/50">You can skip this step and add a photo later.</p>}
          </section>
        )}

        {!isEditing && step === 4 && (
          <section className="space-y-4">
            <h4 className="font-display font-bold">Review student information</h4>
            <div className="grid gap-3 rounded-xl border border-stone-200 p-4 sm:grid-cols-2">
              <ReviewItem label="Photo" value={form.photoUrl ? "Photo added" : "Not provided"} />
              <ReviewItem label="Student" value={form.fullName} />
              <ReviewItem label="Gender" value={form.gender} />
              <ReviewItem label="Date of birth" value={form.dob || "Not provided"} />
              <ReviewItem label="Class" value={`${selectedClass?.className || "—"} ${selectedClass?.department || ""}`} />
              <ReviewItem label="Parent" value={form.parentName || "Not provided"} />
              <ReviewItem label="Parent phone" value={form.parentPhone} />
              <ReviewItem label="Tuition" value={`${tuitionFee.toLocaleString()} XAF`} />
              <ReviewItem label="Installments" value={`${installmentCount} equal payments`} />
              <ReviewItem label="Registration fee" value={registrationRequired ? `${registrationAmount.toLocaleString()} XAF required` : "Not required"} />
              <ReviewItem label="Total required" value={`${(tuitionFee + registrationAmount).toLocaleString()} XAF`} />
              <ReviewItem label="Paid at registration" value={`${Math.max(0, Number(form.upfrontPayment) || 0).toLocaleString()} XAF`} />
              <ReviewItem label="Balance left" value={`${Math.max(0, tuitionFee + registrationAmount - (Math.max(0, Number(form.upfrontPayment) || 0))).toLocaleString()} XAF`} />
            </div>
            <p className="text-xs text-black/50">The fee plan is saved with the student. Payments can be recorded later under Fees & Finance.</p>
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
          {!isEditing && step === 3 && (
            <button
              type="button"
              onClick={() => setStep(4)}
              className="mr-auto px-2 py-2.5 text-sm font-semibold text-black/55 hover:text-black"
              disabled={saving}
            >
              Skip photo
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving}
          >
            {saving ? "Saving..." : isEditing ? "Update Student" : step < steps.length - 1 ? "Continue" : "Add Student"}
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