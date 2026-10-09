import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Save, RefreshCw } from "lucide-react";
import { CompactPageLoader } from "@/components/CompactPageLoader";
import axios from "axios";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL ?? "https://manfess-back.onrender.com/api";

type AttendanceStatus = "present" | "absent" | "late" | "excused";

type Student = {
    id: string;
    fullName: string;
    gender?: string;
    classId?: string;
    department?: string;
    matricule?: string;
    admissionNumber?: string;
};

type ClassItem = {
    id: string;
    className?: string;
    name?: string;
    acedemicYear?: string;
    academicYear?: string;
};

const statusMeta: Record<AttendanceStatus, { label: string; color: string }> = {
    present: { label: "Present", color: "bg-emerald-600 text-white" },
    absent: { label: "Absent", color: "bg-red-600 text-white" },
    late: { label: "Late", color: "bg-amber-500 text-slate-900" },
    excused: { label: "Excused", color: "bg-sky-600 text-white" },
};

const formatDateInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const getWeekdays = (dateValue: string) => {
    const [year, month, day] = dateValue.split("-").map(Number);
    const monday = new Date(year, month - 1, day);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

    return Array.from({ length: 5 }, (_, index) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        return {
            value: formatDateInput(date),
            dayName: date.toLocaleDateString(undefined, { weekday: "long" }),
            shortDate: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        };
    });
};

