import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText, GraduationCap, Users } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";

const API_BASE = import.meta.env.VITE_API_URL ?? "https://manfess-back.onrender.com/api";

/* ─── MANFESS brand ──────────────────────────────────────────────────────── */
const SCHOOL_NAME = "M NDUM FAVOURED EVENING SECONDARY SCHOOL (MANFESS)";
const SCHOOL_SHORT = "MFS";
const GREEN = "#15803D";
const GREEN_DARK = "#14532D";
const GREEN_LIGHT = "#E8F5EC";
const GREEN_BORDER = "#BFE0CA";
const GOLD = "#d2ad4b";

/* PDF page geometry (A4 portrait at 800px wide → 1131px tall) */
const PAGE_W = 800;
const PAGE_H = 1131;
const ROWS_PER_PAGE = 28;

interface Student {
    id: string;
    fullName: string;
    matricule?: string;
    gender: string;
    classId: string;
}

interface SchoolClass {
    id: string;
    className: string;
    department: string;
    acedemicYear: string;
    section?: string;
}

const TERMS = [
    { label: "First Term", sequences: ["1st seq", "2nd seq"] },
    { label: "Second Term", sequences: ["3rd seq", "4th seq"] },
    { label: "Third Term", sequences: ["5th seq", "6th seq"] },
] as const;

type TermLabel = (typeof TERMS)[number]["label"];

/* ─── helpers ────────────────────────────────────────────────────────────── */

function escapeHtml(value: unknown): string {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character] || character);
}

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
    return [schoolClass.className, schoolClass.department].filter(Boolean).join(" · ");
}

