import { useMemo, useState, useEffect } from "react";
import { GraduationCap, RotateCcw, Download, Filter, Users, User, Award, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import html2canvas from "html2canvas-pro";

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
  admissionNumber?: string;
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

// Term definitions
const TERMS = [
  { id: "first", label: "First Term", sequences: ["1st seq", "2nd seq"] },
  { id: "second", label: "Second Term", sequences: ["3rd seq", "4th seq"] },
  { id: "third", label: "Third Term", sequences: ["5th seq", "6th seq"] },
  { id: "annual", label: "Annual", sequences: ["1st seq", "2nd seq", "3rd seq", "4th seq", "5th seq", "6th seq"] },
];

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

export function PromotionPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Filter states
  const [classId, setClassId] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>("annual");
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [studentsRes, subjectsRes, classesRes, marksRes, usersRes] = await Promise.all([
        axios.get(`${API_BASE}/students`),
        axios.get(`${API_BASE}/subjects`),
        axios.get(`${API_BASE}/classes`),
        axios.get(`${API_BASE}/marks`),
        axios.get(`${API_BASE}/users`),
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
        if (mappedClasses.length > 0 && !classId) {
          setClassId(mappedClasses[0].id);
        }
        if (mappedClasses.length > 0 && !selectedAcademicYear) {
          setSelectedAcademicYear(mappedClasses[0].acedemicYear || "");
        }
      }

      if (marksRes.data.success) {
        const mappedMarks = marksRes.data.data.map((m: any) => ({
          ...m,
          id: m._id || m.id
        }));
        setMarks(mappedMarks);
      }

      if (usersRes.data.success) {
        const mappedTeachers = usersRes.data.data.map((t: any) => ({
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
      toast.error(error.response?.data?.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Get unique academic years
  const academicYears = useMemo(() => {
    const years = new Set<string>();
    classes.forEach(c => {
      if (c.acedemicYear) {
        years.add(c.acedemicYear);
      }
    });
    return Array.from(years).sort();
  }, [classes]);

  // Filter classes by academic year
  const filteredClasses = useMemo(() => {
    if (!selectedAcademicYear) return classes;
    return classes.filter(c => c.acedemicYear === selectedAcademicYear);
  }, [classes, selectedAcademicYear]);

  const selectedClass = useMemo(() => {
    return classes.find(c => c.id === classId);
  }, [classes, classId]);

  const classSubjects = useMemo(() => {
    return subjects.filter(s => s.classIds.includes(classId));
  }, [subjects, classId]);

  const classStudents = useMemo(() => {
    return students.filter(s => s.classId === classId);
  }, [students, classId]);

  const termInfo = useMemo(() => {
    return TERMS.find(t => t.id === selectedTerm) || TERMS[0];
  }, [selectedTerm]);

  const currentSequences = useMemo(() => {
    return termInfo?.sequences || [];
  }, [termInfo]);

  // Get class master name
  const classMasterName = useMemo(() => {
    if (!selectedClass) return "Not Assigned";
    const master = teachers.find(t => t.id === selectedClass.classMasterId);
    return master?.name || selectedClass.classMasterId || "Not Assigned";
  }, [selectedClass, teachers]);

  // Calculate student statistics
  const studentStats = useMemo(() => {
    const sequences = currentSequences;

    return classStudents.map(student => {
      let totalWeighted = 0;
      let totalCoeff = 0;
      const subjectScores: any[] = [];

      for (const subject of classSubjects) {
        const subjectMarks = marks.filter(
          m => m.studentId === student.id &&
            m.subjectId === subject.id &&
            sequences.includes(m.sequence)
        );

        const scores = subjectMarks.map(m => m.score);
        const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

        subjectScores.push({
          subjectId: subject.id,
          name: subject.name,
          coefficient: subject.coefficient,
          average: avg,
          weightedTotal: avg * subject.coefficient,
        });

        if (avg > 0) {
          totalWeighted += avg * subject.coefficient;
          totalCoeff += subject.coefficient;
        }
      }

      const overallAverage = totalCoeff > 0 ? totalWeighted / totalCoeff : 0;
      const gradeInfo = gradeFor(overallAverage);

      return {
        student,
        subjectScores,
        overallAverage,
        totalWeighted,
        totalCoeff,
        grade: gradeInfo.grade,
        remark: gradeInfo.remark,
        status: overallAverage >= 10 ? "Promoted" : "Repeat",
      };
    });
  }, [classStudents, classSubjects, marks, currentSequences]);

  // Calculate class statistics
  const classStats = useMemo(() => {
    const avgs = studentStats.map(s => s.overallAverage);
    const passed = studentStats.filter(s => s.overallAverage >= 10).length;
    const failed = studentStats.filter(s => s.overallAverage < 10).length;
    const total = studentStats.length;
    const avg = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : 0;
    const highest = avgs.length > 0 ? Math.max(...avgs) : 0;
    const lowest = avgs.length > 0 ? Math.min(...avgs) : 0;

    // Gender distribution
    const males = studentStats.filter(s => s.student.gender === "male").length;
    const females = studentStats.filter(s => s.student.gender === "female").length;

    // Rank students
    const ranked = studentStats.map(s => ({ ...s, rank: 0 }));
    const sorted = [...ranked].sort((a, b) => b.overallAverage - a.overallAverage);
    sorted.forEach((s, i) => { s.rank = i + 1; });

    // Top 3 and bottom 3
    const top3 = sorted.slice(0, 3);
    const bottom3 = sorted.slice(-3).reverse();

    return {
      total,
      passed,
      failed,
      avg,
      highest,
      lowest,
      males,
      females,
      passRate: total > 0 ? (passed / total) * 100 : 0,
      top3,
      bottom3,
      ranked: sorted,
    };
  }, [studentStats]);

  // Export to PDF using html2canvas
  const exportPDF = async () => {
    if (studentStats.length === 0) {
      toast.error("No data to export");
      return;
    }

    setGeneratingPDF(true);
    try {
      // Create a container for the PDF content
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '800px';
      container.style.backgroundColor = 'white';
      container.style.padding = '40px';
      container.style.zIndex = '9999';
      document.body.appendChild(container);

      // Build HTML content for the report
      let htmlContent = `
        <div style="font-family: Arial, sans-serif; color: #121212;">
          <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
            <h1 style="font-size: 20px; margin: 0;">MANFESS Evening School</h1>
            <p style="font-size: 12px; color: #666; margin: 5px 0;">Class Statistics Report</p>
          </div>
          
          <div style="text-align: center; margin-bottom: 15px;">
            <h2 style="font-size: 16px; margin: 0;">${selectedClass?.className || ""}</h2>
            <p style="font-size: 11px; color: #666; margin: 3px 0;">Academic Year: ${selectedClass?.acedemicYear || "N/A"} | Term: ${termInfo?.label || "Annual"}</p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px; font-size: 12px;">
            <div style="border: 1px solid #ddd; padding: 8px; border-radius: 4px; text-align: center;">
              <strong>Total Students</strong><br/>${classStats.total}
            </div>
            <div style="border: 1px solid #ddd; padding: 8px; border-radius: 4px; text-align: center;">
              <strong>Male</strong><br/>${classStats.males}
            </div>
            <div style="border: 1px solid #ddd; padding: 8px; border-radius: 4px; text-align: center;">
              <strong>Female</strong><br/>${classStats.females}
            </div>
            <div style="border: 1px solid #ddd; padding: 8px; border-radius: 4px; text-align: center; border-color: #0F7A35; background: #f0f9f0;">
              <strong>Passed</strong><br/>${classStats.passed} (${classStats.passRate.toFixed(1)}%)
            </div>
            <div style="border: 1px solid #ddd; padding: 8px; border-radius: 4px; text-align: center; border-color: #dc2626; background: #fef2f2;">
              <strong>Failed</strong><br/>${classStats.failed} (${(100 - classStats.passRate).toFixed(1)}%)
            </div>
            <div style="border: 1px solid #ddd; padding: 8px; border-radius: 4px; text-align: center;">
              <strong>Class Average</strong><br/>${classStats.avg.toFixed(2)}/20
            </div>
          </div>

          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 14px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Top 3 Students</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <thead style="background: #121212; color: white;">
                <tr>
                  <th style="padding: 6px; text-align: left; border: 1px solid #121212;">#</th>
                  <th style="padding: 6px; text-align: left; border: 1px solid #121212;">Name</th>
                  <th style="padding: 6px; text-align: center; border: 1px solid #121212;">Average</th>
                  <th style="padding: 6px; text-align: center; border: 1px solid #121212;">Grade</th>
                  <th style="padding: 6px; text-align: center; border: 1px solid #121212;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${classStats.top3.map((s, i) => `
                  <tr style="${i % 2 === 0 ? 'background: #fafaf9;' : ''}">
                    <td style="padding: 6px; border: 1px solid #ddd;">${i + 1}</td>
                    <td style="padding: 6px; border: 1px solid #ddd; font-weight: 600;">${s.student.fullName}</td>
                    <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${s.overallAverage.toFixed(2)}</td>
                    <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${s.grade}</td>
                    <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${s.status}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 14px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Bottom 3 Students</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <thead style="background: #121212; color: white;">
                <tr>
                  <th style="padding: 6px; text-align: left; border: 1px solid #121212;">#</th>
                  <th style="padding: 6px; text-align: left; border: 1px solid #121212;">Name</th>
                  <th style="padding: 6px; text-align: center; border: 1px solid #121212;">Average</th>
                  <th style="padding: 6px; text-align: center; border: 1px solid #121212;">Grade</th>
                  <th style="padding: 6px; text-align: center; border: 1px solid #121212;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${classStats.bottom3.map((s, i) => `
                  <tr style="${i % 2 === 0 ? 'background: #fafaf9;' : ''}">
                    <td style="padding: 6px; border: 1px solid #ddd;">${i + 1}</td>
                    <td style="padding: 6px; border: 1px solid #ddd; font-weight: 600;">${s.student.fullName}</td>
                    <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${s.overallAverage.toFixed(2)}</td>
                    <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${s.grade}</td>
                    <td style="padding: 6px; border: 1px solid #ddd; text-align: center;">${s.status}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 14px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">All Students Performance</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
              <thead style="background: #121212; color: white;">
                <tr>
                  <th style="padding: 5px; text-align: left; border: 1px solid #121212;">Rank</th>
                  <th style="padding: 5px; text-align: left; border: 1px solid #121212;">Name</th>
                  <th style="padding: 5px; text-align: center; border: 1px solid #121212;">Gender</th>
                  <th style="padding: 5px; text-align: center; border: 1px solid #121212;">Average</th>
                  <th style="padding: 5px; text-align: center; border: 1px solid #121212;">Grade</th>
                  <th style="padding: 5px; text-align: center; border: 1px solid #121212;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${classStats.ranked.map((s, i) => `
                  <tr style="${i % 2 === 0 ? 'background: #fafaf9;' : ''}">
                    <td style="padding: 5px; border: 1px solid #ddd;">${ordinal(s.rank)}</td>
                    <td style="padding: 5px; border: 1px solid #ddd; font-weight: 600;">${s.student.fullName}</td>
                    <td style="padding: 5px; border: 1px solid #ddd; text-align: center;">${s.student.gender === "male" ? "M" : "F"}</td>
                    <td style="padding: 5px; border: 1px solid #ddd; text-align: center;">${s.overallAverage.toFixed(2)}</td>
                    <td style="padding: 5px; border: 1px solid #ddd; text-align: center;">${s.grade}</td>
                    <td style="padding: 5px; border: 1px solid #ddd; text-align: center;">${s.status}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd;">
            <div style="font-size: 11px; margin-bottom: 10px;">
              <strong>Class Master's Report</strong><br/>
              <span>Name: ${classMasterName}</span><br/>
              <span>Signature: ______________________________</span><br/>
              <span>Date: ______________________________</span>
            </div>
            <div style="font-size: 11px; margin-bottom: 10px;">
              <strong>Principal's Report</strong><br/>
              <span>Name: ______________________________</span><br/>
              <span>Signature: ______________________________</span><br/>
              <span>Date: ______________________________</span>
            </div>
            <div style="font-size: 9px; color: #666; text-align: center; margin-top: 10px; padding-top: 8px; border-top: 1px solid #ddd;">
              Generated: ${new Date().toLocaleString()} | © 2026 MANFESS Evening School
            </div>
          </div>
        </div>
      `;

      container.innerHTML = htmlContent;

      // Wait for rendering
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture the container
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: 800,
        height: container.scrollHeight,
      });

      // Create PDF using jsPDF
      const { default: jsPDF } = await import('jspdf');
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

      // Clean up
      document.body.removeChild(container);

      pdf.save(`class_stats_${selectedClass?.className}_${selectedTerm}.pdf`);
      toast.success("PDF downloaded successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setGeneratingPDF(false);
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <GraduationCap className="size-7 text-brand" /> Class Statistics
          </h1>
          <p className="text-sm text-black/60 mt-1">View detailed statistics for each class, term, and academic year.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportPDF}
            disabled={generatingPDF || studentStats.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-50"
          >
            {generatingPDF ? (
              <RotateCcw className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {generatingPDF ? "Generating..." : "Export PDF"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-black/40" />
          <span className="text-xs font-bold uppercase tracking-wider text-black/40">Filters:</span>
        </div>

        <select
          value={selectedAcademicYear}
          onChange={(e) => {
            setSelectedAcademicYear(e.target.value);
            setClassId("");
          }}
          className="px-3 py-2 rounded-xl border border-stone-200 bg-white text-sm font-medium"
        >
          <option value="">All Academic Years</option>
          {academicYears.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>

        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="px-3 py-2 rounded-xl border border-stone-200 bg-white text-sm font-medium"
        >
          <option value="">Select Class</option>
          {filteredClasses.map((c) => (
            <option key={c.id} value={c.id}>{c.className}</option>
          ))}
        </select>

        <select
          value={selectedTerm}
          onChange={(e) => setSelectedTerm(e.target.value)}
          className="px-3 py-2 rounded-xl border border-stone-200 bg-white text-sm font-medium"
        >
          {TERMS.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>

      {classId ? (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatCard label="Total Students" value={classStats.total} icon={<Users className="size-4" />} />
            <StatCard label="Male" value={classStats.males} icon={<User className="size-4" />} tone="info" />
            <StatCard label="Female" value={classStats.females} icon={<User className="size-4" />} tone="info" />
            <StatCard label="Passed" value={classStats.passed} icon={<Award className="size-4" />} tone="good" />
            <StatCard label="Failed" value={classStats.failed} icon={<AlertCircle className="size-4" />} tone="bad" />
            <StatCard label="Pass Rate" value={`${classStats.passRate.toFixed(1)}%`} icon={<GraduationCap className="size-4" />} tone="good" />
          </div>

          {/* Top and Bottom Students */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-stone-200 p-5">
              <h3 className="font-display font-bold mb-3 flex items-center gap-2">
                <Award className="size-4 text-brand" /> Top 3 Students
              </h3>
              <div className="space-y-3">
                {classStats.top3.map((s, i) => (
                  <div key={s.student.id} className="flex items-center justify-between p-3 bg-brand/5 rounded-xl border border-brand/20">
                    <div className="flex items-center gap-3">
                      <div className={`size-8 rounded-full grid place-items-center font-bold text-sm ${i === 0 ? "bg-yellow-400 text-black" :
                          i === 1 ? "bg-gray-300 text-black" :
                            "bg-amber-600 text-white"
                        }`}>
                        {i + 1}
                      </div>
                      <div>
                        <div className="font-semibold">{s.student.fullName}</div>
                        <div className="text-xs text-black/50">{s.student.department}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-brand">{s.overallAverage.toFixed(2)}</div>
                      <div className="text-xs text-black/50">Grade: {s.grade}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 p-5">
              <h3 className="font-display font-bold mb-3 flex items-center gap-2">
                <AlertCircle className="size-4 text-red-500" /> Bottom 3 Students
              </h3>
              <div className="space-y-3">
                {classStats.bottom3.map((s, i) => (
                  <div key={s.student.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-200">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full bg-red-100 text-red-600 grid place-items-center font-bold text-sm">
                        {i + 1}
                      </div>
                      <div>
                        <div className="font-semibold">{s.student.fullName}</div>
                        <div className="text-xs text-black/50">{s.student.department}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-red-600">{s.overallAverage.toFixed(2)}</div>
                      <div className="text-xs text-black/50">Grade: {s.grade}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Class Average Chart */}
          <div className="bg-white rounded-2xl border border-stone-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold">Class Performance Overview</h3>
              <div className="text-sm text-black/50">
                Class Average: <span className="font-bold text-brand">{classStats.avg.toFixed(2)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium w-20">Passed:</span>
                <div className="flex-1 h-4 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand rounded-full" style={{ width: `${classStats.passRate}%` }} />
                </div>
                <span className="text-sm font-bold">{classStats.passRate.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium w-20">Failed:</span>
                <div className="flex-1 h-4 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${100 - classStats.passRate}%` }} />
                </div>
                <span className="text-sm font-bold">{(100 - classStats.passRate).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* All Students Table */}
          <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="font-display font-bold">All Students Performance</h3>
              <span className="text-sm text-black/40">{classStats.total} students</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 text-left text-[10px] uppercase tracking-widest text-black/50 font-bold">
                  <tr>
                    <th className="px-5 py-3">Rank</th>
                    <th className="px-5 py-3">Student</th>
                    <th className="px-5 py-3">Gender</th>
                    <th className="px-5 py-3">Average</th>
                    <th className="px-5 py-3">Grade</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {classStats.ranked.map((s) => (
                    <tr key={s.student.id} className="hover:bg-stone-50">
                      <td className="px-5 py-3 font-display font-extrabold">{ordinal(s.rank)}</td>
                      <td className="px-5 py-3 font-semibold">{s.student.fullName}</td>
                      <td className="px-5 py-3">{s.student.gender === "male" ? "M" : "F"}</td>
                      <td className="px-5 py-3 font-display font-bold text-brand">{s.overallAverage.toFixed(2)}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-bold ${s.grade === "A" || s.grade === "B" ? "bg-green-100 text-green-700" :
                            s.grade === "C" || s.grade === "D" ? "bg-yellow-100 text-yellow-700" :
                              "bg-red-100 text-red-700"
                          }`}>
                          {s.grade}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {s.overallAverage >= 10 ? (
                          <span className="text-xs px-2 py-1 rounded-full bg-brand/10 text-brand font-bold">Promoted</span>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-bold">Repeat</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center">
          <GraduationCap className="size-12 text-black/20 mx-auto mb-4" />
          <h3 className="font-display font-bold text-xl">Select a Class</h3>
          <p className="text-sm text-black/40 mt-2">Choose a class from the filters above to view statistics.</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, tone }: { label: string; value: string | number; icon: React.ReactNode; tone?: "good" | "bad" | "info" }) {
  const colors = {
    good: "text-brand bg-brand/10",
    bad: "text-red-600 bg-red-50",
    info: "text-blue-600 bg-blue-50",
  };
  const color = tone ? colors[tone] : "text-black/60 bg-stone-50";

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-xl ${color}`}>
          {icon}
        </div>
      </div>
      <div className="font-display text-2xl font-extrabold">{value}</div>
      <div className="text-[10px] text-black/40 uppercase tracking-widest">{label}</div>
    </div>
  );
}