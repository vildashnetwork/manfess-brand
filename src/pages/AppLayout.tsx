import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardEdit,
  FileText, Wallet, Settings, LogOut, Menu, X, Bell, ArrowUpRight,
  Calendar, DollarSign, Download, IdCard,
} from "lucide-react";
import { currentUser, logout } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import type { User, Role } from "@/lib/types";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  roles: Role[];
};
const ALL: Role[] = ["super_admin", "admin", "teacher", "bursar", "parent"];

const NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true, roles: ["super_admin", "admin", "bursar", "parent"] },
  { to: "/app/students", label: "Students", icon: Users, roles: ["super_admin", "admin", "bursar"] },
  { to: "/app/student-id-cards", label: "ID Cards", icon: IdCard, roles: ["super_admin", "admin"] },
  { to: "/app/teachers", label: "Teachers", icon: GraduationCap, roles: ["super_admin", "admin"] },
  { to: "/app/classes", label: "Classes & Subjects", icon: BookOpen, roles: ["super_admin", "admin"] },
  { to: "/app/mark-entry", label: "Mark Entry", icon: ClipboardEdit, roles: ["super_admin", "admin", "teacher"] },
  { to: "/app/student-attendance", label: "Student Attendance", icon: Calendar, roles: ["super_admin", "admin", "teacher"] },
  { to: "/app/teacher-timetable", label: "Teacher Timetable", icon: Calendar, roles: ["teacher"] },
  { to: "/app/teacher-attendance", label: "Teacher Attendance", icon: Calendar, roles: ["super_admin", "admin"] },
  { to: "/app/report-cards", label: "Report Cards", icon: FileText, end: true, roles: ["super_admin", "admin"] },
  { to: "/app/report-cards/bulk", label: "Bulk Report Cards", icon: FileText, roles: ["super_admin", "admin"] },
  { to: "/app/class-lists", label: "Class Lists", icon: Download, roles: ["super_admin", "admin", "bursar"] },
  { to: "/app/promotion", label: "Promotion", icon: ArrowUpRight, roles: ["super_admin", "admin"] },
  { to: "/app/fees", label: "Fees & Finance", icon: Wallet, roles: ["super_admin", "admin", "bursar"] },
  { to: "/app/teacher-salaries", label: "Teacher Salaries", icon: DollarSign, roles: ["super_admin", "admin", "bursar"] },
  { to: "/app/timetable", label: "Timetable", icon: Calendar, roles: ["super_admin", "admin"] },
  { to: "/app/settings", label: "School Settings", icon: Settings, roles: ["super_admin", "admin"] },
];

export function AppLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const openMobileNavigation = () => {
    setOpen(true);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    });
  };

  useEffect(() => {
    const u = currentUser();
    if (!u) { navigate("/login", { replace: true }); return; }
    setUser(u);
  }, [navigate]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }

      if (event.key !== "Tab") return;
      const focusableElements = sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusableElements?.length) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      menuButtonRef.current?.focus();
    };
  }, [open]);

  const items = useMemo(() => user ? NAV.filter((n) => n.roles.includes(user.role)) : [], [user]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-[#121212] flex">
      {open && (
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px] lg:hidden"
        />
      )}

      <aside
        ref={sidebarRef}
        id="app-sidebar"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] max-h-[100dvh] w-[min(20rem,calc(100vw-1.25rem))] flex-col bg-[#121212] text-white shadow-2xl transition-[transform,visibility] duration-300 ease-out lg:sticky lg:top-0 lg:z-40 lg:h-screen lg:w-64 lg:max-h-none lg:translate-x-0 lg:shadow-none ${open ? "visible translate-x-0" : "invisible -translate-x-full lg:visible"}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/5 px-4 py-4 sm:p-6">
          <div className="size-9 bg-brand rounded-lg grid place-items-center">
            <GraduationCap className="size-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display font-bold uppercase tracking-tight">BCHS DOUALA</div>
            <div className="truncate text-[10px] text-white/40 uppercase tracking-widest">{t("SCHOOL PORTAL")}</div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close navigation menu"
            onClick={() => setOpen(false)}
            className="grid size-10 shrink-0 place-items-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav aria-label="Primary" className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-3 sm:py-4">
          {items.map((item) => {
            const translatedLabel = item.label;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-brand/15 text-brand" : "text-white/60 hover:text-white hover:bg-white/5"}`}
              >
                <item.icon className="size-4" />
                {translatedLabel}
              </NavLink>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-white/5 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-9 bg-brand/20 text-brand rounded-full grid place-items-center font-bold text-sm">
              {user.name.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{user.name}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-widest">{t(user.role.replace("_", " "))}</div>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="w-full flex items-center justify-center gap-2 text-xs font-bold text-white/60 hover:text-white border border-white/10 hover:border-white/30 py-2 rounded-lg transition-colors"
          >
            <LogOut className="size-3.5" /> {t("Sign out")}
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1" inert={open}>
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-2 border-b border-stone-200 bg-white px-3 py-2 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              ref={menuButtonRef}
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={open}
              aria-controls="app-sidebar"
              aria-haspopup="dialog"
              onClick={openMobileNavigation}
              className="grid size-10 shrink-0 place-items-center rounded-lg border border-stone-200 text-stone-700 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand lg:hidden"
            >
              <Menu className="size-5" />
            </button>
            <div className="min-w-0">
              <div className="truncate text-[10px] font-medium text-black/45 sm:text-xs">BCHS DOUALA · {t("School Portal")}</div>
              <div className="truncate text-sm font-semibold">{getPageTitle(pathname)}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button type="button" aria-label="Notifications" className="grid size-9 place-items-center rounded-lg border border-stone-200 hover:bg-stone-50">
              <Bell className="size-4" />
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-stone-100 rounded-full">
              <span className="size-2 bg-brand rounded-full" />
              <span className="text-xs font-semibold">{t("Live")}</span>
            </div>
          </div>
        </header>
        <div className="px-3 py-4 sm:p-6 lg:p-8"><Outlet /></div>
      </main>
    </div>
  );
}

function getPageTitle(p: string) {
  if (p === "/app") return "Overview Dashboard";
  if (p.startsWith("/app/students")) return "Students";
  if (p.startsWith("/app/student-id-cards")) return "ID Cards";
  if (p.startsWith("/app/teachers")) return "Teachers";
  if (p.startsWith("/app/teacher-attendance")) return "Teacher Attendance";
  if (p.startsWith("/app/teacher-salaries")) return "Teacher Salaries";
  if (p.startsWith("/app/teacher-timetable")) return "Teacher Timetable";
  if (p.startsWith("/app/classes")) return "Classes & Subjects";
  if (p.startsWith("/app/mark-entry")) return "Mark Entry";
  if (p.startsWith("/app/student-attendance")) return "Student Attendance";
  if (p.startsWith("/app/report-cards")) return "Report Cards";
  if (p.startsWith("/app/class-lists")) return "Class Lists";
  if (p.startsWith("/app/promotion")) return "Promotion";
  if (p.startsWith("/app/fees")) return "Fees & Finance";
  if (p.startsWith("/app/settings")) return "School Settings";
  return "BCHS DOUALA";
}