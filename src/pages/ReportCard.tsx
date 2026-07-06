// import { useMemo, useState } from "react";
// import { Link, useParams, useSearchParams } from "react-router-dom";
// import { getStore } from "@/lib/mock-data";
// import { gradeFor, rankWithTies, ordinal, promotionStatus } from "@/lib/grading";
// import type { Sequence } from "@/lib/types";
// import { Printer, ArrowLeft, GraduationCap, Download } from "lucide-react";
// import { toast } from "sonner";
// import { exportElementToPdf } from "@/lib/pdf-export";

// type SeqFilter = Sequence | "all";

// export function ReportCard() {
//   const { studentId = "" } = useParams();
//   const [sp, setSp] = useSearchParams();
//   const initialSeq = sp.get("seq");
//   const [seq, setSeq] = useState<SeqFilter>(initialSeq ? (Number(initialSeq) as Sequence) : "all");
//   const [downloading, setDownloading] = useState(false);

//   const changeSeq = (v: SeqFilter) => {
//     setSeq(v);
//     if (v === "all") sp.delete("seq"); else sp.set("seq", String(v));
//     setSp(sp, { replace: true });
//   };

//   const data = useMemo(() => buildReportCardData(studentId, seq), [studentId, seq]);

//   const downloadPdf = async () => {
//     const el = document.getElementById("report-card");
//     if (!el) return;
//     setDownloading(true);
//     try {
//       await exportElementToPdf(el, `report-card-${data?.student.fullName.replace(/\s+/g, "_")}-${seq === "all" ? "annual" : `seq${seq}`}.pdf`);
//       toast.success("PDF downloaded");
//     } catch (e) { console.error(e); toast.error("PDF export failed"); }
//     finally { setDownloading(false); }
//   };

//   if (!data) {
//     return <div className="p-8">Student not found. <Link to="/app/report-cards" className="text-brand underline">Back</Link></div>;
//   }

//   const seqLabel = seq === "all" ? "Annual Report" : `Sequence ${seq} Report`;

//   return (
//     <div className="space-y-6">
//       <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
//         <Link to="/app/report-cards" className="flex items-center gap-2 text-sm font-semibold text-black/60 hover:text-black"><ArrowLeft className="size-4" /> All report cards</Link>
//         <div className="flex items-center gap-2">
//           <select value={seq === "all" ? "all" : String(seq)} onChange={(e) => changeSeq(e.target.value === "all" ? "all" : Number(e.target.value) as Sequence)} className="px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-sm font-semibold">
//             <option value="all">Annual</option>
//             <option value="1">Sequence 1</option><option value="2">Sequence 2</option><option value="3">Sequence 3</option>
//             <option value="4">Sequence 4</option><option value="5">Sequence 5</option><option value="6">Sequence 6</option>
//           </select>
//           <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm font-semibold hover:bg-stone-50"><Printer className="size-4" /> Print</button>
//           <button onClick={downloadPdf} disabled={downloading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-50"><Download className="size-4" /> {downloading ? "Generating…" : "Download PDF"}</button>
//         </div>
//       </div>

//       <div id="report-card">
//         <ReportCardCard data={data} seq={seq} seqLabel={seqLabel} />
//       </div>

//       <style>{`@media print { @page { size: A4; margin: 8mm; } body { background: white !important; } aside, header { display: none !important; } main > div { padding: 0 !important; } #report-card { border: none !important; } }`}</style>
//     </div>
//   );
// }