export function StudentAttendancePage() {
    const today = formatDateInput(new Date());
    const [classes, setClasses] = useState<ClassItem[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>("");
    const [selectedDate, setSelectedDate] = useState<string>(today);
    const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const weekdays = useMemo(() => getWeekdays(selectedDate), [selectedDate]);

    const fetchClasses = async () => {
        try {
            const response = await axios.get(`${API_BASE}/classes`);
            if (response.data.success) {
                const mapped = response.data.data.map((item: any) => ({
                    ...item,
                    id: item._id || item.id,
                    className: item.className || item.name,
                }));
                setClasses(mapped);
                if (!selectedClassId && mapped[0]) setSelectedClassId(mapped[0].id);
            }
        } catch (error) {
            console.error("Error fetching classes", error);
            toast.error("Failed to load classes");
        }
    };

    const fetchStudents = async (classId: string) => {
        if (!classId) {
            setStudents([]);
            return;
        }

        try {
            const response = await axios.get(`${API_BASE}/students/class/${classId}`);
            if (response.data.success) {
                const mapped = response.data.data.map((item: any) => ({
                    ...item,
                    id: item._id || item.id,
                    admissionNumber: item.matricule || item.admissionNumber || "N/A",
                }));
                setStudents(mapped);
            }
        } catch (error) {
            console.error("Error fetching students", error);
            toast.error("Failed to load students");
        }
    };

    const syncAttendance = async () => {
        if (!selectedClassId) return;

        try {
            const response = await axios.get(`${API_BASE}/attendance/students`, {
                params: {
                    classId: selectedClassId,
                    from: weekdays[0].value,
                    to: weekdays[weekdays.length - 1].value,
                },
            });

            if (response.data.success) {
                const nextState: Record<string, AttendanceStatus> = {};
                for (const record of response.data.data || []) {
                    const date = new Date(record.date).toISOString().slice(0, 10);
                    nextState[`${String(record.studentId)}:${date}`] = (record.status || "present") as AttendanceStatus;
                }
                setAttendance(nextState);
            }
        } catch (error) {
            console.error("Error fetching attendance", error);
        }
    };

    useEffect(() => {
        const bootstrap = async () => {
            setLoading(true);
            await fetchClasses();
            setLoading(false);
        };

        void bootstrap();
    }, []);

    useEffect(() => {
        if (!selectedClassId) {
            setAttendance({});
            setStudents([]);
            return;
        }

        const loadClassStudents = async () => {
            setLoading(true);
            await fetchStudents(selectedClassId);
            await syncAttendance();
            setLoading(false);
        };

        void loadClassStudents();
    }, [selectedClassId]);

    useEffect(() => {
        if (selectedClassId) {
            void syncAttendance();
        } else {
            setAttendance({});
        }
    }, [selectedDate, selectedClassId]);

    const classStudents = useMemo(() => {
        return students
            .filter((student) => student.classId === selectedClassId)
            .sort((a, b) => a.fullName.localeCompare(b.fullName));
    }, [students, selectedClassId]);

    const attendanceStatuses = classStudents.flatMap((student) =>
        weekdays.filter((weekday) => weekday.value <= today)
            .map((weekday) => attendance[`${student.id}:${weekday.value}`])
    );
    const totalPresent = attendanceStatuses.filter((status) => status === "present").length;
    const totalAbsent = attendanceStatuses.filter((status) => !status || status === "absent").length;
    const totalLate = attendanceStatuses.filter((status) => status === "late").length;
    const totalExcused = attendanceStatuses.filter((status) => status === "excused").length;

    const handleStatusChange = (studentId: string, date: string, status: AttendanceStatus) => {
        setAttendance((prev) => ({ ...prev, [`${studentId}:${date}`]: status }));
    };

    const saveAttendance = async () => {
        if (!selectedClassId) {
            toast.error("Select a class before saving attendance");
            return;
        }

        setSaving(true);
        try {
            const academicYear = classes.find((item) => item.id === selectedClassId)?.acedemicYear
                || classes.find((item) => item.id === selectedClassId)?.academicYear
                || new Date().getFullYear().toString();

            const daysToSave = weekdays.filter((weekday) => weekday.value <= today);
            if (!daysToSave.length) {
                toast.error("There are no past or current weekdays to save");
                return;
            }

            const payload = classStudents.flatMap((student) => daysToSave.map((weekday) => {
                const month = new Date(`${weekday.value}T00:00:00`).getMonth();
                return {
                    studentId: student.id,
                    classId: selectedClassId,
                    date: weekday.value,
                    academicYear,
                    term: month >= 8 ? "first" : month <= 3 ? "second" : "third",
                    period: "day",
                    status: attendance[`${student.id}:${weekday.value}`] || "absent",
                    recordedBy: "admin",
                };
            }));

            await axios.post(`${API_BASE}/attendance/students/bulk`, payload);
            await syncAttendance();
            toast.success("Student attendance saved for the selected weekdays");
        } catch (error: any) {
            console.error("Error saving attendance", error);
            toast.error(error.response?.data?.message || "Could not save attendance");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <CompactPageLoader label="Loading student attendance..." />;
    }

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-black/45">Daily attendance</p>
                        <h1 className="mt-1 text-2xl font-display font-bold text-[#121212]">Student Attendance Register</h1>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2">
                            <CalendarDays className="size-4 text-black/60" />
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(event) => setSelectedDate(event.target.value)}
                                className="bg-transparent text-sm font-medium outline-none"
                                aria-label="Choose a date in the attendance week"
                            />
                            <span className="whitespace-nowrap text-xs text-black/50">Week: Mon–Fri</span>
                        </div>

                        <select
                            value={selectedClassId}
                            onChange={(event) => setSelectedClassId(event.target.value)}
                            className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-medium outline-none"
                        >
                            {classes.map((item) => (
                                <option key={item.id} value={item.id}>{item.className  + " " + item?.department}</option>
                            ))}
                        </select>

                        <button
                            onClick={saveAttendance}
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#121212] px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                        >
                            {saving ? <RefreshCw className="size-4 animate-spin" /> : <Save className="size-4" />}
                            {saving ? "Saving..." : "Save Attendance"}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <StatCard label="Present" value={totalPresent} tone="present" />
                <StatCard label="Absent" value={totalAbsent} tone="absent" />
                <StatCard label="Late" value={totalLate} tone="late" />
                <StatCard label="Excused" value={totalExcused} tone="excused" />
            </div>

            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                    <div className="min-w-[850px]">
                        <div className="grid grid-cols-[minmax(190px,2fr)_minmax(130px,1.3fr)_repeat(5,minmax(96px,1fr))] border-b border-stone-200 bg-stone-50 text-[11px] font-bold uppercase tracking-[0.12em] text-black/55">
                            <div className="px-4 py-3">Student</div>
                            <div className="px-4 py-3">Matricule</div>
                            {weekdays.map((weekday) => (
                                <div key={weekday.value} className="px-2 py-3 text-center">
                                    <div>{weekday.dayName}</div>
                                    <div className="mt-1 font-medium normal-case tracking-normal text-black/45">{weekday.shortDate}</div>
                                </div>
                            ))}
                        </div>

                        {classStudents.length === 0 ? (
                            <div className="px-4 py-10 text-center text-sm text-black/50">No students found for this class.</div>
                        ) : (
                            classStudents.map((student) => (
                                <div key={student.id} className="grid grid-cols-[minmax(190px,2fr)_minmax(130px,1.3fr)_repeat(5,minmax(96px,1fr))] border-b border-stone-200 last:border-b-0 text-sm">
                                    <div className="px-4 py-4">
                                        <div className="font-semibold text-[#121212]">{student.fullName}</div>
                                        <div className="text-xs text-black/45">{student.department || "General"}</div>
                                    </div>
                                    <div className="px-4 py-4 font-medium text-black/60">
                                        {student.matricule || student.admissionNumber || "—"}
                                    </div>
                                    {weekdays.map((weekday) => {
                                        const status = attendance[`${student.id}:${weekday.value}`];
                                        const checked = status === "present" || status === "late";
                                        const isFuture = weekday.value > today;
                                        return (
                                            <label key={weekday.value} className={`flex items-center justify-center border-l border-stone-100 ${isFuture ? "bg-stone-50" : ""}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    disabled={isFuture || saving}
                                                    aria-label={`${weekday.dayName} ${weekday.shortDate}: ${student.fullName} present`}
                                                    onChange={(event) => handleStatusChange(student.id, weekday.value, event.target.checked ? "present" : "absent")}
                                                    className="size-5 cursor-pointer accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-30"
                                                />
                                            </label>
                                        );
                                    })}
                                </div>
                            ))
                        )}
                    </div>
                </div>
                <div className="border-t border-stone-200 px-4 py-3 text-xs text-black/50">
                    Check a weekday to mark the student present. Unchecked past or current weekdays are saved as absent; future dates are calculated but cannot be marked yet.
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: AttendanceStatus }) {
    const style = statusMeta[tone];

    return (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-black/45">{label}</div>
                    <div className="mt-2 text-2xl font-display font-bold text-[#121212]">{value}</div>
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${style.color}`}>
                    {label}
                </span>
            </div>
        </div>
    );
}
