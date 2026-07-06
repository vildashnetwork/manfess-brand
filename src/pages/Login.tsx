import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, Shield, Wallet, BookOpen, UserRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const API_BASE = "https://manfess-back.onrender.com/api";

// Types
interface User {
  id: string;
  name: string;
  username: string;
  phone: string;
  role: "admin" | "teacher" | "bursar" | "super_admin" | "parent";
  qualification?: string;
  subjectIds?: string[];
  classIds?: string[];
  acedemicYear?: string;
}

interface Role {
  role: "admin" | "teacher" | "bursar" | "super_admin" | "parent";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}

const ROLES: Role[] = [
  { role: "super_admin", label: "Super Admin", icon: Shield, desc: "Full system access" },
  { role: "admin", label: "School Admin", icon: GraduationCap, desc: "Manage operations" },
  { role: "teacher", label: "Teacher", icon: BookOpen, desc: "Enter & edit marks" },
  { role: "bursar", label: "Bursar", icon: Wallet, desc: "Fees & payments" },
  { role: "parent", label: "Parent / Student", icon: UserRound, desc: "View results" },
];

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "teacher" | "bursar" | "super_admin" | "parent">("admin");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username.trim()) {
      toast.error("Please enter your username");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE}/login`, {
        username: username.trim()
      });

      if (response.data.success) {
        const user = response.data.data;

        // Store user data in localStorage
        localStorage.setItem("mams-user", JSON.stringify(user));
        localStorage.setItem("isAuthenticated", "true");

        toast.success(`Welcome back, ${user.name}!`);

        // Redirect based on role
        const role = user.role;
        if (role === "admin" || role === "super_admin" || role === "bursar") {
          navigate("/app");
        } else if (role === "teacher") {
          navigate("/app/marks");
        } else {
          navigate("/app");
        }
      }
    } catch (error: any) {
      console.error("Login error:", error);

      if (error.response) {
        const message = error.response.data?.message || "Login failed";

        if (error.response.status === 401) {
          toast.error("Invalid username. Please check and try again.");
        } else if (error.response.status === 500) {
          toast.error("Server error. Please try again later.");
        } else {
          toast.error(message);
        }
      } else if (error.request) {
        toast.error("Cannot connect to server. Please check your connection.");
      } else {
        toast.error("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-[#121212] grid lg:grid-cols-2">
      <div className="hidden lg:flex bg-[#121212] text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(15,122,53,0.25),transparent_60%)]" />
        <Link to="/" className="relative flex items-center gap-2">
          <div className="size-10 bg-brand rounded-lg grid place-items-center"><GraduationCap className="size-5 text-white" /></div>
          <span className="font-display text-xl font-bold tracking-tight uppercase">MAMS</span>
        </Link>
        <div className="relative">
          <h2 className="font-display text-4xl font-extrabold leading-tight mb-4">
            Welcome back to <span className="text-brand">MANFESS</span>.
          </h2>
          <p className="text-white/60 max-w-md">Sign in to your portal. Marks, reports and fees — all where you left them.</p>

        </div>
        <p className="relative text-xs text-white/30">© 2026 MANFESS Evening School</p>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <form onSubmit={handleLogin} className="w-full max-w-md space-y-6">
          <div>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">Sign in</h1>
            <p className="text-sm text-black/60 mt-1">Enter your username to continue.</p>
          </div>

          {/* Role Selection - Optional, just for UI */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ROLES.map((r) => {
              const active = selectedRole === r.role;
              return (
                <button
                  type="button"
                  key={r.role}
                  onClick={() => setSelectedRole(r.role)}
                  className={`text-left p-3 rounded-xl border transition-all ${active ? "border-brand bg-brand/5 ring-2 ring-brand/20" : "border-stone-200 hover:border-stone-300"
                    }`}
                >
                  <r.icon className={`size-4 mb-2 ${active ? "text-brand" : "text-black/50"}`} />
                  <div className="font-bold text-xs">{r.label}</div>
                  <div className="text-[10px] text-black/40 mt-0.5">{r.desc}</div>
                </button>
              );
            })}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-black/50">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                className="mt-1 w-full px-4 py-3 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors"
                disabled={loading}
                autoFocus
              />
              <p className="text-xs text-black/40 mt-1">
                Use your registered username (e.g., admin, teacher1, johndoe)
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#121212] text-white py-3.5 rounded-xl font-bold hover:bg-brand transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </button>

          <div className="flex justify-between text-xs text-black/50">
            <span>Use your registered username</span>
            <Link to="/" className="hover:text-brand transition-colors">← Back home</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

// Updated auth.ts file
export function login(user: User): User {
  if (typeof window !== "undefined") {
    localStorage.setItem("mams-user", JSON.stringify(user));
    localStorage.setItem("isAuthenticated", "true");
  }
  return user;
}

export function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("mams-user");
    localStorage.removeItem("isAuthenticated");
  }
}

export function currentUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("mams-user");
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("isAuthenticated") === "true";
}