import type { Student, Teacher, SchoolClass, Subject, Mark, Sequence } from "./types";

const KEY = "mams-store-v1";

export interface Store {
  students: Student[];
  teachers: Teacher[];
  classes: SchoolClass[];
  subjects: Subject[];
  marks: Mark[];
}

function uid(prefix: string) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

function seed(): Store {
  const classes: SchoolClass[] = [
    { id: "c1", name: "Form 5 Science A", form: "Form 5", department: "Science" },
    { id: "c2", name: "Form 5 Arts A", form: "Form 5", department: "Arts" },
    { id: "c3", name: "Form 4 Commercial", form: "Form 4", department: "Commercial" },
    { id: "c4", name: "Form 3 Science", form: "Form 3", department: "Science" },
  ];

  const subjects: Subject[] = [
    { id: "s1", name: "Mathematics", code: "MTH", coefficient: 4, classIds: ["c1", "c2", "c3", "c4"] },
    { id: "s2", name: "English Language", code: "ENG", coefficient: 3, classIds: ["c1", "c2", "c3", "c4"] },
    { id: "s3", name: "French", code: "FRE", coefficient: 2, classIds: ["c1", "c2", "c3", "c4"] },
    { id: "s4", name: "Physics", code: "PHY", coefficient: 4, classIds: ["c1", "c4"] },
    { id: "s5", name: "Chemistry", code: "CHE", coefficient: 4, classIds: ["c1", "c4"] },
    { id: "s6", name: "Biology", code: "BIO", coefficient: 3, classIds: ["c1", "c4"] },
    { id: "s7", name: "Literature", code: "LIT", coefficient: 3, classIds: ["c2"] },
    { id: "s8", name: "History", code: "HIS", coefficient: 2, classIds: ["c2"] },
    { id: "s9", name: "Accounting", code: "ACC", coefficient: 4, classIds: ["c3"] },
    { id: "s10", name: "Economics", code: "ECO", coefficient: 3, classIds: ["c3"] },
    { id: "s11", name: "Citizenship", code: "CIT", coefficient: 1, classIds: ["c1", "c2", "c3", "c4"] },
  ];

  const firstNames = ["Emmanuel", "Beatrice", "Franklin", "Samantha", "Cedric", "Fatimatou", "Jean-Paul", "Marie-Noelle", "Bertrand", "Aisha", "Ndip", "Eposi", "Tabi", "Achu", "Nfor", "Mbah", "Tanyi", "Ewane", "Kamga", "Ngo"];
  const lastNames = ["Tanyi", "Ndip", "Kamga", "Ewane", "Ngo", "Mbah", "Achu", "Tabi", "Nfor", "Bate", "Ngwa", "Forka", "Asanji", "Eposi", "Atem"];
  const students: Student[] = [];
  let n = 1;
  classes.forEach((cls) => {
    for (let i = 0; i < 14; i++) {
      const fullName = `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
      const id = uid("st");
      students.push({
        id,
        admissionNumber: `MFS/${String(n).padStart(4, "0")}/24`,
        fullName,
        gender: Math.random() > 0.5 ? "M" : "F",
        dob: `200${5 + (n % 5)}-0${1 + (n % 9)}-1${n % 9}`,
        classId: cls.id,
        department: cls.department,
        parentName: `Mr. ${lastNames[n % lastNames.length]}`,
        parentPhone: `+237 6${String(70000000 + n * 137).slice(0, 8)}`,
        address: "Yaoundé, Cameroon",
        registrationDate: "2024-09-02",
        feesPaid: Math.random() > 0.3 ? 75000 : 45000,
        feesDue: Math.random() > 0.3 ? 0 : 30000,
      });
      n++;
    }
  });

  const teachers: Teacher[] = [
    { id: "t1", fullName: "Mr. Ako Daniel", qualification: "BSc Mathematics", phone: "+237 670000001", email: "ako@manfess.cm", subjectIds: ["s1"], classIds: ["c1", "c4"] },
    { id: "t2", fullName: "Mrs. Eyong Grace", qualification: "MA English", phone: "+237 670000002", email: "eyong@manfess.cm", subjectIds: ["s2", "s7"], classIds: ["c1", "c2"] },
    { id: "t3", fullName: "Mme Foka Marie", qualification: "Licence Lettres", phone: "+237 670000003", email: "foka@manfess.cm", subjectIds: ["s3"], classIds: ["c1", "c2", "c3"] },
    { id: "t4", fullName: "Dr. Tanyi Paul", qualification: "PhD Physics", phone: "+237 670000004", email: "tanyi@manfess.cm", subjectIds: ["s4", "s5"], classIds: ["c1"] },
    { id: "t5", fullName: "Mr. Mbah John", qualification: "BSc Accounting", phone: "+237 670000005", email: "mbah@manfess.cm", subjectIds: ["s9", "s10"], classIds: ["c3"] },
  ];

  const marks: Mark[] = [];
  students.forEach((st) => {
    const subs = subjects.filter((s) => s.classIds.includes(st.classId));
    subs.forEach((sub) => {
      for (const seq of [1, 2] as Sequence[]) {
        marks.push({
          studentId: st.id,
          subjectId: sub.id,
          classId: st.classId,
          sequence: seq,
          score: Math.round((6 + Math.random() * 13) * 100) / 100,
        });
      }
    });
  });

  return { students, teachers, classes, subjects, marks };
}

let cache: Store | null = null;

export function getStore(): Store {
  if (cache) return cache;
  if (typeof window === "undefined") {
    cache = seed();
    return cache;
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      cache = JSON.parse(raw) as Store;
      return cache;
    }
  } catch {}
  cache = seed();
  localStorage.setItem(KEY, JSON.stringify(cache));
  return cache;
}

export function saveStore(s: Store) {
  cache = s;
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(s));
}

export function resetStore() {
  cache = seed();
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(cache));
  return cache;
}

import { nextForm } from "./grading";

/**
 * Run auto-promotion across the school.
 * Students whose weighted annual average >= 10 move to the next form (same department if a class exists).
 * Returns counts.
 */
export function runPromotion(): { promoted: number; repeated: number; graduated: number } {
  const s = getStore();
  let promoted = 0, repeated = 0, graduated = 0;

  const studentAvgs: Record<string, number> = {};
  for (const st of s.students) {
    const subs = s.subjects.filter((sub) => sub.classIds.includes(st.classId));
    let sum = 0, cw = 0;
    for (const sub of subs) {
      const ms = s.marks.filter((m) => m.studentId === st.id && m.subjectId === sub.id);
      const a = ms.length ? ms.reduce((x, y) => x + y.score, 0) / ms.length : 0;
      if (a) { sum += a * sub.coefficient; cw += sub.coefficient; }
    }
    studentAvgs[st.id] = cw ? sum / cw : 0;
  }

  const nextStudents = s.students.map((st) => {
    if (studentAvgs[st.id] < 10) { repeated++; return st; }
    const cls = s.classes.find((c) => c.id === st.classId);
    if (!cls) return st;
    const nForm = nextForm(cls.form);
    if (nForm === "Graduated") { graduated++; return { ...st, classId: "graduated", department: st.department }; }
    const target = s.classes.find((c) => c.form === nForm && c.department === cls.department) ?? s.classes.find((c) => c.form === nForm);
    if (!target) { repeated++; return st; }
    promoted++;
    return { ...st, classId: target.id };
  });

  // Clear marks for promoted students so the new year starts fresh
  const remainingStudentIds = new Set(nextStudents.filter((st) => st.classId !== "graduated").map((st) => st.id));
  const newMarks = s.marks.filter((m) => {
    const wasPromotedOrGrad = nextStudents.find((st) => st.id === m.studentId)?.classId !== s.students.find((x) => x.id === m.studentId)?.classId;
    return !wasPromotedOrGrad && remainingStudentIds.has(m.studentId);
  });

  saveStore({ ...s, students: nextStudents, marks: newMarks });
  return { promoted, repeated, graduated };
}