function sexLabel(gender: string): string {
    return gender === "male" ? "M" : gender === "female" ? "F" : "";
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

/* ─── printable page (one A4 sheet of the class list) ────────────────────── */

function buildPageHtml(ctx: {
    schoolClass: SchoolClass;
    term: TermLabel;
    sequences: readonly string[];
    pageStudents: Student[];
    startIndex: number;
    pageNumber: number;
    totalPages: number;
    totalStudents: number;
}): string {
    const { schoolClass, term, sequences, pageStudents, startIndex, pageNumber, totalPages, totalStudents } = ctx;
    const cell = `border:1px solid ${GREEN_DARK};padding:0 6px;height:26px;font-size:10.5px;`;
    const headCell = `border:1px solid ${GREEN_DARK};padding:6px 4px;font-size:10px;font-weight:700;text-align:center;background:${GREEN};color:#fff;`;

    const rows = Array.from({ length: ROWS_PER_PAGE }, (_, slot) => {
        const student = pageStudents[slot];
        const blank = `<td style="${cell}"></td>`;
        return `
          <tr style="background:${slot % 2 === 1 ? "#F6FBF7" : "#ffffff"};">
            <td style="${cell}text-align:center;font-weight:600;">${student ? startIndex + slot + 1 : ""}</td>
            <td style="${cell}font-family:monospace;font-size:9.5px;">${student ? escapeHtml(student.matricule || "") : ""}</td>
            <td style="${cell}font-weight:600;">${student ? escapeHtml(student.fullName) : ""}</td>
            <td style="${cell}text-align:center;">${student ? sexLabel(student.gender) : ""}</td>
            ${sequences.map(() => blank).join("")}
          
          </tr>`;
    }).join("");

    const fillLine = (label: string, width: string) => `
      <div style="display:flex;align-items:flex-end;gap:6px;width:${width};">
        <span style="font-size:9.5px;font-weight:700;color:${GREEN_DARK};white-space:nowrap;text-transform:uppercase;letter-spacing:0.05em;">${label}</span>
        <span style="flex:1;border-bottom:1px dotted #333;height:14px;"></span>
      </div>`;

    return `
      <div style="box-sizing:border-box;width:${PAGE_W}px;height:${PAGE_H}px;display:flex;flex-direction:column;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;color:#14352A;background:#fff;border:1px solid ${GREEN_BORDER};border-top:8px solid ${GREEN};">
        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:center;padding:12px 16px;border-bottom:3px solid ${GOLD};font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">
          <div style="text-align:left;line-height:1.5;color:${GREEN};">
            République du Cameroun<br/>
            <span style="font-weight:600;font-style:italic;text-transform:none;color:#6b756d;">Paix — Travail — Patrie</span><br/>
            Ministère des Enseignements Secondaires
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:3px;max-width:250px;">
            <div style="width:46px;height:46px;border-radius:50%;background:${GREEN};border:3px solid ${GOLD};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:900;">${SCHOOL_SHORT}</div>
            <div style="font-size:10.5px;font-weight:900;color:${GREEN};text-transform:none;text-align:center;line-height:1.25;">${SCHOOL_NAME}</div>
          </div>
          <div style="text-align:right;line-height:1.5;color:${GREEN};">
            Republic of Cameroon<br/>
            <span style="font-weight:600;font-style:italic;text-transform:none;color:#6b756d;">Peace — Work — Fatherland</span><br/>
            Ministry of Secondary Education
          </div>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;margin:12px 16px 8px;padding:8px 14px;background:${GREEN_LIGHT};border-left:5px solid ${GREEN};">
          <div style="font-size:16px;font-weight:800;color:${GREEN};text-transform:uppercase;">Class List · ${escapeHtml(term)}</div>
          <div style="text-align:right;font-size:9.5px;font-weight:700;color:#52665a;">ACADEMIC YEAR<br/><span style="font-size:12.5px;color:#183328;">${escapeHtml(schoolClass.acedemicYear || "—")}</span></div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px 18px;margin:0 16px 8px;font-size:10.5px;">
          <div><b style="color:#718076;">CLASS</b><br/><span style="font-weight:700;color:#183328;">${escapeHtml(schoolClass.className)}</span></div>
          <div><b style="color:#718076;">DEPARTMENT</b><br/><span style="font-weight:700;color:#183328;">${escapeHtml(schoolClass.department || "—")}</span></div>
          <div><b style="color:#718076;">ENROLLED STUDENTS</b><br/><span style="font-weight:700;color:#183328;">${totalStudents}</span></div>
        </div>

        <div style="display:flex;gap:18px;margin:2px 16px 10px;">
          ${fillLine("Subject", "42%")}
          ${fillLine("Teacher", "38%")}
          ${fillLine("Date", "20%")}
        </div>

        <div style="margin:0 16px;">
          <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
            <colgroup>
              <col style="width:6%;"/><col style="width:16%;"/><col style="width:38%;"/><col style="width:6%;"/>
              ${sequences.map(() => `<col style="width:${(100 - 6 - 16 - 38 - 6) / sequences.length}%;"/>`).join("")}
            </colgroup>
            <thead>
              <tr>
                <th style="${headCell}">N°</th>
                <th style="${headCell}">Matricule</th>
                <th style="${headCell}text-align:left;padding-left:8px;">Full name</th>
                <th style="${headCell}">Sex</th>
                ${sequences.map((sequence) => `<th style="${headCell}">${escapeHtml(sequence)}<br/><span style="font-weight:500;font-size:8.5px;">/20</span></th>`).join("")}
               
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>

        <div style="margin-top:auto;padding:0 16px 10px;">
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;text-align:center;font-size:10px;margin-bottom:8px;">
            <div><div style="height:22px;border-bottom:1px dashed #000;"></div><div style="margin-top:3px;font-weight:600;">Subject Teacher</div></div>
            <div><div style="height:22px;border-bottom:1px dashed #000;"></div><div style="margin-top:3px;font-weight:600;">Class Master</div></div>
            <div><div style="height:22px;border-bottom:1px dashed #000;"></div><div style="margin-top:3px;font-weight:600;">Principal</div></div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid ${GREEN_DARK};padding-top:5px;font-size:8.5px;font-weight:700;">
            <span>MANFESS · ${escapeHtml(classLabel(schoolClass))} · Printed ${new Date().toLocaleDateString()}</span>
            <span>Page ${pageNumber} / ${totalPages}</span>
          </div>
        </div>
      </div>`;
}

/* ─── page ───────────────────────────────────────────────────────────────── */

export function ClassListGeneratorPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [selectedClassId, setSelectedClassId] = useState("");
    const [selectedTerm, setSelectedTerm] = useState<TermLabel>("First Term");
    const [loading, setLoading] = useState(true);
    const [classDataLoading, setClassDataLoading] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);

    useEffect(() => {
        const fetchClasses = async () => {
            try {
                setLoading(true);
                const response = await axios.get(`${API_BASE}/classes`);
                if (response.data.success) {
                    const mapped: SchoolClass[] = response.data.data.map((schoolClass: any) => ({
                        ...schoolClass,
                        id: schoolClass._id || schoolClass.id,
                        className: schoolClass.className || schoolClass.name || "",
                        department: schoolClass.department || "",
                        acedemicYear: schoolClass.acedemicYear || schoolClass.academicYear || "",
                    }));
                    setClasses(mapped);
                    setSelectedClassId((current) => current || mapped[0]?.id || "");
                }
            } catch (error: any) {
                console.error("Unable to load classes", error);
                toast.error(error.response?.data?.message || "Failed to load classes");
            } finally {
                setLoading(false);
            }
        };

        fetchClasses();
    }, []);

    const selectedClass = useMemo(
        () => classes.find((schoolClass) => schoolClass.id === selectedClassId) ?? null,
        [classes, selectedClassId],
    );

    useEffect(() => {
        if (!selectedClassId) {
            setStudents([]);
            setClassDataLoading(false);
            return;
        }

        let cancelled = false;
        setClassDataLoading(true);
        axios.get(`${API_BASE}/students/class/${selectedClassId}`)
            .then((response) => {
                if (cancelled || !response.data.success) return;
                setStudents(response.data.data.map((student: any) => ({
                    ...student,
                    id: String(student._id || student.id),
                    classId: String(student.classId),
                    matricule: student.matricule || student.admissionNumber || "",
                })));
            })
            .catch((error: any) => {
                if (cancelled) return;
                console.error("Unable to load students", error);
                toast.error(error.response?.data?.message || "Failed to load the students of this class");
            })
            .finally(() => {
                if (!cancelled) setClassDataLoading(false);
            });

        return () => { cancelled = true; };
    }, [selectedClassId]);

    const classStudents = useMemo(
        () => students
            .filter((student) => student.classId === selectedClassId)
            .sort((first, second) => first.fullName.localeCompare(second.fullName)),
        [students, selectedClassId],
    );

    const termConfig = TERMS.find((term) => term.label === selectedTerm) ?? TERMS[0];
    const boys = classStudents.filter((student) => student.gender === "male").length;
    const girls = classStudents.filter((student) => student.gender === "female").length;
    const totalPages = Math.max(1, Math.ceil(classStudents.length / ROWS_PER_PAGE));
    const fileBase = selectedClass
        ? `${slugify(selectedClass.className)}-${slugify(selectedClass.department)}-${slugify(selectedTerm)}-class-list`
        : "class-list";

    const headers = ["N°", "Matricule", "Full Name", "Sex", ...termConfig.sequences.map((sequence) => `${sequence} /20`)];
    const studentRow = (student: Student, index: number) => [
        index + 1,
        student.matricule || "",
        student.fullName,
        sexLabel(student.gender),
        ...termConfig.sequences.map(() => ""),
    ];

    const canExport = !loading && !classDataLoading && !!selectedClass;

    /* ── PDF ─────────────────────────────────────────────────────────────── */
    const exportPdf = async () => {
        if (!selectedClass) {
            toast.error("Choose a class before downloading");
            return;
        }

        setGeneratingPdf(true);
        try {
            const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
                import("jspdf"),
                import("html2canvas-pro"),
            ]);
            const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

            for (let page = 0; page < totalPages; page++) {
                const container = document.createElement("div");
                container.style.cssText = `position:fixed;left:-9999px;top:0;width:${PAGE_W}px;height:${PAGE_H}px;background:#fff;z-index:-1;`;
                container.innerHTML = buildPageHtml({
                    schoolClass: selectedClass,
                    term: selectedTerm,
                    sequences: termConfig.sequences,
                    pageStudents: classStudents.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE),
                    startIndex: page * ROWS_PER_PAGE,
                    pageNumber: page + 1,
                    totalPages,
                    totalStudents: classStudents.length,
                });
                document.body.appendChild(container);

                try {
                    await new Promise((resolve) => setTimeout(resolve, 60));
                    const canvas = await html2canvas(container, {
                        scale: 2,
                        useCORS: true,
                        backgroundColor: "#ffffff",
                        logging: false,
                        width: PAGE_W,
                        height: PAGE_H,
                    });
                    if (page > 0) pdf.addPage();
                    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, 210, 297);
                } finally {
                    document.body.removeChild(container);
                }
            }

            pdf.save(`${fileBase}.pdf`);
            toast.success("Class list PDF downloaded");
        } catch (error) {
            console.error("Unable to generate the class list PDF", error);
            toast.error("Failed to generate the PDF");
        } finally {
            setGeneratingPdf(false);
        }
    };

    /* ── CSV ─────────────────────────────────────────────────────────────── */
    const exportCsv = () => {
        if (!selectedClass) {
            toast.error("Choose a class before exporting");
            return;
        }
        const metadata = [
            ["School", SCHOOL_NAME],
            ["Class", selectedClass.className],
            ["Department", selectedClass.department],
            ["Academic Year", selectedClass.acedemicYear],
            ["Term", selectedTerm],
            ["Subject", ""],
            ["Teacher", ""],
            [],
        ];
        const csv = [...metadata, headers, ...classStudents.map(studentRow)]
            .map((row) => row.map((cell) => escapeCsv(cell)).join(","))
            .join("\n");
        downloadFile(new Blob(["﻿", csv.replace(/\n/g, "\r\n")], { type: "text/csv;charset=utf-8;" }), `${fileBase}.csv`);
        toast.success("Class list exported to CSV");
    };

    /* ── Excel ───────────────────────────────────────────────────────────── */
    const exportExcel = async () => {
        if (!selectedClass) {
            toast.error("Choose a class before exporting");
            return;
        }

        try {
            const { Workbook } = await import("exceljs");
            const workbook = new Workbook();
            const worksheet = workbook.addWorksheet("Class List", {
                properties: { defaultRowHeight: 22 },
                views: [{ state: "frozen", ySplit: 8 }],
                pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
            });
            const lastColumn = String.fromCharCode(64 + headers.length);
            const green = "FF15803D";
            const greenDark = "FF14532D";

            worksheet.columns = headers.map((_, index) => ({
                width: index === 0 ? 6 : index === 1 ? 20 : index === 2 ? 34 : index === 3 ? 6 : 16,
            }));

            worksheet.mergeCells(`A1:${lastColumn}1`);
            Object.assign(worksheet.getCell("A1"), {
                value: SCHOOL_NAME,
                fill: { type: "pattern", pattern: "solid", fgColor: { argb: green } },
                font: { bold: true, size: 14, color: { argb: "FFFFFFFF" } },
                alignment: { vertical: "middle", horizontal: "center" },
            });
            worksheet.getRow(1).height = 34;

            worksheet.mergeCells(`A2:${lastColumn}2`);
            Object.assign(worksheet.getCell("A2"), {
                value: `CLASS LIST · ${selectedTerm.toUpperCase()} · ${classLabel(selectedClass)} · ${selectedClass.acedemicYear}`,
                fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5EC" } },
                font: { bold: true, size: 12, color: { argb: greenDark } },
                alignment: { vertical: "middle", horizontal: "center" },
            });
            worksheet.getRow(2).height = 26;

            worksheet.getCell("A4").value = "SUBJECT:";
            worksheet.getCell("D4").value = "";
            worksheet.getCell("A5").value = "TEACHER:";
            worksheet.getCell("A6").value = "DATE:";
            ["A4", "A5", "A6"].forEach((address) => {
                worksheet.getCell(address).font = { bold: true, color: { argb: greenDark }, size: 10 };
            });
            [4, 5, 6].forEach((rowNumber) => {
                for (let column = 3; column <= headers.length; column++) {
                    worksheet.getRow(rowNumber).getCell(column).border = { bottom: { style: "dotted", color: { argb: "FF555555" } } };
                }
            });

            const headerRow = worksheet.getRow(8);
            headers.forEach((header, index) => { headerRow.getCell(index + 1).value = header; });
            headerRow.height = 28;
            headerRow.eachCell((cell) => {
                cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: green } };
                cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
                cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
                cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
            });

            const totalRows = Math.max(classStudents.length + 5, ROWS_PER_PAGE);
            for (let index = 0; index < totalRows; index++) {
                const student = classStudents[index];
                const row = worksheet.addRow(student ? studentRow(student, index) : headers.map(() => ""));
                row.height = 22;
                row.eachCell({ includeEmpty: true }, (cell, column) => {
                    cell.alignment = { vertical: "middle", horizontal: column === 3 ? "left" : "center" };
                    cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
                    if (index % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF6FBF7" } };
                });
            }

            const buffer = await workbook.xlsx.writeBuffer();
            downloadFile(
                new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
                `${fileBase}.xlsx`,
            );
            toast.success("Class list exported to Excel");
        } catch (error) {
            console.error("Unable to export the class list", error);
            toast.error("Failed to export the Excel class list");
        }
    };

    /* ── UI ──────────────────────────────────────────────────────────────── */
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 rounded-3xl bg-gradient-to-br from-[#14532D] via-[#166534] to-[#15803D] p-6 text-white shadow-sm lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <p className="mb-2 text-xs uppercase tracking-[0.25em] text-white/70">MANFESS · Academic records</p>
                    <h1 className="text-3xl font-black tracking-tight">Class list</h1>
                    <p className="mt-1 text-sm text-white/80">Printable list for one class, with blank columns for teachers to write marks.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={exportPdf}
                        disabled={!canExport || generatingPdf}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#14532D] transition hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {generatingPdf ? (
                            <div className="size-4 animate-spin rounded-full border-2 border-[#14532D] border-t-transparent" />
                        ) : (
                            <FileText className="size-4" />
                        )}
                        {generatingPdf ? "Generating..." : "Download PDF"}
                    </button>
                    <button
                        onClick={exportExcel}
                        disabled={!canExport}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#BBF7D0] px-4 py-2.5 text-sm font-semibold text-[#14532D] transition hover:bg-[#D1FADF] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <FileSpreadsheet className="size-4" />
                        Excel
                    </button>
                    <button
                        onClick={exportCsv}
                        disabled={!canExport}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Download className="size-4" />
                        CSV
                    </button>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-stone-500">Term</span>
                        <FileSpreadsheet className="size-4 text-green-700" />
                    </div>
                    <div className="mt-3">
                        <select
                            value={selectedTerm}
                            onChange={(event) => setSelectedTerm(event.target.value as TermLabel)}
                            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-medium outline-none focus:border-green-600"
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
                        <GraduationCap className="size-4 text-green-700" />
                    </div>
                    <div className="mt-3">
                        <select
                            value={selectedClassId}
                            onChange={(event) => setSelectedClassId(event.target.value)}
                            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-medium outline-none focus:border-green-600"
                        >
                            {classes.length === 0 && <option value="">No classes available</option>}
                            {classes.map((schoolClass) => (
                                <option key={schoolClass.id} value={schoolClass.id}>
                                    {classLabel(schoolClass)}{schoolClass.acedemicYear ? ` (${schoolClass.acedemicYear})` : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="text-sm text-stone-500">Students</div>
                    <div className="mt-2 text-3xl font-black tracking-tight text-green-800">{classStudents.length}</div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="text-sm text-stone-500">Boys</div>
                    <div className="mt-2 text-3xl font-black tracking-tight">{boys}</div>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                    <div className="text-sm text-stone-500">Girls</div>
                    <div className="mt-2 text-3xl font-black tracking-tight">{girls}</div>
                </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-green-100 bg-green-50 px-5 py-4">
                    <div className="flex items-center gap-3">
                        <Users className="size-5 text-green-700" />
                        <div>
                            <h2 className="text-lg font-bold text-green-900">Class list preview</h2>
                            <p className="text-sm text-stone-500">
                                {selectedClass ? `${classLabel(selectedClass)} • ${selectedTerm}` : "Choose a class"}
                                {selectedClass && ` • ${totalPages} PDF page${totalPages > 1 ? "s" : ""}`}
                            </p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="p-8 text-sm text-stone-500">Loading classes...</div>
                ) : classDataLoading ? (
                    <div className="p-8 text-sm text-stone-500">Loading the students of this class...</div>
                ) : !selectedClass ? (
                    <div className="p-8 text-sm text-stone-500">No class selected.</div>
                ) : classStudents.length === 0 ? (
                    <div className="p-8 text-sm text-stone-500">
                        No students in this class yet. The PDF will still download as a blank class list.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-left text-sm">
                            <thead className="bg-green-700 text-white">
                                <tr>
                                    <th className="w-12 px-3 py-3 text-center font-semibold">N°</th>
                                    <th className="px-3 py-3 font-semibold">Matricule</th>
                                    <th className="px-3 py-3 font-semibold">Full name</th>
                                    <th className="px-3 py-3 text-center font-semibold">Sex</th>
                                    {termConfig.sequences.map((sequence) => (
                                        <th key={sequence} className="border-l border-green-600 px-3 py-3 text-center font-semibold">{sequence} /20</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {classStudents.map((student, index) => (
                                    <tr key={student.id} className="border-t border-stone-200 even:bg-green-50/40">
                                        <td className="px-3 py-2.5 text-center font-semibold">{index + 1}</td>
                                        <td className="px-3 py-2.5 font-mono text-xs">{student.matricule || "—"}</td>
                                        <td className="px-3 py-2.5 font-semibold text-stone-900">{student.fullName}</td>
                                        <td className="px-3 py-2.5 text-center">{sexLabel(student.gender)}</td>
                                        {termConfig.sequences.map((sequence) => (
                                            <td key={sequence} className="border-l border-stone-200 px-3 py-2.5" />
                                        ))}

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