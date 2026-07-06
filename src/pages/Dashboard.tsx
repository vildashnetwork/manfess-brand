// import { useMemo } from "react";
// import { getStore } from "@/lib/mock-data";
// import { rankWithTies } from "@/lib/grading";
// import { Users, GraduationCap, Wallet, TrendingUp, Award, AlertCircle } from "lucide-react";
// import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from "recharts";

// export function Dashboard() {
//   const data = useMemo(() => {
//     const s = getStore();
//     const perStudent: Record<string, { sum: number; cw: number }> = {};
//     for (const m of s.marks) {
//       const sub = s.subjects.find((x) => x.id === m.subjectId);
//       if (!sub) continue;
//       const cur = perStudent[m.studentId] ?? { sum: 0, cw: 0 };
//       cur.sum += m.score * sub.coefficient;
//       cur.cw += sub.coefficient;
//       perStudent[m.studentId] = cur;
//     }
//     const studentAvgs = Object.entries(perStudent).map(([id, v]) => ({ id, avg: v.cw ? v.sum / v.cw : 0 }));
//     const ranks = rankWithTies(studentAvgs);
//     const passRate = studentAvgs.length ? (studentAvgs.filter((v) => v.avg >= 10).length / studentAvgs.length) * 100 : 0;
//     const totalFeesPaid = s.students.reduce((a, b) => a + b.feesPaid, 0);
//     const totalFeesDue = s.students.reduce((a, b) => a + b.feesDue, 0);
//     const classAvgs = s.classes.map((c) => {
//       const studs = s.students.filter((st) => st.classId === c.id);
//       const avgs = studs.map((st) => studentAvgs.find((sa) => sa.id === st.id)?.avg ?? 0);
//       const a = avgs.length ? avgs.reduce((x, y) => x + y, 0) / avgs.length : 0;
//       return { name: c.name.replace("Form ", "F"), avg: Math.round(a * 10) / 10 };
//     });
//     const bestClass = [...classAvgs].sort((a, b) => b.avg - a.avg)[0];
//     const top = studentAvgs
//       .map((sa) => ({ ...sa, rank: ranks[sa.id], student: s.students.find((st) => st.id === sa.id)! }))
//       .filter((t) => t.student)
//       .sort((a, b) => a.rank - b.rank).slice(0, 7);
//     const trend = [1, 2, 3, 4, 5, 6].map((seq) => {
//       const m = s.marks.filter((mm) => mm.sequence === seq);
//       const avg = m.length ? m.reduce((a, b) => a + b.score, 0) / m.length : 0;
//       return { sequence: `Seq ${seq}`, average: avg ? Math.round(avg * 10) / 10 : null };
//     });
//     return { totalStudents: s.students.length, totalTeachers: s.teachers.length, totalClasses: s.classes.length, totalFeesPaid, totalFeesDue, passRate, classAvgs, bestClass, top, trend };
//   }, []);

