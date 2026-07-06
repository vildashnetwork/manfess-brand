export function gradeFor(score: number): { grade: string; remark: string } {
  if (score >= 18) return { grade: "A", remark: "Excellent" };
  if (score >= 16) return { grade: "B", remark: "Very Good" };
  if (score >= 14) return { grade: "C", remark: "Good" };
  if (score >= 12) return { grade: "D", remark: "Fair" };
  if (score >= 10) return { grade: "E", remark: "Average" };
  return { grade: "F", remark: "Poor" };
}

export function rankWithTies(values: { id: string; avg: number }[]): Record<string, number> {
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

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function promotionStatus(avg: number): "Promoted" | "Repeat" {
  return avg >= 10 ? "Promoted" : "Repeat";
}

import type { FormLevel } from "./types";

const FORM_ORDER: FormLevel[] = [
  "Form 1", "Form 2", "Form 3", "Form 4", "Form 5",
  "Lower 6th", "Upper 6th", "Graduated",
];

export function nextForm(f: FormLevel): FormLevel {
  const i = FORM_ORDER.indexOf(f);
  if (i < 0 || i === FORM_ORDER.length - 1) return "Graduated";
  return FORM_ORDER[i + 1];
}