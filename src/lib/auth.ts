import type { Role, User } from "./types";
import axios from "axios";

const KEY = "mams-user";
const API_BASE = "https://manfess-back.onrender.com/api";

// Fallback users for offline/development
const ROLE_USERS: Record<Role, User> = {
  super_admin: { id: "u-super", name: "Super Admin", email: "super@manfess.cm", role: "super_admin" },
  admin: { id: "u-admin", name: "Principal Admin", email: "admin@manfess.cm", role: "admin" },
  teacher: { id: "u-teacher", name: "Mr. Ako Daniel", email: "ako@manfess.cm", role: "teacher" },
  bursar: { id: "u-bursar", name: "Mme Bursar", email: "bursar@manfess.cm", role: "bursar" },
  parent: { id: "u-parent", name: "Parent / Student", email: "parent@manfess.cm", role: "parent" },
};

// Login with username (no password)
export async function loginWithUsername(username: string): Promise<{ success: boolean; user: User | null; message: string }> {
  try {
    const response = await axios.post(`${API_BASE}/login`, { username: username.trim() });

    if (response.data.success) {
      const user = response.data.data;
      // Store user in localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem(KEY, JSON.stringify(user));
        localStorage.setItem("isAuthenticated", "true");
      }
      return { success: true, user, message: "Login successful" };
    }

    return { success: false, user: null, message: response.data.message || "Login failed" };
  } catch (error: any) {
    console.error("Login error:", error);

    if (error.response) {
      const message = error.response.data?.message || "Login failed";
      return { success: false, user: null, message };
    } else if (error.request) {
      return { success: false, user: null, message: "Cannot connect to server. Please check your connection." };
    } else {
      return { success: false, user: null, message: "An unexpected error occurred" };
    }
  }
}

// Legacy login function (for backward compatibility)
export function login(role: Role): User {
  const user = ROLE_USERS[role];
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(user));
    localStorage.setItem("isAuthenticated", "true");
  }
  return user;
}

// Check if user exists
export async function checkUser(username: string): Promise<{ exists: boolean; user: User | null }> {
  try {
    const response = await axios.post(`${API_BASE}/check-user`, { username: username.trim() });

    if (response.data.success) {
      return { exists: response.data.exists, user: response.data.data || null };
    }
    return { exists: false, user: null };
  } catch (error) {
    console.error("Error checking user:", error);
    return { exists: false, user: null };
  }
}

// Logout
export function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(KEY);
    localStorage.removeItem("isAuthenticated");
  }
}

// Get current user from localStorage
export function currentUser(): User | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("isAuthenticated") === "true";
}

// Get user role
export function getUserRole(): Role | null {
  const user = currentUser();
  return user ? user.role : null;
}

// Check if user has a specific role
export function hasRole(role: Role | Role[]): boolean {
  const userRole = getUserRole();
  if (!userRole) return false;
  if (Array.isArray(role)) {
    return role.includes(userRole);
  }
  return userRole === role;
}

// Check if user is admin (super_admin or admin)
export function isAdmin(): boolean {
  const user = currentUser();
  return user ? user.role === "super_admin" || user.role === "admin" : false;
}

// Check if user is teacher
export function isTeacher(): boolean {
  const user = currentUser();
  return user ? user.role === "teacher" : false;
}

// Check if user is bursar
export function isBursar(): boolean {
  const user = currentUser();
  return user ? user.role === "bursar" : false;
}