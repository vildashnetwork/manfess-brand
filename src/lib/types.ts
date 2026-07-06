export type Role = "super_admin" | "admin" | "teacher" | "bursar" | "parent";

export type Department = "Arts" | "Science" | "Commercial";
export type FormLevel = "Form 1" | "Form 2" | "Form 3" | "Form 4" | "Form 5" | "Lower 6th" | "Upper 6th" | "Graduated";
export type Sequence = 1 | 2 | 3 | 4 | 5 | 6;
export type Term = "First" | "Second" | "Third";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Student {
  id: string;
  admissionNumber: string;
  fullName: string;
  gender: "M" | "F";
  dob: string;
  classId: string;
  department: Department;
  parentName: string;
  parentPhone: string;
  address: string;
  photoUrl?: string;
  registrationDate: string;
  feesPaid: number;
  feesDue: number;
}

export interface Teacher {
  id: string;
  fullName: string;
  qualification: string;
  phone: string;
  email: string;
  subjectIds: string[];
  classIds: string[];
}

export interface SchoolClass {
  id: string;
  name: string; // e.g. "Form 5 Science A"
  form: FormLevel;
  department: Department;
  classMasterId?: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  coefficient: number;
  classIds: string[]; // taught in these classes
  teacherIds?: string[]; // teachers responsible for this subject (per-subject)
}

export interface Mark {
  studentId: string;
  subjectId: string;
  classId: string;
  sequence: Sequence;
  score: number; // 0-20
  recordedBy?: string; // teacher full name who recorded the mark
  recordedAt?: string;
}