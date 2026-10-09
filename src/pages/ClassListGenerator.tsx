import { Fragment, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, GraduationCap, Users } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

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
    registrationDate: string;
}

interface Subject {
    id: string;
    name: string;
    code: string;
    coefficient: number;
    classIds: string[];
}

interface Mark {
    studentId: string;
    subjectId: string;
    classId: string;
    sequence: string;
    academicyear: string;
    score: number;
}

interface SchoolClass {
    id: string;
    className: string;
    department: string;
    cycle: string;
    acedemicYear: string;
    tuitionFee: number;
    tuitionInstallments: number;
    registrationFeeRequired: boolean;
    registrationFeeAmount: number;
    section?: string;
}

const TERMS = [
    { label: "First Term", sequences: ["1st seq", "2nd seq"] },
    { label: "Second Term", sequences: ["3rd seq", "4th seq"] },
    { label: "Third Term", sequences: ["5th seq", "6th seq"] },
] as const;

function escapeCsv(value: string | number | undefined | null): string {
    const safe = String(value ?? "").replace(/\r?\n/g, " ").trim();
    return `"${safe.replace(/"/g, '""')}"`;
}

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        || "class";
}

function classLabel(schoolClass: SchoolClass): string {
    return [schoolClass.className, schoolClass.department, schoolClass.section]
        .filter(Boolean)
        .join(" · ");
}

