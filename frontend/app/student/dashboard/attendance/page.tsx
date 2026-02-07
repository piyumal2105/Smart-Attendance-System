"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, UserCheck, BarChart3, Calendar } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type MarkRes = {
  session_id: string;
  module_code: string;
  module_name: string;
  remaining_slots: number;
  pin_expires_at: string;
  marked_at?: string;
  max_students?: number;
};

type ModuleAttendance = {
  module_code: string;
  module_name: string;
  total_sessions: number;
  present_sessions: number;
  attendance_percentage: number;
};

export default function StudentAttendancePage() {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState("");
  const [pin, setPin] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [data, setData] = useState<MarkRes | null>(null);

  // Module attendance history - ONLY modules where student was present
  const [moduleAttendance, setModuleAttendance] = useState<ModuleAttendance[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Local demo history
  const [history, setHistory] = useState<
    { module_code: string; module_name: string; marked_at: string }[]
  >([]);

  // Auto-fill student ID from auth context
  useEffect(() => {
    if (user?.student_profile?.student_id) {
      setStudentId(user.student_profile.student_id);
    }
  }, [user]);

  // Fetch module attendance history when studentId is available
  useEffect(() => {
    if (studentId) {
      fetchModuleAttendance();
    }
  }, [studentId]);

  async function fetchModuleAttendance() {
    if (!studentId.trim()) return;

    setLoadingHistory(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API}/api/attendance/student/${studentId}/summary`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        console.error("Failed to fetch module attendance");
        return;
      }

      const json = await res.json();

      // Group records by module - ONLY count sessions where student was PRESENT
      const moduleMap = new Map<string, {
        module_code: string;
        module_name: string;
        total: number;
        present: number;
      }>();

      for (const record of json.records || []) {
        // Only process records where student was present
        if (!record.present) continue;

        const key = record.module_code;
        const existing = moduleMap.get(key);

        if (!existing) {
          moduleMap.set(key, {
            module_code: record.module_code,
            module_name: record.module_name,
            total: 1,
            present: 1,
          });
        } else {
          existing.total += 1;
          existing.present += 1;
        }
      }

      // Convert to array - only modules where student attended at least once
      const modules: ModuleAttendance[] = Array.from(moduleMap.values())
        .filter(m => m.present > 0) // Only show modules where student was present
        .map(m => ({
          module_code: m.module_code,
          module_name: m.module_name,
          total_sessions: m.total,
          present_sessions: m.present,
          attendance_percentage: 100, // Since we only count present sessions, it's always 100%
        }))
        .sort((a, b) => b.total_sessions - a.total_sessions); // Sort by number of sessions attended

      setModuleAttendance(modules);
    } catch (err) {
      console.error("Error fetching module attendance:", err);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function submitAttendance() {
    setLoading(true);
    setMsg(null);
    setSuccess(false);

    try {
      if (!studentId.trim()) throw new Error("Student ID is required");
      if (!/^\d{6}$/.test(pin.trim())) throw new Error("PIN must be exactly 6 digits");

      const token = localStorage.getItem("token");
      if (!token) throw new Error("No authentication token found. Please log in again.");

      const res = await fetch(`${API}/api/attendance/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          student_id: studentId.trim(),
          pin: pin.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.detail || "Failed to mark attendance");
      }

      const json = (await res.json()) as MarkRes;

      setSuccess(true);
      setMsg(`Attendance marked successfully for ${json.module_code}`);
      setData(json);
      setPin("");

      // Add to local history
      if (json.module_code && json.module_name) {
        setHistory((prev) => [
          {
            module_code: json.module_code,
            module_name: json.module_name,
            marked_at: json.marked_at || new Date().toISOString(),
          },
          ...prev,
        ]);
      }

      // Refresh module attendance after successful check-in
      setTimeout(() => fetchModuleAttendance(), 1000);
    } catch (err: any) {
      setSuccess(false);
      setMsg(err?.message || "Something went wrong. Please try again.");
      console.error("Attendance error:", err);
    } finally {
      setLoading(false);
    }
  }

  // Calculate module statistics from local history
  const moduleStats = useMemo(() => {
    const map = new Map<string, { module_name: string; count: number }>();
    for (const h of history) {
      const key = h.module_code;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { module_name: h.module_name, count: 1 });
      } else {
        map.set(key, { module_name: prev.module_name, count: prev.count + 1 });
      }
    }
    return Array.from(map.entries()).map(([module_code, v]) => ({
      module_code,
      module_name: v.module_name,
      count: v.count,
    }));
  }, [history]);

  // Progress calculation
  const maxStudents = data?.max_students ?? undefined;
  const remaining = typeof data?.remaining_slots === "number" ? data.remaining_slots : undefined;
  const markedCount = useMemo(() => {
    if (typeof maxStudents === "number" && typeof remaining === "number") {
      return Math.max(0, maxStudents - remaining);
    }
    return undefined;
  }, [maxStudents, remaining]);

  const progressPct = useMemo(() => {
    if (typeof maxStudents === "number" && typeof markedCount === "number" && maxStudents > 0) {
      return Math.min(100, Math.round((markedCount / maxStudents) * 100));
    }
    return undefined;
  }, [maxStudents, markedCount]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 md:px-8 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link
            href="/student/dashboard"
            className="text-gray-400 hover:text-white transition-colors p-2 rounded-full hover:bg-gray-800"
            title="Back to Dashboard"
          >
            <ArrowLeft size={20} />
          </Link>
          <h2 className="text-lg font-semibold text-gray-200">Student Attendance</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-sm text-emerald-400 hidden sm:inline">System Online</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <UserCheck className="text-emerald-600" size={32} />
            Mark Attendance
          </h1>
          <p className="text-gray-400">
            Enter the 6-digit PIN provided by your lecturer to record your attendance.
          </p>
        </header>

        {msg && (
          <div
            className={`mb-6 rounded-lg border px-4 py-3 text-sm ${success
                ? "border-emerald-700/30 bg-emerald-950/50 text-emerald-300"
                : "border-red-700/30 bg-red-950/50 text-red-300"
              }`}
          >
            {msg}
          </div>
        )}

        <div className="bg-gray-800/70 rounded-xl border border-gray-700 shadow-sm p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <label className="text-sm font-medium text-gray-300">
              Student ID
              <div className="relative mt-1.5">
                <input
                  className="w-full rounded-lg border border-gray-600 bg-gray-700/50 px-4 py-2.5 outline-none text-white cursor-not-allowed opacity-80"
                  value={studentId || "Loading..."}
                  readOnly
                  disabled
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                  Auto-filled
                </div>
              </div>
            </label>

            <label className="text-sm font-medium text-gray-300">
              PIN (6 digits)
              <input
                className="mt-1.5 w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2.5 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 tracking-widest text-white placeholder-gray-500"
                placeholder="123456"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                maxLength={6}
                disabled={!studentId || loading}
              />
            </label>
          </div>

          <button
            onClick={submitAttendance}
            disabled={loading || !studentId || pin.length !== 6}
            className="mt-6 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
                Marking...
              </>
            ) : (
              "Mark Attendance"
            )}
          </button>

          {data?.module_code && (
            <div className="mt-6 p-5 rounded-lg bg-gray-700/40 border border-gray-600">
              <div className="text-sm text-gray-300">
                Marked for:{" "}
                <span className="font-semibold text-white">
                  {data.module_code} — {data.module_name}
                </span>
              </div>

              {data.marked_at && (
                <div className="text-sm text-gray-300 mt-1.5">
                  Time:{" "}
                  <span className="text-white">
                    {new Date(data.marked_at).toLocaleString()}
                  </span>
                </div>
              )}

              {typeof data.remaining_slots === "number" && (
                <div className="text-sm text-gray-300 mt-1.5">
                  Remaining slots:{" "}
                  <span className="font-medium text-white">{data.remaining_slots}</span>
                </div>
              )}

              {typeof progressPct === "number" && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span>Progress: {markedCount}/{maxStudents}</span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Summary Cards & Chart */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="text-sm text-gray-400">Last Module</div>
            <div className="mt-2 text-xl font-bold text-white">
              {data?.module_name ?? "—"}
            </div>
            <div className="text-sm text-gray-500 mt-1">{data?.module_code ?? ""}</div>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="text-sm text-gray-400">Attendance Records</div>
            <div className="mt-2 text-3xl font-bold text-white">{history.length}</div>
            <div className="text-sm text-gray-500 mt-1">This session</div>
          </div>

          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="text-sm text-gray-400">Remaining Slots</div>
            <div className="mt-2 text-3xl font-bold text-white">
              {typeof remaining === "number" ? remaining : "—"}
            </div>
            <div className="text-sm text-gray-500 mt-1">Current session</div>
          </div>

          {/* Module Attendance Overview - ONLY MODULES STUDENT ATTENDED */}
          <div className="lg:col-span-3 bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-200 flex items-center gap-2">
                <Calendar size={18} className="text-gray-400" />
                My Module Attendance
              </h2>
              <button
                onClick={fetchModuleAttendance}
                disabled={loadingHistory}
                className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1 disabled:opacity-50"
              >
                {loadingHistory ? "Loading..." : "Refresh"}
              </button>
            </div>

            {loadingHistory ? (
              <div className="text-sm text-gray-500 py-6 text-center">
                Loading attendance history...
              </div>
            ) : moduleAttendance.length === 0 ? (
              <div className="text-sm text-gray-500 py-6 text-center">
                No attendance records found. Mark attendance to see your progress.
              </div>
            ) : (
              <div className="space-y-4">
                {moduleAttendance.map((m) => (
                  <div key={m.module_code} className="bg-gray-700/40 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-medium text-gray-200">
                          {m.module_code}
                        </div>
                        <div className="text-sm text-gray-400 mt-0.5">
                          {m.module_name}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">
                          {m.attendance_percentage}%
                        </div>
                        <div className="text-xs text-gray-400">
                          {m.present_sessions}/{m.total_sessions} sessions
                        </div>
                      </div>
                    </div>
                    <div className="h-3 rounded-full bg-gray-700 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-400"
                        style={{ width: `${m.attendance_percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attendance by Module Chart (session-based) */}
          <div className="lg:col-span-3 bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-200 flex items-center gap-2">
                <BarChart3 size={18} className="text-gray-400" />
                Session Activity
              </h2>
              <div className="text-xs text-gray-500">Current session records</div>
            </div>

            {moduleStats.length === 0 ? (
              <div className="text-sm text-gray-500 py-6 text-center">
                No session activity yet. Mark once to see stats.
              </div>
            ) : (
              <div className="space-y-4">
                {moduleStats.map((m) => {
                  const max = Math.max(...moduleStats.map((x) => x.count), 1);
                  const width = Math.round((m.count / max) * 100);
                  return (
                    <div key={m.module_code}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <div className="font-medium text-gray-200">
                          {m.module_code} — <span className="text-gray-400">{m.module_name}</span>
                        </div>
                        <div className="font-semibold text-white">{m.count}</div>
                      </div>
                      <div className="h-3 rounded-full bg-gray-700 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-400"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}