//   return (
//     <div className="space-y-6">
//       <div>
//         <h1 className="font-display text-3xl font-extrabold tracking-tight">Welcome back</h1>
//         <p className="text-sm text-black/60 mt-1">Here's what's happening across MANFESS Evening School today.</p>
//       </div>
//       <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//         <Kpi icon={Users} label="Total Students" value={data.totalStudents.toLocaleString()} hint="+12% vs last year" />
//         <Kpi icon={GraduationCap} label="Teachers" value={data.totalTeachers.toString()} hint={`${data.totalClasses} classes`} />
//         <Kpi icon={Wallet} label="Fees Collected" value={`${(data.totalFeesPaid / 1_000_000).toFixed(1)}M XAF`} hint={`${(data.totalFeesDue / 1_000_000).toFixed(1)}M outstanding`} tone="brand" />
//         <Kpi icon={TrendingUp} label="Pass Rate" value={`${data.passRate.toFixed(1)}%`} hint="Avg ≥ 10/20" />
//       </div>
//       <div className="grid lg:grid-cols-3 gap-6">
//         <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
//           <div className="flex items-center justify-between mb-6">
//             <div><h3 className="font-display font-bold">Class Averages</h3><p className="text-xs text-black/50 mt-0.5">Weighted average / 20</p></div>
//             {data.bestClass && <div className="flex items-center gap-2 text-xs bg-brand/10 text-brand px-3 py-1.5 rounded-full font-bold"><Award className="size-3.5" /> Best: {data.bestClass.name} · {data.bestClass.avg}</div>}
//           </div>
//           <div className="h-64"><ResponsiveContainer><BarChart data={data.classAvgs}><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis domain={[0, 20]} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="avg" fill="#0F7A35" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
//         </div>
//         <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
//           <h3 className="font-display font-bold mb-1">Excellence Board</h3>
//           <p className="text-xs text-black/50 mb-4">Top performing students</p>
//           <div className="space-y-3">
//             {data.top.map((t) => (
//               <div key={t.id} className="flex items-center justify-between gap-3">
//                 <div className="flex items-center gap-3 min-w-0">
//                   <div className={`size-7 shrink-0 rounded-full grid place-items-center text-[10px] font-bold ${t.rank <= 3 ? "bg-brand text-white" : "bg-stone-100 text-black/60"}`}>{t.rank}</div>
//                   <div className="min-w-0">
//                     <div className="text-sm font-semibold truncate">{t.student.fullName}</div>
//                     <div className="text-[10px] text-black/40 uppercase tracking-wider">{t.student.department}</div>
//                   </div>
//                 </div>
//                 <div className="font-display font-extrabold text-brand text-sm">{t.avg.toFixed(2)}</div>
//               </div>
//             ))}
//           </div>
//         </div>
//       </div>
//       <div className="grid lg:grid-cols-3 gap-6">
//         <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
//           <h3 className="font-display font-bold mb-4">Sequence Performance Trend</h3>
//           <div className="h-56"><ResponsiveContainer><LineChart data={data.trend}><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="sequence" tick={{ fontSize: 11 }} /><YAxis domain={[0, 20]} tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Line type="monotone" dataKey="average" stroke="#0F7A35" strokeWidth={3} dot={{ r: 5 }} connectNulls /></LineChart></ResponsiveContainer></div>
//         </div>
//         <div className="bg-[#121212] text-white rounded-2xl p-6 flex flex-col justify-between">
//           <div>
//             <div className="size-10 bg-brand rounded-lg grid place-items-center mb-4"><AlertCircle className="size-5 text-white" /></div>
//             <h3 className="font-display font-bold text-lg">AI Insight</h3>
//             <p className="text-sm text-white/60 mt-2">Form 4 Commercial shows a 1.4 point drop versus last sequence. Schedule remedial Accounting before Sequence 3.</p>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// function Kpi({ icon: Icon, label, value, hint, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; hint: string; tone?: "brand" }) {
//   return (
//     <div className={`p-5 rounded-2xl border shadow-sm ${tone === "brand" ? "bg-brand text-white border-brand" : "bg-white border-stone-200"}`}>
//       <div className="flex items-center justify-between mb-3">
//         <p className={`text-[10px] font-bold uppercase tracking-widest ${tone === "brand" ? "text-white/70" : "text-black/40"}`}>{label}</p>
//         <Icon className={`size-4 ${tone === "brand" ? "text-white/80" : "text-black/30"}`} />
//       </div>
//       <p className="font-display text-3xl font-extrabold tracking-tight">{value}</p>
//       <p className={`mt-1 text-[11px] font-semibold ${tone === "brand" ? "text-white/70" : "text-brand"}`}>{hint}</p>
//     </div>
//   );
// }

