// export function ReportCardCard({ data, seq, seqLabel }: { data: NonNullable<ReturnType<typeof buildReportCardData>>; seq: SeqFilter; seqLabel: string }) {
//   const { student, cls, rows, avg, totalPoints, totalCoef, position, classSize, classGeneralAvg } = data;
//   const status = promotionStatus(avg);
//   return (
//     <div className="bg-white border border-stone-200 rounded-2xl max-w-4xl mx-auto print:border-0 print:shadow-none print:rounded-none report-card-page">
//         <div className="p-8 print:p-6">
//           {/* Cameroon official header */}
//           <div className="grid grid-cols-3 gap-4 text-center text-[10px] font-bold uppercase tracking-wider pb-4 border-b-2 border-[#121212]">
//             <div>
//               République du Cameroun<br/>
//               <span className="font-normal italic">Paix — Travail — Patrie</span><br/>
//               Ministère des Enseignements Secondaires
//             </div>
//             <div className="flex flex-col items-center justify-center">
//               <div className="size-12 bg-brand rounded-xl grid place-items-center mb-1"><GraduationCap className="size-6 text-white" /></div>
//               <div className="font-display text-base font-extrabold tracking-tight">MANFESS EVENING SCHOOL</div>
//               <div className="text-[9px] text-black/60 font-normal">P.O. Box 1234, Yaoundé · MINESEC accredited</div>
//             </div>
//             <div>
//               Republic of Cameroon<br/>
//               <span className="font-normal italic">Peace — Work — Fatherland</span><br/>
//               Ministry of Secondary Education
//             </div>
//           </div>

//           <div className="text-center my-4">
//             <div className="inline-block px-6 py-1.5 bg-[#121212] text-white text-xs font-bold uppercase tracking-widest rounded-full">
//               {seqLabel} · Academic Year 2024 / 2025
//             </div>
//           </div>

//           {/* Student info */}
//           <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
//             <Info label="Student" value={student.fullName} />
//             <Info label="Admission №" value={student.admissionNumber} />
//             <Info label="Class" value={cls.name} />
//             <Info label="Section" value={student.department} />
//             <Info label="Sex" value={student.gender === "M" ? "Male" : "Female"} />
//             <Info label="Date of Birth" value={student.dob} />
//             <Info label="Class Size" value={String(classSize)} />
//             <Info label="Position" value={position ? `${ordinal(position)} / ${classSize}` : "—"} />
//           </div>

//           {/* Marks table — Cameroon format */}
//           <table className="w-full text-[11px] mt-4 border border-[#121212]">
//             <thead className="bg-[#121212] text-white">
//               <tr>
//                 <th className="px-2 py-1.5 text-left border border-[#121212]">Discipline / Subject</th>
//                 <th className="px-2 py-1.5 border border-[#121212]">Note /20</th>
//                 <th className="px-2 py-1.5 border border-[#121212]">Coef</th>
//                 <th className="px-2 py-1.5 border border-[#121212]">Total</th>
//                 <th className="px-2 py-1.5 border border-[#121212]">Moy. Cl.</th>
//                 <th className="px-2 py-1.5 border border-[#121212]">Min</th>
//                 <th className="px-2 py-1.5 border border-[#121212]">Max</th>
//                 <th className="px-2 py-1.5 border border-[#121212]">Grade</th>
//                 <th className="px-2 py-1.5 text-left border border-[#121212]">Appréciation</th>
//                 <th className="px-2 py-1.5 text-left border border-[#121212]">Enseignant</th>
//               </tr>
//             </thead>
//             <tbody>
//               {rows.map((r) => (
//                 <tr key={r.sub.id} className="even:bg-stone-50">
//                   <td className="px-2 py-1.5 font-semibold border border-stone-300">{r.sub.name}</td>
//                   <td className="px-2 py-1.5 text-center font-display font-bold border border-stone-300">{r.subjAvg.toFixed(2)}</td>
//                   <td className="px-2 py-1.5 text-center border border-stone-300">{r.sub.coefficient}</td>
//                   <td className="px-2 py-1.5 text-center font-bold border border-stone-300">{r.total.toFixed(2)}</td>
//                   <td className="px-2 py-1.5 text-center text-black/70 border border-stone-300">{r.classAvg.toFixed(2)}</td>
//                   <td className="px-2 py-1.5 text-center text-black/70 border border-stone-300">{r.min.toFixed(1)}</td>
//                   <td className="px-2 py-1.5 text-center text-black/70 border border-stone-300">{r.max.toFixed(1)}</td>
//                   <td className="px-2 py-1.5 text-center font-bold text-brand border border-stone-300">{r.grade}</td>
//                   <td className="px-2 py-1.5 text-black/70 border border-stone-300">{r.remark}</td>
//                   <td className="px-2 py-1.5 text-[10px] text-black/60 border border-stone-300">{r.teacher}</td>
//                 </tr>
//               ))}
//             </tbody>
//             <tfoot className="bg-[#121212]/5 font-bold">
//               <tr>
//                 <td className="px-2 py-1.5 border border-[#121212]">TOTAL</td>
//                 <td className="px-2 py-1.5 text-center border border-[#121212]">—</td>
//                 <td className="px-2 py-1.5 text-center border border-[#121212]">{totalCoef}</td>
//                 <td className="px-2 py-1.5 text-center border border-[#121212]">{totalPoints.toFixed(2)}</td>
//                 <td colSpan={6} className="border border-[#121212]" />
//               </tr>
//             </tfoot>
//           </table>

