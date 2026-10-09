import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { IdCard, LayoutTemplate, Printer, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { getStoredSchoolSection } from "@/lib/schoolSystem";

const API_BASE = import.meta.env.VITE_API_URL ?? "https://manfess-back.onrender.com/api";

type Student = {
    id: string;
    fullName: string;
    matricule?: string;
    gender?: string;
    dob?: string;
    classId?: string;
    department?: string;
    parentName?: string;
    parentPhone?: string;
    address?: string;
    photoUrl?: string;
    photoCloudinaryUrl?: string;
    photoLocalUrl?: string;
    registrationDate?: string;
    section?: "englophone";
};

type SchoolClass = {
    id: string;
    className: string;
    department: string;
    schoolSection?: "englophone";
};

const CARD_PRESETS = {
    standard: { label: "Standard ID (85.6 × 54 mm)", width: 85.6, height: 54 },
    compact: { label: "Compact (80 × 50 mm)", width: 80, height: 50 },
    large: { label: "Large (90 × 60 mm)", width: 90, height: 60 },
    custom: { label: "Custom size", width: 85.6, height: 54 },
} as const;

const SCHOOL_NAME = "BCHS DOUALA";
const SCHOOL_BRAND_BLUE = "#155DAA";
const PREVIEW_BATCH_SIZE = 36;

function initialsFromName(name: string) {
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "ST";
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", gap: "2mm", fontSize: "6px", color: "#5b6472" }}>
            <span style={{ color: SCHOOL_BRAND_BLUE, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
            <span style={{ color: "#121212", fontWeight: 700, textAlign: "right", maxWidth: "18mm", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
        </div>
    );
}

function StudentPhoto({ src, name }: { src?: string; name: string }) {
    const [hasError, setHasError] = useState(false);

    if (!src || hasError) {
        return (
            <span style={{ fontSize: "18px", fontWeight: 800, color: "#1f2937" }}>{initialsFromName(name)}</span>
        );
    }

    return (
        <img
            src={src}
            alt={name}
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            onError={() => setHasError(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
    );
}

export function StudentIdCardsPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [classes, setClasses] = useState<SchoolClass[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState("all");
    const [query, setQuery] = useState("");
    const [preset, setPreset] = useState<keyof typeof CARD_PRESETS>("standard");
    const [cardSize, setCardSize] = useState<{ width: number; height: number }>({
        width: CARD_PRESETS.standard.width,
        height: CARD_PRESETS.standard.height,
    });
    const [cornerRadius, setCornerRadius] = useState(14);
    const [cardGap, setCardGap] = useState(6);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [renderAllForExport, setRenderAllForExport] = useState(false);
    const [visibleCardCount, setVisibleCardCount] = useState(PREVIEW_BATCH_SIZE);

    const fetchData = async () => {
        try {
            setLoading(true);
            const section = getStoredSchoolSection();
            const [studentRes, classRes] = await Promise.all([
                axios.get(`${API_BASE}/students`, { params: { section } }),
                axios.get(`${API_BASE}/classes`, { params: { section } }),
            ]);

            if (studentRes.data.success) {
                const mappedStudents = (studentRes.data.data || []).map((student: any) => {
                    const studentPhoto = [
                        student.photoUrl,
                        student.photo,
                        student.imageUrl,
                        student.photo_url,
                        student.image,
                    ].find((value) => typeof value === "string" && value.trim().length > 0) || "";

                    return {
                        ...student,
                        id: student._id || student.id,
                        matricule: student.matricule || student.admissionNumber || "",
                        photoUrl: studentPhoto,
                        section: student.section || section,
                    };
                });
                setStudents(mappedStudents);
            }

            if (classRes.data.success) {
                const mappedClasses = (classRes.data.data || []).map((cls: any) => ({
                    ...cls,
                    id: cls._id || cls.id,
                    schoolSection: cls.schoolSection || cls.section || section,
                }));
                setClasses(mappedClasses);
            }
        } catch (error: any) {
            console.error("Failed to load student ID cards data:", error);
            toast.error(error?.response?.data?.message || "Failed to load student data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchData();
    }, []);

    const filteredStudents = useMemo(() => {
        return students.filter((student) => {
            const matchesClass = selectedClass === "all" || student.classId === selectedClass;
            const matchesSearch = !query || (
                `${student.fullName} ${student.matricule || ""} ${student.department || ""}`
                    .toLowerCase()
                    .includes(query.toLowerCase())
            );
            return matchesClass && matchesSearch;
        });
    }, [students, selectedClass, query]);

    const classById = useMemo(
        () => new Map(classes.map((schoolClass) => [schoolClass.id, schoolClass])),
        [classes],
    );
    const displayedStudents = renderAllForExport
        ? filteredStudents
        : filteredStudents.slice(0, visibleCardCount);

    useEffect(() => {
        setVisibleCardCount(PREVIEW_BATCH_SIZE);
    }, [selectedClass, query]);

    const applyPreset = (nextPreset: keyof typeof CARD_PRESETS) => {
        setPreset(nextPreset);
        setCardSize({
            width: CARD_PRESETS[nextPreset].width,
            height: CARD_PRESETS[nextPreset].height,
        });
    };

    const updateDimension = (dimension: "width" | "height", value: number) => {
        setPreset("custom");
        setCardSize((prev) => ({
            ...prev,
            [dimension]: Number.isFinite(value) ? Math.max(30, value) : prev[dimension],
        }));
    };

    const exportCardsPdf = async () => {
        if (filteredStudents.length === 0) {
            toast.error("No student cards to export");
            return;
        }

        setExportingPdf(true);
        setRenderAllForExport(true);
        try {
            await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            const cardElements = Array.from(document.querySelectorAll<HTMLElement>(".student-id-card"));
            const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
                import("html2canvas-pro"),
                import("jspdf"),
            ]);
            const orientation = cardSize.width > cardSize.height ? "landscape" : "portrait";
            const pdf = new jsPDF({
                unit: "mm",
                format: [cardSize.width, cardSize.height],
                orientation,
                compress: true,
            });

            for (const [index, card] of cardElements.entries()) {
                const images = Array.from(card.querySelectorAll("img"));
                await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
                const canvas = await html2canvas(card, {
                    scale: 3,
                    useCORS: true,
                    backgroundColor: "#ffffff",
                    logging: false,
                });

                if (index > 0) {
                    pdf.addPage([cardSize.width, cardSize.height], orientation);
                }

                pdf.addImage(
                    canvas.toDataURL("image/png"),
                    "PNG",
                    0,
                    0,
                    cardSize.width,
                    cardSize.height,
                    undefined,
                    "FAST",
                );

                if ((index + 1) % 5 === 0) {
                    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
                }
            }

            const section = getStoredSchoolSection();
            pdf.save(`student-id-cards-${section}-${new Date().toISOString().slice(0, 10)}.pdf`);
            toast.success("Student ID cards PDF downloaded");
        } catch (error) {
            console.error("Failed to export student ID cards PDF:", error);
            toast.error("Could not create the student ID cards PDF");
        } finally {
            setRenderAllForExport(false);
            setExportingPdf(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex size-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
                            <IdCard className="size-5 sm:size-6" />
                        </div>
                        <div>
                            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-black/45">Printing</p>
                            <h2 className="text-xl sm:text-2xl font-bold text-stone-900">Student ID Cards</h2>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 no-print">
                        <button
                            type="button"
                            onClick={exportCardsPdf}
                            disabled={exportingPdf || loading || filteredStudents.length === 0}
                            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand/90"
                        >
                            <Printer className="size-4" />
                            {exportingPdf ? "Creating PDF..." : "Download ID cards PDF"}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <aside className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm no-print">
                    <div className="flex items-center gap-2 mb-4">
                        <SlidersHorizontal className="size-4 text-brand" />
                        <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-black/55">Settings</h3>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-black/50">Class</label>
                            <select
                                value={selectedClass}
                                onChange={(e) => setSelectedClass(e.target.value)}
                                className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-800 focus:border-brand focus:outline-none"
                            >
                                <option value="all">All students</option>
                                {classes.map((schoolClass) => (
                                    <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.className + " " + schoolClass?.department}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-black/50">Search</label>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-black/35" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Name or matricule"
                                    className="w-full rounded-xl border border-stone-300 bg-stone-50 py-2.5 pl-9 pr-3 text-sm text-stone-800 focus:border-brand focus:outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-black/50">Preset size</label>
                            <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                                {Object.entries(CARD_PRESETS).map(([key, value]) => (
                                    <button
                                        key={key}
                                        type="button"
                                        onClick={() => applyPreset(key as keyof typeof CARD_PRESETS)}
                                        className={`rounded-xl border px-3 py-2 text-left text-xs font-medium transition ${preset === key ? "border-brand bg-brand/10 text-brand" : "border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100"}`}
                                    >
                                        {value.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-black/50">Width (mm)</label>
                                <input
                                    type="number"
                                    min={30}
                                    step={0.1}
                                    value={cardSize.width}
                                    onChange={(e) => updateDimension("width", Number(e.target.value))}
                                    className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-800 focus:border-brand focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-black/50">Height (mm)</label>
                                <input
                                    type="number"
                                    min={30}
                                    step={0.1}
                                    value={cardSize.height}
                                    onChange={(e) => updateDimension("height", Number(e.target.value))}
                                    className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-800 focus:border-brand focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-black/50">Radius</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={30}
                                    value={cornerRadius}
                                    onChange={(e) => setCornerRadius(Number(e.target.value))}
                                    className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-800 focus:border-brand focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-black/50">Gap (mm)</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={12}
                                    value={cardGap}
                                    onChange={(e) => setCardGap(Number(e.target.value))}
                                    className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-800 focus:border-brand focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </aside>

                <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-black/45">Preview</p>
                            <h3 className="text-base font-semibold text-stone-900">{filteredStudents.length} card(s)</h3>
                        </div>
                        <div className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                            {cardSize.width.toFixed(1)} × {cardSize.height.toFixed(1)} mm
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex min-h-[220px] items-center justify-center text-sm text-black/50">Loading students...</div>
                    ) : filteredStudents.length === 0 ? (
                        <div className="flex min-h-[220px] items-center justify-center text-sm text-black/50">No students match your current filters.</div>
                    ) : (
                        <div
                            className="print-grid"
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: `${cardGap}mm`,
                                alignItems: "flex-start",
                                justifyContent: "flex-start",
                            }}
                        >
                            {displayedStudents.map((student) => {
                                const matchedClass = classById.get(student.classId || "");
                                const displayMatricule = student.matricule || `ID-${(student.id || "STUDENT").slice(-6).toUpperCase()}`;
                                const photo = student.photoUrl ? student.photoUrl : "";

                                return (
                                    <div
                                        key={student.id}
                                        className="student-id-card"
                                        style={{
                                            width: `${cardSize.width}mm`,
                                            height: `${cardSize.height}mm`,
                                            borderRadius: `${cornerRadius}px`,
                                            padding: 0,
                                            display: "flex",
                                            flexDirection: "column",
                                            overflow: "hidden",
                                        }}
                                    >
                                        <div
                                            style={{
                                                height: "14mm",
                                                background: "linear-gradient(135deg, #155DAA 0%, #0b3f7d 100%)",
                                                color: "white",
                                                padding: "2.6mm 3.4mm 2mm",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                            }}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: "2.2mm" }}>
                                                <div
                                                    style={{
                                                        width: "7.2mm",
                                                        height: "7.2mm",
                                                        borderRadius: "1.7mm",
                                                        background: "rgba(255,255,255,0.16)",
                                                        border: "1px solid rgba(255,255,255,0.25)",
                                                        display: "grid",
                                                        placeItems: "center",
                                                        fontWeight: 800,
                                                        fontSize: "6px",
                                                    }}
                                                >
                                                    BCHS
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: "8px", fontWeight: 800, letterSpacing: "0.12em" }}>{SCHOOL_NAME}</div>
                                                    <div style={{ fontSize: "5.5px", letterSpacing: "0.18em", opacity: 0.8 }}>STUDENT ID</div>
                                                </div>
                                            </div>

                                            <div
                                                style={{
                                                    fontSize: "6px",
                                                    fontWeight: 700,
                                                    letterSpacing: "0.08em",
                                                    padding: "1mm 1.6mm",
                                                    borderRadius: "999px",
                                                    background: "rgba(255,255,255,0.14)",
                                                }}
                                            >
                                                {matchedClass?.className || "Class"}
                                            </div>
                                        </div>

                                        <div style={{ display: "flex", flex: 1, padding: "3.2mm 3.2mm 2.6mm" }}>
                                            <div
                                                style={{
                                                    width: "18mm",
                                                    height: "18mm",
                                                    minWidth: "18mm",
                                                    borderRadius: "2.8mm",
                                                    overflow: "hidden",
                                                    background: "linear-gradient(135deg, #EAF2FB, #d8e7f8)",
                                                    border: "1px solid rgba(21,93,170,0.3)",
                                                    display: "grid",
                                                    placeItems: "center",
                                                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.6)",
                                                }}
                                            >
                                                <StudentPhoto src={photo} name={student.fullName} />
                                            </div>

                                            <div style={{ flex: 1, marginLeft: "3.2mm", minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                                <div>
                                                    <div style={{ fontSize: "12px", fontWeight: 800, lineHeight: 1.15, color: "#121212", wordBreak: "break-word" }}>
                                                        {student.fullName}
                                                    </div>
                                                    <div style={{ marginTop: "1.5mm", fontSize: "6.5px", color: SCHOOL_BRAND_BLUE, letterSpacing: "0.08em", fontWeight: 700 }}>
                                                        {displayMatricule}
                                                    </div>
                                                </div>

                                                <div style={{ display: "grid", gap: "0.7mm" }}>
                                                    <InfoRow label="Department" value={matchedClass?.department || student.department || "General"} />
                                                    <InfoRow label="Class" value={matchedClass?.className || "-"} />
                                                    <InfoRow label="Date of birth" value={student.dob || "-"} />
                                                    <InfoRow label="Gender" value={student.gender || "-"} />
                                                    <InfoRow label="Parent phone" value={student.parentPhone || "-"} />
                                                </div>
                                            </div>
                                        </div>

                                        <div
                                            style={{
                                                borderTop: "1px solid rgba(21,93,170,0.2)",
                                                background: "#EAF2FB",
                                                padding: "2mm 3.2mm 3mm",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                gap: "2mm",
                                            }}
                                        >
                                            <div style={{ fontSize: "6px", color: SCHOOL_BRAND_BLUE, letterSpacing: "0.08em" }}>
                                                VALID {new Date().getFullYear()}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: "6px",
                                                    fontWeight: 800,
                                                    letterSpacing: "0.15em",
                                                    color: SCHOOL_BRAND_BLUE,
                                                    padding: "1.2mm 2.1mm",
                                                    border: "1px solid rgba(21,93,170,0.35)",
                                                    borderRadius: "999px",
                                                    background: "white",
                                                }}
                                            >
                                                {displayMatricule.slice(-6).toUpperCase()}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {!loading && !renderAllForExport && displayedStudents.length < filteredStudents.length && (
                        <div className="mt-4 flex justify-center no-print">
                            <button
                                type="button"
                                onClick={() => setVisibleCardCount((count) => count + PREVIEW_BATCH_SIZE)}
                                className="rounded-lg border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
                            >
                                Show more cards ({filteredStudents.length - displayedStudents.length} remaining)
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
        .student-id-card {
          background: linear-gradient(180deg, #ffffff 0%, #f7faff 100%);
          border: 1px solid rgba(21, 93, 170, 0.18);
          box-shadow: 0 18px 35px rgba(21, 93, 170, 0.14);
          color: #111827;
          page-break-inside: avoid;
        }

        .student-id-card * {
          box-sizing: border-box;
        }

        @media print {
          body {
            background: white;
          }

          .no-print {
            display: none !important;
          }

          .print-grid {
            gap: 6mm !important;
            justify-content: flex-start !important;
            width: 100%;
          }

          .student-id-card {
            box-shadow: none !important;
            break-inside: avoid;
          }

          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }
      `}</style>
        </div>
    );
}