import { useEffect, useMemo, useState } from "react";
import { getStore } from "@/lib/mock-data";
import { rankWithTies } from "@/lib/grading";
import { Users, GraduationCap, Wallet, TrendingUp, Award, AlertCircle, Loader2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from "recharts";
import axios from "axios";
import { toast } from "sonner";
import { currentUser } from "@/lib/auth";

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

export function Dashboard() {
  const user = currentUser();
  const isTeacher = user?.role === "teacher";

  const [students, setStudents] = useState<Student[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);

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
          className: c.className || c.name
        }));
        setClasses(mappedClasses);
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

  const data = useMemo(() => {
    if (loading || students.length === 0) {
      return {
        totalStudents: 0,
        totalTeachers: 0,
        totalClasses: 0,
        totalFeesPaid: 0,
        totalFeesDue: 0,
        passRate: 0,
        classAvgs: [],
        bestClass: null,
        top: [],
        trend: [],
      };
    }

    // Calculate per student averages
    const perStudent: Record<string, { sum: number; cw: number }> = {};
    for (const m of marks) {
      const sub = subjects.find((x) => x.id === m.subjectId);
      if (!sub) continue;
      const cur = perStudent[m.studentId] ?? { sum: 0, cw: 0 };
      cur.sum += m.score * sub.coefficient;
      cur.cw += sub.coefficient;
      perStudent[m.studentId] = cur;
    }

    // Calculate student averages
    const studentAvgs = Object.entries(perStudent).map(([id, v]) => ({
      id,
      avg: v.cw ? v.sum / v.cw : 0
    }));

    // Calculate ranks
    const ranks = rankWithTies(studentAvgs);

    // Pass rate
    const passRate = studentAvgs.length
      ? (studentAvgs.filter((v) => v.avg >= 10).length / studentAvgs.length) * 100
      : 0;

    // Fees
    const totalFeesPaid = students.reduce((a, b) => a + b.feesPaid, 0);
    const totalFeesDue = students.reduce((a, b) => a + b.feesDue, 0);

    // Class averages
    const classAvgs = classes.map((c) => {
      const studs = students.filter((st) => st.classId === c.id);
      const avgs = studs.map((st) => studentAvgs.find((sa) => sa.id === st.id)?.avg ?? 0);
      const avg = avgs.length ? avgs.reduce((x, y) => x + y, 0) / avgs.length : 0;
      return {
        name: c.className.replace("Form ", "F"),
        avg: Math.round(avg * 10) / 10
      };
    });

    // Best class
    const bestClass = [...classAvgs].sort((a, b) => b.avg - a.avg)[0] || null;

    // Top students
    const top = studentAvgs
      .map((sa) => ({
        ...sa,
        rank: ranks[sa.id],
        student: students.find((st) => st.id === sa.id)!
      }))
      .filter((t) => t.student)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 7);

    // Sequence trend
    const sequences = ["1st seq", "2nd seq", "3rd seq", "4th seq", "5th seq", "6th seq"];
    const trend = sequences.map((seq, index) => {
      const m = marks.filter((mm) => mm.sequence === seq);
      const avg = m.length ? m.reduce((a, b) => a + b.score, 0) / m.length : 0;
      return {
        sequence: `Seq ${index + 1}`,
        average: avg ? Math.round(avg * 10) / 10 : null,
      };
    });

    // AI Insight based on data
    let aiInsight = "";
    if (classAvgs.length > 0) {
      const lowestClass = [...classAvgs].sort((a, b) => a.avg - b.avg)[0];
      if (lowestClass && lowestClass.avg < 10) {
        aiInsight = `${lowestClass.name} shows a low average of ${lowestClass.avg}. Consider remedial classes for this class.`;
      } else if (trend.length > 1 && trend[trend.length - 1]?.average !== null && trend[trend.length - 2]?.average !== null) {
        const last = trend[trend.length - 1].average!;
        const prev = trend[trend.length - 2].average!;
        if (last < prev) {
          aiInsight = `There's a ${(prev - last).toFixed(1)} point drop in the latest sequence. Schedule review sessions.`;
        } else {
          aiInsight = `Overall performance is trending ${last > prev ? 'upward' : 'stable'}. Keep up the good work!`;
        }
      } else {
        aiInsight = "Monitor student performance regularly for the best results.";
      }
    }

    return {
      totalStudents: students.length,
      totalTeachers: teachers.filter(t => t.role === "teacher").length,
      totalClasses: classes.length,
      totalFeesPaid,
      totalFeesDue,
      passRate,
      classAvgs,
      bestClass,
      top,
      trend,
      aiInsight,
    };
  }, [students, subjects, classes, marks, teachers, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-brand animate-spin mx-auto" />
          <p className="mt-4 text-black/60">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Welcome back</h1>
        <p className="text-sm text-black/60 mt-1">Here's what's happening across MANFESS Evening School today.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          icon={Users}
          label="Total Students"
          value={data.totalStudents.toLocaleString()}
          hint="Active students"
        />
        <Kpi
          icon={GraduationCap}
          label="Teachers"
          value={data.totalTeachers.toString()}
          hint={`${data.totalClasses} classes`}
        />
        <Kpi
          icon={Wallet}
          label="Fees Collected"
          value={`${(data.totalFeesPaid / 1_000_000).toFixed(1)}M XAF`}
          hint={`${(data.totalFeesDue / 1_000_000).toFixed(1)}M outstanding`}
          tone="brand"
        />
        <Kpi
          icon={TrendingUp}
          label="Pass Rate"
          value={`${data.passRate.toFixed(1)}%`}
          hint="Avg ≥ 10/20"
        />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display font-bold">Class Averages</h3>
              <p className="text-xs text-black/50 mt-0.5">Weighted average / 20</p>
            </div>
            {data.bestClass && (
              <div className="flex items-center gap-2 text-xs bg-brand/10 text-brand px-3 py-1.5 rounded-full font-bold">
                <Award className="size-3.5" /> Best: {data.bestClass.name} · {data.bestClass.avg}
              </div>
            )}
          </div>
          {data.classAvgs.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={data.classAvgs}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="avg" fill="#0F7A35" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-black/40">
              No class data available
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <h3 className="font-display font-bold mb-1">Excellence Board</h3>
          <p className="text-xs text-black/50 mb-4">Top performing students</p>
          <div className="space-y-3">
            {data.top.length > 0 ? (
              data.top.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`size-7 shrink-0 rounded-full grid place-items-center text-[10px] font-bold ${t.rank <= 3 ? "bg-brand text-white" : "bg-stone-100 text-black/60"
                      }`}>
                      {t.rank}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{t.student.fullName}</div>
                      <div className="text-[10px] text-black/40 uppercase tracking-wider">{t.student.department}</div>
                    </div>
                  </div>
                  <div className="font-display font-extrabold text-brand text-sm">{t.avg.toFixed(2)}</div>
                </div>
              ))
            ) : (
              <div className="text-center text-black/40 py-8">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Trend and AI Insight */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <h3 className="font-display font-bold mb-4">Sequence Performance Trend</h3>
          {data.trend.some(t => t.average !== null) ? (
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart data={data.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="sequence" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 20]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line
                    type="monotone"
                    dataKey="average"
                    stroke="#0F7A35"
                    strokeWidth={3}
                    dot={{ r: 5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-black/40">
              No sequence data available
            </div>
          )}
        </div>

        <div className="bg-[#121212] text-white rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="size-10 bg-brand rounded-lg grid place-items-center mb-4">
              <AlertCircle className="size-5 text-white" />
            </div>
            <h3 className="font-display font-bold text-lg">AI Insight</h3>
            <p className="text-sm text-white/60 mt-2">
              {data.aiInsight || "Monitor student performance regularly for the best results."}
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10 text-xs text-white/40">
            {data.totalStudents > 0 ? `Based on ${data.totalStudents} students` : "No data available"}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  tone?: "brand";
}) {
  return (
    <div className={`p-5 rounded-2xl border shadow-sm ${tone === "brand" ? "bg-brand text-white border-brand" : "bg-white border-stone-200"
      }`}>
      <div className="flex items-center justify-between mb-3">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${tone === "brand" ? "text-white/70" : "text-black/40"
          }`}>
          {label}
        </p>
        <Icon className={`size-4 ${tone === "brand" ? "text-white/80" : "text-black/30"}`} />
      </div>
      <p className="font-display text-3xl font-extrabold tracking-tight">{value}</p>
      <p className={`mt-1 text-[11px] font-semibold ${tone === "brand" ? "text-white/70" : "text-brand"
        }`}>
        {hint}
      </p>
    </div>
  );
}