//           {/* Summary */}
//           <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 text-xs">
//             <Summary label="Moyenne / 20" value={avg.toFixed(2)} highlight />
//             <Summary label="Moy. Classe" value={classGeneralAvg.toFixed(2)} />
//             <Summary label="Rang" value={position ? `${ordinal(position)} / ${classSize}` : "—"} />
//             <Summary label="Mention" value={gradeFor(avg).remark} />
//             <Summary label="Décision" value={status === "Promoted" ? "Admis(e)" : "Redouble"} tone={status === "Promoted" ? "good" : "bad"} />
//           </div>

//           {/* Conduct */}
//           <div className="grid sm:grid-cols-4 gap-2 mt-3 text-xs">
//             <Info label="Conduite" value="Bonne" />
//             <Info label="Discipline" value="Satisfaisante" />
//             <Info label="Absences (h)" value="0" />
//             <Info label="Retards" value="0" />
//           </div>

//           {/* Remarks */}
//           <div className="grid sm:grid-cols-2 gap-3 mt-4 text-xs">
//             <div className="border border-stone-300 rounded-lg p-3">
//               <div className="text-[10px] uppercase tracking-widest font-bold text-black/50 mb-1">Class Master's Remark</div>
//               <p className="text-black/70 italic">{gradeFor(avg).remark} performance. {avg >= 14 ? "Keep it up." : avg >= 10 ? "Effort can be improved." : "Serious attention required."}</p>
//             </div>
//             <div className="border border-stone-300 rounded-lg p-3">
//               <div className="text-[10px] uppercase tracking-widest font-bold text-black/50 mb-1">Principal's Remark</div>
//               <p className="text-black/70 italic">{avg >= 16 ? "Outstanding. A pride to the school." : avg >= 12 ? "Satisfactory. Continue working hard." : "Must take studies more seriously."}</p>
//             </div>
//           </div>

//           <div className="grid grid-cols-3 gap-6 mt-8 text-center text-xs">
//             {["Class Master", "Principal", "Parent / Guardian"].map((r) => (
//               <div key={r}>
//                 <div className="h-10 border-b border-dashed border-stone-400" />
//                 <div className="mt-1 font-semibold text-black/70">{r}</div>
//               </div>
//             ))}
//           </div>

//           <div className="mt-6 pt-3 border-t border-stone-300 flex items-center justify-between text-[10px] text-black/40">
//             <div>Issued by MAMS · MANFESS Evening School · {new Date().toLocaleDateString()}</div>
//             <div className="font-mono">VERIF#{student.id.toUpperCase()}-{seq === "all" ? "ANN" : `S${seq}`}</div>
//           </div>
//         </div>
//     </div>
//   );
// }

// export function buildReportCardData(studentId: string, seq: SeqFilter) {
//   const s = getStore();
//   const student = s.students.find((x) => x.id === studentId);
//   if (!student) return null;
//   const cls = s.classes.find((c) => c.id === student.classId)!;
//   const subjects = s.subjects.filter((sub) => sub.classIds.includes(cls.id));

//   const filterMarks = (subId: string, studId: string) =>
//     s.marks.filter((m) => m.studentId === studId && m.subjectId === subId && (seq === "all" || m.sequence === seq));

