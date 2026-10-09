export type SchoolSection = "englophone";

const SCHOOL_SECTION_KEY = "school-section";

export function normalizeSchoolSection(value: string | null | undefined, fallback: SchoolSection = "englophone"): SchoolSection {
    void value;
    void fallback;
    return "englophone";
}

export function getStoredSchoolSection(): SchoolSection {
    if (typeof window === "undefined") return "englophone";
    const raw = window.localStorage.getItem(SCHOOL_SECTION_KEY);
    if (raw !== "englophone") window.localStorage.setItem(SCHOOL_SECTION_KEY, "englophone");
    return "englophone";
}

export function setStoredSchoolSection(_section: SchoolSection) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SCHOOL_SECTION_KEY, "englophone");
    window.dispatchEvent(new Event("school-section-change"));
}

export function getActiveSectionLabel(_section: SchoolSection) {
    return "Anglophone";
}
