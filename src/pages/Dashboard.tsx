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
//         <p className="text-sm text-black/60 mt-1">Here's what's happening across BCHS DOUALA today.</p>
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
//           <div className="h-64"><ResponsiveContainer><BarChart data={data.classAvgs}><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis domain={[0, 20]} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="avg" fill="#155DAA" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
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
//           <div className="h-56"><ResponsiveContainer><LineChart data={data.trend}><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="sequence" tick={{ fontSize: 11 }} /><YAxis domain={[0, 20]} tick={{ fontSize: 11 }} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Line type="monotone" dataKey="average" stroke="#155DAA" strokeWidth={3} dot={{ r: 5 }} connectNulls /></LineChart></ResponsiveContainer></div>
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

















import { useEffect, useState } from "react";
import { Users, GraduationCap, Wallet, TrendingUp, Award, AlertCircle, Loader2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from "recharts";
import axios from "axios";
import { toast } from "sonner";
import { currentUser } from "@/lib/auth";
import { getStoredSchoolSection } from "@/lib/schoolSystem";

const API_BASE = import.meta.env.VITE_API_URL ?? "https://manfess-back.onrender.com/api";

interface DashboardSummary {
  totalStudents: number;
  totalTeachers: number;
  totalClasses: number;
  totalFeesPaid: number;
  totalFeesDue: number;
  passRate: number;
  classAvgs: { name: string; avg: number }[];
  bestClass: { name: string; avg: number } | null;
  subjectAvgs: { name: string; avg: number }[];
  bestSubject: { name: string; avg: number } | null;
  top: { id: string; avg: number; rank: number; student: { fullName: string; department: string } }[];
  trend: { sequence: string; average: number | null }[];
  aiInsight: string;
}

const EMPTY_DASHBOARD: DashboardSummary = {
  totalStudents: 0,
  totalTeachers: 0,
  totalClasses: 0,
  totalFeesPaid: 0,
  totalFeesDue: 0,
  passRate: 0,
  classAvgs: [],
  bestClass: null,
  subjectAvgs: [],
  bestSubject: null,
  top: [],
  trend: [],
  aiInsight: "Monitor student performance regularly for the best results.",
};

export function Dashboard() {
  const user = currentUser();
  const isTeacher = user?.role === "teacher";
  const labels = {
    welcome: "Welcome back",
    subtitle: "Here's what's happening across the school portal today.",
    totalStudents: "Total Students",
    teachers: "Teachers",
    feesCollected: "Fees Collected",
    passRate: "Pass Rate",
    activeStudents: "Active students",
    classes: "classes",
    outstanding: "outstanding",
    avg: "Average / 20",
    classAverages: "Class Averages",
    subjectAverages: "Subject Averages",
    shown: "shown",
    best: "Best",
    classesButton: "Classes",
    subjectsButton: "Subjects",
    excellenceBoard: "Excellence Board",
    topStudents: "Top performing students",
    noData: "No data available",
    noClassData: "No class data available",
    noSubjectData: "No subject data available",
    noTrendData: "No sequence data available",
    trendTitle: "Sequence Performance Trend",
    aiInsight: "AI Insight",
    basedOn: "Based on",
    students: "students",
    retry: "Retry",
    updating: "Updating dashboard summary…",
    live: "Live",
  };

  const [data, setData] = useState<DashboardSummary>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [performanceView, setPerformanceView] = useState<"classes" | "subjects">("classes");

  const fetchData = async () => {
    try {
      setLoadError("");
      const response = await axios.get(`${API_BASE}/marks/dashboard-summary`);
      if (!response.data.success) throw new Error(response.data.message || "Dashboard summary unavailable");
      setData({ ...EMPTY_DASHBOARD, ...response.data.data });
    } catch (error: any) {
      console.error("Error fetching data:", error);
      setLoadError(error.response?.data?.message || error.message || "Dashboard data could not be loaded.");
      toast.error(error.response?.data?.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{labels.welcome}</h1>
        <p className="text-sm text-black/60 mt-1">{labels.subtitle}</p>
      </div>

      {loading && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          <Loader2 className="size-4 animate-spin" />
          {labels.updating}
        </div>
      )}
      {loadError && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          <span>{loadError}</span>
          <button onClick={() => void fetchData()} className="font-bold underline underline-offset-2">{labels.retry}</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          icon={Users}
          label={labels.totalStudents}
          value={data.totalStudents.toLocaleString()}
          hint={labels.activeStudents}
        />
        <Kpi
          icon={GraduationCap}
          label={labels.teachers}
          value={data.totalTeachers.toString()}
          hint={`${data.totalClasses} ${labels.classes}`}
        />
        <Kpi
          icon={Wallet}
          label={labels.feesCollected}
          value={`${(data.totalFeesPaid / 1_000_000).toFixed(1)}M XAF`}
          hint={`${(data.totalFeesDue / 1_000_000).toFixed(1)}M ${labels.outstanding}`}
          tone="brand"
        />
        <Kpi
          icon={TrendingUp}
          label={labels.passRate}
          value={`${data.passRate.toFixed(1)}%`}
          hint="Avg ≥ 10/20"
        />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div>
              <h3 className="font-display font-bold">{performanceView === "classes" ? labels.classAverages : labels.subjectAverages}</h3>
              <p className="text-xs text-black/50 mt-0.5">{labels.avg} · {performanceView === "classes" ? data.classAvgs.length : data.subjectAvgs.length} {labels.shown}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-1">
                <button
                  type="button"
                  onClick={() => setPerformanceView("classes")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${performanceView === "classes" ? "bg-white text-brand shadow-sm" : "text-black/55 hover:text-black"}`}
                >
                  {labels.classesButton}
                </button>
                <button
                  type="button"
                  onClick={() => setPerformanceView("subjects")}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${performanceView === "subjects" ? "bg-white text-brand shadow-sm" : "text-black/55 hover:text-black"}`}
                >
                  {labels.subjectsButton}
                </button>
              </div>
              {(performanceView === "classes" ? data.bestClass : data.bestSubject) && (
                <div className="flex items-center gap-1.5 text-xs bg-brand/10 text-brand px-3 py-1.5 rounded-full font-bold">
                  <Award className="size-3.5" />
                  {labels.best}: {performanceView === "classes" ? data.bestClass?.name : data.bestSubject?.name}
                  {" · "}{performanceView === "classes" ? data.bestClass?.avg : data.bestSubject?.avg}
                </div>
              )}
            </div>
          </div>
          {((performanceView === "classes" ? data.classAvgs : data.subjectAvgs).length > 0) ? (
            <div className="max-h-[420px] overflow-y-auto overflow-x-hidden pr-2">
              <ResponsiveContainer
                width="100%"
                height={Math.max(260, (performanceView === "classes" ? data.classAvgs : data.subjectAvgs).length * 38)}
              >
                <BarChart
                  data={[...(performanceView === "classes" ? data.classAvgs : data.subjectAvgs)].sort((a, b) => b.avg - a.avg)}
                  layout="vertical"
                  margin={{ top: 4, right: 20, bottom: 4, left: 4 }}
                  barCategoryGap={8}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                  <XAxis type="number" domain={[0, 20]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={140} interval={0} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)} / 20`, "Average"]} />
                  <Bar dataKey="avg" fill="#155DAA" radius={[0, 6, 6, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-black/40">
              {performanceView === "classes" ? labels.noClassData : labels.noSubjectData}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <h3 className="font-display font-bold mb-1">{labels.excellenceBoard}</h3>
          <p className="text-xs text-black/50 mb-4">{labels.topStudents}</p>
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
              <div className="text-center text-black/40 py-8">{labels.noData}</div>
            )}
          </div>
        </div>
      </div>

      {/* Trend and AI Insight */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <h3 className="font-display font-bold mb-4">{labels.trendTitle}</h3>
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
                    stroke="#155DAA"
                    strokeWidth={3}
                    dot={{ r: 5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-black/40">
              {labels.noTrendData}
            </div>
          )}
        </div>

        <div className="bg-[#121212] text-white rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="size-10 bg-brand rounded-lg grid place-items-center mb-4">
              <AlertCircle className="size-5 text-white" />
            </div>
            <h3 className="font-display font-bold text-lg">{labels.aiInsight}</h3>
            <p className="text-sm text-white/60 mt-2">
              {data.aiInsight || "Monitor student performance regularly for the best results."}
            </p>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10 text-xs text-white/40">
            {data.totalStudents > 0 ? `${labels.basedOn} ${data.totalStudents} ${labels.students}` : labels.noData}
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
    <div className={`min-w-0 p-3 sm:p-5 rounded-2xl border shadow-sm ${tone === "brand" ? "bg-brand text-white border-brand" : "bg-white border-stone-200"
      }`}>
      <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
        <p className={`text-[10px] font-bold uppercase tracking-widest ${tone === "brand" ? "text-white/70" : "text-black/40"
          }`}>
          {label}
        </p>
        <Icon className={`size-4 shrink-0 ${tone === "brand" ? "text-white/80" : "text-black/30"}`} />
      </div>
      <p className="min-w-0 break-words font-display text-lg leading-tight font-extrabold tracking-tight sm:text-2xl lg:text-3xl">{value}</p>
      <p className={`mt-1 text-[11px] font-semibold ${tone === "brand" ? "text-white/70" : "text-brand"
        }`}>
        {hint}
      </p>
    </div>
  );
}