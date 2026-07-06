import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardEdit,
  FileText, Wallet, Settings, LogOut, Menu, X, Bell, ArrowUpRight,
} from "lucide-react";
import { currentUser, logout } from "@/lib/auth";
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
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true, roles: ALL },
  { to: "/app/students", label: "Students", icon: Users, roles: ["super_admin", "admin", "teacher", "bursar"] },
  { to: "/app/teachers", label: "Teachers", icon: GraduationCap, roles: ["super_admin", "admin"] },
  { to: "/app/classes", label: "Classes & Subjects", icon: BookOpen, roles: ["super_admin", "admin", "teacher"] },
  { to: "/app/mark-entry", label: "Mark Entry", icon: ClipboardEdit, roles: ["super_admin", "admin", "teacher"] },
  { to: "/app/report-cards", label: "Report Cards", icon: FileText, roles: ["super_admin", "admin", "teacher", "parent"] },
  { to: "/app/promotion", label: "Promotion", icon: ArrowUpRight, roles: ["super_admin", "admin"] },
  { to: "/app/fees", label: "Fees & Finance", icon: Wallet, roles: ["super_admin", "admin", "bursar"] },
  { to: "/app/settings", label: "Settings", icon: Settings, roles: ["super_admin", "admin"] },
];

export function AppLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const u = currentUser();
    if (!u) { navigate("/login", { replace: true }); return; }
    setUser(u);
  }, [navigate]);

  const items = useMemo(() => user ? NAV.filter((n) => n.roles.includes(user.role)) : [], [user]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-[#121212] flex">
      <button
        onClick={() => setOpen(!open)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-[#121212] text-white p-2 rounded-lg shadow-lg"
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      <aside className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-[#121212] text-white flex flex-col transition-transform ${open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-6 flex items-center gap-3 border-b border-white/5">
          <div className="size-9 bg-brand rounded-lg grid place-items-center">
            <GraduationCap className="size-4 text-white" />
          </div>
          <div>
            <div className="font-display font-bold uppercase tracking-tight">MAMS</div>
            <div className="text-[10px] text-white/40 uppercase tracking-widest">MANFESS</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive ? "bg-brand/15 text-brand" : "text-white/60 hover:text-white hover:bg-white/5"}`}
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-white/5">
          <div className="flex items-center gap-3 mb-3">
            <div className="size-9 bg-brand/20 text-brand rounded-full grid place-items-center font-bold text-sm">
              {user.name.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{user.name}</div>
              <div className="text-[10px] text-white/40 uppercase tracking-widest">{user.role.replace("_", " ")}</div>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate("/login"); }}
            className="w-full flex items-center justify-center gap-2 text-xs font-bold text-white/60 hover:text-white border border-white/10 hover:border-white/30 py-2 rounded-lg transition-colors"
          >
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-stone-200 px-6 lg:px-8 flex items-center justify-between">
          <div className="pl-10 lg:pl-0">
            <div className="text-xs text-black/40 font-medium">MANFESS Evening School · 2024/25</div>
            <div className="text-sm font-semibold">{getPageTitle(pathname)}</div>
          </div>
          <div className="flex items-center gap-3">
            <button className="size-9 grid place-items-center rounded-lg border border-stone-200 hover:bg-stone-50">
              <Bell className="size-4" />
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-stone-100 rounded-full">
              <span className="size-2 bg-brand rounded-full" />
              <span className="text-xs font-semibold">Live</span>
            </div>
          </div>
        </header>
        <div className="p-6 lg:p-8"><Outlet /></div>
      </main>
    </div>
  );
}

function getPageTitle(p: string) {
  if (p === "/app") return "Overview Dashboard";
  if (p.startsWith("/app/students")) return "Students";
  if (p.startsWith("/app/teachers")) return "Teachers";
  if (p.startsWith("/app/classes")) return "Classes & Subjects";
  if (p.startsWith("/app/mark-entry")) return "Mark Entry";
  if (p.startsWith("/app/report-cards")) return "Report Cards";
  if (p.startsWith("/app/promotion")) return "Promotion";
  if (p.startsWith("/app/fees")) return "Fees & Finance";
  if (p.startsWith("/app/settings")) return "Settings";
  return "MAMS";
}