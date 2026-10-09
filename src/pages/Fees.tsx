import { useMemo, useState, useEffect } from "react";
import { Wallet, AlertTriangle, MessageSquare, Download, Printer, Filter, Search, FileText, Plus, X } from "lucide-react";
import { CompactPageLoader } from "@/components/CompactPageLoader";
import { toast } from "sonner";
import axios from "axios";
import jsPDF from "jspdf";
import "jspdf-autotable";

const API_BASE = import.meta.env.VITE_API_URL ?? "https://manfess-back.onrender.com/api";

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
  tuitionFee?: number;
  tuitionInstallments?: number;
  tuitionFeePaid?: number;
  tuitionInstallmentsPaid?: number;
  registrationFeeRequired?: boolean;
  registrationFeeAmount?: number;
  registrationFeePaid?: number;
  feePayments?: Array<{ feeType: "tuition" | "registration"; amount: number; installmentNumber?: number; paidAt: string }>;
}

interface Class {
  id: string;
  className: string;
  department: string;
  cycle: string;
  acedemicYear: string;
  classMasterId: string;
  tuitionFee: number;
  tuitionInstallments: number;
  registrationFeeRequired: boolean;
  registrationFeeAmount: number;
}

function getFeePlan(student: Student, schoolClass?: Class) {
  const tuitionFee = Number(student.tuitionFee ?? schoolClass?.tuitionFee ?? 0);
  const tuitionFeePaid = Number(student.tuitionFeePaid ?? student.feesPaid ?? 0);
  const tuitionInstallments = Number(student.tuitionInstallments ?? schoolClass?.tuitionInstallments ?? 1);
  const tuitionInstallmentsPaid = Number(student.tuitionInstallmentsPaid ?? 0);
  const registrationFeeRequired = Boolean(student.registrationFeeRequired ?? schoolClass?.registrationFeeRequired);
  const registrationFeeAmount = registrationFeeRequired
    ? Number(student.registrationFeeAmount ?? schoolClass?.registrationFeeAmount ?? 0)
    : 0;
  const registrationFeePaid = Number(student.registrationFeePaid ?? 0);
  return {
    tuitionFee,
    tuitionFeePaid,
    tuitionInstallments,
    tuitionInstallmentsPaid,
    registrationFeeRequired,
    registrationFeeAmount,
    registrationFeePaid,
    registrationDue: Math.max(0, registrationFeeAmount - registrationFeePaid),
    tuitionDue: Math.max(0, tuitionFee - tuitionFeePaid),
    totalFee: tuitionFee + registrationFeeAmount,
  };
}