//   // teacher name comes from the most recent recordedBy on this subject; falls back to assigned teacher
//   const teacherForSubject = (subId: string): string => {
//     const subMarks = s.marks
//       .filter((m) => m.subjectId === subId && m.recordedBy)
//       .sort((a, b) => (b.recordedAt ?? "").localeCompare(a.recordedAt ?? ""));
//     if (subMarks[0]?.recordedBy) return subMarks[0].recordedBy;
//     const sub = s.subjects.find((x) => x.id === subId);
//     const tId = sub?.teacherIds?.[0];
//     const t = (tId && s.teachers.find((tt) => tt.id === tId)) || s.teachers.find((tt) => tt.subjectIds.includes(subId));
//     return t?.fullName ?? "—";
//   };

//   const rows = subjects.map((sub) => {
//     const ms = filterMarks(sub.id, student.id);
//     const subjAvg = ms.length ? ms.reduce((a, b) => a + b.score, 0) / ms.length : 0;
//     const classStudents = s.students.filter((st) => st.classId === cls.id);
//     const classMarksForSub = s.marks.filter((m) => m.subjectId === sub.id && classStudents.some((cs) => cs.id === m.studentId) && (seq === "all" || m.sequence === seq));
//     const classAvg = classMarksForSub.length ? classMarksForSub.reduce((a, b) => a + b.score, 0) / classMarksForSub.length : 0;
//     const max = classMarksForSub.length ? Math.max(...classMarksForSub.map((m) => m.score)) : 0;
//     const min = classMarksForSub.length ? Math.min(...classMarksForSub.map((m) => m.score)) : 0;
//     const { grade, remark } = gradeFor(subjAvg);
//     return { sub, subjAvg, classAvg, max, min, total: subjAvg * sub.coefficient, grade, remark, teacher: teacherForSubject(sub.id) };
//   });

//   const totalPoints = rows.reduce((a, b) => a + b.total, 0);
//   const totalCoef = rows.reduce((a, b) => a + b.sub.coefficient, 0);
//   const avg = totalCoef ? totalPoints / totalCoef : 0;

//   const classStudents = s.students.filter((st) => st.classId === cls.id);
//   const classAvgs = classStudents.map((st) => {
//     let sum = 0, cw = 0;
//     for (const sub of subjects) {
//       const ms = filterMarks(sub.id, st.id);
//       const a = ms.length ? ms.reduce((x, y) => x + y.score, 0) / ms.length : 0;
//       if (a) { sum += a * sub.coefficient; cw += sub.coefficient; }
//     }
//     return { id: st.id, avg: cw ? sum / cw : 0 };
//   });
//   const ranks = rankWithTies(classAvgs);
//   const position = ranks[student.id];
//   const classGeneralAvg = classAvgs.length ? classAvgs.reduce((a, b) => a + b.avg, 0) / classAvgs.length : 0;

//   return { student, cls, rows, avg, totalPoints, totalCoef, position, classSize: classStudents.length, classGeneralAvg };
// }

// function Info({ label, value }: { label: string; value: string }) {
//   return (
//     <div className="border border-stone-300 rounded-md px-2 py-1">
//       <div className="text-[9px] uppercase tracking-widest font-bold text-black/50">{label}</div>
//       <div className="text-xs font-semibold mt-0.5 truncate">{value}</div>
//     </div>
//   );
// }
// function Summary({ label, value, highlight, tone }: { label: string; value: string; highlight?: boolean; tone?: "good" | "bad" }) {
//   const color = tone === "good" ? "text-brand" : tone === "bad" ? "text-red-600" : highlight ? "text-brand" : "text-[#121212]";
//   return (
//     <div className={`rounded-lg p-2 border ${highlight ? "bg-brand/5 border-brand/30" : "border-stone-300"}`}>
//       <div className="text-[9px] uppercase tracking-widest font-bold text-black/50">{label}</div>
//       <div className={`font-display text-base font-extrabold mt-0.5 ${color}`}>{value}</div>
//     </div>
//   );
// }






















import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { gradeFor, rankWithTies, ordinal } from "@/lib/grading";
import { Printer, ArrowLeft, GraduationCap, Download, Calendar } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import jsPDF from "jspdf";
import "jspdf-autotable";

const API_BASE = "https://manfess-back.onrender.com/api";

// Term definitions for Cameroon school system
const TERMS = [
  { id: "first", label: "First Term", sequences: ["1st seq", "2nd seq"] },
  { id: "second", label: "Second Term", sequences: ["3rd seq", "4th seq"] },
  { id: "third", label: "Third Term", sequences: ["5th seq", "6th seq"] },
  { id: "annual", label: "Annual", sequences: ["1st seq", "2nd seq", "3rd seq", "4th seq", "5th seq", "6th seq"] },
];