function downloadFile(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function gradeFor(score: number | null): string {
    if (score === null) return "—";
    if (score >= 18) return "A";
    if (score >= 16) return "B";
    if (score >= 14) return "C";
    if (score >= 12) return "D";
    if (score >= 10) return "E";
    return "F";
}

function columnLetter(columnNumber: number): string {
    let result = "";
    let current = columnNumber;
    while (current > 0) {
        const remainder = (current - 1) % 26;
        result = String.fromCharCode(65 + remainder) + result;
        current = Math.floor((current - 1) / 26);
    }
    return result;
}

export function ClassListGeneratorPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [marks, setMarks] = useState<Mark[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [selectedClassId, setSelectedClassId] = useState("");
    const [selectedTerm, setSelectedTerm] = useState<(typeof TERMS)[number]["label"]>("First Term");
    const [loading, setLoading] = useState(true);
    const [classDataLoading, setClassDataLoading] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const [classesRes, subjectsRes] = await Promise.all([
                    axios.get(`${API_BASE}/classes`),
                    axios.get(`${API_BASE}/subjects`),
                ]);

                if (classesRes.data.success) {
                    const mappedClasses = classesRes.data.data.map((schoolClass: any) => ({
                        ...schoolClass,
                        id: schoolClass._id || schoolClass.id,
                        tuitionFee: Number(schoolClass.tuitionFee) || 0,
                        tuitionInstallments: Number(schoolClass.tuitionInstallments) || 1,
                        registrationFeeRequired: Boolean(schoolClass.registrationFeeRequired),
                        registrationFeeAmount: Number(schoolClass.registrationFeeAmount) || 0,
                    }));
                    setClasses(mappedClasses);
                    setSelectedClassId((current) => current || mappedClasses[0]?.id || "");
                }

                if (subjectsRes.data.success) {
                    setSubjects(subjectsRes.data.data.map((subject: any) => ({
                        ...subject,
                        id: subject._id || subject.id,
                        classIds: (subject.classIds || []).map(String),
                        coefficient: Number(subject.coefficient) || 1,
                    })));
                }

            } catch (error: any) {
                console.error("Unable to load class list data", error);
                toast.error(error.response?.data?.message || "Failed to load class list data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);
    const selectedClass = useMemo(
        () => classes.find((schoolClass) => schoolClass.id === selectedClassId) ?? null,
        [classes, selectedClassId],
    );

    useEffect(() => {
        if (!selectedClassId || !selectedClass) {
            setStudents([]);
            setMarks([]);
            setClassDataLoading(false);
            return;
        }

        let cancelled = false;
        setClassDataLoading(true);
        Promise.all([
            axios.get(`${API_BASE}/students/class/${selectedClassId}`),
            axios.get(`${API_BASE}/marks`, {
                params: {
                    classId: selectedClassId,
                    academicYear: selectedClass.acedemicYear,
                },
            }),
        ]).then(([studentsRes, marksRes]) => {
            if (cancelled) return;
            if (studentsRes.data.success) {
                setStudents(studentsRes.data.data.map((student: any) => ({
                    ...student,
                    id: String(student._id || student.id),
                    classId: String(student.classId),
                })));
            }
            if (marksRes.data.success) {
                setMarks(marksRes.data.data.map((mark: any) => ({
                    ...mark,
                    studentId: String(mark.studentId),
                    subjectId: String(mark.subjectId),
                    classId: String(mark.classId),
                    academicyear: mark.academicyear || mark.academicYear || "",
                    score: Number(mark.score),
                })));
            }
        }).catch((error: any) => {
            if (!cancelled) {
                console.error("Unable to load selected class marksheet", error);
                toast.error(error.response?.data?.message || "Failed to load this class marksheet");
            }
        }).finally(() => {
            if (!cancelled) setClassDataLoading(false);
        });

        return () => { cancelled = true; };
    }, [selectedClassId, selectedClass?.acedemicYear]);

    const classStudents = useMemo(
        () => students
            .filter((student) => String(student.classId) === selectedClassId)
            .sort((first, second) => first.fullName.localeCompare(second.fullName)),
        [students, selectedClassId],
    );

    const termConfig = TERMS.find((term) => term.label === selectedTerm) ?? TERMS[0];
    const classSubjects = useMemo(
        () => subjects
            .filter((subject) => subject.classIds.includes(selectedClassId))
            .sort((first, second) => first.name.localeCompare(second.name)),
        [subjects, selectedClassId],
    );

    const classTermMarks = useMemo(
        () => marks.filter((mark) =>
            mark.classId === selectedClassId
            && termConfig.sequences.includes(mark.sequence)
            && (!selectedClass?.acedemicYear || !mark.academicyear || mark.academicyear === selectedClass.acedemicYear)
        ),
        [marks, selectedClassId, selectedClass, termConfig],
    );

    const reports = useMemo(() => {
        const unranked = classStudents.map((student) => {
            let weightedTotal = 0;
            let coefficientTotal = 0;
            const subjectScores = classSubjects.map((subject) => {
                const scores = termConfig.sequences.map((sequence) => {
                    const mark = classTermMarks.find((entry) =>
                        entry.studentId === student.id
                        && entry.subjectId === subject.id
                        && entry.sequence === sequence
                    );
                    return mark ? mark.score : null;
                });
                const presentScores = scores.filter((score): score is number => score !== null);
                const average = presentScores.length
                    ? presentScores.reduce((total, score) => total + score, 0) / presentScores.length
                    : null;

                if (average !== null) {
                    weightedTotal += average * subject.coefficient;
                    coefficientTotal += subject.coefficient;
                }

                return { subject, scores, average };
            });

            return {
                student,
                subjectScores,
                weightedTotal,
                coefficientTotal,
                average: coefficientTotal ? weightedTotal / coefficientTotal : null,
                rank: null as number | null,
            };
        });

        const ranked = [...unranked]
            .filter((report) => report.average !== null)
            .sort((first, second) => (second.average ?? 0) - (first.average ?? 0));
        let previousAverage: number | null = null;
        let previousRank = 0;
        ranked.forEach((report, index) => {
            const average = report.average ?? 0;
            if (previousAverage === null || average.toFixed(2) !== previousAverage.toFixed(2)) {
                previousRank = index + 1;
                previousAverage = average;
            }
            const target = unranked.find((candidate) => candidate.student.id === report.student.id);
            if (target) target.rank = previousRank;
        });

        return unranked;
    }, [classStudents, classSubjects, classTermMarks, termConfig]);

    const expectedMarks = classStudents.length * classSubjects.length * termConfig.sequences.length;
    const marksEntered = classTermMarks.filter((mark) => classSubjects.some((subject) => subject.id === mark.subjectId)).length;
    const reportsWithMarks = reports.filter((report) => report.average !== null);
    const classAverage = reportsWithMarks.length
        ? reportsWithMarks.reduce((total, report) => total + (report.average ?? 0), 0) / reportsWithMarks.length
        : null;

    const exportHeaders = [
        "Rank",
        "Matricule",
        "Student Name",
        ...classSubjects.flatMap((subject) => [
            ...termConfig.sequences.map((sequence) => `${subject.code} ${subject.name} - ${sequence}`),
            `${subject.code} ${subject.name} - Term Average`,
        ]),
        "Total Coefficient",
        "Weighted Average (/20)",
        "Grade",
    ];

    const reportRow = (report: (typeof reports)[number]) => [
        report.rank ?? "",
        report.student.matricule || "",
        report.student.fullName,
        ...report.subjectScores.flatMap((subjectScore) => [
            ...subjectScore.scores.map((score) => score ?? ""),
            subjectScore.average === null ? "" : subjectScore.average.toFixed(2),
        ]),
        report.coefficientTotal || "",
        report.average === null ? "" : report.average.toFixed(2),
        gradeFor(report.average),
    ];

    const exportCsv = () => {
        if (!selectedClass) {
            toast.error("Choose a class before exporting");
            return;
        }

        if (classStudents.length === 0) {
            toast.error("There are no students in this class to export");
            return;
        }

        if (classSubjects.length === 0) {
            toast.error("No subjects are assigned to this class");
            return;
        }

        const metadata = [
            ["Term", selectedTerm],
            ["Class", selectedClass.className],
            ["Department", selectedClass.department],
            ["Academic Year", selectedClass.acedemicYear],
            [],
        ];
        const csv = [...metadata, exportHeaders, ...reports.map(reportRow)]
            .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
            .join("\n");

        const blob = new Blob(["\uFEFF", csv.replace(/\n/g, "\r\n")], { type: "text/csv;charset=utf-8;" });
        downloadFile(
            blob,
            `${slugify(selectedTerm)}-${slugify(selectedClass.className)}-${slugify(selectedClass.department)}-marksheet.csv`,
        );

        toast.success("Term marksheet exported to CSV");
    };

    const exportExcel = async () => {
        if (!selectedClass) {
            toast.error("Choose a class before exporting");
            return;
        }

        if (classStudents.length === 0) {
            toast.error("There are no students in this class to export");
            return;
        }

        if (classSubjects.length === 0) {
            toast.error("No subjects are assigned to this class");
            return;
        }

        try {
            const { Workbook } = await import("exceljs");
            const workbook = new Workbook();
            const isThirdTerm = selectedTerm === "Third Term";
            const headers = isThirdTerm
                ? ["Matricule", "Student Name", "First Term Mark", "Second Term Mark", ...termConfig.sequences, "Third Term Mark"]
                : ["Matricule", "Student Name", ...termConfig.sequences];
            const lastColumn = columnLetter(headers.length);
            const usedWorksheetNames = new Set<string>();

            for (const subject of classSubjects) {
                const baseName = `${subject.code} ${subject.name}`
                    .replace(/[\\/*?:\[\]]/g, "")
                    .slice(0, 31) || "Subject";
                let worksheetName = baseName;
                let suffix = 2;
                while (usedWorksheetNames.has(worksheetName)) {
                    const suffixText = ` (${suffix})`;
                    worksheetName = `${baseName.slice(0, 31 - suffixText.length)}${suffixText}`;
                    suffix += 1;
                }
                usedWorksheetNames.add(worksheetName);

                const worksheet = workbook.addWorksheet(worksheetName, {
                    properties: { defaultRowHeight: 22 },
                    views: [{ state: "frozen", ySplit: 7, xSplit: 2 }],
                });
                worksheet.columns = headers.map((_, index) => ({ width: index === 0 ? 22 : index === 1 ? 30 : 20 }));
                worksheet.mergeCells(`A1:${lastColumn}1`);
                worksheet.getCell("A1").value = `${subject.code} · ${subject.name} MARKSHEET`;
                worksheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123B35" } };
                worksheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
                worksheet.getCell("A1").alignment = { vertical: "middle", horizontal: "left", indent: 1 };
                worksheet.getRow(1).height = 34;

                worksheet.mergeCells(`A2:${lastColumn}2`);
                worksheet.getCell("A2").value = classLabel(selectedClass);
                worksheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5F2EE" } };
                worksheet.getCell("A2").font = { bold: true, size: 12, color: { argb: "FF123B35" } };
                worksheet.getCell("A2").alignment = { vertical: "middle", horizontal: "left", indent: 1 };
                worksheet.getRow(2).height = 28;

                worksheet.getCell("A3").value = "TERM";
                worksheet.getCell("B3").value = selectedTerm;
                worksheet.getCell("A4").value = "ACADEMIC YEAR";
                worksheet.getCell("B4").value = selectedClass.acedemicYear;
                worksheet.getCell("D3").value = "COEFFICIENT";
                worksheet.getCell("E3").value = subject.coefficient;
                ["A3", "A4", "D3"].forEach((address) => {
                    worksheet.getCell(address).font = { bold: true, color: { argb: "FF52736C" }, size: 9 };
                });
                ["B3", "B4", "E3"].forEach((address) => {
                    worksheet.getCell(address).font = { bold: true, color: { argb: "FF172A26" } };
                });

                const subjectMarks = marks.filter((mark) =>
                    mark.classId === selectedClassId
                    && mark.subjectId === subject.id
                    && (!selectedClass.acedemicYear || !mark.academicyear || mark.academicyear === selectedClass.acedemicYear)
                );
                const averageFor = (studentId: string, sequences: readonly string[]) => {
                    const scores = sequences
                        .map((sequence) => subjectMarks.find((mark) => mark.studentId === studentId && mark.sequence === sequence)?.score)
                        .filter((score): score is number => score !== undefined);
                    return scores.length ? scores.reduce((total, score) => total + score, 0) / scores.length : null;
                };
                const marksEnteredForSubject = subjectMarks.filter((mark) => termConfig.sequences.includes(mark.sequence)).length;
                worksheet.mergeCells(`A5:${lastColumn}5`);
                worksheet.getCell("A5").value = `${classStudents.length} students · ${marksEnteredForSubject}/${classStudents.length * termConfig.sequences.length} sequence marks entered`;
                worksheet.getCell("A5").font = { italic: true, color: { argb: "FF52736C" } };
                worksheet.getCell("A5").alignment = { vertical: "middle", horizontal: "left", indent: 1 };

                worksheet.addRow([]);
                const headerRow = worksheet.addRow(headers);
                headerRow.height = 28;
                headerRow.eachCell((cell) => {
                    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F6B5D" } };
                    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
                    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
                    cell.border = { bottom: { style: "medium", color: { argb: "FF123B35" } } };
                });

                for (const [index, student] of classStudents.entries()) {
                    const sequenceScores = termConfig.sequences.map((sequence) =>
                        subjectMarks.find((mark) => mark.studentId === student.id && mark.sequence === sequence)?.score ?? ""
                    );
                    const rowValues = isThirdTerm
                        ? [
                            student.matricule || "",
                            student.fullName,
                            averageFor(student.id, TERMS[0].sequences)?.toFixed(2) ?? "",
                            averageFor(student.id, TERMS[1].sequences)?.toFixed(2) ?? "",
                            ...sequenceScores,
                            averageFor(student.id, termConfig.sequences)?.toFixed(2) ?? "",
                        ]
                        : [student.matricule || "", student.fullName, ...sequenceScores];
                    const row = worksheet.addRow(rowValues);
                    row.eachCell((cell) => {
                        cell.alignment = { vertical: "middle", wrapText: true };
                        if (index % 2 === 1) {
                            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F7F5" } };
                        }
                        cell.border = { bottom: { style: "hair", color: { argb: "FFDCE8E4" } } };
                    });
                }

                worksheet.autoFilter = `A7:${lastColumn}7`;
            }

            const buffer = await workbook.xlsx.writeBuffer();
            downloadFile(
                new Blob([new Uint8Array(buffer)], {
                    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                }),
                `${slugify(selectedTerm)}-${slugify(selectedClass.className)}-${slugify(selectedClass.department)}-marksheet.xlsx`,
            );
            toast.success("Styled term marksheet exported to Excel");
        } catch (error) {
            console.error("Unable to export styled class list", error);
            toast.error("Failed to export the styled Excel marksheet");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 rounded-3xl border border-stone-200 bg-gradient-to-br from-[#121212] via-[#1b1b1b] to-[#2a2a2a] p-6 text-white shadow-sm lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.25em] text-white/60">Academic records</p>
                    <h1 className="text-3xl font-black tracking-tight">Generate class marksheet</h1>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={exportExcel}
                        disabled={loading || classDataLoading || !selectedClass || classStudents.length === 0 || classSubjects.length === 0}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#a6e3cf] px-4 py-2.5 text-sm font-semibold text-[#123b35] transition hover:bg-[#b8eddd] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <FileSpreadsheet className="size-4" />
                        Styled Excel
                    </button>
                    <button
                        onClick={exportCsv}
                        disabled={loading || classDataLoading || !selectedClass || classStudents.length === 0 || classSubjects.length === 0}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#121212] transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Download className="size-4" />
                        Export CSV
                    </button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-stone-500">Selected term</span>
                        <FileSpreadsheet className="size-4 text-brand" />
                    </div>
                    <div className="mt-3">
                        <select
                            value={selectedTerm}
                            onChange={(event) => setSelectedTerm(event.target.value as (typeof TERMS)[number])}
                            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-medium outline-none focus:border-brand"
                        >
                            {TERMS.map((term) => (
                                <option key={term.label} value={term.label}>{term.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:col-span-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-stone-500">Class</span>
                        <GraduationCap className="size-4 text-brand" />
                    </div>
                    <div className="mt-3">
                        <select
                            value={selectedClassId}
                            onChange={(event) => setSelectedClassId(event.target.value)}
                            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-medium outline-none focus:border-brand"
                        >
                            {classes.length === 0 && <option value="">No classes available</option>}
                            {classes.map((schoolClass) => (
                                <option key={schoolClass.id} value={schoolClass.id}>{classLabel(schoolClass)}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="text-sm text-stone-500">Students</div>
                    <div className="mt-3 text-3xl font-black tracking-tight">{classStudents.length}</div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="text-sm text-stone-500">Subjects</div>
                    <div className="mt-3 text-3xl font-black tracking-tight">{classSubjects.length}</div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="text-sm text-stone-500">Marks entered</div>
                    <div className="mt-3 text-3xl font-black tracking-tight">{marksEntered}<span className="text-base font-medium text-stone-400"> / {expectedMarks}</span></div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="text-sm text-stone-500">Class average</div>
                    <div className="mt-3 text-3xl font-black tracking-tight">{classAverage === null ? "—" : `${classAverage.toFixed(2)}/20`}</div>
                </div>
            </div>

            <div className="rounded-3xl border border-stone-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-stone-200 bg-stone-50 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <Users className="size-5 text-brand" />
                        <div>
                            <h2 className="text-lg font-bold">{selectedTerm} Marksheet</h2>
                            <p className="text-sm text-stone-500">{selectedClass ? `${classLabel(selectedClass)} • ${selectedTerm}` : "Choose a class"}</p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="p-8 text-sm text-stone-500">Loading class options...</div>
                ) : classDataLoading ? (
                    <div className="p-8 text-sm text-stone-500">Loading students and marks for this class...</div>
                ) : !selectedClass ? (
                    <div className="p-8 text-sm text-stone-500">No class selected.</div>
                ) : classStudents.length === 0 ? (
                    <div className="p-8 text-sm text-stone-500">No students available for this class.</div>
                ) : classSubjects.length === 0 ? (
                    <div className="p-8 text-sm text-stone-500">No subjects are assigned to this class yet.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-max text-left text-sm">
                            <thead className="bg-stone-50 text-stone-700">
                                <tr>
                                    <th rowSpan={2} className="sticky left-0 z-20 bg-stone-100 px-3 py-3 font-semibold">Rank</th>
                                    <th rowSpan={2} className="sticky left-10 z-20 bg-stone-100 px-4 py-3 font-semibold">Student</th>
                                    {classSubjects.map((subject) => (
                                        <th key={subject.id} colSpan={termConfig.sequences.length + 1} className="border-l border-stone-200 bg-[#e5f2ee] px-3 py-3 text-center font-bold text-[#123b35]">
                                            {subject.code} · {subject.name} <span className="font-normal">(×{subject.coefficient})</span>
                                        </th>
                                    ))}
                                    <th rowSpan={2} className="border-l border-stone-200 px-3 py-3 font-semibold">Total Coef.</th>
                                    <th rowSpan={2} className="px-3 py-3 font-semibold">Average /20</th>
                                    <th rowSpan={2} className="px-3 py-3 font-semibold">Grade</th>
                                </tr>
                                <tr>
                                    {classSubjects.map((subject) => (
                                        <Fragment key={subject.id}>
                                            {termConfig.sequences.map((sequence) => (
                                                <th key={sequence} className="border-l border-stone-200 px-3 py-2 text-center text-xs font-semibold">{sequence}</th>
                                            ))}
                                            <th className="border-l border-stone-200 px-3 py-2 text-center text-xs font-bold">Term Avg</th>
                                        </Fragment>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {reports.map((report) => (
                                    <tr key={report.student.id} className="border-t border-stone-200 even:bg-stone-50/70">
                                        <td className="sticky left-0 z-10 bg-inherit px-3 py-3 text-center font-semibold">{report.rank ?? "—"}</td>
                                        <td className="sticky left-10 z-10 bg-inherit px-4 py-3 font-semibold text-stone-900">{report.student.fullName}</td>
                                        {report.subjectScores.map((subjectScore) => (
                                            <Fragment key={subjectScore.subject.id}>
                                                {subjectScore.scores.map((score, index) => (
                                                    <td key={index} className="border-l border-stone-100 px-3 py-3 text-center tabular-nums">{score ?? "—"}</td>
                                                ))}
                                                <td className="border-l border-stone-100 px-3 py-3 text-center font-semibold tabular-nums">{subjectScore.average === null ? "—" : subjectScore.average.toFixed(2)}</td>
                                            </Fragment>
                                        ))}
                                        <td className="border-l border-stone-200 px-3 py-3 text-center tabular-nums">{report.coefficientTotal || "—"}</td>
                                        <td className="px-3 py-3 text-center font-bold tabular-nums">{report.average === null ? "—" : report.average.toFixed(2)}</td>
                                        <td className="px-3 py-3 text-center font-bold">{gradeFor(report.average)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
