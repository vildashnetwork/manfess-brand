import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Printer, Download, GraduationCap } from "lucide-react";
import { CompactPageLoader } from "@/components/CompactPageLoader";
import { toast } from "sonner";
import axios from "axios";
import { exportElementsToPdf } from "@/lib/pdf-export";

const API_BASE = import.meta.env.VITE_API_URL ?? "https://manfess-back.onrender.com/api";

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

export function ReportCardsBulk() {
  const [sp, setSp] = useSearchParams();
  const classId = sp.get("classId") ?? "";
  const termId = sp.get("term") ?? "first";

  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [marks, setMarks] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [attendanceSummaries, setAttendanceSummaries] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [classDataLoading, setClassDataLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [subjectsRes, classesRes, teachersRes] = await Promise.all([
        axios.get(`${API_BASE}/subjects`),
        axios.get(`${API_BASE}/classes`),
        axios.get(`${API_BASE}/teachers`).catch(() => null), // optional endpoint, fail gracefully
      ]);
      if (subjectsRes.data.success) {
        const mapped = subjectsRes.data.data.map((s: any) => ({ ...s, id: s._id || s.id }));
        setSubjects(mapped);
      }
      if (classesRes.data.success) {
        const mapped = classesRes.data.data.map((c: any) => ({ ...c, id: c._id || c.id, className: c.className || c.name }));
        setClasses(mapped);
      }
      if (teachersRes && teachersRes.data && teachersRes.data.success) {
        const mapped = teachersRes.data.data.map((t: any) => ({ ...t, id: t._id || t.id }));
        setTeachers(mapped);
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

  const cls = classes.find((c) => c.id === classId);
  const term = TERMS.find((t) => t.id === termId) || TERMS[0];
  const sequences = term.sequences;

  useEffect(() => {
    if (!classId || !cls) {
      setStudents([]);
      setMarks([]);
      setClassDataLoading(false);
      return;
    }

    let cancelled = false;
    setClassDataLoading(true);
    Promise.all([
      axios.get(`${API_BASE}/students/class/${classId}`),
      axios.get(`${API_BASE}/marks`, {
        params: { classId, academicYear: cls.acedemicYear || cls.academicYear || "" },
      }),
    ]).then(([studentsRes, marksRes]) => {
      if (cancelled) return;
      if (studentsRes.data.success) {
        setStudents(studentsRes.data.data.map((student: any) => ({ ...student, id: student._id || student.id })));
      }
      if (marksRes.data.success) {
        setMarks(marksRes.data.data.map((mark: any) => ({ ...mark, id: mark._id || mark.id })));
      }
    }).catch((error) => {
      if (!cancelled) {
        console.error("Unable to load this class's report-card data", error);
        toast.error(error.response?.data?.message || "Could not load reports for this class");
      }
    }).finally(() => {
      if (!cancelled) setClassDataLoading(false);
    });

    return () => { cancelled = true; };
  }, [classId, cls?.acedemicYear, cls?.academicYear]);

  useEffect(() => {
    if (!cls || !classId) {
      setAttendanceSummaries({});
      return;
    }

    let cancelled = false;
    axios.get(`${API_BASE}/attendance/students/summary`, {
      params: {
        classId,
        academicYear: cls.acedemicYear || cls.academicYear || "",
        term: termId,
      },
    }).then((response) => {
      if (!cancelled && response.data.success) {
        setAttendanceSummaries(Object.fromEntries(
          response.data.data.map((summary: any) => [summary.studentId, summary]),
        ));
      }
    }).catch((error) => {
      console.error("Unable to load report-card attendance", error);
      if (!cancelled) setAttendanceSummaries({});
    });

    return () => { cancelled = true; };
  }, [classId, cls?.acedemicYear, cls?.academicYear, termId]);

  // Map teacherId -> teacher name for quick lookup
  const teachersMap = useMemo(() => {
    const map: Record<string, string> = {};
    teachers.forEach((t) => {
      map[t.id] = t.fullName || t.name || t.teacherName || "—";
    });
    return map;
  }, [teachers]);

  const getTeacherName = (subject: any): string => {
    if (subject.teacherId && teachersMap[subject.teacherId]) return teachersMap[subject.teacherId];
    if (subject.teacherName) return subject.teacherName;
    if (subject.teacher?.fullName) return subject.teacher.fullName;
    return "—";
  };

  const classStudents = useMemo(() => {
    return students
      .filter((s) => s.classId === classId)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [students, classId]);

  const classSubjects = useMemo(() => {
    return subjects.filter((s) => s.classIds?.includes(classId));
  }, [subjects, classId]);

  // Build report data
  const reports = useMemo(() => {
    return classStudents.map((student) => {
      let totalWeighted = 0;
      let totalCoeff = 0;
      const subjectScores: any[] = [];

      for (const subject of classSubjects) {
        const subjectMarks = marks.filter(
          (m) =>
            m.studentId === student.id &&
            m.subjectId === subject.id &&
            sequences.includes(m.sequence)
        );

        // Score per sequence, keyed by sequence label, for column display
        const sequenceScores: Record<string, number | null> = {};
        sequences.forEach((seq) => {
          const mark = subjectMarks.find((m) => m.sequence === seq);
          sequenceScores[seq] = mark ? mark.score : null;
        });

        const scores = subjectMarks.map((m) => m.score);
        // Subject average = mean of the sequence scores recorded for this term
        const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

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
          teacherName: getTeacherName(subject),
          scores,
          sequenceScores,
          average: avg,
          classAvg,
          max,
          min,
        });

        if (avg > 0) {
          totalWeighted += avg * subject.coefficient;
          totalCoeff += subject.coefficient;
        }
      }

      // Overall student average = sum(subject average * coefficient) / sum(coefficients)
      const overallAverage = totalCoeff > 0 ? totalWeighted / totalCoeff : 0;

      return {
        student,
        subjectScores,
        overallAverage,
        totalWeighted,
        totalCoeff,
      };
    });
  }, [classStudents, classSubjects, marks, sequences, teachersMap]);

  // Calculate ranks
  const rankedReports = useMemo(() => {
    const avgValues = reports.map((d) => ({ id: d.student.id, avg: d.overallAverage }));
    const ranks = rankWithTies(avgValues);
    return reports
      .map((d) => ({
        ...d,
        attendance: attendanceSummaries[d.student.id] || {
          schoolDays: 0,
          sessions: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          attendanceRate: 0,
        },
        rank: ranks[d.student.id] || 0,
      }))
      .sort((first, second) => first.rank - second.rank || first.student.fullName.localeCompare(second.student.fullName));
  }, [reports, attendanceSummaries]);

  const downloadAll = async () => {
    const el = document.getElementById("bulk-report-cards");
    if (!el) return;
    setDownloading(true);
    try {
      const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-report-card]"));
      await exportElementsToPdf(cards, `report-cards-${cls?.className ?? "class"}-${termId}.pdf`);
      toast.success("Bulk PDF downloaded");
    } catch (e) {
      console.error(e);
      toast.error("Bulk PDF export failed");
    } finally {
      setDownloading(false);
    }
  };

  const changeTerm = (newTermId: string) => {
    setSp({ term: newTermId, classId }, { replace: true });
  };

  useEffect(() => {
    document.body.classList.add("bulk-print-mode");
    return () => document.body.classList.remove("bulk-print-mode");
  }, []);

  if (loading) {
    return <CompactPageLoader label="Loading report cards..." />;
  }

  if (!cls) {
    return (
      <div className="p-8 text-sm">
        Class not found.{" "}
        <Link to="/app/report-cards" className="text-brand underline">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3 print:hidden">
        <Link to="/app/report-cards" className="flex items-center gap-2 text-sm font-semibold text-black/60 hover:text-black">
          <ArrowLeft className="size-4" /> Back
        </Link>
        <div className="text-sm flex items-center gap-3">
          <span className="font-display font-extrabold">{cls.className}</span>
          <span className="text-black/50">·</span>
          <select
            value={termId}
            onChange={(e) => changeTerm(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-stone-200 bg-white text-sm font-semibold"
          >
            {TERMS.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <span className="text-black/50">· {rankedReports.length} students</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-stone-200 bg-white text-sm font-semibold hover:bg-stone-50">
            <Printer className="size-4" /> Print all
          </button>
          <button onClick={downloadAll} disabled={downloading || classDataLoading} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-50">
            <Download className="size-4" /> {downloading ? "Generating…" : "Download PDF"}
          </button>
        </div>
      </div>

      {classDataLoading && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          <div className="size-4 animate-spin rounded-full border-2 border-blue-700 border-t-transparent" />
          Loading students and marks for this class…
        </div>
      )}

      <div id="bulk-report-cards" className="space-y-6">
        {rankedReports.map((data, i) => (
          <div key={data.student.id} data-report-card className={i > 0 ? "report-page-break" : ""} style={i > 0 ? { pageBreakBefore: "always" } : undefined}>
            <ReportCardCard data={data} cls={cls} term={term} sequences={sequences} classSize={rankedReports.length} />
          </div>
        ))}
        {rankedReports.length === 0 && (
          <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center text-sm text-black/50">No students in this class.</div>
        )}
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 8mm; }
          body { background: white !important; }
          aside, header { display: none !important; }
          main > div { padding: 0 !important; }
          .report-page-break { page-break-before: always; }
          .report-card-page { border: none !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}

function ReportCardCard({ data, cls, term, sequences, classSize }: { data: any; cls: any; term: any; sequences: string[]; classSize: number }) {
  const avg = data.overallAverage;
  const status = avg >= 10 ? "Promoted" : "Repeat";
  const gradeInfo = gradeFor(avg);
  const matricule = data.student.matricule || data.student.admissionNumber || "Not assigned";
  const defaultPortrait = data.student.gender === "female" ? "/female-student-avatar.svg" : "/male-student-avatar.svg";
  const portraitUrl = data.student.photoUrl || defaultPortrait;

  return (
    <div className="bg-white border border-[#CADCF0] border-t-8 border-t-[#155DAA] max-w-4xl mx-auto print:border-0 print:shadow-none report-card-page">
      <div className="p-6 print:p-5">
        {/* Cameroon official header */}
        <div className="grid grid-cols-3 gap-4 items-center text-center text-[10px] font-bold uppercase tracking-wider pb-4 border-b-[3px] border-[#d2ad4b]">
          <div className="text-left text-[#155DAA] leading-relaxed">
            République du Cameroun<br />
            <span className="font-normal italic text-stone-500">Paix — Travail — Patrie</span><br />
            Ministère des Enseignements Secondaires
          </div>
          <div className="flex flex-col items-center justify-center">
            <div className="size-12 bg-[#155DAA] border-[3px] border-[#d2ad4b] rounded-full grid place-items-center mb-1 text-white text-xs font-black">
              BCHS
            </div>
            <div className="font-display text-lg font-extrabold tracking-tight text-[#155DAA]">BCHS DOUALA</div>
            <div className="text-[9px] text-stone-500 font-normal normal-case">Excellence · Discipline · Service</div>
          </div>
          <div className="text-right text-[#155DAA] leading-relaxed">
            Republic of Cameroon<br />
            <span className="font-normal italic text-stone-500">Peace — Work — Fatherland</span><br />
            Ministry of Secondary Education
          </div>
        </div>

        <div className="my-4 flex items-center justify-between gap-3 border-l-4 border-[#155DAA] bg-[#EAF2FB] px-4 py-2.5">
          <div className="font-display text-lg font-extrabold uppercase text-[#155DAA]">{term.label} Report</div>
          <div className="text-right text-[10px] font-bold text-stone-500">ACADEMIC YEAR<br /><span className="text-sm text-stone-800">{cls.acedemicYear || "—"}</span></div>
        </div>

        <div className="mb-4 grid grid-cols-[110px_1fr] gap-4 rounded-lg border border-[#d9e5dc] p-3">
          <div className="relative h-[138px] w-[110px] overflow-hidden rounded-md border-2 border-[#d2ad4b] bg-[#EAF2FB] grid place-items-center text-3xl font-black text-[#155DAA]">
            <img
              src={portraitUrl}
              alt={`${data.student.gender === "female" ? "Female" : "Male"} student portrait`}
              className="absolute inset-0 size-full object-cover"
              crossOrigin="anonymous"
              onError={(event) => {
                if (event.currentTarget.src.endsWith(defaultPortrait)) event.currentTarget.src = "/bchs-logo.svg";
                else event.currentTarget.src = defaultPortrait;
              }}
            />
          </div>
          <div>
            <h2 className="mb-2 font-display text-xl font-extrabold text-[#155DAA]">{data.student.fullName}</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] sm:grid-cols-3">
              <Info label="Matricule" value={matricule} />
              <Info label="Class" value={cls.className} />
              <Info label="Department" value={data.student.department || cls.department || "—"} />
              <Info label="Gender" value={data.student.gender === "male" ? "Male" : "Female"} />
              <Info label="Date of Birth" value={data.student.dob || "—"} />
              <Info label="Position" value={data.rank ? `${ordinal(data.rank)} / ${classSize}` : "—"} />
              <Info label="Parent / Guardian" value={data.student.parentName || "—"} />
              <Info label="Contact" value={data.student.parentPhone || "—"} />
              <Info label="Class Size" value={`${classSize} learners`} />
              <div className="col-span-2 sm:col-span-3"><Info label="Address" value={data.student.address || "—"} /></div>
            </div>
          </div>
        </div>

        {/* Marks table */}
        <table className="w-full text-[11px] mt-4 border border-[#0b5137]">
          <thead className="bg-[#155DAA] text-white">
            <tr>
              <th className="px-2 py-1.5 text-left border border-[#121212]">Subject</th>
              {sequences.map((seq) => (
                <th key={seq} className="px-2 py-1.5 border border-[#121212] whitespace-nowrap">{seq}</th>
              ))}
              <th className="px-2 py-1.5 border border-[#121212]">Average</th>
              <th className="px-2 py-1.5 border border-[#121212]">Coef</th>
              <th className="px-2 py-1.5 border border-[#121212]">Avg × Coef</th>
              <th className="px-2 py-1.5 text-left border border-[#121212]">Teacher</th>
              <th className="px-2 py-1.5 border border-[#121212]">Class Avg</th>
              <th className="px-2 py-1.5 border border-[#121212]">Grade</th>
              <th className="px-2 py-1.5 text-left border border-[#121212]">Remark</th>
            </tr>
          </thead>
          <tbody>
            {data.subjectScores.map((sub: any) => {
              const avgScore = sub.average;
              const grade = sub.scores.length > 0 ? gradeFor(avgScore) : null;
              return (
                <tr key={sub.subjectId} className="even:bg-stone-50">
                  <td className="px-2 py-1.5 font-semibold border border-stone-300">{sub.name}</td>
                  {sequences.map((seq) => (
                    <td key={seq} className="px-2 py-1.5 text-center border border-stone-300">
                      {sub.sequenceScores[seq] !== null && sub.sequenceScores[seq] !== undefined
                        ? Number(sub.sequenceScores[seq]).toFixed(2)
                        : "—"}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center font-display font-bold border border-stone-300">{avgScore.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-center border border-stone-300">{sub.coefficient}</td>
                  <td className="px-2 py-1.5 text-center font-bold border border-stone-300">{(avgScore * sub.coefficient).toFixed(2)}</td>
                  <td className="px-2 py-1.5 border border-stone-300">{sub.teacherName || "—"}</td>
                  <td className="px-2 py-1.5 text-center text-black/70 border border-stone-300">{sub.classAvg?.toFixed(2) || "—"}</td>
                  <td className="px-2 py-1.5 text-center font-bold text-brand border border-stone-300">{grade?.grade || "—"}</td>
                  <td className="px-2 py-1.5 text-black/70 border border-stone-300">{grade?.remark || "—"}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-[#121212]/5 font-bold">
            <tr>
              <td className="px-2 py-1.5 border border-[#121212]" colSpan={1 + sequences.length}>TOTAL</td>
              <td className="px-2 py-1.5 text-center border border-[#121212]">—</td>
              <td className="px-2 py-1.5 text-center border border-[#121212]">{data.totalCoeff}</td>
              <td className="px-2 py-1.5 text-center border border-[#121212]">{data.totalWeighted.toFixed(2)}</td>
              <td colSpan={4} className="border border-[#121212]" />
            </tr>
          </tfoot>
        </table>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 text-xs">
          <Summary label="Average /20" value={avg.toFixed(2)} highlight />
          <Summary label="Grade" value={gradeInfo.grade} />
          <Summary label="Status" value={status} tone={status === "Promoted" ? "good" : "bad"} />
          <Summary label="Rank" value={data.rank ? ordinal(data.rank) : "—"} />
          <Summary label="Class Size" value={String(data.subjectScores.length > 0 ? data.subjectScores[0].classStudents?.length || 0 : 0)} />
        </div>

        {/* Conduct */}
        <div className="mt-3 rounded-lg border border-[#CADCF0] bg-[#F4F8FD] p-3">
          <div className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-[#155DAA]">Attendance · {term.label}</div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
            <Summary label="Present" value={`${data.attendance.present} days`} />
            <Summary label="Absent" value={`${data.attendance.absent} days`} />
            <Summary label="Late" value={`${data.attendance.late} days`} />
            <Summary label="Excused" value={`${data.attendance.excused} days`} />
            <Summary label="Attendance rate" value={`${data.attendance.attendanceRate}%`} highlight />
          </div>
          <p className="mt-2 text-[9px] text-stone-500">{data.attendance.schoolDays} recorded school days · {data.attendance.sessions} attendance sessions</p>
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

        <div className="mt-6 pt-3 border-t-2 border-[#d2ad4b] flex items-center justify-between text-[10px] text-stone-500">
          <div className="font-semibold text-[#155DAA]">Issued by BCHS DOUALA · {new Date().toLocaleDateString()}</div>
          <div className="font-mono">VERIF#{data.student.id.toUpperCase()}-{term.id.toUpperCase()}</div>
        </div>
      </div>
    </div>
  );
}

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