// Grade function
function gradeFor(score: number): { grade: string; remark: string } {
  if (score >= 18) return { grade: "A", remark: "Excellent" };
  if (score >= 16) return { grade: "B", remark: "Very Good" };
  if (score >= 14) return { grade: "C", remark: "Good" };
  if (score >= 12) return { grade: "D", remark: "Fair" };
  if (score >= 10) return { grade: "E", remark: "Average" };
  return { grade: "F", remark: "Poor" };
}

// Rank with ties
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

export function ReportCard() {
  const { studentId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const termId = searchParams.get("term") || "first";
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [marks, setMarks] = useState<any[]>([]);
  const [selectedTerm, setSelectedTerm] = useState<string>(termId);

  // Fetch data
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
        const mapped = studentsRes.data.data.map((s: any) => ({ ...s, id: s._id || s.id }));
        setStudents(mapped);
      }
      if (subjectsRes.data.success) {
        const mapped = subjectsRes.data.data.map((s: any) => ({ ...s, id: s._id || s.id }));
        setSubjects(mapped);
      }
      if (classesRes.data.success) {
        const mapped = classesRes.data.data.map((c: any) => ({ ...c, id: c._id || c.id, className: c.className || c.name }));
        setClasses(mapped);
      }
      if (marksRes.data.success) {
        const mapped = marksRes.data.data.map((m: any) => ({ ...m, id: m._id || m.id }));
        setMarks(mapped);
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

  // Build report data
  const data = useMemo(() => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return null;

    const cls = classes.find((c) => c.id === student.classId);
    if (!cls) return null;

    const classSubjects = subjects.filter((s) => s.classIds?.includes(cls.id));
    const term = TERMS.find((t) => t.id === selectedTerm) || TERMS[0];
    const sequences = term.sequences;

    // Get student's marks for each subject
    const rows = classSubjects.map((sub) => {
      const subMarks = marks.filter(
        (m) => m.studentId === student.id && m.subjectId === sub.id && sequences.includes(m.sequence)
      );
      const subjAvg = subMarks.length ? subMarks.reduce((a, b) => a + b.score, 0) / subMarks.length : 0;

      // Class stats for this subject
      const classStudents = students.filter((s) => s.classId === cls.id);
      const classMarks = marks.filter(
        (m) => m.subjectId === sub.id && classStudents.some((cs) => cs.id === m.studentId) && sequences.includes(m.sequence)
      );
      const classAvg = classMarks.length ? classMarks.reduce((a, b) => a + b.score, 0) / classMarks.length : 0;
      const max = classMarks.length ? Math.max(...classMarks.map((m) => m.score)) : 0;
      const min = classMarks.length ? Math.min(...classMarks.map((m) => m.score)) : 0;
      const { grade, remark } = gradeFor(subjAvg);

      // Get teacher name from recordedBy or assigned teacher
      const recordedBy = marks.filter((m) => m.subjectId === sub.id && m.recordedBy).sort((a, b) => (b.recordedAt || "").localeCompare(a.recordedAt || ""));
      const teacher = recordedBy[0]?.recordedBy || "—";

      return {
        sub,
        subjAvg,
        classAvg,
        max,
        min,
        total: subjAvg * sub.coefficient,
        grade,
        remark,
        teacher,
      };
    });

    const totalPoints = rows.reduce((a, b) => a + b.total, 0);
    const totalCoef = rows.reduce((a, b) => a + b.sub.coefficient, 0);
    const avg = totalCoef ? totalPoints / totalCoef : 0;

    // Calculate class ranks
    const classStudents = students.filter((s) => s.classId === cls.id);
    const classAvgs = classStudents.map((s) => {
      let sum = 0,
        cw = 0;
      for (const sub of classSubjects) {
        const sm = marks.filter((m) => m.studentId === s.id && m.subjectId === sub.id && sequences.includes(m.sequence));
        const a = sm.length ? sm.reduce((x, y) => x + y.score, 0) / sm.length : 0;
        if (a) { sum += a * sub.coefficient; cw += sub.coefficient; }
      }
      return { id: s.id, avg: cw ? sum / cw : 0 };
    });
    const ranks = rankWithTies(classAvgs);
    const position = ranks[student.id];
    const classGeneralAvg = classAvgs.length ? classAvgs.reduce((a, b) => a + b.avg, 0) / classAvgs.length : 0;

    return {
      student,
      cls,
      rows,
      avg,
      totalPoints,
      totalCoef,
      position,
      classSize: classStudents.length,
      classGeneralAvg,
      term,
    };
  }, [students, subjects, classes, marks, studentId, selectedTerm]);

  const downloadPdf = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const doc = new jsPDF();
      generateReportPage(doc, data);
      doc.save(`report-card-${data.student.fullName.replace(/\s+/g, "_")}-${data.term.id}.pdf`);
      toast.success("PDF downloaded successfully");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("PDF export failed");
    } finally {
      setDownloading(false);
    }
  };

  const generateReportPage = (doc: any, data: any) => {
    let y = 20;

    // Header
    doc.setFontSize(16);
    doc.text("MANFESS Evening School", 105, y, { align: "center" });
    y += 7;
    doc.setFontSize(9);
    doc.text("Republic of Cameroon · Peace — Work — Fatherland", 105, y, { align: "center" });
    y += 5;
    doc.text("Ministry of Secondary Education", 105, y, { align: "center" });
    y += 8;
    doc.setFontSize(11);
    doc.text(`Report Card - ${data.term.label}`, 105, y, { align: "center" });
    y += 7;
    doc.setFontSize(9);
    doc.text(`Academic Year: ${data.cls.acedemicYear || "2024-2025"}`, 105, y, { align: "center" });
    y += 10;

    // Student Info
    doc.setFontSize(10);
    doc.text(`Student: ${data.student.fullName}`, 14, y);
    doc.text(`Class: ${data.cls.className}`, 105, y);
    y += 6;
    doc.text(`Admission: ${data.student.admissionNumber || "N/A"}`, 14, y);
    doc.text(`Department: ${data.student.department}`, 105, y);
    y += 6;
    doc.text(`Average: ${data.avg.toFixed(2)}/20`, 14, y);
    doc.text(`Rank: ${data.position ? ordinal(data.position) : "—"} / ${data.classSize}`, 105, y);
    y += 8;

    // Subjects table
    const tableData = data.rows.map((r: any) => [
      r.sub.name,
      r.subjAvg.toFixed(2),
      r.sub.coefficient,
      r.total.toFixed(2),
      r.classAvg.toFixed(2),
      r.grade,
      r.remark,
    ]);

    (doc as any).autoTable({
      startY: y,
      head: [["Subject", "Score", "Coef", "Total", "Class Avg", "Grade", "Remark"]],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [0, 0, 0], fontSize: 8 },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 20 },
        2: { cellWidth: 15 },
        3: { cellWidth: 20 },
        4: { cellWidth: 20 },
        5: { cellWidth: 15 },
        6: { cellWidth: 25 },
      },
    });

    // Summary
    const finalY = (doc as any).lastAutoTable.finalY + 8;
    doc.setFontSize(10);
    doc.text(`Total Points: ${data.totalPoints.toFixed(2)}`, 14, finalY);
    doc.text(`Total Coefficient: ${data.totalCoef}`, 80, finalY);
    doc.text(`Status: ${data.avg >= 10 ? "Promoted ✅" : "Repeat ❌"}`, 145, finalY);

    // Footer
    doc.setFontSize(8);
    doc.text(`Parent: ${data.student.parentName} · Phone: ${data.student.parentPhone}`, 14, finalY + 10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, finalY + 16);
    doc.text("© 2026 MANFESS Evening School", 105, finalY + 16, { align: "center" });
  };

  const changeTerm = (termId: string) => {
    setSelectedTerm(termId);
    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.set("term", termId);
    window.history.replaceState({}, "", url.toString());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-black/60">Loading report card...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-sm">
        Student not found. <Link to="/app/report-cards" className="text-brand underline">Back</Link>
      </div>
    );
  }

  const { student, cls, rows, avg, totalPoints, totalCoef, position, classSize, classGeneralAvg, term } = data;
  const status = avg >= 10 ? "Promoted" : "Repeat";
  const statusColor = avg >= 10 ? "text-green-600" : "text-red-600";
  const gradeInfo = gradeFor(avg);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <Link to="/app/report-cards" className="flex items-center gap-2 text-sm font-semibold text-black/60 hover:text-black">
          <ArrowLeft className="size-4" /> All report cards
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Term Selector */}
          <select
            value={selectedTerm}
            onChange={(e) => changeTerm(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-stone-200 bg-white text-sm font-semibold"
          >
            {TERMS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm font-semibold hover:bg-stone-50"
          >
            <Printer className="size-4" /> Print
          </button>
          <button
            onClick={downloadPdf}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-50"
          >
            <Download className="size-4" /> {downloading ? "Generating…" : "Download PDF"}
          </button>
        </div>
      </div>

      <div id="report-card">
        <div className="bg-white border border-stone-200 rounded-2xl max-w-4xl mx-auto print:border-0 print:shadow-none print:rounded-none">
          <div className="p-8 print:p-6">
            {/* Cameroon official header */}
            <div className="grid grid-cols-3 gap-4 text-center text-[10px] font-bold uppercase tracking-wider pb-4 border-b-2 border-[#121212]">
              <div>
                République du Cameroun<br />
                <span className="font-normal italic">Paix — Travail — Patrie</span><br />
                Ministère des Enseignements Secondaires
              </div>
              <div className="flex flex-col items-center justify-center">
                <div className="size-12 bg-brand rounded-xl grid place-items-center mb-1">
                  <GraduationCap className="size-6 text-white" />
                </div>
                <div className="font-display text-base font-extrabold tracking-tight">MANFESS EVENING SCHOOL</div>
                <div className="text-[9px] text-black/60 font-normal">P.O. Box 1234, Yaoundé · MINESEC accredited</div>
              </div>
              <div>
                Republic of Cameroon<br />
                <span className="font-normal italic">Peace — Work — Fatherland</span><br />
                Ministry of Secondary Education
              </div>
            </div>

            <div className="text-center my-4">
              <div className="inline-block px-6 py-1.5 bg-[#121212] text-white text-xs font-bold uppercase tracking-widest rounded-full">
                {term.label} · Academic Year {cls.acedemicYear || "2024/2025"}
              </div>
            </div>

            {/* Student info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Info label="Student" value={student.fullName} />
              <Info label="Admission №" value={student.admissionNumber || "N/A"} />
              <Info label="Class" value={cls.className} />
              <Info label="Section" value={student.department} />
              <Info label="Sex" value={student.gender === "male" ? "Male" : "Female"} />
              <Info label="Date of Birth" value={student.dob} />
              <Info label="Class Size" value={String(classSize)} />
              <Info label="Position" value={position ? `${ordinal(position)} / ${classSize}` : "—"} />
            </div>

            {/* Marks table */}
            <table className="w-full text-[11px] mt-4 border border-[#121212]">
              <thead className="bg-[#121212] text-white">
                <tr>
                  <th className="px-2 py-1.5 text-left border border-[#121212]">Subject</th>
                  <th className="px-2 py-1.5 border border-[#121212]">Score</th>
                  <th className="px-2 py-1.5 border border-[#121212]">Coef</th>
                  <th className="px-2 py-1.5 border border-[#121212]">Total</th>
                  <th className="px-2 py-1.5 border border-[#121212]">Class Avg</th>
                  <th className="px-2 py-1.5 border border-[#121212]">Grade</th>
                  <th className="px-2 py-1.5 text-left border border-[#121212]">Remark</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.sub.id} className="even:bg-stone-50">
                    <td className="px-2 py-1.5 font-semibold border border-stone-300">{r.sub.name}</td>
                    <td className="px-2 py-1.5 text-center font-display font-bold border border-stone-300">{r.subjAvg.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-center border border-stone-300">{r.sub.coefficient}</td>
                    <td className="px-2 py-1.5 text-center font-bold border border-stone-300">{r.total.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-center text-black/70 border border-stone-300">{r.classAvg.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-center font-bold text-brand border border-stone-300">{r.grade}</td>
                    <td className="px-2 py-1.5 text-black/70 border border-stone-300">{r.remark}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[#121212]/5 font-bold">
                <tr>
                  <td className="px-2 py-1.5 border border-[#121212]">TOTAL</td>
                  <td className="px-2 py-1.5 text-center border border-[#121212]">—</td>
                  <td className="px-2 py-1.5 text-center border border-[#121212]">{totalCoef}</td>
                  <td className="px-2 py-1.5 text-center border border-[#121212]">{totalPoints.toFixed(2)}</td>
                  <td colSpan={3} className="border border-[#121212]" />
                </tr>
              </tfoot>
            </table>

            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 text-xs">
              <Summary label="Average /20" value={avg.toFixed(2)} highlight />
              <Summary label="Class Avg" value={classGeneralAvg.toFixed(2)} />
              <Summary label="Rank" value={position ? `${ordinal(position)} / ${classSize}` : "—"} />
              <Summary label="Grade" value={gradeInfo.grade} />
              <Summary label="Status" value={status} tone={status === "Promoted" ? "good" : "bad"} />
            </div>

            {/* Conduct */}
            <div className="grid sm:grid-cols-4 gap-2 mt-3 text-xs">
              <Info label="Conduct" value="Good" />
              <Info label="Discipline" value="Satisfactory" />
              <Info label="Absences" value="0" />
              <Info label="Lateness" value="0" />
            </div>

            {/* Remarks */}
            <div className="grid sm:grid-cols-2 gap-3 mt-4 text-xs">
              <div className="border border-stone-300 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-widest font-bold text-black/50 mb-1">Class Master's Remark</div>
                <p className="text-black/70 italic">
                  {avg >= 16 ? "Excellent performance. A role model to others." :
                    avg >= 14 ? "Very good performance. Keep pushing." :
                      avg >= 12 ? "Good performance. Can do better." :
                        avg >= 10 ? "Average performance. Needs more effort." :
                          "Needs serious improvement. Must work harder."}
                </p>
              </div>
              <div className="border border-stone-300 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-widest font-bold text-black/50 mb-1">Principal's Remark</div>
                <p className="text-black/70 italic">
                  {avg >= 16 ? "Outstanding. A pride to the school." :
                    avg >= 14 ? "Commendable effort. Continue to excel." :
                      avg >= 12 ? "Satisfactory. Keep up the momentum." :
                        avg >= 10 ? "Average. Room for improvement." :
                          "Must take studies more seriously."}
                </p>
              </div>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-3 gap-6 mt-8 text-center text-xs">
              {["Class Master", "Principal", "Parent / Guardian"].map((r) => (
                <div key={r}>
                  <div className="h-10 border-b border-dashed border-stone-400" />
                  <div className="mt-1 font-semibold text-black/70">{r}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-3 border-t border-stone-300 flex items-center justify-between text-[10px] text-black/40">
              <div>Issued by MAMS · MANFESS Evening School · {new Date().toLocaleDateString()}</div>
              <div className="font-mono">VERIF#{student.id.toUpperCase()}-{term.id.toUpperCase()}</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          body { background: white !important; }
          aside, header { display: none !important; }
          main > div { padding: 0 !important; }
          #report-card { border: none !important; }
          .print\\:border-0 { border: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:rounded-none { border-radius: 0 !important; }
        }
      `}</style>
    </div>
  );
}

// Helper Components
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-stone-300 rounded-md px-2 py-1">
      <div className="text-[9px] uppercase tracking-widest font-bold text-black/50">{label}</div>
      <div className="text-xs font-semibold mt-0.5 truncate">{value}</div>
    </div>
  );
}

function Summary({ label, value, highlight, tone }: { label: string; value: string; highlight?: boolean; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-brand" : tone === "bad" ? "text-red-600" : highlight ? "text-brand" : "text-[#121212]";
  return (
    <div className={`rounded-lg p-2 border ${highlight ? "bg-brand/5 border-brand/30" : "border-stone-300"}`}>
      <div className="text-[9px] uppercase tracking-widest font-bold text-black/50">{label}</div>
      <div className={`font-display text-base font-extrabold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}