export function FeesPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [feeFilter, setFeeFilter] = useState<string>("all");
  const [payingStudent, setPayingStudent] = useState<Student | null>(null);
  const [paymentType, setPaymentType] = useState<"tuition" | "registration">("tuition");
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [savingPayment, setSavingPayment] = useState(false);

  // Fetch data
  const fetchStudents = async (selectedClassId: string) => {
    try {
      const endpoint = selectedClassId === "all"
        ? `${API_BASE}/students`
        : `${API_BASE}/students/class/${selectedClassId}`;

      const studentsRes = await axios.get(endpoint);
      if (studentsRes.data.success) {
        const mappedStudents = studentsRes.data.data.map((student: any) => ({
          ...student,
          id: student._id || student.id
        }));
        setStudents(mappedStudents);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to fetch students");
      console.error("Error fetching students:", error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const classesRes = await axios.get(`${API_BASE}/classes`);

      if (classesRes.data.success) {
        const mappedClasses = classesRes.data.data.map((cls: any) => ({
          ...cls,
          id: cls._id || cls.id,
          className: cls.className || cls.name,
          tuitionFee: Number(cls.tuitionFee) || 0,
          tuitionInstallments: Number(cls.tuitionInstallments) || 1,
          registrationFeeRequired: Boolean(cls.registrationFeeRequired),
          registrationFeeAmount: Number(cls.registrationFeeAmount) || 0,
        }));
        setClasses(mappedClasses);

        const nextClassId = classFilter === "all" && mappedClasses[0] ? mappedClasses[0].id : classFilter;
        if (nextClassId !== classFilter) {
          setClassFilter(nextClassId);
        }
        await fetchStudents(nextClassId);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to fetch data");
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  useEffect(() => {
    if (!classes.length) return;
    if (classFilter === "all") {
      void fetchStudents("all");
      return;
    }
    void fetchStudents(classFilter);
  }, [classFilter, classes.length]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalStudents = students.length;
    const totalPaid = students.reduce((sum, s) => sum + s.feesPaid, 0);
    const totalDue = students.reduce((sum, s) => sum + s.feesDue, 0);
    const totalFees = totalPaid + totalDue;
    const debtors = students.filter((s) => s.feesDue > 0);
    const fullyPaid = students.filter((s) => s.feesDue === 0);
    const partialPaid = students.filter((s) => {
      const classObj = classes.find(c => c.id === s.classId);
      const totalFee = getFeePlan(s, classObj).totalFee;
      return s.feesDue > 0 && s.feesDue < totalFee;
    });

    // Fee collection rate
    const collectionRate = totalFees > 0 ? (totalPaid / totalFees) * 100 : 0;

    return {
      totalStudents,
      totalPaid,
      totalDue,
      totalFees,
      debtors,
      fullyPaid,
      partialPaid,
      collectionRate,
      debtorsCount: debtors.length,
      fullyPaidCount: fullyPaid.length,
      averageDue: totalStudents > 0 ? totalDue / totalStudents : 0
    };
  }, [students, classes]);

  // Filter students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Search filter
      if (searchTerm && !`${s.fullName} ${s.parentName} ${s.parentPhone}`.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      // Class filter
      if (classFilter !== "all" && s.classId !== classFilter) {
        return false;
      }
      // Fee status filter
      if (feeFilter === "debtors" && s.feesDue === 0) return false;
      if (feeFilter === "fully-paid" && s.feesDue > 0) return false;
      if (feeFilter === "partial" && (s.feesDue === 0 || s.feesDue >= getFeePlan(s, classes.find(c => c.id === s.classId)).totalFee)) return false;
      return true;
    });
  }, [students, searchTerm, classFilter, feeFilter, classes]);

  const startPayment = (student: Student) => {
    const schoolClass = classes.find((item) => item.id === student.classId);
    const plan = getFeePlan(student, schoolClass);
    if (plan.registrationDue > 0) {
      setPaymentType("registration");
      setPaymentAmount(plan.registrationDue);
    } else if (plan.tuitionDue > 0) {
      const installment = plan.tuitionInstallmentsPaid + 1;
      const expected = installment >= plan.tuitionInstallments
        ? plan.tuitionDue
        : Math.min(plan.tuitionDue, Math.round((plan.tuitionFee / plan.tuitionInstallments) * 100) / 100);
      setPaymentType("tuition");
      setPaymentAmount(expected);
    } else {
      toast.success("This student has no remaining fees");
      return;
    }
    setPayingStudent(student);
  };

  const changePaymentType = (nextType: "tuition" | "registration") => {
    if (!payingStudent) return;
    const plan = getFeePlan(payingStudent, classes.find((item) => item.id === payingStudent.classId));
    if (nextType === "registration") {
      setPaymentAmount(plan.registrationDue);
    } else {
      const installment = plan.tuitionInstallmentsPaid + 1;
      setPaymentAmount(installment >= plan.tuitionInstallments
        ? plan.tuitionDue
        : Math.min(plan.tuitionDue, Math.round((plan.tuitionFee / plan.tuitionInstallments) * 100) / 100));
    }
    setPaymentType(nextType);
  };

  const recordFeePayment = async () => {
    if (!payingStudent || paymentAmount <= 0) return;
    const plan = getFeePlan(payingStudent, classes.find((item) => item.id === payingStudent.classId));
    const installmentNumber = paymentType === "tuition" ? plan.tuitionInstallmentsPaid + 1 : undefined;
    setSavingPayment(true);
    try {
      await axios.post(`${API_BASE}/students/${payingStudent.id}/pay-fees`, {
        amount: paymentAmount,
        feeType: paymentType,
        installmentNumber,
        recordedBy: "admin",
      });
      toast.success(paymentType === "registration" ? "Registration fee payment recorded" : `Tuition installment ${installmentNumber} recorded`);
      setPayingStudent(null);
      await fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Could not record payment");
    } finally {
      setSavingPayment(false);
    }
  };

  // Export to PDF
  const exportPDF = () => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(20);
    doc.text("Fees Report", 14, 22);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Total Students: ${stats.totalStudents}`, 14, 36);
    doc.text(`Total Fees Collected: ${stats.totalPaid.toLocaleString()} XAF`, 14, 42);
    doc.text(`Total Fees Outstanding: ${stats.totalDue.toLocaleString()} XAF`, 14, 48);
    doc.text(`Collection Rate: ${stats.collectionRate.toFixed(1)}%`, 14, 54);

    // Table
    const tableData = filteredStudents.map((s) => {
      const classObj = classes.find(c => c.id === s.classId);
      const status = s.feesDue === 0 ? "Fully Paid" : "Owing";
      return [
        s.fullName,
        classObj?.className || "",
        s.parentName,
        s.parentPhone,
        s.feesPaid.toLocaleString(),
        s.feesDue.toLocaleString(),
        status
      ];
    });

    (doc as any).autoTable({
      startY: 60,
      head: [["Name", "Class", "Parent", "Phone", "Paid", "Due", "Status"]],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [0, 0, 0], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 20 },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 20 },
        5: { cellWidth: 20 },
        6: { cellWidth: 20 }
      }
    });

    // Summary
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    doc.text(`Summary:`, 14, finalY);
    doc.text(`Total Students: ${filteredStudents.length}`, 14, finalY + 6);
    doc.text(`Total Paid: ${filteredStudents.reduce((sum, s) => sum + s.feesPaid, 0).toLocaleString()} XAF`, 14, finalY + 12);
    doc.text(`Total Due: ${filteredStudents.reduce((sum, s) => sum + s.feesDue, 0).toLocaleString()} XAF`, 14, finalY + 18);

    doc.save(`fees_report_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF exported successfully");
  };

  // Export to CSV
  const exportCSV = () => {
    const headers = ["Full Name", "Class", "Parent Name", "Parent Phone", "Fees Paid", "Fees Due", "Status"];

    const rows = filteredStudents.map((s) => {
      const classObj = classes.find(c => c.id === s.classId);
      const status = s.feesDue === 0 ? "Fully Paid" : "Owing";
      return [
        s.fullName,
        classObj?.className || "",
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
    link.download = `fees_report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("CSV exported successfully");
  };

  // Print debtors
  const printDebtors = () => {
    const debtors = filteredStudents.filter(s => s.feesDue > 0);

    if (debtors.length === 0) {
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
          .summary { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #f5f5f5; padding: 10px; text-align: left; border: 1px solid #ddd; }
          td { padding: 8px 10px; border: 1px solid #ddd; }
          .total { margin-top: 20px; font-weight: bold; }
          .fee-due { color: #dc3545; font-weight: bold; }
          .status-badge { 
            padding: 3px 8px; 
            border-radius: 12px; 
            font-size: 11px; 
            font-weight: bold;
          }
          .status-owing { background: #fee2e2; color: #dc2626; }
          .status-partial { background: #fef3c7; color: #d97706; }
        </style>
      </head>
      <body>
        <h1>📋 Outstanding Fees Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        
        <div class="summary">
          <h3>Summary</h3>
          <p>Total Debtors: ${debtors.length} students</p>
          <p>Total Outstanding: ${debtors.reduce((sum, s) => sum + s.feesDue, 0).toLocaleString()} XAF</p>
          <p>Average Due: ${(debtors.reduce((sum, s) => sum + s.feesDue, 0) / debtors.length).toLocaleString()} XAF</p>
        </div>
        
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
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
    `;

    debtors.forEach((s, index) => {
      const classObj = classes.find(c => c.id === s.classId);
      const totalFee = getFeePlan(s, classObj).totalFee;
      const status = s.feesDue === totalFee ? "Owing" : "Partial";
      const statusClass = status === "Owing" ? "status-owing" : "status-partial";

      html += `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${s.fullName}</strong></td>
          <td>${classObj?.className || ""}</td>
          <td>${s.parentName}</td>
          <td>${s.parentPhone}</td>
          <td>${s.feesPaid.toLocaleString()}</td>
          <td class="fee-due">${s.feesDue.toLocaleString()}</td>
          <td><span class="status-badge ${statusClass}">${status}</span></td>
        </tr>
      `;
    });

    const totalDue = debtors.reduce((sum, s) => sum + s.feesDue, 0);

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
    return <CompactPageLoader label="Loading fees data..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Fees & Finance</h1>
        <p className="text-sm text-black/60 mt-1">Track payments and outstanding balances.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <div className="min-w-0 rounded-2xl bg-brand p-3 text-white sm:p-5">
          <Wallet className="size-5 mb-3 opacity-80" />
          <div className="text-[10px] uppercase tracking-widest font-bold opacity-80">Collected</div>
          <div className="mt-1 break-words font-display text-lg font-extrabold sm:text-2xl">{stats.totalPaid.toLocaleString()} XAF</div>
          <div className="text-xs opacity-80 mt-1">{stats.fullyPaidCount} fully paid</div>
        </div>

        <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-3 sm:p-5">
          <AlertTriangle className="size-5 mb-3 text-red-500" />
          <div className="text-[10px] uppercase tracking-widest font-bold text-black/40">Outstanding</div>
          <div className="mt-1 break-words font-display text-lg font-extrabold text-red-600 sm:text-2xl">{stats.totalDue.toLocaleString()} XAF</div>
          <div className="text-xs text-black/50 mt-1">{stats.debtorsCount} students owe</div>
        </div>

        <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-3 sm:p-5">
          <div className="text-[10px] uppercase tracking-widest font-bold text-black/40">Collection Rate</div>
          <div className="mt-1 break-words font-display text-lg font-extrabold sm:text-2xl">{stats.collectionRate.toFixed(1)}%</div>
          <div className="text-xs text-black/50 mt-1">{stats.totalStudents} total students</div>
        </div>

        <div className="min-w-0 rounded-2xl border border-stone-200 bg-white p-3 sm:p-5">
          <div className="text-[10px] uppercase tracking-widest font-bold text-black/40">Average Due</div>
          <div className="mt-1 break-words font-display text-lg font-extrabold sm:text-2xl">{stats.averageDue.toLocaleString()} XAF</div>
          <div className="text-xs text-black/50 mt-1">per student</div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid min-w-0 gap-3 rounded-2xl border border-stone-200 bg-white p-3 sm:flex sm:flex-wrap sm:items-center sm:p-4">
        <div className="relative min-w-0 w-full sm:flex-1 sm:basis-[200px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or parent..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-sm"
          />
        </div>

        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Filter className="size-4 text-black/40" />
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="min-w-0 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium sm:w-auto sm:max-w-[220px]"
          >
            <option value="all">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.className}</option>)}
          </select>
        </div>

        <div className="flex min-w-0 items-center gap-2 text-sm">
          <select
            value={feeFilter}
            onChange={(e) => setFeeFilter(e.target.value)}
            className="min-w-0 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium sm:w-auto"
          >
            <option value="all">All Students</option>
            <option value="fully-paid">Fully Paid</option>
            <option value="partial">Partial Payment</option>
            <option value="debtors">Owing</option>
          </select>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto">
          <button onClick={printDebtors} className="col-span-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-red-700 sm:col-span-1 sm:w-auto sm:px-4">
            <Printer className="size-4" /> Print Debtors
          </button>
          <button onClick={exportCSV} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold hover:bg-stone-50 sm:w-auto sm:px-4">
            <Download className="size-4" /> CSV
          </button>
          <button onClick={exportPDF} className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-semibold hover:bg-stone-50 sm:w-auto sm:px-4">
            <FileText className="size-4" /> PDF
          </button>
        </div>
      </div>

      {/* Student Table */}
      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-display font-bold">
            Students with fees
            <span className="text-sm font-normal text-black/40 ml-2">
              ({filteredStudents.length} shown)
            </span>
          </h3>
          {/* <button
            onClick={() => toast.success(`Reminder sent to ${stats.debtorsCount} parents`)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand/90"
          >
            <MessageSquare className="size-3.5" /> Send reminders
          </button> */}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-stone-50 text-left text-[10px] uppercase tracking-widest text-black/50 font-bold">
              <tr>
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Class</th>
                <th className="px-5 py-3">Parent</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3 text-right">Tuition Plan</th>
                <th className="px-5 py-3 text-right">Registration Fee</th>
                <th className="px-5 py-3 text-right">Fees Paid</th>
                <th className="px-5 py-3 text-right">Fees Due</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-black/40">
                    No students match your filters.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => {
                  const classObj = classes.find(c => c.id === s.classId);
                  const plan = getFeePlan(s, classObj);
                  const totalFee = plan.totalFee;
                  let status = "Fully Paid";
                  let statusColor = "bg-green-100 text-green-700";

                  if (s.feesDue > 0 && s.feesDue < totalFee) {
                    status = "Partial";
                    statusColor = "bg-yellow-100 text-yellow-700";
                  } else if (s.feesDue > 0 && s.feesDue >= totalFee) {
                    status = "Owing";
                    statusColor = "bg-red-100 text-red-700";
                  }

                  return (
                    <tr key={s.id} className="hover:bg-stone-50">
                      <td className="px-5 py-3 font-semibold">{s.fullName}</td>
                      <td className="px-5 py-3">{classObj?.className || "—"}</td>
                      <td className="px-5 py-3 text-xs">{s.parentName}</td>
                      <td className="px-5 py-3 text-xs">{s.parentPhone}</td>
                      <td className="px-5 py-3 text-right text-xs">
                        <strong>{plan.tuitionFee.toLocaleString()} XAF</strong>
                        <span className="block text-black/45">{plan.tuitionInstallmentsPaid}/{plan.tuitionInstallments} installments paid</span>
                      </td>
                      <td className="px-5 py-3 text-right text-xs">
                        {plan.registrationFeeRequired ? (
                          <>
                            <strong>{plan.registrationFeeAmount.toLocaleString()} XAF</strong>
                            <span className="block text-black/45">{plan.registrationFeePaid.toLocaleString()} paid</span>
                          </>
                        ) : <span className="text-black/40">Not required</span>}
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-green-600">
                        {s.feesPaid.toLocaleString()}
                      </td>
                      <td className={`px-5 py-3 text-right font-bold ${s.feesDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {s.feesDue.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${statusColor}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => startPayment(s)}
                          disabled={s.feesDue <= 0}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Plus className="size-3.5" /> Record payment
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {payingStudent && (() => {
        const plan = getFeePlan(payingStudent, classes.find((item) => item.id === payingStudent.classId));
        const installmentNumber = plan.tuitionInstallmentsPaid + 1;
        const expectedTuitionInstallment = installmentNumber >= plan.tuitionInstallments
          ? plan.tuitionDue
          : Math.min(plan.tuitionDue, Math.round((plan.tuitionFee / plan.tuitionInstallments) * 100) / 100);
        return (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setPayingStudent(null)}>
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold">Record Fee Payment</h2>
                  <p className="mt-1 text-sm text-black/55">{payingStudent.fullName} · {classes.find((item) => item.id === payingStudent.classId)?.className}</p>
                </div>
                <button type="button" onClick={() => setPayingStudent(null)} className="grid size-8 place-items-center rounded-lg text-black/45 hover:bg-stone-100" aria-label="Close payment dialog">
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-stone-50 p-3 text-xs">
                <p>Tuition due <strong className="block text-sm">{plan.tuitionDue.toLocaleString()} XAF</strong></p>
                <p>Registration due <strong className="block text-sm">{plan.registrationDue.toLocaleString()} XAF</strong></p>
              </div>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-black/50">Payment category</span>
                  <select value={paymentType} onChange={(event) => changePaymentType(event.target.value as "tuition" | "registration")} className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm">
                    {plan.tuitionDue > 0 && plan.registrationDue <= 0 && <option value="tuition">Tuition installment {installmentNumber} of {plan.tuitionInstallments}</option>}
                    {plan.registrationDue > 0 && <option value="registration">Registration fee</option>}
                  </select>
                </label>

                {paymentType === "tuition" ? (
                  <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm">
                    Installment {installmentNumber} of {plan.tuitionInstallments}: <strong>{expectedTuitionInstallment.toLocaleString()} XAF</strong>
                    <p className="mt-1 text-xs text-black/55">Tuition is split into equal installments; the final amount includes any rounding difference.</p>
                  </div>
                ) : (
                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-black/50">Registration payment (XAF)</span>
                    <input type="number" min={1} max={plan.registrationDue} step={500} value={paymentAmount} onChange={(event) => setPaymentAmount(Math.max(0, Number(event.target.value) || 0))} className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm" />
                  </label>
                )}
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setPayingStudent(null)} className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-semibold hover:bg-stone-50">Cancel</button>
                <button type="button" onClick={recordFeePayment} disabled={savingPayment || paymentAmount <= 0} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50">
                  {savingPayment ? "Saving..." : "Confirm Payment"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}