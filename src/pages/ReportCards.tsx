import { useEffect, useMemo, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FileText, ArrowRight, Search, Printer, FileSpreadsheet, Calendar, Award, Download } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { currentUser } from "@/lib/auth";
import { getStoredSchoolSection } from "@/lib/schoolSystem";
import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";

const API_BASE = import.meta.env.VITE_API_URL ?? "https://manfess-back.onrender.com/api";

interface Student {
  id: string;
  fullName: string;
  matricule?: string;
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
  admissionNumber?: string;
}

interface AttendanceSummary {
  studentId: string;
  schoolDays: number;
  sessions: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
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

// Term definitions for Cameroon school system
const TERMS = [
  {
    id: "first",
    label: "First Term",
    sequences: ["1st seq", "2nd seq"],
    displayColumns: ["1st", "2nd"]
  },
  {
    id: "second",
    label: "Second Term",
    sequences: ["3rd seq", "4th seq"],
    displayColumns: ["3rd", "4th"]
  },
  {
    id: "third",
    label: "Third Term",
    sequences: ["1st seq", "2nd seq", "3rd seq", "4th seq", "5th seq", "6th seq"],
    displayColumns: ["1st Term", "2nd Term", "3rd Term"]
  },
  {
    id: "annual",
    label: "Annual",
    sequences: ["1st seq", "2nd seq", "3rd seq", "4th seq", "5th seq", "6th seq"],
    displayColumns: ["1st", "2nd", "3rd", "4th", "5th", "6th"]
  },
];

// Grade function matching the image
function gradeFor(score: number): { grade: string; remark: string } {
  if (score >= 18) return { grade: "A", remark: "Excellent" };
  if (score >= 16) return { grade: "B", remark: "Very Good" };
  if (score >= 14) return { grade: "C", remark: "Good" };
  if (score >= 12) return { grade: "D", remark: "Fair" };
  if (score >= 10) return { grade: "E", remark: "Average" };
  return { grade: "F", remark: "Poor" };
}

function rankWithTies(values: { id: string; avg: number }[]): Record<string, number> {
  const sorted = [...values].sort((a, b) => b.avg - a.avg);
  const ranks: Record<string, number> = {};
  let lastAvg = Number.POSITIVE_INFINITY;
  let lastRank = 0;
  sorted.forEach((v, i) => {
    if (v.avg < lastAvg) {
      lastRank = i + 1;
      lastAvg = v.avg;
    }
    ranks[v.id] = lastRank;
  });
  return ranks;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function ReportCardsIndex() {
  const navigate = useNavigate();
  const user = currentUser();
  const isTeacher = user?.role === "teacher";
  const printRef = useRef<HTMLDivElement>(null);

  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [attendanceSummaries, setAttendanceSummaries] = useState<Record<string, AttendanceSummary>>({});
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [classDataLoading, setClassDataLoading] = useState(false);
  const [classDataRetry, setClassDataRetry] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [teacher, setTeacher] = useState<any>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const [classId, setClassId] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>("first");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("");

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError("");
      const activeSection = getStoredSchoolSection();
      const [subjectsRes, classesRes, usersRes] = await Promise.all([
        axios.get(`${API_BASE}/subjects`, { params: { section: activeSection } }),
        axios.get(`${API_BASE}/classes`, { params: { section: activeSection } }),
        axios.get(`${API_BASE}/users`, { params: { section: activeSection } }),
      ]);

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
        if (mappedClasses.length > 0 && !classId) {
          setClassId(mappedClasses[0].id);
        }
        // Set default academic year from first class
        if (mappedClasses.length > 0 && !selectedAcademicYear) {
          setSelectedAcademicYear(mappedClasses[0].acedemicYear || "");
        }
      }

      if (usersRes.data.success) {
        const teacherUsers = usersRes.data.data.filter((u: any) => u.role === "teacher");
        const mappedTeachers = teacherUsers.map((t: any) => ({
          id: t._id,
          name: t.name,
          username: t.username,
          phone: t.phone,
          role: t.role,
          qualification: t.qualification || "",
          subjectIds: t.subjectIds || [],
          classIds: t.classIds || [],
          acedemicYear: t.acedemicYear || "",
        }));
        setTeachers(mappedTeachers);
      }
    } catch (error: any) {
      console.error("Error fetching data:", error);
      setLoadError(error.response?.data?.message || "Could not load class and subject lists.");
      toast.error(error.response?.data?.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedClass = useMemo(() => {
    return classes.find((schoolClass) => schoolClass.id === classId);
  }, [classes, classId]);

  useEffect(() => {
    if (!classId) {
      setStudents([]);
      setMarks([]);
      setClassDataLoading(false);
      return;
    }

    let cancelled = false;
    setClassDataLoading(true);
    setLoadError("");
    setStudents([]);
    setMarks([]);

    const params = selectedClass?.acedemicYear ? { academicYear: selectedClass.acedemicYear } : {};
    Promise.all([
      axios.get(`${API_BASE}/students/class/${classId}`),
      axios.get(`${API_BASE}/marks`, { params: { classId, ...params } }),
    ]).then(([studentsRes, marksRes]) => {
      if (cancelled) return;
      if (studentsRes.data.success) {
        setStudents(studentsRes.data.data.map((student: any) => ({
          ...student,
          id: String(student._id || student.id),
          classId: String(student.classId),
          matricule: student.matricule || student.admissionNumber || "",
          admissionNumber: student.admissionNumber || student.matricule || "",
        })));
      }
      if (marksRes.data.success) {
        setMarks(marksRes.data.data.map((mark: any) => ({
          ...mark,
          id: mark._id || mark.id,
          studentId: String(mark.studentId),
          subjectId: String(mark.subjectId),
          classId: String(mark.classId),
          academicyear: mark.academicyear || mark.academicYear || "",
        })));
      }
    }).catch((error: any) => {
      if (cancelled) return;
      console.error("Error fetching class report data:", error);
      setLoadError(error.response?.data?.message || "Could not load reports for this class.");
    }).finally(() => {
      if (!cancelled) setClassDataLoading(false);
    });

    return () => { cancelled = true; };
  }, [classId, selectedClass?.acedemicYear, classDataRetry]);

  useEffect(() => {
    if (!classId || !selectedAcademicYear) {
      setAttendanceSummaries({});
      return;
    }

    let cancelled = false;
    axios.get(`${API_BASE}/attendance/students/summary`, {
      params: {
        classId,
        academicYear: selectedAcademicYear,
        term: selectedTerm === "annual" ? "annual" : selectedTerm,
      },
    }).then((response) => {
      if (!cancelled && response.data.success) {
        setAttendanceSummaries(Object.fromEntries(
          response.data.data.map((summary: AttendanceSummary) => [summary.studentId, summary]),
        ));
      }
    }).catch((error) => {
      console.error("Unable to load report-card attendance", error);
      if (!cancelled) setAttendanceSummaries({});
    });

    return () => { cancelled = true; };
  }, [classId, selectedAcademicYear, selectedTerm]);

  // Get unique academic years from classes
  const academicYears = useMemo(() => {
    const years = new Set<string>();
    classes.forEach(c => {
      if (c.acedemicYear) {
        years.add(c.acedemicYear);
      }
    });
    return Array.from(years).sort();
  }, [classes]);

  // Filter classes by selected academic year
  const filteredClasses = useMemo(() => {
    if (!selectedAcademicYear) return classes;
    return classes.filter(c => c.acedemicYear === selectedAcademicYear);
  }, [classes, selectedAcademicYear]);

  const teachersMap = useMemo(() => {
    const map: Record<string, string> = {};
    teachers.forEach((t) => {
      map[t.id] = t.name || "—";
    });
    return map;
  }, [teachers]);

  const getTeacherNames = (subject: Subject): string => {
    const marksForSubject = marks.filter((m) => m.subjectId === subject.id);
    const recordedBy = marksForSubject.find((m) => m.recordedBy)?.recordedBy;
    if (recordedBy) {
      const t = teachers.find((tt) => tt.name === recordedBy || tt.id === recordedBy);
      if (t) return t.name;
      return recordedBy;
    }

    if (subject.teacherIds && subject.teacherIds.length > 0) {
      const names = subject.teacherIds
        .map((id) => teachersMap[id])
        .filter((name) => name !== "—");
      return names.length > 0 ? names.join(", ") : "—";
    }

    return "—";
  };

  const allowedClasses = useMemo(() => {
    if (isTeacher && teacher) {
      return filteredClasses.filter((c) => teacher.classIds?.includes(c.id));
    }
    return filteredClasses;
  }, [filteredClasses, isTeacher, teacher]);

  const classSubjects = useMemo(() => {
    return subjects.filter((s) => s.classIds.includes(classId));
  }, [subjects, classId]);

  const classStudents = useMemo(() => {
    let filtered = students
      .filter((s) => s.classId === classId)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));

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

  const termInfo = useMemo(() => {
    return TERMS.find((t) => t.id === selectedTerm) || TERMS[0];
  }, [selectedTerm]);

  const currentSequences = useMemo(() => {
    return termInfo?.sequences || [];
  }, [termInfo]);

  const displayColumns = useMemo(() => {
    return termInfo?.displayColumns || [];
  }, [termInfo]);

  const isThirdTerm = selectedTerm === "third";

  const reportData = useMemo(() => {
    const sequences = currentSequences;
    const isThirdTerm = selectedTerm === "third";
    const groupSize = 2; // Each term has 2 sequences

    const studentData = classStudents.map((student) => {
      let totalWeighted = 0;
      let totalCoeff = 0;
      const subjectScores: any[] = [];

      for (const subject of classSubjects) {
        // Get marks for each sequence
        const sequenceScores: Record<string, number | null> = {};
        sequences.forEach((seq) => {
          const mark = marks.find(
            (m) =>
              m.studentId === student.id &&
              m.subjectId === subject.id &&
              m.sequence === seq
          );
          sequenceScores[seq] = mark ? mark.score : null;
        });

        let avg = 0;

        // For Third Term, calculate grouped averages
        if (isThirdTerm && groupSize > 0) {
          // Get term averages: 1st Term (seq 1,2), 2nd Term (seq 3,4), 3rd Term (seq 5,6)
          const termAverages: number[] = [];
          for (let g = 0; g < sequences.length; g += groupSize) {
            const group = sequences.slice(g, g + groupSize);
            const scores = group
              .map((seq) => sequenceScores[seq])
              .filter((s): s is number => s !== null && s !== undefined);
            const groupAvg = scores.length > 0
              ? scores.reduce((a, b) => a + b, 0) / scores.length
              : 0;
            termAverages.push(groupAvg);
          }

          // Store term averages as sequence scores for display
          const termDisplayScores: Record<string, number | null> = {};
          termAverages.forEach((avgVal, idx) => {
            termDisplayScores[`Term ${idx + 1}`] = avgVal;
          });

          // Store in a format that matches the display columns
          const displayCols = ["1st Term", "2nd Term", "3rd Term"];
          displayCols.forEach((col, idx) => {
            if (idx < termAverages.length) {
              sequenceScores[col] = termAverages[idx];
            }
          });

          // Overall average for the subject (average of the 3 terms)
          const validAverages = termAverages.filter(a => a > 0);
          avg = validAverages.length > 0
            ? validAverages.reduce((a, b) => a + b, 0) / validAverages.length
            : 0;
        } else {
          // Normal calculation for other terms
          const subjectMarks = marks.filter(
            (m) =>
              m.studentId === student.id &&
              m.subjectId === subject.id &&
              sequences.includes(m.sequence)
          );
          const scores = subjectMarks.map((m) => m.score);
          avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        }

        // Get class stats for this subject
        const classMarks = marks.filter(
          (m) => m.subjectId === subject.id && classStudents.some((s) => s.id === m.studentId) && sequences.includes(m.sequence)
        );
        const classAvg = classMarks.length ? classMarks.reduce((a, b) => a + b.score, 0) / classMarks.length : 0;
        const max = classMarks.length ? Math.max(...classMarks.map((m) => m.score)) : 0;
        const min = classMarks.length ? Math.min(...classMarks.map((m) => m.score)) : 0;

        subjectScores.push({
          subjectId: subject.id,
          name: subject.name,
          code: subject.code,
          coefficient: subject.coefficient,
          scores: [],
          sequenceScores,
          average: avg,
          weightedTotal: avg * subject.coefficient,
          classAvg,
          max,
          min,
          teacher: getTeacherNames(subject),
          grade: avg > 0 ? gradeFor(avg).grade : "-",
          remark: avg > 0 ? gradeFor(avg).remark : "-",
        });

        if (avg > 0) {
          totalWeighted += avg * subject.coefficient;
          totalCoeff += subject.coefficient;
        }
      }

      const overallAverage = totalCoeff > 0 ? totalWeighted / totalCoeff : 0;

      return {
        student,
        attendance: attendanceSummaries[student.id] || {
          studentId: student.id,
          schoolDays: 0,
          sessions: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          attendanceRate: 0,
        },
        subjectScores,
        overallAverage,
        totalWeighted,
        totalCoeff,
      };
    });

    const avgValues = studentData.map((d) => ({ id: d.student.id, avg: d.overallAverage }));
    const ranks = rankWithTies(avgValues);

    return studentData
      .map((d) => ({
        ...d,
        rank: ranks[d.student.id] || 0,
        status: d.overallAverage >= 10 ? "Promoted" : "Repeat",
      }))
      .sort((first, second) => first.rank - second.rank || first.student.fullName.localeCompare(second.student.fullName));
  }, [classStudents, classSubjects, marks, currentSequences, selectedTerm, attendanceSummaries]);

  const stats = useMemo(() => {
    const avgs = reportData.map((d) => d.overallAverage);
    const passed = reportData.filter((d) => d.overallAverage >= 10).length;
    const failed = reportData.filter((d) => d.overallAverage < 10).length;
    const avg = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0;
    const highest = avgs.length > 0 ? Math.max(...avgs) : 0;
    const lowest = avgs.length > 0 ? Math.min(...avgs) : 0;

    return { total: reportData.length, passed, failed, avg, highest, lowest };
  }, [reportData]);

  const generatePDF = async (studentData: typeof reportData[0]) => {
    setGeneratingPDF(true);
    try {
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '800px';
      container.style.backgroundColor = 'white';
      container.style.padding = '40px';
      container.style.zIndex = '9999';
      document.body.appendChild(container);

      const term = TERMS.find((t) => t.id === selectedTerm);
      const isAnnual = selectedTerm === "annual";
      const isThirdTerm = selectedTerm === "third";
      const title = isAnnual ? "Annual Report" : `${term?.label || "Report"}`;
      const academicYear = selectedClass?.acedemicYear || "2024 / 2025";
      const sequences = currentSequences;
      const displayCols = displayColumns;

      container.innerHTML = renderReportCardHTML(studentData, {
        selectedClass,
        title,
        academicYear,
        termId: selectedTerm,
        classAvg: stats.avg,
        classSize: reportData.length,
        sequences,
        displayColumns: displayCols,
        isThirdTerm,
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 800,
        height: container.scrollHeight,
      });

      const pdf = new jsPDF({
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdfWidth = 210;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const margin = 10;

      pdf.addImage(imgData, 'JPEG', margin, margin, pdfWidth - margin * 2, pdfHeight - margin * 2);

      document.body.removeChild(container);

      pdf.save(`report_${studentData.student.fullName}_${selectedTerm}.pdf`);
      toast.success("PDF downloaded successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setGeneratingPDF(false);
    }
  };

  const generateBulkPDF = async () => {
    if (reportData.length === 0) {
      toast.error("No students to generate reports for");
      return;
    }

    setGeneratingPDF(true);
    try {
      const pdf = new jsPDF({
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait',
      });

      const term = TERMS.find((t) => t.id === selectedTerm);
      const isAnnual = selectedTerm === "annual";
      const isThirdTerm = selectedTerm === "third";
      const title = isAnnual ? "Annual Report" : `${term?.label || "Report"}`;
      const academicYear = selectedClass?.acedemicYear || "2024 / 2025";
      const sequences = currentSequences;
      const displayCols = displayColumns;

      for (let i = 0; i < reportData.length; i++) {
        const data = reportData[i];

        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.left = '-9999px';
        container.style.top = '0';
        container.style.width = '800px';
        container.style.backgroundColor = 'white';
        container.style.padding = '40px';
        container.style.zIndex = '9999';
        document.body.appendChild(container);

        container.innerHTML = renderReportCardHTML(data, {
          selectedClass,
          title,
          academicYear,
          termId: selectedTerm,
          classAvg: stats.avg,
          classSize: reportData.length,
          sequences,
          displayColumns: displayCols,
          isThirdTerm,
        });

        await new Promise(resolve => setTimeout(resolve, 300));

        const canvas = await html2canvas(container, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          width: 800,
          height: container.scrollHeight,
        });

        document.body.removeChild(container);

        if (i > 0) {
          pdf.addPage();
        }

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdfWidth = 210;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        const margin = 10;

        pdf.addImage(imgData, 'JPEG', margin, margin, pdfWidth - margin * 2, pdfHeight - margin * 2);
      }

      pdf.save(`report_cards_${selectedClass?.className}_${selectedTerm}.pdf`);
      toast.success("Bulk PDF downloaded successfully");
    } catch (error) {
      console.error("Error generating bulk PDF:", error);
      toast.error("Failed to generate bulk PDF");
    } finally {
      setGeneratingPDF(false);
    }
  };

  function renderReportCardHTML(data: any, ctx: {
    selectedClass: Class | undefined;
    title: string;
    academicYear: string;
    termId: string;
    classAvg: number;
    classSize: number;
    sequences: string[];
    displayColumns: string[];
    isThirdTerm: boolean;
  }) {
    const avg = data.overallAverage;
    const gradeInfo = gradeFor(avg);
    const statusPass = avg >= 10;
    const statusText = statusPass ? "Passed" : "Failed";
    const displayCols = ctx.displayColumns;
    const isThirdTerm = ctx.isThirdTerm;
    const studentName = String(data.student.fullName || "Student");
    const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character] || character);
    const matricule = data.student.matricule || data.student.admissionNumber || "Not assigned";
    const defaultPortrait = data.student.gender === "female" ? "/female-student-avatar.svg" : "/male-student-avatar.svg";
    const photoUrl = escapeHtml(data.student.photoUrl || defaultPortrait);
    const portrait = `<img src="${photoUrl}" alt="${escapeHtml(studentName)}" crossorigin="anonymous" onerror="this.onerror=null;this.src='${defaultPortrait}'" style="width:100%;height:100%;object-fit:cover;display:block;background:#EAF2FB;"/>`;

    // Build sequence headers using display columns
    const seqHeaders = displayCols.map((col) =>
      `<th style="padding:5px 6px;border:1px solid #000000;font-weight:bold;text-align:center;font-size:10px;">${col}</th>`
    ).join("");

    // Build rows with sequence scores
    const rows = data.subjectScores
      .map((sub: any) => {
        let seqCells = '';

        if (isThirdTerm) {
          // For Third Term, use the term averages stored in sequenceScores
          seqCells = displayCols.map((col) => {
            const score = sub.sequenceScores?.[col];
            return `<td style="padding:5px 6px;border:1px solid #000000;text-align:center;font-weight:bold;font-size:9.5px;">${score !== null && score !== undefined ? Number(score).toFixed(2) : "-"}</td>`;
          }).join("");
        } else {
          // For other terms, use sequence scores
          seqCells = ctx.sequences.map((seq) => {
            const score = sub.sequenceScores?.[seq];
            return `<td style="padding:5px 6px;border:1px solid #000000;text-align:center;font-weight:bold;font-size:9.5px;">${score !== null && score !== undefined ? Number(score).toFixed(2) : "-"}</td>`;
          }).join("");
        }

        return `
          <tr>
            <td style="padding:5px 6px;border:1px solid #000000;text-align:left;font-weight:600;font-size:10px;">${sub.name}</td>
            ${seqCells}
            <td style="padding:5px 6px;border:1px solid #000000;text-align:center;font-weight:bold;font-size:9.5px;">${sub.average > 0 ? sub.average.toFixed(2) : "-"}</td>
            <td style="padding:5px 6px;border:1px solid #000000;text-align:center;font-weight:bold;font-size:9.5px;">${sub.coefficient}</td>
            <td style="padding:5px 6px;border:1px solid #000000;text-align:center;font-weight:bold;font-size:9.5px;">${sub.average > 0 ? sub.weightedTotal.toFixed(2) : "-"}</td>
            
            <td style="padding:5px 6px;border:1px solid #000000;text-align:center;font-weight:bold;font-size:9.5px;">${sub.grade}</td>
            <td style="padding:5px 6px;border:1px solid #000000;text-align:center;font-weight:bold;font-size:9.5px;">${sub.remark}</td>
            <td style="padding:5px 6px;border:1px solid #000000;text-align:center;font-weight:bold;font-size:9.5px;">${sub.teacher || "—"}</td>
          </tr>`;
      })
      .join("");

    // Build total row with sequence columns
    const totalSeqCells = displayCols.map(() => `<td style="padding:5px 6px;border:1px solid #000000;text-align:center;">-</td>`).join("");

    return `
      <div style="font-family:'Segoe UI',Arial,sans-serif;color:#17324D;max-width:1000px;margin:0 auto;border:1px solid #CADCF0;border-top:8px solid #155DAA;background:#ffffff;">
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:center;text-align:center;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;padding:14px 16px;border-bottom:3px solid #d2ad4b;">
          <div style="text-align:left;line-height:1.5;color:#155DAA;">
            République du Cameroun<br/>
            <span style="font-weight:600;font-style:italic;text-transform:none;color:#6b756d;">Paix — Travail — Patrie</span><br/>
            Ministère des Enseignements Secondaires
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
            <div style="width:48px;height:48px;border-radius:50%;background:#155DAA;border:3px solid #d2ad4b;display:flex;align-items:center;justify-content:center;margin-bottom:2px;color:#fff;font-size:12px;font-weight:900;">
              BCHS
            </div>
            <div style="font-size:17px;font-weight:900;color:#155DAA;text-transform:none;">BCHS DOUALA</div>
            <div style="font-size:8.5px;color:#6b756d;font-weight:600;text-transform:none;">Excellence · Discipline · Service</div>
          </div>
          <div style="text-align:right;line-height:1.5;color:#155DAA;">
            Republic of Cameroon<br/>
            <span style="font-weight:600;font-style:italic;text-transform:none;color:#6b756d;">Peace — Work — Fatherland</span><br/>
            Ministry of Secondary Education
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:14px 16px;padding:10px 14px;background:#EAF2FB;border-left:5px solid #155DAA;">
          <div style="font-size:17px;font-weight:800;color:#155DAA;text-transform:uppercase;">${ctx.title} Report</div>
          <div style="text-align:right;font-size:10px;font-weight:700;color:#52665a;">ACADEMIC YEAR<br/><span style="font-size:13px;color:#183328;">${escapeHtml(ctx.academicYear)}</span></div>
        </div>

        <div style="display:grid;grid-template-columns:116px 1fr;gap:14px;margin:0 16px 14px;padding:12px;border:1px solid #CADCF0;border-radius:8px;background:#fff;">
          <div style="width:116px;height:142px;overflow:hidden;border:2px solid #d2ad4b;border-radius:6px;background:#EAF2FB;">${portrait}</div>
          <div>
            <div style="font-size:18px;font-weight:800;color:#155DAA;margin-bottom:8px;">${escapeHtml(studentName)}</div>
            <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;font-size:10px;">
              <div><b style="color:#718076;">MATRICULE</b><br/><span style="font-weight:700;color:#183328;">${escapeHtml(matricule)}</span></div>
              <div><b style="color:#718076;">CLASS</b><br/><span style="font-weight:700;color:#183328;">${escapeHtml(ctx.selectedClass?.className || "")}</span></div>
              <div><b style="color:#718076;">DEPARTMENT</b><br/><span style="font-weight:700;color:#183328;">${escapeHtml(data.student.department || ctx.selectedClass?.department || "—")}</span></div>
              <div><b style="color:#718076;">GENDER</b><br/><span style="font-weight:700;color:#183328;">${data.student.gender === "male" ? "Male" : "Female"}</span></div>
              <div><b style="color:#718076;">DATE OF BIRTH</b><br/><span style="font-weight:700;color:#183328;">${escapeHtml(data.student.dob || "—")}</span></div>
              <div><b style="color:#718076;">POSITION</b><br/><span style="font-weight:700;color:#183328;">${data.rank ? `${ordinal(data.rank)} / ${ctx.classSize}` : "—"}</span></div>
              <div><b style="color:#718076;">PARENT / GUARDIAN</b><br/><span style="font-weight:700;color:#183328;">${escapeHtml(data.student.parentName || "—")}</span></div>
              <div><b style="color:#718076;">CONTACT</b><br/><span style="font-weight:700;color:#183328;">${escapeHtml(data.student.parentPhone || "—")}</span></div>
              <div><b style="color:#718076;">CLASS SIZE</b><br/><span style="font-weight:700;color:#183328;">${ctx.classSize} learners</span></div>
              <div style="grid-column:1 / -1;"><b style="color:#718076;">ADDRESS</b><br/><span style="font-weight:700;color:#183328;">${escapeHtml(data.student.address || "—")}</span></div>
            </div>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:10px;border:1px solid #121212;margin-bottom:16px;">
          <thead>
            <tr style="background:#155DAA;color:#fff;">
              <th style="padding:5px 6px;border:1px solid #d2ad4b;font-weight:700;text-align:center;font-size:10px;">Discipline / Subject</th>
              ${seqHeaders}
              <th style="padding:5px 6px;border:1px solid #000000;font-weight:700;text-align:center;font-size:10px;">Avg</th>
              <th style="padding:5px 6px;border:1px solid #000000;font-weight:700;text-align:center;font-size:10px;">Coef</th>
              <th style="padding:5px 6px;border:1px solid #000000;font-weight:700;text-align:center;font-size:10px;">Total</th>
          
              <th style="padding:5px 6px;border:1px solid #000000;font-weight:700;text-align:center;font-size:10px;">Grade</th>
              <th style="padding:5px 6px;border:1px solid #000000;font-weight:700;text-align:center;font-size:10px;">Remark</th>
              <th style="padding:5px 6px;border:1px solid #000000;font-weight:700;text-align:center;font-size:10px;">Teacher</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          <tfoot>
            <tr style="background:rgba(18,18,18,0.05);font-weight:700;">
              <td style="padding:5px 6px;border:1px solid #000000;text-align:left;font-size:10px;">TOTAL</td>
              ${totalSeqCells}
              <td style="padding:5px 6px;border:1px solid #000000;text-align:center;font-size:10px;">-</td>
              <td style="padding:5px 6px;border:1px solid #000000;text-align:center;font-size:10px;">${data.totalCoeff || 0}</td>
              <td style="padding:5px 6px;border:1px solid #000000;text-align:center;font-size:10px;">${data.totalWeighted > 0 ? data.totalWeighted.toFixed(2) : "-"}</td>
              <td colspan="6" style="padding:5px 6px;border:1px solid #000000;"></td>
            </tr>
          </tfoot>
        </table>

        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px;">
          <div style="border:1px solid #000000;border-radius:8px;padding:8px 10px;background:rgba(22,163,74,0.06);">
            <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#000000;">Average / 20</div>
            <div style="font-size:15px;font-weight:800;margin-top:2px;color:#000000;">${avg.toFixed(2)}</div>
          </div>
          <div style="border:1px solid #000000;border-radius:8px;padding:8px 10px;">
            <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#000000;">Class Average</div>
            <div style="font-size:15px;font-weight:800;margin-top:2px;color:#000000;">${ctx.classAvg.toFixed(2)}</div>
          </div>
          <div style="border:1px solid #000000;border-radius:8px;padding:8px 10px;">
            <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#000000;">Position</div>
            <div style="font-size:15px;font-weight:800;margin-top:2px;color:#000000;">${data.rank ? `${ordinal(data.rank)} / ${ctx.classSize}` : "—"}</div>
          </div>
          <div style="border:1px solid #000000;border-radius:8px;padding:8px 10px;">
            <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#000000;">Remark</div>
            <div style="font-size:15px;font-weight:800;margin-top:2px;color:#000000;">${gradeInfo.remark}</div>
          </div>
          <div style="border:1px solid #000000;border-radius:8px;padding:8px 10px;">
            <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#000000;">Decision</div>
            <div style="font-size:15px;font-weight:800;margin-top:2px;color:${statusPass ? '#020c05' : '#0c0101'};">${statusText}</div>
          </div>
        </div>

          <div style="margin-bottom:14px;padding:10px 12px;border:1px solid #CADCF0;border-radius:8px;background:#F4F8FD;">
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#155DAA;margin-bottom:7px;">Attendance · ${escapeHtml(ctx.title)}</div>
          <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;font-size:10px;">
            <div><b>Present</b><br/>${data.attendance?.present ?? 0} days</div>
            <div><b>Absent</b><br/>${data.attendance?.absent ?? 0} days</div>
            <div><b>Late</b><br/>${data.attendance?.late ?? 0} days</div>
            <div><b>Excused</b><br/>${data.attendance?.excused ?? 0} days</div>
            <div><b>Attendance rate</b><br/>${data.attendance?.attendanceRate ?? 0}%</div>
          </div>
          <div style="font-size:8px;color:#718076;margin-top:5px;">${data.attendance?.schoolDays ?? 0} recorded school days · ${data.attendance?.sessions ?? 0} attendance sessions</div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px;">
          <div style="border:1px solid #000000;border-radius:8px;padding:10px 12px;font-size:11px;">
            <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#000000;margin-bottom:4px;">Class Master's Remark</div>
            <p style="font-style:italic;color:#000000;margin:0;font-size:11px;font-weight:bold;">
              ${avg >= 16 ? "Excellent performance. A role model to others." :
        avg >= 14 ? "Very good performance. Keep pushing." :
          avg >= 12 ? "Good performance. Can do better." :
            avg >= 10 ? "Average performance. Needs more effort." :
              "Needs serious improvement. Must work harder."}
            </p>
          </div>
          <div style="border:1px solid #000000;border-radius:8px;padding:10px 12px;font-size:11px;">
            <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#000000;margin-bottom:4px;">Principal's Remark</div>
            <p style="font-style:italic;color:#000000;margin:0;font-size:11px;font-weight:bold;">
              ${avg >= 16 ? "Outstanding. A pride to the school." :
        avg >= 14 ? "Commendable effort. Continue to excel." :
          avg >= 12 ? "Satisfactory. Keep up the momentum." :
            avg >= 10 ? "Average. Room for improvement." :
              "Must take studies more seriously."}
            </p>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;text-align:center;font-size:11px;margin-bottom:18px;">
          <div><div style="height:34px;border-bottom:1px dashed #000000;"></div><div style="margin-top:4px;font-weight:600;color:#000000;">Class Master</div></div>
          <div><div style="height:34px;border-bottom:1px dashed #000000;"></div><div style="margin-top:4px;font-weight:600;color:#000000;">Principal</div></div>
          <div><div style="height:34px;border-bottom:1px dashed #000000;"></div><div style="margin-top:4px;font-weight:600;color:#000000;">Parent / Guardian</div></div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #000000;padding-top:8px;font-size:8.5px;color:#000000;">
          <div style="font-size:8.5px;color:#000000; font-weight:bold;">Issued by BCHS DOUALA · ${new Date().toLocaleDateString()}</div>
          <div style="font-family:monospace; color:#000000; font-weight:bold;">VERIF#${data.student.id.toUpperCase()}-${ctx.termId.toUpperCase()}</div>
        </div>
      </div>
    `;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Report Cards</h1>
        <p className="text-sm text-black/60 mt-1">Cameroon MINESEC-style report cards. Select term and generate reports.</p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search students..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-sm"
          />
        </div>

        <select
          value={selectedAcademicYear}
          onChange={(e) => {
            setSelectedAcademicYear(e.target.value);
            // Reset class selection when academic year changes
            setClassId("");
          }}
          className="px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-sm font-semibold"
        >
          <option value="">All Academic Years</option>
          {academicYears.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>

        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-sm font-semibold"
        >
          <option value="">Select Class</option>
          {loading && <option value="" disabled>Loading classes...</option>}
          {allowedClasses.map((c) => (
            <option key={c.id} value={c.id}>{c.className + " " + c.department}</option>
          ))}
        </select>

        <select
          value={selectedTerm}
          onChange={(e) => setSelectedTerm(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-sm font-semibold"
        >
          {TERMS.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>

        <button
          onClick={generateBulkPDF}
          disabled={generatingPDF || classDataLoading || reportData.length === 0}
          className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-50"
        >
          {generatingPDF ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="size-4" /> Download PDF ({reportData.length})
            </>
          )}
        </button>
      </div>

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>{loadError}</span>
          <button
            onClick={() => {
              void fetchData();
              setClassDataRetry((attempt) => attempt + 1);
            }}
            className="font-bold underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Students" value={stats.total.toString()} />
        <Stat label="Passed" value={stats.passed.toString()} tone="good" />
        <Stat label="Failed" value={stats.failed.toString()} tone="warn" />
        <Stat label="Class Avg" value={stats.avg.toFixed(2)} />
        <Stat label="Highest" value={stats.highest.toFixed(2)} />
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
          <h3 className="font-display font-bold">
            Students
            <span className="text-sm font-normal text-black/40 ml-2">
              ({reportData.length} students)
            </span>
          </h3>
          <div className="flex items-center gap-2 text-xs text-black/60">
            <Award className="size-4 text-brand" />
            <span>Pass: ≥10/20</span>
          </div>
        </div>

        {classDataLoading && (
          <div className="flex items-center gap-3 border-b border-stone-100 bg-[#EAF2FB] px-5 py-3 text-sm text-[#155DAA]" role="status">
            <div className="size-4 animate-spin rounded-full border-2 border-[#155DAA] border-t-transparent" />
            Loading this class’s students and marks…
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-[10px] uppercase tracking-widest text-black/50 font-bold">
              <tr>
                <th className="px-5 py-3">Rank</th>
                <th className="px-5 py-3">Student</th>
                <th className="px-5 py-3">Average</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {reportData.map((data) => (
                <tr key={data.student.id} className="hover:bg-stone-50">
                  <td className="px-5 py-3 font-display font-extrabold">{ordinal(data.rank)}</td>
                  <td className="px-5 py-3 font-semibold">{data.student.fullName}</td>
                  <td className="px-5 py-3 font-display font-bold text-brand">
                    {data.overallAverage.toFixed(2)}
                  </td>
                  <td className="px-5 py-3">
                    {data.overallAverage >= 10 ? (
                      <span className="text-xs px-2 py-1 rounded-full bg-brand/10 text-brand font-bold">Pass</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-bold">Fail</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => generatePDF(data)}
                      disabled={generatingPDF}
                      className="inline-flex items-center gap-2 text-xs font-bold text-brand hover:underline disabled:opacity-50"
                    >
                      {generatingPDF ? (
                        <div className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <FileText className="size-3.5" />
                      )}
                      View / Download
                    </button>
                  </td>
                </tr>
              ))}
              {reportData.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-black/40">
                    {classDataLoading ? "Preparing this class’s reports…" : classId ? "No students found for this class." : "Please select a class."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 6mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" }) {
  const color =
    tone === "good"
      ? "text-brand"
      : tone === "warn"
        ? "text-red-600"
        : "text-[#121212]";
  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-3 sm:p-4">
      <div className="text-[8px] sm:text-[10px] uppercase tracking-widest font-bold text-black/40">
        {label}
      </div>
      <div className={`font-display text-base sm:text-xl font-extrabold mt-0.5 sm:mt-1 ${color}`}>
        {value}
      </div>
    </div>
  );
}